import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "../components/ui/calendar";
import { Minus, Plus, Check, ArrowLeft, ArrowRight, Download, Mail, MessageCircle, Phone } from "lucide-react";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import api from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { formatXOF } from "../lib/i18n";
import { toast } from "sonner";
import NationalityAutocomplete from "../components/NationalityAutocomplete";
import Ticket from "../components/Ticket";

export default function BookingTunnel() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  // Two URL shapes are supported:
  //  /booking/:offerId                  (regular offer)
  //  /booking/special-event/:eventId    (themed event with custom config)
  const isSpecialEvent = location.pathname.startsWith("/booking/special-event/");
  const eventId = isSpecialEvent ? params.eventId : null;
  const offerId = isSpecialEvent ? "special_event" : params.offerId;

  const [offer, setOffer] = useState(null);
  const [specialEvent, setSpecialEvent] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [checkoutDate, setCheckoutDate] = useState(null);
  const [roomTier, setRoomTier] = useState(null);
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [participants, setParticipants] = useState([]);
  // Multi-day cumulative booking (special events): all selected dates that
  // will be billed in a single transaction. Empty means single-day flow.
  const [multiDayDates, setMultiDayDates] = useState([]);
  // Premium package selections from EventDetail (sessionStorage bridge)
  const [packageSelections, setPackageSelections] = useState([]);
  const [contact, setContact] = useState({
    special_requests: "",
    boat_time: "",
    return_boat_time: "",
  });
  // Private boat charter — optional add-on shown right under the boat-time picker.
  const [charterEnabled, setCharterEnabled] = useState(false);
  const [charterBoatId, setCharterBoatId] = useState("");
  const [charterBoats, setCharterBoats] = useState([]);

  // Load list of boats available for private charter once.
  useEffect(() => {
    api.get("/bateaux/charter")
      .then(({ data }) => setCharterBoats(data.items || []))
      .catch(() => { /* silent — feature is optional */ });
  }, []);

  // When the user turns the charter off, clear the selected boat.
  useEffect(() => {
    if (!charterEnabled) setCharterBoatId("");
  }, [charterEnabled]);
  const [availability, setAvailability] = useState(null);
  const [bookingResp, setBookingResp] = useState(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(null);

  useEffect(() => {
    if (isSpecialEvent) {
      api.get(`/special-events/${eventId}`)
        .then((r) => {
          const ev = r.data?.event;
          if (!ev) { navigate("/"); return; }
          setSpecialEvent(ev);
          // Build a synthetic "offer" so the rest of the tunnel logic keeps working
          setOffer({
            id: "special_event",
            name_fr: ev.title,
            name_en: ev.title,
            schedule_fr: ev.subtitle || "",
            schedule_en: ev.subtitle || "",
            tagline_fr: ev.description || "",
            tagline_en: ev.description || "",
            price_adult: ev.price_adult,
            price_child: ev.price_child,
            max_capacity: ev.capacity,
            is_overnight: false,
            room_tiers: [],
            // Event-specific schedule: same list for any day (no weekday/weekend split)
            boat_times: ev.boat_times || [],
            // We translate event_dates into a set of allowed ISO dates checked client-side
            event_dates: ev.event_dates || [],
            seats_per_date: ev.seats_per_date || {},
            cta_label: ev.cta_label || "Réserver ma place",
            image_url: ev.image_url || "",
          });
          // Pre-select date if passed via ?date=YYYY-MM-DD (multi-day deep link)
          const sp = new URLSearchParams(location.search);
          const qDate = sp.get("date");
          if (qDate && (ev.event_dates || []).includes(qDate)) {
            const [y, m, d] = qDate.split("-").map(Number);
            setSelectedDate(new Date(y, m - 1, d));
          }
          // Multi-day cumulative booking: read comma-separated dates list.
          const qDates = sp.get("dates");
          if (qDates) {
            const parsed = qDates.split(",").map((s) => s.trim()).filter(Boolean);
            const valid = parsed.filter((d) => (ev.event_dates || []).includes(d));
            if (valid.length > 1) setMultiDayDates(valid);
          }
          // Premium package selections (from sessionStorage bridge).
          try {
            const raw = sessionStorage.getItem(`bbr_event_pkgs_${eventId}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) setPackageSelections(parsed);
            }
          } catch (_) { /* ignore */ }
        })
        .catch(() => navigate("/"));
    } else {
      api.get(`/offers/${offerId}`).then((r) => setOffer(r.data)).catch(() => navigate("/"));
    }
  }, [offerId, eventId, isSpecialEvent, navigate, location.search]);

  useEffect(() => {
    // Multi-day cumulative booking: bypass the regular availability check and
    // use the smallest remaining-seats across all selected dates so the user
    // can't overbook on any individual day.
    if (isSpecialEvent && multiDayDates.length > 1 && offer) {
      const remainingPerDay = multiDayDates.map((d) =>
        (offer.seats_per_date && offer.seats_per_date[d]) ?? offer.max_capacity ?? 0
      );
      const minRemaining = remainingPerDay.length ? Math.min(...remainingPerDay) : (offer.max_capacity ?? 0);
      setAvailability({ remaining: minRemaining, max_capacity: offer.max_capacity ?? 0 });
      return;
    }
    if (!selectedDate) return;
    if (isSpecialEvent) {
      // Availability is derived from the event's seats_per_date map
      const iso = format(selectedDate, "yyyy-MM-dd");
      const remaining = (offer?.seats_per_date && offer.seats_per_date[iso]) ?? offer?.max_capacity ?? 0;
      setAvailability({ remaining, max_capacity: offer?.max_capacity ?? 0 });
      return;
    }
    const iso = format(selectedDate, "yyyy-MM-dd");
    api.get(`/availability/${offerId}/${iso}`).then((r) => setAvailability(r.data)).catch(() => {});
  }, [selectedDate, offerId, isSpecialEvent, offer, multiDayDates]);

  // Keep participants array in sync with adults count only.
  // Children are no longer collected as participants — they're counted via `children`
  // and attached to the booker's (first adult) ticket on the backend.
  useEffect(() => {
    setParticipants((prev) => {
      const prevAdults = prev.filter((p) => p.kind === "adult");
      const nextAdults = Array.from({ length: adults }, (_, i) =>
        prevAdults[i] || { name: "", surname: "", email: "", phone: "", nationality: "", kind: "adult" }
      );
      return nextAdults;
    });
  }, [adults]);

  const isOvernight = !!offer?.is_overnight;
  const roomTiers = offer?.room_tiers || [];
  const hasTiers = roomTiers.length > 0;
  const selectedTier = hasTiers ? roomTiers.find((t) => t.id === roomTier) : null;
  const nights = useMemo(() => {
    if (!isOvernight || !selectedDate || !checkoutDate) return 0;
    const ms = checkoutDate.getTime() - selectedDate.getTime();
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  }, [isOvernight, selectedDate, checkoutDate]);

  const charterAmount = useMemo(() => {
    if (!charterEnabled || !charterBoatId) return 0;
    const b = charterBoats.find((x) => x.id === charterBoatId);
    return b ? Number(b.charter_price || 0) : 0;
  }, [charterEnabled, charterBoatId, charterBoats]);

  // Per-day programme map for multi-day events (date → {price_adult, price_child, title})
  const programmeByDate = useMemo(() => {
    const m = {};
    if (specialEvent?.programme) {
      for (const p of specialEvent.programme) {
        if (p?.date) m[p.date] = p;
      }
    }
    return m;
  }, [specialEvent]);

  // Premium package surcharge — per-line price applied on top of base.
  const packagesAmount = useMemo(() => {
    if (!packageSelections.length || !specialEvent?.programme) return 0;
    const progByDate = {};
    for (const p of specialEvent.programme) {
      if (p?.date) progByDate[p.date] = p;
    }
    let sum = 0;
    for (const sel of packageSelections) {
      const day = progByDate[sel.date] || {};
      const pkg = (day.packages || []).find((x) => x.id === sel.package_id);
      if (!pkg) continue;
      sum += (sel.adults || 0) * Number(pkg.price_adult || 0)
           + (sel.children || 0) * Number(pkg.price_child || 0);
    }
    return sum;
  }, [packageSelections, specialEvent]);

  const total = useMemo(() => {
    if (!offer) return 0;
    let base;
    if (isOvernight && hasTiers) {
      base = selectedTier ? selectedTier.price * nights * rooms : 0;
    } else if (isSpecialEvent && multiDayDates.length > 1) {
      // Cumulative across all selected event days, picking per-day prices
      // from the programme when defined (falls back to event-level prices).
      base = multiDayDates.reduce((sum, d) => {
        const item = programmeByDate[d] || {};
        const pa = Number(item.price_adult ?? offer.price_adult ?? 0);
        const pc = Number(item.price_child ?? offer.price_child ?? 0);
        return sum + adults * pa + children * pc;
      }, 0);
    } else {
      const guestsBase = adults * offer.price_adult + children * offer.price_child;
      base = isOvernight ? guestsBase * nights : guestsBase;
    }
    return base + charterAmount + packagesAmount;
  }, [offer, adults, children, isOvernight, hasTiers, selectedTier, nights, rooms, charterAmount, isSpecialEvent, multiDayDates, programmeByDate, packagesAmount]);

  const offerName = offer ? (lang === "fr" ? offer.name_fr : offer.name_en) : "";

  const totalGuests = adults + children;
  const remaining = availability?.remaining ?? null;

  // Compute boat times to show based on selected date (day-dependent for Le Kaai)
  const boatTimes = useMemo(() => {
    if (!offer) return [];
    if (offer.boat_times_weekday && offer.boat_times_weekend) {
      if (!selectedDate) return offer.boat_times_weekday;
      const pyWeekday = (selectedDate.getDay() + 6) % 7;
      return pyWeekday >= 5 ? offer.boat_times_weekend : offer.boat_times_weekday;
    }
    return offer.boat_times || [];
  }, [offer, selectedDate]);

  // Compute return boat times based on checkout date (for overnight stays)
  const returnBoatTimes = useMemo(() => {
    if (!offer || !isOvernight) return [];
    if (offer.boat_times_weekday && offer.boat_times_weekend) {
      if (!checkoutDate) return offer.boat_times_weekday;
      const pyWeekday = (checkoutDate.getDay() + 6) % 7;
      return pyWeekday >= 5 ? offer.boat_times_weekend : offer.boat_times_weekday;
    }
    return offer.boat_times || [];
  }, [offer, isOvernight, checkoutDate]);

  // Reset boat_time if it's no longer in the allowed set for the chosen date
  useEffect(() => {
    if (contact.boat_time && !boatTimes.includes(contact.boat_time)) {
      setContact((c) => ({ ...c, boat_time: "" }));
    }
  }, [boatTimes, contact.boat_time]);

  // Reset return_boat_time if checkout date changes and it's no longer valid
  useEffect(() => {
    if (contact.return_boat_time && !returnBoatTimes.includes(contact.return_boat_time)) {
      setContact((c) => ({ ...c, return_boat_time: "" }));
    }
  }, [returnBoatTimes, contact.return_boat_time]);

  // Multi-day cumulative booking: skip the date-picker step entirely — dates
  // were already chosen on /event/:id. Auto-jump to step 2 once the event
  // metadata is loaded and the dates state is hydrated. MUST be declared
  // above the conditional `return` to satisfy react-hooks/rules-of-hooks.
  useEffect(() => {
    if (isSpecialEvent && multiDayDates.length > 1 && step === 1) {
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpecialEvent, multiDayDates.length, step]);

  if (!offer) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-[#0A0A0A]/40 text-sm uppercase tracking-[0.3em]">
        Loading…
      </div>
    );
  }

  // Validation: booker (participants[0]) must provide email + phone.
  // Other adults only need name + surname + nationality.
  const participantsValid =
    participants.length === adults &&
    adults >= 1 &&
    participants.every(
      (p, i) =>
        p.name.trim() &&
        p.surname.trim() &&
        p.nationality.trim() &&
        (i > 0 || (p.phone.trim() && /\S+@\S+\.\S+/.test(p.email)))
    );
  const contactValid =
    participantsValid &&
    !!contact.boat_time &&
    (!isOvernight || !!contact.return_boat_time) &&
    (!charterEnabled || !!charterBoatId);

  // Human-readable list of what's still missing at step 3 (shown beside the disabled Next button)
  const missingStep3 = [];
  if (!participantsValid) missingStep3.push(t.booking.missingParticipants);
  if (!contact.boat_time) missingStep3.push(t.booking.missingBoatTime);
  if (isOvernight && !contact.return_boat_time) missingStep3.push(t.booking.missingReturnBoatTime);
  if (charterEnabled && !charterBoatId) missingStep3.push("bateau privatisé");

  const isMultiDay = isSpecialEvent && multiDayDates.length > 1;

  const stepValid = {
    1:
      isMultiDay || (
        !!selectedDate &&
        (!isOvernight || (!!checkoutDate && nights >= 1)) &&
        remaining !== null &&
        remaining >= totalGuests &&
        totalGuests >= 1
      ),
    2: totalGuests >= 1 && (remaining === null || remaining >= totalGuests) && (!hasTiers || !!selectedTier),
    3: contactValid,
    4: true,
  };

  const goNext = () => step < 5 && setStep(step + 1);
  const goBack = () => {
    if (step > 1) {
      // Don't bounce back into the (skipped) date step on multi-day bookings.
      if (step === 2 && isMultiDay) return;
      setStep(step - 1);
    }
  };

  const handleCreateBooking = async () => {
    if (!stepValid[3]) return;
    setCreating(true);
    try {
      const iso = format(selectedDate, "yyyy-MM-dd");
      const checkoutIso = isOvernight && checkoutDate ? format(checkoutDate, "yyyy-MM-dd") : null;
      const { data } = await api.post("/bookings", {
        offer_type: offerId,
        special_event_id: isSpecialEvent ? eventId : null,
        date: iso,
        checkout_date: checkoutIso,
        room_tier: hasTiers ? roomTier : null,
        rooms: hasTiers ? rooms : 1,
        adults,
        children,
        participants: participants.map((p, i) => ({
          name: p.name.trim(),
          surname: p.surname.trim(),
          // Email & phone are only required on the booker (first adult). For
          // other adults the backend will fall back to the booker's contact.
          email: i === 0 ? p.email.trim().toLowerCase() : (p.email || "").trim().toLowerCase() || null,
          phone: i === 0 ? p.phone.trim() : (p.phone || "").trim() || null,
          nationality: p.nationality.trim(),
          kind: "adult",
        })),
        boat_time: contact.boat_time,
        return_boat_time: isOvernight ? contact.return_boat_time : null,
        special_requests: contact.special_requests,
        charter_boat_id: charterEnabled && charterBoatId ? charterBoatId : null,
        multi_day_dates: (isSpecialEvent && multiDayDates.length > 1) ? multiDayDates : null,
        package_selections: packageSelections.length > 0 ? packageSelections : null,
      });
      // Clear the package-selection bridge once the booking is created
      if (isSpecialEvent && eventId) {
        try { sessionStorage.removeItem(`bbr_event_pkgs_${eventId}`); } catch (_) { /* ignore */ }
      }
      setBookingResp(data);
      setStep(5);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Booking failed");
    } finally {
      setCreating(false);
    }
  };

  const handlePay = async (method = "fineo", extra = {}) => {
    if (!bookingResp) return;
    const trackKey = method === "deposit" && extra.deposit_pct ? `deposit-${extra.deposit_pct}` : method;
    setPaying(trackKey);

    // Real FineoPay flow: open the hosted checkout in a NEW tab and switch
    // OUR tab to the result page right away. FineoPay does not support
    // returnUrl (confirmed by their support), so this is how we guarantee
    // the customer always lands back on our confirmation page once payment
    // settles — the background sweeper detects it within ~30s.
    // Hébergement "deposit" also goes through FineoPay with a partial amount —
    // _settle_payment detects the ratio and applies the proper deposit status.
    if (method === "fineo" || method === "deposit") {
      try {
        const checkoutBody = { booking_id: bookingResp.id, intent: "booking" };
        if (method === "deposit" && extra.deposit_pct) {
          checkoutBody.amount = Math.round((bookingResp.total_amount * extra.deposit_pct) / 100);
        }
        const { data } = await api.post(`/payments/fineo/checkout`, checkoutBody);
        if (data?.checkout_url) {
          window.open(data.checkout_url, "_blank", "noopener,noreferrer");
          // Move our tab to the result page → starts polling for "paid".
          navigate(`/payment/fineo/result?booking_id=${bookingResp.id}&intent=booking`);
          return;
        }
        throw new Error("Aucune URL FineoPay reçue");
      } catch (e) {
        const detail = e.response?.data?.detail || e.message || "FineoPay indisponible";
        toast.error(`Paiement FineoPay : ${detail}`);
        setPaying(null);
        return;
      }
    }

    try {
      const { data } = await api.post(`/bookings/${bookingResp.id}/pay`, {
        reference_token: bookingResp.reference_token,
        payment_method: method,
        ...extra,
      });
      setBookingResp(data);
      toast.success(t.booking.successTitle);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Payment failed");
    } finally {
      setPaying(null);
    }
  };

  const setC = (k) => (e) => setContact({ ...contact, [k]: e.target.value });

  return (
    <div data-testid="booking-tunnel" className="min-h-screen bg-white text-[#0A0A0A] pt-32 sm:pt-36 md:pt-44 pb-24 px-4 sm:px-6 md:px-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 sm:mb-12">
          <button
            onClick={() => {
              // If we have history within the app, go back to the previous page
              // (e.g. the pole page). Otherwise fall back to home.
              if (location.key && location.key !== "default") {
                navigate(-1);
              } else {
                navigate("/");
              }
            }}
            className="text-[0.7rem] uppercase tracking-[0.28em] text-[#0A0A0A]/50 hover:text-[#B8922A] transition-colors inline-flex items-center gap-2 mb-5 sm:mb-6"
            data-testid="back-link"
          >
            <ArrowLeft size={14} />
            {t.booking.back}
          </button>
          <div className="text-[0.65rem] sm:text-[0.7rem] uppercase tracking-[0.28em] sm:tracking-[0.4em] text-[#B8922A] mb-2 sm:mb-3">
            {offer.schedule_fr && lang === "fr" ? offer.schedule_fr : offer.schedule_en}
          </div>
          <h1 className="font-display-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight leading-tight">
            {offerName}
          </h1>
          <div className="gold-divider mt-4 sm:mt-5" />
          {(lang === "fr" ? offer.tagline_fr : offer.tagline_en) && (
            <p
              className="mt-5 sm:mt-6 text-[0.95rem] sm:text-base text-[#0A0A0A]/70 leading-relaxed whitespace-pre-line max-w-2xl"
              data-testid="offer-description"
            >
              {lang === "fr" ? offer.tagline_fr : offer.tagline_en}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 mb-10 sm:mb-14">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`h-px flex-1 transition-colors duration-500 ${
                step >= n ? "bg-[#B8922A]" : "bg-[#0A0A0A]/15"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 && (
              <div data-testid="booking-step-1">
                <h2 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A] mb-2">
                  {t.booking.step1}
                </h2>
                <p className="text-sm text-[#0A0A0A]/50 mb-6 sm:mb-8">
                  {isOvernight ? `${t.booking.pickArrival} · ${t.booking.pickCheckout}` : t.booking.pickDate}
                </p>

                {isOvernight ? (
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="min-w-0 w-full lg:w-auto">
                      <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">
                        {t.booking.pickArrival}
                      </div>
                      <div className="bg-[#FAFAF7] border border-[#F5F0E8]/10 p-2 sm:p-4 overflow-x-auto">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(d) => {
                            setSelectedDate(d);
                            // Reset checkout if it's no longer after arrival
                            if (checkoutDate && d && checkoutDate <= d) setCheckoutDate(null);
                          }}
                          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                          locale={lang === "fr" ? frLocale : enUS}
                          classNames={{
                            day_today: "bg-transparent text-[#0A0A0A] hover:bg-[#B8922A]/10",
                            day_selected:
                              "bg-[#B8922A] text-[#0A0A0A] hover:bg-[#B8922A] hover:text-[#0A0A0A] focus:bg-[#B8922A] focus:text-[#0A0A0A]",
                          }}
                          data-testid="booking-calendar-arrival"
                          className="text-[#0A0A0A]"
                        />
                      </div>
                    </div>
                    <div className="min-w-0 w-full lg:w-auto">
                      <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">
                        {t.booking.pickCheckout}
                      </div>
                      <div className="bg-[#FAFAF7] border border-[#F5F0E8]/10 p-2 sm:p-4 overflow-x-auto">
                        <Calendar
                          mode="single"
                          selected={checkoutDate}
                          onSelect={setCheckoutDate}
                          disabled={(d) => {
                            const minDate = selectedDate
                              ? new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000)
                              : new Date(new Date().setHours(0, 0, 0, 0));
                            return d < minDate;
                          }}
                          locale={lang === "fr" ? frLocale : enUS}
                          classNames={{
                            day_today: "bg-transparent text-[#0A0A0A] hover:bg-[#B8922A]/10",
                            day_selected:
                              "bg-[#B8922A] text-[#0A0A0A] hover:bg-[#B8922A] hover:text-[#0A0A0A] focus:bg-[#B8922A] focus:text-[#0A0A0A]",
                          }}
                          data-testid="booking-calendar-checkout"
                          className="text-[#0A0A0A]"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#FAFAF7] border border-[#F5F0E8]/10 p-2 sm:p-4 overflow-x-auto">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(d) => {
                        if (d < new Date(new Date().setHours(0, 0, 0, 0))) return true;
                        if (isSpecialEvent) {
                          const iso = format(d, "yyyy-MM-dd");
                          return !(offer.event_dates || []).includes(iso);
                        }
                        const pyWeekday = (d.getDay() + 6) % 7;
                        if (offer.allowed_weekdays && !offer.allowed_weekdays.includes(pyWeekday)) return true;
                        return false;
                      }}
                      locale={lang === "fr" ? frLocale : enUS}
                      classNames={{
                        day_today:
                          "bg-transparent text-[#0A0A0A] hover:bg-[#B8922A]/10",
                        day_selected:
                          "bg-[#B8922A] text-[#0A0A0A] hover:bg-[#B8922A] hover:text-[#0A0A0A] focus:bg-[#B8922A] focus:text-[#0A0A0A]",
                      }}
                      data-testid="booking-calendar"
                      className="text-[#0A0A0A]"
                    />
                  </div>
                )}

                {isOvernight && nights > 0 && (
                  <div className="mt-6 text-sm text-[#0A0A0A]/70" data-testid="nights-count">
                    <span className="text-[#B8922A] font-medium">{nights}</span>{" "}
                    {nights > 1 ? t.booking.nights.toLowerCase() : t.booking.night}
                  </div>
                )}
                {availability && availability.remaining <= 0 && (
                  <div className="mt-6 text-sm">
                    <div className="text-red-400">{t.booking.capacityFull}</div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div data-testid="booking-step-2" className={hasTiers ? "max-w-2xl" : "max-w-md"}>
                <h2 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A] mb-2">
                  {t.booking.step2}
                </h2>
                <div className="gold-divider mb-8" />

                {hasTiers && (
                  <div className="mb-10" data-testid="room-tier-selector">
                    <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">
                      {t.booking.roomType}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {roomTiers.map((tier) => {
                        const selected = roomTier === tier.id;
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() => setRoomTier(tier.id)}
                            className={`text-left p-5 border transition-all ${
                              selected
                                ? "border-[#B8922A] bg-[#B8922A]/5"
                                : "border-[#0A0A0A]/15 hover:border-[#B8922A]/50"
                            }`}
                            data-testid={`room-tier-${tier.id}`}
                          >
                            <div className="font-display-serif text-lg text-[#0A0A0A] mb-2 leading-tight">
                              {lang === "fr" ? tier.name_fr : tier.name_en}
                            </div>
                            {tier.price_on_request ? (
                              <div className="text-[#B8922A] font-medium text-[0.85rem]">
                                {lang === "fr" ? "Sur demande" : "On request"}
                              </div>
                            ) : (
                              <div className="text-[#B8922A] font-medium">
                                {formatXOF(tier.price)}
                                <span className="text-[0.7rem] text-[#0A0A0A]/50 ml-1">
                                  {t.offers.perNight}
                                </span>
                              </div>
                            )}
                            {(lang === "fr" ? tier.description_fr : tier.description_en) && (
                              <p className="text-[0.7rem] text-[#0A0A0A]/55 mt-2 leading-snug">
                                {lang === "fr" ? tier.description_fr : tier.description_en}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-8">
                  {!hasTiers && (
                    <>
                      <CounterRow
                        label={t.booking.adults}
                        sublabel={`${formatXOF(offer.price_adult)} / ${t.offers.adult}${isOvernight ? ` ${t.offers.perNight}` : ""}`}
                        value={adults}
                        onDec={() => setAdults(Math.max(0, adults - 1))}
                        onInc={() => setAdults(adults + 1)}
                        testId="counter-adults"
                      />
                      <CounterRow
                        label={t.booking.children}
                        sublabel={`${formatXOF(offer.price_child)} / ${t.offers.child}${isOvernight ? ` ${t.offers.perNight}` : ""} · ${t.booking.childrenHint}`}
                        value={children}
                        onDec={() => setChildren(Math.max(0, children - 1))}
                        onInc={() => setChildren(children + 1)}
                        testId="counter-children"
                      />
                    </>
                  )}
                  {hasTiers && (
                    <>
                      <CounterRow
                        label={t.booking.rooms}
                        sublabel={t.booking.roomsHint}
                        value={rooms}
                        onDec={() => setRooms(Math.max(1, rooms - 1))}
                        onInc={() => setRooms(rooms + 1)}
                        testId="counter-rooms"
                      />
                      <CounterRow
                        label={t.booking.adults}
                        sublabel={t.booking.adultsHint}
                        value={adults}
                        onDec={() => setAdults(Math.max(0, adults - 1))}
                        onInc={() => setAdults(adults + 1)}
                        testId="counter-adults"
                      />
                      <CounterRow
                        label={t.booking.children}
                        sublabel={t.booking.childrenHint}
                        value={children}
                        onDec={() => setChildren(Math.max(0, children - 1))}
                        onInc={() => setChildren(children + 1)}
                        testId="counter-children"
                      />
                    </>
                  )}
                </div>

                {isOvernight && nights > 0 && (
                  <div className="mt-8 text-sm text-[#0A0A0A]/60" data-testid="step2-nights">
                    × <span className="text-[#B8922A] font-medium">{nights}</span>{" "}
                    {nights > 1 ? t.booking.nights.toLowerCase() : t.booking.night}
                  </div>
                )}

                <div className="mt-12 pt-6 border-t border-[#F5F0E8]/10 flex justify-between items-baseline">
                  <span className="text-[0.7rem] uppercase tracking-[0.28em] text-[#0A0A0A]/50">
                    {t.booking.total}
                  </span>
                  <span className="font-display-serif text-3xl text-[#B8922A]">
                    {selectedTier?.price_on_request
                      ? (lang === "fr" ? "Sur demande" : "On request")
                      : formatXOF(total)}
                  </span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div data-testid="booking-step-3" className="max-w-3xl">
                <h2 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A] mb-2">
                  {t.booking.step3}
                </h2>
                <div className="gold-divider mb-6 sm:mb-8" />

                {/* Children attached info (no per-child form) */}
                {children > 0 && (
                  <div className="mb-5 sm:mb-6 border border-[#B8922A]/30 bg-[#FBF8EF] px-4 py-3 sm:px-5 sm:py-4">
                    <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] font-medium mb-1">
                      Enfants accompagnés
                    </div>
                    <div className="text-[0.82rem] text-[#0A0A0A]/75 leading-relaxed">
                      <strong>{children} enfant{children > 1 ? "s" : ""}</strong> rattaché{children > 1 ? "s" : ""} au billet du réservant. Aucune coordonnée à saisir.
                    </div>
                  </div>
                )}

                {/* Participants — 1 ticket par adulte. Booker (1er adulte) renseigne email + téléphone. */}
                <div className="space-y-5 sm:space-y-6">
                  {participants.map((p, i) => {
                    const isFirst = i === 0;
                    const label = isFirst
                      ? `Réservant · ${t.booking.primaryContact}${children > 0 ? ` + ${children} enfant${children > 1 ? "s" : ""}` : ""}`
                      : `Adulte ${i + 1}`;
                    const update = (field) => (e) => {
                      const next = [...participants];
                      next[i] = { ...next[i], [field]: e.target.value };
                      setParticipants(next);
                    };
                    return (
                      <div
                        key={i}
                        data-testid={`participant-${i}`}
                        className="border border-[#0A0A0A]/10 bg-[#FAFAF7] p-4 sm:p-6 md:p-7"
                      >
                        <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4 sm:mb-5">
                          {label}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                          <Field
                            label={t.booking.surname}
                            value={p.surname}
                            onChange={update("surname")}
                            testId={`participant-${i}-surname`}
                          />
                          <Field
                            label={t.booking.name}
                            value={p.name}
                            onChange={update("name")}
                            testId={`participant-${i}-name`}
                          />
                          {isFirst ? (
                            <>
                              <Field
                                type="email"
                                label={t.booking.email}
                                value={p.email}
                                onChange={update("email")}
                                testId={`participant-${i}-email`}
                              />
                              <Field
                                type="tel"
                                label={t.booking.phone}
                                value={p.phone}
                                onChange={update("phone")}
                                testId={`participant-${i}-phone`}
                              />
                            </>
                          ) : (
                            <>
                              <div>
                                <Field
                                  type="email"
                                  label={`${t.booking.email} (optionnel)`}
                                  value={p.email}
                                  onChange={update("email")}
                                  testId={`participant-${i}-email`}
                                />
                                <p className="text-[0.68rem] text-[#0A0A0A]/50 mt-1.5 leading-snug">
                                  Pour envoyer son billet directement à cet adulte. Si vide, le billet partira chez le réservant.
                                </p>
                              </div>
                              <Field
                                type="tel"
                                label={`${t.booking.phone} (optionnel)`}
                                value={p.phone}
                                onChange={update("phone")}
                                testId={`participant-${i}-phone`}
                              />
                            </>
                          )}
                          <div className="md:col-span-2">
                            <NationalityAutocomplete
                              label={t.booking.nationality}
                              value={p.nationality}
                              onChange={update("nationality")}
                              lang={lang}
                              testId={`participant-${i}-nationality`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Boat time(s) */}
                {isOvernight ? (
                  <>
                    <div className="mt-10">
                      <label className="label-luxury">{t.booking.arrivalBoatTime}</label>
                      <p className="text-[0.75rem] text-[#0A0A0A]/50 mb-3 -mt-1">
                        {t.booking.arrivalBoatTimeHint}
                        {selectedDate && (
                          <span className="ml-2 text-[#B8922A]">
                            · {format(selectedDate, "EEEE d MMMM", { locale: lang === "fr" ? frLocale : enUS })}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2.5" data-testid="boat-time-group">
                        {(boatTimes || []).map((h) => {
                          const selected = contact.boat_time === h;
                          return (
                            <button
                              key={h}
                              type="button"
                              onClick={() => setContact({ ...contact, boat_time: h })}
                              className={`px-5 py-2.5 text-sm tracking-[0.18em] font-medium border transition-all ${
                                selected
                                  ? "bg-[#B8922A] text-white border-[#B8922A]"
                                  : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"
                              }`}
                              data-testid={`boat-time-${h}`}
                            >
                              {h}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-8">
                      <label className="label-luxury">{t.booking.returnBoatTime}</label>
                      <p className="text-[0.75rem] text-[#0A0A0A]/50 mb-3 -mt-1">
                        {t.booking.returnBoatTimeHint}
                        {checkoutDate && (
                          <span className="ml-2 text-[#B8922A]">
                            · {format(checkoutDate, "EEEE d MMMM", { locale: lang === "fr" ? frLocale : enUS })}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2.5" data-testid="return-boat-time-group">
                        {(returnBoatTimes || []).map((h) => {
                          const selected = contact.return_boat_time === h;
                          return (
                            <button
                              key={h}
                              type="button"
                              onClick={() => setContact({ ...contact, return_boat_time: h })}
                              className={`px-5 py-2.5 text-sm tracking-[0.18em] font-medium border transition-all ${
                                selected
                                  ? "bg-[#B8922A] text-white border-[#B8922A]"
                                  : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"
                              }`}
                              data-testid={`return-boat-time-${h}`}
                            >
                              {h}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-10">
                    <label className="label-luxury">{t.booking.boatTime}</label>
                    <p className="text-[0.75rem] text-[#0A0A0A]/50 mb-3 -mt-1">{t.booking.boatTimeHint}</p>
                    <div className="flex flex-wrap gap-2.5" data-testid="boat-time-group">
                      {(boatTimes || []).map((h) => {
                        const selected = contact.boat_time === h;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setContact({ ...contact, boat_time: h })}
                            className={`px-5 py-2.5 text-sm tracking-[0.18em] font-medium border transition-all ${
                              selected
                                ? "bg-[#B8922A] text-white border-[#B8922A]"
                                : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"
                            }`}
                            data-testid={`boat-time-${h}`}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Private boat charter — optional add-on for any offer */}
                {charterBoats.length > 0 && (
                  <div className="mt-8 border border-[#B8922A]/20 bg-[#FBF8EF] p-5">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={charterEnabled}
                        onChange={(e) => setCharterEnabled(e.target.checked)}
                        className="mt-1 w-4 h-4 accent-[#B8922A]"
                        data-testid="charter-toggle"
                      />
                      <div className="flex-1">
                        <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[#B8922A] font-medium">
                          Privatiser un bateau
                        </div>
                        <div className="text-[0.78rem] text-[#0A0A0A]/65 mt-1 leading-relaxed">
                          Voyagez en privé, à votre rythme. Le montant choisi sera ajouté au total.
                        </div>
                      </div>
                    </label>

                    {charterEnabled && (
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="charter-boat-list">
                        {charterBoats.map((b) => {
                          const selected = charterBoatId === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setCharterBoatId(b.id)}
                              className={`text-left p-4 border transition-all ${
                                selected
                                  ? "bg-[#B8922A] text-white border-[#B8922A]"
                                  : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
                              }`}
                              data-testid={`charter-boat-${b.id}`}
                            >
                              <div className="font-medium text-sm">{b.name}</div>
                              <div className={`text-[0.72rem] mt-0.5 ${selected ? "text-white/85" : "text-[#0A0A0A]/55"}`}>
                                Capacité : {b.capacity} pers.
                              </div>
                              <div className={`mt-2 font-medium ${selected ? "text-white" : "text-[#B8922A]"}`}>
                                {formatXOF(b.charter_price)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Special requests */}
                <div className="mt-8">
                  <label className="label-luxury">{t.booking.specialRequests}</label>
                  <textarea
                    data-testid="special-requests-input"
                    value={contact.special_requests}
                    onChange={setC("special_requests")}
                    placeholder={t.booking.specialRequestsPlaceholder}
                    rows={4}
                    className="input-luxury resize-none"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div data-testid="booking-step-4" className="max-w-2xl">
                <h2 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A] mb-2">
                  {t.booking.summary}
                </h2>
                <div className="gold-divider mb-6 sm:mb-8" />

                <div className="bg-[#FAFAF7] border border-[#0A0A0A]/10 p-5 sm:p-8 space-y-4 sm:space-y-5">
                  <SummaryRow label={t.booking.offer} value={offerName} />
                  {isOvernight ? (
                    <>
                      <SummaryRow
                        label={t.booking.arrivalLabel}
                        value={selectedDate ? format(selectedDate, "EEEE d MMMM yyyy", { locale: lang === "fr" ? frLocale : enUS }) : "—"}
                      />
                      <SummaryRow
                        label={t.booking.checkoutLabel}
                        value={checkoutDate ? format(checkoutDate, "EEEE d MMMM yyyy", { locale: lang === "fr" ? frLocale : enUS }) : "—"}
                      />
                      <SummaryRow
                        label={t.booking.nights}
                        value={`${nights} ${nights > 1 ? t.booking.nights.toLowerCase() : t.booking.night}`}
                      />
                    </>
                  ) : isMultiDay ? (
                    <>
                      <SummaryRow
                        label="Dates sélectionnées"
                        value={`${multiDayDates.length} journée${multiDayDates.length > 1 ? "s" : ""}`}
                      />
                      <div className="pl-1 -mt-1 mb-3" data-testid="summary-multi-dates">
                        {multiDayDates.map((d) => {
                          const item = programmeByDate[d] || {};
                          const pa = Number(item.price_adult ?? offer.price_adult ?? 0);
                          const pc = Number(item.price_child ?? offer.price_child ?? 0);
                          const line = adults * pa + children * pc;
                          const [y, m, dd] = d.split("-");
                          const dateLabel = new Date(+y, +m - 1, +dd).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
                          return (
                            <div key={d} className="flex justify-between items-baseline text-[0.78rem] text-[#0A0A0A]/70 py-0.5">
                              <span>· {dateLabel}{item.title ? ` — ${item.title}` : ""}</span>
                              <span className="tabular-nums">{formatXOF(line)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <SummaryRow
                      label={t.booking.date}
                      value={selectedDate ? format(selectedDate, "EEEE d MMMM yyyy", { locale: lang === "fr" ? frLocale : enUS }) : "—"}
                    />
                  )}
                  <SummaryRow
                    label={isOvernight ? t.booking.arrivalBoatTime : t.booking.boatTime}
                    value={contact.boat_time}
                  />
                  {isOvernight && (
                    <SummaryRow
                      label={t.booking.returnBoatTime}
                      value={contact.return_boat_time || "—"}
                    />
                  )}
                  {hasTiers && selectedTier && (
                    <>
                      <SummaryRow
                        label={t.booking.rooms}
                        value={`${rooms}`}
                      />
                      <SummaryRow
                        label={t.booking.roomType}
                        value={
                          selectedTier.price_on_request
                            ? `${lang === "fr" ? selectedTier.name_fr : selectedTier.name_en} · ${lang === "fr" ? "Sur demande" : "On request"}`
                            : `${lang === "fr" ? selectedTier.name_fr : selectedTier.name_en} · ${formatXOF(selectedTier.price)} ${t.offers.perNight}${rooms > 1 ? ` × ${rooms}` : ""} × ${nights} ${nights > 1 ? t.booking.nights.toLowerCase() : t.booking.night}`
                        }
                      />
                    </>
                  )}
                  <SummaryRow
                    label={t.booking.adults}
                    value={
                      hasTiers
                        ? `${adults}`
                        : offer.price_adult > 0
                        ? isOvernight
                          ? `${adults} × ${formatXOF(offer.price_adult)} × ${nights} ${nights > 1 ? t.booking.nights.toLowerCase() : t.booking.night}`
                          : `${adults} × ${formatXOF(offer.price_adult)}`
                        : `${adults}`
                    }
                  />
                  {children > 0 && (
                    <SummaryRow
                      label={t.booking.children}
                      value={
                        hasTiers
                          ? `${children}`
                          : offer.price_child > 0
                          ? isOvernight
                            ? `${children} × ${formatXOF(offer.price_child)} × ${nights} ${nights > 1 ? t.booking.nights.toLowerCase() : t.booking.night}`
                            : `${children} × ${formatXOF(offer.price_child)}`
                          : `${children}`
                      }
                    />
                  )}

                  <div className="pt-4 border-t border-[#0A0A0A]/10">
                    <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">
                      {t.booking.participantsLabel}
                    </div>
                    <ul className="space-y-3">
                      {participants.map((p, i) => (
                        <li key={i} className="flex items-start justify-between gap-6">
                          <span className="text-[0.72rem] uppercase tracking-[0.2em] text-[#0A0A0A]/50 shrink-0">
                            {i === 0 ? "Réservant" : `Adulte ${i + 1}`}
                          </span>
                          <span className="text-sm text-[#0A0A0A] text-right">
                            {p.surname} {p.name} · {p.nationality}
                            {i === 0 && (
                              <span className="block text-[0.72rem] text-[#0A0A0A]/50 mt-0.5">
                                {p.email} · {p.phone}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                      {children > 0 && (
                        <li className="flex items-start justify-between gap-6 pt-1">
                          <span className="text-[0.72rem] uppercase tracking-[0.2em] text-[#0A0A0A]/50 shrink-0">
                            Enfants
                          </span>
                          <span className="text-sm text-[#0A0A0A] text-right">
                            {children} enfant{children > 1 ? "s" : ""} (rattaché{children > 1 ? "s" : ""} au réservant)
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Check-in / Check-out reminder for overnight bookings */}
                  {isOvernight && (
                    <div className="border border-[#B8922A]/25 bg-[#FBF8EF] px-4 py-3 sm:px-5 sm:py-4">
                      <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] font-medium mb-1">
                        Horaires de l'hôtel
                      </div>
                      <div className="text-[0.82rem] text-[#0A0A0A]/75 leading-relaxed">
                        <strong>Check-in :</strong> à partir de <strong>14h00</strong>
                        <span className="mx-2 text-[#0A0A0A]/30">·</span>
                        <strong>Check-out :</strong> avant <strong>12h00</strong>
                      </div>
                    </div>
                  )}

                  {contact.special_requests && <SummaryRow label={t.booking.specialRequests} value={contact.special_requests} />}
                  {charterEnabled && charterBoatId && (() => {
                    const cb = charterBoats.find((b) => b.id === charterBoatId);
                    if (!cb) return null;
                    return (
                      <div className="border-t border-[#0A0A0A]/10 pt-4 mt-2" data-testid="summary-charter">
                        <SummaryRow
                          label="Privatisation"
                          value={`${cb.name} · ${formatXOF(cb.charter_price)}`}
                        />
                      </div>
                    );
                  })()}
                  {packageSelections.length > 0 && specialEvent?.programme && (
                    <div className="border-t border-[#0A0A0A]/10 pt-4 mt-2" data-testid="summary-packages">
                      <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] mb-2">Packages premium</div>
                      {packageSelections.map((sel, i) => {
                        const day = (specialEvent.programme || []).find((p) => p.date === sel.date) || {};
                        const pkg = (day.packages || []).find((x) => x.id === sel.package_id);
                        if (!pkg) return null;
                        const line = (sel.adults || 0) * Number(pkg.price_adult || 0)
                                  + (sel.children || 0) * Number(pkg.price_child || 0);
                        const [y, m, dd] = sel.date.split("-");
                        const dateLabel = new Date(+y, +m - 1, +dd).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                        return (
                          <div key={`pkg-${i}`} className="flex justify-between items-baseline text-[0.78rem] text-[#0A0A0A]/70 py-0.5">
                            <span>· {dateLabel} — {pkg.label} ({sel.adults || 0}A {sel.children > 0 ? `+ ${sel.children}E` : ""})</span>
                            <span className="tabular-nums">{formatXOF(line)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="pt-5 border-t border-[#0A0A0A]/10 flex justify-between items-baseline">
                    <span className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A]">
                      {t.booking.total}
                    </span>
                    <span className="font-display-serif text-3xl text-[#B8922A]">
                      {total > 0 ? formatXOF(total) : t.offers.reservationOnly}
                    </span>
                  </div>
                </div>

                {/* Hotel contact reminder before payment — mobile-tap-to-call */}
                <div className="mt-6 sm:mt-7 border border-[#B8922A]/30 bg-[#FBF8EF] p-4 sm:p-5 rounded-sm" data-testid="hotel-contact-alert">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#B8922A] text-white flex items-center justify-center flex-shrink-0">
                      <Phone size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] font-semibold mb-1">
                        Une question avant de payer ?
                      </div>
                      <p className="text-[0.85rem] text-[#0A0A0A]/75 leading-relaxed">
                        Notre équipe répond à vos questions sur la réservation, l'accès en bateau ou les conditions sur place.
                      </p>
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
                        <a
                          href="tel:+22507046000000"
                          className="text-[#B8922A] font-medium hover:underline inline-flex items-center gap-1.5"
                          data-testid="hotel-phone-1"
                        >
                          <Phone size={13} /> +225 07 04 600 000
                        </a>
                        <span className="hidden sm:inline text-[#0A0A0A]/30">·</span>
                        <a
                          href="tel:+22507174000600"
                          className="text-[#B8922A] font-medium hover:underline inline-flex items-center gap-1.5"
                          data-testid="hotel-phone-2"
                        >
                          <Phone size={13} /> +225 07 17 400 600
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateBooking}
                  className="btn-gold mt-7 sm:mt-8 inline-flex items-center gap-3"
                  data-testid="confirm-summary-btn"
                  disabled={creating}
                >
                  {creating ? "…" : total > 0 ? t.booking.proceedToPayment : t.booking.confirmReservation}
                  <ArrowRight size={14} />
                </button>
              </div>
            )}

            {step === 5 && bookingResp && (
              <div data-testid="booking-step-5" className="max-w-3xl">
                {bookingResp.status === "confirmed" || bookingResp.status === "pending_cash_payment" ? (
                  <ConfirmationView booking={bookingResp} t={t} lang={lang} navigate={navigate} />
                ) : (
                  <PaymentView booking={bookingResp} onPay={handlePay} paying={paying} t={t} isOvernight={isOvernight} />
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {step < 4 && (
          <div className="mt-14">
            <div className="flex items-center justify-between">
              <button
                onClick={goBack}
                disabled={step === 1}
                className="text-[0.72rem] uppercase tracking-[0.28em] text-[#0A0A0A]/50 hover:text-[#B8922A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-2"
                data-testid="step-back-btn"
              >
                <ArrowLeft size={14} />
                {t.booking.back}
              </button>
              <button
                onClick={goNext}
                disabled={!stepValid[step]}
                className="btn-gold inline-flex items-center gap-3"
                data-testid="step-next-btn"
              >
                {t.booking.next}
                <ArrowRight size={14} />
              </button>
            </div>
            {step === 3 && !stepValid[3] && missingStep3.length > 0 && (
              <p className="mt-4 text-right text-[0.72rem] text-[#B8922A]" data-testid="missing-hint">
                {t.booking.missingPrefix} {missingStep3.join(" · ")}
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="mt-14">
            <button
              onClick={goBack}
              className="text-[0.72rem] uppercase tracking-[0.28em] text-[#0A0A0A]/50 hover:text-[#B8922A] transition-colors inline-flex items-center gap-2"
              data-testid="step-back-btn-4"
            >
              <ArrowLeft size={14} />
              {t.booking.back}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CounterRow({ label, sublabel, value, onDec, onInc, testId }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#F5F0E8]/10 pb-5 sm:pb-6">
      <div className="min-w-0">
        <div className="font-display-serif text-xl sm:text-2xl text-[#0A0A0A]">{label}</div>
        <div className="text-[0.7rem] sm:text-[0.75rem] text-[#0A0A0A]/40 mt-1">{sublabel}</div>
      </div>
      <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0" data-testid={testId}>
        <button
          onClick={onDec}
          className="w-9 h-9 border border-[#B8922A]/40 text-[#B8922A] flex items-center justify-center hover:bg-[#B8922A]/10 transition-colors"
          data-testid={`${testId}-dec`}
        >
          <Minus size={14} />
        </button>
        <span className="font-display-serif text-2xl text-[#0A0A0A] w-8 text-center" data-testid={`${testId}-value`}>{value}</span>
        <button
          onClick={onInc}
          className="w-9 h-9 border border-[#B8922A] bg-[#B8922A]/10 text-[#B8922A] flex items-center justify-center hover:bg-[#B8922A]/20 transition-colors"
          data-testid={`${testId}-inc`}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, testId, type = "text", min, max }) {
  return (
    <div>
      <label className="label-luxury">{label}</label>
      <input type={type} min={min} max={max} value={value} onChange={onChange} className="input-luxury" data-testid={testId} />
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50 mb-1 sm:mb-0">{label}</span>
      <span className="text-sm text-[#0A0A0A] sm:text-right sm:max-w-[60%] break-words">{value}</span>
    </div>
  );
}

function PaymentView({ booking, onPay, paying, t, isOvernight }) {
  const isFree = (booking.total_amount || 0) <= 0;
  return (
    <div data-testid="payment-view">
      <h2 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A] mb-2">
        {isFree ? t.booking.confirmReservation : t.booking.step5}
      </h2>
      <div className="gold-divider mb-3" />
      <p className="text-sm text-[#0A0A0A]/60 mb-6 sm:mb-8">
        {t.booking.summary} — <span className="text-[#B8922A] font-medium">
          {isFree ? t.offers.reservationOnly : formatXOF(booking.total_amount)}
        </span>
        {" · "}#{booking.id.slice(0, 8).toUpperCase()}
      </p>

      {/* Prominent confirmation notice — visible before any payment choice */}
      <div className="mb-7 sm:mb-8 max-w-3xl">
        <div className="border-l-4 border-[#B8922A] bg-[#FBF8EF] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[#B8922A] text-white flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[0.65rem] uppercase tracking-[0.24em] text-[#B8922A] font-semibold mb-1">
                Confirmation immédiate
              </div>
              <p className="text-base sm:text-lg font-medium text-[#0A0A0A] leading-snug">
                Vous allez recevoir votre billet d'embarquement par e-mail dans quelques minutes.
              </p>
              <p className="text-[0.82rem] sm:text-[0.85rem] text-[#0A0A0A]/65 mt-2 leading-relaxed">
                Pensez à vérifier vos courriers indésirables (spam). Si vous ne recevez rien, contactez notre équipe :{" "}
                <a href="tel:+22501234567" className="text-[#B8922A] font-medium hover:underline">+225 01 23 45 67</a>
                {" "}·{" "}
                <a href="mailto:contact@boulaybeachresort.com" className="text-[#B8922A] font-medium hover:underline">contact@boulaybeachresort.com</a>
              </p>
            </div>
          </div>
        </div>
      </div>
      {isFree ? (
        <div className="bg-[#FAFAF7] border border-[#B8922A]/30 p-6 sm:p-8 md:p-10 max-w-xl">
          <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">
            {booking.offer_name}
          </div>
          <div className="font-display-serif text-2xl text-[#0A0A0A] mb-3">
            {t.booking.confirmReservation}
          </div>
          <p className="text-sm text-[#0A0A0A]/60 mb-7">
            {t.booking.leKaaiConfirmDesc}
          </p>
          <button
            onClick={() => onPay("cash")}
            disabled={!!paying}
            className="btn-gold w-full"
            data-testid="confirm-free-btn"
          >
            {paying ? t.booking.payProcessing : t.booking.confirmReservation}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Online payment option (card / mobile money handled by the gateway) */}
          <div className="bg-[#FAFAF7] border border-[#B8922A]/30 p-6 sm:p-8 flex flex-col">
            <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">{t.booking.payCardLabel}</div>
            <div className="font-display-serif text-2xl text-[#0A0A0A] mb-2">
              {t.booking.payNow}
            </div>
            <p className="text-sm text-[#0A0A0A]/60 mb-7 flex-1">
              {t.booking.fineoDisclaimer}
            </p>
            <button
              onClick={() => onPay("fineo")}
              disabled={!!paying}
              className="btn-gold w-full"
              data-testid="pay-fineo-btn"
            >
              {paying === "fineo" ? t.booking.payProcessing : t.booking.payNow}
            </button>
          </div>

          {/* Right column: deposit for hebergement, otherwise cash */}
          {isOvernight ? (
            <div className="bg-white border border-[#0A0A0A]/15 p-6 sm:p-8 flex flex-col" data-testid="deposit-card">
              <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#0A0A0A]/60 mb-3">
                {t.booking.payDepositLabel}
              </div>
              <div className="font-display-serif text-2xl text-[#0A0A0A] mb-2">
                {t.booking.payDeposit}
              </div>
              <p className="text-sm text-[#0A0A0A]/60 mb-6 flex-1">
                {t.booking.payDepositDesc}
              </p>
              <div className="space-y-2.5">
                {[10, 30, 70].map((pct) => {
                  const amount = Math.round((booking.total_amount * pct) / 100);
                  const balance = booking.total_amount - amount;
                  const tracker = `deposit-${pct}`;
                  const busy = paying === tracker;
                  return (
                    <button
                      key={pct}
                      onClick={() => onPay("deposit", { deposit_pct: pct })}
                      disabled={!!paying}
                      className="btn-ghost-gold w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 px-4 py-3"
                      data-testid={`pay-deposit-${pct}-btn`}
                    >
                      <span className="text-[0.7rem] uppercase tracking-[0.22em]">
                        {busy ? t.booking.payProcessing : `${t.booking.payDepositCta} ${pct}%`}
                      </span>
                      <span className="text-sm font-medium flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                        <span>{new Intl.NumberFormat("fr-FR").format(amount)} FCFA</span>
                        <span className="text-[0.65rem] text-[#0A0A0A]/45">
                          · {t.booking.balanceDue} {new Intl.NumberFormat("fr-FR").format(balance)} FCFA
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#0A0A0A]/15 p-6 sm:p-8 flex flex-col">
              <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#0A0A0A]/60 mb-3">
                {t.booking.payCash}
              </div>
              <div className="font-display-serif text-2xl text-[#0A0A0A] mb-2">
                {t.booking.payCash}
              </div>
              <p className="text-sm text-[#0A0A0A]/60 mb-7 flex-1">
                {t.booking.payCashDesc}
              </p>
              <button
                onClick={() => onPay("cash")}
                disabled={!!paying}
                className="btn-ghost-gold w-full"
                data-testid="pay-cash-btn"
              >
                {paying === "cash" ? t.booking.payProcessing : t.booking.payCash}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConfirmationView({ booking, t, lang, navigate }) {
  const total = booking.qr_codes?.length || 0;

  // Build a textual recap that can be shared via Email / WhatsApp deep-links.
  // Both schemes (mailto: and wa.me) only accept text — actual QR images stay
  // downloadable from this page. The recap reminds the client to bring them.
  const recapText = (() => {
    const isFr = lang === "fr";
    const lines = [];
    lines.push(
      isFr
        ? `Réservation Boulay Beach Resort — ${booking.offer_name}`
        : `Boulay Beach Resort Booking — ${booking.offer_name}`
    );
    lines.push("");
    lines.push(`${isFr ? "Référence" : "Reference"}: #${booking.id.slice(0, 8).toUpperCase()}`);
    lines.push(`${isFr ? "Date" : "Date"}: ${booking.date}`);
    if (booking.boat_time) {
      lines.push(`${isFr ? "Heure du bateau" : "Boat time"}: ${booking.boat_time}`);
    }
    if (booking.return_boat_time) {
      lines.push(`${isFr ? "Bateau retour" : "Return boat"}: ${booking.return_boat_time}`);
    }
    lines.push(
      `${isFr ? "Convives" : "Guests"}: ${booking.adults} ${isFr ? "adulte(s)" : "adult(s)"}` +
        (booking.children ? `, ${booking.children} ${isFr ? "enfant(s)" : "child(ren)"}` : "")
    );
    if (booking.total_amount > 0) {
      lines.push(`${isFr ? "Total" : "Total"}: ${formatXOF(booking.total_amount)}`);
      if (booking.payment_method === "deposit" && booking.deposit_pct) {
        lines.push(
          `${isFr ? "Acompte versé" : "Deposit paid"} (${booking.deposit_pct}%): ${formatXOF(booking.paid_amount || 0)}`,
        );
        lines.push(
          `${isFr ? "Solde dû à l'arrivée" : "Balance due on arrival"}: ${formatXOF(booking.balance_due || 0)}`,
        );
      }
    } else {
      lines.push(`${isFr ? "Total" : "Total"}: ${isFr ? "Sur réservation" : "Reservation only"}`);
    }
    lines.push("");
    lines.push(isFr ? "Participants :" : "Participants:");
    (booking.participants || []).forEach((p, idx) => {
      lines.push(`  ${idx + 1}. ${p.surname} ${p.name} — ${p.nationality}`);
    });
    lines.push("");
    lines.push(
      isFr
        ? `${total} QR code${total > 1 ? "s" : ""} à présenter à l'arrivée. À télécharger depuis la page de confirmation.`
        : `${total} QR code${total > 1 ? "s" : ""} to present on arrival. Downloadable from the confirmation page.`
    );
    lines.push("");
    lines.push(
      isFr
        ? `Livret BBR : ${window.location.origin}/livret-bbr.pdf`
        : `BBR Booklet: ${window.location.origin}/livret-bbr.pdf`
    );
    lines.push("");
    lines.push("— Boulay Beach Resort, Abidjan");
    return lines.join("\n");
  })();

  const subject = lang === "fr"
    ? `Réservation Boulay Beach Resort — ${booking.offer_name}`
    : `Boulay Beach Resort Booking — ${booking.offer_name}`;
  const mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(recapText)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(recapText)}`;

  return (
    <motion.div
      data-testid="confirmation-view"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-14 h-14 border border-[#B8922A] rounded-full mb-6">
          <Check className="text-[#B8922A]" size={22} />
        </div>
        <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">
          {booking.offer_name}
        </div>
        <h2 className="font-display-serif text-3xl md:text-4xl lg:text-5xl text-[#0A0A0A] mb-4 tracking-tight">
          {t.booking.successTitle}
        </h2>
        <p className="text-[#0A0A0A]/70 max-w-md mx-auto mb-2 leading-relaxed">
          {t.booking.successText}
        </p>
        <p className="text-sm text-[#0A0A0A]/50">
          {total} {total > 1 ? t.booking.qrCodesPlural : t.booking.qrCodesSingular}
        </p>
      </div>

      {/* Cash pending banner — visible only when waiting for staff to collect cash on arrival */}
      {booking.status === "pending_cash_payment" && (
        <div className="max-w-xl mx-auto mb-8 border-l-4 border-amber-500 bg-amber-50 px-5 py-4" data-testid="cash-pending-banner">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 text-lg font-bold">!</div>
            <div className="flex-1">
              <div className="text-[0.65rem] uppercase tracking-[0.24em] text-amber-700 font-semibold mb-1">
                Reçu provisoire · Paiement en espèces
              </div>
              <p className="text-sm text-amber-900 leading-relaxed">
                Ce reçu est <strong>provisoire</strong>. Vous recevrez votre <strong>billet définitif avec QR code d'embarquement</strong> par e-mail
                dès que notre équipe aura encaissé le règlement à votre arrivée.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Deposit summary banner — only shown when paid with deposit */}
      {booking.payment_method === "deposit" && booking.deposit_pct && (
        <div className="max-w-xl mx-auto mb-8 bg-[#FAFAF7] border border-[#B8922A]/40 px-6 py-5" data-testid="deposit-banner">
          <div className="text-[0.65rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2">
            {lang === "fr" ? "Acompte versé" : "Deposit paid"} · {booking.deposit_pct}%
          </div>
          <div className="flex justify-between items-baseline text-sm text-[#0A0A0A]/75 mb-1">
            <span>{lang === "fr" ? "Montant total" : "Total amount"}</span>
            <span className="font-medium">{formatXOF(booking.total_amount)}</span>
          </div>
          <div className="flex justify-between items-baseline text-sm text-[#0A0A0A]/75 mb-1">
            <span>{lang === "fr" ? "Acompte payé en ligne" : "Deposit paid online"}</span>
            <span className="font-medium text-[#B8922A]">{formatXOF(booking.paid_amount || 0)}</span>
          </div>
          <div className="flex justify-between items-baseline text-sm pt-2 border-t border-[#B8922A]/20 mt-2">
            <span className="text-[#0A0A0A]">{lang === "fr" ? "Solde à régler à l'arrivée" : "Balance due on arrival"}</span>
            <span className="font-display-serif text-lg text-[#0A0A0A]">{formatXOF(booking.balance_due || 0)}</span>
          </div>
        </div>
      )}

      {/* For card / mobile-money / deposit payments, render the luxury Ticket layout.
          For cash payments, render the temporary cash-receipt image returned
          by the backend (no QR shown — staff scanner uses qr_token directly). */}
      {["fineo", "card", "mobile_money", "deposit"].includes(booking.payment_method) ? (
        <div className="space-y-8" data-testid="ticket-grid">
          {booking.qr_codes.map((q, i) => (
            <Ticket key={i} booking={booking} qr={q} t={t} lang={lang} index={i} />
          ))}
        </div>
      ) : booking.payment_method === "cash" && booking.qr_codes?.[0]?.ticket_image ? (
        <div className="space-y-8" data-testid="cash-receipt-grid">
          {booking.qr_codes.map((q, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: i * 0.08 }}
              className="max-w-xl mx-auto"
              data-testid={`cash-receipt-${i}`}
            >
              <img
                src={q.ticket_image}
                alt={`${t.booking.cashReceipt} — ${q.guest_name} ${q.guest_surname}`}
                className="w-full h-auto block shadow-sm"
              />
              <div className="mt-4 flex items-center justify-between">
                <div className="text-[0.75rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">
                  {q.guest_name} {q.guest_surname}
                </div>
                <a
                  href={q.ticket_image}
                  download={`bbr-recu-${(q.guest_name + "-" + q.guest_surname).replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`}
                  className="inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60 hover:text-[#B8922A] transition-colors"
                  data-testid={`cash-receipt-${i}-download`}
                >
                  <Download size={12} />
                  {t.booking.download}
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className={`grid gap-5 ${total === 1 ? "grid-cols-1 max-w-xs mx-auto" : total === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-md mx-auto" : "grid-cols-2 md:grid-cols-3"}`}>
          {booking.qr_codes.map((q, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-[#FAFAF7] border border-[#B8922A]/30 p-5 flex flex-col items-center"
              data-testid={`qr-card-${i}`}
            >
              <img src={q.qr_code} alt={q.label_fr} className="w-full h-auto bg-white p-2.5 mb-4" />
              <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">
                {lang === "fr" ? q.label_fr : q.label_en}
              </div>
              <div className="text-sm text-[#0A0A0A] font-medium text-center">
                {q.guest_name} {q.guest_surname}
              </div>
              {q.guest_nationality && (
                <div className="text-[0.7rem] text-[#0A0A0A]/50 mt-0.5">{q.guest_nationality}</div>
              )}
              <div className="text-[0.6rem] text-[#0A0A0A]/40 tracking-widest mt-2">
                #{q.qr_token.slice(0, 8).toUpperCase()}
              </div>
              <a
                href={q.qr_code}
                download={`bbr-qr-${(q.guest_name + "-" + q.guest_surname).replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`}
                className="mt-4 inline-flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60 hover:text-[#B8922A] transition-colors"
                data-testid={`qr-download-${i}`}
              >
                <Download size={11} />
                {t.booking.download}
              </a>
            </motion.div>
          ))}
        </div>
      )}

      {/* Activities wallet QR intentionally hidden from the client view — staff
          continue to access it via /staff/activites?token=… for on-site charges. */}

      {/* Share recap via Email or WhatsApp */}
      <div className="mt-12 max-w-xl mx-auto" data-testid="share-recap">
        <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4 text-center">
          {t.booking.shareRecap}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href={mailtoHref}
            className="inline-flex items-center justify-center gap-3 px-6 py-3.5 border border-[#0A0A0A]/15 text-[#0A0A0A] hover:border-[#B8922A] hover:text-[#B8922A] transition-colors text-[0.75rem] uppercase tracking-[0.22em]"
            data-testid="share-email-btn"
          >
            <Mail size={14} />
            {t.booking.shareEmail}
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 px-6 py-3.5 border border-[#25D366]/40 bg-[#25D366]/5 text-[#1FAA52] hover:bg-[#25D366]/10 hover:border-[#25D366] transition-colors text-[0.75rem] uppercase tracking-[0.22em]"
            data-testid="share-whatsapp-btn"
          >
            <MessageCircle size={14} />
            {t.booking.shareWhatsapp}
          </a>
        </div>
      </div>

      <div className="mt-14 text-center space-y-4">
        <button onClick={() => navigate("/")} className="btn-ghost-gold" data-testid="back-home-btn">
          {t.booking.backHome}
        </button>
        <div>
          <a
            href="/livret-bbr.pdf"
            target="_blank"
            rel="noopener noreferrer"
            download="LIVRET_BBR.pdf"
            className="inline-flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.22em] text-[#B8922A] hover:text-[#D4AF37] border-b border-[#B8922A]/40 hover:border-[#D4AF37] pb-1 transition-colors"
            data-testid="download-livret-btn"
          >
            <Download size={12} />
            {t.booking.downloadLivret}
          </a>
        </div>
      </div>

      <p className="text-xs text-[#0A0A0A]/40 text-center mt-10 max-w-md mx-auto leading-relaxed">
        {t.booking.confirmationNote}
      </p>
    </motion.div>
  );
}

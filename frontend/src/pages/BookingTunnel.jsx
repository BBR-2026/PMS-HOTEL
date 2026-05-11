import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "../components/ui/calendar";
import { Minus, Plus, Check, ArrowLeft, ArrowRight, Download, Mail, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import api from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { formatXOF } from "../lib/i18n";
import { toast } from "sonner";
import NationalityAutocomplete from "../components/NationalityAutocomplete";
import Ticket from "../components/Ticket";

export default function BookingTunnel() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  const [offer, setOffer] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [checkoutDate, setCheckoutDate] = useState(null);
  const [roomTier, setRoomTier] = useState(null);
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [contact, setContact] = useState({
    special_requests: "",
    boat_time: "",
    return_boat_time: "",
  });
  const [availability, setAvailability] = useState(null);
  const [bookingResp, setBookingResp] = useState(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(null);

  useEffect(() => {
    api.get(`/offers/${offerId}`).then((r) => setOffer(r.data)).catch(() => navigate("/"));
  }, [offerId, navigate]);

  useEffect(() => {
    if (!selectedDate) return;
    const iso = format(selectedDate, "yyyy-MM-dd");
    api.get(`/availability/${offerId}/${iso}`).then((r) => setAvailability(r.data)).catch(() => {});
  }, [selectedDate, offerId]);

  // Keep participants array in sync with adults/children counts.
  // Preserves existing entries by kind (adults first, then children) and
  // appends empty entries when the count grows, trims when it shrinks.
  useEffect(() => {
    setParticipants((prev) => {
      const prevAdults = prev.filter((p) => p.kind === "adult");
      const prevChildren = prev.filter((p) => p.kind === "child");
      const nextAdults = Array.from({ length: adults }, (_, i) =>
        prevAdults[i] || { name: "", surname: "", email: "", phone: "", nationality: "", kind: "adult" }
      );
      const nextChildren = Array.from({ length: children }, (_, i) =>
        prevChildren[i] || { name: "", surname: "", email: "", phone: "", nationality: "", kind: "child" }
      );
      return [...nextAdults, ...nextChildren];
    });
  }, [adults, children]);

  const isOvernight = !!offer?.is_overnight;
  const roomTiers = offer?.room_tiers || [];
  const hasTiers = roomTiers.length > 0;
  const selectedTier = hasTiers ? roomTiers.find((t) => t.id === roomTier) : null;
  const nights = useMemo(() => {
    if (!isOvernight || !selectedDate || !checkoutDate) return 0;
    const ms = checkoutDate.getTime() - selectedDate.getTime();
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  }, [isOvernight, selectedDate, checkoutDate]);

  const total = useMemo(() => {
    if (!offer) return 0;
    if (isOvernight && hasTiers) {
      return selectedTier ? selectedTier.price * nights * rooms : 0;
    }
    const base = adults * offer.price_adult + children * offer.price_child;
    return isOvernight ? base * nights : base;
  }, [offer, adults, children, isOvernight, hasTiers, selectedTier, nights, rooms]);

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

  if (!offer) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-[#0A0A0A]/40 text-sm uppercase tracking-[0.3em]">
        Loading…
      </div>
    );
  }

  const participantsValid =
    participants.length === totalGuests &&
    participants.every(
      (p) =>
        p.name.trim() &&
        p.surname.trim() &&
        p.nationality.trim() &&
        p.phone.trim() &&
        /\S+@\S+\.\S+/.test(p.email)
    );
  const contactValid =
    participantsValid &&
    !!contact.boat_time &&
    (!isOvernight || !!contact.return_boat_time);

  // Human-readable list of what's still missing at step 3 (shown beside the disabled Next button)
  const missingStep3 = [];
  if (!participantsValid) missingStep3.push(t.booking.missingParticipants);
  if (!contact.boat_time) missingStep3.push(t.booking.missingBoatTime);
  if (isOvernight && !contact.return_boat_time) missingStep3.push(t.booking.missingReturnBoatTime);

  const stepValid = {
    1:
      !!selectedDate &&
      (!isOvernight || (!!checkoutDate && nights >= 1)) &&
      remaining !== null &&
      remaining >= totalGuests &&
      totalGuests >= 1,
    2: totalGuests >= 1 && (remaining === null || remaining >= totalGuests) && (!hasTiers || !!selectedTier),
    3: contactValid,
    4: true,
  };

  const goNext = () => step < 5 && setStep(step + 1);
  const goBack = () => step > 1 && setStep(step - 1);

  const handleCreateBooking = async () => {
    if (!stepValid[3]) return;
    setCreating(true);
    try {
      const iso = format(selectedDate, "yyyy-MM-dd");
      const checkoutIso = isOvernight && checkoutDate ? format(checkoutDate, "yyyy-MM-dd") : null;
      const { data } = await api.post("/bookings", {
        offer_type: offerId,
        date: iso,
        checkout_date: checkoutIso,
        room_tier: hasTiers ? roomTier : null,
        rooms: hasTiers ? rooms : 1,
        adults,
        children,
        participants: participants.map((p) => ({
          name: p.name.trim(),
          surname: p.surname.trim(),
          email: p.email.trim().toLowerCase(),
          phone: p.phone.trim(),
          nationality: p.nationality.trim(),
          kind: p.kind,
        })),
        boat_time: contact.boat_time,
        return_boat_time: isOvernight ? contact.return_boat_time : null,
        special_requests: contact.special_requests,
      });
      setBookingResp(data);
      setStep(5);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Booking failed");
    } finally {
      setCreating(false);
    }
  };

  const handlePay = async (method = "fineo") => {
    if (!bookingResp) return;
    setPaying(method);
    if (method === "fineo") {
      await new Promise((r) => setTimeout(r, 1400)); // FINEO simulation
    }
    try {
      const { data } = await api.post(`/bookings/${bookingResp.id}/pay`, {
        reference_token: bookingResp.reference_token,
        payment_method: method,
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
    <div data-testid="booking-tunnel" className="min-h-screen bg-white text-[#0A0A0A] pt-32 pb-24 px-6 md:px-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <Link to="/" className="text-[0.7rem] uppercase tracking-[0.28em] text-[#0A0A0A]/50 hover:text-[#B8922A] transition-colors inline-flex items-center gap-2 mb-6">
            <ArrowLeft size={14} />
            {t.booking.back}
          </Link>
          <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">
            {offer.schedule_fr && lang === "fr" ? offer.schedule_fr : offer.schedule_en}
          </div>
          <h1 className="font-display-serif text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight">
            {offerName}
          </h1>
          <div className="gold-divider mt-5" />
        </div>

        <div className="flex items-center gap-3 mb-14">
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
                <h2 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2">
                  {t.booking.step1}
                </h2>
                <p className="text-sm text-[#0A0A0A]/50 mb-8">
                  {isOvernight ? `${t.booking.pickArrival} · ${t.booking.pickCheckout}` : t.booking.pickDate}
                </p>

                {isOvernight ? (
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div>
                      <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">
                        {t.booking.pickArrival}
                      </div>
                      <div className="bg-[#FAFAF7] border border-[#F5F0E8]/10 p-4 inline-block">
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
                    <div>
                      <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">
                        {t.booking.pickCheckout}
                      </div>
                      <div className="bg-[#FAFAF7] border border-[#F5F0E8]/10 p-4 inline-block">
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
                  <div className="bg-[#FAFAF7] border border-[#F5F0E8]/10 p-4 inline-block">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(d) => {
                        if (d < new Date(new Date().setHours(0, 0, 0, 0))) return true;
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
                {availability && (
                  <div className="mt-6 text-sm">
                    {availability.remaining > 0 ? (
                      <div className="text-[#0A0A0A]/60">
                        <span className="text-[#B8922A]">{availability.remaining}</span> {t.booking.remaining}
                      </div>
                    ) : (
                      <div className="text-red-400">{t.booking.capacityFull}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div data-testid="booking-step-2" className={hasTiers ? "max-w-2xl" : "max-w-md"}>
                <h2 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2">
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
                            <div className="text-[#B8922A] font-medium">
                              {formatXOF(tier.price)}
                              <span className="text-[0.7rem] text-[#0A0A0A]/50 ml-1">
                                {t.offers.perNight}
                              </span>
                            </div>
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
                  <span className="font-display-serif text-3xl text-[#B8922A]">{formatXOF(total)}</span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div data-testid="booking-step-3" className="max-w-3xl">
                <h2 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2">
                  {t.booking.step3}
                </h2>
                <div className="gold-divider mb-8" />

                {/* Participants */}
                <div className="space-y-6">
                  {participants.map((p, i) => {
                    const isFirst = i === 0;
                    const adultIndex = participants.slice(0, i + 1).filter((x) => x.kind === "adult").length;
                    const childIndex = participants.slice(0, i + 1).filter((x) => x.kind === "child").length;
                    const label =
                      p.kind === "adult"
                        ? `${t.booking.adults.replace(/s$/, "")} ${adultIndex}${isFirst ? ` · ${t.booking.primaryContact}` : ""}`
                        : `${t.booking.children.replace(/s$/, "")} ${childIndex}`;
                    const update = (field) => (e) => {
                      const next = [...participants];
                      next[i] = { ...next[i], [field]: e.target.value };
                      setParticipants(next);
                    };
                    return (
                      <div
                        key={i}
                        data-testid={`participant-${i}`}
                        className="border border-[#0A0A0A]/10 bg-[#FAFAF7] p-6 md:p-7"
                      >
                        <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] mb-5">
                          {label}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                <h2 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2">
                  {t.booking.summary}
                </h2>
                <div className="gold-divider mb-8" />

                <div className="bg-[#FAFAF7] border border-[#0A0A0A]/10 p-8 space-y-5">
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
                        value={`${lang === "fr" ? selectedTier.name_fr : selectedTier.name_en} · ${formatXOF(selectedTier.price)} ${t.offers.perNight}${rooms > 1 ? ` × ${rooms}` : ""} × ${nights} ${nights > 1 ? t.booking.nights.toLowerCase() : t.booking.night}`}
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
                            {p.kind === "adult" ? t.booking.adults.replace(/s$/, "") : t.booking.children.replace(/s$/, "")}{" "}
                            {participants.slice(0, i + 1).filter((x) => x.kind === p.kind).length}
                          </span>
                          <span className="text-sm text-[#0A0A0A] text-right">
                            {p.surname} {p.name} · {p.nationality}
                            <span className="block text-[0.72rem] text-[#0A0A0A]/50 mt-0.5">
                              {p.email} · {p.phone}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {contact.special_requests && <SummaryRow label={t.booking.specialRequests} value={contact.special_requests} />}
                  <div className="pt-5 border-t border-[#0A0A0A]/10 flex justify-between items-baseline">
                    <span className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A]">
                      {t.booking.total}
                    </span>
                    <span className="font-display-serif text-3xl text-[#B8922A]">
                      {total > 0 ? formatXOF(total) : t.offers.reservationOnly}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCreateBooking}
                  className="btn-gold mt-10 inline-flex items-center gap-3"
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
                {bookingResp.status === "confirmed" ? (
                  <ConfirmationView booking={bookingResp} t={t} lang={lang} navigate={navigate} />
                ) : (
                  <PaymentView booking={bookingResp} onPay={handlePay} paying={paying} t={t} />
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
    <div className="flex items-center justify-between border-b border-[#F5F0E8]/10 pb-6">
      <div>
        <div className="font-display-serif text-2xl text-[#0A0A0A]">{label}</div>
        <div className="text-[0.75rem] text-[#0A0A0A]/40 mt-1">{sublabel}</div>
      </div>
      <div className="flex items-center gap-5" data-testid={testId}>
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
    <div className="flex items-start justify-between gap-6">
      <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50">{label}</span>
      <span className="text-sm text-[#0A0A0A] text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function PaymentView({ booking, onPay, paying, t }) {
  const isFree = (booking.total_amount || 0) <= 0;
  return (
    <div data-testid="payment-view">
      <h2 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2">
        {isFree ? t.booking.confirmReservation : t.booking.step5}
      </h2>
      <div className="gold-divider mb-3" />
      <p className="text-sm text-[#0A0A0A]/60 mb-8">
        {t.booking.summary} — <span className="text-[#B8922A] font-medium">
          {isFree ? t.offers.reservationOnly : formatXOF(booking.total_amount)}
        </span>
        {" · "}#{booking.id.slice(0, 8).toUpperCase()}
      </p>

      {isFree ? (
        <div className="bg-[#FAFAF7] border border-[#B8922A]/30 p-8 md:p-10 max-w-xl">
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
          <div className="bg-[#FAFAF7] border border-[#B8922A]/30 p-8 flex flex-col">
            <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">{t.booking.payCardLabel}</div>
            <div className="font-display-serif text-2xl text-[#0A0A0A] mb-2">
              {t.booking.payNow}
            </div>
            <p className="text-sm text-[#0A0A0A]/60 mb-7 flex-1">
              {t.booking.fineoDisclaimer}
            </p>
            <button
              onClick={() => onPay("card")}
              disabled={!!paying}
              className="btn-gold w-full"
              data-testid="pay-card-btn"
            >
              {paying === "card" ? t.booking.payProcessing : t.booking.payNow}
            </button>
          </div>

          {/* Cash option */}
          <div className="bg-white border border-[#0A0A0A]/15 p-8 flex flex-col">
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
        ? "Livret BBR : https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/opmut9mt_LIVRET_BBR.pdf"
        : "BBR Booklet: https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/opmut9mt_LIVRET_BBR.pdf"
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

      {/* For card / mobile-money payments, render the luxury Ticket layout.
          For cash payments, render the temporary cash-receipt image returned
          by the backend (no QR shown — staff scanner uses qr_token directly). */}
      {["fineo", "card", "mobile_money"].includes(booking.payment_method) ? (
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
            href="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/opmut9mt_LIVRET_BBR.pdf"
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

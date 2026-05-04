import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "../components/ui/calendar";
import { Minus, Plus, Check, ArrowLeft, ArrowRight, Download } from "lucide-react";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import api from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { formatXOF } from "../lib/i18n";
import { toast } from "sonner";

export default function BookingTunnel() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  const [offer, setOffer] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [contact, setContact] = useState({
    name: "",
    surname: "",
    nationality: "",
    boat_time: "",
    phone: "",
    email: "",
    special_requests: "",
  });
  const [availability, setAvailability] = useState(null);
  const [bookingResp, setBookingResp] = useState(null); // booking after creation
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(null); // 'fineo' | 'cash' | null

  useEffect(() => {
    api.get(`/offers/${offerId}`).then((r) => setOffer(r.data)).catch(() => navigate("/"));
  }, [offerId, navigate]);

  useEffect(() => {
    if (!selectedDate) return;
    const iso = format(selectedDate, "yyyy-MM-dd");
    api.get(`/availability/${offerId}/${iso}`).then((r) => setAvailability(r.data)).catch(() => {});
  }, [selectedDate, offerId]);

  const total = useMemo(() => {
    if (!offer) return 0;
    return adults * offer.price_adult + children * offer.price_child;
  }, [offer, adults, children]);

  const offerName = offer ? (lang === "fr" ? offer.name_fr : offer.name_en) : "";

  if (!offer) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#0A0A0A]/40 text-sm uppercase tracking-[0.3em]">
        Loading…
      </div>
    );
  }

  const totalGuests = adults + children;
  const remaining = availability?.remaining ?? null;
  const contactValid =
    contact.name.trim() &&
    contact.surname.trim() &&
    contact.nationality.trim() &&
    contact.boat_time &&
    contact.phone.trim() &&
    /\S+@\S+\.\S+/.test(contact.email);

  const stepValid = {
    1: !!selectedDate && remaining !== null && remaining >= totalGuests && totalGuests >= 1,
    2: totalGuests >= 1 && (remaining === null || remaining >= totalGuests),
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
      const { data } = await api.post("/bookings", {
        offer_type: offerId,
        date: iso,
        adults,
        children,
        name: contact.name,
        surname: contact.surname,
        nationality: contact.nationality,
        boat_time: contact.boat_time,
        phone: contact.phone,
        email: contact.email,
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
                <p className="text-sm text-[#0A0A0A]/50 mb-8">{t.booking.pickDate}</p>
                <div className="bg-[#FAFAF7] border border-[#F5F0E8]/10 p-4 inline-block">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
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
              <div data-testid="booking-step-2" className="max-w-md">
                <h2 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2">
                  {t.booking.step2}
                </h2>
                <div className="gold-divider mb-8" />

                <div className="space-y-8">
                  <CounterRow
                    label={t.booking.adults}
                    sublabel={`${formatXOF(offer.price_adult)} / ${t.offers.adult}`}
                    value={adults}
                    onDec={() => setAdults(Math.max(0, adults - 1))}
                    onInc={() => setAdults(adults + 1)}
                    testId="counter-adults"
                  />
                  <CounterRow
                    label={t.booking.children}
                    sublabel={`${formatXOF(offer.price_child)} / ${t.offers.child} · ${t.booking.childrenHint}`}
                    value={children}
                    onDec={() => setChildren(Math.max(0, children - 1))}
                    onInc={() => setChildren(children + 1)}
                    testId="counter-children"
                  />
                </div>

                <div className="mt-12 pt-6 border-t border-[#F5F0E8]/10 flex justify-between items-baseline">
                  <span className="text-[0.7rem] uppercase tracking-[0.28em] text-[#0A0A0A]/50">
                    {t.booking.total}
                  </span>
                  <span className="font-display-serif text-3xl text-[#B8922A]">{formatXOF(total)}</span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div data-testid="booking-step-3" className="max-w-2xl">
                <h2 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2">
                  {t.booking.step3}
                </h2>
                <div className="gold-divider mb-8" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label={t.booking.name} value={contact.name} onChange={setC("name")} testId="contact-name" />
                  <Field label={t.booking.surname} value={contact.surname} onChange={setC("surname")} testId="contact-surname" />
                  <Field label={t.booking.nationality} value={contact.nationality} onChange={setC("nationality")} testId="contact-nationality" />
                  <Field label={t.booking.phone} value={contact.phone} onChange={setC("phone")} testId="contact-phone" />
                  <div className="md:col-span-2">
                    <Field type="email" label={t.booking.email} value={contact.email} onChange={setC("email")} testId="contact-email" />
                  </div>
                </div>

                <div className="mt-8">
                  <label className="label-luxury">{t.booking.boatTime}</label>
                  <p className="text-[0.75rem] text-[#0A0A0A]/50 mb-3 -mt-1">{t.booking.boatTimeHint}</p>
                  <div className="flex flex-wrap gap-2.5" data-testid="boat-time-group">
                    {["10H", "12H", "14H", "16H", "18H", "20H"].map((h) => {
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

                <div className="mt-6">
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

                <div className="bg-[#FAFAF7] border border-[#F5F0E8]/10 p-8 space-y-5">
                  <SummaryRow label={t.booking.offer} value={offerName} />
                  <SummaryRow
                    label={t.booking.date}
                    value={selectedDate ? format(selectedDate, "EEEE d MMMM yyyy", { locale: lang === "fr" ? frLocale : enUS }) : "—"}
                  />
                  <SummaryRow label={t.booking.adults} value={`${adults} × ${formatXOF(offer.price_adult)}`} />
                  {children > 0 && <SummaryRow label={t.booking.children} value={`${children} × ${formatXOF(offer.price_child)}`} />}
                  <SummaryRow label={`${t.booking.name} / ${t.booking.surname}`} value={`${contact.name} ${contact.surname}`} />
                  <SummaryRow label={t.booking.nationality} value={contact.nationality} />
                  <SummaryRow label={t.booking.boatTime} value={contact.boat_time} />
                  <SummaryRow label={t.booking.phone} value={contact.phone} />
                  <SummaryRow label={t.booking.email} value={contact.email} />
                  {contact.special_requests && <SummaryRow label={t.booking.specialRequests} value={contact.special_requests} />}
                  <div className="pt-5 border-t border-[#F5F0E8]/10 flex justify-between items-baseline">
                    <span className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A]">
                      {t.booking.total}
                    </span>
                    <span className="font-display-serif text-3xl text-[#B8922A]">{formatXOF(total)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCreateBooking}
                  className="btn-gold mt-10 inline-flex items-center gap-3"
                  data-testid="confirm-summary-btn"
                  disabled={creating}
                >
                  {creating ? "…" : t.booking.proceedToPayment}
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
          <div className="mt-14 flex items-center justify-between">
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
  return (
    <div data-testid="payment-view">
      <h2 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2">{t.booking.step5}</h2>
      <div className="gold-divider mb-3" />
      <p className="text-sm text-[#0A0A0A]/60 mb-8">
        {t.booking.summary} — <span className="text-[#B8922A] font-medium">{formatXOF(booking.total_amount)}</span>
        {" · "}#{booking.id.slice(0, 8).toUpperCase()}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* FINEO option */}
        <div className="bg-[#FAFAF7] border border-[#B8922A]/30 p-8 flex flex-col">
          <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">FINEO</div>
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
    </div>
  );
}

function ConfirmationView({ booking, t, lang, navigate }) {
  const total = booking.qr_codes?.length || 0;
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
            <div className="text-[0.6rem] text-[#0A0A0A]/40 tracking-widest">
              #{q.qr_token.slice(0, 8).toUpperCase()}
            </div>
            <a
              href={q.qr_code}
              download={`bbr-qr-${q.label_en.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`}
              className="mt-4 inline-flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60 hover:text-[#B8922A] transition-colors"
              data-testid={`qr-download-${i}`}
            >
              <Download size={11} />
              {t.booking.download}
            </a>
          </motion.div>
        ))}
      </div>

      <div className="mt-14 text-center">
        <button onClick={() => navigate("/")} className="btn-ghost-gold" data-testid="back-home-btn">
          {t.booking.backHome}
        </button>
      </div>

      <p className="text-xs text-[#0A0A0A]/40 text-center mt-10 max-w-md mx-auto leading-relaxed">
        {t.booking.confirmationNote}
      </p>
    </motion.div>
  );
}

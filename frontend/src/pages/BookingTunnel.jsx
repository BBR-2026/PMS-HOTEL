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
    age: "",
    phone: "",
    email: "",
    special_requests: "",
  });
  const [availability, setAvailability] = useState(null);
  const [bookingResp, setBookingResp] = useState(null); // booking after creation
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(false);

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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#F5F0E8]/40 text-sm uppercase tracking-[0.3em]">
        Loading…
      </div>
    );
  }

  const totalGuests = adults + children;
  const remaining = availability?.remaining ?? null;
  const contactValid =
    contact.name.trim() &&
    contact.surname.trim() &&
    contact.age &&
    Number(contact.age) >= 18 &&
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
        age: Number(contact.age),
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

  const handlePay = async () => {
    if (!bookingResp) return;
    setPaying(true);
    await new Promise((r) => setTimeout(r, 1400)); // FINEO simulation
    try {
      const { data } = await api.post(`/bookings/${bookingResp.id}/pay`, {
        reference_token: bookingResp.reference_token,
      });
      setBookingResp(data);
      toast.success(t.booking.successTitle);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const setC = (k) => (e) => setContact({ ...contact, [k]: e.target.value });

  return (
    <div data-testid="booking-tunnel" className="min-h-screen bg-[#0A0A0A] text-[#F5F0E8] pt-28 pb-24 px-6 md:px-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <Link to="/" className="text-[0.7rem] uppercase tracking-[0.28em] text-[#F5F0E8]/50 hover:text-[#B8922A] transition-colors inline-flex items-center gap-2 mb-6">
            <ArrowLeft size={14} />
            {t.booking.back}
          </Link>
          <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">
            {offer.schedule_fr && lang === "fr" ? offer.schedule_fr : offer.schedule_en}
          </div>
          <h1 className="font-display-serif text-4xl md:text-5xl lg:text-6xl text-[#F5F0E8] tracking-tight">
            {offerName}
          </h1>
          <div className="gold-divider mt-5" />
        </div>

        <div className="flex items-center gap-3 mb-14">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`h-px flex-1 transition-colors duration-500 ${
                step >= n ? "bg-[#B8922A]" : "bg-[#F5F0E8]/15"
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
                <h2 className="font-display-serif text-3xl md:text-4xl text-[#F5F0E8] mb-2">
                  {t.booking.step1}
                </h2>
                <p className="text-sm text-[#F5F0E8]/50 mb-8">{t.booking.pickDate}</p>
                <div className="bg-[#141414] border border-[#F5F0E8]/10 p-4 inline-block">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    locale={lang === "fr" ? frLocale : enUS}
                    data-testid="booking-calendar"
                    className="text-[#F5F0E8]"
                  />
                </div>
                {availability && (
                  <div className="mt-6 text-sm">
                    {availability.remaining > 0 ? (
                      <div className="text-[#F5F0E8]/60">
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
                <h2 className="font-display-serif text-3xl md:text-4xl text-[#F5F0E8] mb-2">
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
                  <span className="text-[0.7rem] uppercase tracking-[0.28em] text-[#F5F0E8]/50">
                    {t.booking.total}
                  </span>
                  <span className="font-display-serif text-3xl text-[#B8922A]">{formatXOF(total)}</span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div data-testid="booking-step-3" className="max-w-2xl">
                <h2 className="font-display-serif text-3xl md:text-4xl text-[#F5F0E8] mb-2">
                  {t.booking.step3}
                </h2>
                <div className="gold-divider mb-8" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label={t.booking.name} value={contact.name} onChange={setC("name")} testId="contact-name" />
                  <Field label={t.booking.surname} value={contact.surname} onChange={setC("surname")} testId="contact-surname" />
                  <Field type="number" min={18} max={120} label={t.booking.age} value={contact.age} onChange={setC("age")} testId="contact-age" />
                  <Field label={t.booking.phone} value={contact.phone} onChange={setC("phone")} testId="contact-phone" />
                  <div className="md:col-span-2">
                    <Field type="email" label={t.booking.email} value={contact.email} onChange={setC("email")} testId="contact-email" />
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
                <h2 className="font-display-serif text-3xl md:text-4xl text-[#F5F0E8] mb-2">
                  {t.booking.summary}
                </h2>
                <div className="gold-divider mb-8" />

                <div className="bg-[#141414] border border-[#F5F0E8]/10 p-8 space-y-5">
                  <SummaryRow label={t.booking.offer} value={offerName} />
                  <SummaryRow
                    label={t.booking.date}
                    value={selectedDate ? format(selectedDate, "EEEE d MMMM yyyy", { locale: lang === "fr" ? frLocale : enUS }) : "—"}
                  />
                  <SummaryRow label={t.booking.adults} value={`${adults} × ${formatXOF(offer.price_adult)}`} />
                  {children > 0 && <SummaryRow label={t.booking.children} value={`${children} × ${formatXOF(offer.price_child)}`} />}
                  <SummaryRow label={`${t.booking.name} / ${t.booking.surname}`} value={`${contact.name} ${contact.surname}`} />
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
              className="text-[0.72rem] uppercase tracking-[0.28em] text-[#F5F0E8]/50 hover:text-[#B8922A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-2"
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
              className="text-[0.72rem] uppercase tracking-[0.28em] text-[#F5F0E8]/50 hover:text-[#B8922A] transition-colors inline-flex items-center gap-2"
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
        <div className="font-display-serif text-2xl text-[#F5F0E8]">{label}</div>
        <div className="text-[0.75rem] text-[#F5F0E8]/40 mt-1">{sublabel}</div>
      </div>
      <div className="flex items-center gap-5" data-testid={testId}>
        <button
          onClick={onDec}
          className="w-9 h-9 border border-[#B8922A]/40 text-[#B8922A] flex items-center justify-center hover:bg-[#B8922A]/10 transition-colors"
          data-testid={`${testId}-dec`}
        >
          <Minus size={14} />
        </button>
        <span className="font-display-serif text-2xl text-[#F5F0E8] w-8 text-center" data-testid={`${testId}-value`}>{value}</span>
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
      <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[#F5F0E8]/50">{label}</span>
      <span className="text-sm text-[#F5F0E8] text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function PaymentView({ booking, onPay, paying, t }) {
  return (
    <div data-testid="payment-view">
      <h2 className="font-display-serif text-3xl md:text-4xl text-[#F5F0E8] mb-2">{t.booking.step5}</h2>
      <div className="gold-divider mb-8" />

      <div className="bg-[#141414] border border-[#B8922A]/30 p-10 text-center">
        <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">FINEO</div>
        <div className="font-display-serif text-4xl text-[#F5F0E8] mb-2">{formatXOF(booking.total_amount)}</div>
        <div className="text-sm text-[#F5F0E8]/50 mb-8">
          Boulay Beach Resort · #{booking.id.slice(0, 8).toUpperCase()}
        </div>
        <button
          onClick={onPay}
          disabled={paying}
          className="btn-gold w-full sm:w-auto"
          data-testid="pay-fineo-btn"
        >
          {paying ? t.booking.payProcessing : t.booking.payNow}
        </button>
        <p className="text-xs text-[#F5F0E8]/40 mt-6 max-w-sm mx-auto leading-relaxed">
          {t.booking.fineoDisclaimer}
        </p>
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
        <h2 className="font-display-serif text-3xl md:text-4xl lg:text-5xl text-[#F5F0E8] mb-4 tracking-tight">
          {t.booking.successTitle}
        </h2>
        <p className="text-[#F5F0E8]/70 max-w-md mx-auto mb-2 leading-relaxed">
          {t.booking.successText}
        </p>
        <p className="text-sm text-[#F5F0E8]/50">
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
            className="bg-[#141414] border border-[#B8922A]/30 p-5 flex flex-col items-center"
            data-testid={`qr-card-${i}`}
          >
            <img src={q.qr_code} alt={q.label_fr} className="w-full h-auto bg-white p-2.5 mb-4" />
            <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">
              {lang === "fr" ? q.label_fr : q.label_en}
            </div>
            <div className="text-[0.6rem] text-[#F5F0E8]/40 tracking-widest">
              #{q.qr_token.slice(0, 8).toUpperCase()}
            </div>
            <a
              href={q.qr_code}
              download={`bbr-qr-${q.label_en.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`}
              className="mt-4 inline-flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-[#F5F0E8]/60 hover:text-[#B8922A] transition-colors"
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

      <p className="text-xs text-[#F5F0E8]/40 text-center mt-10 max-w-md mx-auto leading-relaxed">
        {t.booking.confirmationNote}
      </p>
    </motion.div>
  );
}

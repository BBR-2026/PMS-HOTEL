import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "../components/ui/calendar";
import { Minus, Plus, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { formatXOF } from "../lib/i18n";
import { toast } from "sonner";

export default function BookingTunnel() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useLang();

  const [offer, setOffer] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [special, setSpecial] = useState("");
  const [availability, setAvailability] = useState(null);
  const [bookingResp, setBookingResp] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api.get(`/offers/${offerId}`).then((r) => setOffer(r.data)).catch(() => navigate("/"));
  }, [offerId, navigate]);

  // Re-fetch availability whenever date changes
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
  const stepValid = {
    1: !!selectedDate && remaining !== null && remaining >= totalGuests && totalGuests >= 1,
    2: totalGuests >= 1 && (remaining === null || remaining >= totalGuests),
    3: !!user,
    4: true,
  };

  const goNext = () => {
    if (step < 5) setStep(step + 1);
  };
  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreateBooking = async () => {
    if (!user) {
      navigate(`/login?next=/booking/${offerId}`);
      return;
    }
    try {
      const iso = format(selectedDate, "yyyy-MM-dd");
      const { data } = await api.post("/bookings", {
        offer_type: offerId,
        date: iso,
        adults,
        children,
        special_requests: special,
      });
      setBookingResp(data);
      setStep(5);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Booking failed");
    }
  };

  const handlePay = async () => {
    if (!bookingResp) return;
    setPaying(true);
    // Simulate FINEO processing delay
    await new Promise((r) => setTimeout(r, 1400));
    try {
      const { data } = await api.post(`/bookings/${bookingResp.id}/pay`);
      setBookingResp(data);
      toast.success(t.booking.successTitle);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div data-testid="booking-tunnel" className="min-h-screen bg-[#0A0A0A] text-[#F5F0E8] pt-28 pb-24 px-6 md:px-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <Link to="/" className="text-[0.7rem] uppercase tracking-[0.28em] text-[#F5F0E8]/50 hover:text-[#B8922A] transition-colors inline-flex items-center gap-2 mb-6">
            <ArrowLeft size={14} />
            {t.booking.back}
          </Link>
          <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">
            {t.booking.step} {step} {t.booking.of} 5
          </div>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-[#F5F0E8] tracking-tight">
            {offerName}
          </h1>
          <div className="gold-divider mt-5" />
        </div>

        {/* Progress dots */}
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
                <h2 className="font-serif text-2xl md:text-3xl text-[#F5F0E8] mb-2 font-light">{t.booking.step1}</h2>
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
                <h2 className="font-serif text-2xl md:text-3xl text-[#F5F0E8] mb-2 font-light">{t.booking.step2}</h2>
                <div className="gold-divider mb-8" />

                <div className="space-y-8">
                  <CounterRow
                    label={t.booking.adults}
                    sublabel={`${formatXOF(offer.price_adult)} / ${t.offers.adult}`}
                    value={adults}
                    onDec={() => setAdults(Math.max(1, adults - 1))}
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
                  <span className="font-serif text-3xl text-[#B8922A]">{formatXOF(total)}</span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div data-testid="booking-step-3" className="max-w-2xl">
                <h2 className="font-serif text-2xl md:text-3xl text-[#F5F0E8] mb-2 font-light">{t.booking.step3}</h2>
                <div className="gold-divider mb-8" />

                {!user ? (
                  <div className="bg-[#141414] border border-[#B8922A]/30 p-8">
                    <p className="text-[#F5F0E8]/70 mb-6">{t.booking.mustLogin}</p>
                    <div className="flex flex-wrap gap-4">
                      <Link to={`/login?next=/booking/${offerId}`} className="btn-gold" data-testid="must-login-btn">
                        {t.booking.loginCta}
                      </Link>
                      <Link to={`/register?next=/booking/${offerId}`} className="btn-ghost-gold" data-testid="must-register-btn">
                        {t.booking.registerCta}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <ReadOnlyField label={t.booking.name} value={user.name} />
                      <ReadOnlyField label={t.booking.surname} value={user.surname} />
                      <ReadOnlyField label={t.booking.phone} value={user.phone} />
                      <ReadOnlyField label={t.booking.email} value={user.email} />
                    </div>
                    <div>
                      <label className="label-luxury">{t.booking.specialRequests}</label>
                      <textarea
                        data-testid="special-requests-input"
                        value={special}
                        onChange={(e) => setSpecial(e.target.value)}
                        placeholder={t.booking.specialRequestsPlaceholder}
                        rows={4}
                        className="input-luxury resize-none"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 4 && (
              <div data-testid="booking-step-4" className="max-w-2xl">
                <h2 className="font-serif text-2xl md:text-3xl text-[#F5F0E8] mb-2 font-light">{t.booking.summary}</h2>
                <div className="gold-divider mb-8" />

                <div className="bg-[#141414] border border-[#F5F0E8]/10 p-8 space-y-5">
                  <SummaryRow label={t.booking.offer} value={offerName} />
                  <SummaryRow
                    label={t.booking.date}
                    value={selectedDate ? format(selectedDate, "EEEE d MMMM yyyy", { locale: lang === "fr" ? frLocale : enUS }) : "—"}
                  />
                  <SummaryRow label={t.booking.adults} value={`${adults} × ${formatXOF(offer.price_adult)}`} />
                  {children > 0 && <SummaryRow label={t.booking.children} value={`${children} × ${formatXOF(offer.price_child)}`} />}
                  {special && <SummaryRow label={t.booking.specialRequests} value={special} />}
                  <div className="pt-5 border-t border-[#F5F0E8]/10 flex justify-between items-baseline">
                    <span className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A]">
                      {t.booking.total}
                    </span>
                    <span className="font-serif text-3xl text-[#B8922A]">{formatXOF(total)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCreateBooking}
                  className="btn-gold mt-10 inline-flex items-center gap-3"
                  data-testid="confirm-summary-btn"
                  disabled={!user}
                >
                  {t.booking.payNow}
                  <ArrowRight size={14} />
                </button>
                {!user && (
                  <p className="mt-4 text-sm text-[#F5F0E8]/50">
                    <Link to={`/login?next=/booking/${offerId}`} className="text-[#B8922A] underline">
                      {t.booking.loginCta}
                    </Link>{" "}
                    — {t.booking.mustLogin.toLowerCase()}
                  </p>
                )}
              </div>
            )}

            {step === 5 && bookingResp && (
              <div data-testid="booking-step-5" className="max-w-2xl">
                {bookingResp.status === "confirmed" ? (
                  <ConfirmationView booking={bookingResp} t={t} navigate={navigate} />
                ) : (
                  <PaymentView booking={bookingResp} onPay={handlePay} paying={paying} t={t} total={total} />
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer nav */}
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
        <div className="font-serif text-xl text-[#F5F0E8]">{label}</div>
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
        <span className="font-serif text-2xl text-[#F5F0E8] w-8 text-center" data-testid={`${testId}-value`}>{value}</span>
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

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <div className="label-luxury">{label}</div>
      <div className="bg-[#141414] border border-[#F5F0E8]/10 px-4 py-3.5 text-sm text-[#F5F0E8]">{value}</div>
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

function PaymentView({ booking, onPay, paying, t, total }) {
  return (
    <div data-testid="payment-view">
      <h2 className="font-serif text-2xl md:text-3xl text-[#F5F0E8] mb-2 font-light">{t.booking.step5}</h2>
      <div className="gold-divider mb-8" />

      <div className="bg-[#141414] border border-[#B8922A]/30 p-10 text-center">
        <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">FINEO</div>
        <div className="font-serif text-4xl text-[#F5F0E8] mb-2">{formatXOF(booking.total_amount)}</div>
        <div className="text-sm text-[#F5F0E8]/50 mb-8">Booking ID · {booking.id.slice(0, 8)}</div>
        <button
          onClick={onPay}
          disabled={paying}
          className="btn-gold w-full sm:w-auto"
          data-testid="pay-fineo-btn"
        >
          {paying ? t.booking.payProcessing : t.booking.payNow}
        </button>
      </div>
    </div>
  );
}

function ConfirmationView({ booking, t, navigate }) {
  return (
    <motion.div
      data-testid="confirmation-view"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 border border-[#B8922A] rounded-full mb-6">
          <Check className="text-[#B8922A]" size={22} />
        </div>
        <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">
          {booking.offer_name}
        </div>
        <h2 className="font-serif text-3xl md:text-4xl text-[#F5F0E8] font-light mb-4 tracking-tight">
          {t.booking.successTitle}
        </h2>
        <p className="text-[#F5F0E8]/60 max-w-md mx-auto mb-10 leading-relaxed">{t.booking.successText}</p>

        <div className="bg-[#141414] border border-[#B8922A]/30 p-8 inline-block">
          {booking.qr_code ? (
            <img src={booking.qr_code} alt="QR Code" className="w-60 h-60 mx-auto bg-white p-3" data-testid="qr-code-img" />
          ) : (
            <div className="w-60 h-60 bg-[#0A0A0A] flex items-center justify-center text-[#F5F0E8]/30 text-xs uppercase tracking-[0.3em]">
              QR pending
            </div>
          )}
          <div className="mt-5 text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A]">
            #{booking.id.slice(0, 8).toUpperCase()}
          </div>
        </div>

        <div className="mt-10">
          <button
            onClick={() => navigate("/account")}
            className="btn-ghost-gold"
            data-testid="view-bookings-btn"
          >
            {t.booking.viewBookings}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

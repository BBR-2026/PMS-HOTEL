import { useState } from "react";
import { motion } from "framer-motion";
import api from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { toast } from "sonner";

const STAFF_BG = "https://images.unsplash.com/photo-1729717949780-46e511489c3f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHw0fHxsdXh1cnklMjBiZWFjaCUyMHJlc29ydCUyMHBvb2x8ZW58MHx8fHwxNzc3ODkwNDA3fDA&ixlib=rb-4.1.0&q=85";

export default function EventPrivatization() {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: "",
    surname: "",
    phone: "",
    email: "",
    event_type: "",
    event_date: "",
    guest_count: 50,
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const change = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/events/privatization", form);
      setSubmitted(true);
      toast.success(t.events.sent);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="events-page" className="min-h-screen bg-[#0A0A0A]">
      <section className="relative h-[60vh] min-h-[420px] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <img src={STAFF_BG} alt="Events" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/55 via-[#0A0A0A]/55 to-[#0A0A0A]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/70 via-transparent to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-24 pb-20 w-full">
          <div className="text-[0.72rem] uppercase tracking-[0.4em] text-[#B8922A] mb-5">
            {t.events.heroEyebrow}
          </div>
          <h1 className="font-display-serif text-5xl md:text-6xl lg:text-7xl text-[#F5F0E8] tracking-tight leading-[1.05] mb-6">
            {t.events.heroTitle}
          </h1>
          <div className="gold-divider mb-7" />
          <p className="max-w-2xl text-base md:text-lg text-[#F5F0E8]/80 font-light leading-relaxed">
            {t.events.subtitle}
          </p>
        </div>
      </section>

      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#141414] border border-[#B8922A]/30 p-12 text-center"
              data-testid="event-success"
            >
              <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-4">Boulay Concierge</div>
              <h2 className="font-serif text-3xl md:text-4xl text-[#F5F0E8] font-light tracking-tight mb-4">
                Merci.
              </h2>
              <p className="text-[#F5F0E8]/60 max-w-md mx-auto">{t.events.sent}</p>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="bg-[#141414] border border-[#F5F0E8]/10 p-8 md:p-12 space-y-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Field label={t.booking.name} value={form.name} onChange={change("name")} testId="ev-name" required />
                <Field label={t.booking.surname} value={form.surname} onChange={change("surname")} testId="ev-surname" required />
                <Field label={t.booking.phone} value={form.phone} onChange={change("phone")} testId="ev-phone" required />
                <Field type="email" label={t.auth.email} value={form.email} onChange={change("email")} testId="ev-email" required />
                <Field label={t.events.eventType} value={form.event_type} onChange={change("event_type")} testId="ev-type" required />
                <Field type="date" label={t.events.eventDate} value={form.event_date} onChange={change("event_date")} testId="ev-date" required />
              </div>
              <Field type="number" label={t.events.guestCount} value={form.guest_count} onChange={change("guest_count")} testId="ev-count" required />
              <div>
                <label className="label-luxury">{t.events.message}</label>
                <textarea
                  rows={5}
                  value={form.message}
                  onChange={change("message")}
                  className="input-luxury resize-none"
                  data-testid="ev-message"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-gold w-full sm:w-auto" data-testid="ev-submit">
                {loading ? "..." : t.events.submit}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, testId, required, type = "text" }) {
  return (
    <div>
      <label className="label-luxury">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        className="input-luxury"
        data-testid={testId}
      />
    </div>
  );
}

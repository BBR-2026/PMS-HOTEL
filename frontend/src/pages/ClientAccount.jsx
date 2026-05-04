import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { formatXOF } from "../lib/i18n";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_KEY = {
  pending: "pending",
  confirmed: "confirmed",
  arrived: "arrived",
  completed: "completed",
  cancelled: "cancelled",
};

export default function ClientAccount() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeQr, setActiveQr] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/bookings/me");
      setBookings(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (id) => {
    if (!window.confirm(t.account.confirmCancel)) return;
    try {
      await api.delete(`/bookings/${id}`);
      toast.success(t.account.cancelled);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Cancel failed");
    }
  };

  const handlePay = async (id) => {
    try {
      await api.post(`/bookings/${id}/pay`);
      toast.success(t.booking.successTitle);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Payment failed");
    }
  };

  return (
    <div data-testid="client-account" className="min-h-screen bg-[#0A0A0A] text-[#F5F0E8] pt-28 pb-24 px-6 md:px-12">
      <div className="max-w-5xl mx-auto">
        <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-4">
          {t.account.welcome}
        </div>
        <h1 className="font-serif text-4xl md:text-6xl font-light tracking-tight">
          {user?.name} <span className="italic text-[#B8922A]">{user?.surname}</span>
        </h1>
        <div className="gold-divider mt-6 mb-16" />

        <div className="flex items-end justify-between mb-10">
          <h2 className="font-serif text-2xl md:text-3xl font-light">{t.account.myBookings}</h2>
          <Link to="/" className="btn-ghost-gold">{t.account.bookNow}</Link>
        </div>

        {loading ? (
          <div className="text-[0.7rem] uppercase tracking-[0.3em] text-[#F5F0E8]/40">Loading…</div>
        ) : bookings.length === 0 ? (
          <div className="bg-[#141414] border border-[#F5F0E8]/10 p-16 text-center">
            <p className="text-[#F5F0E8]/50 mb-6">{t.account.noBookings}</p>
            <Link to="/" className="btn-gold inline-block">{t.account.bookNow}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {bookings.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="bg-[#141414] border border-[#F5F0E8]/10 p-7 md:p-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6"
                data-testid={`booking-card-${b.id}`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A]">{b.offer_name}</span>
                    <StatusPill status={b.status} t={t} />
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl text-[#F5F0E8] font-light tracking-tight mb-2">
                    {format(new Date(b.date), "EEEE d MMMM yyyy", { locale: lang === "fr" ? frLocale : enUS })}
                  </h3>
                  <div className="text-sm text-[#F5F0E8]/60">
                    {b.adults} {t.booking.adults.toLowerCase()}
                    {b.children > 0 ? ` · ${b.children} ${t.booking.children.toLowerCase()}` : ""}
                    {" · "}
                    <span className="text-[#B8922A]">{formatXOF(b.total_amount)}</span>
                  </div>
                  {b.special_requests && (
                    <div className="text-sm text-[#F5F0E8]/40 mt-3 italic max-w-lg">"{b.special_requests}"</div>
                  )}
                </div>

                <div className="flex flex-wrap items-start md:items-end md:flex-col md:items-stretch gap-3 md:min-w-[180px]">
                  {b.status === "pending" && (
                    <button onClick={() => handlePay(b.id)} className="btn-gold text-xs" data-testid={`pay-btn-${b.id}`}>
                      {t.account.pay}
                    </button>
                  )}
                  {b.qr_code && (
                    <button onClick={() => setActiveQr(b)} className="btn-ghost-gold text-xs" data-testid={`qr-btn-${b.id}`}>
                      {t.account.qrCode}
                    </button>
                  )}
                  {(b.status === "pending" || b.status === "confirmed") && (
                    <button
                      onClick={() => handleCancel(b.id)}
                      className="text-[0.7rem] uppercase tracking-[0.22em] text-[#F5F0E8]/40 hover:text-red-400 transition-colors py-2"
                      data-testid={`cancel-btn-${b.id}`}
                    >
                      {t.account.cancel}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeQr && (
          <div
            className="fixed inset-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setActiveQr(null)}
            data-testid="qr-modal"
          >
            <div className="bg-[#141414] border border-[#B8922A]/30 p-10 max-w-md text-center" onClick={(e) => e.stopPropagation()}>
              <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-3">
                {activeQr.offer_name}
              </div>
              <h3 className="font-serif text-2xl text-[#F5F0E8] mb-1">
                {format(new Date(activeQr.date), "d MMMM yyyy", { locale: lang === "fr" ? frLocale : enUS })}
              </h3>
              <div className="text-sm text-[#F5F0E8]/50 mb-6">#{activeQr.id.slice(0, 8).toUpperCase()}</div>
              <img src={activeQr.qr_code} alt="QR" className="w-64 h-64 mx-auto bg-white p-3" data-testid="qr-modal-img" />
              <button onClick={() => setActiveQr(null)} className="btn-ghost-gold mt-8" data-testid="qr-close-btn">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status, t }) {
  const map = {
    pending: { label: t.account.pending, color: "text-[#B8922A] border-[#B8922A]/40" },
    confirmed: { label: t.account.confirmed, color: "text-[#B8922A] border-[#B8922A]" },
    arrived: { label: t.account.arrived, color: "text-emerald-400 border-emerald-400/40" },
    completed: { label: t.account.completed, color: "text-[#F5F0E8]/50 border-[#F5F0E8]/20" },
    cancelled: { label: t.account.cancelled, color: "text-red-400/70 border-red-400/30" },
  };
  const cfg = map[status] || map.pending;
  return (
    <span className={`inline-block text-[0.6rem] uppercase tracking-[0.25em] px-2.5 py-1 border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

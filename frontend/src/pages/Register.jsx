import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/account";
  const [form, setForm] = useState({ name: "", surname: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success(t.auth.registerTitle);
      navigate(next);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="register-page" className="min-h-screen bg-[#0A0A0A] flex items-center justify-center pt-24 pb-16 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-xl"
      >
        <div className="text-center mb-10">
          <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-4">Boulay Beach Resort</div>
          <h1 className="font-serif text-4xl md:text-5xl text-[#F5F0E8] font-light tracking-tight">
            {t.auth.registerTitle}
          </h1>
          <p className="text-sm text-[#F5F0E8]/50 mt-3">{t.auth.registerSubtitle}</p>
        </div>

        <form onSubmit={submit} className="bg-[#141414] border border-[#F5F0E8]/10 p-8 md:p-10 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="label-luxury">{t.booking.name}</label>
              <input value={form.name} onChange={change("name")} className="input-luxury" required data-testid="reg-name" />
            </div>
            <div>
              <label className="label-luxury">{t.booking.surname}</label>
              <input value={form.surname} onChange={change("surname")} className="input-luxury" required data-testid="reg-surname" />
            </div>
          </div>
          <div>
            <label className="label-luxury">{t.booking.phone}</label>
            <input value={form.phone} onChange={change("phone")} className="input-luxury" required data-testid="reg-phone" />
          </div>
          <div>
            <label className="label-luxury">{t.auth.email}</label>
            <input type="email" value={form.email} onChange={change("email")} className="input-luxury" required data-testid="reg-email" />
          </div>
          <div>
            <label className="label-luxury">{t.auth.password}</label>
            <input type="password" value={form.password} onChange={change("password")} className="input-luxury" minLength={6} required data-testid="reg-password" />
          </div>
          <button type="submit" disabled={loading} className="btn-gold w-full" data-testid="reg-submit-btn">
            {loading ? "..." : t.auth.submit}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-[#F5F0E8]/50">
          {t.auth.hasAccount}{" "}
          <Link to={`/login${next ? `?next=${next}` : ""}`} className="text-[#B8922A] hover:text-[#D4AF37] transition-colors" data-testid="goto-login">
            {t.auth.signIn}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/account";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success(t.auth.loginTitle);
      navigate(next);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="login-page" className="min-h-screen bg-[#0A0A0A] flex items-center justify-center pt-24 pb-16 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-4">Boulay Beach Resort</div>
          <h1 className="font-serif text-4xl md:text-5xl text-[#F5F0E8] font-light tracking-tight">
            {t.auth.loginTitle}
          </h1>
          <p className="text-sm text-[#F5F0E8]/50 mt-3">{t.auth.loginSubtitle}</p>
        </div>

        <form onSubmit={submit} className="bg-[#141414] border border-[#F5F0E8]/10 p-8 md:p-10 space-y-6">
          <div>
            <label className="label-luxury">{t.auth.email}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-luxury"
              required
              data-testid="login-email-input"
            />
          </div>
          <div>
            <label className="label-luxury">{t.auth.password}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-luxury"
              required
              data-testid="login-password-input"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-gold w-full" data-testid="login-submit-btn">
            {loading ? "..." : t.auth.submit}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-[#F5F0E8]/50">
          {t.auth.noAccount}{" "}
          <Link to={`/register${next ? `?next=${next}` : ""}`} className="text-[#B8922A] hover:text-[#D4AF37] transition-colors" data-testid="goto-register">
            {t.auth.signUp}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

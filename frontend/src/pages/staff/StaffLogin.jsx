import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { toast } from "sonner";

export default function StaffLogin() {
  const { user, login } = useStaffAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/staff" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success("Connexion réussie");
      navigate("/staff");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Identifiants invalides");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center p-6" data-testid="staff-login-page">
      <div className="w-full max-w-md bg-white border border-[#B8922A]/30 p-10 md:p-12">
        <div className="text-center mb-10">
          <div className="font-display-serif text-4xl text-[#B8922A] tracking-tight">BBr</div>
          <div className="text-[0.6rem] uppercase tracking-[0.4em] text-[#B8922A]/80 mt-2">
            Boulay Beach Resort
          </div>
          <div className="text-[0.55rem] uppercase tracking-[0.4em] text-[#0A0A0A]/40 mt-1">
            Back-office Staff
          </div>
        </div>

        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60">
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full mt-2 border border-[#0A0A0A]/15 bg-white px-4 py-3 outline-none focus:border-[#B8922A] transition-colors"
              placeholder="admin@boulay.ci"
              data-testid="staff-login-email"
            />
          </div>
          <div>
            <label className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full mt-2 border border-[#0A0A0A]/15 bg-white px-4 py-3 outline-none focus:border-[#B8922A] transition-colors"
              data-testid="staff-login-password"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="btn-gold w-full"
            data-testid="staff-login-submit"
          >
            {busy ? "…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}

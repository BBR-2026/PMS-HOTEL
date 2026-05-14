import { useState } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { toast } from "sonner";

export default function StaffLogin() {
  const { user, login } = useStaffAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && !expired) return <Navigate to="/staff" replace />;

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
          <img
            src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/5jjvd8zn_LOGO_BBr_VF_Plan_de_travail_1-removebg-preview.png"
            alt="Boulay Beach Resort"
            className="h-28 w-auto mx-auto mb-3"
            data-testid="staff-login-logo"
          />
          <div className="text-[0.55rem] uppercase tracking-[0.4em] text-[#0A0A0A]/40">
            Back-office Staff
          </div>
        </div>

        {expired && (
          <div className="mb-6 p-3 bg-[#B8922A]/10 border border-[#B8922A]/30 text-[0.78rem] text-[#0A0A0A]/80" data-testid="session-expired-banner">
            Votre session a expiré. Merci de vous reconnecter.
          </div>
        )}

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

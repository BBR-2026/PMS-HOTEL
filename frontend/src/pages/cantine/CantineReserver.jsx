import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2, Clock, CheckCircle2, Search, ArrowLeft, Hash, User,
  Calendar, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const BBR_LOGO =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";

export default function CantineReserver() {
  const [code, setCode] = useState("");
  const [user, setUser] = useState(null);   // looked-up user
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);   // {meal_date, credits_remaining, …}

  const lookup = async (e) => {
    e?.preventDefault?.();
    const c = code.trim().toUpperCase();
    if (c.length !== 6) {
      toast.error("Le code doit comporter 6 caractères (ex. FRA428)");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(`/cantine/public/users/${c}`);
      setUser(data);
    } catch (err) {
      setUser(null);
      toast.error(err.response?.data?.detail || "Code Cantine introuvable");
    } finally {
      setLoading(false);
    }
  };

  const reserve = async (e) => {
    e.preventDefault();
    if (!confirmed) {
      toast.error("Veuillez cocher 'Je serai présent au déjeuner de demain'");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/cantine/public/reservations", {
        code: user.code,
        confirmed: true,
      });
      setSuccess(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]" data-testid="cantine-reserve-success">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
          <img src={BBR_LOGO} alt="BBR" className="h-14 w-auto object-contain mx-auto mb-6" />
          <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={56} strokeWidth={1.5} />
          <h1 className="font-display-serif text-3xl text-[#0A0A0A] mb-2">
            Inscription enregistrée
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mb-6">
            {success.guest_name}, votre repas du{" "}
            <strong className="text-[#0A0A0A]">{formatDate(success.meal_date)}</strong>{" "}
            est confirmé.
          </p>

          <div className="bg-white border-2 border-[#B8922A] p-5 mb-6">
            <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-2">
              Crédits restants
            </div>
            <div className="font-display-serif text-4xl font-bold text-[#0A0A0A] mb-1"
                 data-testid="cantine-credits-remaining">
              {success.credits_remaining}
            </div>
            <div className="text-[0.7rem] text-[#0A0A0A]/50">
              repas pour le mois en cours
            </div>
          </div>

          <Link
            to="/cantine"
            className="block bg-[#B8922A] hover:bg-[#9d7a23] text-white py-3 text-[0.7rem] uppercase tracking-[0.22em]"
            data-testid="cantine-reserve-home"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]" data-testid="cantine-reserve-page">
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link
          to="/cantine"
          className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] mb-6"
        >
          <ArrowLeft size={12} /> Retour
        </Link>

        <div className="text-center mb-6">
          <img src={BBR_LOGO} alt="BBR" className="h-12 w-auto object-contain mx-auto mb-5" />
          <div className="text-[0.62rem] uppercase tracking-[0.3em] text-[#B8922A] mb-1.5 inline-flex items-center gap-1.5">
            <Clock size={11} /> Cantine de demain
          </div>
          <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A] mb-2">
            Réserver mon repas
          </h1>
          <p className="text-sm text-[#0A0A0A]/60">
            Saisissez votre code Cantine pour confirmer votre présence.
          </p>
        </div>

        <form onSubmit={lookup} className="mb-5">
          <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5 inline-flex items-center gap-1.5">
            <Hash size={10} /> Code Cantine <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              maxLength={6}
              value={code}
              placeholder="FRA428"
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setUser(null);
                setConfirmed(false);
              }}
              className="flex-1 px-3 py-3 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-base font-mono tracking-widest text-center bg-white uppercase"
              data-testid="cantine-reserve-code-input"
            />
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="bg-[#0A0A0A] hover:bg-[#1f1f1f] disabled:opacity-40 text-white px-4 inline-flex items-center justify-center"
              data-testid="cantine-reserve-lookup-btn"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </div>
        </form>

        {user && (
          <div className="bg-white border border-[#0A0A0A]/10 p-4 mb-5 animate-in fade-in slide-in-from-bottom-3"
               data-testid="cantine-reserve-user-card">
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] mb-2 inline-flex items-center gap-1.5">
              <User size={10} /> Profil identifié
            </div>
            <div className="font-display-serif text-xl text-[#0A0A0A] mb-1">
              {user.first_name} {user.last_name}
            </div>
            <div className="text-sm text-[#0A0A0A]/65 mb-3">
              {user.service} · {user.position}
              <br />
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[#B8922A]">
                {user.type === "personnel" ? "Personnel" : "Prestataire"}
              </span>
            </div>

            <div className="border-t border-[#0A0A0A]/8 pt-3 flex items-baseline justify-between">
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55">
                Crédits restants
              </span>
              <span className={`text-lg font-bold ${user.credits_remaining > 0 ? "text-[#B8922A]" : "text-red-500"}`}>
                {user.credits_remaining} / {user.credits_attributed}
              </span>
            </div>

            {user.credits_remaining === 0 ? (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 text-sm flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>Vous n&apos;avez plus de crédits repas disponibles ce mois-ci.</span>
              </div>
            ) : (
              <form onSubmit={reserve} className="mt-4 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[#B8922A]"
                    data-testid="cantine-reserve-checkbox"
                  />
                  <span className="text-sm text-[#0A0A0A]/80 leading-relaxed">
                    <span className="font-medium text-[#0A0A0A] inline-flex items-center gap-1.5">
                      <Calendar size={12} className="text-[#B8922A]" />
                      Je serai présent au déjeuner de demain
                    </span>
                    <br />
                    <span className="text-[0.72rem] text-[#0A0A0A]/55">
                      1 crédit sera décompté de votre solde mensuel.
                    </span>
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={submitting || !confirmed}
                  className="w-full bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-50 text-white py-3 text-[0.7rem] uppercase tracking-[0.22em] inline-flex items-center justify-center gap-2"
                  data-testid="cantine-reserve-submit"
                >
                  {submitting ? (
                    <><Loader2 size={14} className="animate-spin" /> Enregistrement…</>
                  ) : (
                    <>Valider mon inscription</>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-center text-[0.7rem] text-[#0A0A0A]/40 mt-8 leading-relaxed">
          Pas encore de compte ?{" "}
          <Link to="/cantine/inscription" className="text-[#B8922A] underline hover:text-[#9d7a23]">
            Créer mon compte
          </Link>
        </p>
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

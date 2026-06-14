import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2, CreditCard, Shield, CheckCircle2, AlertCircle,
  Calendar, Clock, Users,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";

const BBR_LOGO =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";

const fmtMoney = (n) =>
  `${new Intl.NumberFormat("fr-FR").format(Math.round(n || 0))} FCFA`;

const fmtDate = (s) => {
  if (!s) return "—";
  try {
    return new Date(s + "T12:00:00").toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return s; }
};

export default function Pay() {
  const { token } = useParams();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api.get(`/payment-links/${token}`)
      .then(({ data }) => setSummary(data))
      .catch((err) => setError(err.response?.data?.detail || "Lien introuvable"))
      .finally(() => setLoading(false));
  }, [token]);

  const pay = async () => {
    setPaying(true);
    try {
      const { data } = await api.post(`/payment-links/${token}/checkout`);
      if (data?.checkout_url) {
        // Open FineoPay in a new tab and route to the result-polling page
        window.open(data.checkout_url, "_blank", "noopener,noreferrer");
        window.location.href = `/payment/fineo/result?booking_id=${summary.booking_id}&intent=booking`;
        return;
      }
      throw new Error("Aucune URL de paiement reçue");
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || "Paiement indisponible");
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]" data-testid="pay-loading">
        <Loader2 size={32} className="animate-spin text-[#B8922A]" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAF7F2]" data-testid="pay-error">
        <div className="max-w-md text-center">
          <AlertCircle size={56} className="mx-auto text-red-500 mb-4" strokeWidth={1.5} />
          <h1 className="font-display-serif text-2xl text-[#0A0A0A] mb-2">Lien indisponible</h1>
          <p className="text-sm text-[#0A0A0A]/60">{error}</p>
          <p className="text-xs text-[#0A0A0A]/40 mt-6">
            Si le problème persiste, contactez l'équipe BBR au +225 27 22 47 17 47.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]" data-testid="pay-page">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={BBR_LOGO} alt="Boulay Beach Resort" className="h-14 w-auto object-contain mx-auto mb-6" />
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2 inline-flex items-center gap-2">
            <CreditCard size={12} /> Paiement sécurisé
          </div>
          <h1 className="font-display-serif text-3xl sm:text-4xl text-[#0A0A0A] mb-3">
            Finaliser votre réservation
          </h1>
          <p className="text-[#0A0A0A]/65 text-sm leading-relaxed max-w-md mx-auto">
            Votre réservation est enregistrée. Réglez en ligne et recevez votre billet QR
            par email instantanément.
          </p>
        </div>

        {/* Summary card */}
        <div className="bg-white border border-[#B8922A]/25 p-5 sm:p-6 mb-6" data-testid="pay-summary">
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-4">
            Récapitulatif · {summary.ref}
          </div>

          <h2 className="font-display-serif text-xl text-[#0A0A0A] mb-4 leading-tight">
            {summary.offer_label}
          </h2>

          <div className="space-y-2.5 text-sm border-t border-[#0A0A0A]/8 pt-4">
            <Row icon={Calendar} label="Date" value={fmtDate(summary.date)} />
            {summary.checkout_date && summary.checkout_date !== summary.date && (
              <Row icon={Calendar} label="Départ" value={fmtDate(summary.checkout_date)} />
            )}
            {summary.boat_time && (
              <Row icon={Clock} label="Embarquement" value={summary.boat_time} />
            )}
            <Row
              icon={Users}
              label="Convives"
              value={`${summary.adults} adulte${summary.adults > 1 ? "s" : ""}${summary.children > 0 ? `, ${summary.children} enfant${summary.children > 1 ? "s" : ""}` : ""}`}
            />
            {summary.customer_name && (
              <Row label="Au nom de" value={summary.customer_name} />
            )}
          </div>

          {/* Total */}
          <div className="mt-5 pt-4 border-t border-[#0A0A0A]/8 flex items-baseline justify-between">
            <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">
              Montant à régler
            </span>
            <span className="font-display-serif text-3xl text-[#B8922A]" data-testid="pay-total">
              {fmtMoney(summary.total_amount)}
            </span>
          </div>
        </div>

        {/* Pay CTA */}
        <button
          onClick={pay}
          disabled={paying}
          className="w-full bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-50 text-white py-3.5 text-[0.72rem] uppercase tracking-[0.22em] inline-flex items-center justify-center gap-2 transition-colors"
          data-testid="pay-now-btn"
        >
          {paying ? (
            <><Loader2 size={14} className="animate-spin" /> Redirection vers FineoPay…</>
          ) : (
            <><Shield size={14} /> Payer maintenant — {fmtMoney(summary.total_amount)}</>
          )}
        </button>

        {/* Trust strip */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.65rem] text-[#0A0A0A]/55">
          <span className="inline-flex items-center gap-1.5"><Shield size={12} /> Paiement sécurisé SSL</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={12} /> FineoPay</span>
          <span className="inline-flex items-center gap-1.5">Billet envoyé après paiement</span>
        </div>

        <div className="mt-10 text-center">
          <p className="text-[10px] text-[#0A0A0A]/40 leading-relaxed">
            Boulay Beach Resort — Le Joyau Insulaire d'Abidjan<br />
            En cas de question, écrivez-nous à <a href="mailto:reservations@boulay.ci" className="underline">reservations@boulay.ci</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#0A0A0A]/55 text-[0.75rem] uppercase tracking-wide inline-flex items-center gap-2">
        {Icon && <Icon size={13} className="text-[#0A0A0A]/40" />}
        {label}
      </span>
      <span className="text-[#0A0A0A] text-sm text-right">{value}</span>
    </div>
  );
}

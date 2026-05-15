import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Home } from "lucide-react";
import api from "../lib/api";

const POLL_INTERVAL_MS = 2500;
const POLL_MAX = 24; // ≈ 60 s

export default function FineoResult() {
  const [params] = useSearchParams();
  const bookingId = params.get("booking_id") || "";
  const intent = params.get("intent") || "booking";
  const [status, setStatus] = useState("pending");
  const [reference, setReference] = useState(null);
  const [amount, setAmount] = useState(null);
  const [polls, setPolls] = useState(0);
  const tickRef = useRef(null);

  const poll = async () => {
    try {
      const { data } = await api.get(`/payments/fineo/status/${bookingId}?intent=${intent}`);
      setStatus(data.status || "pending");
      setReference(data.reference || null);
      setAmount(data.amount || null);
      if (["paid", "failed", "expired"].includes(data.status)) {
        clearInterval(tickRef.current);
      }
    } catch {
      /* keep polling */
    }
  };

  useEffect(() => {
    if (!bookingId) return;
    poll();
    tickRef.current = setInterval(() => {
      setPolls((p) => {
        const np = p + 1;
        if (np >= POLL_MAX) {
          clearInterval(tickRef.current);
          return np;
        }
        poll();
        return np;
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, intent]);

  // When paid, we stay on this page and show a clear success state with
  // the FineoPay reference. The customer receives the ticket by email via
  // the webhook-triggered receipt flow.

  const fmtFCFA = (n) => new Intl.NumberFormat("fr-FR").format(n || 0) + " FCFA";

  return (
    <div className="min-h-screen bg-[#FAFAF7] pt-24 sm:pt-28 px-4 sm:px-6 flex items-center justify-center">
      <div className="max-w-lg w-full bg-white border border-[#0A0A0A]/8 p-8 sm:p-10 text-center" data-testid="fineo-result-card">
        <Link to="/" className="text-[0.7rem] uppercase tracking-[0.28em] text-[#0A0A0A]/55 hover:text-[#B8922A] inline-flex items-center gap-2 mb-6">
          <Home size={12} /> Accueil
        </Link>

        {status === "unknown" && (
          <>
            <RefreshCw className="mx-auto text-[#0A0A0A]/45 mb-4" size={48} />
            <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A] mb-2">Aucune transaction trouvée</h1>
            <p className="text-sm text-[#0A0A0A]/65 mb-6">
              Nous n'avons pas trouvé de paiement FineoPay associé à cette réservation. Si vous venez de payer, attendez quelques secondes puis rafraîchissez.
            </p>
            <button
              onClick={() => { setPolls(0); poll(); }}
              className="bg-[#B8922A] text-white px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23]"
              data-testid="fineo-retry-unknown-btn"
            >
              Rafraîchir
            </button>
          </>
        )}

        {status === "pending" && polls < POLL_MAX && (
          <>
            <Loader2 className="mx-auto text-[#B8922A] animate-spin mb-4" size={48} />
            <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A] mb-2">Paiement en cours…</h1>
            <p className="text-sm text-[#0A0A0A]/65 mb-6">Nous attendons la confirmation de FineoPay. Cela prend quelques secondes.</p>
            <div className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Référence : {bookingId.slice(0, 8).toUpperCase()}</div>
          </>
        )}

        {status === "pending" && polls >= POLL_MAX && (
          <>
            <RefreshCw className="mx-auto text-amber-600 mb-4" size={48} />
            <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A] mb-2">Confirmation différée</h1>
            <p className="text-sm text-[#0A0A0A]/65 mb-6">
              Le paiement n'a pas encore été confirmé par FineoPay. Si vous avez bien validé sur leur page, vous recevrez votre billet par email dès la confirmation.
            </p>
            <button
              onClick={() => { setPolls(0); poll(); }}
              className="bg-[#B8922A] text-white px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23]"
              data-testid="fineo-retry-btn"
            >
              Vérifier à nouveau
            </button>
          </>
        )}

        {status === "paid" && (
          <>
            <CheckCircle2 className="mx-auto text-emerald-600 mb-4" size={56} />
            <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A] mb-2">Paiement confirmé</h1>
            <p className="text-sm text-[#0A0A0A]/65 mb-4">
              Votre paiement de <span className="font-medium text-[#0A0A0A] tabular-nums">{fmtFCFA(amount)}</span> a bien été reçu.
            </p>
            {reference && (
              <div className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45 mb-6">Réf. FineoPay : {reference}</div>
            )}
            <div className="border border-[#B8922A]/30 bg-[#B8922A]/5 p-4 text-[0.78rem] text-[#0A0A0A]/75 mb-6">
              Votre billet QR vous a été envoyé par email. Conservez-le pour l'embarquement.
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#0A0A0A]/85"
              data-testid="fineo-home-btn"
            >
              Retour à l'accueil
            </Link>
          </>
        )}

        {(status === "failed" || status === "expired") && (
          <>
            <XCircle className="mx-auto text-red-600 mb-4" size={56} />
            <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A] mb-2">
              {status === "expired" ? "Lien expiré" : "Paiement non abouti"}
            </h1>
            <p className="text-sm text-[#0A0A0A]/65 mb-6">
              {status === "expired"
                ? "Votre session de paiement a expiré. Recommencez depuis le tunnel de réservation."
                : "FineoPay nous a indiqué que le paiement a échoué ou a été annulé. Aucun montant n'a été prélevé."}
            </p>
            <Link
              to="/"
              className="bg-[#B8922A] text-white px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] inline-block"
              data-testid="fineo-back-btn"
            >
              Retour à l'accueil
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

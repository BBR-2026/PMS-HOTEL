import { useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";
import { QrCode, CheckCircle2, ScanLine } from "lucide-react";

export default function StaffScanner() {
  const [tokenInput, setTokenInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const lookup = async (token) => {
    setLoading(true);
    setResult(null);
    try {
      // Accept either a full JSON QR payload or a bare guest_token
      let qrToken = token.trim();
      if (qrToken.startsWith("{")) {
        try {
          const obj = JSON.parse(qrToken);
          qrToken = obj.guest_token || obj.qr_token || qrToken;
        } catch {}
      }
      const { data } = await api.get(`/staff/scan/${qrToken}`);
      setResult(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "QR code non reconnu");
    } finally {
      setLoading(false);
    }
  };

  const markArrived = async () => {
    if (!result) return;
    await api.post(`/staff/bookings/${result.booking_id}/arrived`);
    toast.success("Client marqué comme arrivé");
    setResult({ ...result, status: "arrived" });
  };

  const reset = () => { setResult(null); setTokenInput(""); };

  return (
    <div className="p-8 md:p-12 max-w-3xl mx-auto" data-testid="staff-scanner">
      <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2 flex items-center gap-3">
        <QrCode size={28} className="text-[#B8922A]" />
        Scanner QR Code
      </h1>
      <p className="text-sm text-[#0A0A0A]/55 mb-10">Saisissez le token d'un QR code ou collez son contenu JSON</p>

      {!result && (
        <div className="bg-white border border-[#B8922A]/30 p-10 text-center" data-testid="scanner-input-card">
          <ScanLine size={48} className="text-[#B8922A]/40 mx-auto mb-5" />
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tokenInput && lookup(tokenInput)}
            placeholder="Token QR ou contenu JSON…"
            className="w-full border-b border-[#0A0A0A]/15 px-3 py-2.5 text-center text-base focus:border-[#B8922A] outline-none"
            data-testid="scanner-token-input"
            autoFocus
          />
          <button
            onClick={() => tokenInput && lookup(tokenInput)}
            disabled={!tokenInput || loading}
            className="btn-gold mt-6 inline-flex items-center gap-3"
            data-testid="scanner-lookup-btn"
          >
            {loading ? "Recherche…" : "Vérifier le QR"}
          </button>
        </div>
      )}

      {result && (
        <div className="bg-white border border-[#B8922A]/40 p-8" data-testid="scanner-result">
          <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">QR Valide</div>
          <h2 className="font-display-serif text-3xl text-[#0A0A0A] mb-1">
            {result.guest_surname} {result.guest_name}
          </h2>
          <p className="text-sm text-[#0A0A0A]/55 mb-7">
            {result.guest_nationality}
          </p>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm border-y border-[#0A0A0A]/10 py-5">
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Offre</dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">{result.offer_name}</dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Date</dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">{result.date}</dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Bateau</dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">{result.boat_time}</dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Convives</dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">
                {result.adults}A {result.children > 0 ? `· ${result.children}E` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Paiement</dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">
                {result.payment_method || "—"}
                {result.total_amount > 0 && ` · ${result.total_amount.toLocaleString("fr-FR")} FCFA`}
              </dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Statut</dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">{result.status}</dd>
            </div>
          </dl>

          {result.special_requests && (
            <div className="mt-5">
              <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] mb-1">Demandes spéciales</div>
              <div className="text-sm text-[#0A0A0A]/80">{result.special_requests}</div>
            </div>
          )}

          {result.status !== "arrived" ? (
            <button
              onClick={markArrived}
              className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white py-4 text-sm uppercase tracking-[0.22em] inline-flex items-center justify-center gap-3 transition-colors"
              data-testid="scanner-mark-arrived-btn"
            >
              <CheckCircle2 size={18} /> Marquer comme arrivé
            </button>
          ) : (
            <div className="mt-8 w-full bg-green-50 border border-green-200 text-green-700 py-4 text-sm uppercase tracking-[0.22em] flex items-center justify-center gap-3" data-testid="scanner-already-arrived">
              <CheckCircle2 size={18} /> Déjà arrivé
            </div>
          )}

          <button onClick={reset} className="mt-5 w-full text-xs uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] py-2" data-testid="scanner-new-scan-btn">
            Scanner un autre QR
          </button>
        </div>
      )}
    </div>
  );
}

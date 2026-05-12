import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { toast } from "sonner";
import { QrCode, CheckCircle2, ScanLine, Camera, CameraOff, Keyboard, Sparkles } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

const SCAN_REGION_ID = "qr-scan-region";

export default function StaffScanner() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("camera"); // 'camera' | 'manual'
  const [tokenInput, setTokenInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);

  // Stop scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  const handleScanned = async (decodedText) => {
    // Detect wallet vs reservation QR
    let payload = decodedText.trim();
    let isWallet = false;
    let walletToken = null;
    let guestToken = null;
    if (payload.startsWith("{")) {
      try {
        const obj = JSON.parse(payload);
        if (obj.type === "wallet" && obj.token) {
          isWallet = true;
          walletToken = obj.token;
        } else {
          guestToken = obj.guest_token || obj.qr_token || null;
        }
      } catch {
        /* not JSON */
      }
    }
    if (isWallet) {
      // Stop camera and route to the activities page with the token prefilled
      await stopCamera();
      toast.success("Carte Activités détectée");
      navigate(`/staff/activites?token=${encodeURIComponent(walletToken)}`);
      return;
    }
    // Otherwise: reservation QR
    await stopCamera();
    await lookup(guestToken || payload);
  };

  const lookup = async (token) => {
    setLoading(true);
    setResult(null);
    try {
      let qrToken = (token || "").trim();
      if (qrToken.startsWith("{")) {
        try {
          const obj = JSON.parse(qrToken);
          if (obj.type === "wallet" && obj.token) {
            navigate(`/staff/activites?token=${encodeURIComponent(obj.token)}`);
            return;
          }
          qrToken = obj.guest_token || obj.qr_token || qrToken;
        } catch {
          /* keep as-is */
        }
      }
      const { data } = await api.get(`/staff/scan/${qrToken}`);
      setResult(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "QR code non reconnu");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      // Wait one tick so the DOM element is mounted
      await new Promise((r) => setTimeout(r, 50));
      const Html5QrcodeCtor = Html5Qrcode;
      scannerRef.current = new Html5QrcodeCtor(SCAN_REGION_ID);
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        (decodedText) => handleScanned(decodedText),
        () => {},
      );
      setCameraOn(true);
    } catch (e) {
      setCameraError(
        e?.message?.includes("permission") || e?.name === "NotAllowedError"
          ? "Autorisation caméra refusée. Activez l'accès dans votre navigateur."
          : "Caméra indisponible sur cet appareil.",
      );
      setCameraOn(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        /* already stopped */
      }
      scannerRef.current = null;
    }
    setCameraOn(false);
  };

  const markArrived = async () => {
    if (!result) return;
    await api.post(`/staff/bookings/${result.booking_id}/arrived`);
    toast.success("Client marqué comme arrivé");
    setResult({ ...result, status: "arrived" });
  };

  const reset = async () => {
    setResult(null);
    setTokenInput("");
    if (mode === "camera" && !cameraOn) await startCamera();
  };

  // Auto-start camera when mode = camera
  useEffect(() => {
    if (mode === "camera" && !cameraOn && !result) {
      startCamera();
    } else if (mode !== "camera" && cameraOn) {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, result]);

  return (
    <div className="p-4 md:p-8 lg:p-12 max-w-3xl mx-auto" data-testid="staff-scanner">
      <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A] mb-2 flex items-center gap-3">
        <QrCode size={26} className="text-[#B8922A]" />
        Scanner QR Code
      </h1>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">
        Scannez avec la caméra de l'appareil, ou saisissez manuellement le token.
      </p>

      {/* Mode selector */}
      {!result && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("camera")}
            className={`flex-1 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] border transition-all inline-flex items-center justify-center gap-2 ${
              mode === "camera"
                ? "bg-[#B8922A] text-white border-[#B8922A]"
                : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
            }`}
            data-testid="scanner-mode-camera"
          >
            <Camera size={13} /> Caméra
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] border transition-all inline-flex items-center justify-center gap-2 ${
              mode === "manual"
                ? "bg-[#B8922A] text-white border-[#B8922A]"
                : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
            }`}
            data-testid="scanner-mode-manual"
          >
            <Keyboard size={13} /> Manuel
          </button>
        </div>
      )}

      {/* Camera mode */}
      {!result && mode === "camera" && (
        <div className="bg-white border border-[#B8922A]/30 p-4 sm:p-6" data-testid="scanner-camera-card">
          <div
            id={SCAN_REGION_ID}
            className="w-full max-w-md mx-auto bg-[#0A0A0A] aspect-square overflow-hidden rounded"
            style={{ minHeight: 280 }}
          />
          {cameraError ? (
            <div className="mt-5 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 p-3">
              <CameraOff size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                {cameraError}
                <button onClick={startCamera} className="ml-2 underline">
                  Réessayer
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex items-center justify-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">
              <Sparkles size={11} className="text-[#B8922A]" />
              {cameraOn ? "Approchez le QR Code de la caméra" : "Démarrage de la caméra…"}
            </div>
          )}
        </div>
      )}

      {/* Manual mode */}
      {!result && mode === "manual" && (
        <div className="bg-white border border-[#B8922A]/30 p-6 sm:p-10 text-center" data-testid="scanner-input-card">
          <ScanLine size={42} className="text-[#B8922A]/40 mx-auto mb-5" />
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

      {/* Result */}
      {result && (
        <div className="bg-white border border-[#B8922A]/40 p-5 sm:p-8" data-testid="scanner-result">
          <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">QR Valide</div>
          <h2 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A] mb-1">
            {result.guest_surname} {result.guest_name}
          </h2>
          <p className="text-sm text-[#0A0A0A]/55 mb-6">{result.guest_nationality}</p>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm border-y border-[#0A0A0A]/10 py-5">
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
            <div
              className="mt-8 w-full bg-green-50 border border-green-200 text-green-700 py-4 text-sm uppercase tracking-[0.22em] flex items-center justify-center gap-3"
              data-testid="scanner-already-arrived"
            >
              <CheckCircle2 size={18} /> Déjà arrivé
            </div>
          )}

          <button
            onClick={reset}
            className="mt-5 w-full text-xs uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] py-2"
            data-testid="scanner-new-scan-btn"
          >
            Scanner un autre QR
          </button>
        </div>
      )}
    </div>
  );
}

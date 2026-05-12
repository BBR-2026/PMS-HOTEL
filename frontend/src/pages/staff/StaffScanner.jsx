import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { toast } from "sonner";
import { QrCode, CheckCircle2, ScanLine, Camera, CameraOff, Keyboard, Sparkles, Wallet } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

const SCAN_REGION_ID = "qr-scan-region";

const PAYMENT_FR = {
  card: "Carte bancaire",
  fineo: "Carte bancaire",
  mobile_money: "Mobile Money",
  cash: "Espèces",
  deposit: "Acompte",
};
const STATUS_FR = {
  pending: "En attente",
  confirmed: "Confirmée",
  arrived: "Embarqué (aller)",
  completed: "Embarqué (aller + retour)",
  cancelled: "Annulée",
};
const DIRECTION_FR = { aller: "Aller", retour: "Retour" };

// Format ISO date (YYYY-MM-DD) to DD/MM/YYYY for display.
function formatDateFR(iso) {
  if (!iso || typeof iso !== "string") return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
// Format ISO timestamp to DD/MM/YYYY HH:MM (local).
function formatDateTimeFR(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export default function StaffScanner() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("camera"); // 'camera' | 'manual'
  const [tokenInput, setTokenInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);
  // Block duplicate decodes: html5-qrcode fires the callback on every frame where
  // a QR is recognised, so without this flag we'd trigger several /staff/scan
  // requests in parallel (flickering UI + spurious errors).
  const processingRef = useRef(false);
  // Block concurrent camera starts (React StrictMode runs effects twice in dev,
  // and rapid mode switches can otherwise create two Html5Qrcode instances on the
  // same DOM region → camera locks up).
  const startingRef = useRef(false);

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
    if (processingRef.current) return; // ignore subsequent frames
    processingRef.current = true;
    // Detect QR type. The QR can contain:
    //  - {"type":"ticket","token":"…"}  (current compact format)
    //  - {"type":"wallet","token":"…"}  (activities wallet)
    //  - {"guest_token":"…",…}          (legacy full JSON payload)
    //  - raw token string               (manual entry fallback)
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
        } else if (obj.type === "ticket" && obj.token) {
          guestToken = obj.token;
        } else {
          guestToken = obj.guest_token || obj.qr_token || obj.token || null;
        }
      } catch {
        /* not JSON */
      }
    }
    try {
      if (isWallet) {
        await stopCamera();
        toast.success("Carte Activités détectée");
        navigate(`/staff/activites?token=${encodeURIComponent(walletToken)}`);
        return;
      }
      await stopCamera();
      await lookup(guestToken || payload);
    } finally {
      // Allow the next manual scan attempt once UI is in `result` mode.
      // (reset() will clear this on the next scan request.)
    }
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
          if (obj.type === "ticket" && obj.token) {
            qrToken = obj.token;
          } else {
            qrToken = obj.guest_token || obj.qr_token || obj.token || qrToken;
          }
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
    if (startingRef.current) return; // concurrent guard
    startingRef.current = true;
    setCameraError(null);
    // If a previous instance is still around, stop it first.
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    try {
      // Wait two animation frames so React has actually committed the <div id> to the DOM.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // Sanity check: the scan region must exist before instantiating Html5Qrcode.
      const regionEl = document.getElementById(SCAN_REGION_ID);
      if (!regionEl) {
        // Component unmounted or mode switched away — silently abort.
        startingRef.current = false;
        return;
      }
      // Clear any leftover DOM children inside the region (a previous stopped instance
      // may have left an injected <video> / <canvas> behind).
      regionEl.innerHTML = "";
      const instance = new Html5Qrcode(SCAN_REGION_ID);
      scannerRef.current = instance;
      await instance.start(
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
          : (e?.message || "Caméra indisponible sur cet appareil."),
      );
      setCameraOn(false);
      scannerRef.current = null;
    } finally {
      startingRef.current = false;
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      const instance = scannerRef.current;
      scannerRef.current = null;
      // Wrap stop/clear in a timeout so a hung native getUserMedia release on
      // Safari iOS can't block the UI for more than 800ms.
      const timeout = new Promise((resolve) => setTimeout(resolve, 800));
      try {
        await Promise.race([
          (async () => {
            try { await instance.stop(); } catch { /* ignore */ }
            try { await instance.clear(); } catch { /* ignore */ }
          })(),
          timeout,
        ]);
      } catch {
        /* swallow */
      }
    }
    setCameraOn(false);
  };

  const doCheckin = async () => {
    if (!result || !result.qr_token) return;
    try {
      const { data } = await api.post(`/staff/scan/${result.qr_token}/checkin`);
      const dirLabel = DIRECTION_FR[data.direction] || data.direction;
      toast.success(`Embarquement ${dirLabel.toLowerCase()} enregistré`);
      const newScan = {
        direction: data.direction,
        scanned_at: data.scanned_at,
        staff_email: data.staff_email,
      };
      setResult({
        ...result,
        scans: [...(result.scans || []), newScan],
        scan_count: data.scan_count,
        next_direction: data.next_direction,
        fully_used: data.fully_used,
        status: data.booking_status,
      });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur lors de l'embarquement");
    }
  };

  const reset = () => {
    // Synchronous state reset so the UI re-renders immediately, even if the
    // underlying MediaStream is slow to release (typical Safari iOS issue).
    processingRef.current = false;
    setTokenInput("");
    setResult(null);
    // Stop the camera in the background — the useEffect will then restart it.
    stopCamera().catch(() => {});
  };

  // Auto-start camera when mode = camera and no result is shown
  useEffect(() => {
    if (mode === "camera" && !cameraOn && !result) {
      processingRef.current = false;
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
          <p className="text-[0.72rem] text-[#0A0A0A]/55 mb-4">
            Saisissez le code de référence visible sur le billet (ex. <span className="font-mono text-[#0A0A0A]">5DF111909C</span>) ou le token complet.
          </p>
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tokenInput && lookup(tokenInput)}
            placeholder="Référence (10 caractères) ou token QR…"
            className="w-full border-b border-[#0A0A0A]/15 px-3 py-2.5 text-center text-base font-mono tracking-wider focus:border-[#B8922A] outline-none"
            data-testid="scanner-token-input"
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
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
            {result.guest_surname || result.guest_name ? `${result.guest_surname || ""} ${result.guest_name || ""}`.trim() : "Invité"}
          </h2>
          <p className="text-sm text-[#0A0A0A]/55 mb-1">{result.guest_nationality || "—"}</p>
          {(result.guest_phone || result.guest_email) && (
            <p className="text-[0.72rem] text-[#0A0A0A]/55 mb-6 flex flex-wrap gap-x-3">
              {result.guest_phone && <span>{result.guest_phone}</span>}
              {result.guest_email && <span>· {result.guest_email}</span>}
            </p>
          )}
          {!result.guest_phone && !result.guest_email && <div className="mb-6" />}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm border-y border-[#0A0A0A]/10 py-5">
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Offre</dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">{result.offer_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">
                {result.checkout_date ? "Arrivée" : "Date"}
              </dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">{formatDateFR(result.date)}</dd>
            </div>
            {result.checkout_date && (
              <>
                <div>
                  <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Départ</dt>
                  <dd className="text-[#0A0A0A] font-medium mt-0.5">
                    {formatDateFR(result.checkout_date)}
                    {result.nights > 0 && (
                      <span className="text-[0.7rem] text-[#0A0A0A]/55 ml-2">
                        · {result.nights} nuit{result.nights > 1 ? "s" : ""}
                      </span>
                    )}
                  </dd>
                </div>
                {result.room_tier_name && (
                  <div>
                    <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Chambre</dt>
                    <dd className="text-[#0A0A0A] font-medium mt-0.5">
                      {result.room_tier_name}
                      {result.rooms > 1 && <span className="text-[0.7rem] text-[#0A0A0A]/55 ml-2">× {result.rooms}</span>}
                    </dd>
                  </div>
                )}
              </>
            )}
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">
                {result.checkout_date ? "Bateau aller" : "Bateau"}
              </dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">{result.boat_time || "—"}</dd>
            </div>
            {result.return_boat_time && (
              <div>
                <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Bateau retour</dt>
                <dd className="text-[#0A0A0A] font-medium mt-0.5">{result.return_boat_time}</dd>
              </div>
            )}
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Convives</dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">
                {result.adults}A {result.children > 0 ? `· ${result.children}E` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Paiement</dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">
                {PAYMENT_FR[result.payment_method] || result.payment_method || "—"}
                {result.total_amount > 0 && ` · ${result.total_amount.toLocaleString("fr-FR")} FCFA`}
              </dd>
            </div>
            {result.balance_due > 0 && (
              <div className="sm:col-span-2 bg-amber-50 border border-amber-200 px-3 py-2 -mx-2">
                <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-amber-700">
                  Solde à régler à l'arrivée{result.deposit_pct ? ` · acompte ${result.deposit_pct}% versé` : ""}
                </dt>
                <dd className="text-amber-900 font-display-serif text-lg mt-0.5">
                  {result.balance_due.toLocaleString("fr-FR")} FCFA
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Statut</dt>
              <dd className="text-[#0A0A0A] font-medium mt-0.5">{STATUS_FR[result.status] || result.status || "—"}</dd>
            </div>
          </dl>

          {result.special_requests && (
            <div className="mt-5">
              <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] mb-1">Demandes spéciales</div>
              <div className="text-sm text-[#0A0A0A]/80">{result.special_requests}</div>
            </div>
          )}

          {/* Scans history */}
          {(result.scans && result.scans.length > 0) && (
            <div className="mt-6 bg-[#FAFAF7] border border-[#0A0A0A]/8 px-4 py-3" data-testid="scanner-scans-history">
              <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] mb-2">
                Embarquements enregistrés · {result.scans.length}/2
              </div>
              <ul className="space-y-1.5">
                {result.scans.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm text-[#0A0A0A]"
                    data-testid={`scan-history-${i}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-green-600" />
                      <span className="font-medium">{DIRECTION_FR[s.direction] || s.direction}</span>
                    </span>
                    <span className="text-[0.72rem] text-[#0A0A0A]/55">
                      {formatDateTimeFR(s.scanned_at)}
                      {s.staff_email && <span className="ml-2">· {s.staff_email}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Embarkation CTA — single button whose label depends on next_direction */}
          {result.next_direction ? (
            <button
              onClick={doCheckin}
              className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white py-4 text-sm uppercase tracking-[0.22em] inline-flex items-center justify-center gap-3 transition-colors"
              data-testid={`scanner-checkin-${result.next_direction}-btn`}
            >
              <CheckCircle2 size={18} />
              {result.next_direction === "aller"
                ? "Embarquement aller"
                : "Embarquement retour"}
            </button>
          ) : (
            <div
              className="mt-6 w-full bg-green-50 border border-green-200 text-green-700 py-4 text-sm uppercase tracking-[0.22em] flex items-center justify-center gap-3"
              data-testid="scanner-fully-used"
            >
              <CheckCircle2 size={18} /> QR entièrement utilisé (aller + retour)
            </div>
          )}

          {result.wallet_token && (
            <button
              onClick={() => navigate(`/staff/activites?token=${encodeURIComponent(result.wallet_token)}`)}
              className="mt-3 w-full bg-white hover:bg-[#FAFAF7] border border-[#B8922A]/40 text-[#B8922A] py-3 text-sm uppercase tracking-[0.22em] inline-flex items-center justify-center gap-3 transition-colors"
              data-testid="scanner-open-wallet-btn"
            >
              <Wallet size={14} /> Ouvrir la carte Activités
            </button>
          )}

          <button
            onClick={reset}
            className="mt-5 w-full bg-[#FAFAF7] hover:bg-[#0A0A0A] hover:text-white text-[#0A0A0A] border border-[#0A0A0A]/15 hover:border-[#0A0A0A] py-3 text-[0.7rem] uppercase tracking-[0.22em] inline-flex items-center justify-center gap-3 transition-colors"
            data-testid="scanner-new-scan-btn"
          >
            <ScanLine size={14} /> Scanner un autre QR
          </button>
        </div>
      )}
    </div>
  );
}

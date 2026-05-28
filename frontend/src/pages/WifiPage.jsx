import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Wifi, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const BBR_LOGO = "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";

// Edit these credentials when needed
const WIFI_SSID = "BBr-Guest";
const WIFI_PASSWORD = "BoulayBeach2026";

export default function WifiPage() {
  const [copied, setCopied] = useState(null);

  const copy = async (text, kind) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success("Copié !");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copie indisponible");
    }
  };

  return (
    <div className="min-h-screen bg-white" data-testid="wifi-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <Link to="/accueil" className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] inline-flex items-center gap-2" data-testid="back-accueil">
            <ArrowLeft size={14} /> Retour
          </Link>
          <img src={BBR_LOGO} alt="BBr" className="h-12 w-auto object-contain" style={{ filter: "brightness(0.9)" }} />
        </div>

        <div className="text-center mb-8 sm:mb-10">
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2 flex items-center justify-center gap-2">
            <Wifi size={12} /> Connexion
          </div>
          <h1 className="font-display-serif text-3xl sm:text-4xl text-[#0A0A0A] mb-3">Wi-Fi BBr</h1>
          <p className="text-[#0A0A0A]/55 text-sm sm:text-base">Connectez-vous gratuitement à notre réseau invité</p>
        </div>

        <div className="bg-gradient-to-br from-[#0A0A0A] to-[#2A1A0E] text-white p-8 sm:p-10 relative overflow-hidden" data-testid="wifi-card">
          <Wifi size={120} className="absolute -top-6 -right-6 text-white/8" strokeWidth={1} />
          <div className="relative z-10 space-y-6">
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2">Réseau (SSID)</div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-display-serif text-2xl sm:text-3xl" data-testid="ssid-value">{WIFI_SSID}</div>
                <button onClick={() => copy(WIFI_SSID, "ssid")} className="p-2.5 border border-white/20 hover:border-[#B8922A] hover:bg-white/5 transition-colors" data-testid="copy-ssid" title="Copier">
                  {copied === "ssid" ? <Check size={16} className="text-[#B8922A]" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2">Mot de passe</div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-xl sm:text-2xl tracking-wider" data-testid="password-value">{WIFI_PASSWORD}</div>
                <button onClick={() => copy(WIFI_PASSWORD, "pwd")} className="p-2.5 border border-white/20 hover:border-[#B8922A] hover:bg-white/5 transition-colors" data-testid="copy-password" title="Copier">
                  {copied === "pwd" ? <Check size={16} className="text-[#B8922A]" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3 text-sm text-[#0A0A0A]/65">
          <Step n="01" text="Ouvrez les paramètres Wi-Fi de votre appareil" />
          <Step n="02" text={<>Sélectionnez le réseau <b className="text-[#0A0A0A]">{WIFI_SSID}</b></>} />
          <Step n="03" text="Saisissez le mot de passe ci-dessus" />
          <Step n="04" text="Profitez de votre journée à BBr !" />
        </div>

        <div className="mt-10 text-center text-[0.72rem] text-[#0A0A0A]/45">
          Difficulté de connexion ? Approchez-vous de la réception ou contactez un membre de l'équipe.
        </div>
      </div>
    </div>
  );
}

function Step({ n, text }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] font-semibold pt-0.5">{n}</div>
      <div>{text}</div>
    </div>
  );
}

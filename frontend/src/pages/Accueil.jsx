import { Link } from "react-router-dom";
import { CreditCard, Wifi, Star } from "lucide-react";

const BBR_LOGO = "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";

const TILES = [
  { to: "/accueil/paiement", icon: CreditCard, num: "01", title: "Effectuer un paiement", subtitle: "Réglez votre consommation à l'un de nos points de vente" },
  { to: "/accueil/wifi",      icon: Wifi,       num: "02", title: "Se connecter au Wi-Fi", subtitle: "Accédez gratuitement à notre réseau" },
  { to: "/retour-experience", icon: Star,       num: "03", title: "Partager votre expérience", subtitle: "Votre avis nous aide à nous améliorer" },
];

export default function Accueil() {
  return (
    <div className="min-h-screen bg-white flex flex-col" data-testid="accueil-hub">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 sm:py-16 max-w-5xl mx-auto w-full">
        <img src={BBR_LOGO} alt="Boulay Beach Resort" className="h-[110px] sm:h-[140px] md:h-[170px] w-auto object-contain mb-10 sm:mb-14" style={{ filter: "brightness(0.9)" }} />

        <div className="text-center mb-10 sm:mb-14">
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-3">Life Is Here</div>
          <h1 className="font-display-serif text-[1.9rem] sm:text-5xl md:text-6xl text-[#0A0A0A] mb-4 leading-tight">
            Bienvenue au BBr
          </h1>
          <p className="text-[#0A0A0A]/65 text-base sm:text-lg">
            Que souhaitez-vous faire ?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 w-full max-w-4xl">
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                data-testid={`tile-${t.to.split("/").pop()}`}
                className="group relative bg-white border border-[#0A0A0A]/12 p-7 sm:p-8 flex flex-col gap-4 hover:border-[#B8922A] hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between">
                  <Icon size={32} className="text-[#B8922A] group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                  <span className="text-[0.62rem] uppercase tracking-[0.32em] text-[#0A0A0A]/30 font-medium">{t.num}</span>
                </div>
                <div>
                  <h2 className="font-display-serif text-lg sm:text-xl text-[#0A0A0A] mb-1.5 leading-tight">{t.title}</h2>
                  <p className="text-[0.85rem] text-[#0A0A0A]/55 leading-relaxed">{t.subtitle}</p>
                </div>
                <div className="mt-auto pt-3 flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] group-hover:text-[#0A0A0A] transition-colors">
                  Accéder
                  <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  ChevronRight,
  Anchor,
  Ship,
  UtensilsCrossed,
  Beer,
  Wine,
  ConciergeBell,
  ShoppingBag,
  Flower2,
  BellRing,
  Gamepad2,
} from "lucide-react";

const BBR_LOGO =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";

// Each point of sale links DIRECTLY to its dedicated FineoPay checkout URL.
const LOCATIONS = [
  {
    id: "room_service",
    label: "Room Service",
    icon: BellRing,
    color: "#0A0A0A",
    url: "https://app.fineopay.com/boulay_beach_resort/dlcyhvtsviwjektkccyxsdsxtkgkne/checkout",
  },
  {
    id: "reception",
    label: "Réception",
    icon: ConciergeBell,
    color: "#B8922A",
    url: "https://app.fineopay.com/boulay_beach_resort/vflwtetmfoxxjdqysbukthmtjiajnk/checkout",
  },
  {
    id: "restaurant_le_kaai",
    label: "Restaurant Le Kaai",
    icon: UtensilsCrossed,
    color: "#7C2D12",
    url: "https://app.fineopay.com/boulay_beach_resort/oyzshirknwqdnozhhzjuqguzqyctym/checkout",
  },
  {
    id: "bar_lounge",
    label: "Bar Lounge",
    icon: Wine,
    color: "#5B1A1A",
    url: "https://app.fineopay.com/boulay_beach_resort/hvzhhglfkbrfedpzvgssolbtqrovsq/checkout",
  },
  {
    id: "bar_piscine",
    label: "Bar Piscine",
    icon: Beer,
    color: "#0EA5E9",
    url: "https://app.fineopay.com/boulay_beach_resort/tgvthtxefywktnnblcpalxahtcwdcs/checkout",
  },
  {
    id: "spa",
    label: "Spa",
    icon: Flower2,
    color: "#9D174D",
    url: "https://app.fineopay.com/boulay_beach_resort/sorddjhuqirwxlwwshcpfxhbabavqh/checkout",
  },
  {
    id: "boutique",
    label: "Boutique",
    icon: ShoppingBag,
    color: "#16A34A",
    url: "https://app.fineopay.com/boulay_beach_resort/nmwmxuplyfvwahaiyekwkfgxeydquo/checkout",
  },
  {
    id: "aire_de_jeux",
    label: "Aire de Jeux",
    icon: Gamepad2,
    color: "#D97706",
    url: "https://app.fineopay.com/boulay_beach_resort/gjidvbfmwiketkbczzsisdxwjkwgoq/checkout",
  },
  {
    id: "ponton",
    label: "Ponton",
    icon: Ship,
    color: "#0369A1",
    url: "https://app.fineopay.com/boulay_beach_resort/dncudziynnxxjrhptfibdzloukklyl/checkout",
  },
  {
    id: "quai_zone_4",
    label: "Quai Zone 4",
    icon: Anchor,
    color: "#3B82F6",
    url: "https://app.fineopay.com/boulay_beach_resort/lirbtygyqiukkcqoscevmiszjgixur/checkout",
  },
];

export default function PaiementHub() {
  return (
    <div className="min-h-screen bg-white" data-testid="paiement-hub">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <Link
            to="/accueil"
            className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] inline-flex items-center gap-2"
            data-testid="back-accueil"
          >
            <ArrowLeft size={14} /> Retour
          </Link>
          <img
            src={BBR_LOGO}
            alt="BBr"
            className="h-12 w-auto object-contain"
            style={{ filter: "brightness(0.9)" }}
          />
        </div>

        <div className="text-center mb-8 sm:mb-12">
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2 flex items-center justify-center gap-2">
            <CreditCard size={12} /> Paiement
          </div>
          <h1 className="font-display-serif text-3xl sm:text-4xl text-[#0A0A0A] mb-3">
            Choisissez un point de paiement
          </h1>
          <p className="text-[#0A0A0A]/55 text-sm sm:text-base">
            Sélectionnez l'endroit où vous souhaitez régler votre consommation
          </p>
        </div>

        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
          data-testid="locations-grid"
        >
          {LOCATIONS.map((loc) => {
            const Icon = loc.icon;
            return (
              <a
                key={loc.id}
                href={loc.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`location-${loc.id}`}
                className="group bg-white border border-[#0A0A0A]/12 p-5 sm:p-6 flex flex-col items-center text-center hover:border-[#B8922A] hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <Icon
                  size={32}
                  strokeWidth={1.5}
                  style={{ color: loc.color }}
                  className="mb-3 group-hover:scale-110 transition-transform"
                />
                <div className="font-medium text-[#0A0A0A] text-sm sm:text-base leading-tight min-h-[2.5rem] flex items-center">
                  {loc.label}
                </div>
                <div className="mt-2 text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/35 group-hover:text-[#B8922A] transition-colors inline-flex items-center gap-1">
                  Payer <ChevronRight size={11} />
                </div>
              </a>
            );
          })}
        </div>

        <p className="text-center text-[0.7rem] text-[#0A0A0A]/45 mt-10">
          Paiement sécurisé · Mobile Money · Visa · Mastercard
        </p>
      </div>
    </div>
  );
}

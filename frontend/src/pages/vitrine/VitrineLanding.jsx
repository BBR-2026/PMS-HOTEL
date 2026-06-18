/**
 * Vitrine — Landing page (Nikki Beach inspired).
 *
 * Editorial layout: full-bleed hero, locations grid, narrative sections,
 * lifestyle gallery, story, footer. Serif headings (Cormorant), white space,
 * photos do the talking.
 */
import { Link } from "react-router-dom";
import { trackEvent } from "../../lib/tracking";

const UNIVERS = [
  {
    to: "/univers/beach-club",
    name: "Beach Club",
    description:
      "Day Pass, The Sunset, B Brunch — trois rituels signature pour vivre l'île à votre rythme. Une parenthèse exclusive entre lagune et océan, ouverte sept jours sur sept.",
    image:
      "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/trz2j0jd_BEACH%20CLUB.png",
  },
  {
    to: "/univers/hebergement",
    name: "Hébergement",
    description:
      "Une nuit en suspens entre lagune et océan, dans nos suites signature. Chambres Supérieures et Suites côté jardin ou côté lagune, soins Spa & Wellness signature au bord de l'eau.",
    image:
      "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/7bcipz8w_HEBERGEMENT.png",
  },
  {
    to: "/le-kaai",
    name: "Restaurant Le Kaai",
    description:
      "Le KAAÏ est le nouveau restaurant du BBr. Une table à l'ambition gastronomique affirmée, portée par des saveurs d'inspiration africaine contemporaine, dans une atmosphère élégante et chaleureuse.",
    image:
      "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/v2f73qqm_KAAI.png",
  },
  {
    to: "/univers/corporate",
    name: "Corporate",
    description:
      "Séminaires résidentiels, journées d'étude, team building, déjeuners et dîners d'entreprise — salles équipées, vue océan, hébergement et pauses gastronomiques pour vos événements professionnels.",
    image:
      "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/oy7zzngs_SEMINAIRE.png",
  },
  {
    to: "/univers/activites",
    name: "Activités & Events",
    description:
      "Jet ski, paddle, kayak et plus — une journée d'activités lagunaires. Privatisations, soirées privées et expériences sur-mesure pour fédérer vos équipes ou célébrer vos grands moments.",
    image:
      "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/ocqva33h_ACTIVITE.png",
  },
];

const LIFESTYLE = [
  "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1400&q=85",
];

export default function VitrineLanding() {
  return (
    <div data-testid="vitrine-landing" className="bg-white text-[#0A0A0A]">
      {/* ─── HERO ───────────────────────────────────────── */}
      <section className="relative w-full h-screen min-h-[640px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/0frg347a_BBR%20_SHOOT%202_139.jpg.jpeg)",
          }}
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
          <div className="text-[0.7rem] tracking-[0.55em] uppercase text-white/80 mb-10">
            Île Boulay  ·  Abidjan
          </div>
          <h1
            className="font-serif text-white leading-[0.95] text-7xl sm:text-[5.5rem] md:text-[7.5rem] lg:text-[9rem] xl:text-[10.5rem] max-w-6xl"
            style={{ fontWeight: 400, letterSpacing: "0.04em" }}
            data-testid="vitrine-hero-title"
          >
            LIFE IS HERE
          </h1>
          <p
            className="mt-10 text-xl sm:text-2xl md:text-3xl text-white/90 max-w-3xl leading-relaxed font-light"
            data-testid="vitrine-hero-subtitle"
          >
            Une île privée, à quelques minutes d'Abidjan.
            Un autre rythme. Une autre énergie.
            Des expériences premium inoubliables.
          </p>
          <div className="mt-12 w-px h-12 bg-white/60" />
          <div className="mt-6 text-[0.65rem] tracking-[0.4em] uppercase text-white/70">
            Découvrir
          </div>
        </div>
      </section>

      {/* ─── NOS UNIVERS — refined luxury hotel grid ──────── */}
      <section className="py-28 md:py-40 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section header */}
          <div className="text-center mb-16 md:mb-20">
            <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-6">
              · Nos univers ·
            </div>
            <h2 className="font-serif italic font-light text-3xl sm:text-4xl md:text-5xl leading-[1.15] text-[#0A0A0A] max-w-2xl mx-auto">
              Cinq expériences,<br />une seule destination d'exception.
            </h2>
            <div className="w-12 h-px bg-[#B8922A] mx-auto mt-10" />
          </div>

          {/* Editorial 5-card grid : 3 on top row, 2 on bottom row, centered */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-x-6 gap-y-10 md:gap-y-14">
            {UNIVERS.slice(0, 3).map((u) => (
              <UniversCard key={u.to} u={u} className="lg:col-span-2" />
            ))}
            <div className="hidden lg:block lg:col-span-1" />
            {UNIVERS.slice(3, 5).map((u) => (
              <UniversCard key={u.to} u={u} className="lg:col-span-2" />
            ))}
            <div className="hidden lg:block lg:col-span-1" />
          </div>
        </div>
      </section>

      {/* ─── BEACH CLUB EDITORIAL ───────────────────────── */}
      <section className="py-24 md:py-32 bg-[#FAF7F2]">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div className="order-2 md:order-1">
            <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
              Notre Beach Club
            </div>
            <h2 className="font-serif italic font-light text-4xl md:text-5xl leading-[1.1] mb-8 text-[#0A0A0A]">
              L'art de vivre balnéaire, à l'ivoirienne.
            </h2>
            <p className="text-base md:text-lg leading-[1.85] text-[#0A0A0A]/75 mb-8 font-light">
              Pionnier du concept de beach club de luxe en Afrique de l'Ouest, BBR transforme
              chaque visite en un voyage sensoriel. Service chaleureux, cuisine généreuse,
              musique soigneusement programmée, vue lagune. Où que vous choisissiez de vous
              poser, l'expérience est inoubliable.
            </p>
            <Link
              to="/univers/beach-club"
              onClick={() => trackEvent("view_offer", { offer: "Beach Club" })}
              className="inline-block text-[0.7rem] tracking-[0.3em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A] pb-1 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors"
              data-testid="editorial-beach-club-cta"
            >
              Explorer le Beach Club
            </Link>
          </div>
          <div className="order-1 md:order-2">
            <img
              src="https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1600&q=85"
              alt="Beach club BBR"
              className="w-full aspect-[4/5] object-cover"
            />
          </div>
        </div>
      </section>

      {/* ─── LE KAAI — CUISINE ─────────────────────────── */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            <img
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=85"
              alt="Restaurant Le Kaai"
              className="w-full aspect-[4/5] object-cover"
            />
          </div>
          <div>
            <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
              Le Kaai · Restaurant signature
            </div>
            <h2 className="font-serif italic font-light text-4xl md:text-5xl leading-[1.1] mb-8 text-[#0A0A0A]">
              Une cuisine qui voyage,<br />face à la lagune.
            </h2>
            <p className="text-base md:text-lg leading-[1.85] text-[#0A0A0A]/75 mb-8 font-light">
              Savourez nos plateaux à partager, nos bateaux à sushi, nos salades fraîches
              et nos plats internationaux inspirés des destinations qui nous façonnent.
              Une cuisine de la ferme à la table, des produits locaux d'exception, et une
              cave construite avec passion.
            </p>
            <Link
              to="/le-kaai"
              onClick={() => trackEvent("view_offer", { offer: "Le Kaai" })}
              className="inline-block text-[0.7rem] tracking-[0.3em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A] pb-1 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors"
              data-testid="editorial-kaai-cta"
            >
              Découvrir Le Kaai
            </Link>
          </div>
        </div>
      </section>

      {/* ─── LIFESTYLE GALLERY STRIP ─────────────────────── */}
      <section className="bg-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          {LIFESTYLE.map((src, i) => (
            <div key={i} className="relative aspect-square overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center hover:scale-[1.05] transition-transform duration-[1.5s] ease-out"
                style={{ backgroundImage: `url(${src})` }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── NOTRE HISTOIRE ─────────────────────────────── */}
      <section className="py-24 md:py-32 bg-[#FAF7F2]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
            Notre histoire
          </div>
          <h2 className="font-serif italic font-light text-4xl md:text-5xl leading-[1.1] mb-10 text-[#0A0A0A]">
            Une île, une vision,<br />un art de recevoir.
          </h2>
          <p className="text-base md:text-lg leading-[1.85] text-[#0A0A0A]/75 mb-10 font-light">
            Boulay Beach Resort est né d'une volonté simple&nbsp;: créer en Côte d'Ivoire
            un lieu d'exception où le voyage commence dès la traversée. Une île discrète,
            une lagune protégée, un service signature et l'envie de célébrer la vie sous
            toutes ses formes&nbsp;— du brunch dominical à l'événement le plus intime.
          </p>
          <Link
            to="/univers/hebergement"
            className="inline-block text-[0.7rem] tracking-[0.3em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A] pb-1 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors"
          >
            En savoir plus
          </Link>
        </div>
      </section>

      {/* ─── FINAL — RÉSERVATION ────────────────────────── */}
      <section className="relative py-32 md:py-44 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2400&q=85)",
          }}
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center text-white">
          <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/75 mb-8">
            Réservation directe
          </div>
          <h2 className="font-serif italic font-light text-4xl sm:text-5xl md:text-6xl leading-[1.05] mb-10">
            Votre prochaine évasion<br />commence ici.
          </h2>
          <p className="text-white/75 text-base md:text-lg leading-relaxed mb-12 max-w-xl mx-auto font-light">
            Tarif garanti meilleur prix. Annulation flexible jusqu'à 72h avant l'arrivée.
            Confirmation immédiate.
          </p>
          <Link
            to="/reserver"
            onClick={() => trackEvent("start_booking", { source: "landing_final" })}
            className="inline-block text-[0.7rem] tracking-[0.35em] uppercase text-white border-b border-white pb-2 hover:text-[#D4B256] hover:border-[#D4B256] transition-colors"
            data-testid="final-cta-reserver"
          >
            Réserver maintenant
          </Link>
        </div>
      </section>
    </div>
  );
}

/**
 * Single refined universe card — luxury hotel aesthetic.
 *
 * - Portrait image (aspect 3/4) with subtle hover zoom.
 * - Title in italic serif under the image.
 * - 3-line description with ellipsis (line-clamp-3) for visual rhythm.
 * - Gold hairline + "Découvrir" link on hover.
 */
function UniversCard({ u, className = "" }) {
  return (
    <Link
      to={u.to}
      onClick={() => trackEvent("view_offer", { offer: u.name })}
      className={`group block ${className}`}
      data-testid={`univers-card-${u.to.split("/").pop()}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[#FAF7F2]">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.8s] ease-out group-hover:scale-[1.05]"
          style={{ backgroundImage: `url(${u.image})` }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
      </div>
      <div className="pt-6 px-1">
        <h3 className="font-serif italic font-light text-2xl md:text-[1.65rem] leading-tight text-[#0A0A0A] mb-3">
          {u.name}
        </h3>
        <p className="text-sm md:text-[0.95rem] text-[#0A0A0A]/65 leading-relaxed line-clamp-3 font-light mb-5">
          {u.description}
        </p>
        <div className="inline-flex items-center gap-2 text-[0.6rem] tracking-[0.4em] uppercase text-[#B8922A] border-b border-[#B8922A]/40 pb-1 group-hover:border-[#B8922A] transition-colors">
          Découvrir
          <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  );
}

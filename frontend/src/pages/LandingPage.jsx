import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../lib/api";
import { ArrowRight } from "lucide-react";

// Hero image per pôle. These are the cover visuals shown on the landing.
const POLE_IMAGES = {
  beach_club: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/trz2j0jd_BEACH%20CLUB.png",
  hebergement: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/7bcipz8w_HEBERGEMENT.png",
  corporate: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1600&q=80",
  activites_events: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/ocqva33h_ACTIVITE.png",
  le_kaai: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/v2f73qqm_KAAI.png",
};

function PoleCard({ pole, index }) {
  const subOffers = pole.sub_offers || [];
  const subNames = subOffers.map((s) => s.name_fr).filter(Boolean);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden border border-[#0A0A0A]/10 bg-white flex flex-col w-full h-full shadow-sm hover:shadow-md transition-shadow duration-500"
      data-testid={`pole-card-${pole.id}`}
    >
      <Link to={`/pole/${pole.id}`} className="contents">
        <div className="relative overflow-hidden aspect-[4/3] bg-[#FAFAF7]">
          <img
            src={POLE_IMAGES[pole.id]}
            alt={pole.name_fr}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/55 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-6 right-6">
            <h2 className="font-display-serif text-2xl md:text-3xl text-white tracking-tight leading-tight">
              {pole.name_fr}
            </h2>
          </div>
        </div>
        <div className="p-7 md:p-8 flex flex-col flex-1 w-full">
          <p className="text-sm text-[#0A0A0A]/65 leading-relaxed mb-5 line-clamp-2">
            {pole.tagline_fr}
          </p>
          {subNames.length > 0 && (
            <ul className="space-y-1.5 mb-6">
              {subNames.map((n) => (
                <li key={n} className="flex items-center gap-2 text-[0.78rem] text-[#0A0A0A]/75">
                  <span className="text-[#B8922A] leading-none">·</span>
                  {n}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto pt-2 inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] group-hover:gap-3 transition-all">
            Découvrir <ArrowRight size={13} />
          </div>
        </div>
        <div className="absolute inset-0 pointer-events-none border border-transparent group-hover:border-[#B8922A]/40 transition-colors duration-700" />
      </Link>
    </motion.div>
  );
}

function ExclusivityHero({ feature }) {
  if (!feature || !feature.enabled) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden border border-[#B8922A]/40 bg-gradient-to-br from-[#F8F1DC] via-[#F2E7C8] to-[#E8D9A8] mb-10 lg:mb-12 shadow-[0_8px_28px_-12px_rgba(184,146,42,0.45)]"
      data-testid="exclusivity-hero"
    >
      <a href={feature.href || "#"} className="grid grid-cols-1 md:grid-cols-2 min-h-[280px] md:min-h-[340px] group">
        <div className="relative overflow-hidden bg-[#EFE3C2]">
          {feature.image_url ? (
            <img
              src={feature.image_url}
              alt={feature.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#B8922A]/30 to-[#EFE3C2]" />
          )}
          {/* Subtle warm overlay that fades into the beige right column on desktop */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#F2E7C8] hidden md:block" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#F2E7C8] md:hidden" />
        </div>
        <div className="relative p-8 md:p-10 lg:p-12 flex flex-col justify-center text-[#0A0A0A]">
          <div className="inline-flex items-center gap-2 self-start mb-4 px-3 py-1 bg-[#B8922A] text-white text-[0.6rem] uppercase tracking-[0.32em] font-semibold rounded-sm shadow-sm">
            ✦ En exclusivité
          </div>
          <h2 className="font-display-serif text-3xl md:text-4xl lg:text-5xl tracking-tight leading-tight mb-3 text-[#0A0A0A]">
            {feature.title}
          </h2>
          {feature.subtitle && (
            <p className="text-[#8a6c14] text-base md:text-lg font-light mb-3">
              {feature.subtitle}
            </p>
          )}
          {feature.description && (
            <p className="text-[#0A0A0A]/70 text-sm md:text-base leading-relaxed mb-5 max-w-md">
              {feature.description}
            </p>
          )}
          <div className="inline-flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[#B8922A] font-medium group-hover:gap-3 transition-all">
            {feature.cta_label || "Découvrir"} <ArrowRight size={14} />
          </div>
        </div>
      </a>
    </motion.div>
  );
}

export default function LandingPage() {
  const [poles, setPoles] = useState([]);
  const [exclusivity, setExclusivity] = useState(null);

  useEffect(() => {
    api.get("/poles").then((r) => setPoles(r.data || [])).catch(() => {});
    api.get("/exclusivity").then((r) => setExclusivity(r.data || null)).catch(() => {});
  }, []);

  return (
    <div data-testid="landing-page" className="bg-white text-[#0A0A0A] min-h-screen">
      <section
        id="poles"
        className="pt-44 md:pt-56 pb-24 md:pb-32 px-6 md:px-12 lg:px-24"
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 md:mb-20 max-w-4xl">
            <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-3">
              Nos univers
            </div>
            <h2 className="font-display-serif text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight leading-[1.05] mb-6">
              Cinq univers pour une<br />expérience premium et unique.
            </h2>
            <div className="gold-divider mb-6" />
            <p className="text-base text-[#0A0A0A]/60 leading-relaxed">
              Beach club, hébergement, corporate, événements ou table signature.
              Choisissez votre univers et laissez-vous porter par l'expérience Life is here.
            </p>
          </div>

          <ExclusivityHero feature={exclusivity} />

          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr gap-6 lg:gap-8 items-stretch"
            data-testid="poles-grid"
          >
            {poles.map((p, i) => (
              <PoleCard key={p.id} pole={p} index={i} />
            ))}
          </div>

          {/* Gallery teaser — pushes users into the public photo gallery */}
          <a
            href="/galerie"
            data-testid="gallery-teaser"
            className="group relative block mt-12 lg:mt-16 border border-[#B8922A]/40 bg-[#0A0A0A] overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-5 min-h-[200px] md:min-h-[220px]">
              <div className="md:col-span-2 relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80"
                  alt="Galerie photo"
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/40 to-[#0A0A0A]" />
              </div>
              <div className="md:col-span-3 p-8 md:p-10 flex flex-col justify-center text-white">
                <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-3">
                  Notre galerie
                </div>
                <h3 className="font-display-serif text-3xl md:text-4xl tracking-tight leading-tight mb-3">
                  Revivez vos moments BBR
                </h3>
                <p className="text-white/65 text-sm md:text-base leading-relaxed mb-4 max-w-xl">
                  Découvrez les albums photos de chaque expérience signature et téléchargez vos clichés préférés.
                </p>
                <span className="inline-flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[#B8922A] group-hover:gap-3 transition-all">
                  Découvrir la galerie →
                </span>
              </div>
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}

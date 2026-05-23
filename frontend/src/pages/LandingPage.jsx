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
            <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#F5E9C7] mb-1.5">
              Pôle {pole.sort_order}
            </div>
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

export default function LandingPage() {
  const [poles, setPoles] = useState([]);

  useEffect(() => {
    api.get("/poles").then((r) => setPoles(r.data || [])).catch(() => {});
  }, []);

  return (
    <div data-testid="landing-page" className="bg-white text-[#0A0A0A] min-h-screen">
      <section
        id="poles"
        className="pt-44 md:pt-56 pb-24 md:pb-32 px-6 md:px-12 lg:px-24"
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 md:mb-20 max-w-2xl">
            <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-3">
              Nos univers
            </div>
            <h2 className="font-display-serif text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight leading-[1.05] mb-6">
              Cinq portes d'entrée<br />pour une seule lagune.
            </h2>
            <div className="gold-divider mb-6" />
            <p className="text-base text-[#0A0A0A]/60 leading-relaxed">
              Beach club, hébergement, corporate, événements ou table signature.
              Choisissez votre univers et laissez-vous porter par l'expérience Boulay.
            </p>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr gap-6 lg:gap-8 items-stretch"
            data-testid="poles-grid"
          >
            {poles.map((p, i) => (
              <PoleCard key={p.id} pole={p} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

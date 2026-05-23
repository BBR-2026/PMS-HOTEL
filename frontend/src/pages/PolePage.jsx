import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import api from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { formatXOF } from "../lib/i18n";
import SpecialEventCard from "../components/SpecialEventCard";

const SUB_OFFER_IMAGES = {
  pass_day: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/4kr4z5g1_DAY%20PASS.jpeg",
  sunset: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/3g3onmkg_THE%20SUNSET.jpeg",
  brunch: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/1txrnqdp_B%20BRUNCH.jpeg",
  le_kaai: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/v2f73qqm_KAAI.png",
  hebergement: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/7bgj0mje_HEBERGEMENT%202.png",
  spa_wellness: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/rhjncq2g_SPA.png",
  lounge: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/rg0ibzao_LOUNGE.png",
  seminaire: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/oy7zzngs_SEMINAIRE.png",
  team_building: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80",
  journee_etude: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80",
  dejeuner_diner_entreprise: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
  formule_personnalisee: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1600&q=80",
  offres_loisirs: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/66jfvevy_OFFRE%20LOISIRS.png",
};

function SubOfferCard({ offer, index }) {
  const { lang } = useLang();
  const name = lang === "fr" ? offer.name_fr : offer.name_en;
  const schedule = lang === "fr" ? offer.schedule_fr : offer.schedule_en;
  const tagline = lang === "fr" ? offer.tagline_fr : offer.tagline_en;
  const hasTiers = (offer.room_tiers || []).length > 0;
  const isReservationOnly = !hasTiers && (offer.price_adult || 0) <= 0;
  const priceOnRequest = !!offer.price_on_request;
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden border border-[#0A0A0A]/10 bg-white flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-500"
      data-testid={`sub-offer-card-${offer.id}`}
    >
      <div className="relative overflow-hidden aspect-[16/9] bg-[#FAFAF7]">
        <img
          src={SUB_OFFER_IMAGES[offer.id] || SUB_OFFER_IMAGES.pass_day}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
        />
      </div>
      <div className="p-7 md:p-8 flex flex-col flex-1">
        <h3 className="font-display-serif text-2xl md:text-3xl text-[#0A0A0A] tracking-tight mb-1.5">
          {name}
        </h3>
        {schedule && (
          <div className="text-[0.68rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3.5">
            {schedule}
          </div>
        )}
        <div className="gold-divider mb-5" />
        {hasTiers ? (
          <div className="space-y-1.5 mb-5">
            {offer.room_tiers.map((tier) => (
              <div key={tier.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-[#0A0A0A]/70">
                  {lang === "fr" ? tier.name_fr : tier.name_en}
                </span>
                <span className="font-medium text-[#0A0A0A] whitespace-nowrap">
                  {tier.price_on_request ? (
                    <span className="italic text-[#B8922A]">{lang === "fr" ? "Sur demande" : "On request"}</span>
                  ) : (
                    <>
                      {formatXOF(tier.price)}
                      <span className="text-[0.65rem] text-[#0A0A0A]/45 ml-1">/nuit</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : isReservationOnly ? (
          <div className="text-sm text-[#0A0A0A]/70 italic mb-5">
            {priceOnRequest
              ? (lang === "fr" ? "Sur demande" : "On request")
              : (lang === "fr" ? "Réservation uniquement" : "Reservation only")}
          </div>
        ) : (
          <div className="space-y-1.5 mb-5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-[#0A0A0A]/70">Adulte</span>
              <span className="font-medium text-[#0A0A0A]">{formatXOF(offer.price_adult)}</span>
            </div>
            {offer.price_child > 0 && (
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-[#0A0A0A]/70">Enfant</span>
                <span className="font-medium text-[#0A0A0A]">{formatXOF(offer.price_child)}</span>
              </div>
            )}
          </div>
        )}
        {tagline && (
          <p className="text-[0.82rem] text-[#0A0A0A]/65 leading-relaxed mb-6 line-clamp-2">
            {tagline}
          </p>
        )}
        <div className="mt-auto pt-2">
          <Link
            to={`/booking/${offer.id}`}
            className="btn-gold inline-flex items-center gap-3"
            data-testid={`sub-offer-cta-${offer.id}`}
          >
            Réserver <ArrowRight size={13} />
          </Link>
        </div>
      </div>
      <div className="absolute inset-0 pointer-events-none border border-transparent group-hover:border-[#B8922A]/40 transition-colors duration-700" />
    </motion.div>
  );
}

export default function PolePage() {
  const { poleId } = useParams();
  const navigate = useNavigate();
  const [pole, setPole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/poles/${poleId}`)
      .then((r) => setPole(r.data))
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [poleId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-[#0A0A0A]/40 text-sm uppercase tracking-[0.3em]">
        Chargement…
      </div>
    );
  }
  if (!pole) return null;

  const subOffers = pole.sub_offers || [];

  return (
    <div className="bg-white text-[#0A0A0A] min-h-screen" data-testid={`pole-page-${pole.id}`}>
      <section className="pt-32 md:pt-44 pb-12 md:pb-16 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.28em] text-[#0A0A0A]/55 hover:text-[#B8922A] transition-colors mb-10"
            data-testid="pole-back-link"
          >
            <ArrowLeft size={13} /> Tous les pôles
          </Link>
          <div className="max-w-3xl">
            <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-3">
              BBr
            </div>
            <h1 className="font-display-serif text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight leading-[1.05] mb-6">
              {pole.name_fr}
            </h1>
            <div className="gold-divider mb-6" />
            <p className="text-base md:text-lg text-[#0A0A0A]/60 leading-relaxed">
              {pole.tagline_fr}
            </p>
          </div>
        </div>
      </section>

      <section className="pb-24 md:pb-32 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 auto-rows-fr gap-6 lg:gap-8 items-stretch"
            data-testid="pole-sub-offers"
          >
            {subOffers.map((sub, i) => {
              if (sub.kind === "events_list") {
                // Render every published special event in its own card grid section
                const events = sub.events || [];
                if (events.length === 0) {
                  return (
                    <div key="events-empty" className="md:col-span-2 border border-[#0A0A0A]/10 bg-[#FAFAF7] p-10 text-center">
                      <h3 className="font-display-serif text-2xl text-[#0A0A0A] mb-2">Events Maison</h3>
                      <p className="text-sm text-[#0A0A0A]/55">Aucun événement spécial à venir pour le moment.</p>
                    </div>
                  );
                }
                return events.map((ev, j) => (
                  <SpecialEventCard key={ev.id} event={ev} index={j} />
                ));
              }
              return <SubOfferCard key={sub.id} offer={sub} index={i} />;
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

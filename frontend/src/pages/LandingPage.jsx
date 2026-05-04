import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useLang } from "../context/LanguageContext";
import OfferCard from "../components/OfferCard";

const HERO_BG = "https://static.prod-images.emergentagent.com/jobs/4dc6ae3e-af48-4489-bfe0-ebc522484ad7/images/cc908c9d164d56b323fe8dc47c688c4bf5222057ff477bdd3aa4f49ab2bc8c0c.png";
const IMG_PASS_DAY = "https://images.unsplash.com/photo-1729707691048-722c1acf5c51?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBiZWFjaCUyMHJlc29ydCUyMHBvb2x8ZW58MHx8fHwxNzc3ODkwNDA3fDA&ixlib=rb-4.1.0&q=85";
const IMG_SUNSET = "https://static.prod-images.emergentagent.com/jobs/4dc6ae3e-af48-4489-bfe0-ebc522484ad7/images/9e89b22524180e785f62f14ed8558a699ccd6bdf1259b8dea5c13cc732cb44c5.png";
const IMG_BRUNCH = "https://static.prod-images.emergentagent.com/jobs/4dc6ae3e-af48-4489-bfe0-ebc522484ad7/images/bc2709bb2dada5c4c24ec8e6810953270275900ce7a3e0ed81969fc8cec04c96.png";

const IMG_BY_ID = {
  pass_day: IMG_PASS_DAY,
  sunset: IMG_SUNSET,
  brunch: IMG_BRUNCH,
};

export default function LandingPage() {
  const { t, lang } = useLang();
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    api.get("/offers").then((r) => setOffers(r.data)).catch(() => {});
  }, []);

  const descByOffer = {
    pass_day: t.offers.passDayDesc,
    sunset: t.offers.sunsetDesc,
    brunch: t.offers.brunchDesc,
  };

  return (
    <div data-testid="landing-page" className="bg-[#0A0A0A] text-[#F5F0E8]">
      {/* Hero */}
      <section className="relative h-[100vh] min-h-[640px] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="Boulay Beach Resort" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/40 via-[#0A0A0A]/30 to-[#0A0A0A]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-24 pb-24 md:pb-32 w-full">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-6"
          >
            {t.hero.eyebrow}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="font-serif font-light text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] leading-[1.05] tracking-tight max-w-4xl"
          >
            <span className="text-[#F5F0E8]">{t.hero.title}</span>
            <br />
            <span className="text-[#B8922A] italic">{t.hero.titleAccent}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.35 }}
            className="mt-8 max-w-xl text-base text-[#F5F0E8]/70 leading-relaxed font-light"
          >
            {t.hero.subtitle}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="mt-10 flex flex-wrap items-center gap-5"
          >
            <a href="#offers" className="btn-gold" data-testid="hero-cta">
              {t.hero.cta}
            </a>
            <Link
              to="/events"
              className="text-[0.72rem] uppercase tracking-[0.28em] text-[#F5F0E8]/70 hover:text-[#B8922A] transition-colors border-b border-[#F5F0E8]/30 hover:border-[#B8922A] pb-1"
              data-testid="hero-events-link"
            >
              {t.nav.privatization}
            </Link>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-10 right-10 hidden md:flex items-center gap-3 z-10">
          <span className="text-[0.6rem] uppercase tracking-[0.4em] text-[#F5F0E8]/50">
            {t.hero.scroll}
          </span>
          <div className="w-px h-12 bg-gradient-to-b from-[#B8922A] to-transparent" />
        </div>
      </section>

      {/* Offers */}
      <section id="offers" className="py-24 md:py-32 px-6 md:px-12 lg:px-24 relative">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 md:mb-20 max-w-2xl">
            <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-5">
              {t.offers.eyebrow}
            </div>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-[#F5F0E8] tracking-tight leading-[1.05] mb-6">
              {t.offers.title}
            </h2>
            <div className="gold-divider mb-6" />
            <p className="text-base text-[#F5F0E8]/60 leading-relaxed">{t.offers.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {offers.map((offer, i) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                image={IMG_BY_ID[offer.id]}
                description={descByOffer[offer.id]}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Privatization teaser */}
      <section className="py-24 md:py-32 px-6 md:px-12 lg:px-24 border-t border-[#F5F0E8]/10">
        <div className="max-w-5xl mx-auto text-center">
          <div className="text-[0.7rem] uppercase tracking-[0.4em] text-[#B8922A] mb-5">
            {t.events.title}
          </div>
          <h2 className="font-serif text-3xl md:text-5xl text-[#F5F0E8] tracking-tight leading-tight mb-7 italic font-light">
            {lang === "fr"
              ? "« L'évènement, à votre image. »"
              : "“The event, in your image.”"}
          </h2>
          <p className="text-[#F5F0E8]/60 max-w-xl mx-auto mb-10 leading-relaxed">
            {t.events.subtitle}
          </p>
          <Link to="/events" data-testid="events-cta" className="btn-ghost-gold inline-block">
            {t.nav.privatization}
          </Link>
        </div>
      </section>
    </div>
  );
}

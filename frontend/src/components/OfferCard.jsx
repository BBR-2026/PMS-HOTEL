import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { formatXOF } from "../lib/i18n";

export default function OfferCard({ offer, image, description, index = 0, featured = false }) {
  const { lang, t } = useLang();
  const name = lang === "fr" ? offer.name_fr : offer.name_en;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative overflow-hidden border border-[#B8922A]/30 bg-[#141414] ${
        featured ? "md:col-span-2 md:row-span-2" : ""
      }`}
      data-testid={`offer-card-${offer.id}`}
    >
      <div className={`relative overflow-hidden ${featured ? "h-[360px] md:h-[460px]" : "h-[280px]"}`}>
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />
        <div className="absolute top-5 left-5 text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A]">
          {t.offers.eyebrow}
        </div>
      </div>

      <div className="p-8 md:p-10">
        <h3 className="font-serif text-3xl md:text-4xl text-[#F5F0E8] mb-3 tracking-tight">{name}</h3>
        <div className="gold-divider mb-5" />
        <p className="text-sm text-[#F5F0E8]/60 leading-relaxed mb-7 max-w-md">{description}</p>

        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.28em] text-[#F5F0E8]/40 mb-1.5">
              {t.offers.from}
            </div>
            <div className="font-serif text-2xl text-[#B8922A] leading-none">
              {formatXOF(offer.price_adult)}
            </div>
            <div className="text-[0.7rem] text-[#F5F0E8]/50 mt-1.5">
              / {t.offers.adult} · {formatXOF(offer.price_child)} / {t.offers.child}
            </div>
          </div>
        </div>

        <Link
          to={`/booking/${offer.id}`}
          data-testid={`offer-cta-${offer.id}`}
          className="btn-gold inline-flex items-center gap-3"
        >
          {t.offers.reserve}
          <span className="text-[#0A0A0A]">→</span>
        </Link>
      </div>

      <div className="absolute inset-0 pointer-events-none border border-transparent group-hover:border-[#B8922A]/50 transition-colors duration-700" />
    </motion.div>
  );
}

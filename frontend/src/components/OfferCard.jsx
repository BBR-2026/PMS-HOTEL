import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { formatXOF } from "../lib/i18n";

export default function OfferCard({ offer, image, bullets = [], index = 0, featured = false }) {
  const { lang, t } = useLang();
  const name = lang === "fr" ? offer.name_fr : offer.name_en;
  const schedule = lang === "fr" ? offer.schedule_fr : offer.schedule_en;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative overflow-hidden border border-[#B8922A]/30 bg-[#141414] flex flex-col ${
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
      </div>

      <div className="p-8 md:p-10 flex flex-col flex-1">
        <h3 className="font-display-serif text-3xl md:text-4xl text-[#F5F0E8] mb-2 tracking-tight">
          {name}
        </h3>
        {schedule && (
          <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[#B8922A] mb-5">
            {schedule}
          </div>
        )}
        <div className="gold-divider mb-6" />

        {/* Pricing */}
        <div className="space-y-2 mb-6">
          <div className="flex items-baseline justify-between gap-4 text-[#F5F0E8]">
            <span className="text-sm text-[#F5F0E8]/70">{t.offers.adult}</span>
            <span className="font-medium tracking-wide">{formatXOF(offer.price_adult)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 text-[#F5F0E8]">
            <span className="text-sm text-[#F5F0E8]/70">
              {t.offers.child} <span className="text-[#F5F0E8]/40">{t.offers.childAge}</span>
            </span>
            <span className="font-medium tracking-wide">{formatXOF(offer.price_child)}</span>
          </div>
        </div>

        {/* Bullets (only when present) */}
        {bullets && bullets.length > 0 && (
          <ul className="space-y-2 mb-8 mt-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[#F5F0E8]/75">
                <span className="text-[#B8922A] leading-none pt-1">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-2">
          <Link
            to={`/booking/${offer.id}`}
            data-testid={`offer-cta-${offer.id}`}
            className="btn-gold inline-flex items-center gap-3"
          >
            {t.offers.reserve}
            <span className="text-[#0A0A0A]">→</span>
          </Link>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none border border-transparent group-hover:border-[#B8922A]/50 transition-colors duration-700" />
    </motion.div>
  );
}

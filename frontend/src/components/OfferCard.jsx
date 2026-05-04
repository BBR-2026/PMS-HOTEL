import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { formatXOF } from "../lib/i18n";

export default function OfferCard({ offer, image, bullets = [], index = 0 }) {
  const { lang, t } = useLang();
  const name = lang === "fr" ? offer.name_fr : offer.name_en;
  const schedule = lang === "fr" ? offer.schedule_fr : offer.schedule_en;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden border border-[#0A0A0A]/10 bg-white flex flex-col shadow-sm hover:shadow-md transition-shadow duration-500"
      data-testid={`offer-card-${offer.id}`}
    >
      <div className="relative overflow-hidden h-[220px] md:h-[240px] bg-[#FAFAF7] flex items-center justify-center">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-contain transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
        />
      </div>

      <div className="p-8 md:p-10 flex flex-col flex-1">
        <h3 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2 tracking-tight">
          {name}
        </h3>
        {schedule && (
          <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[#B8922A] mb-5">
            {schedule}
          </div>
        )}
        <div className="gold-divider mb-6" />

        {offer.price_adult > 0 ? (
          <div className="space-y-2 mb-6">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-[#0A0A0A]/70">{t.offers.adult}</span>
              <span className="font-medium tracking-wide text-[#0A0A0A]">
                {formatXOF(offer.price_adult)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-[#0A0A0A]/70">
                {t.offers.child}{" "}
                <span className="text-[#0A0A0A]/40">{t.offers.childAge}</span>
              </span>
              <span className="font-medium tracking-wide text-[#0A0A0A]">
                {formatXOF(offer.price_child)}
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="text-sm text-[#0A0A0A]/70 italic">
              {t.offers.reservationOnly}
            </div>
          </div>
        )}

        {bullets && bullets.length > 0 && (
          <ul className="space-y-2 mb-8 mt-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[#0A0A0A]/75">
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
            <span>→</span>
          </Link>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none border border-transparent group-hover:border-[#B8922A]/40 transition-colors duration-700" />
    </motion.div>
  );
}

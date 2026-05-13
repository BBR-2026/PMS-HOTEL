import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Sparkles, Image as ImageIcon } from "lucide-react";
import { formatXOF } from "../lib/i18n";

function fmtDateFR(iso) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${parseInt(m[3], 10)} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

export default function SpecialEventCard({ event, index = 0 }) {
  if (!event) return null;
  const datesLabel = (event.event_dates || []).map(fmtDateFR).slice(0, 3).join(" · ");
  const totalSeatsLeft = Object.values(event.seats_per_date || {}).reduce((a, b) => a + b, 0);
  const sold_out = totalSeatsLeft === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden border-2 border-[#B8922A] bg-white flex flex-col w-full h-full shadow-md hover:shadow-lg transition-shadow duration-500"
      data-testid={`special-event-card-${event.id}`}
    >
      <div className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 py-1 bg-[#B8922A] text-white text-[0.6rem] uppercase tracking-[0.22em] shadow">
        <Sparkles size={11} /> Événement spécial
      </div>
      <div className="relative overflow-hidden aspect-[16/9] bg-[#FAFAF7]">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#0A0A0A]/15">
            <ImageIcon size={48} />
          </div>
        )}
      </div>

      <div className="p-8 md:p-10 flex flex-col flex-1 w-full">
        <h3 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2 tracking-tight">
          {event.title}
        </h3>
        {event.subtitle && (
          <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3">
            {event.subtitle}
          </div>
        )}
        <div className="gold-divider mb-5" />

        {datesLabel && (
          <div className="text-sm text-[#0A0A0A]/75 mb-4">
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45 block mb-1">Date</span>
            {datesLabel}
          </div>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-[#0A0A0A]/70">Adulte</span>
            <span className="font-medium tracking-wide text-[#0A0A0A]">{formatXOF(event.price_adult)}</span>
          </div>
          {event.price_child > 0 && (
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-[#0A0A0A]/70">Enfant</span>
              <span className="font-medium tracking-wide text-[#0A0A0A]">{formatXOF(event.price_child)}</span>
            </div>
          )}
        </div>

        {event.description && (
          <p className="text-[0.85rem] text-[#0A0A0A]/70 leading-relaxed mb-6 line-clamp-3">
            {event.description}
          </p>
        )}

        <div className="mt-auto pt-2 flex items-center gap-3">
          {sold_out ? (
            <span className="inline-flex items-center gap-2 px-5 py-2.5 border border-red-300 text-red-700 text-[0.7rem] uppercase tracking-[0.22em]" data-testid={`special-event-soldout-${event.id}`}>
              Complet
            </span>
          ) : (
            <Link
              to={`/booking/special-event/${event.id}`}
              data-testid={`special-event-cta-${event.id}`}
              className="btn-gold inline-flex items-center gap-3"
            >
              {event.cta_label || "Réserver ma place"}
              <span>→</span>
            </Link>
          )}
          {totalSeatsLeft > 0 && totalSeatsLeft <= 10 && (
            <span className="text-[0.7rem] text-[#B8922A] italic">
              Plus que {totalSeatsLeft} places
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

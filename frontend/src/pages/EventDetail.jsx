import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Calendar, Users, ArrowRight, ChevronLeft } from "lucide-react";
import api from "../lib/api";
import { formatXOF } from "../lib/i18n";

function fmtDateFR(iso) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return `${parseInt(m[3], 10)} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

/**
 * Public detail page for a special event.
 * - Single-day events redirect straight to the booking tunnel.
 * - Multi-day events render the programme as a grid of sub-offer cards (one
 *   per date) with the concept, capacity left, and per-day pricing — each
 *   with its own "Réserver" CTA that opens the tunnel pre-selected on that
 *   date. Customers can come back and book another date independently.
 */
export default function EventDetail() {
  const { eventId } = useParams();
  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get(`/special-events/${eventId}`)
      .then(({ data }) => setEv(data?.event || null))
      .catch((e) => setErr(e.response?.data?.detail || "Événement introuvable"))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-40 pb-20 px-6 text-center text-[#0A0A0A]/50 text-sm" data-testid="event-loading">
        Chargement…
      </div>
    );
  }
  if (err || !ev) {
    return (
      <div className="min-h-screen bg-white pt-40 pb-20 px-6 text-center" data-testid="event-error">
        <p className="text-[#0A0A0A]/55 mb-5">{err || "Événement introuvable"}</p>
        <Link to="/" className="text-[#B8922A] hover:underline text-sm">← Retour à l'accueil</Link>
      </div>
    );
  }

  // Single-day → redirect to the existing booking tunnel.
  if ((ev.event_kind || "single_day") !== "multi_day") {
    return <Navigate to={`/booking/special-event/${eventId}`} replace />;
  }

  // Multi-day → show programme as sub-offers.
  const today = ev.today;
  const programme = (ev.programme || [])
    .filter((p) => p?.date && p.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const seats = ev.seats_per_date || {};

  return (
    <div className="bg-white text-[#0A0A0A] min-h-screen" data-testid="event-detail-page">
      <section className="pt-32 md:pt-40 pb-10 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] mb-6"
            data-testid="event-back-home"
          >
            <ChevronLeft size={14} /> Retour aux pôles
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-start">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-[#B8922A] text-white text-[0.6rem] uppercase tracking-[0.32em] font-medium">
                <Sparkles size={11} /> Événement spécial
              </div>
              <h1 className="font-display-serif text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight leading-[1.05] mb-3">
                {ev.title}
              </h1>
              {ev.subtitle && (
                <p className="text-[#B8922A] text-base md:text-lg mb-5">{ev.subtitle}</p>
              )}
              <div className="gold-divider mb-6" />
              {ev.description && (
                <p className="text-base text-[#0A0A0A]/70 leading-relaxed max-w-xl">
                  {ev.description}
                </p>
              )}
              {(ev.start_date || ev.end_date) && (
                <div className="mt-7 text-[0.78rem] text-[#0A0A0A]/55 inline-flex items-center gap-2">
                  <Calendar size={13} className="text-[#B8922A]" />
                  Du {fmtDateFR(ev.start_date)} au {fmtDateFR(ev.end_date)}
                </div>
              )}
            </motion.div>

            {ev.image_url && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="relative aspect-[4/3] overflow-hidden bg-[#FAFAF7]"
              >
                <img src={ev.image_url} alt={ev.title} className="absolute inset-0 w-full h-full object-cover" />
              </motion.div>
            )}
          </div>
        </div>
      </section>

      <section className="pb-24 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-3">Programme</div>
          <h2 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] tracking-tight leading-tight mb-6">
            Choisissez votre journée
          </h2>
          <p className="text-sm text-[#0A0A0A]/55 max-w-2xl mb-10">
            Chaque date a son propre concept, sa capacité et son tarif. Vous pouvez réserver
            plusieurs journées indépendamment.
          </p>

          {programme.length === 0 ? (
            <div className="border border-dashed border-[#0A0A0A]/15 bg-[#FAFAF7] p-10 text-center text-[#0A0A0A]/55 text-sm" data-testid="programme-empty">
              Les détails du programme ne sont pas encore disponibles.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7" data-testid="programme-grid">
              {programme.map((day, idx) => {
                const seatsLeft = seats[day.date];
                const isFull = typeof seatsLeft === "number" && seatsLeft <= 0;
                const priceA = Number(day.price_adult ?? ev.price_adult ?? 0);
                const priceC = Number(day.price_child ?? ev.price_child ?? 0);
                return (
                  <motion.div
                    key={`${day.date}-${idx}`}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.55, delay: idx * 0.06 }}
                    className="border border-[#0A0A0A]/12 bg-white p-6 flex flex-col hover:border-[#B8922A] transition-colors"
                    data-testid={`programme-day-${day.date}`}
                  >
                    <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-2">
                      {fmtDateFR(day.date)}
                    </div>
                    <h3 className="font-display-serif text-xl md:text-2xl text-[#0A0A0A] mb-2 leading-tight">
                      {day.title || ev.title}
                    </h3>
                    {day.description && (
                      <p className="text-[0.85rem] text-[#0A0A0A]/65 leading-relaxed mb-4 line-clamp-4">
                        {day.description}
                      </p>
                    )}
                    <div className="space-y-1.5 mb-5 mt-auto">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-[#0A0A0A]/65">Adulte</span>
                        <span className="font-medium">{formatXOF(priceA)}</span>
                      </div>
                      {priceC > 0 && (
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-[#0A0A0A]/65">Enfant</span>
                          <span className="font-medium">{formatXOF(priceC)}</span>
                        </div>
                      )}
                      {typeof seatsLeft === "number" && (
                        <div className="flex items-baseline justify-between text-[0.72rem] pt-1">
                          <span className="text-[#0A0A0A]/45 inline-flex items-center gap-1.5">
                            <Users size={11} /> Places restantes
                          </span>
                          <span className={`font-medium ${seatsLeft <= 5 ? "text-[#B8922A]" : "text-[#0A0A0A]/60"}`}>
                            {seatsLeft}
                          </span>
                        </div>
                      )}
                    </div>
                    {isFull ? (
                      <div className="inline-flex items-center justify-center px-4 py-2.5 border border-red-200 text-red-700 text-[0.7rem] uppercase tracking-[0.22em]" data-testid={`day-soldout-${day.date}`}>
                        Complet
                      </div>
                    ) : (
                      <Link
                        to={`/booking/special-event/${eventId}?date=${encodeURIComponent(day.date)}`}
                        className="btn-gold inline-flex items-center justify-center gap-2 text-[0.7rem]"
                        data-testid={`day-reserve-${day.date}`}
                      >
                        Réserver cette date
                        <ArrowRight size={12} />
                      </Link>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

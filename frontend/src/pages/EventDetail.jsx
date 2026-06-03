import { useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Calendar, Users, ArrowRight, ChevronLeft, Check } from "lucide-react";
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
  const navigate = useNavigate();
  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    api.get(`/special-events/${eventId}`)
      .then(({ data }) => setEv(data?.event || null))
      .catch((e) => setErr(e.response?.data?.detail || "Événement introuvable"))
      .finally(() => setLoading(false));
  }, [eventId]);

  const toggleDate = (date) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const programme = useMemo(() => {
    if (!ev) return [];
    const today = ev.today || "";
    return (ev.programme || [])
      .filter((p) => p?.date && p.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [ev]);

  const selectedOrdered = useMemo(
    () => programme.filter((p) => selected.has(p.date)),
    [programme, selected]
  );

  const validateSelection = () => {
    if (selectedOrdered.length === 0) return;
    const dates = selectedOrdered.map((p) => p.date);
    // Single booking covering all selected dates. The booking tunnel reads
    // the comma-separated `dates` param, computes the cumulative total from
    // the event programme and skips the date-picking step.
    const qs = new URLSearchParams({
      date: dates[0],
      ...(dates.length > 1 ? { dates: dates.join(",") } : {}),
    }).toString();
    navigate(`/booking/special-event/${eventId}?${qs}`);
  };

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

  // Multi-day → show programme as sub-offers (with multi-selection).
  const today = ev.today;
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
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7" data-testid="programme-grid">
                {programme.map((day, idx) => {
                  const seatsLeft = seats[day.date];
                  const isFull = typeof seatsLeft === "number" && seatsLeft <= 0;
                  const isSelected = selected.has(day.date);
                  const priceA = Number(day.price_adult ?? ev.price_adult ?? 0);
                  const priceC = Number(day.price_child ?? ev.price_child ?? 0);
                  return (
                    <motion.div
                      key={`${day.date}-${idx}`}
                      initial={{ opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 0.55, delay: idx * 0.06 }}
                      className={`border bg-white p-6 flex flex-col transition-colors ${
                        isSelected
                          ? "border-[#B8922A] shadow-[0_0_0_2px_rgba(184,146,42,0.18)]"
                          : "border-[#0A0A0A]/12 hover:border-[#B8922A]"
                      }`}
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
                        <button
                          onClick={() => toggleDate(day.date)}
                          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] transition-colors border ${
                            isSelected
                              ? "bg-[#B8922A] text-white border-[#B8922A]"
                              : "bg-white text-[#0A0A0A] border-[#0A0A0A]/20 hover:border-[#B8922A] hover:text-[#B8922A]"
                          }`}
                          data-testid={`day-select-${day.date}`}
                          aria-pressed={isSelected}
                        >
                          {isSelected ? (
                            <>
                              <Check size={13} /> Sélectionnée
                            </>
                          ) : (
                            "Sélectionner cette date"
                          )}
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Sticky validation bar */}
              <div className="sticky bottom-0 mt-10 -mx-6 md:-mx-12 lg:-mx-20 bg-white/95 backdrop-blur-sm border-t border-[#0A0A0A]/10 px-6 md:px-12 lg:px-20 py-5" data-testid="event-validate-bar">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-6xl mx-auto">
                  <div className="text-sm text-[#0A0A0A]/70">
                    {selectedOrdered.length === 0 ? (
                      <span className="text-[#0A0A0A]/50">Sélectionnez au moins une date pour continuer.</span>
                    ) : (
                      <>
                        <span className="font-medium text-[#0A0A0A]">{selectedOrdered.length}</span>{" "}
                        date{selectedOrdered.length > 1 ? "s" : ""} sélectionnée{selectedOrdered.length > 1 ? "s" : ""}
                        {selectedOrdered.length > 1 && (
                          <span className="block text-[0.7rem] text-[#0A0A0A]/50 mt-0.5">
                            Vous validerez et paierez chaque date séparément, dans l'ordre choisi.
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    onClick={validateSelection}
                    disabled={selectedOrdered.length === 0}
                    className="btn-gold inline-flex items-center justify-center gap-2 text-[0.7rem] disabled:opacity-40 disabled:cursor-not-allowed"
                    data-testid="event-validate-cta"
                  >
                    Valider ma sélection
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

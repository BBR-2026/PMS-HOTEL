import { useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Calendar, Users, ArrowRight, ChevronLeft, Check, X, Info } from "lucide-react";
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
  // Package selections: { [date]: { [package_id]: {adults, children} } }
  const [packageSel, setPackageSel] = useState({});
  // Modal for "Voir le contenu" → shows {date, package} details
  const [modalPkg, setModalPkg] = useState(null);

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

  // Build flat array of package selections sent to backend
  const packageSelectionsArr = useMemo(() => {
    const out = [];
    for (const [date, byPkg] of Object.entries(packageSel)) {
      if (!selected.has(date)) continue;
      for (const [package_id, qty] of Object.entries(byPkg || {})) {
        const adults = Number(qty?.adults || 0);
        const children = Number(qty?.children || 0);
        if (adults > 0 || children > 0) {
          out.push({ date, package_id, adults, children });
        }
      }
    }
    return out;
  }, [packageSel, selected]);

  // Update a (date, package_id) quantity. Will be 0..pkg.max_persons enforced
  // at the input level; backend re-validates.
  const updatePkgQty = (date, pkgId, kind, value) => {
    setPackageSel((prev) => {
      const day = { ...(prev[date] || {}) };
      const cur = { adults: 0, children: 0, ...(day[pkgId] || {}) };
      day[pkgId] = { ...cur, [kind]: Math.max(0, Number(value) || 0) };
      return { ...prev, [date]: day };
    });
  };

  const validateSelection = () => {
    if (selectedOrdered.length === 0) return;
    const dates = selectedOrdered.map((p) => p.date);
    // Stash package selections in sessionStorage so BookingTunnel can read
    // them (URL would explode on multi-package selections).
    if (packageSelectionsArr.length > 0) {
      sessionStorage.setItem(
        `bbr_event_pkgs_${eventId}`,
        JSON.stringify(packageSelectionsArr),
      );
    } else {
      sessionStorage.removeItem(`bbr_event_pkgs_${eventId}`);
    }
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
              <div className="space-y-5 max-w-3xl" data-testid="programme-grid">
                {programme.map((day, idx) => {
                  const seatsLeft = seats[day.date];
                  const isFull = typeof seatsLeft === "number" && seatsLeft <= 0;
                  const isSelected = selected.has(day.date);
                  const priceA = Number(day.price_adult ?? ev.price_adult ?? 0);
                  const priceC = Number(day.price_child ?? ev.price_child ?? 0);
                  const dayPkgs = Array.isArray(day.packages) ? day.packages : [];
                  const dayPkgSel = packageSel[day.date] || {};
                  return (
                    <motion.div
                      key={`${day.date}-${idx}`}
                      initial={{ opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 0.55, delay: idx * 0.06 }}
                      className={`border bg-white p-5 sm:p-7 transition-colors ${
                        isSelected
                          ? "border-[#B8922A] shadow-[0_0_0_2px_rgba(184,146,42,0.18)]"
                          : "border-[#0A0A0A]/12 hover:border-[#B8922A]"
                      }`}
                      data-testid={`programme-day-${day.date}`}
                    >
                      <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-2">
                        {fmtDateFR(day.date)}
                      </div>
                      <h3 className="font-display-serif text-2xl md:text-3xl text-[#0A0A0A] mb-2 leading-tight">
                        {day.title || ev.title}
                      </h3>
                      {day.description && (
                        <p className="text-[0.9rem] text-[#0A0A0A]/65 leading-relaxed mb-4">
                          {day.description}
                        </p>
                      )}

                      {/* Base pricing line (always shown — default pass) */}
                      <div className="flex flex-wrap items-baseline justify-between gap-2 py-3 border-y border-[#0A0A0A]/8 text-sm">
                        <div>
                          <span className="text-[#0A0A0A]/65 mr-3">Adulte <span className="font-medium text-[#0A0A0A]">{formatXOF(priceA)}</span></span>
                          {priceC > 0 && (
                            <span className="text-[#0A0A0A]/65">Enfant <span className="font-medium text-[#0A0A0A]">{formatXOF(priceC)}</span></span>
                          )}
                        </div>
                        {typeof seatsLeft === "number" && (
                          <span className={`text-[0.7rem] ${seatsLeft <= 5 ? "text-[#B8922A]" : "text-[#0A0A0A]/55"}`}>
                            <Users size={11} className="inline mr-1" /> {seatsLeft} place{seatsLeft > 1 ? "s" : ""} dispo.
                          </span>
                        )}
                      </div>

                      {/* Premium packages list */}
                      {dayPkgs.length > 0 && (
                        <div className="mt-4 space-y-3" data-testid={`packages-${day.date}`}>
                          {dayPkgs.map((pkg) => {
                            const sel = dayPkgSel[pkg.id] || { adults: 0, children: 0 };
                            const persons = (sel.adults || 0) + (sel.children || 0);
                            const max = Number(pkg.max_persons) || 0;
                            const lineAmount = (sel.adults || 0) * Number(pkg.price_adult || 0)
                                              + (sel.children || 0) * Number(pkg.price_child || 0);
                            return (
                              <div key={pkg.id} className="border border-[#0A0A0A]/10 bg-[#FAFAF7] p-3 sm:p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-[#0A0A0A]">{pkg.label}</div>
                                    <div className="text-[0.75rem] text-[#0A0A0A]/55 mt-0.5">
                                      Adulte <span className="text-[#B8922A]">{formatXOF(pkg.price_adult || 0)}</span>
                                      {Number(pkg.price_child) > 0 && (
                                        <> · Enfant <span className="text-[#B8922A]">{formatXOF(pkg.price_child)}</span></>
                                      )}
                                      · max {pkg.max_persons} pers.
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setModalPkg({ day, pkg })}
                                    className="text-[0.62rem] uppercase tracking-[0.18em] text-[#B8922A] hover:underline inline-flex items-center gap-1"
                                    data-testid={`pkg-info-${day.date}-${pkg.id}`}
                                  >
                                    <Info size={11} /> Voir le contenu
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                  <label className="inline-flex items-center gap-2 text-[0.78rem] text-[#0A0A0A]/75">
                                    Adultes
                                    <input
                                      type="number" min={0} max={max}
                                      value={sel.adults || 0}
                                      onChange={(e) => updatePkgQty(day.date, pkg.id, "adults", e.target.value)}
                                      className="w-16 px-2 py-1 text-xs border border-[#0A0A0A]/15 bg-white focus:border-[#B8922A] outline-none"
                                      data-testid={`pkg-adults-${day.date}-${pkg.id}`}
                                    />
                                  </label>
                                  <label className="inline-flex items-center gap-2 text-[0.78rem] text-[#0A0A0A]/75">
                                    Enfants
                                    <input
                                      type="number" min={0} max={max}
                                      value={sel.children || 0}
                                      onChange={(e) => updatePkgQty(day.date, pkg.id, "children", e.target.value)}
                                      className="w-16 px-2 py-1 text-xs border border-[#0A0A0A]/15 bg-white focus:border-[#B8922A] outline-none"
                                      data-testid={`pkg-children-${day.date}-${pkg.id}`}
                                    />
                                  </label>
                                  {persons > 0 && (
                                    <span className={`text-[0.72rem] ml-auto font-medium ${persons > max ? "text-red-600" : "text-[#B8922A]"}`}>
                                      {persons > max
                                        ? `${persons} > max ${max}`
                                        : `${persons}/${max} · ${formatXOF(lineAmount)}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap gap-2">
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
                            {isSelected ? (<><Check size={13} /> Date sélectionnée</>) : ("Sélectionner cette date")}
                          </button>
                        )}
                      </div>
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

      {/* "Voir le contenu" modal */}
      <AnimatePresence>
        {modalPkg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4"
            onClick={() => setModalPkg(null)}
            data-testid="pkg-modal"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-lg max-h-[88vh] overflow-y-auto"
            >
              <div className="p-5 sm:p-7">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">
                      {fmtDateFR(modalPkg.day.date)}
                    </div>
                    <h3 className="font-display-serif text-2xl text-[#0A0A0A] break-words">{modalPkg.pkg.label}</h3>
                  </div>
                  <button
                    onClick={() => setModalPkg(null)}
                    className="p-1.5 text-[#0A0A0A]/55 hover:text-[#0A0A0A] flex-shrink-0"
                    data-testid="pkg-modal-close"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="gold-divider mb-4" />
                <p className="text-sm text-[#0A0A0A]/75 leading-relaxed whitespace-pre-line">
                  {modalPkg.pkg.description || "Aucune description détaillée pour ce package."}
                </p>
                <div className="mt-5 pt-5 border-t border-[#0A0A0A]/8 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/45">Adulte</div>
                    <div className="text-[#B8922A] font-medium mt-1">{formatXOF(modalPkg.pkg.price_adult || 0)}</div>
                  </div>
                  <div>
                    <div className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/45">Enfant</div>
                    <div className="text-[#B8922A] font-medium mt-1">{formatXOF(modalPkg.pkg.price_child || 0)}</div>
                  </div>
                  <div>
                    <div className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/45">Pers. max</div>
                    <div className="text-[#0A0A0A] font-medium mt-1">{modalPkg.pkg.max_persons}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

  const programme = useMemo(() => {
    if (!ev) return [];
    const today = ev.today || "";
    return (ev.programme || [])
      .filter((p) => p?.date && p.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [ev]);

  // Build flat array of package selections sent to backend
  const packageSelectionsArr = useMemo(() => {
    const out = [];
    for (const [date, byPkg] of Object.entries(packageSel)) {
      for (const [package_id, qty] of Object.entries(byPkg || {})) {
        const adults = Number(qty?.adults || 0);
        const children = Number(qty?.children || 0);
        if (adults > 0 || children > 0) {
          out.push({ date, package_id, adults, children });
        }
      }
    }
    return out;
  }, [packageSel]);

  // Auto-derived: a date is "selected" when it has at least one package with
  // persons ≥ 1. No more "Sélectionner cette date" button — clicking inside
  // a package is enough.
  const selectedDates = useMemo(() => {
    const set = new Set();
    for (const sel of packageSelectionsArr) set.add(sel.date);
    return set;
  }, [packageSelectionsArr]);

  const selectedOrdered = useMemo(
    () => programme.filter((p) => selectedDates.has(p.date)),
    [programme, selectedDates]
  );

  // Flat package total — each selected package is billed at its forfait price,
  // not multiplied by headcount. Headcount only fills the package's capacity.
  const eventTotal = useMemo(() => {
    if (!ev) return 0;
    const progByDate = {};
    for (const p of programme) progByDate[p.date] = p;
    let sum = 0;
    for (const sel of packageSelectionsArr) {
      const day = progByDate[sel.date] || {};
      const pkg = (day.packages || []).find((x) => x.id === sel.package_id);
      if (!pkg) continue;
      sum += Number(pkg.price_adult || pkg.price || 0);
    }
    return sum;
  }, [ev, programme, packageSelectionsArr]);

  // Update package counts. Keeps `persons = adults + children` invariant
  // when the caller passes the special kind="persons" — it adjusts adults
  // (children remain user-controlled, with auto-clamp on overflow).
  const updatePkgQty = (date, pkgId, kind, value, maxPersons) => {
    setPackageSel((prev) => {
      const day = { ...(prev[date] || {}) };
      const cur = { adults: 0, children: 0, ...(day[pkgId] || {}) };
      const val = Math.max(0, Number(value) || 0);
      let next = { ...cur };
      if (kind === "persons") {
        const clamped = Math.min(val, maxPersons || val);
        // Keep children as user set, fill the rest with adults.
        const children = Math.min(cur.children || 0, clamped);
        next = { adults: Math.max(0, clamped - children), children };
      } else if (kind === "children") {
        const total = (cur.adults || 0) + (cur.children || 0);
        const clamped = Math.min(val, total);
        next = { adults: Math.max(0, total - clamped), children: clamped };
      } else if (kind === "adults") {
        const total = (cur.adults || 0) + (cur.children || 0);
        const clamped = Math.min(val, total);
        next = { adults: clamped, children: Math.max(0, total - clamped) };
      }
      day[pkgId] = next;
      return { ...prev, [date]: day };
    });
  };

  const validateSelection = () => {
    if (selectedOrdered.length === 0) return;
    const dates = selectedOrdered.map((p) => p.date);
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
                  const isSelected = selectedDates.has(day.date);
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
                      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                        <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A]">
                          {fmtDateFR(day.date)}
                        </div>
                        {typeof seatsLeft === "number" && (
                          <span className={`text-[0.7rem] ${seatsLeft <= 5 ? "text-[#B8922A]" : "text-[#0A0A0A]/55"}`}>
                            <Users size={11} className="inline mr-1" /> {seatsLeft} place{seatsLeft > 1 ? "s" : ""} dispo.
                          </span>
                        )}
                      </div>
                      <h3 className="font-display-serif text-2xl md:text-3xl text-[#0A0A0A] mb-2 leading-tight">
                        {day.title || ev.title}
                      </h3>
                      {day.description && (
                        <p className="text-[0.9rem] text-[#0A0A0A]/65 leading-relaxed mb-4">
                          {day.description}
                        </p>
                      )}

                      {/* Sold-out badge (no clickable interactions if full) */}
                      {isFull && (
                        <div className="inline-flex items-center justify-center px-4 py-2.5 border border-red-200 text-red-700 text-[0.7rem] uppercase tracking-[0.22em]" data-testid={`day-soldout-${day.date}`}>
                          Complet
                        </div>
                      )}

                      {/* Premium packages — selecting any one auto-marks the date */}
                      {!isFull && dayPkgs.length > 0 && (
                        <div className="mt-4 space-y-3" data-testid={`packages-${day.date}`}>
                          {dayPkgs.map((pkg) => {
                            const sel = dayPkgSel[pkg.id] || { adults: 0, children: 0 };
                            const persons = (sel.adults || 0) + (sel.children || 0);
                            const max = Number(pkg.max_persons) || 0;
                            const flatPrice = Number(pkg.price_adult || pkg.price || 0);
                            const lineAmount = persons > 0 ? flatPrice : 0;
                            const pkgActive = persons > 0;
                            const togglePackage = () => {
                              // Click on a non-active package → take the whole capacity (max)
                              // with adults = max, children = 0 (user can split next).
                              // Click on an active package → release (set both to 0).
                              if (pkgActive) {
                                updatePkgQty(day.date, pkg.id, "persons", 0, max);
                              } else {
                                updatePkgQty(day.date, pkg.id, "persons", Math.max(1, max), max);
                              }
                            };
                            return (
                              <div
                                key={pkg.id}
                                className={`border transition-colors ${
                                  pkgActive
                                    ? "border-[#B8922A] bg-[#FBF6E9]"
                                    : "border-[#0A0A0A]/10 bg-[#FAFAF7] hover:border-[#B8922A]"
                                }`}
                                data-testid={`pkg-card-${day.date}-${pkg.id}`}
                              >
                                {/* Clickable header — selects/deselects the package */}
                                <button
                                  type="button"
                                  onClick={togglePackage}
                                  className="w-full text-left p-3 sm:p-4 flex flex-wrap items-start justify-between gap-2"
                                  data-testid={`pkg-toggle-${day.date}-${pkg.id}`}
                                  aria-pressed={pkgActive}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 font-medium text-[#0A0A0A]">
                                      <span className={`w-4 h-4 inline-flex items-center justify-center border ${
                                        pkgActive ? "bg-[#B8922A] border-[#B8922A] text-white" : "border-[#0A0A0A]/30 bg-white"
                                      }`}>
                                        {pkgActive && <Check size={11} />}
                                      </span>
                                      {pkg.label}
                                    </div>
                                    <div className="text-[0.75rem] text-[#0A0A0A]/55 mt-0.5 ml-6">
                                      <span className="text-[#B8922A] font-medium">{formatXOF(flatPrice)}</span>
                                      <span> · forfait · max {pkg.max_persons} pers.</span>
                                    </div>
                                  </div>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); setModalPkg({ day, pkg }); }}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setModalPkg({ day, pkg }); } }}
                                    className="text-[0.62rem] uppercase tracking-[0.18em] text-[#B8922A] hover:underline inline-flex items-center gap-1 cursor-pointer"
                                    data-testid={`pkg-info-${day.date}-${pkg.id}`}
                                  >
                                    <Info size={11} /> Voir le contenu
                                  </span>
                                </button>

                                {/* Persons + Adult/Children split — visible only when selected */}
                                {pkgActive && (
                                  <div className="px-3 sm:px-4 pb-4 pt-1 border-t border-[#B8922A]/20 space-y-3" data-testid={`pkg-counts-${day.date}-${pkg.id}`}>
                                    <div className="flex flex-wrap items-center gap-3">
                                      <label className="inline-flex items-center gap-2 text-[0.78rem] text-[#0A0A0A]/80 font-medium">
                                        Nombre de personnes
                                        <input
                                          type="number" min={1} max={max}
                                          value={persons}
                                          onChange={(e) => updatePkgQty(day.date, pkg.id, "persons", e.target.value, max)}
                                          className="w-16 px-2 py-1 text-sm border border-[#B8922A]/40 bg-white focus:border-[#B8922A] outline-none text-center"
                                          data-testid={`pkg-persons-${day.date}-${pkg.id}`}
                                        />
                                        <span className="text-[0.7rem] text-[#0A0A0A]/55">/ {max}</span>
                                      </label>
                                      <span className="ml-auto text-[0.78rem] font-medium text-[#B8922A]">
                                        {formatXOF(lineAmount)}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#B8922A]/15">
                                      <label className="inline-flex items-center gap-2 text-[0.74rem] text-[#0A0A0A]/70">
                                        Dont adultes
                                        <input
                                          type="number" min={0} max={persons}
                                          value={sel.adults || 0}
                                          onChange={(e) => updatePkgQty(day.date, pkg.id, "adults", e.target.value, max)}
                                          className="w-14 px-2 py-1 text-xs border border-[#0A0A0A]/15 bg-white focus:border-[#B8922A] outline-none text-center"
                                          data-testid={`pkg-adults-${day.date}-${pkg.id}`}
                                        />
                                      </label>
                                      <label className="inline-flex items-center gap-2 text-[0.74rem] text-[#0A0A0A]/70">
                                        Dont enfants
                                        <input
                                          type="number" min={0} max={persons}
                                          value={sel.children || 0}
                                          onChange={(e) => updatePkgQty(day.date, pkg.id, "children", e.target.value, max)}
                                          className="w-14 px-2 py-1 text-xs border border-[#0A0A0A]/15 bg-white focus:border-[#B8922A] outline-none text-center"
                                          data-testid={`pkg-children-${day.date}-${pkg.id}`}
                                        />
                                      </label>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* No packages configured: fall back to a single "Réserver cette date" CTA. */}
                      {!isFull && dayPkgs.length === 0 && (
                        <div className="mt-5">
                          <Link
                            to={`/booking/special-event/${eventId}?date=${day.date}`}
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] bg-white text-[#0A0A0A] border border-[#0A0A0A]/20 hover:border-[#B8922A] hover:text-[#B8922A] transition-colors"
                            data-testid={`day-quick-book-${day.date}`}
                          >
                            Réserver cette date
                          </Link>
                        </div>
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
                      <span className="text-[#0A0A0A]/50">Sélectionnez au moins une offre pour continuer.</span>
                    ) : (
                      <>
                        <span className="font-medium text-[#0A0A0A]">{selectedOrdered.length}</span>{" "}
                        date{selectedOrdered.length > 1 ? "s" : ""} ·{" "}
                        <span className="font-medium text-[#0A0A0A]">{packageSelectionsArr.length}</span>{" "}
                        forfait{packageSelectionsArr.length > 1 ? "s" : ""} ·{" "}
                        <span className="text-[#B8922A] font-medium" data-testid="event-total">{formatXOF(eventTotal)}</span>
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
                <div className="mt-5 pt-5 border-t border-[#0A0A0A]/8 grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/45">Forfait</div>
                    <div className="text-[#B8922A] font-medium mt-1">{formatXOF(modalPkg.pkg.price_adult || modalPkg.pkg.price || 0)}</div>
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

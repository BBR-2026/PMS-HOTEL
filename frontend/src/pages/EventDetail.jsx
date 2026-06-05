import { useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Calendar, Users, ArrowRight, ChevronLeft, ChevronRight,
  Check, X, Info, Trophy, Plus,
} from "lucide-react";
import api from "../lib/api";
import { formatXOF } from "../lib/i18n";

function fmtDateFR(iso) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return `${parseInt(m[3], 10)} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
}
function dayOfWeekFR(iso) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][d.getDay()];
}

/**
 * Public detail page for a special event — 2-step navigation:
 *   STEP 1  (viewMode = "days")  →  big list of bookable days
 *   STEP 2  (viewMode = "day")    →  dedicated view for the picked day, with
 *                                    matches modal + packages + 2 CTAs at
 *                                    the bottom ("Réserver une autre date"
 *                                    and "Valider la sélection").
 * Selections persist across step transitions so customers can stack
 * forfaits from multiple days into a single booking.
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
  // Matches calendar modal — shown as soon as the user lands on a day
  // with non-empty matches. Closed via X or "Découvrir les forfaits" CTA.
  const [matchesOpen, setMatchesOpen] = useState(false);
  // Day-detail step: which date the user is currently viewing. Null = days list.
  const [activeDate, setActiveDate] = useState(null);

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

  const activeDay = useMemo(
    () => programme.find((p) => p.date === activeDate) || null,
    [programme, activeDate]
  );

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

  const selectedDates = useMemo(() => {
    const set = new Set();
    for (const sel of packageSelectionsArr) set.add(sel.date);
    return set;
  }, [packageSelectionsArr]);

  const selectedOrdered = useMemo(
    () => programme.filter((p) => selectedDates.has(p.date)),
    [programme, selectedDates]
  );

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

  // Auto-open matches modal when entering a day that carries one.
  useEffect(() => {
    if (activeDay && Array.isArray(activeDay.matches) && activeDay.matches.length > 0) {
      setMatchesOpen(true);
    } else {
      setMatchesOpen(false);
    }
  }, [activeDay]);

  // Reset scroll when switching between days list and day detail.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeDate]);

  const updatePkgQty = (date, pkgId, kind, value, maxPersons) => {
    setPackageSel((prev) => {
      const day = { ...(prev[date] || {}) };
      const cur = { adults: 0, children: 0, ...(day[pkgId] || {}) };
      const val = Math.max(0, Number(value) || 0);
      let next = { ...cur };
      if (kind === "persons") {
        const clamped = Math.min(val, maxPersons || val);
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

  if ((ev.event_kind || "single_day") !== "multi_day") {
    return <Navigate to={`/booking/special-event/${eventId}`} replace />;
  }

  const seats = ev.seats_per_date || {};

  // ---------------- STEP 2 : Day-detail view ----------------
  if (activeDay) {
    const seatsLeft = seats[activeDay.date];
    const isFull = typeof seatsLeft === "number" && seatsLeft <= 0;
    const dayPkgs = Array.isArray(activeDay.packages) ? activeDay.packages : [];
    const dayPkgSel = packageSel[activeDay.date] || {};
    const daySelectedCount = Object.values(dayPkgSel).filter(
      (q) => (q?.adults || 0) + (q?.children || 0) > 0,
    ).length;
    const hasMatches = Array.isArray(activeDay.matches) && activeDay.matches.length > 0;

    return (
      <div className="bg-white text-[#0A0A0A] min-h-screen" data-testid="day-detail-view">
        <section className="pt-28 sm:pt-32 md:pt-36 pb-8 px-5 sm:px-8 md:px-12 lg:px-20">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setActiveDate(null)}
              className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] mb-6"
              data-testid="day-back-btn"
            >
              <ChevronLeft size={14} /> Retour aux journées
            </button>

            <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2">
              {dayOfWeekFR(activeDay.date)} · {fmtDateFR(activeDay.date)}
            </div>
            <h1 className="font-display-serif text-3xl sm:text-4xl md:text-5xl text-[#0A0A0A] tracking-tight leading-[1.05] mb-3 break-words">
              {activeDay.title || ev.title}
            </h1>
            <div className="gold-divider mb-5" />
            {activeDay.description && (
              <p className="text-[0.95rem] sm:text-base text-[#0A0A0A]/70 leading-relaxed max-w-2xl">
                {activeDay.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-5">
              {typeof seatsLeft === "number" && (
                <span className={`text-[0.72rem] inline-flex items-center gap-1 ${seatsLeft <= 5 ? "text-[#B8922A]" : "text-[#0A0A0A]/55"}`}>
                  <Users size={12} /> {seatsLeft} place{seatsLeft > 1 ? "s" : ""} dispo.
                </span>
              )}
              {hasMatches && (
                <button
                  onClick={() => setMatchesOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#B8922A]/40 bg-[#FBF8EF] text-[#B8922A] text-[0.68rem] uppercase tracking-[0.18em] hover:bg-[#B8922A] hover:text-white transition-colors"
                  data-testid="open-matches-modal"
                >
                  <Trophy size={11} /> Voir les matchs du jour ({activeDay.matches.length})
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="px-5 sm:px-8 md:px-12 lg:px-20 pb-32">
          <div className="max-w-4xl mx-auto">
            <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-3">
              Forfaits disponibles
            </div>
            <h2 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A] tracking-tight mb-6">
              Choisissez votre forfait
            </h2>

            {isFull && (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm mb-5" data-testid="day-soldout">
                Cette journée est complète.
              </div>
            )}

            {!isFull && dayPkgs.length === 0 && (
              <div className="border border-dashed border-[#0A0A0A]/15 bg-[#FAFAF7] p-8 text-center text-[#0A0A0A]/55 text-sm">
                Aucun forfait premium configuré pour cette journée.
                <div className="mt-4">
                  <Link
                    to={`/booking/special-event/${eventId}?date=${activeDay.date}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] bg-[#B8922A] text-white hover:bg-[#9d7a23] transition-colors"
                    data-testid={`day-quick-book-${activeDay.date}`}
                  >
                    Réserver cette journée <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            {!isFull && dayPkgs.length > 0 && (
              <div className="space-y-3 sm:space-y-4" data-testid={`packages-${activeDay.date}`}>
                {dayPkgs.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    sel={dayPkgSel[pkg.id] || { adults: 0, children: 0 }}
                    onToggle={(persons) => updatePkgQty(activeDay.date, pkg.id, "persons", persons, pkg.max_persons)}
                    onChangePersons={(n) => updatePkgQty(activeDay.date, pkg.id, "persons", n, pkg.max_persons)}
                    onChangeAdults={(n) => updatePkgQty(activeDay.date, pkg.id, "adults", n, pkg.max_persons)}
                    onChangeChildren={(n) => updatePkgQty(activeDay.date, pkg.id, "children", n, pkg.max_persons)}
                    onShowInfo={() => setModalPkg({ day: activeDay, pkg })}
                    testidPrefix={`${activeDay.date}-${pkg.id}`}
                  />
                ))}
              </div>
            )}

            {/* Two-button footer requested by the user */}
            <div className="sticky bottom-0 mt-10 -mx-5 sm:-mx-8 md:-mx-12 lg:-mx-20 bg-white/95 backdrop-blur-sm border-t border-[#0A0A0A]/10 px-5 sm:px-8 md:px-12 lg:px-20 py-4 sm:py-5" data-testid="day-bottom-bar">
              <div className="max-w-4xl mx-auto">
                <div className="text-[0.78rem] text-[#0A0A0A]/65 mb-3 sm:mb-4 text-center">
                  {daySelectedCount > 0
                    ? <><span className="text-[#0A0A0A] font-medium">{daySelectedCount}</span> forfait{daySelectedCount > 1 ? "s" : ""} sur cette journée · Total : <span className="text-[#B8922A] font-medium">{formatXOF(eventTotal)}</span></>
                    : <span>Aucun forfait sélectionné pour cette journée.</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <button
                    onClick={() => setActiveDate(null)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 text-[0.7rem] uppercase tracking-[0.22em] bg-white text-[#0A0A0A] border border-[#0A0A0A]/20 hover:border-[#B8922A] hover:text-[#B8922A] transition-colors"
                    data-testid="day-book-another-cta"
                  >
                    <Plus size={13} /> Réserver une autre date
                  </button>
                  <button
                    onClick={validateSelection}
                    disabled={selectedOrdered.length === 0}
                    className="btn-gold inline-flex items-center justify-center gap-2 text-[0.7rem] disabled:opacity-40 disabled:cursor-not-allowed"
                    data-testid="day-validate-cta"
                  >
                    Valider la sélection <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Matches calendar modal */}
        <MatchesModal
          open={matchesOpen}
          onClose={() => setMatchesOpen(false)}
          day={activeDay}
        />

        {/* Package details modal */}
        <PackageInfoModal modalPkg={modalPkg} onClose={() => setModalPkg(null)} />
      </div>
    );
  }

  // ---------------- STEP 1 : Days list ----------------
  return (
    <div className="bg-white text-[#0A0A0A] min-h-screen" data-testid="event-detail-page">
      <section className="pt-28 sm:pt-32 md:pt-40 pb-10 px-5 sm:px-8 md:px-12 lg:px-20">
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
              <h1 className="font-display-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight leading-[1.05] mb-3 break-words">
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

      {/* Days list */}
      <section className="pb-24 px-5 sm:px-8 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-3">Programme</div>
          <h2 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] tracking-tight leading-tight mb-4">
            Choisissez votre journée
          </h2>
          <p className="text-sm text-[#0A0A0A]/55 max-w-2xl mb-8 sm:mb-10">
            Cliquez sur une date pour découvrir son programme, les matchs diffusés et
            les forfaits disponibles. Vous pourrez ensuite ajouter d'autres dates à
            votre sélection avant de finaliser votre réservation.
          </p>

          {programme.length === 0 ? (
            <div className="border border-dashed border-[#0A0A0A]/15 bg-[#FAFAF7] p-10 text-center text-[#0A0A0A]/55 text-sm" data-testid="programme-empty">
              Les détails du programme ne sont pas encore disponibles.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" data-testid="days-grid">
              {programme.map((day, idx) => {
                const seatsLeft = seats[day.date];
                const isFull = typeof seatsLeft === "number" && seatsLeft <= 0;
                const isSelected = selectedDates.has(day.date);
                const matchCount = (day.matches || []).length;
                return (
                  <motion.button
                    key={`${day.date}-${idx}`}
                    type="button"
                    onClick={() => !isFull && setActiveDate(day.date)}
                    disabled={isFull}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.45, delay: idx * 0.05 }}
                    className={`text-left bg-white border p-5 sm:p-6 transition-all relative ${
                      isFull
                        ? "border-[#0A0A0A]/10 opacity-55 cursor-not-allowed"
                        : isSelected
                          ? "border-[#B8922A] shadow-[0_0_0_2px_rgba(184,146,42,0.18)] hover:shadow-[0_0_0_3px_rgba(184,146,42,0.25)]"
                          : "border-[#0A0A0A]/12 hover:border-[#B8922A] hover:shadow-md"
                    }`}
                    data-testid={`day-card-${day.date}`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 bg-[#B8922A] text-white text-[0.55rem] uppercase tracking-[0.2em]">
                        <Check size={10} /> Choisi
                      </div>
                    )}
                    <div className="text-[0.6rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1.5">
                      {dayOfWeekFR(day.date)}
                    </div>
                    <div className="font-display-serif text-3xl sm:text-4xl text-[#0A0A0A] leading-none mb-2">
                      {fmtDateFR(day.date).split(" ").slice(0, 2).join(" ")}
                    </div>
                    <div className="text-[0.7rem] text-[#0A0A0A]/45 mb-4">
                      {fmtDateFR(day.date).split(" ").slice(-1)[0]}
                    </div>
                    <h3 className="font-medium text-[#0A0A0A] text-base sm:text-lg leading-tight mb-2 line-clamp-2 break-words">
                      {day.title || ev.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-[#0A0A0A]/55 mt-3">
                      {typeof seatsLeft === "number" && (
                        <span className={`inline-flex items-center gap-1 ${seatsLeft <= 5 && !isFull ? "text-[#B8922A]" : ""}`}>
                          <Users size={11} /> {isFull ? "Complet" : `${seatsLeft} place${seatsLeft > 1 ? "s" : ""}`}
                        </span>
                      )}
                      {matchCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Trophy size={11} /> {matchCount} match{matchCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {!isFull && (
                      <div className="mt-4 inline-flex items-center gap-1.5 text-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em]">
                        Voir la journée <ChevronRight size={12} />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Light validate bar visible when packages are already selected on other days */}
          {packageSelectionsArr.length > 0 && (
            <div className="sticky bottom-0 mt-8 -mx-5 sm:-mx-8 md:-mx-12 lg:-mx-20 bg-white/95 backdrop-blur-sm border-t border-[#0A0A0A]/10 px-5 sm:px-8 md:px-12 lg:px-20 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-5xl mx-auto">
                <div className="text-sm text-[#0A0A0A]/70">
                  <span className="font-medium text-[#0A0A0A]">{selectedOrdered.length}</span>{" "}
                  date{selectedOrdered.length > 1 ? "s" : ""} ·{" "}
                  <span className="font-medium text-[#0A0A0A]">{packageSelectionsArr.length}</span>{" "}
                  forfait{packageSelectionsArr.length > 1 ? "s" : ""} ·{" "}
                  <span className="text-[#B8922A] font-medium" data-testid="event-total">{formatXOF(eventTotal)}</span>
                </div>
                <button
                  onClick={validateSelection}
                  className="btn-gold inline-flex items-center justify-center gap-2 text-[0.7rem]"
                  data-testid="event-validate-cta"
                >
                  Valider ma sélection <ArrowRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <PackageInfoModal modalPkg={modalPkg} onClose={() => setModalPkg(null)} />
    </div>
  );
}


// ---------------- Sub-components ----------------

function PackageCard({ pkg, sel, onToggle, onChangePersons, onChangeAdults, onChangeChildren, onShowInfo, testidPrefix }) {
  const persons = (sel.adults || 0) + (sel.children || 0);
  const max = Number(pkg.max_persons) || 0;
  const flatPrice = Number(pkg.price_adult || pkg.price || 0);
  const remaining = typeof pkg.remaining === "number" ? pkg.remaining : null;
  const outOfStock = remaining !== null && remaining <= 0 && persons === 0;
  const pkgActive = persons > 0;

  return (
    <div
      className={`border transition-colors ${
        pkgActive
          ? "border-[#B8922A] bg-[#FBF6E9]"
          : outOfStock
            ? "border-[#0A0A0A]/8 bg-[#FAFAF7] opacity-60"
            : "border-[#0A0A0A]/10 bg-[#FAFAF7] hover:border-[#B8922A]"
      }`}
      data-testid={`pkg-card-${testidPrefix}`}
    >
      {/* Clickable header — selects/deselects */}
      <button
        type="button"
        disabled={outOfStock}
        onClick={() => onToggle(pkgActive ? 0 : Math.max(1, max))}
        className="w-full text-left p-3 sm:p-4 flex flex-col gap-2 disabled:cursor-not-allowed"
        data-testid={`pkg-toggle-${testidPrefix}`}
        aria-pressed={pkgActive}
      >
        {/* Title row — single line, truncated on mobile */}
        <div className="flex items-center gap-2 w-full min-w-0">
          <span className={`w-4 h-4 flex-shrink-0 inline-flex items-center justify-center border ${
            pkgActive ? "bg-[#B8922A] border-[#B8922A] text-white" : "border-[#0A0A0A]/30 bg-white"
          }`}>
            {pkgActive && <Check size={11} />}
          </span>
          <span className="font-medium text-[#0A0A0A] text-[0.95rem] sm:text-base truncate flex-1 min-w-0" title={pkg.label}>
            {pkg.label}
          </span>
        </div>
        {/* Info row */}
        <div className="ml-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.74rem] text-[#0A0A0A]/65">
          <span className="text-[#B8922A] font-medium">{formatXOF(flatPrice)}</span>
          <span className="text-[#0A0A0A]/45">·</span>
          <span>Forfait jusqu'à {pkg.max_persons} pers.</span>
          {remaining !== null && (
            <>
              <span className="text-[#0A0A0A]/45">·</span>
              <span className={remaining <= 2 ? "text-[#B8922A] font-medium" : ""}>
                {outOfStock ? "Épuisé" : `${remaining} disponible${remaining > 1 ? "s" : ""}`}
              </span>
            </>
          )}
        </div>
        {/* "Voir le contenu" below info — full-width tappable area on mobile */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onShowInfo(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onShowInfo(); } }}
          className="ml-6 mt-1 self-start text-[0.62rem] uppercase tracking-[0.18em] text-[#B8922A] hover:underline inline-flex items-center gap-1 cursor-pointer"
          data-testid={`pkg-info-${testidPrefix}`}
        >
          <Info size={11} /> Voir le contenu
        </span>
      </button>

      {pkgActive && (
        <div className="px-3 sm:px-4 pb-4 pt-1 border-t border-[#B8922A]/20 space-y-3" data-testid={`pkg-counts-${testidPrefix}`}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-[0.78rem] text-[#0A0A0A]/80 font-medium">
              Nombre de personnes
              <input
                type="number" min={1} max={max}
                value={persons}
                onChange={(e) => onChangePersons(e.target.value)}
                className="w-16 px-2 py-1 text-sm border border-[#B8922A]/40 bg-white focus:border-[#B8922A] outline-none text-center"
                data-testid={`pkg-persons-${testidPrefix}`}
              />
              <span className="text-[0.7rem] text-[#0A0A0A]/55">/ {max}</span>
            </label>
            <span className="ml-auto text-[0.78rem] font-medium text-[#B8922A]">
              {formatXOF(flatPrice)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#B8922A]/15">
            <label className="inline-flex items-center gap-2 text-[0.74rem] text-[#0A0A0A]/70">
              Dont adultes
              <input
                type="number" min={0} max={persons}
                value={sel.adults || 0}
                onChange={(e) => onChangeAdults(e.target.value)}
                className="w-14 px-2 py-1 text-xs border border-[#0A0A0A]/15 bg-white focus:border-[#B8922A] outline-none text-center"
                data-testid={`pkg-adults-${testidPrefix}`}
              />
            </label>
            <label className="inline-flex items-center gap-2 text-[0.74rem] text-[#0A0A0A]/70">
              Dont enfants
              <input
                type="number" min={0} max={persons}
                value={sel.children || 0}
                onChange={(e) => onChangeChildren(e.target.value)}
                className="w-14 px-2 py-1 text-xs border border-[#0A0A0A]/15 bg-white focus:border-[#B8922A] outline-none text-center"
                data-testid={`pkg-children-${testidPrefix}`}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}


function MatchesModal({ open, onClose, day }) {
  const matches = day?.matches || [];
  return (
    <AnimatePresence>
      {open && matches.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={onClose}
          data-testid="matches-modal"
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-xl max-h-[85vh] overflow-y-auto sm:rounded-none"
          >
            <div className="sticky top-0 bg-white border-b border-[#0A0A0A]/10 px-5 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[0.6rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1 inline-flex items-center gap-1">
                  <Trophy size={11} /> Calendrier du jour
                </div>
                <h3 className="font-display-serif text-xl sm:text-2xl text-[#0A0A0A] truncate">
                  {fmtDateFR(day.date)}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-[#0A0A0A]/55 hover:text-[#0A0A0A] flex-shrink-0"
                data-testid="matches-modal-close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-3" data-testid="matches-list">
              {matches.map((m, i) => (
                <div
                  key={i}
                  className="border border-[#0A0A0A]/10 bg-[#FAFAF7] p-4 sm:p-5"
                  data-testid={`match-row-${i}`}
                >
                  {m.stage && (
                    <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-2">
                      {m.stage}
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="text-right">
                      <div className="font-medium text-[#0A0A0A] text-sm sm:text-base">{m.team_home}</div>
                    </div>
                    <div className="flex flex-col items-center px-2 sm:px-4">
                      {m.flag_home && <span className="text-2xl mb-1">{m.flag_home}</span>}
                      <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45 mb-0.5">vs</div>
                      <div className="text-[#B8922A] font-medium text-sm">{m.time}</div>
                      {m.flag_away && <span className="text-2xl mt-1">{m.flag_away}</span>}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-[#0A0A0A] text-sm sm:text-base">{m.team_away}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-[#0A0A0A]/10 p-4">
              <button
                onClick={onClose}
                className="btn-gold w-full inline-flex items-center justify-center gap-2 text-[0.7rem]"
                data-testid="matches-modal-cta"
              >
                Découvrir les forfaits <ArrowRight size={12} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


function PackageInfoModal({ modalPkg, onClose }) {
  return (
    <AnimatePresence>
      {modalPkg && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4"
          onClick={onClose}
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
                  onClick={onClose}
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
  );
}

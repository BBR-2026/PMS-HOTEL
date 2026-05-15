import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { BedDouble, ChevronLeft, ChevronRight, LogIn, LogOut, FileDown, TrendingUp, Key, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getStaffToken } from "../../lib/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

const TIER_COLORS = {
  superieure: "#B8922A",
  suite: "#16A34A",
};

const TIER_LABEL = {
  superieure: "Chambre Supérieure",
  suite: "Suite",
};

const ROOM_STATUS_LABEL = {
  available: { fr: "Disponible", cls: "bg-emerald-50 border-emerald-300 text-emerald-700" },
  occupied: { fr: "Occupée", cls: "bg-rose-50 border-rose-300 text-rose-700" },
  arriving_today: { fr: "Arrive aujourd'hui", cls: "bg-amber-50 border-amber-300 text-amber-800" },
  departing_today: { fr: "Départ aujourd'hui", cls: "bg-sky-50 border-sky-300 text-sky-700" },
};

const PERIODS = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "year", label: "Année" },
  { id: "all", label: "Total" },
];

const fmtXOF = (n) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n || 0))} FCFA`;

function ymOf(d) {
  return d.toISOString().slice(0, 7);
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return ymOf(d);
}

export default function StaffHebergement() {
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(today);
  const [calendar, setCalendar] = useState(null);
  const [today_, setToday_] = useState(null);
  const [occupancy, setOccupancy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsPeriod, setStatsPeriod] = useState("month");
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [assigningFor, setAssigningFor] = useState(null); // booking object

  const refreshOccupancy = (day) =>
    api.get(`/staff/hebergement/occupancy?date=${day || selectedDay}`)
      .then((r) => setOccupancy(r.data))
      .catch(() => setOccupancy(null));

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/staff/hebergement/calendar?month=${month}`),
      api.get(`/staff/hebergement/today?date=${selectedDay}`),
      api.get(`/staff/hebergement/occupancy?date=${selectedDay}`),
    ])
      .then(([cal, tdy, occ]) => {
        setCalendar(cal.data);
        setToday_(tdy.data);
        setOccupancy(occ.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, selectedDay]);

  useEffect(() => {
    setStatsLoading(true);
    api
      .get(`/staff/hebergement/stats?period=${statsPeriod}`)
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [statsPeriod]);

  const downloadPdf = async () => {
    const token = getStaffToken();
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/staff/hebergement/report.pdf?period=${statsPeriod}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bbr-hebergement-${statsPeriod}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const daysGrid = useMemo(() => {
    if (!calendar) return [];
    return calendar.days || [];
  }, [calendar]);

  const monthLabel = format(new Date(month + "-01T12:00:00"), "MMMM yyyy", { locale: frLocale });

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-hebergement">
      <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A] mb-2">Hébergement</h1>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">Calendrier d'occupation et arrivées / départs du jour.</p>

      {/* Month navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]" data-testid="month-prev">
            <ChevronLeft size={14} />
          </button>
          <div className="font-display-serif text-lg sm:text-xl text-[#0A0A0A] capitalize min-w-[140px] sm:min-w-[180px] text-center">{monthLabel}</div>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]" data-testid="month-next">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[0.6rem] sm:text-[0.65rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ background: TIER_COLORS.superieure }}></span> Supérieure</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ background: TIER_COLORS.suite }}></span> Suite</span>
          <span className="flex items-center gap-1.5 text-red-700"><span className="w-2.5 h-2.5 bg-red-500"></span> Surbookée</span>
        </div>
      </div>

      {/* Overbooking summary banner */}
      {calendar?.days?.some((d) => d.is_overbooked) && (
        <div className="mb-4 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800" data-testid="overbooking-banner">
          ⚠️ Certaines nuits dépassent la capacité disponible
          {(() => {
            const overDays = calendar.days.filter((d) => d.is_overbooked).map((d) => d.date);
            return overDays.length > 0 && (
              <span className="block text-[0.72rem] mt-0.5 text-red-700/80">Dates concernées : {overDays.join(", ")}</span>
            );
          })()}
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white border border-[#0A0A0A]/8 p-3 sm:p-5 mb-8 overflow-x-auto" data-testid="hebergement-calendar">
        {loading && !calendar ? (
          <div className="text-sm text-[#0A0A0A]/50">Chargement…</div>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 min-w-[420px]">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="text-[0.55rem] sm:text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 text-center py-2">{d}</div>
            ))}
            {(() => {
              if (daysGrid.length === 0) return null;
              const firstDay = new Date(daysGrid[0].date + "T12:00:00");
              const dow = (firstDay.getDay() + 6) % 7;
              const blanks = Array.from({ length: dow });
              return [
                ...blanks.map((_, i) => <div key={`b${i}`} />),
                ...daysGrid.map((d) => {
                  const isSelected = d.date === selectedDay;
                  const isToday = d.date === today;
                  const over = d.is_overbooked;
                  return (
                    <button
                      key={d.date}
                      onClick={() => setSelectedDay(d.date)}
                      className={`relative aspect-square border p-1.5 sm:p-2 text-left transition-all ${
                        over
                          ? "border-red-500 bg-red-50 ring-1 ring-red-500"
                          : isSelected
                          ? "border-[#B8922A] bg-[#B8922A]/5 ring-1 ring-[#B8922A]"
                          : isToday
                          ? "border-[#B8922A]/40 bg-[#B8922A]/[0.02]"
                          : "border-[#0A0A0A]/10 hover:border-[#B8922A]/40"
                      }`}
                      data-testid={`heb-day-${d.date}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] sm:text-xs font-medium text-[#0A0A0A]">{parseInt(d.date.slice(-2))}</div>
                        {d.total_rooms > 0 && (
                          <div className={`text-[9px] sm:text-[0.55rem] font-medium ${over ? "text-red-700" : "text-[#B8922A]"}`}>
                            {d.total_rooms}/{d.total_inventory || ""}
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-1 sm:bottom-1.5 left-1 right-1 sm:left-1.5 sm:right-1.5 flex gap-0.5 h-1">
                        {(d.by_tier || []).map((t) => (
                          <div
                            key={t.tier_id}
                            className="flex-1"
                            style={{ background: t.is_overbooked ? "#EF4444" : TIER_COLORS[t.tier_id] || "#B8922A" }}
                            title={`${t.tier_name}: ${t.rooms}${t.inventory ? `/${t.inventory}` : ""}`}
                          />
                        ))}
                      </div>
                    </button>
                  );
                }),
              ];
            })()}
          </div>
        )}
      </div>

      {/* ============================================================
         OCCUPATION DES CHAMBRES (par chambre physique)
         ============================================================ */}
      <OccupancyPanel
        occupancy={occupancy}
        selectedDay={selectedDay}
        onAssignClick={(booking) => setAssigningFor(booking)}
      />

      {/* Today / selected day arrivals & departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-[#0A0A0A]/8 p-5">
          <div className="flex items-center gap-2 mb-4">
            <LogIn size={14} className="text-[#B8922A]" />
            <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A]">
              Arrivées · {selectedDay}
            </div>
            <span className="text-xs text-[#0A0A0A]/45 ml-auto">{today_?.arrivals?.length || 0}</span>
          </div>
          {!today_ ? <div className="text-sm text-[#0A0A0A]/50">…</div> : today_.arrivals.length === 0 ? (
            <div className="text-sm text-[#0A0A0A]/50">Aucune arrivée ce jour.</div>
          ) : (
            <div className="space-y-2">
              {today_.arrivals.map((b) => {
                const p = (b.participants || [])[0] || {};
                const checkinTime = today_?.default_checkin_time || "14:00";
                return (
                  <div key={b.id} className="border border-[#0A0A0A]/10 p-3" data-testid={`arrival-${b.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-[#0A0A0A]">{p.surname} {p.name}</div>
                      <div className="text-[0.6rem] uppercase tracking-[0.22em] text-emerald-700 inline-flex items-center gap-1.5">
                        <LogIn size={10} /> Check-in {checkinTime}
                      </div>
                    </div>
                    <div className="text-[0.72rem] text-[#0A0A0A]/65 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="font-medium">{TIER_LABEL[b.room_tier] || b.room_tier_name || "—"}</span>
                      {b.room_label ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#B8922A]/8 border border-[#B8922A]/30 text-[#B8922A] text-[0.62rem] font-medium uppercase tracking-[0.14em]">
                          <Key size={9} /> {b.room_label}
                        </span>
                      ) : (
                        <button
                          onClick={() => setAssigningFor(b)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-300 text-amber-800 text-[0.62rem] uppercase tracking-[0.14em] hover:bg-amber-100"
                          data-testid={`assign-room-${b.id}`}
                        >
                          <AlertCircle size={9} /> Attribuer chambre
                        </button>
                      )}
                      <span>{b.rooms} ch. · {(b.adults || 0) + (b.children || 0)} pers.</span>
                      <span>{b.nights} nuit{b.nights > 1 ? "s" : ""}</span>
                      <span>Bateau {b.boat_time}</span>
                      <span>{b.phone || "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#0A0A0A]/8 p-5">
          <div className="flex items-center gap-2 mb-4">
            <LogOut size={14} className="text-[#B8922A]" />
            <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A]">
              Départs · {selectedDay}
            </div>
            <span className="text-xs text-[#0A0A0A]/45 ml-auto">{today_?.departures?.length || 0}</span>
          </div>
          {!today_ ? <div className="text-sm text-[#0A0A0A]/50">…</div> : today_.departures.length === 0 ? (
            <div className="text-sm text-[#0A0A0A]/50">Aucun départ ce jour.</div>
          ) : (
            <div className="space-y-2">
              {today_.departures.map((b) => {
                const p = (b.participants || [])[0] || {};
                const checkoutTime = today_?.default_checkout_time || "12:00";
                return (
                  <div key={b.id} className="border border-[#0A0A0A]/10 p-3" data-testid={`departure-${b.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-[#0A0A0A]">{p.surname} {p.name}</div>
                      <div className="text-[0.6rem] uppercase tracking-[0.22em] text-sky-700 inline-flex items-center gap-1.5">
                        <LogOut size={10} /> Check-out {checkoutTime}
                      </div>
                    </div>
                    <div className="text-[0.72rem] text-[#0A0A0A]/65 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="font-medium">{TIER_LABEL[b.room_tier] || b.room_tier_name || "—"}</span>
                      {b.room_label && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#B8922A]/8 border border-[#B8922A]/30 text-[#B8922A] text-[0.62rem] font-medium uppercase tracking-[0.14em]">
                          <Key size={9} /> {b.room_label}
                        </span>
                      )}
                      <span>{b.rooms} ch. · {(b.adults || 0) + (b.children || 0)} pers.</span>
                      <span>Check-in {b.date}</span>
                      <span>Bateau {b.return_boat_time || "—"}</span>
                      <span>{b.phone || "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
         HISTORY & STATISTICS
         ============================================================ */}
      <div className="mt-12 sm:mt-14" data-testid="heb-stats-section">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1 inline-flex items-center gap-2">
              <TrendingUp size={12} /> Historique & statistiques
            </div>
            <h2 className="font-display-serif text-xl sm:text-2xl md:text-3xl text-[#0A0A0A]">
              {stats?.period_label || "Période"}
            </h2>
            {stats && (
              <p className="text-[0.72rem] text-[#0A0A0A]/55 mt-0.5">
                {stats.date_from} → {stats.date_to} · {stats.days_in_window} jour{stats.days_in_window > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1.5" data-testid="heb-period-group">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setStatsPeriod(p.id)}
                  className={`px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] border transition-all ${
                    statsPeriod === p.id
                      ? "bg-[#B8922A] text-white border-[#B8922A]"
                      : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
                  }`}
                  data-testid={`heb-period-${p.id}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={downloadPdf}
              disabled={!stats}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] border border-[#B8922A] bg-[#B8922A] text-white hover:bg-[#a37e1f] transition-all disabled:opacity-40"
              data-testid="heb-pdf-btn"
            >
              <FileDown size={11} /> PDF
            </button>
          </div>
        </div>

        {statsLoading && !stats ? (
          <div className="text-sm text-[#0A0A0A]/50">Chargement des statistiques…</div>
        ) : !stats ? null : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6" data-testid="heb-kpis">
              <KpiCard label="Séjours" value={stats.kpis.total_stays} />
              <KpiCard label="Nuitées vendues" value={stats.kpis.nights_sold} />
              <KpiCard label="Taux d'occupation" value={`${stats.kpis.occupancy_rate_pct}%`} />
              <KpiCard label="Revenu total" value={fmtXOF(stats.kpis.revenue_total)} small />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
              <KpiCard label="Séjour moyen" value={`${stats.kpis.avg_stay_nights} nuits`} ghost />
              <KpiCard label="Revenu / séjour" value={fmtXOF(stats.kpis.avg_revenue_per_stay)} small ghost />
              <KpiCard label="Revenu / nuitée" value={fmtXOF(stats.kpis.avg_revenue_per_night)} small ghost />
              <KpiCard label="Solde dû" value={fmtXOF(stats.kpis.balance_due_total)} small ghost />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
              <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-5">
                <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">
                  Évolution des nuitées
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={stats.daily_trend}>
                    <CartesianGrid stroke="#F1ECDD" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#888" }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 9, fill: "#888" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="nights" stroke="#B8922A" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-5">
                <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">
                  Revenu par catégorie
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.by_tier}>
                    <CartesianGrid stroke="#F1ECDD" vertical={false} />
                    <XAxis dataKey="tier_name" tick={{ fontSize: 9, fill: "#888" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#888" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v) => fmtXOF(v)} contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="revenue" fill="#B8922A" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* By-tier table */}
            <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-5 mb-6 overflow-x-auto" data-testid="heb-by-tier-table">
              <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">
                Répartition par catégorie
              </div>
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                    <th className="py-2">Catégorie</th>
                    <th className="py-2 text-right">Séjours</th>
                    <th className="py-2 text-right">Nuitées</th>
                    <th className="py-2 text-right">Taux occ.</th>
                    <th className="py-2 text-right">Revenu</th>
                    <th className="py-2 text-right">Part</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_tier.map((t) => (
                    <tr key={t.tier_id} className="border-b border-[#0A0A0A]/5" data-testid={`heb-tier-${t.tier_id}`}>
                      <td className="py-2.5 flex items-center gap-2">
                        <span className="w-2.5 h-2.5" style={{ background: TIER_COLORS[t.tier_id] || "#B8922A" }} />
                        {t.tier_name}
                      </td>
                      <td className="py-2.5 text-right">{t.stays}</td>
                      <td className="py-2.5 text-right">{t.nights}</td>
                      <td className="py-2.5 text-right">{t.occupancy_pct}%</td>
                      <td className="py-2.5 text-right">{fmtXOF(t.revenue)}</td>
                      <td className="py-2.5 text-right text-[#B8922A]">{t.revenue_share_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Top guests */}
            {stats.top_guests && stats.top_guests.length > 0 && (
              <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-5 mb-6 overflow-x-auto" data-testid="heb-top-guests">
                <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">
                  Top 10 clients (par nuitées)
                </div>
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                      <th className="py-2 w-6">#</th>
                      <th className="py-2">Client</th>
                      <th className="py-2">Nationalité</th>
                      <th className="py-2 text-right">Séjours</th>
                      <th className="py-2 text-right">Nuitées</th>
                      <th className="py-2 text-right">Total dépensé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.top_guests.map((g, i) => (
                      <tr key={g.email} className="border-b border-[#0A0A0A]/5">
                        <td className="py-2.5 text-[#0A0A0A]/45">{i + 1}</td>
                        <td className="py-2.5">
                          <div className="font-medium">{g.surname} {g.name}</div>
                          <div className="text-[0.72rem] text-[#0A0A0A]/50">{g.email}</div>
                        </td>
                        <td className="py-2.5 text-[0.78rem] text-[#0A0A0A]/65">{g.nationality || "—"}</td>
                        <td className="py-2.5 text-right">{g.stays}</td>
                        <td className="py-2.5 text-right">{g.nights}</td>
                        <td className="py-2.5 text-right">{fmtXOF(g.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* History collapsible */}
            <div className="bg-white border border-[#0A0A0A]/8 mb-4" data-testid="heb-history">
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left"
                data-testid="heb-history-toggle"
              >
                <div>
                  <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-0.5">
                    Historique des séjours
                  </div>
                  <div className="text-sm text-[#0A0A0A]/65">{stats.history.length} séjour(s)</div>
                </div>
                <ChevronRight size={14} className={`text-[#0A0A0A]/50 transition-transform ${historyOpen ? "rotate-90" : ""}`} />
              </button>
              {historyOpen && (
                <div className="overflow-x-auto border-t border-[#0A0A0A]/8">
                  <table className="w-full text-sm min-w-[760px]">
                    <thead>
                      <tr className="text-left text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10 bg-[#FAFAF7]">
                        <th className="py-2 px-3">Arrivée</th>
                        <th className="py-2 px-3">Départ</th>
                        <th className="py-2 px-3">Client</th>
                        <th className="py-2 px-3">Catégorie</th>
                        <th className="py-2 px-3 text-right">Ch.</th>
                        <th className="py-2 px-3 text-right">Nuits</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-3 text-right">Solde</th>
                        <th className="py-2 px-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.history.map((b) => (
                        <tr key={b.id} className="border-b border-[#0A0A0A]/5" data-testid={`heb-hist-${b.id}`}>
                          <td className="py-2 px-3">{b.date}</td>
                          <td className="py-2 px-3">{b.checkout_date}</td>
                          <td className="py-2 px-3">
                            <div className="font-medium">{b.primary_surname} {b.primary_name}</div>
                            <div className="text-[0.7rem] text-[#0A0A0A]/50">{b.email}</div>
                          </td>
                          <td className="py-2 px-3 text-[0.78rem]">{b.room_tier_name || "—"}</td>
                          <td className="py-2 px-3 text-right">{b.rooms}</td>
                          <td className="py-2 px-3 text-right">{b.nights}</td>
                          <td className="py-2 px-3 text-right">{fmtXOF(b.total_amount)}</td>
                          <td className={`py-2 px-3 text-right ${b.balance_due > 0 ? "text-amber-700" : "text-[#0A0A0A]/45"}`}>{fmtXOF(b.balance_due)}</td>
                          <td className="py-2 px-3">
                            <span className="text-[0.65rem] uppercase tracking-[0.22em] text-[#B8922A]">{b.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {assigningFor && (
        <AssignRoomModal
          booking={assigningFor}
          occupancy={occupancy}
          onClose={() => setAssigningFor(null)}
          onAssigned={() => {
            setAssigningFor(null);
            refreshOccupancy();
            api.get(`/staff/hebergement/today?date=${selectedDay}`).then((r) => setToday_(r.data)).catch(() => {});
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// OCCUPANCY PANEL — physical-room grid for the selected day
// ============================================================
function OccupancyPanel({ occupancy, selectedDay, onAssignClick }) {
  if (!occupancy) {
    return (
      <div className="bg-white border border-[#0A0A0A]/8 p-5 mb-5" data-testid="heb-occupancy-loading">
        <div className="text-sm text-[#0A0A0A]/50">Chargement de l'occupation…</div>
      </div>
    );
  }
  const t = occupancy.totals || {};
  const byTier = occupancy.by_tier || [];
  const supRooms = (occupancy.rooms || []).filter((r) => r.tier === "superieure" && r.id);
  const suiteRooms = (occupancy.rooms || []).filter((r) => r.tier === "suite" && r.id);
  const pendingArrivals = (occupancy.rooms || []).filter((r) => !r.id && r.booking);

  return (
    <div className="bg-white border border-[#0A0A0A]/8 p-5 mb-5" data-testid="heb-occupancy-panel">
      <div className="flex flex-wrap items-baseline justify-between mb-4 gap-2">
        <div>
          <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1 inline-flex items-center gap-2">
            <BedDouble size={12} /> Occupation des chambres
          </div>
          <h2 className="font-display-serif text-xl sm:text-2xl text-[#0A0A0A]">
            {selectedDay}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-[#0A0A0A]/55">
          <Legend cls={ROOM_STATUS_LABEL.available.cls} label="Disponible" />
          <Legend cls={ROOM_STATUS_LABEL.occupied.cls} label="Occupée" />
          <Legend cls={ROOM_STATUS_LABEL.arriving_today.cls} label="Arrivée jour J" />
          <Legend cls={ROOM_STATUS_LABEL.departing_today.cls} label="Départ jour J" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
        <KpiCard label="Total chambres" value={t.rooms_total || 0} />
        <KpiCard label="Occupées" value={t.rooms_occupied || 0} />
        <KpiCard label="Disponibles" value={t.rooms_available || 0} />
        <KpiCard label="Arrivées du jour" value={t.arriving_today || 0} />
        <KpiCard label="Départs du jour" value={t.departing_today || 0} />
        <KpiCard
          label="Sans chambre"
          value={t.pending_arrivals_no_room || 0}
          ghost={t.pending_arrivals_no_room === 0}
        />
      </div>

      {byTier.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5" data-testid="heb-occupancy-by-tier">
          {byTier.map((bt) => {
            const occPct = bt.total > 0 ? Math.round((bt.occupied / bt.total) * 100) : 0;
            return (
              <div key={bt.tier_id} className="border border-[#0A0A0A]/10 p-3.5">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-[#0A0A0A]">{bt.tier_name}</div>
                  <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55">
                    {bt.occupied}/{bt.total} ({occPct}%)
                  </div>
                </div>
                <div className="h-1.5 bg-[#FAFAF7] rounded overflow-hidden mb-2">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${occPct}%`, backgroundColor: TIER_COLORS[bt.tier_id] || "#B8922A" }}
                  />
                </div>
                <div className="text-[0.7rem] text-[#0A0A0A]/55 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>{bt.available} disponible{bt.available > 1 ? "s" : ""}</span>
                  {bt.arriving_today > 0 && <span className="text-amber-700">{bt.arriving_today} arrivée{bt.arriving_today > 1 ? "s" : ""}</span>}
                  {bt.departing_today > 0 && <span className="text-sky-700">{bt.departing_today} départ{bt.departing_today > 1 ? "s" : ""}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pendingArrivals.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-3 mb-5 text-[0.78rem] text-amber-900 inline-flex items-start gap-2" data-testid="heb-pending-no-room">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            <strong className="font-medium">{pendingArrivals.length}</strong> arrivée{pendingArrivals.length > 1 ? "s" : ""} aujourd'hui sans chambre attribuée. Utilisez "Attribuer chambre" dans la liste des arrivées.
          </span>
        </div>
      )}

      <RoomGroup title="Chambres Supérieures (1001-1020)" rooms={supRooms} onAssignClick={onAssignClick} />
      <div className="mt-5">
        <RoomGroup title="Suites" rooms={suiteRooms} onAssignClick={onAssignClick} />
      </div>
    </div>
  );
}

function Legend({ cls, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 border ${cls}`} />
      <span>{label}</span>
    </span>
  );
}

function RoomGroup({ title, rooms, onAssignClick }) {
  if (rooms.length === 0) return null;
  return (
    <div>
      <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-2">{title}</div>
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2">
        {rooms.map((r) => (
          <RoomCell key={r.id} room={r} onAssignClick={onAssignClick} />
        ))}
      </div>
    </div>
  );
}

function RoomCell({ room, onAssignClick }) {
  const meta = ROOM_STATUS_LABEL[room.status] || ROOM_STATUS_LABEL.available;
  const b = room.booking;
  const guestName = b ? `${(b.first_name || "") + " " + (b.last_name || "")}`.trim() || b.name || "—" : "";
  return (
    <div
      className={`border p-2 text-center ${meta.cls} relative group cursor-${b ? "pointer" : "default"}`}
      data-testid={`room-${room.id}`}
      title={b ? `${guestName} · ${b.adults || 0}A${b.children ? "/" + b.children + "E" : ""} · ${b.date} → ${b.checkout_date}` : "Disponible"}
      onClick={() => b && onAssignClick && onAssignClick(b)}
    >
      <div className="font-display-serif text-base leading-tight truncate">{room.label}</div>
      <div className="text-[0.55rem] uppercase tracking-[0.14em] mt-0.5 leading-tight truncate">{meta.fr}</div>
      {b && (
        <div className="text-[0.6rem] mt-0.5 truncate" title={guestName}>
          {guestName.split(" ")[0] || ""}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ASSIGN ROOM MODAL — manager assigns a physical room to a booking
// ============================================================
function AssignRoomModal({ booking, occupancy, onClose, onAssigned }) {
  const [busy, setBusy] = useState(false);
  const eligibleRooms = (occupancy?.rooms || []).filter(
    (r) => r.id && r.tier === booking.room_tier &&
      (r.status === "available" || r.id === booking.room_id),
  );
  const assign = async (roomId) => {
    setBusy(true);
    try {
      await api.patch(`/staff/bookings/${booking.id}/assign-room`, { room_id: roomId });
      toast.success("Chambre attribuée");
      onAssigned();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Attribution impossible");
    } finally {
      setBusy(false);
    }
  };
  const clearAssignment = async () => {
    setBusy(true);
    try {
      await api.patch(`/staff/bookings/${booking.id}/assign-room`, { room_id: null });
      toast.success("Attribution annulée");
      onAssigned();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Action impossible");
    } finally {
      setBusy(false);
    }
  };
  const tierLabel = TIER_LABEL[booking.room_tier] || booking.room_tier_name || booking.room_tier;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()} data-testid="assign-room-modal">
      <div className="bg-white p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display-serif text-2xl text-[#0A0A0A] mb-1">Attribuer une chambre</h3>
        <p className="text-sm text-[#0A0A0A]/65 mb-1">
          Catégorie : <span className="font-medium text-[#0A0A0A]">{tierLabel}</span>
        </p>
        <p className="text-[0.7rem] text-[#0A0A0A]/45 mb-4">
          {booking.date} → {booking.checkout_date} · {booking.rooms || 1} chambre · {(booking.adults || 0) + (booking.children || 0)} pers.
        </p>
        {eligibleRooms.length === 0 ? (
          <div className="bg-amber-50 border border-amber-300 p-3 text-sm text-amber-900">
            Aucune chambre {tierLabel} disponible sur la période.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {eligibleRooms.map((r) => (
              <button
                key={r.id}
                onClick={() => assign(r.id)}
                disabled={busy}
                className={`border p-3 text-center transition-colors ${r.id === booking.room_id ? "border-[#B8922A] bg-[#B8922A]/8 text-[#B8922A]" : "border-[#0A0A0A]/15 hover:border-[#B8922A] hover:bg-[#B8922A]/5"} disabled:opacity-50`}
                data-testid={`assign-pick-${r.id}`}
              >
                <div className="font-display-serif text-base">{r.label}</div>
                {r.id === booking.room_id && (
                  <div className="text-[0.6rem] uppercase tracking-[0.14em] mt-0.5">Sélectionnée</div>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-5">
          {booking.room_id ? (
            <button onClick={clearAssignment} disabled={busy} className="text-[0.65rem] uppercase tracking-[0.22em] text-red-700 hover:text-red-900" data-testid="assign-clear">
              Retirer l'attribution
            </button>
          ) : <span />}
          <button onClick={onClose} disabled={busy} className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/65 hover:text-[#0A0A0A]" data-testid="assign-cancel">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, small, ghost }) {
  return (
    <div className={`${ghost ? "bg-[#FAFAF7]" : "bg-white"} border border-[#0A0A0A]/8 p-3 sm:p-4`}>
      <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 truncate">{label}</div>
      <div className={`font-display-serif ${small ? "text-base sm:text-lg" : "text-xl sm:text-2xl"} text-[#0A0A0A] break-words`}>
        {value}
      </div>
    </div>
  );
}

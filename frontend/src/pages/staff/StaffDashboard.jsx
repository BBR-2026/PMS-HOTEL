import { useEffect, useState } from "react";
import api from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { CalendarDays, Wallet, Users, Anchor, AlertTriangle, Clock } from "lucide-react";

const STATUS_COLORS = {
  pending: "bg-[#FAFAF7] text-[#0A0A0A]/55 border-[#0A0A0A]/15",
  confirmed: "bg-[#B8922A]/10 text-[#B8922A] border-[#B8922A]/30",
  arrived: "bg-green-50 text-green-700 border-green-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};
const STATUS_FR = {
  pending: "En attente", confirmed: "Confirmée", arrived: "Arrivée",
  completed: "Terminée", cancelled: "Annulée",
};
const OFFER_COLORS = {
  pass_day: "border-l-4 border-[#B8922A]",
  sunset: "border-l-4 border-orange-500",
  brunch: "border-l-4 border-green-600",
  le_kaai: "border-l-4 border-purple-500",
  hebergement: "border-l-4 border-blue-600",
};

function KpiCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white border border-[#0A0A0A]/8 p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">{label}</div>
        <Icon size={16} className="text-[#B8922A]" />
      </div>
      <div className="font-display-serif text-3xl text-[#0A0A0A] leading-none">{value}</div>
      {sub && <div className="text-[0.7rem] text-[#0A0A0A]/45 mt-2">{sub}</div>}
    </div>
  );
}

export default function StaffDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/staff/dashboard")
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-[#0A0A0A]/50">Chargement…</div>;
  if (!data) return <div className="p-10 text-red-600">Impossible de charger le tableau de bord.</div>;

  const { kpis, bookings_today, alerts } = data;

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-dashboard">
      <div className="mb-8">
        <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A]">Tableau de bord</h1>
        <p className="text-sm text-[#0A0A0A]/55 mt-1">Vue opérationnelle de la journée</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <KpiCard icon={CalendarDays} label="Réservations du jour" value={kpis.bookings_today} />
        <KpiCard icon={Wallet} label="Revenus du jour" value={formatXOF(kpis.revenue_today)} />
        <KpiCard icon={Users} label="Clients attendus" value={kpis.guests_today} />
        <KpiCard icon={Anchor} label="Traversées prévues" value={kpis.crossings_today} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Planning */}
        <div className="lg:col-span-2 bg-white border border-[#0A0A0A]/8 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display-serif text-xl text-[#0A0A0A]">Planning du jour</h2>
            <span className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">
              {bookings_today.length} réservation{bookings_today.length > 1 ? "s" : ""}
            </span>
          </div>
          {bookings_today.length === 0 ? (
            <p className="text-sm text-[#0A0A0A]/45 py-8 text-center">Aucune réservation prévue aujourd'hui.</p>
          ) : (
            <ul className="space-y-2.5" data-testid="bookings-today-list">
              {bookings_today.map((b) => (
                <li
                  key={b.id}
                  className={`flex items-center gap-4 bg-[#FAFAF7] p-3.5 ${OFFER_COLORS[b.offer_type] || ""}`}
                  data-testid={`booking-row-${b.id.slice(0, 8)}`}
                >
                  <div className="text-[0.7rem] tabular-nums text-[#B8922A] font-medium w-12 text-center">
                    {b.boat_time || "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#0A0A0A] truncate">
                      {b.participants?.[0] ? `${b.participants[0].surname} ${b.participants[0].name}` : b.phone}
                    </div>
                    <div className="text-[0.7rem] text-[#0A0A0A]/55">
                      {b.offer_name} · {b.adults}A {b.children > 0 ? `+ ${b.children}E` : ""}
                    </div>
                  </div>
                  <span className={`text-[0.62rem] uppercase tracking-[0.18em] px-2.5 py-1 border ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}>
                    {STATUS_FR[b.status] || b.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Alerts */}
        <aside className="space-y-5">
          <div className="bg-white border border-[#0A0A0A]/8 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} className="text-[#B8922A]" />
              <h3 className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/70">Arrivées imminentes</h3>
            </div>
            {alerts.imminent_arrivals.length === 0 ? (
              <p className="text-xs text-[#0A0A0A]/40">Aucune arrivée prévue dans les 2 prochaines heures.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.imminent_arrivals.map((a) => (
                  <li key={a.booking_id} className="text-xs">
                    <span className="text-[#B8922A] font-medium">{a.boat_time}</span> ·{" "}
                    <span className="text-[#0A0A0A]">{a.offer}</span> · {a.guests} pers.
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-[#0A0A0A]/8 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-red-500" />
              <h3 className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/70">Impayés en attente</h3>
            </div>
            {alerts.unpaid_bookings.length === 0 ? (
              <p className="text-xs text-[#0A0A0A]/40">Aucun impayé en attente.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.unpaid_bookings.slice(0, 6).map((u) => (
                  <li key={u.id} className="text-xs flex justify-between gap-3">
                    <span className="truncate text-[#0A0A0A]">{u.offer_name} · {u.date}</span>
                    <span className="text-[#B8922A] font-medium tabular-nums">{formatXOF(u.total_amount || 0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

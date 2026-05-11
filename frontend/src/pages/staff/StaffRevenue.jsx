import { useEffect, useState } from "react";
import api from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { TrendingUp, Wallet, ShoppingBag, Users } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const PERIODS = [
  { id: "day", label: "Aujourd'hui" },
  { id: "week", label: "7 jours" },
  { id: "month", label: "30 jours" },
  { id: "year", label: "12 mois" },
  { id: "all", label: "Total" },
];

const OFFER_COLORS = {
  pass_day: "#B8922A",
  sunset: "#F97316",
  brunch: "#16A34A",
  le_kaai: "#A855F7",
  hebergement: "#2563EB",
};

const METHOD_LABEL = {
  fineo: "FINEO",
  card: "Carte bancaire",
  mobile_money: "Mobile Money",
  cash: "Espèces",
  unknown: "Inconnu",
};

function Kpi({ icon: Icon, label, value, sub }) {
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

export default function StaffRevenue() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/staff/revenue?period=${period}`).then((r) => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  if (loading && !data) return <div className="p-10 text-[#0A0A0A]/50">Chargement…</div>;
  if (!data) return <div className="p-10 text-red-600">Impossible de charger le chiffre d'affaires.</div>;

  const byOffer = data.by_offer || [];
  const byMethod = (data.by_method || []).map((m) => ({ ...m, name: METHOD_LABEL[m.method] || m.method }));
  const dailyTrend = data.daily_trend || [];
  const topClients = data.top_clients || [];

  return (
    <div className="p-8 md:p-10 max-w-7xl mx-auto" data-testid="staff-revenue">
      <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2">Chiffre d'affaires</h1>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">Revenus consolidés des réservations payées.</p>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 mb-8" data-testid="period-selector">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] border transition-all ${
              period === p.id
                ? "bg-[#B8922A] text-white border-[#B8922A]"
                : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
            }`}
            data-testid={`period-${p.id}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <Kpi icon={Wallet} label="Revenu total" value={formatXOF(data.total_revenue)} />
        <Kpi icon={ShoppingBag} label="Réservations payées" value={data.total_bookings} />
        <Kpi icon={TrendingUp} label="Panier moyen" value={formatXOF(data.avg_basket)} />
        <Kpi icon={Users} label="Top clients" value={topClients.length} sub="Top 10 affichés" />
      </div>

      {/* Daily trend */}
      <div className="bg-white border border-[#0A0A0A]/8 p-6 mb-8">
        <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">Évolution journalière</div>
        {dailyTrend.length === 0 ? (
          <div className="text-sm text-[#0A0A0A]/50 py-10 text-center">Aucune donnée sur cette période.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#999" />
              <YAxis tick={{ fontSize: 11 }} stroke="#999" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatXOF(v)} contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="amount" stroke="#B8922A" strokeWidth={2} dot={{ r: 3, fill: "#B8922A" }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* By offer */}
        <div className="bg-white border border-[#0A0A0A]/8 p-6">
          <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">Répartition par offre</div>
          {byOffer.length === 0 ? (
            <div className="text-sm text-[#0A0A0A]/50 py-10 text-center">Aucune donnée.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byOffer} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                  <XAxis dataKey="offer_name" tick={{ fontSize: 10 }} stroke="#999" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#999" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatXOF(v)} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total" radius={[2, 2, 0, 0]}>
                    {byOffer.map((o, i) => (
                      <Cell key={i} fill={OFFER_COLORS[o.offer_id] || "#B8922A"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {byOffer.map((o) => (
                  <div key={o.offer_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: OFFER_COLORS[o.offer_id] || "#B8922A" }}></span>
                      <span className="text-[#0A0A0A]/75">{o.offer_name}</span>
                      <span className="text-[0.7rem] text-[#0A0A0A]/45">({o.count})</span>
                    </div>
                    <span className="font-medium text-[#0A0A0A]">{formatXOF(o.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* By payment method */}
        <div className="bg-white border border-[#0A0A0A]/8 p-6">
          <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">Répartition par paiement</div>
          {byMethod.length === 0 ? (
            <div className="text-sm text-[#0A0A0A]/50 py-10 text-center">Aucune donnée.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byMethod} dataKey="total" nameKey="name" innerRadius={50} outerRadius={85}>
                    {byMethod.map((_, i) => (
                      <Cell key={i} fill={["#B8922A", "#16A34A", "#2563EB", "#F97316", "#A855F7"][i % 5]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatXOF(v)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {byMethod.map((m) => (
                  <div key={m.method} className="flex items-center justify-between text-sm">
                    <span className="text-[#0A0A0A]/75">{m.name} <span className="text-[0.7rem] text-[#0A0A0A]/45">({m.count})</span></span>
                    <span className="font-medium text-[#0A0A0A]">{formatXOF(m.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top clients */}
      <div className="bg-white border border-[#0A0A0A]/8 p-6">
        <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">Top 10 clients</div>
        {topClients.length === 0 ? (
          <div className="text-sm text-[#0A0A0A]/50">Aucun client sur cette période.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                <th className="text-left py-2.5">Rang</th>
                <th className="text-left py-2.5">Client</th>
                <th className="text-left py-2.5">Email</th>
                <th className="text-center py-2.5">Réservations</th>
                <th className="text-right py-2.5">Total dépensé</th>
              </tr>
            </thead>
            <tbody>
              {topClients.map((c, i) => (
                <tr key={c.email} className="border-b border-[#0A0A0A]/5">
                  <td className="py-2.5 text-[#B8922A] font-medium">#{i + 1}</td>
                  <td className="py-2.5 text-[#0A0A0A]">{c.surname} {c.name}</td>
                  <td className="py-2.5 text-[#0A0A0A]/70">{c.email}</td>
                  <td className="py-2.5 text-center">{c.count}</td>
                  <td className="py-2.5 text-right font-medium text-[#0A0A0A]">{formatXOF(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

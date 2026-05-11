import { useEffect, useState } from "react";
import api, { API, getStaffToken } from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { TrendingUp, Wallet, ShoppingBag, Users, BarChart3, Clock, Globe, FileDown } from "lucide-react";
import { toast } from "sonner";
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
  const [advanced, setAdvanced] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/staff/revenue?period=${period}`).then((r) => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    if (showAdvanced && !advanced) {
      api.get("/staff/stats/advanced").then((r) => setAdvanced(r.data)).catch(() => {});
    }
  }, [showAdvanced, advanced]);

  const downloadPdf = async () => {
    const token = getStaffToken();
    const res = await fetch(`${API}/staff/revenue/report.pdf?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      toast.error("Export PDF impossible");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bbr-revenue-${period}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Rapport PDF téléchargé");
  };

  if (loading && !data) return <div className="p-10 text-[#0A0A0A]/50">Chargement…</div>;
  if (!data) return <div className="p-10 text-red-600">Impossible de charger le chiffre d'affaires.</div>;

  const byOffer = data.by_offer || [];
  const byMethod = (data.by_method || []).map((m) => ({ ...m, name: METHOD_LABEL[m.method] || m.method }));
  const dailyTrend = data.daily_trend || [];
  const topClients = data.top_clients || [];

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-revenue">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">Chiffre d'affaires</h1>
        <button
          onClick={downloadPdf}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#B8922A] text-white text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] transition-colors self-start sm:self-auto"
          data-testid="export-pdf-btn"
        >
          <FileDown size={13} /> Rapport PDF
        </button>
      </div>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">Revenus consolidés des réservations payées.</p>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 mb-8" data-testid="period-selector">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 sm:px-4 py-2 text-[0.65rem] sm:text-[0.7rem] uppercase tracking-[0.22em] border transition-all ${
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-10">
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
      <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-6">
        <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">Top 10 clients</div>
        {topClients.length === 0 ? (
          <div className="text-sm text-[#0A0A0A]/50">Aucun client sur cette période.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                  <th className="text-left py-2.5">Rang</th>
                  <th className="text-left py-2.5">Client</th>
                  <th className="text-left py-2.5 hidden sm:table-cell">Email</th>
                  <th className="text-center py-2.5">Résa.</th>
                  <th className="text-right py-2.5">Total dépensé</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((c, i) => (
                  <tr key={c.email} className="border-b border-[#0A0A0A]/5">
                    <td className="py-2.5 text-[#B8922A] font-medium">#{i + 1}</td>
                    <td className="py-2.5 text-[#0A0A0A]">{c.surname} {c.name}</td>
                    <td className="py-2.5 text-[#0A0A0A]/70 hidden sm:table-cell">{c.email}</td>
                    <td className="py-2.5 text-center">{c.count}</td>
                    <td className="py-2.5 text-right font-medium text-[#0A0A0A]">{formatXOF(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Advanced statistics */}
      <div className="mt-10">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#B8922A] text-[#B8922A] text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#B8922A]/5 transition-colors"
          data-testid="toggle-advanced-stats"
        >
          <BarChart3 size={13} />
          {showAdvanced ? "Masquer les stats avancées" : "Afficher les stats avancées"}
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-6 space-y-6" data-testid="advanced-stats">
          {!advanced ? (
            <div className="text-sm text-[#0A0A0A]/50">Chargement des statistiques avancées…</div>
          ) : (
            <AdvancedStats data={advanced} />
          )}
        </div>
      )}
    </div>
  );
}

function AdvancedStats({ data }) {
  const heb = data.hebergement || {};
  return (
    <>
      {/* Year-over-Year */}
      <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A]">Évolution annuelle</div>
          <div className="text-[0.7rem] text-[#0A0A0A]/55">{data.previous_year} vs {data.year}</div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.yoy} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#999" />
            <YAxis tick={{ fontSize: 11 }} stroke="#999" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatXOF(v)} contentStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="previous" fill="#D1D5DB" name={`${data.previous_year}`} radius={[2, 2, 0, 0]} />
            <Bar dataKey="current" fill="#B8922A" name={`${data.year}`} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking funnel */}
        <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-6">
          <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">Funnel de réservations ({data.year})</div>
          <div className="space-y-2.5">
            {[
              { key: "pending", label: "En attente", color: "bg-orange-400" },
              { key: "confirmed", label: "Confirmées", color: "bg-[#B8922A]" },
              { key: "arrived", label: "Arrivées", color: "bg-green-500" },
              { key: "completed", label: "Terminées", color: "bg-blue-500" },
              { key: "cancelled", label: "Annulées", color: "bg-red-400" },
            ].map((step) => {
              const count = data.funnel[step.key] || 0;
              const max = Math.max(...Object.values(data.funnel), 1);
              const w = (count / max) * 100;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className="text-[0.7rem] text-[#0A0A0A]/70 w-24">{step.label}</div>
                  <div className="flex-1 bg-[#FAFAF7] h-7 relative overflow-hidden">
                    <div className={`absolute inset-y-0 left-0 ${step.color} transition-all`} style={{ width: `${w}%` }} />
                    <div className="absolute inset-0 flex items-center px-2.5 text-xs text-[#0A0A0A] font-medium">{count}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operational KPIs */}
        <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-6">
          <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">Indicateurs clés</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-[#0A0A0A]/10 p-4 bg-[#FAFAF7]">
              <div className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">
                <Clock size={11} /> Lead time moyen
              </div>
              <div className="font-display-serif text-2xl text-[#0A0A0A] mt-1">{data.avg_lead_time_days} <span className="text-sm text-[#0A0A0A]/50">jours</span></div>
              <div className="text-[0.65rem] text-[#0A0A0A]/45 mt-1">Délai création → date séjour</div>
            </div>
            <div className="border border-[#B8922A]/30 p-4 bg-[#B8922A]/5">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Occupation hôtel</div>
              <div className="font-display-serif text-2xl text-[#0A0A0A] mt-1">{heb.occupancy_rate_pct}%</div>
              <div className="text-[0.65rem] text-[#0A0A0A]/55 mt-1">{heb.nights_sold} / {heb.available_nights} nuits vendues</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top nationalities */}
        <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-6">
          <div className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">
            <Globe size={11} /> Top nationalités
          </div>
          {(data.top_nationalities || []).length === 0 ? (
            <div className="text-sm text-[#0A0A0A]/50">Aucune donnée.</div>
          ) : (
            <div className="space-y-2">
              {data.top_nationalities.map((n, i) => {
                const max = data.top_nationalities[0].count;
                const w = (n.count / max) * 100;
                return (
                  <div key={n.nationality} className="flex items-center gap-3">
                    <div className="text-[0.7rem] text-[#0A0A0A]/45 w-6">#{i + 1}</div>
                    <div className="text-sm text-[#0A0A0A] w-32 sm:w-40 truncate">{n.nationality}</div>
                    <div className="flex-1 bg-[#FAFAF7] h-5 relative overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-[#B8922A]" style={{ width: `${w}%` }} />
                    </div>
                    <div className="text-xs text-[#0A0A0A]/70 w-8 text-right">{n.count}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Weekday distribution */}
        <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-6">
          <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">Répartition par jour de la semaine</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.weekday_distribution} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#999" />
              <YAxis tick={{ fontSize: 11 }} stroke="#999" />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="#B8922A" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Party size per offer */}
      <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-6">
        <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">Taille moyenne du groupe par offre</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(data.party_size || []).map((p) => (
            <div key={p.offer_id} className="border border-[#0A0A0A]/10 p-3">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 truncate">{p.offer_name}</div>
              <div className="font-display-serif text-2xl text-[#0A0A0A] mt-1">{p.avg_party_size}</div>
              <div className="text-[0.65rem] text-[#0A0A0A]/45 mt-0.5">{p.bookings} résa.</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

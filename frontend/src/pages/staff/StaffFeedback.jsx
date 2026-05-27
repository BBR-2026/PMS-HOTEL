import { useEffect, useState } from "react";
import {
  Star, MessageSquare, Trash2, Filter, TrendingUp, Award, AlertCircle, Users,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import api from "../../lib/api";

const EXP_LABELS = {
  pass_day: "Pass Day",
  sunset: "Sunset",
  brunch: "Brunch",
  lounge: "Lounge",
  restaurant: "Restaurant",
  hebergement: "Hébergement",
  evenement_prive: "Événement privé",
  autre: "Autre",
};

const CRIT = [
  ["avg_accueil",  "Accueil"],
  ["avg_service",  "Service"],
  ["avg_restau",   "Restauration"],
  ["avg_ambiance", "Ambiance"],
  ["avg_proprete", "Propreté"],
  ["avg_globale",  "Expérience globale"],
];

const COLORS_BAR = ["#B8922A", "#9F7E22", "#86691B", "#6B5316", "#553F11", "#3D2D0B"];
const NPS_COLORS = { promoters: "#15803D", passives: "#B8922A", detractors: "#DC2626" };

export default function StaffFeedback() {
  const [items, setItems] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        api.get("/staff/feedback"),
        api.get("/staff/feedback/analytics"),
      ]);
      setItems(a.data.items || []);
      setAnalytics(b.data);
    } catch {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm("Supprimer ce retour ?")) return;
    try { await api.delete(`/staff/feedback/${id}`); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const filtered = filterType ? items.filter((i) => i.experience_type === filterType) : items;
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const fmtDay = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "";

  const overall = analytics?.overall || {};
  const total = overall.total ?? 0;
  const nps = analytics?.nps;

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-feedback-page">
      <div className="mb-8">
        <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2 flex items-center gap-2">
          <MessageSquare size={14} /> Voix du client · Analytics
        </div>
        <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A]">Retour expérience</h1>
        <p className="text-sm text-[#0A0A0A]/55 max-w-2xl mt-2">
          Avis et notes des clients après leur passage au Boulay Beach Resort.
        </p>
      </div>

      {/* KPIs */}
      {analytics && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8" data-testid="feedback-kpis">
          <KPI icon={Users} label="Total retours" value={total} />
          <KPI icon={Award} label="Note globale" value={overall.avg_globale ? overall.avg_globale.toFixed(2) + " / 5" : "—"} gold />
          <KPI icon={TrendingUp} label="Score NPS" value={total ? `${nps?.score}` : "—"} colorClass={nps?.score >= 50 ? "text-green-700" : nps?.score >= 0 ? "text-[#B8922A]" : "text-red-600"} sub={total ? `${nps?.promoters} promoteurs · ${nps?.detractors} détracteurs` : ""} />
          <KPI icon={Award} label="Catégorie #1" value={analytics.by_type?.[0]?.type ? EXP_LABELS[analytics.by_type[0].type] : "—"} sub={analytics.by_type?.[0] ? `${analytics.by_type[0].count} retours` : ""} />
        </div>
      )}

      {total === 0 ? (
        <div className="border border-dashed border-[#0A0A0A]/15 p-10 text-center text-[#0A0A0A]/55 text-sm">
          Aucun retour pour le moment.
        </div>
      ) : (
        <>
          {/* Charts row 1 — Distribution stars + NPS pie */}
          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <ChartCard title="Distribution des notes globales" subtitle="Combien de clients ont mis chaque note ?" cols="lg:col-span-2">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={(analytics.distribution || []).map((d) => ({ rating: `${d.rating} ★`, count: d.count }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0A0A0A0F" />
                  <XAxis dataKey="rating" tick={{ fontSize: 12, fill: "#0A0A0A99" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#0A0A0A99" }} />
                  <Tooltip cursor={{ fill: "#B8922A10" }} contentStyle={{ background: "#fff", border: "1px solid #0A0A0A20", fontSize: 12 }} />
                  <Bar dataKey="count" fill="#B8922A" radius={[4, 4, 0, 0]}>
                    {(analytics.distribution || []).map((d, i) => (
                      <Cell key={i} fill={d.rating >= 4 ? "#15803D" : d.rating === 3 ? "#B8922A" : "#DC2626"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Répartition NPS" subtitle="Promoteurs · Passifs · Détracteurs">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Promoteurs (5★)",  value: nps?.promoters || 0, color: NPS_COLORS.promoters },
                      { name: "Passifs (4★)",     value: nps?.passives || 0,  color: NPS_COLORS.passives },
                      { name: "Détracteurs (≤3★)",value: nps?.detractors || 0,color: NPS_COLORS.detractors },
                    ]}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value"
                  >
                    {[NPS_COLORS.promoters, NPS_COLORS.passives, NPS_COLORS.detractors].map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #0A0A0A20", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Charts row 2 — Radar criteria + bars by type */}
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <ChartCard title="Moyennes par critère" subtitle="Radar des 6 dimensions notées">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart outerRadius={100} data={CRIT.map(([k, lbl]) => ({ criterion: lbl, score: Number((overall[k] || 0).toFixed(2)) }))}>
                  <PolarGrid stroke="#0A0A0A20" />
                  <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 11, fill: "#0A0A0A99" }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Radar name="Score moyen" dataKey="score" stroke="#B8922A" fill="#B8922A" fillOpacity={0.45} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #0A0A0A20", fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Note globale par offre" subtitle="Performance comparative">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={(analytics.by_type || []).map((t) => ({ name: EXP_LABELS[t.type] || t.type, score: Number(t.avg_globale.toFixed(2)), count: t.count }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#0A0A0A0F" />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: "#0A0A0A99" }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "#0A0A0A99" }} />
                  <Tooltip cursor={{ fill: "#B8922A10" }} contentStyle={{ background: "#fff", border: "1px solid #0A0A0A20", fontSize: 12 }}
                    formatter={(v, _n, ctx) => [`${v} / 5 · ${ctx.payload.count} retours`, "Note globale"]} />
                  <Bar dataKey="score" fill="#0A0A0A" radius={[0, 4, 4, 0]}>
                    {(analytics.by_type || []).map((_, i) => <Cell key={i} fill={COLORS_BAR[i % COLORS_BAR.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Trend line (30 days) */}
          {analytics.trend?.length > 0 && (
            <div className="mb-6">
              <ChartCard title="Tendance des 30 derniers jours" subtitle="Nombre de retours soumis & note moyenne par jour">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={analytics.trend.map((t) => ({ day: fmtDay(t.day), count: t.count, avg: Number(t.avg_globale.toFixed(2)) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0A0A0A0F" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#0A0A0A99" }} />
                    <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: "#0A0A0A99" }} label={{ value: "Retours", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#0A0A0A66" } }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fontSize: 11, fill: "#B8922A" }} label={{ value: "Note /5", angle: 90, position: "insideRight", style: { fontSize: 11, fill: "#B8922A" } }} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #0A0A0A20", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="left"  type="monotone" dataKey="count" name="Nb retours" stroke="#0A0A0A" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="avg"   name="Note moyenne" stroke="#B8922A" strokeWidth={2.5} dot={{ r: 4, fill: "#B8922A" }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}

          {/* Detailed per-offer table */}
          <div className="mb-6">
            <ChartCard title="Notes moyennes par offre — détail par critère"
              subtitle="Comparez la performance de chaque offre sur les 6 dimensions notées par vos clients.">
              <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
                <table className="w-full text-sm border-collapse" data-testid="per-offer-table">
                  <thead>
                    <tr className="text-[0.65rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/15">
                      <th className="text-left py-3 pr-3">Offre</th>
                      <th className="text-center py-3 px-2">Retours</th>
                      <th className="text-center py-3 px-2">Accueil</th>
                      <th className="text-center py-3 px-2">Service</th>
                      <th className="text-center py-3 px-2">Restauration</th>
                      <th className="text-center py-3 px-2">Ambiance</th>
                      <th className="text-center py-3 px-2">Propreté</th>
                      <th className="text-center py-3 pl-2 text-[#B8922A]">Globale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.by_type || []).map((t) => (
                      <tr key={t.type} className="border-b border-[#0A0A0A]/8 hover:bg-[#FAFAF7] transition-colors" data-testid={`row-${t.type}`}>
                        <td className="py-3 pr-3">
                          <div className="font-medium text-[#0A0A0A]">{EXP_LABELS[t.type] || t.type}</div>
                        </td>
                        <td className="text-center py-3 px-2 text-[#0A0A0A]/70">{t.count}</td>
                        <ScoreCell v={t.avg_accueil} />
                        <ScoreCell v={t.avg_service} />
                        <ScoreCell v={t.avg_restau} />
                        <ScoreCell v={t.avg_ambiance} />
                        <ScoreCell v={t.avg_proprete} />
                        <ScoreCell v={t.avg_globale} highlight />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-[0.7rem] text-[#0A0A0A]/45 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 inline-block rounded-full bg-green-600"></span> ≥ 4.5
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 inline-block rounded-full bg-[#B8922A]"></span> 3.5 – 4.5
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 inline-block rounded-full bg-red-500"></span> &lt; 3.5
                </span>
              </div>
            </ChartCard>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Filter size={14} className="text-[#0A0A0A]/50" />
            <button onClick={() => setFilterType("")} className={`px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.18em] border ${!filterType ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "border-[#0A0A0A]/15 hover:border-[#0A0A0A]"}`}>
              Tous ({items.length})
            </button>
            {Object.entries(EXP_LABELS).map(([id, lbl]) => {
              const c = items.filter((i) => i.experience_type === id).length;
              if (c === 0) return null;
              return (
                <button key={id} onClick={() => setFilterType(id)} className={`px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.18em] border ${filterType === id ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "border-[#0A0A0A]/15 hover:border-[#0A0A0A]"}`}>
                  {lbl} ({c})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="text-sm text-[#0A0A0A]/50">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-[#0A0A0A]/15 p-10 text-center text-[#0A0A0A]/55 text-sm">
              Aucun retour pour cette catégorie.
            </div>
          ) : (
            <div className="space-y-3" data-testid="feedback-items">
              {filtered.map((f) => <FeedbackCard key={f.id} f={f} onDelete={remove} fmtDate={fmtDate} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, gold, sub, colorClass }) {
  return (
    <div className={`p-5 border ${gold ? "bg-[#B8922A]/8 border-[#B8922A]/30" : "bg-white border-[#0A0A0A]/10"}`}>
      <div className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50 mb-2 flex items-center gap-1.5">
        {Icon && <Icon size={11} />} {label}
      </div>
      <div className={`text-2xl font-display-serif ${colorClass || (gold ? "text-[#B8922A]" : "text-[#0A0A0A]")}`}>{value}</div>
      {sub && <div className="text-[0.7rem] text-[#0A0A0A]/45 mt-1">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, cols, children }) {
  return (
    <div className={`bg-white border border-[#0A0A0A]/10 p-4 sm:p-5 ${cols || ""}`}>
      <div className="mb-3">
        <div className="font-display-serif text-base text-[#0A0A0A]">{title}</div>
        {subtitle && <div className="text-[0.72rem] text-[#0A0A0A]/55 mt-0.5">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function FeedbackCard({ f, onDelete, fmtDate }) {
  const stars = (n) => (
    <div className="flex items-center gap-0.5 text-[#B8922A]">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} size={12} className={n >= i ? "fill-[#B8922A]" : "text-[#0A0A0A]/15"} fill={n >= i ? "#B8922A" : "none"} />
      ))}
    </div>
  );

  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-5" data-testid={`feedback-${f.id}`}>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] bg-[#B8922A]/15 text-[#B8922A]">
              {EXP_LABELS[f.experience_type] || f.experience_type}
            </span>
            {f.full_name && <span className="text-sm font-medium text-[#0A0A0A]">{f.full_name}</span>}
            {f.email && <span className="text-xs text-[#0A0A0A]/55">{f.email}</span>}
            {f.phone && <span className="text-xs text-[#0A0A0A]/55">· {f.phone}</span>}
          </div>
          <div className="text-[0.7rem] text-[#0A0A0A]/50 mt-1">
            Soumis : {fmtDate(f.created_at)}
            {f.visit_date && ` · Visite : ${f.visit_date}`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50">Globale</div>
            {stars(f.experience_globale)}
          </div>
          <button onClick={() => onDelete(f.id)} className="p-1.5 text-[#0A0A0A]/35 hover:text-red-600" title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3 text-[0.8rem]">
        <Row label="Accueil"     stars={stars(f.accueil_arrivee)} />
        <Row label="Service"     stars={stars(f.service_amabilite)} />
        <Row label="Restauration" stars={stars(f.restauration_boissons)} />
        <Row label="Ambiance"    stars={stars(f.ambiance_cadre)} />
        <Row label="Propreté"    stars={stars(f.proprete_confort)} />
      </div>

      {(f.most_appreciated || f.improvement_suggestion || f.staff_member_mention) && (
        <div className="bg-[#FAFAF7] p-4 space-y-3 text-[0.85rem] text-[#0A0A0A]/85">
          {f.most_appreciated && <Quote label="Le plus apprécié" text={f.most_appreciated} />}
          {f.improvement_suggestion && <Quote label="À améliorer" text={f.improvement_suggestion} />}
          {f.staff_member_mention && <Quote label="Membre marquant" text={f.staff_member_mention} />}
        </div>
      )}
    </div>
  );
}

function Row({ label, stars }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#0A0A0A]/65">{label}</span>
      {stars}
    </div>
  );
}

function ScoreCell({ v, highlight }) {
  if (v == null) return <td className="text-center py-3 px-2 text-[#0A0A0A]/25">—</td>;
  const score = Number(v);
  const color = score >= 4.5 ? "bg-green-600" : score >= 3.5 ? "bg-[#B8922A]" : "bg-red-500";
  return (
    <td className={`text-center py-3 px-2 ${highlight ? "font-semibold text-[#B8922A]" : "text-[#0A0A0A]/85"}`}>
      <span className="inline-flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${color}`}></span>
        {score.toFixed(2)}
      </span>
    </td>
  );
}

function Quote({ label, text }) {
  return (
    <div>
      <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-1">{label}</div>
      <div className="italic">« {text} »</div>
    </div>
  );
}

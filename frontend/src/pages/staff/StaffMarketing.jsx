/**
 * Staff Marketing Dashboard — Phase B Revenue Engine.
 *
 * Surfaces the value of the public Vitrine + tracking sink :
 *  - 8 KPI tiles (visitors, page views, leads, conversions…)
 *  - 30/90-day trend chart (visits / leads / purchases)
 *  - Top campaigns (UTM)
 *  - Traffic sources breakdown
 *  - Conversion funnel
 *  - Top pages
 *  - Inbound leads pipeline (contact_messages + newsletter)
 */
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, Users, Eye, MailCheck, ShoppingCart,
  Target, Globe, Percent, RefreshCw, ArrowDownRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend,
} from "recharts";
import { toast } from "sonner";
import api from "../../lib/api";

const PERIODS = [
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "90d", label: "90 jours" },
  { id: "365d", label: "365 jours" },
];

const SOURCE_COLOR = {
  google: "#4285F4",
  facebook: "#1877F2",
  instagram: "#E1306C",
  meta: "#1877F2",
  email: "#B8922A",
  direct: "#0A0A0A",
  unknown: "#9CA3AF",
};

export default function StaffMarketing() {
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState(null);
  const [topOffers, setTopOffers] = useState([]);
  const [abandons, setAbandons] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [dash, offers, ab] = await Promise.all([
        api.get(`/staff/marketing/dashboard?period=${period}`),
        api.get(`/staff/marketing/top-offers?period=${period}`),
        api.get(`/staff/marketing/abandons?period=${period}`),
      ]);
      setData(dash.data);
      setTopOffers(offers.data?.items || []);
      setAbandons(ab.data || null);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de charger les statistiques marketing");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);

  const kpis = data?.kpis || {};
  const trend = data?.trend || [];
  const campaigns = data?.campaigns || [];
  const sources = data?.by_source || [];
  const funnel = data?.funnel || [];
  const topPages = data?.top_pages || [];
  const leadsPipe = data?.leads_pipeline || {};

  const maxFunnel = useMemo(
    () => Math.max(1, ...funnel.map((f) => f.unique_visitors || 0)),
    [funnel]
  );

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8" data-testid="staff-marketing">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-2">
            Revenue Engine · Phase B
          </div>
          <h1 className="font-serif italic font-light text-3xl md:text-5xl leading-tight text-[#0A0A0A]">
            Marketing & Acquisition
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
            ROI de la Vitrine, attribution des campagnes Meta / Google,
            entonnoir de conversion et pipeline de leads.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 text-[0.65rem] tracking-[0.3em] uppercase border transition-colors ${
                period === p.id
                  ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                  : "bg-white text-[#0A0A0A]/75 border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"
              }`}
              data-testid={`mkt-period-${p.id}`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={load}
            className="p-2 ml-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A] transition-colors"
            title="Rafraîchir"
            data-testid="mkt-refresh-btn"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="mkt-kpis">
        <Kpi icon={Users} label="Visiteurs uniques" value={kpis.unique_visitors} loading={loading} testid="kpi-visitors" />
        <Kpi icon={Eye} label="Pages vues" value={kpis.page_views} loading={loading} testid="kpi-pageviews" />
        <Kpi icon={Target} label="Tunnels ouverts" value={kpis.booking_intents} loading={loading} testid="kpi-intents" />
        <Kpi icon={MailCheck} label="Leads capturés" value={kpis.leads} loading={loading} testid="kpi-leads" />
        <Kpi icon={ShoppingCart} label="Réservations payées" value={kpis.purchases} loading={loading} testid="kpi-purchases" />
        <Kpi icon={Percent} label="Taux de conversion" value={kpis.conversion_rate_pct} suffix="%" loading={loading} testid="kpi-conv" />
        <Kpi icon={TrendingUp} label="Taux de lead" value={kpis.lead_rate_pct} suffix="%" loading={loading} testid="kpi-lead-rate" />
        <Kpi icon={Globe} label="Total events" value={kpis.total_events} loading={loading} testid="kpi-events" />
      </div>

      {/* Trend chart */}
      <Card title="Évolution journalière">
        {trend.length === 0 ? (
          <EmptyState text="Pas encore de trafic sur cette période." />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0A0A0A14" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#0A0A0A99" }} />
              <YAxis tick={{ fontSize: 11, fill: "#0A0A0A99" }} />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #0A0A0A22",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="page_view" name="Visites" stroke="#0A0A0A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="view_offer" name="Vue offre" stroke="#B8922A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="start_booking" name="Tunnel" stroke="#1F8FFF" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="submit_lead" name="Leads" stroke="#E1306C" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="purchase" name="Achats" stroke="#16A34A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Funnel + Sources */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Entonnoir de conversion">
          {funnel.length === 0 ? (
            <EmptyState text="Pas encore de données." />
          ) : (
            <div className="space-y-3" data-testid="mkt-funnel">
              {funnel.map((step) => {
                const pct = (step.unique_visitors / maxFunnel) * 100;
                return (
                  <div key={step.event} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#0A0A0A]/75 font-medium">{step.label}</span>
                      <span className="text-[#0A0A0A]">
                        {step.unique_visitors.toLocaleString("fr-FR")}
                        {step.drop_off_pct !== null && step.drop_off_pct > 0 && (
                          <span className="text-[#C24226] ml-2 inline-flex items-center gap-1 text-[10px]">
                            <ArrowDownRight size={12} />
                            -{step.drop_off_pct}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-7 bg-[#0A0A0A]/5 relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#B8922A] to-[#D4B256] transition-all"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Sources de trafic">
          {sources.length === 0 ? (
            <EmptyState text="Aucune source attribuée." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sources} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0A0A0A14" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="source" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #0A0A0A22", fontSize: 12 }}
                />
                <Bar dataKey="unique_visitors" fill="#B8922A" name="Visiteurs uniques" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Campaigns table */}
      <Card title="Top campagnes UTM">
        {campaigns.length === 0 ? (
          <EmptyState text="Aucune campagne UTM détectée sur la période." />
        ) : (
          <div className="overflow-x-auto" data-testid="mkt-campaigns">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[0.6rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                  <th className="text-left py-3">Campagne</th>
                  <th className="text-left py-3">Source</th>
                  <th className="text-left py-3">Médium</th>
                  <th className="text-right py-3">Events</th>
                  <th className="text-right py-3">Visiteurs uniques</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr
                    key={`${c.campaign}-${c.source}-${i}`}
                    className="border-b border-[#0A0A0A]/5 hover:bg-[#FAF7F2] transition-colors"
                  >
                    <td className="py-3 font-medium">{c.campaign || "—"}</td>
                    <td className="py-3">
                      <SourceBadge source={c.source} />
                    </td>
                    <td className="py-3 text-[#0A0A0A]/70">{c.medium || "—"}</td>
                    <td className="py-3 text-right tabular-nums">{c.events.toLocaleString("fr-FR")}</td>
                    <td className="py-3 text-right tabular-nums font-medium">
                      {c.unique_visitors.toLocaleString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Top pages + Leads pipeline */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Top pages visitées" className="lg:col-span-2">
          {topPages.length === 0 ? (
            <EmptyState text="Pas encore de pages vues." />
          ) : (
            <ul className="space-y-2" data-testid="mkt-top-pages">
              {topPages.slice(0, 10).map((p, i) => (
                <li key={i} className="flex items-center justify-between text-sm py-2 border-b border-[#0A0A0A]/5">
                  <span className="font-mono text-xs text-[#0A0A0A]/75 truncate flex-1">
                    {p.page || "/"}
                  </span>
                  <div className="flex items-center gap-6 ml-4 text-xs">
                    <span className="tabular-nums">
                      <strong>{p.views}</strong> vues
                    </span>
                    <span className="tabular-nums text-[#B8922A]">
                      {p.unique_visitors} uv
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Pipeline de leads">
          <div className="space-y-5" data-testid="mkt-leads-pipeline">
            <LeadRow
              label="Messages contact"
              total={leadsPipe.contact_messages_total}
              extra={`${leadsPipe.contact_messages_new || 0} nouveaux`}
              color="#B8922A"
            />
            <LeadRow
              label="Newsletter — Inscrits"
              total={leadsPipe.newsletter_total}
              extra={`${leadsPipe.newsletter_active || 0} actifs`}
              color="#16A34A"
            />
            <div className="pt-4 border-t border-[#0A0A0A]/10 text-xs text-[#0A0A0A]/55 leading-relaxed">
              Tous les leads sont attribués à leur campagne d'origine
              (UTM source / medium / campaign). Ouvrez les pages dédiées
              pour exporter en CSV ou répondre.
            </div>
          </div>
        </Card>
      </div>

      {/* Top Offers */}
      <Card title="Top offres — vues, démarrages, conversions">
        {topOffers.length === 0 ? (
          <EmptyState text="Pas encore de données d'offres pour cette période." />
        ) : (
          <div className="overflow-x-auto" data-testid="top-offers-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                  <th className="py-2 pr-4">Offre</th>
                  <th className="py-2 px-2 text-right">Vues</th>
                  <th className="py-2 px-2 text-right">Démarrages</th>
                  <th className="py-2 px-2 text-right">Achats</th>
                  <th className="py-2 px-2 text-right">Vue → Démarrage</th>
                  <th className="py-2 px-2 text-right">Vue → Achat</th>
                </tr>
              </thead>
              <tbody>
                {topOffers.slice(0, 12).map((o) => (
                  <tr key={o.offer} className="border-b border-[#0A0A0A]/5 hover:bg-[#FAF7F2]/40">
                    <td className="py-2 pr-4 truncate max-w-xs">{o.offer}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{o.views}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{o.starts}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-[#15803D]">{o.purchases}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-[#0A0A0A]/65">{o.view_to_start_pct}%</td>
                    <td className="py-2 px-2 text-right tabular-nums text-[#B8922A]">{o.view_to_purchase_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Abandons */}
      {abandons && (
        <Card title="Abandons de réservation">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5" data-testid="abandons-summary">
            <Kpi icon={ShoppingCart} label="Démarrages" value={abandons.summary?.started_booking} loading={loading} testid="ab-starts" />
            <Kpi icon={ShoppingCart} label="Achats" value={abandons.summary?.completed_purchase} loading={loading} testid="ab-purch" />
            <Kpi icon={ArrowDownRight} label="Abandons" value={abandons.summary?.abandoned} loading={loading} testid="ab-abandon" />
            <Kpi icon={Percent} label="Taux d'abandon" value={abandons.summary?.abandon_rate_pct} suffix="%" loading={loading} testid="ab-rate" />
            <Kpi icon={MailCheck} label="Abandons avec lead" value={abandons.summary?.abandoned_with_lead} loading={loading} testid="ab-with-lead" />
          </div>
          {abandons.per_offer?.length > 0 ? (
            <div className="overflow-x-auto" data-testid="abandons-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                    <th className="py-2 pr-4">Offre</th>
                    <th className="py-2 px-2 text-right">Démarrages</th>
                    <th className="py-2 px-2 text-right">Abandons</th>
                    <th className="py-2 px-2 text-right">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {abandons.per_offer.map((o) => (
                    <tr key={o.offer} className="border-b border-[#0A0A0A]/5 hover:bg-[#FAF7F2]/40">
                      <td className="py-2 pr-4 truncate max-w-xs">{o.offer}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{o.started}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-red-600">{o.abandoned}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{o.abandon_rate_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-[#0A0A0A]/55">Pas d'abandons par offre identifiés.</div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function Kpi({ icon: Icon, label, value, suffix = "", loading, testid }) {
  return (
    <div
      className="bg-white border border-[#0A0A0A]/10 p-5 hover:border-[#B8922A] transition-colors"
      data-testid={testid}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-[0.55rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55">
          {label}
        </div>
        <Icon size={16} className="text-[#B8922A]" strokeWidth={1.5} />
      </div>
      <div className="font-serif italic font-light text-3xl text-[#0A0A0A] tabular-nums">
        {loading ? "…" : (
          value === null || value === undefined
            ? "—"
            : `${typeof value === "number" ? value.toLocaleString("fr-FR") : value}${suffix}`
        )}
      </div>
    </div>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <section className={`bg-white border border-[#0A0A0A]/10 p-6 ${className}`}>
      <h2 className="text-[0.65rem] tracking-[0.4em] uppercase text-[#0A0A0A]/65 mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SourceBadge({ source }) {
  const key = (source || "").toLowerCase();
  const color = SOURCE_COLOR[key] || "#9CA3AF";
  return (
    <span
      className="inline-flex items-center gap-2 px-2 py-1 text-xs font-medium"
      style={{ color, background: `${color}15` }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {source || "direct"}
    </span>
  );
}

function LeadRow({ label, total, extra, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-[#0A0A0A]/75">{label}</span>
        <span className="font-serif italic text-2xl" style={{ color }}>
          {total ?? 0}
        </span>
      </div>
      <div className="text-[0.65rem] tracking-[0.2em] uppercase text-[#0A0A0A]/45">
        {extra}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-12 text-sm text-[#0A0A0A]/45">
      {text}
    </div>
  );
}

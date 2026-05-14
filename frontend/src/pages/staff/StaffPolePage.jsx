import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { API, getStaffToken } from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { toast } from "sonner";
import {
  CalendarDays, Wallet, Users, ArrowRight, ChevronRight, Briefcase, BedDouble,
  UtensilsCrossed, Waves, CalendarHeart, TrendingUp, Clock, Download,
  ShoppingBag, Sparkles, Ban,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

const PAYMENT_METHOD_LABEL = {
  cash: "Espèces", card: "Carte", mobile_money: "Mobile Money",
  fineo: "FINEO", deposit: "Acompte", unknown: "Non défini",
};
const STATUS_FR = {
  pending: "En attente", confirmed: "Confirmée", arrived: "Arrivée",
  completed: "Terminée", cancelled: "Annulée",
};
const STATUS_COLORS = ["#94A3B8", "#B8922A", "#16A34A", "#3B82F6", "#DC2626"];

const POLE_ICON = {
  beach_club: Waves,
  hebergement: BedDouble,
  corporate: Briefcase,
  activites_events: CalendarHeart,
  le_kaai: UtensilsCrossed,
};
const POLE_ACCENT = {
  beach_club: "#B8922A",
  hebergement: "#3B82F6",
  corporate: "#64748B",
  activites_events: "#E11D48",
  le_kaai: "#A855F7",
};

const STATUS_LABEL = {
  pending: "En attente",
  confirmed: "Confirmée",
  arrived: "Arrivée",
  completed: "Terminée",
  cancelled: "Annulée",
};

function fmtDateFR(iso) {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function Kpi({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="bg-white border border-[#0A0A0A]/8 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">{label}</span>
        <Icon size={14} style={{ color: accent }} />
      </div>
      <div className="text-2xl md:text-3xl font-display-serif text-[#0A0A0A]">{value}</div>
      {sub && <div className="text-[0.7rem] text-[#0A0A0A]/45 mt-1.5">{sub}</div>}
    </div>
  );
}

function fmtDateShort(iso) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

async function exportPdf(poleId, setDownloading) {
  setDownloading(true);
  try {
    const token = getStaffToken();
    const res = await fetch(`${API}/staff/poles/${poleId}/report.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      toast.error(res.status === 403 ? "Accès refusé" : "Export PDF impossible");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    a.download = `bbr-pole-${poleId}-${today}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Rapport PDF téléchargé");
  } catch {
    toast.error("Erreur lors du téléchargement");
  } finally {
    setDownloading(false);
  }
}

function MetricTile({ label, value, sub, tone = "neutral" }) {
  const TONE_BG = {
    neutral: "bg-white border-[#0A0A0A]/8",
    good: "bg-green-50/60 border-green-200",
    warn: "bg-amber-50/60 border-amber-200",
    bad: "bg-red-50/60 border-red-200",
  };
  return (
    <div className={`border p-4 ${TONE_BG[tone] || TONE_BG.neutral}`}>
      <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">{label}</div>
      <div className="font-display-serif text-2xl text-[#0A0A0A] mt-0.5">{value}</div>
      {sub && <div className="text-[0.65rem] text-[#0A0A0A]/55 mt-1">{sub}</div>}
    </div>
  );
}

function PoleAnalytics({ analytics, sub_offers, accent }) {
  if (!analytics) return null;
  const {
    daily_trend = [], by_status = [], by_payment_method = [], by_weekday = [],
    by_boat_time = [], top_clients = [],
    avg_basket = 0, avg_lead_time_days = 0, cancellation_rate = 0, paid_rate = 0,
    guests_breakdown = { adults: 0, children: 0 }, revenue_paid_30d = 0,
  } = analytics;

  const dailyChart = daily_trend.map((d) => ({ ...d, label: fmtDateShort(d.date) }));
  const statusData = by_status
    .filter((s) => s.count > 0)
    .map((s) => ({ name: STATUS_FR[s.status] || s.status, value: s.count, raw: s.status }));
  const paymentData = by_payment_method
    .filter((p) => p.count > 0)
    .map((p) => ({ name: PAYMENT_METHOD_LABEL[p.method] || p.method, count: p.count, total: p.total }));
  const cancellationTone = cancellation_rate > 10 ? "bad" : cancellation_rate > 5 ? "warn" : "good";
  const paidRateTone = paid_rate >= 80 ? "good" : paid_rate >= 50 ? "warn" : "bad";

  return (
    <div className="mb-8 space-y-6" data-testid="pole-analytics">
      <div className="flex items-center justify-between">
        <h2 className="font-display-serif text-xl md:text-2xl text-[#0A0A0A] inline-flex items-center gap-2.5">
          <TrendingUp size={20} style={{ color: accent }} /> Analyses statistiques
        </h2>
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">30 derniers jours</span>
      </div>

      {/* Health metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="analytics-metrics">
        <MetricTile label="Panier moyen" value={formatXOF(avg_basket)} sub="par réservation active" />
        <MetricTile label="Délai moyen" value={`${avg_lead_time_days} j`} sub="entre réservation et venue" />
        <MetricTile label="Taux de paiement" value={`${paid_rate}%`} sub={`${formatXOF(revenue_paid_30d)} encaissés`} tone={paidRateTone} />
        <MetricTile label="Taux d'annulation" value={`${cancellation_rate}%`} sub="vs total période" tone={cancellationTone} />
        <MetricTile
          label="Convives"
          value={(guests_breakdown.adults || 0) + (guests_breakdown.children || 0)}
          sub={`${guests_breakdown.adults || 0} adulte${guests_breakdown.adults > 1 ? "s" : ""} · ${guests_breakdown.children || 0} enfant${guests_breakdown.children > 1 ? "s" : ""}`}
        />
      </div>

      {/* Revenue trend (area) */}
      <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6" data-testid="analytics-daily-trend">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display-serif text-base text-[#0A0A0A]">Tendance du chiffre d'affaires</h3>
          <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Quotidien</span>
        </div>
        {dailyChart.length === 0 ? (
          <p className="text-sm text-[#0A0A0A]/45 py-8 text-center">Aucune donnée sur la période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradPole-${accent}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accent} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E2" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94948D" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94948D" tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} width={40} />
              <Tooltip formatter={(v, name) => [name === "revenue" ? formatXOF(v) : v, name === "revenue" ? "CA" : "Résa"]} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="revenue" stroke={accent} strokeWidth={2} fill={`url(#gradPole-${accent})`} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status pipeline */}
        <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6" data-testid="analytics-status">
          <h3 className="font-display-serif text-base text-[#0A0A0A] mb-4">Pipeline des statuts</h3>
          {statusData.length === 0 ? (
            <p className="text-sm text-[#0A0A0A]/45 py-8 text-center">—</p>
          ) : (
            <div className="flex items-center gap-5">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                    {statusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-1.5">
                {statusData.map((s, i) => (
                  <li key={s.raw} className="flex items-center justify-between text-[0.78rem]">
                    <span className="inline-flex items-center gap-2 text-[#0A0A0A]/75">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: STATUS_COLORS[i % STATUS_COLORS.length] }} />
                      {s.name}
                    </span>
                    <span className="text-[#0A0A0A] tabular-nums">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Payment methods */}
        <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6" data-testid="analytics-payment-methods">
          <h3 className="font-display-serif text-base text-[#0A0A0A] mb-4">Méthodes de paiement</h3>
          {paymentData.length === 0 ? (
            <p className="text-sm text-[#0A0A0A]/45 py-8 text-center">Aucun paiement.</p>
          ) : (
            <div className="space-y-2">
              {paymentData.sort((a, b) => b.total - a.total).map((p) => {
                const totalAll = paymentData.reduce((s, x) => s + x.total, 0) || 1;
                const pct = Math.round((p.total / totalAll) * 100);
                return (
                  <div key={p.name}>
                    <div className="flex items-baseline justify-between text-[0.78rem] mb-1">
                      <span className="text-[#0A0A0A]/75">{p.name} <span className="text-[#0A0A0A]/40">({p.count})</span></span>
                      <span className="text-[#0A0A0A] tabular-nums">{formatXOF(p.total)}</span>
                    </div>
                    <div className="h-1.5 bg-[#FAFAF7]">
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Weekday distribution */}
        <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6" data-testid="analytics-weekday">
          <h3 className="font-display-serif text-base text-[#0A0A0A] mb-4">Répartition par jour de semaine</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={by_weekday}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E2" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#94948D" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94948D" width={28} />
              <Tooltip formatter={(v, name) => [name === "count" ? `${v} résa` : formatXOF(v), name === "count" ? "Réservations" : "CA"]} contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" fill={accent} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top boat times */}
        <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6" data-testid="analytics-boat-times">
          <h3 className="font-display-serif text-base text-[#0A0A0A] mb-4">
            <Clock size={13} className="inline mr-1.5 -mt-0.5" style={{ color: accent }} />
            Horaires de traversée les plus demandés
          </h3>
          {by_boat_time.length === 0 ? (
            <p className="text-sm text-[#0A0A0A]/45 py-8 text-center">—</p>
          ) : (
            <ul className="space-y-2">
              {by_boat_time.map((b) => {
                const max = Math.max(...by_boat_time.map((x) => x.count)) || 1;
                const pct = Math.round((b.count / max) * 100);
                return (
                  <li key={b.boat_time} className="flex items-center gap-3 text-[0.78rem]">
                    <span className="w-10 text-[#0A0A0A] tabular-nums">{b.boat_time}</span>
                    <div className="flex-1 h-2 bg-[#FAFAF7]">
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
                    </div>
                    <span className="w-8 text-right text-[#0A0A0A]/65 tabular-nums">{b.count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Occupancy + Top clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6" data-testid="analytics-occupancy">
          <h3 className="font-display-serif text-base text-[#0A0A0A] mb-4">Taux d'occupation par sous-offre</h3>
          {sub_offers.filter((s) => !s.is_synthetic && s.max_capacity > 0).length === 0 ? (
            <p className="text-sm text-[#0A0A0A]/45 py-8 text-center">Aucune sous-offre à capacité bornée.</p>
          ) : (
            <ul className="space-y-3">
              {sub_offers.filter((s) => !s.is_synthetic && s.max_capacity > 0).map((s) => {
                const pct = s.occupancy_pct ?? 0;
                const tone = pct >= 80 ? "#16A34A" : pct >= 40 ? accent : "#94A3B8";
                return (
                  <li key={s.id}>
                    <div className="flex items-baseline justify-between text-[0.78rem] mb-1">
                      <span className="text-[#0A0A0A]/75">{s.name_fr}</span>
                      <span className="text-[#0A0A0A] tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 bg-[#FAFAF7]">
                      <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: tone }} />
                    </div>
                    <div className="text-[0.65rem] text-[#0A0A0A]/45 mt-0.5">
                      {s.stats?.count || 0} réservation{(s.stats?.count || 0) > 1 ? "s" : ""} · capacité {s.max_capacity}/jour
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6" data-testid="analytics-top-clients">
          <h3 className="font-display-serif text-base text-[#0A0A0A] mb-4">Top clients (CA)</h3>
          {top_clients.length === 0 ? (
            <p className="text-sm text-[#0A0A0A]/45 py-8 text-center">Aucun client sur la période.</p>
          ) : (
            <ol className="space-y-2.5">
              {top_clients.map((c, i) => (
                <li key={c.phone} className="flex items-center gap-3 text-[0.78rem]">
                  <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[0.62rem] font-medium text-white tabular-nums" style={{ backgroundColor: i === 0 ? accent : "#94A3B8" }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#0A0A0A] truncate">{c.name}</div>
                    <div className="text-[0.65rem] text-[#0A0A0A]/45">{c.phone} · {c.count} résa</div>
                  </div>
                  <span className="text-[#0A0A0A] tabular-nums whitespace-nowrap">{formatXOF(c.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function WalletStats({ wallet, accent }) {
  const k = wallet.kpis || {};
  const byCategory = wallet.by_category || [];
  const topItems = wallet.top_items || [];
  const dailyTrend = (wallet.daily_trend || []).map((d) => ({ ...d, label: fmtDateShort(d.date) }));
  const totalCat = byCategory.reduce((s, c) => s + (c.revenue || 0), 0) || 1;

  if (!k.active_count && !k.voided_count) {
    return (
      <div className="mb-8 space-y-6" data-testid="pole-wallet-stats-empty">
        <div className="flex items-center justify-between">
          <h2 className="font-display-serif text-xl md:text-2xl text-[#0A0A0A] inline-flex items-center gap-2.5">
            <ShoppingBag size={20} style={{ color: accent }} /> Consommation sur place
          </h2>
          <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">30 derniers jours</span>
        </div>
        <div className="bg-white border border-[#0A0A0A]/8 p-8 text-center text-sm text-[#0A0A0A]/55">
          Aucune charge enregistrée sur les wallets clients.
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-6" data-testid="pole-wallet-stats">
      <div className="flex items-center justify-between">
        <h2 className="font-display-serif text-xl md:text-2xl text-[#0A0A0A] inline-flex items-center gap-2.5">
          <ShoppingBag size={20} style={{ color: accent }} /> Consommation sur place
        </h2>
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">30 derniers jours · Wallets</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="wallet-stats-kpis">
        <MetricTile label="Charges actives" value={k.active_count || 0} sub={`Panier moyen ${formatXOF(k.avg_charge || 0)}`} />
        <MetricTile label="CA encaissé" value={formatXOF(k.total_revenue || 0)} sub="Transactions confirmées" tone="good" />
        <MetricTile
          label="Annulées"
          value={k.voided_count || 0}
          sub={k.voided_amount ? `${formatXOF(k.voided_amount)} annulés` : "—"}
          tone={k.voided_count > 0 ? "warn" : "neutral"}
        />
        <MetricTile
          label="Mix catégories"
          value={byCategory.length}
          sub={byCategory[0] ? `Top: ${byCategory[0].category}` : "—"}
        />
      </div>

      <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6" data-testid="wallet-stats-daily">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display-serif text-base text-[#0A0A0A]">Tendance quotidienne (consommation)</h3>
          <Link to="/staff/consommation" className="text-[0.65rem] uppercase tracking-[0.22em] text-[#B8922A] hover:underline" data-testid="wallet-stats-deep-link">
            Détail complet <ChevronRight size={11} className="inline -mt-0.5" />
          </Link>
        </div>
        {dailyTrend.length === 0 ? (
          <p className="text-sm text-[#0A0A0A]/45 py-8 text-center">Aucune donnée sur la période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradWallet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accent} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E2" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94948D" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94948D" tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} width={40} />
              <Tooltip formatter={(v, name) => [name === "revenue" ? formatXOF(v) : v, name === "revenue" ? "CA" : "Charges"]} contentStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="revenue" stroke={accent} strokeWidth={2} fill="url(#gradWallet)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6" data-testid="wallet-stats-by-category">
          <h3 className="font-display-serif text-base text-[#0A0A0A] mb-4 inline-flex items-center gap-2">
            <Sparkles size={14} style={{ color: accent }} /> Répartition par catégorie
          </h3>
          {byCategory.length === 0 ? (
            <p className="text-sm text-[#0A0A0A]/45 py-8 text-center">—</p>
          ) : (
            <div className="space-y-2.5">
              {byCategory.map((c) => {
                const pct = Math.round((c.revenue / totalCat) * 100);
                return (
                  <div key={c.category}>
                    <div className="flex items-baseline justify-between text-[0.78rem] mb-1">
                      <span className="text-[#0A0A0A]/75">{c.category} <span className="text-[#0A0A0A]/40">({c.count})</span></span>
                      <span className="text-[#0A0A0A] tabular-nums">{formatXOF(c.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-[#FAFAF7]">
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6" data-testid="wallet-stats-top-items">
          <h3 className="font-display-serif text-base text-[#0A0A0A] mb-4">Top consommations</h3>
          {topItems.length === 0 ? (
            <p className="text-sm text-[#0A0A0A]/45 py-8 text-center">—</p>
          ) : (
            <ol className="space-y-2.5">
              {topItems.map((it, i) => (
                <li key={it.activity_id} className="flex items-center gap-3 text-[0.78rem]">
                  <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[0.62rem] font-medium text-white tabular-nums" style={{ backgroundColor: i === 0 ? accent : "#94A3B8" }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#0A0A0A] truncate">{it.label}</div>
                    <div className="text-[0.65rem] text-[#0A0A0A]/45 truncate">
                      {it.category} · {it.subcategory} · {it.quantity || it.count} u.
                    </div>
                  </div>
                  <span className="text-[#0A0A0A] tabular-nums whitespace-nowrap">{formatXOF(it.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {k.voided_count > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 p-4 inline-flex items-start gap-2.5 text-[0.78rem] text-amber-900" data-testid="wallet-stats-voided-notice">
          <Ban size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            <strong className="font-medium">{k.voided_count}</strong> charge{k.voided_count > 1 ? "s" : ""} annulée{k.voided_count > 1 ? "s" : ""}
            {k.voided_amount > 0 ? ` (${formatXOF(k.voided_amount)})` : ""} sur la période. Pensez à analyser les motifs avec l'équipe terrain.
          </span>
        </div>
      )}
    </div>
  );
}

export default function StaffPolePage() {
  const { poleId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    api.get(`/staff/poles/${poleId}/overview`)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch((e) => {
        if (cancelled) return;
        if (e.response?.status === 404) toast.error("Pôle introuvable");
        else if (e.response?.status === 403) toast.error("Accès refusé");
        else toast.error("Erreur de chargement");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [poleId]);

  if (loading) return <div className="p-10 text-[#0A0A0A]/50">Chargement…</div>;
  if (!data) return <div className="p-10 text-red-600">Impossible de charger ce pôle.</div>;

  const { pole, kpis, sub_offers, recent_bookings } = data;
  const Icon = POLE_ICON[pole.id] || Briefcase;
  const accent = POLE_ACCENT[pole.id] || "#B8922A";

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid={`staff-pole-page-${pole.id}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.28em]" style={{ color: accent }}>
            Pôle {pole.sort_order} · BBr
          </div>
          <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] inline-flex items-center gap-3 mt-1">
            <Icon size={26} style={{ color: accent }} /> {pole.name_fr}
          </h1>
          {pole.tagline_fr && (
            <p className="text-sm text-[#0A0A0A]/55 mt-1.5 max-w-2xl">{pole.tagline_fr}</p>
          )}
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => exportPdf(pole.id, setDownloading)}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/75 hover:border-[#B8922A] hover:text-[#B8922A] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            data-testid={`pole-export-pdf-${pole.id}`}
          >
            <Download size={13} /> {downloading ? "…" : "Export PDF"}
          </button>
          <Link
            to={`/staff/reservations?pole=${pole.id}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] text-white hover:opacity-90 transition-all"
            style={{ backgroundColor: accent }}
            data-testid={`pole-reservations-link-${pole.id}`}
          >
            Toutes les réservations <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Kpi
          icon={CalendarDays}
          label="Aujourd'hui"
          value={kpis.today?.count || 0}
          sub={`${kpis.today?.guests || 0} client${(kpis.today?.guests || 0) > 1 ? "s" : ""} attendu${(kpis.today?.guests || 0) > 1 ? "s" : ""}`}
          accent={accent}
        />
        <Kpi
          icon={Wallet}
          label="Revenus du jour"
          value={formatXOF(kpis.today?.revenue || 0)}
          sub="payés"
          accent={accent}
        />
        <Kpi
          icon={CalendarDays}
          label="30 derniers jours"
          value={kpis.last_30d?.count || 0}
          sub={`${formatXOF(kpis.last_30d?.revenue || 0)}`}
          accent={accent}
        />
        <Kpi
          icon={Users}
          label="Sous-offres actives"
          value={sub_offers.filter((s) => (s.stats?.count || 0) > 0).length}
          sub={`${sub_offers.length} configurée${sub_offers.length > 1 ? "s" : ""}`}
          accent={accent}
        />
      </div>

      {/* Sub-offers breakdown */}
      <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6 mb-8" data-testid="pole-sub-offers-breakdown">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display-serif text-xl text-[#0A0A0A]">Sous-offres</h2>
          <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Activité 30 jours</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {sub_offers.map((s) => {
            const count = s.stats?.count || 0;
            const revenue = s.stats?.revenue || 0;
            return (
              <Link
                key={s.id}
                to={`/staff/reservations?pole=${pole.id}`}
                className="border border-[#0A0A0A]/8 p-4 hover:border-[#B8922A] transition-colors group"
                data-testid={`pole-sub-offer-${s.id}`}
              >
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm font-medium text-[#0A0A0A] group-hover:text-[#B8922A] transition-colors">
                    {s.name_fr}
                  </span>
                  {s.is_synthetic && (
                    <span className="text-[0.55rem] uppercase tracking-[0.22em] px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200">
                      Synthétique
                    </span>
                  )}
                </div>
                {s.schedule_fr && <div className="text-[0.65rem] text-[#0A0A0A]/55 mb-3">{s.schedule_fr}</div>}
                {!s.is_synthetic && s.price_adult > 0 && (
                  <div className="text-[0.7rem] text-[#0A0A0A]/65 mb-3">
                    {formatXOF(s.price_adult)} <span className="text-[#0A0A0A]/40">/ adulte</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#0A0A0A]/8">
                  <div>
                    <div className="text-[0.55rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Réservations</div>
                    <div className="text-lg font-display-serif text-[#0A0A0A]">{count}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[0.55rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">CA</div>
                    <div className="text-[0.85rem] font-medium" style={{ color: accent }}>{formatXOF(revenue)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick access to operational modules */}
      {pole.id === "hebergement" && (
        <div className="bg-white border border-[#0A0A0A]/8 p-5 mb-8 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[#0A0A0A]">Occupation des chambres</div>
            <div className="text-[0.72rem] text-[#0A0A0A]/55 mt-0.5">Inventaire en temps réel par catégorie</div>
          </div>
          <Link to="/staff/hebergement" className="inline-flex items-center gap-2 px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/75 hover:border-[#B8922A] hover:text-[#B8922A]" data-testid="hebergement-module-link">
            Voir l'occupation <ChevronRight size={13} />
          </Link>
        </div>
      )}
      {pole.id === "le_kaai" && (
        <div className="bg-white border border-[#0A0A0A]/8 p-5 mb-8 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[#0A0A0A]">Plan de salle Le Kaai</div>
            <div className="text-[0.72rem] text-[#0A0A0A]/55 mt-0.5">Capacité par zone (Terrasse 1, 2, Salle)</div>
          </div>
          <Link to="/staff/kaai" className="inline-flex items-center gap-2 px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/75 hover:border-[#B8922A] hover:text-[#B8922A]" data-testid="kaai-module-link">
            Gérer les tables <ChevronRight size={13} />
          </Link>
        </div>
      )}
      {pole.id === "activites_events" && (
        <div className="bg-white border border-[#0A0A0A]/8 p-5 mb-8 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[#0A0A0A]">Événements spéciaux</div>
            <div className="text-[0.72rem] text-[#0A0A0A]/55 mt-0.5">CRUD + Mise en avant du prochain Event Maison</div>
          </div>
          <Link to="/staff/evenements-speciaux" className="inline-flex items-center gap-2 px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/75 hover:border-[#B8922A] hover:text-[#B8922A]" data-testid="events-module-link">
            Gérer les events <ChevronRight size={13} />
          </Link>
        </div>
      )}

      {/* ==================== ANALYTICS ==================== */}
      <PoleAnalytics analytics={data.analytics} sub_offers={sub_offers} accent={accent} />

      {/* ==================== CONSOMMATION SUR PLACE (wallet) ==================== */}
      {pole.id === "activites_events" && data.wallet_stats && (
        <WalletStats wallet={data.wallet_stats} accent={accent} />
      )}

      {/* Recent bookings */}
      <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display-serif text-xl text-[#0A0A0A]">Réservations récentes</h2>
          <Link to={`/staff/reservations?pole=${pole.id}`} className="text-[0.65rem] uppercase tracking-[0.22em] text-[#B8922A] hover:underline">
            Voir tout
          </Link>
        </div>
        {recent_bookings.length === 0 ? (
          <p className="text-sm text-[#0A0A0A]/45 py-10 text-center">Aucune réservation pour ce pôle.</p>
        ) : (
          <div className="divide-y divide-[#0A0A0A]/5" data-testid="pole-recent-bookings">
            {recent_bookings.map((b) => {
              const primary = (b.participants && b.participants[0]) || {};
              const guestName = primary.surname || primary.name
                ? `${primary.surname || ""} ${primary.name || ""}`.trim()
                : b.phone || "—";
              return (
                <div key={b.id} className="py-3 flex items-center gap-4">
                  <div className="text-[0.7rem] tabular-nums w-14 text-center" style={{ color: accent }}>
                    {b.boat_time || "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#0A0A0A] truncate">{guestName}</div>
                    <div className="text-[0.7rem] text-[#0A0A0A]/55 truncate">
                      {b.offer_name} · {fmtDateFR(b.date)} · {b.adults}A{b.children > 0 ? ` + ${b.children}E` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-[#0A0A0A] tabular-nums">{formatXOF(b.total_amount || 0)}</div>
                    <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/45 mt-0.5">{STATUS_LABEL[b.status] || b.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, RefreshCw, Search, Mail, Loader2, ExternalLink,
  Phone, Calendar, TrendingDown, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const fmt = (n) => `${(n || 0).toLocaleString("fr-FR")} FCFA`;
const dateStr = (iso) => (iso || "").slice(0, 10);
const timeStr = (iso) => (iso || "").slice(11, 16);

export default function StaffPendingBookings() {
  const [data, setData] = useState({ items: [], total: 0, total_pending_amount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(90);
  const [sending, setSending] = useState(null); // booking_id during email send

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const { data: d } = await api.get("/staff/bookings/pending", {
        params: { days, search: search.trim() || undefined },
      });
      setData(d);
      setLastRefresh(new Date());
      if (silent) toast.success("Données mises à jour");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec du chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const relancer = async (booking) => {
    setSending(booking.id);
    try {
      const { data: r } = await api.post(`/staff/bookings/${booking.id}/resend-payment-link`);
      if (r.email_sent) {
        toast.success(`Email de relance envoyé à ${booking.email}`);
      } else {
        toast.error(`Email non envoyé : ${r.email_error || "erreur inconnue"}`);
      }
      load({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la relance");
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-7xl" data-testid="staff-pending-bookings">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-1 inline-flex items-center gap-1.5">
            <AlertTriangle size={11} /> Suivi commercial
          </div>
          <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A]">
            Réservations en attente de paiement
          </h1>
          <p className="text-sm text-[#0A0A0A]/60 mt-1 max-w-2xl">
            Paniers abandonnés (tunnel en ligne — paiement non finalisé).
            Relancer par email envoie un nouveau lien de paiement FineoPay valide 7 jours.
          </p>
        </div>
        <button
          onClick={() => load({ silent: true })}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#0A0A0A]/10 hover:border-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#B8922A] disabled:opacity-50"
          data-testid="pending-refresh"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Rafraîchir
        </button>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="En attente" value={data.total} icon={Clock} tone="warning"
                 testid="pending-kpi-total" />
        <KpiCard label="CA à récupérer" value={fmt(data.total_pending_amount)}
                 icon={TrendingDown} tone="danger" testid="pending-kpi-amount" />
        <KpiCard label="Relancés ≥ 1 fois"
                 value={data.items.filter((b) => (b.relance_count || 0) > 0).length}
                 icon={Mail} tone="neutral" testid="pending-kpi-relanced" />
        <KpiCard label="Anciens > 14j"
                 value={data.items.filter((b) => b.is_stale).length}
                 icon={AlertTriangle} tone="danger" testid="pending-kpi-stale" />
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#0A0A0A]/10 p-3 sm:p-4 flex items-center gap-2 flex-wrap" data-testid="pending-filters">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/40" />
          <input
            type="text"
            placeholder="Rechercher (téléphone, email, nom, prénom)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
            data-testid="pending-search"
          />
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
          data-testid="pending-days-filter"
        >
          <option value={7}>Derniers 7 jours</option>
          <option value={30}>Derniers 30 jours</option>
          <option value={90}>Derniers 90 jours</option>
          <option value={365}>Derniers 365 jours</option>
        </select>
      </div>

      {lastRefresh && (
        <div className="text-[0.7rem] text-[#0A0A0A]/45 -mt-3" data-testid="pending-last-refresh">
          Dernière mise à jour : {lastRefresh.toLocaleTimeString("fr-FR")} ·
          {" "}{data.total} réservation{data.total > 1 ? "s" : ""} en attente
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#0A0A0A]/10 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#B8922A]" size={24} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="pending-table">
              <thead>
                <tr className="bg-[#FAF7F2] text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 text-left">
                  <th className="px-4 py-2.5">Réf.</th>
                  <th className="px-4 py-2.5">Client</th>
                  <th className="px-4 py-2.5 hidden md:table-cell">Contact</th>
                  <th className="px-4 py-2.5">Offre</th>
                  <th className="px-4 py-2.5 hidden sm:table-cell">Date</th>
                  <th className="px-4 py-2.5">Montant</th>
                  <th className="px-4 py-2.5 hidden lg:table-cell">Créé</th>
                  <th className="px-4 py-2.5 hidden lg:table-cell">Relances</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-[#0A0A0A]/45">
                      <CheckCircle2 className="inline mr-2 text-emerald-500" size={16} />
                      Aucune réservation en attente — bravo !
                    </td>
                  </tr>
                ) : data.items.map((b) => {
                  const name = `${b.surname || ""} ${b.name || ""}`.trim()
                    || (b.participants?.[0]
                        ? `${b.participants[0].surname || ""} ${b.participants[0].name || ""}`.trim()
                        : "—");
                  return (
                    <tr key={b.id} className={`border-t border-[#0A0A0A]/5 hover:bg-[#FAF7F2]/60 ${b.is_stale ? "bg-red-50/30" : ""}`}
                        data-testid={`pending-row-${b.id.slice(0, 8)}`}>
                      <td className="px-4 py-2.5 font-mono text-[#0A0A0A] text-xs">
                        {b.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[#0A0A0A]">{name || "—"}</div>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-[0.78rem] text-[#0A0A0A]/70">
                        {b.email && <div className="truncate max-w-[220px]">{b.email}</div>}
                        {b.phone && <div className="text-[#0A0A0A]/55 font-mono">{b.phone}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-[#0A0A0A]/70 text-[0.78rem]">
                        {b.offer_name || b.offer_type}
                        {b.boat_time && <span className="text-[#0A0A0A]/45"> · {b.boat_time}</span>}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell text-[0.78rem] text-[#0A0A0A]/70">
                        {b.date}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{fmt(b.total_amount)}</td>
                      <td className="px-4 py-2.5 hidden lg:table-cell text-[0.78rem] text-[#0A0A0A]/55">
                        {b.age_days !== null && (
                          <span className={b.is_stale ? "text-red-500" : ""}>
                            il y a {b.age_days}j
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell text-[0.78rem]">
                        {b.relance_count > 0 ? (
                          <span className="text-[#B8922A]">
                            {b.relance_count}× · {timeStr(b.last_relance_at) || dateStr(b.last_relance_at)}
                          </span>
                        ) : (
                          <span className="text-[#0A0A0A]/35">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => relancer(b)}
                          disabled={sending === b.id || !b.email}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-40 text-white text-[0.65rem] uppercase tracking-[0.18em]"
                          data-testid={`pending-relance-${b.id.slice(0, 8)}`}
                          title={!b.email ? "Pas d'email — relance impossible" : `Renvoyer le lien de paiement à ${b.email}`}
                        >
                          {sending === b.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Mail size={12} />}
                          {sending === b.id ? "Envoi…" : "Relancer"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone, testid }) {
  const tones = {
    primary: { bg: "#FAF3DC", color: "#B8922A" },
    warning: { bg: "#FEF3C7", color: "#D97706" },
    danger:  { bg: "#FEE2E2", color: "#DC2626" },
    neutral: { bg: "#F3F4F6", color: "#0A0A0A" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-4" data-testid={testid}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50">
          {label}
        </span>
        <div className="w-7 h-7 flex items-center justify-center rounded-full"
             style={{ backgroundColor: t.bg, color: t.color }}>
          <Icon size={13} />
        </div>
      </div>
      <div className="font-display-serif text-xl sm:text-2xl text-[#0A0A0A]">{value}</div>
    </div>
  );
}

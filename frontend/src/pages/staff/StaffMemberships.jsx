/**
 * Staff Memberships — Revenue Engine Phase B.
 *
 * Manage BBR Cards (Sunset / Beach / Royal):
 *  - KPI tiles (total, active, pipeline revenue XOF)
 *  - Filterable list by status + plan
 *  - Detail pane with status workflow + "Issue card" action that
 *    generates a unique card number and activates the membership.
 */
import { useEffect, useState } from "react";
import {
  Crown, Sparkles, Sunrise, RefreshCw, Search, CreditCard,
  Check, BadgeCheck, Clock, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const STATUS_TABS = [
  { id: "", label: "Tous" },
  { id: "requested", label: "Demandes" },
  { id: "confirmed", label: "Confirmées" },
  { id: "active", label: "Cartes émises" },
  { id: "expired", label: "Expirées" },
  { id: "cancelled", label: "Annulées" },
];

const STATUS_META = {
  requested:  { color: "#E1306C", bg: "#FCE7F3", label: "Demande", icon: Clock },
  confirmed:  { color: "#1F8FFF", bg: "#DBEAFE", label: "Confirmée", icon: Check },
  active:     { color: "#16A34A", bg: "#DCFCE7", label: "Active", icon: BadgeCheck },
  expired:    { color: "#64748B", bg: "#F1F5F9", label: "Expirée", icon: Clock },
  cancelled:  { color: "#9CA3AF", bg: "#F3F4F6", label: "Annulée", icon: XCircle },
};

const TIER_ICON = { silver: Sunrise, gold: Sparkles, platinum: Crown };

export default function StaffMemberships() {
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [status, setStatus] = useState("");
  const [planId, setPlanId] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [issuing, setIssuing] = useState(false);

  async function loadStats() {
    try {
      const { data } = await api.get("/staff/memberships/stats");
      setStats(data);
    } catch {/* silent */ }
  }

  async function loadPlans() {
    try {
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/memberships/plans`);
      const d = await r.json();
      setPlans(d.plans || []);
    } catch {/* silent */ }
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (planId) params.set("plan_id", planId);
      if (q) params.set("q", q);
      const { data } = await api.get(`/staff/memberships?${params.toString()}`);
      setItems(data.items || []);
    } catch {
      toast.error("Impossible de charger les memberships");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStats(); loadPlans(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, planId]);

  async function advanceStatus(next) {
    try {
      await api.patch(`/staff/memberships/${selected.id}`, { status: next });
      toast.success(`Statut → ${STATUS_META[next]?.label || next}`);
      setSelected({ ...selected, status: next });
      load(); loadStats();
    } catch {
      toast.error("Mise à jour impossible");
    }
  }

  async function issueCard() {
    setIssuing(true);
    try {
      const { data } = await api.post(`/staff/memberships/${selected.id}/issue`);
      toast.success(`Carte émise : ${data.card_number}`);
      setSelected({ ...selected, card_number: data.card_number, status: "active", expires_at: data.expires_at });
      load(); loadStats();
    } catch {
      toast.error("Émission impossible");
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-memberships">
      <header>
        <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-2">
          Revenue Engine · Phase B
        </div>
        <h1 className="font-serif italic font-light text-3xl md:text-5xl leading-tight">
          Memberships — BBR Cards
        </h1>
        <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
          Gestion des cartes Sunset / Beach / Royal — demandes, émissions, pipeline.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="membership-stats">
        <StatTile label="Total demandes" value={stats?.total ?? "…"} />
        <StatTile label="Cartes actives" value={stats?.active ?? "…"} accent />
        <StatTile label="Demandes en attente" value={stats?.requested ?? "…"} />
        <StatTile
          label="Revenue pipeline"
          value={stats ? `${(stats.revenue_pipeline_xof || 0).toLocaleString("fr-FR")} XOF` : "…"}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((s) => (
            <button
              key={s.id || "all"}
              onClick={() => setStatus(s.id)}
              className={`px-3 py-2 text-[0.6rem] tracking-[0.3em] uppercase border transition-colors ${
                status === s.id
                  ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                  : "bg-white text-[#0A0A0A]/65 border-[#0A0A0A]/15 hover:border-[#B8922A]"
              }`}
              data-testid={`membership-status-${s.id || "all"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="px-3 py-2 border border-[#0A0A0A]/15 text-[0.65rem] tracking-[0.3em] uppercase bg-white"
            data-testid="membership-plan-filter"
          >
            <option value="">Toutes les cartes</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 flex items-center gap-2 border border-[#0A0A0A]/15 px-3 bg-white max-w-sm">
          <Search size={14} className="text-[#0A0A0A]/40" />
          <input
            placeholder="Rechercher email, nom, carte…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            className="flex-1 py-2 text-sm bg-transparent focus:outline-none"
            data-testid="membership-search"
          />
        </div>
        <button onClick={load} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* List + Detail */}
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white border border-[#0A0A0A]/10">
          {loading ? (
            <div className="py-16 text-center text-sm text-[#0A0A0A]/45">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#0A0A0A]/45">Aucune adhésion</div>
          ) : (
            <ul className="divide-y divide-[#0A0A0A]/8" data-testid="membership-list">
              {items.map((m) => {
                const meta = STATUS_META[m.status] || {};
                const Icon = meta.icon || Clock;
                return (
                  <li
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selected?.id === m.id ? "bg-[#FAF7F2]" : "hover:bg-[#FAF7F2]/60"
                    }`}
                    data-testid={`membership-item-${m.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[#0A0A0A] truncate">{m.full_name}</div>
                        <div className="text-xs text-[#0A0A0A]/55 truncate">{m.email}</div>
                        <div className="mt-1 text-xs text-[#B8922A] italic">{m.plan_name}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider"
                          style={{ color: meta.color, background: meta.bg }}
                        >
                          <Icon size={10} />{meta.label}
                        </span>
                        <div className="text-xs text-[#0A0A0A]/65 mt-1 tabular-nums">
                          {(m.plan_price_xof || 0).toLocaleString("fr-FR")} XOF
                        </div>
                      </div>
                    </div>
                    {m.card_number && (
                      <div className="mt-2 font-mono text-xs text-[#0A0A0A]/65">
                        {m.card_number}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2 bg-white border border-[#0A0A0A]/10 p-6 lg:sticky lg:top-4 lg:self-start" data-testid="membership-detail">
          {!selected ? (
            <div className="py-12 text-center text-sm text-[#0A0A0A]/45">
              Sélectionnez une adhésion.
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="text-[0.55rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55 mb-2">
                  Adhésion
                </div>
                <h2 className="font-serif italic text-2xl">{selected.full_name}</h2>
                <a href={`mailto:${selected.email}`} className="text-sm text-[#B8922A]">
                  {selected.email}
                </a>
                {selected.phone && <div className="text-sm text-[#0A0A0A]/70">{selected.phone}</div>}
              </div>

              <div className="bg-[#FAF7F2] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] tracking-[0.3em] uppercase text-[#0A0A0A]/55">Carte</div>
                    <div className="font-serif italic text-xl">{selected.plan_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] tracking-[0.3em] uppercase text-[#0A0A0A]/55">Prix</div>
                    <div className="font-serif italic text-xl">
                      {(selected.plan_price_xof || 0).toLocaleString("fr-FR")} XOF
                    </div>
                  </div>
                </div>
                {selected.card_number && (
                  <div className="mt-3 pt-3 border-t border-[#0A0A0A]/10">
                    <div className="text-[10px] tracking-[0.3em] uppercase text-[#0A0A0A]/55">
                      Numéro de carte
                    </div>
                    <div className="font-mono text-base mt-1" data-testid="membership-card-number">
                      {selected.card_number}
                    </div>
                    {selected.expires_at && (
                      <div className="text-xs text-[#0A0A0A]/55 mt-1">
                        Expire le {new Date(selected.expires_at).toLocaleDateString("fr-FR")}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selected.company && <Field label="Entreprise">{selected.company}</Field>}
              {selected.message && (
                <Field label="Message">
                  <p className="text-sm whitespace-pre-wrap text-[#0A0A0A]/85">{selected.message}</p>
                </Field>
              )}
              {selected.attribution?.utm_source && (
                <Field label="Attribution">
                  <span className="text-xs font-mono">
                    {selected.attribution.utm_source}
                    {selected.attribution.utm_campaign && ` / ${selected.attribution.utm_campaign}`}
                  </span>
                </Field>
              )}
              <Field label="Statut">
                <span className="text-sm">{STATUS_META[selected.status]?.label || selected.status}</span>
              </Field>

              {/* Actions */}
              <div className="pt-4 border-t border-[#0A0A0A]/10 space-y-2">
                {selected.status === "requested" && (
                  <button
                    onClick={() => advanceStatus("confirmed")}
                    className="w-full py-3 bg-[#0A0A0A] text-white text-[0.7rem] tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors"
                    data-testid="membership-confirm-btn"
                  >
                    Confirmer la demande
                  </button>
                )}
                {(selected.status === "confirmed" || selected.status === "requested") && !selected.card_number && (
                  <button
                    onClick={issueCard}
                    disabled={issuing}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#B8922A] text-white text-[0.7rem] tracking-[0.3em] uppercase hover:bg-[#D4B256] transition-colors disabled:opacity-50"
                    data-testid="membership-issue-btn"
                  >
                    <CreditCard size={14} />
                    {issuing ? "Émission…" : "Émettre la carte"}
                  </button>
                )}
                {selected.status !== "cancelled" && selected.status !== "expired" && (
                  <button
                    onClick={() => advanceStatus("cancelled")}
                    className="w-full py-3 border border-[#0A0A0A]/15 text-[#0A0A0A]/65 text-[0.7rem] tracking-[0.3em] uppercase hover:border-red-300 hover:text-red-700 transition-colors"
                    data-testid="membership-cancel-btn"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <div className={`bg-white border p-5 ${accent ? "border-[#B8922A]" : "border-[#0A0A0A]/10"}`}>
      <div className="text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-2">{label}</div>
      <div className={`font-serif italic font-light text-2xl ${accent ? "text-[#B8922A]" : ""} tabular-nums`}>
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[0.55rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-1.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}

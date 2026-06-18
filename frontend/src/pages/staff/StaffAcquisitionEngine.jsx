import { useEffect, useMemo, useState } from "react";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { RefreshCw, Megaphone, Play, Pause, FileEdit, CheckCircle2, TrendingUp, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_META = {
  draft:  { label: "Brouillon", color: "#6B7280", bg: "#F3F4F6", icon: FileEdit },
  active: { label: "Active",    color: "#15803D", bg: "#DCFCE7", icon: Play },
  paused: { label: "Pause",     color: "#B45309", bg: "#FEF3C7", icon: Pause },
  ended:  { label: "Terminée",  color: "#1F2937", bg: "#E5E7EB", icon: CheckCircle2 },
};

const UNIVERSE_LABELS = {
  beach_club: "Beach Club",
  hebergement: "Hébergement",
  le_kaai: "Restaurant Le Kaai",
  corporate: "Corporate",
  activites_events: "Activités & Events",
};

export default function StaffAcquisitionEngine() {
  const { token } = useStaffAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/staff/marketing/acquisition`, { headers: authHeaders });
      if (r.ok) {
        const d = await r.json();
        setItems(d.items || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function toggle(campaignId, current) {
    const next = current === "active" ? "paused" : "active";
    const r = await fetch(`${API}/staff/marketing/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (r.ok) load();
  }

  const byUniverse = useMemo(() => {
    const g = {};
    items.forEach((it) => {
      if (filter !== "all" && it.universe !== filter) return;
      (g[it.universe] = g[it.universe] || []).push(it);
    });
    return g;
  }, [items, filter]);

  const totalActive = items.reduce((acc, i) => acc + i.active, 0);
  const totalBudget = items.reduce((acc, i) => acc + (i.budget_total || 0), 0);
  const totalCreatives = items.reduce((acc, i) => acc + (i.creatives_count || 0), 0);
  const offersWithCampaign = items.filter((i) => i.campaigns.length > 0).length;

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-acquisition-engine">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#B8922A]/85 mb-1">
            Revenue Engine · Phase C · Vague 2
          </div>
          <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">
            Moteur d'acquisition
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
            Chaque offre = une campagne publicitaire permanente. Activez,
            mettez en pause ou ajoutez des créatifs en un clic.
          </p>
        </div>
        <button onClick={load} className="self-start p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]" data-testid="acq-refresh-btn">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Offres" value={items.length} suffix={` / ${items.length}`} />
        <Kpi label="Offres avec campagne" value={offersWithCampaign} />
        <Kpi label="Campagnes actives" value={totalActive} accent />
        <Kpi label="Budget total engagé" value={`${totalBudget.toLocaleString("fr-FR")} XOF`} />
      </div>

      {/* Universe filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter("all")} className={tabCls(filter === "all")} data-testid="acq-univ-all">
          Tous ({items.length})
        </button>
        {Object.entries(UNIVERSE_LABELS).map(([k, label]) => {
          const c = items.filter((i) => i.universe === k).length;
          return (
            <button key={k} onClick={() => setFilter(k)} className={tabCls(filter === k)} data-testid={`acq-univ-${k}`}>
              {label} ({c})
            </button>
          );
        })}
      </div>

      {/* Offers grouped by universe */}
      {Object.keys(byUniverse).length === 0 ? (
        <div className="bg-white border border-[#0A0A0A]/10 py-16 text-center text-sm text-[#0A0A0A]/45">
          {loading ? "Chargement…" : "Aucune offre."}
        </div>
      ) : (
        Object.entries(byUniverse).map(([uni, list]) => (
          <section key={uni} className="space-y-3" data-testid={`acq-universe-${uni}`}>
            <h2 className="font-display-serif text-xl text-[#B8922A]">{UNIVERSE_LABELS[uni] || uni}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((it) => <OfferCard key={`${uni}-${it.offer}`} it={it} onToggle={toggle} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

const tabCls = (active) => `px-4 py-2 text-[0.65rem] tracking-[0.3em] uppercase border transition-colors ${
  active
    ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
    : "bg-white text-[#0A0A0A]/75 border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"
}`;

function Kpi({ label, value, suffix = "", accent = false }) {
  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-5">
      <div className="text-[0.55rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55 mb-3">{label}</div>
      <div className={`font-serif italic font-light text-3xl tabular-nums ${accent ? "text-[#B8922A]" : "text-[#0A0A0A]"}`}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </div>
    </div>
  );
}

function OfferCard({ it, onToggle }) {
  const active = it.active > 0;
  return (
    <div className={`bg-white border p-4 transition-colors ${active ? "border-[#B8922A]/40" : "border-[#0A0A0A]/10"}`} data-testid={`acq-offer-${it.universe}-${it.offer}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">{it.offer}</div>
          <div className="font-display-serif text-base mt-1 truncate">
            {it.campaigns.length === 0 ? "Aucune campagne" : `${it.campaigns.length} campagne(s)`}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {active ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider bg-[#DCFCE7] text-[#15803D]">
              <Play size={9} /> {it.active} active
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-[#0A0A0A]/40">Inactive</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-[#0A0A0A]/65 mb-3">
        <span className="flex items-center gap-1 tabular-nums" title="Budget total"><TrendingUp size={12} /> {(it.budget_total || 0).toLocaleString("fr-FR")} XOF</span>
        <span className="flex items-center gap-1 tabular-nums" title="Créatifs"><ImageIcon size={12} /> {it.creatives_count}</span>
      </div>
      {it.campaigns.length > 0 ? (
        <ul className="space-y-1.5 mb-3">
          {it.campaigns.slice(0, 4).map((c) => {
            const meta = STATUS_META[c.status] || STATUS_META.draft;
            const Icon = meta.icon;
            return (
              <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate flex-1">{c.name}</span>
                <button
                  onClick={() => onToggle(c.id, c.status)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider hover:opacity-80"
                  style={{ color: meta.color, background: meta.bg }}
                  title={c.status === "active" ? "Mettre en pause" : "Activer"}
                  data-testid={`acq-toggle-${c.id}`}
                >
                  <Icon size={9} /> {meta.label}
                </button>
              </li>
            );
          })}
          {it.campaigns.length > 4 && (
            <li className="text-[10px] uppercase tracking-wider text-[#0A0A0A]/40">+ {it.campaigns.length - 4} autres</li>
          )}
        </ul>
      ) : (
        <div className="mb-3 py-2 text-xs text-[#0A0A0A]/45 italic">Aucune campagne créée pour cette offre.</div>
      )}
      <Link to="/staff/marketing/campaigns" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-[#B8922A] hover:text-[#0A0A0A]">
        <Megaphone size={11} /> Créer / gérer
      </Link>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useStaffAuth } from "../../context/StaffAuthContext";
import {
  Megaphone, Plus, RefreshCw, Trash2, Edit3, X, Image as ImageIcon,
  Play, Pause, FileEdit, CheckCircle2, Eye,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_META = {
  draft:  { label: "Brouillon", icon: FileEdit, color: "#6B7280", bg: "#F3F4F6" },
  active: { label: "Active",    icon: Play,     color: "#15803D", bg: "#DCFCE7" },
  paused: { label: "En pause",  icon: Pause,    color: "#B45309", bg: "#FEF3C7" },
  ended:  { label: "Terminée",  icon: CheckCircle2, color: "#1F2937", bg: "#E5E7EB" },
};

const STATUS_TABS = ["all", "draft", "active", "paused", "ended"];

export default function StaffMarketingCampaigns() {
  const { token } = useStaffAuth();
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [statusTab, setStatusTab] = useState("all");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [creativeOpen, setCreativeOpen] = useState(null);

  const authHeaders = useMemo(() => ({
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  async function loadMeta() {
    try {
      const r = await fetch(`${API}/staff/marketing/meta/universes`, { headers: authHeaders });
      if (r.ok) setMeta(await r.json());
    } catch (e) { console.error(e); }
  }

  async function loadCampaigns() {
    setLoading(true);
    try {
      const url = new URL(`${API}/staff/marketing/campaigns`);
      if (statusTab !== "all") url.searchParams.set("status", statusTab);
      const r = await fetch(url, { headers: authHeaders });
      if (r.ok) {
        const d = await r.json();
        setItems(d.items || []);
        setCounts(d.counts || {});
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { loadCampaigns(); }, [statusTab]);

  async function save(payload) {
    const method = payload.id ? "PATCH" : "POST";
    const url = payload.id
      ? `${API}/staff/marketing/campaigns/${payload.id}`
      : `${API}/staff/marketing/campaigns`;
    const body = { ...payload };
    delete body.id;
    const r = await fetch(url, {
      method, headers: authHeaders, body: JSON.stringify(body),
    });
    if (!r.ok) {
      alert("Échec de sauvegarde");
      return;
    }
    setEditing(null);
    loadCampaigns();
  }

  async function removeCampaign(id) {
    if (!window.confirm("Supprimer cette campagne ?")) return;
    const r = await fetch(`${API}/staff/marketing/campaigns/${id}`, {
      method: "DELETE", headers: authHeaders,
    });
    if (r.ok) loadCampaigns();
  }

  async function setStatus(id, newStatus) {
    const r = await fetch(`${API}/staff/marketing/campaigns/${id}`, {
      method: "PATCH", headers: authHeaders, body: JSON.stringify({ status: newStatus }),
    });
    if (r.ok) loadCampaigns();
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-marketing-campaigns">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#B8922A]/85 mb-1">
            Revenue Engine · Phase C
          </div>
          <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">
            Campagnes Marketing
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
            Pilotez vos campagnes publicitaires : un push par offre, budget, dates,
            objectif et créatifs (Meta · Google · YouTube).
          </p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="self-start inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-3 text-xs tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors"
          data-testid="campaign-new-btn"
        >
          <Plus size={14} /> Nouvelle campagne
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((s) => {
          const meta = STATUS_META[s] || { label: "Toutes", color: "#0A0A0A" };
          const count = s === "all"
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : (counts[s] || 0);
          return (
            <button
              key={s}
              onClick={() => setStatusTab(s)}
              className={`px-4 py-2 text-[0.65rem] tracking-[0.3em] uppercase border transition-colors ${
                statusTab === s
                  ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                  : "bg-white text-[#0A0A0A]/75 border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"
              }`}
              data-testid={`campaign-tab-${s}`}
            >
              {s === "all" ? "Toutes" : meta.label} · {count}
            </button>
          );
        })}
        <button
          onClick={loadCampaigns}
          className="ml-auto p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"
          title="Rafraîchir"
          data-testid="campaign-refresh-btn"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* List */}
      <div className="bg-white border border-[#0A0A0A]/10" data-testid="campaign-list">
        {items.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#0A0A0A]/45">
            {loading ? "Chargement…" : "Aucune campagne. Créez-en une pour démarrer."}
          </div>
        ) : (
          <ul className="divide-y divide-[#0A0A0A]/8">
            {items.map((c) => <CampaignRow
              key={c.id}
              c={c}
              meta={meta}
              onEdit={() => setEditing(c)}
              onDelete={() => removeCampaign(c.id)}
              onStatus={(s) => setStatus(c.id, s)}
              onCreatives={() => setCreativeOpen(c)}
            />)}
          </ul>
        )}
      </div>

      {editing !== null && (
        <CampaignForm
          initial={editing}
          meta={meta}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      {creativeOpen && (
        <CreativesDrawer
          campaign={creativeOpen}
          meta={meta}
          token={token}
          onClose={() => { setCreativeOpen(null); loadCampaigns(); }}
        />
      )}
    </div>
  );
}

function CampaignRow({ c, meta, onEdit, onDelete, onStatus, onCreatives }) {
  const sMeta = STATUS_META[c.status] || STATUS_META.draft;
  const Icon = sMeta.icon;
  const universeLabel = c.universe?.replace(/_/g, " ") || "—";
  return (
    <li className="p-4 hover:bg-[#FAF7F2]/60 transition-colors" data-testid={`campaign-row-${c.id}`}>
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider whitespace-nowrap"
              style={{ color: sMeta.color, background: sMeta.bg }}
            >
              <Icon size={10} />{sMeta.label}
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B8922A]/80">
              {universeLabel}
            </span>
          </div>
          <div className="font-display-serif text-lg text-[#0A0A0A] truncate">{c.name}</div>
          <div className="text-xs text-[#0A0A0A]/55 mt-1">
            Offre : <span className="text-[#0A0A0A]/75">{c.offer}</span>
            {" · "} {c.start_date} → {c.end_date}
            {" · "} Objectif : <span className="text-[#0A0A0A]/75">{c.objective}</span>
          </div>
          <div className="text-xs text-[#0A0A0A]/55 mt-1">
            Budget total : <span className="text-[#0A0A0A]/75 tabular-nums">{(c.budget_total || 0).toLocaleString("fr-FR")} XOF</span>
            {" · "} Quotidien : <span className="text-[#0A0A0A]/75 tabular-nums">{(c.budget_daily || 0).toLocaleString("fr-FR")} XOF</span>
            {" · "} <span className="text-[#0A0A0A]/75">{(c.creatives || []).length} créatif(s)</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:flex-shrink-0">
          {c.status !== "active" && (
            <button onClick={() => onStatus("active")} className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border border-[#15803D]/40 text-[#15803D] hover:bg-[#DCFCE7]" data-testid={`campaign-activate-${c.id}`}>
              Activer
            </button>
          )}
          {c.status === "active" && (
            <button onClick={() => onStatus("paused")} className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border border-[#B45309]/40 text-[#B45309] hover:bg-[#FEF3C7]">
              Mettre en pause
            </button>
          )}
          <button onClick={onCreatives} className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]" data-testid={`campaign-creatives-${c.id}`}>
            <ImageIcon size={12} className="inline mr-1" /> Créatifs
          </button>
          <button onClick={onEdit} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]" data-testid={`campaign-edit-${c.id}`}>
            <Edit3 size={14} />
          </button>
          <button onClick={onDelete} className="p-2 border border-[#0A0A0A]/15 hover:border-red-500 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </li>
  );
}

function CampaignForm({ initial, meta, onClose, onSave }) {
  const [name, setName] = useState(initial.name || "");
  const [universe, setUniverse] = useState(initial.universe || "beach_club");
  const [offer, setOffer] = useState(initial.offer || "");
  const [startDate, setStartDate] = useState(initial.start_date || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initial.end_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [budgetTotal, setBudgetTotal] = useState(initial.budget_total ?? 0);
  const [budgetDaily, setBudgetDaily] = useState(initial.budget_daily ?? 0);
  const [objective, setObjective] = useState(initial.objective || "reservations");
  const [status, setStatus] = useState(initial.status || "draft");
  const [notes, setNotes] = useState(initial.notes || "");
  const [audienceTargets, setAudienceTargets] = useState(
    Array.isArray(initial.audience_targets) ? initial.audience_targets.join(", ") : ""
  );
  const [audienceNotes, setAudienceNotes] = useState(initial.audience_notes || "");

  const offerOptions = meta?.universes?.[universe] || [];

  function submit(e) {
    e.preventDefault();
    if (!name.trim() || !offer.trim()) return;
    onSave({
      id: initial.id,
      name: name.trim(),
      universe,
      offer: offer.trim(),
      start_date: startDate,
      end_date: endDate,
      budget_total: Number(budgetTotal) || 0,
      budget_daily: Number(budgetDaily) || 0,
      objective,
      status,
      notes: notes.trim() || null,
      audience_targets: audienceTargets
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      audience_notes: audienceNotes.trim() || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="campaign-form-modal">
      <form onSubmit={submit} className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#0A0A0A]/10">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-[#B8922A]" />
            <div className="font-display-serif text-xl">
              {initial.id ? "Modifier la campagne" : "Nouvelle campagne"}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-[#FAF7F2]"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nom de la campagne *" testid="cf-name" col2>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" data-testid="cf-name-input" />
          </Field>
          <Field label="Univers *" testid="cf-universe">
            <select value={universe} onChange={(e) => { setUniverse(e.target.value); setOffer(""); }} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" data-testid="cf-universe-input">
              {Object.keys(meta?.universes || {}).map((u) => (
                <option key={u} value={u}>{u.replace(/_/g, " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Offre *" testid="cf-offer">
            <input list="offer-options" value={offer} onChange={(e) => setOffer(e.target.value)} required className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" data-testid="cf-offer-input" />
            <datalist id="offer-options">
              {offerOptions.map((o) => <option key={o} value={o} />)}
            </datalist>
          </Field>
          <Field label="Date de début *" testid="cf-start">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" />
          </Field>
          <Field label="Date de fin *" testid="cf-end">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" />
          </Field>
          <Field label="Budget global (XOF) *" testid="cf-btotal">
            <input type="number" min="0" value={budgetTotal} onChange={(e) => setBudgetTotal(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm tabular-nums" />
          </Field>
          <Field label="Budget quotidien (XOF) *" testid="cf-bdaily">
            <input type="number" min="0" value={budgetDaily} onChange={(e) => setBudgetDaily(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm tabular-nums" />
          </Field>
          <Field label="Objectif *" testid="cf-obj">
            <select value={objective} onChange={(e) => setObjective(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm">
              {(meta?.objectives || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Statut" testid="cf-status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm">
              {(meta?.statuses || ["draft", "active", "paused", "ended"]).map((s) => (
                <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes" testid="cf-notes" col2>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm resize-y" />
          </Field>
          <Field label="Audiences cibles (séparées par virgules)" testid="cf-audiences" col2>
            <input
              value={audienceTargets}
              onChange={(e) => setAudienceTargets(e.target.value)}
              placeholder="ex: Cadres Abidjan 25-45, Expats CI, Lookalike acheteurs J60"
              className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm"
              data-testid="cf-audiences-input"
            />
          </Field>
          <Field label="Détail audiences / brief créatif" testid="cf-audience-notes" col2>
            <textarea
              value={audienceNotes}
              onChange={(e) => setAudienceNotes(e.target.value)}
              rows={3}
              placeholder="Géolocalisation, intérêts, exclusions, etc."
              className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm resize-y"
              data-testid="cf-audience-notes-input"
            />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#0A0A0A]/10">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs tracking-[0.3em] uppercase border border-[#0A0A0A]/15 hover:border-[#0A0A0A]">Annuler</button>
          <button type="submit" className="px-5 py-2 text-xs tracking-[0.3em] uppercase bg-[#0A0A0A] text-white hover:bg-[#B8922A]" data-testid="cf-submit">
            {initial.id ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, testid, col2 = false }) {
  return (
    <label className={`block ${col2 ? "md:col-span-2" : ""}`} data-testid={testid}>
      <span className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CreativesDrawer({ campaign, meta, token, onClose }) {
  const [creatives, setCreatives] = useState(campaign.creatives || []);
  const [media, setMedia] = useState([]);
  const [picking, setPicking] = useState(null); // format key

  const formats = meta?.creative_formats || {};
  const groups = useMemo(() => {
    const g = { meta: [], google: [], youtube: [] };
    for (const [k, v] of Object.entries(formats)) g[v.channel]?.push({ key: k, ...v });
    return g;
  }, [formats]);

  async function loadMedia() {
    const r = await fetch(`${API}/staff/media-library?universe=${encodeURIComponent(campaign.universe)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      const d = await r.json();
      setMedia(d.items || []);
    }
  }

  useEffect(() => { loadMedia(); }, []);

  async function attach(formatKey, mediaItem) {
    const r = await fetch(`${API}/staff/marketing/campaigns/${campaign.id}/creatives`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        format: formatKey,
        media_id: mediaItem.id,
        media_url: mediaItem.url,
        label: mediaItem.label || mediaItem.original_filename,
      }),
    });
    if (r.ok) {
      const c = await r.json();
      setCreatives((prev) => [...prev, c]);
      setPicking(null);
    }
  }

  async function detach(creativeId) {
    const r = await fetch(`${API}/staff/marketing/campaigns/${campaign.id}/creatives/${creativeId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) setCreatives((prev) => prev.filter((c) => c.id !== creativeId));
  }

  function findCreative(formatKey) {
    return creatives.find((c) => c.format === formatKey);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="creatives-drawer">
      <div className="bg-white max-w-4xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#0A0A0A]/10">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#B8922A]/80">Créatifs</div>
            <div className="font-display-serif text-xl">{campaign.name}</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#FAF7F2]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-6">
          {Object.entries(groups).map(([channel, fmts]) => (
            <div key={channel}>
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#0A0A0A]/55 mb-3">
                {channel === "meta" ? "Meta Ads" : channel === "google" ? "Google Display" : "YouTube"}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {fmts.map((f) => {
                  const c = findCreative(f.key);
                  return (
                    <div key={f.key} className="border border-[#0A0A0A]/10 p-3 bg-[#FAF7F2]/40" data-testid={`creative-slot-${f.key}`}>
                      <div className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55 mb-1">{f.label}</div>
                      <div className="text-xs text-[#0A0A0A]/65 tabular-nums mb-2">{f.width} × {f.height}</div>
                      {c ? (
                        <div className="relative">
                          <img
                            src={`${process.env.REACT_APP_BACKEND_URL}${c.media_url}`}
                            alt={c.label || ""}
                            className="w-full aspect-video object-cover border border-[#0A0A0A]/10"
                          />
                          <button onClick={() => detach(c.id)} className="absolute top-1 right-1 p-1 bg-white border border-[#0A0A0A]/15 hover:border-red-500 hover:text-red-600">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setPicking(f.key)} className="w-full aspect-video border border-dashed border-[#0A0A0A]/20 flex items-center justify-center text-xs text-[#0A0A0A]/55 hover:border-[#B8922A] hover:text-[#B8922A]">
                          + Choisir un média
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {picking && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white max-w-3xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-[#0A0A0A]/10">
                <div className="font-display-serif text-lg">Choisir un média</div>
                <button onClick={() => setPicking(null)} className="p-1.5 hover:bg-[#FAF7F2]"><X size={16} /></button>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {media.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-sm text-[#0A0A0A]/55">
                    Aucun média pour cet univers. Uploadez d'abord depuis la <a href="/staff/marketing/media" className="underline text-[#B8922A]">Médiathèque</a>.
                  </div>
                ) : (
                  media.map((m) => (
                    <button key={m.id} onClick={() => attach(picking, m)} className="border border-[#0A0A0A]/10 hover:border-[#B8922A] p-1.5 text-left">
                      {m.kind === "image" ? (
                        <img src={`${process.env.REACT_APP_BACKEND_URL}${m.url}`} alt={m.label || ""} className="w-full aspect-square object-cover" />
                      ) : (
                        <div className="w-full aspect-square bg-[#0A0A0A]/5 flex items-center justify-center text-[10px] uppercase">VIDÉO</div>
                      )}
                      <div className="text-xs mt-1 truncate">{m.label || m.original_filename}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

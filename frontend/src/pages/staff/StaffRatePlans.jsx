import { useEffect, useMemo, useState } from "react";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { Plus, RefreshCw, Trash2, Edit3, X, Tag, Calendar, CalendarRange, Sparkles, Percent, ToggleLeft, ToggleRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Offer keys used in CMS (mirrors backend offer_overrides scheme).
const OFFER_KEYS = [
  { key: "beach_club.pass_day",      label: "Beach Club · Day Pass" },
  { key: "beach_club.sunset",        label: "Beach Club · The Sunset" },
  { key: "beach_club.brunch",        label: "Beach Club · BiBrunch" },
  { key: "hebergement.chambre_exclusive", label: "Hébergement · Chambre Exclusive" },
  { key: "hebergement.suite_jardin",      label: "Hébergement · Suite Jardin" },
  { key: "hebergement.suite_lagune",      label: "Hébergement · Suite Lagune" },
  { key: "le_kaai.dejeuner",         label: "Le Kaai · Déjeuner" },
  { key: "le_kaai.diner",            label: "Le Kaai · Dîner" },
  { key: "activites.jet_ski",        label: "Activités · Jet Ski" },
  { key: "activites.paddle",         label: "Activités · Paddle" },
  { key: "activites.kayak",          label: "Activités · Kayak" },
];

const TYPE_META = {
  seasonal: { label: "Saisonnier", icon: CalendarRange, color: "#0EA5E9", bg: "#E0F2FE" },
  weekend:  { label: "Week-end",   icon: Calendar,      color: "#7C3AED", bg: "#EDE9FE" },
  event:    { label: "Événement",  icon: Sparkles,      color: "#EA580C", bg: "#FFEDD5" },
  promo:    { label: "Promo Code", icon: Tag,           color: "#B8922A", bg: "#FEF3C7" },
};

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function StaffRatePlans() {
  const { token } = useStaffAuth();
  const [items, setItems] = useState([]);
  const [filterOffer, setFilterOffer] = useState("");
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  async function load() {
    setLoading(true);
    try {
      const url = new URL(`${API}/staff/revenue/rate-plans`);
      if (filterOffer) url.searchParams.set("offer_key", filterOffer);
      if (filterType) url.searchParams.set("type", filterType);
      const r = await fetch(url, { headers: authHeaders });
      if (r.ok) {
        const d = await r.json();
        setItems(d.items || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [filterOffer, filterType]); // eslint-disable-line

  async function save(payload) {
    const method = payload.id ? "PATCH" : "POST";
    const url = payload.id
      ? `${API}/staff/revenue/rate-plans/${payload.id}`
      : `${API}/staff/revenue/rate-plans`;
    const body = { ...payload };
    delete body.id;
    const r = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(body) });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(`Échec : ${d.detail || r.statusText}`);
      return;
    }
    setEditing(null);
    load();
  }

  async function remove(id) {
    if (!window.confirm("Supprimer ce plan tarifaire ?")) return;
    const r = await fetch(`${API}/staff/revenue/rate-plans/${id}`, { method: "DELETE", headers: authHeaders });
    if (r.ok) load();
  }

  async function toggleActive(plan) {
    const r = await fetch(`${API}/staff/revenue/rate-plans/${plan.id}`, {
      method: "PATCH", headers: authHeaders,
      body: JSON.stringify({ active: !plan.active }),
    });
    if (r.ok) load();
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-rate-plans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#B8922A]/85 mb-1">
            Revenue Engine · Phase C · Vague 2
          </div>
          <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">
            Revenue Management
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
            Plans tarifaires dynamiques : saisons, week-ends, événements et codes promo.
            S'appliquent automatiquement dans le tunnel de réservation.
          </p>
        </div>
        <button onClick={() => setEditing({})} className="self-start inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-3 text-xs tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors" data-testid="rp-new-btn">
          <Plus size={14} /> Nouveau plan
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <select value={filterOffer} onChange={(e) => setFilterOffer(e.target.value)} className="border border-[#0A0A0A]/15 px-3 py-2 text-sm bg-white" data-testid="rp-filter-offer">
          <option value="">Toutes les offres</option>
          {OFFER_KEYS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-[#0A0A0A]/15 px-3 py-2 text-sm bg-white" data-testid="rp-filter-type">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={load} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]" title="Rafraîchir">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* List */}
      <div className="bg-white border border-[#0A0A0A]/10 overflow-x-auto" data-testid="rp-list">
        {items.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#0A0A0A]/45">
            {loading ? "Chargement…" : "Aucun plan tarifaire."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Offre</th>
                <th className="py-3 px-4">Conditions</th>
                <th className="py-3 px-4 text-right">Ajustement</th>
                <th className="py-3 px-4 text-center">Actif</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => <Row key={p.id} p={p} onEdit={() => setEditing(p)} onDelete={() => remove(p.id)} onToggle={() => toggleActive(p)} />)}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <RatePlanForm initial={editing} onClose={() => setEditing(null)} onSave={save} />
      )}
    </div>
  );
}

function Row({ p, onEdit, onDelete, onToggle }) {
  const meta = TYPE_META[p.type] || TYPE_META.seasonal;
  const Icon = meta.icon;
  const offerLabel = OFFER_KEYS.find((o) => o.key === p.offer_key)?.label || p.offer_key;
  const adjStr = p.adjustment_kind === "absolute"
    ? `${p.adjustment_value > 0 ? "+" : ""}${(p.adjustment_value).toLocaleString("fr-FR")} XOF`
    : `${p.adjustment_value > 0 ? "+" : ""}${p.adjustment_value}%`;
  const adjColor = p.adjustment_value < 0 ? "text-[#15803D]" : p.adjustment_value > 0 ? "text-[#B45309]" : "text-[#0A0A0A]/65";

  let cond = "";
  if (p.type === "promo") cond = `Code : ${p.promo_code || "—"}`;
  else if (p.type === "weekend") cond = (p.days_of_week || [5, 6]).map((d) => DAYS[d]).join(" · ");
  else cond = `${p.start_date || "—"} → ${p.end_date || "—"}`;

  return (
    <tr className="border-b border-[#0A0A0A]/5 hover:bg-[#FAF7F2]/40" data-testid={`rp-row-${p.id}`}>
      <td className="py-3 px-4">
        <div className="font-medium text-[#0A0A0A]">{p.name}</div>
        {p.notes && <div className="text-[10px] text-[#0A0A0A]/45 truncate max-w-xs">{p.notes}</div>}
      </td>
      <td className="py-3 px-4">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider" style={{ color: meta.color, background: meta.bg }}>
          <Icon size={10} /> {meta.label}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-[#0A0A0A]/75">{offerLabel}</td>
      <td className="py-3 px-4 text-xs text-[#0A0A0A]/65 tabular-nums">{cond}</td>
      <td className={`py-3 px-4 text-right font-medium tabular-nums ${adjColor}`}>{adjStr}</td>
      <td className="py-3 px-4 text-center">
        <button onClick={onToggle} title={p.active ? "Désactiver" : "Activer"} data-testid={`rp-toggle-${p.id}`}>
          {p.active ? <ToggleRight size={22} className="text-[#15803D]" /> : <ToggleLeft size={22} className="text-[#0A0A0A]/35" />}
        </button>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center justify-end gap-1">
          <button onClick={onEdit} className="p-1.5 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]" data-testid={`rp-edit-${p.id}`}><Edit3 size={13} /></button>
          <button onClick={onDelete} className="p-1.5 border border-[#0A0A0A]/15 hover:border-red-500 hover:text-red-600"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  );
}

function RatePlanForm({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial.name || "");
  const [offerKey, setOfferKey] = useState(initial.offer_key || OFFER_KEYS[0].key);
  const [type, setType] = useState(initial.type || "seasonal");
  const [adjustmentKind, setAdjustmentKind] = useState(initial.adjustment_kind || "percent");
  const [adjustmentValue, setAdjustmentValue] = useState(initial.adjustment_value ?? 0);
  const [startDate, setStartDate] = useState(initial.start_date || "");
  const [endDate, setEndDate] = useState(initial.end_date || "");
  const [daysOfWeek, setDaysOfWeek] = useState(initial.days_of_week || [5, 6]);
  const [promoCode, setPromoCode] = useState(initial.promo_code || "");
  const [autoApply, setAutoApply] = useState(initial.auto_apply !== false);
  const [active, setActive] = useState(initial.active !== false);
  const [notes, setNotes] = useState(initial.notes || "");

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (type === "promo" && !promoCode.trim()) {
      alert("Le code promo est requis pour ce type.");
      return;
    }
    onSave({
      id: initial.id,
      name: name.trim(),
      offer_key: offerKey,
      type,
      adjustment_kind: adjustmentKind,
      adjustment_value: Number(adjustmentValue) || 0,
      start_date: startDate || null,
      end_date: endDate || null,
      days_of_week: type === "weekend" || type === "seasonal" ? daysOfWeek : null,
      promo_code: type === "promo" ? promoCode.trim().toUpperCase() : null,
      auto_apply: autoApply,
      active,
      notes: notes.trim() || null,
    });
  }

  function toggleDay(d) {
    setDaysOfWeek((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="rp-form-modal">
      <form onSubmit={submit} className="bg-white max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#0A0A0A]/10">
          <div className="font-display-serif text-xl">
            {initial.id ? "Modifier le plan" : "Nouveau plan tarifaire"}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-[#FAF7F2]"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldLabel label="Nom *" col2>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" data-testid="rp-name-input" />
          </FieldLabel>
          <FieldLabel label="Offre *">
            <select value={offerKey} onChange={(e) => setOfferKey(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" data-testid="rp-offer-input">
              {OFFER_KEYS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </FieldLabel>
          <FieldLabel label="Type *">
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" data-testid="rp-type-input">
              {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </FieldLabel>
          <FieldLabel label="Type d'ajustement *">
            <select value={adjustmentKind} onChange={(e) => setAdjustmentKind(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm">
              <option value="percent">Pourcentage (%)</option>
              <option value="absolute">Montant (XOF)</option>
            </select>
          </FieldLabel>
          <FieldLabel label={`Valeur (négatif = remise) *`}>
            <input type="number" step="0.1" value={adjustmentValue} onChange={(e) => setAdjustmentValue(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm tabular-nums" data-testid="rp-value-input" />
          </FieldLabel>
          {type !== "promo" && (
            <>
              <FieldLabel label="Date de début">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" />
              </FieldLabel>
              <FieldLabel label="Date de fin">
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" />
              </FieldLabel>
            </>
          )}
          {(type === "weekend" || type === "seasonal") && (
            <FieldLabel label="Jours actifs" col2>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => (
                  <button key={d} type="button" onClick={() => toggleDay(i)} className={`px-3 py-1.5 text-[10px] uppercase tracking-wider border ${daysOfWeek.includes(i) ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#0A0A0A]/65 border-[#0A0A0A]/15"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </FieldLabel>
          )}
          {type === "promo" && (
            <FieldLabel label="Code promo *" col2>
              <input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} required className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm uppercase tracking-wider" placeholder="SUNNY10" data-testid="rp-promo-input" />
            </FieldLabel>
          )}
          <FieldLabel label="Statut" col2>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" data-testid="rp-active-input" />
              Plan activé
            </label>
            {type === "promo" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
                <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} className="h-4 w-4" />
                Auto-appliquer si présent dans l'URL (?promo=…)
              </label>
            )}
          </FieldLabel>
          <FieldLabel label="Notes" col2>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm resize-y" />
          </FieldLabel>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#0A0A0A]/10">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs tracking-[0.3em] uppercase border border-[#0A0A0A]/15">Annuler</button>
          <button type="submit" className="px-5 py-2 text-xs tracking-[0.3em] uppercase bg-[#0A0A0A] text-white hover:bg-[#B8922A]" data-testid="rp-submit">
            {initial.id ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldLabel({ label, children, col2 = false }) {
  return (
    <label className={`block ${col2 ? "md:col-span-2" : ""}`}>
      <span className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

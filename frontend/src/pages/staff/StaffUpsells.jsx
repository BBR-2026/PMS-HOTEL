/**
 * Staff Upsells — Revenue Engine Phase B.
 *
 * Admin catalog management for the cross-sell offers exposed by
 * /api/upsells/catalog (visible on /booking-extras/{ref}).
 *
 * Capabilities:
 *  - Create / edit / archive an offer (5 categories).
 *  - Toggle visibility (active) without deleting.
 *  - Live stats card: total selections, revenue captured, top offers,
 *    breakdown by category.
 */
import { useEffect, useState } from "react";
import {
  Plus, RefreshCw, Search, Edit2, ShoppingBag,
  TrendingUp, Save, X, Trash2, Waves, Sparkles,
  UtensilsCrossed, Anchor, Heart,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const CATEGORIES = [
  { id: "beach_club",  label: "Beach Club",  icon: Waves },
  { id: "wellness",    label: "Spa & Soins", icon: Heart },
  { id: "gastronomy",  label: "Gastronomie", icon: UtensilsCrossed },
  { id: "experience",  label: "Expériences", icon: Sparkles },
  { id: "transport",   label: "Transport",   icon: Anchor },
];

const EMPTY = {
  name: "", category: "beach_club", description: "",
  price_xof: 25000, image_url: "", stock_per_day: null,
  max_per_booking: 4, active: true,
};

export default function StaffUpsells() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | "<id>"
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCat) params.set("category", filterCat);
      const [list, statsRes] = await Promise.all([
        api.get(`/staff/upsells?${params.toString()}`),
        api.get("/staff/upsells/stats"),
      ]);
      setItems(list.data.items || []);
      setStats(statsRes.data);
    } catch {
      toast.error("Impossible de charger les upsells");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterCat]);

  function openNew() { setEditing("new"); setForm(EMPTY); }
  function openEdit(o) { setEditing(o.id); setForm({ ...o }); }
  function closeEdit() { setEditing(null); }

  async function save() {
    setSaving(true);
    try {
      if (editing === "new") {
        await api.post("/staff/upsells", form);
        toast.success("Offre créée");
      } else {
        await api.patch(`/staff/upsells/${editing}`, form);
        toast.success("Offre mise à jour");
      }
      closeEdit();
      load();
    } catch {
      toast.error("Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  async function remove(o) {
    if (!window.confirm(`Supprimer "${o.name}" ?`)) return;
    try {
      await api.delete(`/staff/upsells/${o.id}`);
      toast.success("Offre supprimée");
      load();
    } catch {
      toast.error("Suppression impossible");
    }
  }

  async function toggleActive(o) {
    try {
      await api.patch(`/staff/upsells/${o.id}`, { active: !o.active });
      load();
    } catch {
      toast.error("Mise à jour impossible");
    }
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-upsells">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-2">
            Revenue Engine · Phase B
          </div>
          <h1 className="font-serif italic font-light text-3xl md:text-5xl leading-tight">
            Upsells & Cross-sell
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
            Catalogue des extras proposés après réservation : transats VIP,
            soins spa, Champagne, table Le Kaai, charters privés…
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#0A0A0A] text-white text-[0.65rem] tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors"
          data-testid="upsell-new-btn"
        >
          <Plus size={14} />
          Nouvelle offre
        </button>
      </header>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="upsell-stats">
          <StatTile label="Sélections totales" value={stats.total_selections} />
          <StatTile
            label="Revenue capturé"
            value={`${(stats.revenue_xof || 0).toLocaleString("fr-FR")} XOF`}
            accent
          />
          <StatTile label="Catégories actives" value={(stats.by_category || []).length} />
          <StatTile label="Top offres" value={(stats.top_offers || []).length} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterCat("")}
          className={`px-3 py-2 text-[0.6rem] tracking-[0.3em] uppercase border ${
            !filterCat ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white border-[#0A0A0A]/15"
          }`}
          data-testid="upsell-filter-all"
        >
          Toutes
        </button>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => setFilterCat(c.id)}
              className={`inline-flex items-center gap-2 px-3 py-2 text-[0.6rem] tracking-[0.3em] uppercase border ${
                filterCat === c.id
                  ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                  : "bg-white border-[#0A0A0A]/15 hover:border-[#B8922A]"
              }`}
              data-testid={`upsell-filter-${c.id}`}
            >
              <Icon size={11} />
              {c.label}
            </button>
          );
        })}
        <button
          onClick={load}
          className="ml-auto p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]"
          data-testid="upsell-refresh-btn"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Items */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="upsell-list">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-sm text-[#0A0A0A]/45">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-sm text-[#0A0A0A]/45">Aucune offre</div>
        ) : items.map((o) => {
          const cat = CATEGORIES.find((c) => c.id === o.category);
          const Icon = cat?.icon || ShoppingBag;
          return (
            <article
              key={o.id}
              className={`bg-white border ${o.active ? "border-[#0A0A0A]/10" : "border-dashed border-[#0A0A0A]/15 opacity-70"} p-5`}
              data-testid={`upsell-card-${o.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="inline-flex items-center gap-2">
                  <Icon size={14} className="text-[#B8922A]" />
                  <span className="text-[10px] tracking-[0.3em] uppercase text-[#0A0A0A]/55">
                    {cat?.label || o.category}
                  </span>
                </div>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={o.active}
                    onChange={() => toggleActive(o)}
                    className="sr-only"
                  />
                  <span className={`w-9 h-5 rounded-full relative transition-colors ${o.active ? "bg-[#16A34A]" : "bg-[#0A0A0A]/20"}`}>
                    <span className={`absolute top-0.5 ${o.active ? "left-4.5" : "left-0.5"} w-4 h-4 bg-white rounded-full transition-all`} style={{ left: o.active ? "1.125rem" : "0.125rem" }} />
                  </span>
                </label>
              </div>
              <h3 className="font-serif italic text-xl mb-2">{o.name}</h3>
              {o.description && (
                <p className="text-sm text-[#0A0A0A]/65 line-clamp-2 mb-3">{o.description}</p>
              )}
              <div className="flex items-baseline justify-between mb-4">
                <span className="font-serif italic text-2xl tabular-nums">
                  {o.price_xof.toLocaleString("fr-FR")}
                  <span className="text-xs text-[#0A0A0A]/55 not-italic font-sans"> XOF</span>
                </span>
                <span className="text-[10px] tracking-wider uppercase text-[#0A0A0A]/55">
                  max {o.max_per_booking}/résa
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(o)}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 border border-[#0A0A0A]/15 text-[0.6rem] tracking-[0.3em] uppercase hover:border-[#B8922A] hover:text-[#B8922A] transition-colors"
                  data-testid={`upsell-edit-${o.id}`}
                >
                  <Edit2 size={11} /> Modifier
                </button>
                <button
                  onClick={() => remove(o)}
                  className="p-2 border border-[#0A0A0A]/15 text-[#0A0A0A]/55 hover:border-red-300 hover:text-red-700 transition-colors"
                  data-testid={`upsell-delete-${o.id}`}
                  title="Supprimer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Top offers from stats */}
      {stats && stats.top_offers && stats.top_offers.length > 0 && (
        <div className="bg-white border border-[#0A0A0A]/10 p-5" data-testid="upsell-top-offers">
          <h3 className="text-[0.65rem] tracking-[0.4em] uppercase text-[#0A0A0A]/65 mb-4">
            Top offres (revenue)
          </h3>
          <ul className="space-y-2">
            {stats.top_offers.map((t, i) => (
              <li key={t.upsell_id} className="flex items-center justify-between py-1 border-b border-[#0A0A0A]/5">
                <span className="text-sm">
                  <span className="text-[#B8922A] font-mono mr-2">#{i + 1}</span>
                  {t.name}
                </span>
                <div className="flex items-center gap-6 text-xs">
                  <span className="text-[#0A0A0A]/55 tabular-nums">{t.count}× vendu</span>
                  <span className="font-medium tabular-nums">
                    {(t.revenue || 0).toLocaleString("fr-FR")} XOF
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal */}
      {editing && (
        <UpsellModal
          isNew={editing === "new"}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={closeEdit}
          onSave={save}
        />
      )}
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

function UpsellModal({ isNew, form, setForm, saving, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" data-testid="upsell-modal">
      <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between p-6 border-b border-[#0A0A0A]/10">
          <h2 className="font-serif italic text-2xl">
            {isNew ? "Nouvelle offre" : "Modifier l'offre"}
          </h2>
          <button onClick={onClose} className="p-1 text-[#0A0A0A]/55" data-testid="upsell-modal-close">
            <X size={20} />
          </button>
        </header>
        <div className="p-6 space-y-4">
          <FInput label="Nom *" value={form.name}
            onChange={(v) => setForm({ ...form, name: v })} testid="upsell-form-name" />
          <FSelect label="Catégorie *" value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            options={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
            testid="upsell-form-category" />
          <FTextarea label="Description" value={form.description || ""}
            onChange={(v) => setForm({ ...form, description: v })} testid="upsell-form-description" />
          <div className="grid grid-cols-2 gap-3">
            <FInput label="Prix (XOF) *" type="number" value={form.price_xof}
              onChange={(v) => setForm({ ...form, price_xof: parseInt(v, 10) || 0 })}
              testid="upsell-form-price" />
            <FInput label="Max / réservation" type="number" value={form.max_per_booking}
              onChange={(v) => setForm({ ...form, max_per_booking: parseInt(v, 10) || 1 })}
              testid="upsell-form-max" />
          </div>
          <FInput label="URL image" value={form.image_url || ""}
            onChange={(v) => setForm({ ...form, image_url: v })}
            placeholder="https://..."
            testid="upsell-form-image" />
          <FInput label="Stock / jour (facultatif)" type="number"
            value={form.stock_per_day ?? ""}
            onChange={(v) => setForm({ ...form, stock_per_day: v ? parseInt(v, 10) : null })}
            testid="upsell-form-stock" />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              data-testid="upsell-form-active"
            />
            <span className="text-sm">Visible publiquement</span>
          </label>
        </div>
        <footer className="p-6 border-t border-[#0A0A0A]/10 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-[#0A0A0A]/15 text-[0.65rem] tracking-[0.3em] uppercase"
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name || !form.category}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A0A0A] text-white text-[0.65rem] tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors disabled:opacity-50"
            data-testid="upsell-form-save"
          >
            <Save size={13} />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function FInput({ label, value, onChange, type = "text", placeholder, testid }) {
  return (
    <label className="block">
      <span className="block text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:outline-none focus:border-[#B8922A]"
        data-testid={testid}
      />
    </label>
  );
}

function FSelect({ label, value, onChange, options, testid }) {
  return (
    <label className="block">
      <span className="block text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1.5">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#B8922A]"
        data-testid={testid}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function FTextarea({ label, value, onChange, testid }) {
  return (
    <label className="block">
      <span className="block text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1.5">
        {label}
      </span>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:outline-none focus:border-[#B8922A] resize-none"
        maxLength={600}
        data-testid={testid}
      />
    </label>
  );
}

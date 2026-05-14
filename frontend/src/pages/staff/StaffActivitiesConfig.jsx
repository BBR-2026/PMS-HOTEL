import { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";
import { Waves, Plus, Pencil, Trash2, X, Save, ToggleLeft, ToggleRight } from "lucide-react";

const EMPTY = {
  id: "",
  name_fr: "",
  name_en: "",
  description_fr: "",
  description_en: "",
  price: 0,
  duration_min: null,
  category: "Activités & Loisirs",
  subcategory: "",
  active: true,
};

const CATEGORIES = ["Menus", "Espace privatif", "Activités & Loisirs", "Offres spéciales", "Autre"];

// Suggested sub-categories per top category. Free-form input still allowed.
const SUBCATEGORIES = {
  "Menus": ["Kaai", "Beach Club", "Lounge"],
  "Espace privatif": ["Plage", "Terrasse 1", "Terrasse 2", "Terrasse 3"],
  "Activités & Loisirs": ["Sport et terrain", "Bien-être", "Excursion"],
  "Offres spéciales": [],
  "Autre": [],
};

const fmtXOF = (n) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n || 0))} FCFA`;

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function StaffActivitiesConfig() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | {} (create) | existing item
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    setLoading(true);
    api.get("/staff/activities")
      .then((r) => setItems(Array.isArray(r.data) ? r.data : (r.data?.items || [])))
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const openCreate = () => {
    setEditing({ _isNew: true });
    setForm(EMPTY);
  };
  const openEdit = (a) => {
    setEditing(a);
    setForm({
      id: a.id,
      name_fr: a.name_fr || "",
      name_en: a.name_en || "",
      description_fr: a.description_fr || "",
      description_en: a.description_en || "",
      price: a.price || 0,
      duration_min: a.duration_min || null,
      category: a.category || "Activités & Loisirs",
      subcategory: a.subcategory || "",
      active: a.active !== false,
    });
  };
  const close = () => { setEditing(null); setForm(EMPTY); };

  const save = async () => {
    const payload = {
      ...form,
      id: form.id?.trim() || slugify(form.name_fr) || `act-${Date.now()}`,
      price: parseInt(form.price, 10) || 0,
      duration_min: form.duration_min ? parseInt(form.duration_min, 10) : null,
    };
    if (!payload.name_fr.trim()) { toast.error("Nom (FR) requis"); return; }
    if (payload.price < 0) { toast.error("Prix doit être ≥ 0"); return; }
    setSaving(true);
    try {
      if (editing?._isNew) {
        await api.post("/staff/activities", payload);
        toast.success("Activité créée");
      } else {
        await api.patch(`/staff/activities/${editing.id}`, payload);
        toast.success("Activité mise à jour");
      }
      close();
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a) => {
    try {
      await api.patch(`/staff/activities/${a.id}`, { ...a, active: !a.active });
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const removeIt = async (a) => {
    if (!window.confirm(`Supprimer définitivement « ${a.name_fr} » ?`)) return;
    try {
      await api.delete(`/staff/activities/${a.id}`);
      toast.success("Supprimée");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto" data-testid="staff-activities-config">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] inline-flex items-center gap-3">
            <Waves size={26} className="text-[#B8922A]" />
            Configuration des activités
          </h1>
          <p className="text-sm text-[#0A0A0A]/55 mt-1">
            Catalogue activités & consommations disponibles via la carte QR.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] bg-[#B8922A] text-white hover:bg-[#a37e1f] transition-all self-start sm:self-auto"
          data-testid="activity-create-btn"
        >
          <Plus size={14} /> Nouvelle activité
        </button>
      </div>

      <div className="bg-white border border-[#0A0A0A]/8 overflow-x-auto" data-testid="activities-table">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10 bg-[#FAFAF7]">
              <th className="py-3 px-4">Nom</th>
              <th className="py-3 px-4">Catégorie</th>
              <th className="py-3 px-4 text-right">Prix</th>
              <th className="py-3 px-4 text-right">Durée</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-[#0A0A0A]/50">Chargement…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-[#0A0A0A]/50">Aucune activité. Cliquez sur « Nouvelle activité ».</td></tr>
            ) : (
              items.map((a) => (
                <tr key={a.id} className="border-b border-[#0A0A0A]/5 hover:bg-[#FAFAF7]/60" data-testid={`activity-row-${a.id}`}>
                  <td className="py-3 px-4">
                    <div className="font-medium text-[#0A0A0A]">{a.name_fr}</div>
                    {a.description_fr && <div className="text-[0.68rem] text-[#0A0A0A]/55 line-clamp-1">{a.description_fr}</div>}
                  </td>
                  <td className="py-3 px-4 text-[0.78rem] text-[#0A0A0A]/75">
                    <div>{a.category || "—"}</div>
                    {a.subcategory && <div className="text-[0.62rem] text-[#0A0A0A]/45 mt-0.5">{a.subcategory}</div>}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-[#0A0A0A]">{fmtXOF(a.price)}</td>
                  <td className="py-3 px-4 text-right text-[0.78rem] text-[#0A0A0A]/75">{a.duration_min ? `${a.duration_min} min` : "—"}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleActive(a)}
                      className={`inline-flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.22em] ${a.active ? "text-green-700" : "text-[#0A0A0A]/40"}`}
                      data-testid={`activity-toggle-${a.id}`}
                    >
                      {a.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      {a.active ? "Active" : "Désactivée"}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1.5 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A] transition-colors"
                        data-testid={`activity-edit-${a.id}`}
                        title="Modifier"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => removeIt(a)}
                        className="p-1.5 border border-[#0A0A0A]/15 hover:border-red-500 hover:text-red-500 transition-colors"
                        data-testid={`activity-delete-${a.id}`}
                        title="Supprimer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Editor modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={close}
          data-testid="activity-modal"
        >
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 sm:p-7 border-b border-[#0A0A0A]/8">
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A]">
                  {editing._isNew ? "Création" : "Modification"}
                </div>
                <div className="font-display-serif text-xl text-[#0A0A0A] mt-0.5">
                  {form.name_fr || "Nouvelle activité"}
                </div>
              </div>
              <button onClick={close} className="p-1.5 hover:bg-[#FAFAF7]" data-testid="activity-modal-close"><X size={16} /></button>
            </div>
            <div className="p-5 sm:p-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nom (FR) *" testid="activity-name-fr">
                  <input
                    value={form.name_fr}
                    onChange={(e) => setForm({ ...form, name_fr: e.target.value })}
                    placeholder="ex. Jet Ski 30 min"
                    className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none bg-white"
                    autoFocus
                    data-testid="activity-input-name-fr"
                  />
                </Field>
                <Field label="Nom (EN)">
                  <input
                    value={form.name_en}
                    onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                    placeholder="ex. Jet Ski 30 min"
                    className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none bg-white"
                  />
                </Field>
                <Field label="Catégorie">
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: "" })}
                    className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none bg-white"
                    data-testid="activity-input-category"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Sous-catégorie">
                  <input
                    list={`subcat-${form.category}`}
                    value={form.subcategory}
                    onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                    placeholder={(SUBCATEGORIES[form.category] || [])[0] || "optionnel"}
                    className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none bg-white"
                    data-testid="activity-input-subcategory"
                  />
                  <datalist id={`subcat-${form.category}`}>
                    {(SUBCATEGORIES[form.category] || []).map((s) => <option key={s} value={s} />)}
                  </datalist>
                </Field>
                <Field label="Prix (FCFA) *">
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none bg-white"
                    data-testid="activity-input-price"
                  />
                </Field>
                <Field label="Durée (minutes)">
                  <input
                    type="number"
                    min={0}
                    value={form.duration_min || ""}
                    onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
                    placeholder="optionnel"
                    className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none bg-white"
                  />
                </Field>
                <Field label={editing._isNew ? "Identifiant (auto)" : "Identifiant"}>
                  <input
                    value={form.id}
                    onChange={(e) => setForm({ ...form, id: e.target.value })}
                    placeholder={editing._isNew ? slugify(form.name_fr) || "auto-généré" : ""}
                    disabled={!editing._isNew}
                    className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm bg-[#FAFAF7] font-mono disabled:text-[#0A0A0A]/50"
                  />
                </Field>
              </div>
              <Field label="Description (FR)">
                <textarea
                  value={form.description_fr}
                  onChange={(e) => setForm({ ...form, description_fr: e.target.value })}
                  rows={2}
                  placeholder="optionnel"
                  className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none bg-white resize-none"
                />
              </Field>
              <Field label="Description (EN)">
                <textarea
                  value={form.description_en}
                  onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                  rows={2}
                  placeholder="optional"
                  className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none bg-white resize-none"
                />
              </Field>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="accent-[#B8922A]"
                  data-testid="activity-input-active"
                />
                <span className="text-sm text-[#0A0A0A]">Visible dans la carte QR du scanner</span>
              </label>
            </div>
            <div className="border-t border-[#0A0A0A]/8 p-5 sm:p-7 flex justify-end gap-2">
              <button
                onClick={close}
                className="px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/65 hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] bg-[#B8922A] text-white hover:bg-[#a37e1f] inline-flex items-center gap-2 disabled:opacity-40"
                data-testid="activity-save-btn"
              >
                <Save size={13} /> {saving ? "…" : (editing._isNew ? "Créer" : "Enregistrer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

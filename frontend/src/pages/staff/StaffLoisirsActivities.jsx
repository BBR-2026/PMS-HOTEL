import { useEffect, useState } from "react";
import { Plus, Trash2, Edit3, X } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";
import { useStaffAuth } from "../../context/StaffAuthContext";

/**
 * CRUD for Loisirs activities (sub-offers under "Activités & Événements").
 * Managers create / edit / delete activities visible in the booking tunnel.
 */
const fmtXOF = (n) => new Intl.NumberFormat("fr-FR").format(n || 0) + " FCFA";

export default function StaffLoisirsActivities() {
  const { user } = useStaffAuth();
  const isManager = ["manager", "admin"].includes(user?.role);
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | {id?, ...form}
  const blank = {
    name_fr: "", name_en: "", description_fr: "",
    price_adult: 0, price_child: 0, duration_min: 30,
    capacity: 10, category: "Loisir", is_active: true, sort_order: 0,
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/staff/loisirs-activities");
      setItems(data.items || []);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!editing.name_fr?.trim()) {
      toast.error("Nom requis");
      return;
    }
    try {
      const payload = { ...editing };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "" || payload[k] === undefined) delete payload[k];
      });
      if (editing.id) {
        const { id, created_at, updated_at, ...patch } = payload;
        await api.patch(`/staff/loisirs-activities/${id}`, patch);
        toast.success("Activité mise à jour");
      } else {
        await api.post("/staff/loisirs-activities", payload);
        toast.success("Activité créée");
      }
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer cette activité ?")) return;
    try {
      await api.delete(`/staff/loisirs-activities/${id}`);
      toast.success("Supprimée");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const uploadImage = async (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 8 Mo)");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/staff/uploads/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEditing((cur) => cur ? { ...cur, image_url: data.url } : cur);
      toast.success("Image téléchargée");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec de l'upload");
    }
  };

  const toggleActive = async (item) => {
    try {
      await api.patch(`/staff/loisirs-activities/${item.id}`, { is_active: !item.is_active });
      refresh();
    } catch {
      toast.error("Erreur");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto" data-testid="staff-loisirs-activities">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display-serif text-3xl text-[#0A0A0A]">Activités & Loisirs</h1>
          <p className="text-sm text-[#0A0A0A]/55 mt-1">Configurez les sous-offres du pôle « Activités & Événements » (jet ski, paddle, etc.).</p>
        </div>
        {isManager && (
          <button onClick={() => setEditing({ ...blank })} className="btn-gold inline-flex items-center gap-2" data-testid="new-loisir-btn">
            <Plus size={14} /> Nouvelle activité
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-[#0A0A0A]/55 text-sm">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-[#0A0A0A]/15 p-12 text-center text-sm text-[#0A0A0A]/55">
          Aucune activité configurée.
        </div>
      ) : (
        <div className="bg-white border border-[#0A0A0A]/8 overflow-x-auto">
          <table className="w-full text-sm" data-testid="loisirs-list">
            <thead>
              <tr className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                <th className="text-left py-3 px-4">Nom</th>
                <th className="text-left py-3 px-4">Catégorie</th>
                <th className="text-right py-3 px-4">Adulte</th>
                <th className="text-right py-3 px-4">Enfant</th>
                <th className="text-right py-3 px-4">Durée</th>
                <th className="text-right py-3 px-4">Capacité</th>
                <th className="text-center py-3 px-4">Statut</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-[#0A0A0A]/5 last:border-0" data-testid={`loisir-row-${it.id.slice(0,8)}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {it.image_url ? (
                        <img src={it.image_url} alt="" className="w-12 h-12 object-cover border border-[#0A0A0A]/10 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 bg-[#FAFAF7] border border-dashed border-[#0A0A0A]/10 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-display-serif text-[#0A0A0A] truncate">{it.name_fr}</div>
                        {it.description_fr && <div className="text-[0.7rem] text-[#0A0A0A]/55 mt-0.5 truncate max-w-xs">{it.description_fr}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#0A0A0A]/65">{it.category || "—"}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{fmtXOF(it.price_adult)}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-[#0A0A0A]/65">{fmtXOF(it.price_child)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{it.duration_min} min</td>
                  <td className="py-3 px-4 text-right tabular-nums">{it.capacity}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => toggleActive(it)} className={`text-[0.6rem] uppercase tracking-[0.18em] px-2 py-1 ${it.is_active ? "bg-green-50 text-green-700" : "bg-[#0A0A0A]/5 text-[#0A0A0A]/55"}`} data-testid={`toggle-${it.id.slice(0,8)}`}>
                      {it.is_active ? "Actif" : "Inactif"}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isManager && (
                      <div className="inline-flex gap-1.5">
                        <button onClick={() => setEditing({ ...it })} className="text-[#0A0A0A]/55 hover:text-[#B8922A] p-1" data-testid={`edit-${it.id.slice(0,8)}`}><Edit3 size={13} /></button>
                        {isAdmin && (
                          <button onClick={() => remove(it.id)} className="text-[#0A0A0A]/55 hover:text-red-600 p-1" data-testid={`delete-${it.id.slice(0,8)}`}><Trash2 size={13} /></button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" data-testid="loisir-editor">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display-serif text-xl text-[#0A0A0A]">{editing.id ? "Modifier l'activité" : "Nouvelle activité"}</h2>
              <button onClick={() => setEditing(null)} className="text-[#0A0A0A]/55 hover:text-[#0A0A0A]"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <Field label="Nom (FR) *" value={editing.name_fr} onChange={(v) => setEditing({ ...editing, name_fr: v })} testId="loisir-name-fr" />
              <Field label="Nom (EN)" value={editing.name_en || ""} onChange={(v) => setEditing({ ...editing, name_en: v })} testId="loisir-name-en" />
              <Field label="Description (FR)" value={editing.description_fr || ""} onChange={(v) => setEditing({ ...editing, description_fr: v })} multiline testId="loisir-desc-fr" />
              <Field label="Catégorie" value={editing.category || ""} onChange={(v) => setEditing({ ...editing, category: v })} testId="loisir-category" />

              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Image de l&apos;activité</label>
                {editing.image_url && (
                  <div className="mb-2 relative inline-block">
                    <img
                      src={editing.image_url}
                      alt="aperçu"
                      className="h-24 w-32 object-cover border border-[#0A0A0A]/10"
                      data-testid="loisir-image-preview"
                    />
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, image_url: "" })}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-[#0A0A0A] text-white rounded-full text-[0.6rem]"
                      data-testid="loisir-image-clear"
                      aria-label="Supprimer l'image"
                    >
                      ×
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => uploadImage(e.target.files?.[0])}
                  className="text-xs"
                  data-testid="loisir-image-input"
                />
                <div className="text-[0.6rem] text-[#0A0A0A]/45 mt-1">JPG/PNG/WebP — max 8 Mo</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Prix adulte (FCFA) *" value={editing.price_adult} type="number" onChange={(v) => setEditing({ ...editing, price_adult: parseInt(v || 0) })} testId="loisir-price-adult" />
                <Field label="Prix enfant" value={editing.price_child} type="number" onChange={(v) => setEditing({ ...editing, price_child: parseInt(v || 0) })} testId="loisir-price-child" />
                <Field label="Durée (min)" value={editing.duration_min} type="number" onChange={(v) => setEditing({ ...editing, duration_min: parseInt(v || 30) })} testId="loisir-duration" />
                <Field label="Capacité" value={editing.capacity} type="number" onChange={(v) => setEditing({ ...editing, capacity: parseInt(v || 1) })} testId="loisir-capacity" />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#0A0A0A]/85">
                <input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} data-testid="loisir-active" />
                Activité visible dans le tunnel public
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-[#0A0A0A]/70 hover:text-[#0A0A0A]">Annuler</button>
              <button onClick={save} className="btn-gold" data-testid="save-loisir">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", multiline = false, testId }) {
  return (
    <div>
      <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none" data-testid={testId} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none" data-testid={testId} />
      )}
    </div>
  );
}

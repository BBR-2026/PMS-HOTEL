import { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";
import {
  Sparkles, Plus, Pencil, Trash2, X, Save, Star, Copy, Upload, Image as ImageIcon,
} from "lucide-react";

const EMPTY = {
  title: "",
  subtitle: "",
  description: "",
  image_url: "",
  event_dates: [],
  boat_times: [],
  return_boat_times: [],
  price_adult: 0,
  price_child: 0,
  capacity: 40,
  active_from: "",
  active_to: "",
  cta_label: "Réserver ma place",
  status: "draft",
};

const STATUS_FR = { draft: "Brouillon", published: "Publié", archived: "Archivé" };
const STATUS_COLORS = {
  draft: "text-[#0A0A0A]/55 bg-[#FAFAF7] border-[#0A0A0A]/15",
  published: "text-green-700 bg-green-50 border-green-300",
  archived: "text-[#0A0A0A]/45 bg-[#0A0A0A]/5 border-[#0A0A0A]/15",
};

const fmtXOF = (n) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n || 0))} FCFA`;

function fmtDateFR(iso) {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function ChipList({ items, onRemove, testid }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2" data-testid={testid}>
      {items.map((v) => (
        <span key={v} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#B8922A]/10 text-[#B8922A] border border-[#B8922A]/30 text-[0.72rem]">
          {v}
          <button onClick={() => onRemove(v)} className="hover:text-red-600" type="button">
            <X size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}

export default function StaffSpecialEvents() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [returnTimeInput, setReturnTimeInput] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const refresh = () => {
    setLoading(true);
    api.get("/staff/special-events")
      .then((r) => setItems(Array.isArray(r.data?.items) ? r.data.items : []))
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const openCreate = () => {
    setEditing({ _isNew: true });
    setForm(EMPTY);
    setDateInput(""); setTimeInput(""); setReturnTimeInput("");
  };
  const openEdit = (ev) => {
    setEditing(ev);
    setForm({
      title: ev.title || "",
      subtitle: ev.subtitle || "",
      description: ev.description || "",
      image_url: ev.image_url || "",
      event_dates: ev.event_dates || [],
      boat_times: ev.boat_times || [],
      return_boat_times: ev.return_boat_times || [],
      price_adult: ev.price_adult || 0,
      price_child: ev.price_child || 0,
      capacity: ev.capacity || 40,
      active_from: ev.active_from || "",
      active_to: ev.active_to || "",
      cta_label: ev.cta_label || "Réserver ma place",
      status: ev.status || "draft",
    });
    setDateInput(""); setTimeInput(""); setReturnTimeInput("");
  };
  const closeModal = () => { setEditing(null); setForm(EMPTY); };

  const handleImageFile = async (file) => {
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 2.5 MB)");
      return;
    }
    setUploadingImage(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setForm((f) => ({ ...f, image_url: dataUrl }));
      toast.success("Image chargée");
    } catch {
      toast.error("Impossible de lire l'image");
    } finally {
      setUploadingImage(false);
    }
  };

  const addToList = (key, value, setInput) => {
    const v = (value || "").trim();
    if (!v) return;
    if (form[key].includes(v)) { setInput(""); return; }
    setForm((f) => ({ ...f, [key]: [...f[key], v] }));
    setInput("");
  };
  const removeFromList = (key, value) => {
    setForm((f) => ({ ...f, [key]: f[key].filter((x) => x !== value) }));
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Le titre est requis"); return; }
    if (form.event_dates.length === 0) { toast.error("Ajoutez au moins une date"); return; }
    if (form.boat_times.length === 0) { toast.error("Ajoutez au moins un horaire bateau aller"); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      ["active_from", "active_to"].forEach((k) => { if (!payload[k]) delete payload[k]; });
      if (editing?._isNew) {
        await api.post("/staff/special-events", payload);
        toast.success("Événement créé");
      } else {
        await api.patch(`/staff/special-events/${editing.id}`, payload);
        toast.success("Événement mis à jour");
      }
      closeModal();
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const feature = async (ev) => {
    try {
      await api.post(`/staff/special-events/${ev.id}/feature`);
      toast.success(`"${ev.title}" mis en avant`);
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };
  const unfeature = async (ev) => {
    try {
      await api.post(`/staff/special-events/${ev.id}/unfeature`);
      toast.success("Retiré de la une");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };
  const duplicate = async (ev) => {
    try {
      await api.post(`/staff/special-events/${ev.id}/duplicate`);
      toast.success("Événement dupliqué");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };
  const remove = async (ev) => {
    if (!window.confirm(`Supprimer "${ev.title}" ?`)) return;
    try {
      await api.delete(`/staff/special-events/${ev.id}`);
      toast.success("Événement supprimé");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Suppression impossible");
    }
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-special-events">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] inline-flex items-center gap-3">
            <Sparkles size={26} className="text-[#B8922A]" /> Événements spéciaux
          </h1>
          <p className="text-sm text-[#0A0A0A]/55 mt-1">
            Un seul événement peut être mis en avant côté client à la fois.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B8922A] text-white text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#a37e1f] transition-colors"
          data-testid="special-events-create-btn"
        >
          <Plus size={14} /> Nouvel événement
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-[#0A0A0A]/8 p-12 text-center text-[#0A0A0A]/50">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-[#0A0A0A]/8 p-12 text-center" data-testid="special-events-empty">
          <Sparkles size={36} className="text-[#B8922A]/30 mx-auto mb-4" />
          <p className="text-[#0A0A0A]/55 mb-4">Aucun événement spécial pour le moment.</p>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2 border border-[#B8922A] text-[#B8922A] text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#B8922A]/5">
            <Plus size={13} /> Créer le premier
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" data-testid="special-events-grid">
          {items.map((ev) => {
            const seatsLeft = Math.max(0, (ev.capacity || 0) - (ev.booked_guests || 0));
            return (
              <div key={ev.id} className="bg-white border border-[#0A0A0A]/10 flex flex-col overflow-hidden" data-testid={`event-card-${ev.id}`}>
                <div className="relative h-44 bg-[#FAFAF7] overflow-hidden">
                  {ev.image_url ? (
                    <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#0A0A0A]/20">
                      <ImageIcon size={40} />
                    </div>
                  )}
                  {ev.is_featured && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 bg-[#B8922A] text-white text-[0.6rem] uppercase tracking-[0.22em]" data-testid={`event-featured-${ev.id}`}>
                      <Star size={11} fill="currentColor" /> À la une
                    </span>
                  )}
                  <span className={`absolute top-2 left-2 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.22em] border ${STATUS_COLORS[ev.status]}`}>
                    {STATUS_FR[ev.status]}
                  </span>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-display-serif text-lg text-[#0A0A0A] line-clamp-2">{ev.title}</h3>
                  {ev.subtitle && <p className="text-[0.78rem] text-[#0A0A0A]/65 mt-0.5 line-clamp-1">{ev.subtitle}</p>}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[0.7rem]">
                    <div>
                      <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Tarif Adulte</div>
                      <div className="text-[#0A0A0A] font-medium">{fmtXOF(ev.price_adult)}</div>
                    </div>
                    <div>
                      <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Enfant</div>
                      <div className="text-[#0A0A0A] font-medium">{fmtXOF(ev.price_child)}</div>
                    </div>
                    <div>
                      <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Dates</div>
                      <div className="text-[#0A0A0A] truncate">{(ev.event_dates || []).map(fmtDateFR).join(", ") || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Places restantes</div>
                      <div className="text-[#0A0A0A] font-medium">{seatsLeft}/{ev.capacity || 0}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#0A0A0A]/8 flex flex-wrap gap-1.5">
                    {ev.is_featured ? (
                      <button onClick={() => unfeature(ev)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.6rem] uppercase tracking-[0.22em] border border-[#B8922A]/40 text-[#B8922A] hover:bg-[#B8922A]/5" data-testid={`event-unfeature-${ev.id}`}>
                        <Star size={11} fill="currentColor" /> Retirer
                      </button>
                    ) : (
                      <button onClick={() => feature(ev)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.6rem] uppercase tracking-[0.22em] border border-[#B8922A] text-white bg-[#B8922A] hover:bg-[#a37e1f]" data-testid={`event-feature-${ev.id}`}>
                        <Star size={11} /> Mettre en avant
                      </button>
                    )}
                    <button onClick={() => openEdit(ev)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.6rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/65 hover:border-[#0A0A0A] hover:text-[#0A0A0A]" data-testid={`event-edit-${ev.id}`}>
                      <Pencil size={11} /> Modifier
                    </button>
                    <button onClick={() => duplicate(ev)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.6rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/65 hover:border-[#0A0A0A] hover:text-[#0A0A0A]" data-testid={`event-duplicate-${ev.id}`}>
                      <Copy size={11} /> Dupliquer
                    </button>
                    <button onClick={() => remove(ev)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.6rem] uppercase tracking-[0.22em] border border-red-200 text-red-600 hover:bg-red-50" data-testid={`event-delete-${ev.id}`}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => !saving && closeModal()} data-testid="event-modal">
          <div className="bg-white w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex items-center justify-between p-5 sm:p-6 border-b border-[#0A0A0A]/8 z-10">
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A]">
                  {editing._isNew ? "Nouvel événement" : "Modifier l'événement"}
                </div>
                <div className="font-display-serif text-xl text-[#0A0A0A] mt-0.5">
                  {form.title || "Sans titre"}
                </div>
              </div>
              <button onClick={closeModal} disabled={saving} className="p-2 text-[#0A0A0A]/55 hover:text-[#0A0A0A]"><X size={18} /></button>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Visual */}
              <div>
                <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Image hero</label>
                <div className="flex gap-3 items-start">
                  <div className="w-32 h-20 bg-[#FAFAF7] border border-[#0A0A0A]/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {form.image_url ? (
                      <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={22} className="text-[#0A0A0A]/20" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] border border-[#B8922A]/40 text-[#B8922A] hover:bg-[#B8922A]/5 cursor-pointer">
                      <Upload size={12} /> {uploadingImage ? "…" : "Choisir un fichier"}
                      <input type="file" accept="image/*" onChange={(e) => handleImageFile(e.target.files?.[0])} className="hidden" data-testid="event-image-input" />
                    </label>
                    <p className="text-[0.65rem] text-[#0A0A0A]/45 mt-1.5">Ou collez une URL HTTPS :</p>
                    <input
                      value={form.image_url}
                      onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                      placeholder="https://…"
                      className="w-full px-2.5 py-1.5 mt-1 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white"
                      data-testid="event-image-url"
                    />
                  </div>
                </div>
              </div>

              {/* Title + subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Titre *</label>
                  <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-title" />
                </div>
                <div>
                  <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Sous-titre</label>
                  <input value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-subtitle" />
                </div>
              </div>

              <div>
                <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Description longue</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white resize-none" data-testid="event-description" />
              </div>

              {/* Dates */}
              <div>
                <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Date(s) de l'événement *</label>
                <div className="flex gap-2">
                  <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className="px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-date-input" />
                  <button type="button" onClick={() => addToList("event_dates", dateInput, setDateInput)} className="px-3 py-2 text-[0.65rem] uppercase tracking-[0.22em] border border-[#B8922A] text-[#B8922A] hover:bg-[#B8922A]/5" data-testid="event-date-add">+ Ajouter</button>
                </div>
                <ChipList items={form.event_dates.map(fmtDateFR)} onRemove={(v) => {
                  // recover ISO from FR
                  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
                  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : v;
                  removeFromList("event_dates", iso);
                }} testid="event-dates-chips" />
              </div>

              {/* Boat times */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Bateaux aller *</label>
                  <div className="flex gap-2">
                    <input value={timeInput} onChange={(e) => setTimeInput(e.target.value)} placeholder="ex. 17H" className="flex-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-boat-input" />
                    <button type="button" onClick={() => addToList("boat_times", timeInput.toUpperCase(), setTimeInput)} className="px-3 py-2 text-[0.65rem] uppercase tracking-[0.22em] border border-[#B8922A] text-[#B8922A] hover:bg-[#B8922A]/5">+</button>
                  </div>
                  <ChipList items={form.boat_times} onRemove={(v) => removeFromList("boat_times", v)} testid="event-boat-chips" />
                </div>
                <div>
                  <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Bateaux retour</label>
                  <div className="flex gap-2">
                    <input value={returnTimeInput} onChange={(e) => setReturnTimeInput(e.target.value)} placeholder="ex. 23H" className="flex-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-return-input" />
                    <button type="button" onClick={() => addToList("return_boat_times", returnTimeInput.toUpperCase(), setReturnTimeInput)} className="px-3 py-2 text-[0.65rem] uppercase tracking-[0.22em] border border-[#B8922A] text-[#B8922A] hover:bg-[#B8922A]/5">+</button>
                  </div>
                  <ChipList items={form.return_boat_times} onRemove={(v) => removeFromList("return_boat_times", v)} testid="event-return-chips" />
                </div>
              </div>

              {/* Pricing + capacity */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Tarif Adulte (FCFA)</label>
                  <input type="number" value={form.price_adult} onChange={(e) => setForm((f) => ({ ...f, price_adult: parseInt(e.target.value, 10) || 0 }))} className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-price-adult" />
                </div>
                <div>
                  <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Tarif Enfant</label>
                  <input type="number" value={form.price_child} onChange={(e) => setForm((f) => ({ ...f, price_child: parseInt(e.target.value, 10) || 0 }))} className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-price-child" />
                </div>
                <div>
                  <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Capacité max</label>
                  <input type="number" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: parseInt(e.target.value, 10) || 1 }))} className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-capacity" />
                </div>
              </div>

              {/* Visibility window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Visible du</label>
                  <input type="date" value={form.active_from} onChange={(e) => setForm((f) => ({ ...f, active_from: e.target.value }))} className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-active-from" />
                </div>
                <div>
                  <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Au</label>
                  <input type="date" value={form.active_to} onChange={(e) => setForm((f) => ({ ...f, active_to: e.target.value }))} className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-active-to" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Texte du bouton CTA</label>
                  <input value={form.cta_label} onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))} className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-cta" />
                </div>
                <div>
                  <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Statut</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white" data-testid="event-status">
                    <option value="draft">Brouillon (caché du public)</option>
                    <option value="published">Publié (visible)</option>
                    <option value="archived">Archivé</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#0A0A0A]/8 p-4 sm:p-5 flex justify-end gap-2">
              <button onClick={closeModal} disabled={saving} className="px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/65 hover:border-[#0A0A0A] hover:text-[#0A0A0A]" data-testid="event-cancel">Annuler</button>
              <button onClick={save} disabled={saving} className="px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] bg-[#B8922A] text-white hover:bg-[#a37e1f] inline-flex items-center gap-2 disabled:opacity-50" data-testid="event-save">
                <Save size={12} /> {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

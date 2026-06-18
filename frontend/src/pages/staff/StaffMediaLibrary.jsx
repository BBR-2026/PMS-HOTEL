import { useEffect, useMemo, useRef, useState } from "react";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { Upload, Trash2, RefreshCw, Search, X, Image as ImageIcon, Film, Edit3 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const UNIVERSE_OPTIONS = [
  { key: "", label: "Tous les univers" },
  { key: "beach_club", label: "Beach Club" },
  { key: "hebergement", label: "Hébergement" },
  { key: "le_kaai", label: "Restaurant Le Kaai" },
  { key: "corporate", label: "Corporate" },
  { key: "activites_events", label: "Activités & Events" },
];

const KIND_OPTIONS = [
  { key: "", label: "Tous" },
  { key: "image", label: "Images" },
  { key: "video", label: "Vidéos" },
];

export default function StaffMediaLibrary() {
  const { token } = useStaffAuth();
  const [items, setItems] = useState([]);
  const [universe, setUniverse] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  async function load() {
    setLoading(true);
    try {
      const url = new URL(`${API}/staff/media-library`);
      if (universe) url.searchParams.set("universe", universe);
      if (kind) url.searchParams.set("kind", kind);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const r = await fetch(url, { headers: authHeaders });
      if (r.ok) {
        const d = await r.json();
        setItems(d.items || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [universe, kind]);

  async function handleDelete(id) {
    if (!window.confirm("Supprimer ce média ?")) return;
    const r = await fetch(`${API}/staff/media-library/${id}`, {
      method: "DELETE", headers: authHeaders,
    });
    if (r.ok) setItems((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-media-library">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#B8922A]/85 mb-1">
            Revenue Engine · Phase C
          </div>
          <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">
            Médiathèque
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
            Bibliothèque centrale d'images et vidéos pour vos créatifs marketing —
            classés par univers et offres.
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="self-start inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-3 text-xs tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors"
          data-testid="media-upload-btn"
        >
          <Upload size={14} /> Uploader
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <select value={universe} onChange={(e) => setUniverse(e.target.value)} className="border border-[#0A0A0A]/15 px-3 py-2 text-sm bg-white" data-testid="media-universe-filter">
          {UNIVERSE_OPTIONS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="border border-[#0A0A0A]/15 px-3 py-2 text-sm bg-white" data-testid="media-kind-filter">
          {KIND_OPTIONS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
        </select>
        <div className="flex-1 flex items-center gap-2 border border-[#0A0A0A]/15 px-3 bg-white max-w-md">
          <Search size={14} className="text-[#0A0A0A]/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Rechercher un fichier, label…"
            className="flex-1 py-2 text-sm bg-transparent focus:outline-none"
            data-testid="media-search"
          />
          <button onClick={load} className="text-[0.65rem] uppercase tracking-[0.3em] text-[#B8922A]">Go</button>
        </div>
        <button onClick={load} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]" title="Rafraîchir">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Grid */}
      <div className="bg-white border border-[#0A0A0A]/10 p-4" data-testid="media-grid">
        {items.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#0A0A0A]/45">
            {loading ? "Chargement…" : "Aucun média. Uploadez votre première image ou vidéo."}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((m) => (
              <MediaCard
                key={m.id}
                m={m}
                onEdit={() => setEditing(m)}
                onDelete={() => handleDelete(m.id)}
              />
            ))}
          </div>
        )}
      </div>

      {uploadOpen && (
        <UploadModal
          token={token}
          onClose={() => setUploadOpen(false)}
          onUploaded={(m) => { setItems((prev) => [m, ...prev]); setUploadOpen(false); }}
        />
      )}
      {editing && (
        <EditModal
          item={editing}
          token={token}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MediaCard({ m, onEdit, onDelete }) {
  const fullUrl = `${process.env.REACT_APP_BACKEND_URL}${m.url}`;
  return (
    <div className="group border border-[#0A0A0A]/10 bg-[#FAF7F2]/40" data-testid={`media-item-${m.id}`}>
      <div className="relative aspect-square bg-[#0A0A0A]/5">
        {m.kind === "image" ? (
          <img src={fullUrl} alt={m.label || ""} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] uppercase tracking-[0.3em] text-[#0A0A0A]/55">
            <Film size={32} className="mb-2" />
            VIDÉO
          </div>
        )}
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 bg-white border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"><Edit3 size={11} /></button>
          <button onClick={onDelete} className="p-1.5 bg-white border border-[#0A0A0A]/15 hover:border-red-500 hover:text-red-600"><Trash2 size={11} /></button>
        </div>
      </div>
      <div className="p-2">
        <div className="text-xs font-medium truncate">{m.label || m.original_filename}</div>
        {m.universe && (
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#B8922A]/80 mt-1 truncate">
            {m.universe.replace(/_/g, " ")}{m.offer ? ` · ${m.offer}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadModal({ token, onClose, onUploaded }) {
  const fileRef = useRef(null);
  const [universe, setUniverse] = useState("beach_club");
  const [offer, setOffer] = useState("");
  const [label, setLabel] = useState("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Sélectionnez un fichier");
      return;
    }
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("universe", universe);
    fd.append("offer", offer);
    fd.append("label", label);
    fd.append("tags", tags);
    try {
      const r = await fetch(`${API}/staff/media-library`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.detail || "Échec de l'upload");
        setUploading(false);
        return;
      }
      const m = await r.json();
      onUploaded(m);
    } catch (e) {
      setError(String(e));
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="media-upload-modal">
      <form onSubmit={submit} className="bg-white max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b border-[#0A0A0A]/10">
          <div className="font-display-serif text-xl">Uploader un média</div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-[#FAF7F2]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">Fichier (image ou vidéo · max 50 Mo)</label>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="block w-full mt-1 text-sm" required data-testid="media-file-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">Univers</label>
              <select value={universe} onChange={(e) => setUniverse(e.target.value)} className="w-full mt-1 border border-[#0A0A0A]/15 px-3 py-2 text-sm">
                {UNIVERSE_OPTIONS.filter((u) => u.key).map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">Offre (libre)</label>
              <input value={offer} onChange={(e) => setOffer(e.target.value)} className="w-full mt-1 border border-[#0A0A0A]/15 px-3 py-2 text-sm" placeholder="Day Pass" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full mt-1 border border-[#0A0A0A]/15 px-3 py-2 text-sm" placeholder="Couverture campagne été" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">Tags (séparés par virgules)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full mt-1 border border-[#0A0A0A]/15 px-3 py-2 text-sm" placeholder="été, sunset, couple" />
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#0A0A0A]/10">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs tracking-[0.3em] uppercase border border-[#0A0A0A]/15">Annuler</button>
          <button type="submit" disabled={uploading} className="px-5 py-2 text-xs tracking-[0.3em] uppercase bg-[#0A0A0A] text-white hover:bg-[#B8922A] disabled:opacity-60" data-testid="media-upload-submit">
            {uploading ? "Upload…" : "Uploader"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditModal({ item, token, onClose, onSaved }) {
  const [universe, setUniverse] = useState(item.universe || "");
  const [offer, setOffer] = useState(item.offer || "");
  const [label, setLabel] = useState(item.label || "");
  const [tags, setTags] = useState((item.tags || []).join(", "));

  async function submit(e) {
    e.preventDefault();
    const r = await fetch(`${API}/staff/media-library/${item.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        universe: universe || null,
        offer: offer || null,
        label: label || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    if (r.ok) {
      onSaved({
        ...item,
        universe: universe || null,
        offer: offer || null,
        label: label || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-[#0A0A0A]/10">
          <div className="font-display-serif text-xl">Modifier le média</div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-[#FAF7F2]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">Univers</label>
            <select value={universe} onChange={(e) => setUniverse(e.target.value)} className="w-full mt-1 border border-[#0A0A0A]/15 px-3 py-2 text-sm">
              <option value="">—</option>
              {UNIVERSE_OPTIONS.filter((u) => u.key).map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">Offre</label>
            <input value={offer} onChange={(e) => setOffer(e.target.value)} className="w-full mt-1 border border-[#0A0A0A]/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full mt-1 border border-[#0A0A0A]/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">Tags</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full mt-1 border border-[#0A0A0A]/15 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#0A0A0A]/10">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs tracking-[0.3em] uppercase border border-[#0A0A0A]/15">Annuler</button>
          <button type="submit" className="px-5 py-2 text-xs tracking-[0.3em] uppercase bg-[#0A0A0A] text-white hover:bg-[#B8922A]">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}

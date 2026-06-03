import { useEffect, useState, useRef, useCallback } from "react";
import api from "../../lib/api";
import {
  Camera, UploadCloud, Trash2, Loader2, Image as ImageIcon,
  FolderPlus, Pencil, ExternalLink, X, AlertTriangle, Plus,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Staff admin for the public photo gallery.
 *
 * Albums are 100% manual: staff creates them with a label, then uploads photos.
 * The left rail lists every custom album with a thumbnail count, with a header
 * "+ Nouveau" CTA. The main panel handles drag-and-drop + click-to-pick uploads
 * and renders the photos in a hover-to-delete grid.
 */
export default function StaffGallery() {
  const [albums, setAlbums] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [albumData, setAlbumData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameLabel, setRenameLabel] = useState("");
  const inputRef = useRef(null);

  // ---------------- Loaders ----------------
  const loadAlbums = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/gallery/albums");
      setAlbums(data.albums || []);
    } catch (e) {
      toast.error("Erreur de chargement des albums");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlbumDetail = useCallback(async (id) => {
    if (!id) { setAlbumData(null); return; }
    try {
      const { data } = await api.get(`/gallery/albums/${encodeURIComponent(id)}`, {
        params: { limit: 200 },
      });
      setAlbumData(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur de chargement de l'album");
      setAlbumData(null);
    }
  }, []);

  useEffect(() => { loadAlbums(); }, [loadAlbums]);
  useEffect(() => { loadAlbumDetail(selectedId); }, [selectedId, loadAlbumDetail]);

  // Auto-select the first album when albums load and nothing is selected.
  useEffect(() => {
    if (!selectedId && albums.length > 0) setSelectedId(albums[0].id);
  }, [albums, selectedId]);

  // ---------------- Album CRUD ----------------
  const createAlbum = async () => {
    const label = newLabel.trim();
    if (!label) return;
    try {
      const { data } = await api.post("/staff/gallery/albums", { label });
      toast.success(`Album "${label}" créé`);
      setShowCreate(false);
      setNewLabel("");
      await loadAlbums();
      setSelectedId(data.id);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Création impossible");
    }
  };

  const renameAlbum = async () => {
    if (!albumData?.album?.id || !renameLabel.trim()) return;
    try {
      await api.patch(
        `/staff/gallery/albums/${encodeURIComponent(albumData.album.id)}`,
        { label: renameLabel.trim() },
      );
      toast.success("Album renommé");
      setRenaming(false);
      await Promise.all([loadAlbums(), loadAlbumDetail(selectedId)]);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Modification impossible");
    }
  };

  const deleteAlbum = async () => {
    if (!albumData?.album?.id) return;
    if (!window.confirm(
      `Supprimer définitivement l'album "${albumData.album.label}" et toutes ses photos ?`
    )) return;
    try {
      await api.delete(`/staff/gallery/albums/${encodeURIComponent(albumData.album.id)}`);
      toast.success("Album supprimé");
      setSelectedId(null);
      setAlbumData(null);
      await loadAlbums();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Suppression impossible");
    }
  };

  // ---------------- Uploads ----------------
  const handleFiles = async (files) => {
    if (!selectedId || !files?.length) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    let ok = 0, ko = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const fd = new FormData();
        fd.append("album_id", selectedId);
        fd.append("file", files[i]);
        await api.post("/staff/gallery/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        ok++;
      } catch (e) {
        ko++;
        toast.error(`${files[i].name}: ${e.response?.data?.detail || e.message}`);
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setUploading(false);
    setProgress({ done: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = "";
    if (ok > 0) {
      toast.success(`${ok} photo${ok > 1 ? "s" : ""} ajoutée${ok > 1 ? "s" : ""}${ko ? ` · ${ko} échec${ko > 1 ? "s" : ""}` : ""}`);
      await Promise.all([loadAlbums(), loadAlbumDetail(selectedId)]);
    }
  };

  const deletePhoto = async (imgId) => {
    if (!window.confirm("Supprimer cette photo ?")) return;
    try {
      await api.delete(`/staff/gallery/${imgId}`);
      toast.success("Photo supprimée");
      await Promise.all([loadAlbums(), loadAlbumDetail(selectedId)]);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Suppression impossible");
    }
  };

  // ---------------- Render ----------------
  const isCustom = albumData?.album?.kind === "custom";

  return (
    <div className="space-y-6" data-testid="staff-gallery-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Camera size={20} className="text-[#B8922A]" />
          <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">Galerie photo</h1>
        </div>
        <button
          onClick={() => { setNewLabel(""); setShowCreate(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] bg-[#B8922A] text-white hover:bg-[#a37e1f] transition-colors"
          data-testid="create-album-cta"
        >
          <FolderPlus size={14} /> Nouvel album
        </button>
      </div>
      <p className="text-sm text-[#0A0A0A]/55 max-w-3xl">
        Créez des albums et téléversez les photos qui apparaîtront sur la page publique <code className="text-xs bg-[#FAFAF7] px-1.5 py-0.5">/galerie</code>. Vos clients pourront les parcourir et télécharger les originaux librement.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 lg:gap-7">
        {/* ===== Left rail: album list ===== */}
        <aside className="bg-white border border-[#0A0A0A]/10">
          <div className="px-4 py-3 border-b border-[#0A0A0A]/10 flex items-center justify-between">
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A]">Albums ({albums.length})</span>
            <button
              onClick={() => { setNewLabel(""); setShowCreate(true); }}
              className="text-[#B8922A] hover:text-[#9d7a23] inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.18em]"
              data-testid="rail-new-album"
              title="Créer un album"
            >
              <Plus size={12} /> Nouveau
            </button>
          </div>
          <div className="max-h-[60vh] lg:max-h-[70vh] overflow-y-auto" data-testid="albums-list">
            {loading ? (
              <div className="px-4 py-6 text-center text-xs text-[#0A0A0A]/40">
                <Loader2 size={14} className="animate-spin mx-auto" />
              </div>
            ) : albums.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <ImageIcon size={20} className="mx-auto text-[#0A0A0A]/25 mb-2" />
                <div className="text-xs text-[#0A0A0A]/55 mb-3">Aucun album pour l'instant.</div>
                <button
                  onClick={() => { setNewLabel(""); setShowCreate(true); }}
                  className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] hover:underline"
                  data-testid="empty-create-album"
                >
                  + Créer le premier album
                </button>
              </div>
            ) : (
              albums.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#0A0A0A]/5 transition-colors flex items-center gap-3 ${
                    selectedId === a.id ? "bg-[#B8922A]/5 border-l-2 border-l-[#B8922A]" : "hover:bg-[#FAFAF7]"
                  }`}
                  data-testid={`album-tab-${a.id}`}
                >
                  <div className="w-10 h-10 flex-shrink-0 bg-[#FAFAF7] overflow-hidden flex items-center justify-center">
                    {a.cover_url ? (
                      <img src={a.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={14} className="text-[#0A0A0A]/30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[#0A0A0A] truncate">{a.label}</div>
                    <div className="text-[0.65rem] text-[#0A0A0A]/50 mt-0.5">
                      {a.photo_count} photo{a.photo_count > 1 ? "s" : ""}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ===== Main panel ===== */}
        <main className="bg-white border border-[#0A0A0A]/10 p-5 sm:p-6">
          {!albumData ? (
            <div className="py-16 text-center" data-testid="no-album-selected">
              <ImageIcon size={28} className="mx-auto text-[#0A0A0A]/25 mb-3" />
              <div className="text-sm text-[#0A0A0A]/55">
                {albums.length === 0
                  ? "Créez votre premier album pour commencer à téléverser des photos."
                  : "Sélectionnez un album dans la liste à gauche."}
              </div>
            </div>
          ) : (
            <>
              {/* Header with title and actions */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">Album libre</div>
                  {renaming ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={renameLabel}
                        onChange={(e) => setRenameLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") renameAlbum(); if (e.key === "Escape") setRenaming(false); }}
                        autoFocus
                        className="px-3 py-1.5 border border-[#B8922A] focus:outline-none text-xl font-display-serif bg-white min-w-[260px]"
                        data-testid="rename-input"
                      />
                      <button onClick={renameAlbum} className="px-3 py-1.5 bg-[#B8922A] text-white text-[0.62rem] uppercase tracking-[0.22em]">OK</button>
                      <button onClick={() => setRenaming(false)} className="px-2 py-1.5 text-[#0A0A0A]/60 hover:text-[#0A0A0A]"><X size={14} /></button>
                    </div>
                  ) : (
                    <h2 className="font-display-serif text-2xl text-[#0A0A0A] break-words">{albumData.album?.label}</h2>
                  )}
                  <div className="text-[0.7rem] text-[#0A0A0A]/55 mt-1">
                    {albumData.total} photo{albumData.total > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                  {isCustom && !renaming && (
                    <>
                      <button
                        onClick={() => { setRenameLabel(albumData.album.label); setRenaming(true); }}
                        className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60 hover:text-[#B8922A] inline-flex items-center gap-1.5"
                        data-testid="rename-album"
                      >
                        <Pencil size={11} /> Renommer
                      </button>
                      <button
                        onClick={deleteAlbum}
                        className="text-[0.62rem] uppercase tracking-[0.22em] text-red-600 hover:text-red-800 inline-flex items-center gap-1.5"
                        data-testid="delete-album"
                      >
                        <Trash2 size={11} /> Supprimer
                      </button>
                    </>
                  )}
                  <a
                    href={`/galerie/${encodeURIComponent(selectedId || "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60 hover:text-[#B8922A] inline-flex items-center gap-1.5"
                    data-testid="open-public-album"
                  >
                    Page publique <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* Upload zone */}
              <div
                onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFiles(Array.from(e.dataTransfer.files || []));
                }}
                className={`border-2 border-dashed p-6 sm:p-8 text-center transition-colors mb-5 ${
                  dragOver ? "border-[#B8922A] bg-[#B8922A]/5" : "border-[#0A0A0A]/15 bg-[#FAFAF7]"
                }`}
                data-testid="upload-zone"
              >
                <UploadCloud size={26} className="mx-auto text-[#B8922A] mb-3" />
                <div className="text-sm text-[#0A0A0A]/75 mb-3">
                  Glissez vos photos ici ou{" "}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="text-[#B8922A] underline hover:text-[#9d7a23]"
                    data-testid="upload-pick"
                  >
                    parcourez votre ordinateur
                  </button>
                </div>
                <div className="text-[0.65rem] text-[#0A0A0A]/45">
                  JPG, PNG, WebP — jusqu'à 15 Mo par fichier
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  multiple
                  onChange={(e) => handleFiles(Array.from(e.target.files || []))}
                  className="hidden"
                  data-testid="upload-input"
                />
                {uploading && (
                  <div className="mt-4 text-[0.72rem] text-[#0A0A0A]/70 inline-flex items-center gap-2" data-testid="upload-progress">
                    <Loader2 size={12} className="animate-spin" /> Envoi… {progress.done}/{progress.total}
                  </div>
                )}
              </div>

              {/* Photo grid */}
              {albumData.items?.length === 0 ? (
                <div className="text-center text-sm text-[#0A0A0A]/45 py-10" data-testid="album-empty">
                  Aucune photo encore. Déposez votre première image ci-dessus.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="photo-grid">
                  {(albumData.items || []).map((img) => (
                    <div key={img.id} className="relative group aspect-square overflow-hidden bg-[#FAFAF7]">
                      <img
                        src={img.thumb_url || img.file_url}
                        alt={img.filename || ""}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <button
                        onClick={() => deletePhoto(img.id)}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-600 hover:bg-red-600 hover:text-white opacity-0 group-hover:opacity-100 transition"
                        data-testid={`delete-photo-${img.id}`}
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ===== Create album modal ===== */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
          data-testid="create-album-modal"
        >
          <div className="bg-white w-full max-w-md p-6 sm:p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A]">Nouvel album</div>
                <h3 className="font-display-serif text-xl text-[#0A0A0A] mt-1">Créer un album photo</h3>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-1 text-[#0A0A0A]/55 hover:text-[#0A0A0A]"><X size={18} /></button>
            </div>
            <label className="block text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5">Nom de l'album</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createAlbum(); }}
              placeholder='Ex. "Soirée privée — Juin 2026"'
              autoFocus
              className="w-full px-3 py-2.5 border border-[#0A0A0A]/20 focus:border-[#B8922A] outline-none text-sm bg-white mb-2"
              data-testid="new-album-label"
            />
            <div className="text-[0.65rem] text-[#0A0A0A]/45 inline-flex items-center gap-1 mb-5">
              <AlertTriangle size={11} /> Vous pourrez ajouter ou supprimer des photos à tout moment.
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/70 hover:text-[#0A0A0A]"
              >Annuler</button>
              <button
                onClick={createAlbum}
                disabled={!newLabel.trim()}
                className="px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] bg-[#B8922A] text-white hover:bg-[#a37e1f] disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="create-album-submit"
              >Créer l'album</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

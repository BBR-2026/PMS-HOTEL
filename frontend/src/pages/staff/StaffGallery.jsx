import { useEffect, useState, useRef } from "react";
import api from "../../lib/api";
import { Camera, UploadCloud, Trash2, ChevronLeft, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

/**
 * Staff admin for the public photo gallery.
 * - Left rail (or top on mobile): the list of auto-derived albums, with a
 *   thumbnail count.
 * - Main panel: drag-and-drop / file picker upload for the selected album +
 *   responsive grid showing the photos already uploaded (with delete CTA).
 *
 * Uses /api/staff/gallery/upload (multipart) and /api/staff/gallery/{id}
 * (DELETE). Albums themselves are virtual — derived from OFFERS catalog +
 * published special_events — and don't need a CRUD UI.
 */
export default function StaffGallery() {
  const [albums, setAlbums] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [albumData, setAlbumData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const inputRef = useRef(null);

  const loadAlbums = async () => {
    try {
      const { data } = await api.get("/gallery/albums");
      setAlbums(data.albums || []);
      if (!selectedId && data.albums?.length) {
        setSelectedId(data.albums[0].id);
      }
    } catch (e) {
      toast.error("Erreur de chargement des albums");
    }
  };

  const loadAlbumDetail = async (id) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/gallery/albums/${encodeURIComponent(id)}`, {
        params: { limit: 200 },
      });
      setAlbumData(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur de chargement de l'album");
      setAlbumData(null);
    }
  };

  useEffect(() => { loadAlbums(); }, []);
  useEffect(() => { loadAlbumDetail(selectedId); }, [selectedId]);

  const handleFiles = async (files) => {
    if (!selectedId || !files?.length) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    let success = 0;
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fd = new FormData();
        fd.append("album_id", selectedId);
        fd.append("file", file);
        await api.post("/staff/gallery/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        success++;
      } catch (e) {
        failed++;
        const detail = e.response?.data?.detail || e.message;
        toast.error(`${file.name}: ${detail}`);
      }
      setUploadProgress({ done: i + 1, total: files.length });
    }
    setUploading(false);
    setUploadProgress({ done: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = "";
    if (success > 0) {
      toast.success(`${success} photo${success > 1 ? "s" : ""} uploadée${success > 1 ? "s" : ""}${failed ? ` · ${failed} échec${failed > 1 ? "s" : ""}` : ""}`);
      await Promise.all([loadAlbums(), loadAlbumDetail(selectedId)]);
    }
  };

  const deletePhoto = async (id) => {
    if (!window.confirm("Supprimer cette photo ?")) return;
    try {
      await api.delete(`/staff/gallery/${id}`);
      toast.success("Photo supprimée");
      await Promise.all([loadAlbums(), loadAlbumDetail(selectedId)]);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Suppression impossible");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(Array.from(e.dataTransfer.files || []));
  };

  return (
    <div className="space-y-6" data-testid="staff-gallery-page">
      <div className="flex items-center gap-3">
        <Camera size={20} className="text-[#B8922A]" />
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">Galerie photo</h1>
      </div>
      <p className="text-sm text-[#0A0A0A]/55 max-w-3xl">
        Téléversez les photos de vos événements et offres. Les albums sont créés automatiquement
        à partir du catalogue d'expériences et des événements spéciaux publiés.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 lg:gap-7">
        {/* Albums list */}
        <aside className="bg-white border border-[#0A0A0A]/10">
          <div className="px-4 py-3 border-b border-[#0A0A0A]/10 text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A]">
            Albums
          </div>
          <div className="max-h-[60vh] lg:max-h-[70vh] overflow-y-auto" data-testid="albums-list">
            {albums.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`w-full text-left px-4 py-3 border-b border-[#0A0A0A]/5 transition-colors flex items-center gap-3 ${
                  selectedId === a.id ? "bg-[#B8922A]/5 border-l-2 border-l-[#B8922A]" : "hover:bg-[#FAFAF7]"
                }`}
                data-testid={`album-tab-${a.id}`}
              >
                <div className="w-10 h-10 flex-shrink-0 bg-[#FAFAF7] overflow-hidden">
                  {a.cover_url ? (
                    <img src={a.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={14} className="m-auto mt-3 text-[#0A0A0A]/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[#0A0A0A] truncate">{a.label}</div>
                  <div className="text-[0.65rem] text-[#0A0A0A]/50 mt-0.5">
                    {a.photo_count} photo{a.photo_count > 1 ? "s" : ""}
                    {a.kind === "special_event" && <span className="ml-1.5 text-[#B8922A]">· événement</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main panel */}
        <main className="bg-white border border-[#0A0A0A]/10 p-5 sm:p-6">
          {!albumData ? (
            <div className="text-sm text-[#0A0A0A]/50">Sélectionnez un album…</div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">
                    {albumData.album?.kind === "special_event" ? "Événement spécial" : "Expérience signature"}
                  </div>
                  <h2 className="font-display-serif text-2xl text-[#0A0A0A]">{albumData.album?.label}</h2>
                  <div className="text-[0.7rem] text-[#0A0A0A]/55 mt-1">
                    {albumData.total} photo{albumData.total > 1 ? "s" : ""} dans l'album
                  </div>
                </div>
                <a
                  href={`/galerie/${encodeURIComponent(selectedId || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60 hover:text-[#B8922A] inline-flex items-center gap-1.5"
                  data-testid="open-public-album"
                >
                  Voir page publique →
                </a>
              </div>

              {/* Upload zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={onDrop}
                className="border-2 border-dashed border-[#B8922A]/40 bg-[#FBF8EF] p-6 sm:p-8 text-center mb-6"
                data-testid="upload-dropzone"
              >
                <UploadCloud size={28} className="text-[#B8922A] mx-auto mb-2" />
                <div className="text-sm text-[#0A0A0A]/80 mb-1">
                  Glissez-déposez vos photos ici ou
                </div>
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="mt-2 px-5 py-2 bg-[#B8922A] text-white text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] disabled:opacity-50 inline-flex items-center gap-2"
                  data-testid="upload-pick-btn"
                >
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                  {uploading ? `Upload ${uploadProgress.done}/${uploadProgress.total}…` : "Choisir des photos"}
                </button>
                <input
                  type="file"
                  ref={inputRef}
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  onChange={(e) => handleFiles(Array.from(e.target.files || []))}
                  className="hidden"
                  data-testid="upload-input"
                />
                <div className="text-[0.65rem] text-[#0A0A0A]/45 mt-3">
                  JPEG, PNG, WebP ou HEIC. Taille max : 15 Mo par fichier.
                </div>
              </div>

              {/* Photo grid */}
              {albumData.items.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#0A0A0A]/15 bg-[#FAFAF7]" data-testid="album-empty">
                  <ImageIcon size={32} className="mx-auto text-[#0A0A0A]/25 mb-2" />
                  <div className="text-sm text-[#0A0A0A]/55">Aucune photo dans cet album</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3" data-testid="staff-photo-grid">
                  {albumData.items.map((img) => (
                    <div key={img.id} className="relative group aspect-square bg-[#FAFAF7] overflow-hidden" data-testid={`staff-photo-${img.id}`}>
                      <img
                        src={img.thumb_url || img.url}
                        alt={img.filename}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-[#0A0A0A]/0 group-hover:bg-[#0A0A0A]/55 transition-colors flex items-center justify-center gap-2">
                        <button
                          onClick={() => deletePhoto(img.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 bg-red-600 hover:bg-red-700 text-white transition-opacity"
                          data-testid={`delete-photo-${img.id}`}
                          aria-label="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-gradient-to-t from-[#0A0A0A]/80 to-transparent text-[0.6rem] text-white truncate">
                        {img.filename}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

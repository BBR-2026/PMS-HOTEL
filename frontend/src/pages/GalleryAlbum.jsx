import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { ChevronLeft, Download, X, ChevronRight, ChevronLeft as ChevronL } from "lucide-react";
import { toast } from "sonner";

/**
 * Album detail page — masonry grid with infinite-scroll fallback (manual "load
 * more" button). Tapping a photo opens a full-screen lightbox with prev/next
 * navigation and a download CTA.
 */
const PAGE_SIZE = 40;

export default function GalleryAlbum() {
  const { albumId } = useParams();
  const decodedId = decodeURIComponent(albumId);
  const [album, setAlbum] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState(-1);

  const loadPage = useCallback(async (pageNum, append) => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/gallery/albums/${encodeURIComponent(decodedId)}`,
        { params: { page: pageNum, limit: PAGE_SIZE } },
      );
      setAlbum(data.album);
      setTotal(data.total);
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [decodedId]);

  useEffect(() => { loadPage(1, false); }, [loadPage]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    loadPage(next, true);
  };

  // Keyboard nav inside lightbox
  useEffect(() => {
    if (lightboxIdx < 0) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setLightboxIdx(-1);
      else if (e.key === "ArrowRight") setLightboxIdx((i) => Math.min(items.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setLightboxIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, items.length]);

  const hasMore = items.length < total;

  return (
    <div className="bg-white text-[#0A0A0A] min-h-screen" data-testid="gallery-album-page">
      <section className="pt-28 md:pt-36 pb-8 px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <Link
            to="/galerie"
            className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] mb-5"
            data-testid="back-to-albums"
          >
            <ChevronLeft size={14} /> Tous les albums
          </Link>
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2">
            {album?.kind === "special_event" ? "Événement spécial" : "Expérience signature"}
          </div>
          <h1 className="font-display-serif text-4xl md:text-5xl text-[#0A0A0A] tracking-tight leading-[1.05] mb-3">
            {album?.label || "Album"}
          </h1>
          <p className="text-sm text-[#0A0A0A]/55">
            {total} photo{total > 1 ? "s" : ""}
          </p>
        </div>
      </section>

      <section className="pb-24 px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          {loading && items.length === 0 && (
            <div className="text-center text-[#0A0A0A]/50 py-20 text-sm" data-testid="album-loading">
              Chargement…
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="text-center py-20 border border-dashed border-[#0A0A0A]/15 bg-[#FAFAF7]" data-testid="album-empty">
              <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#0A0A0A]/40 mb-2">Aucune photo</div>
              <p className="text-sm text-[#0A0A0A]/55">Les photos de cet événement seront bientôt disponibles.</p>
            </div>
          )}

          {items.length > 0 && (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3"
              data-testid="photo-grid"
            >
              {items.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setLightboxIdx(idx)}
                  className="relative overflow-hidden aspect-square bg-[#FAFAF7] group focus:outline-none focus:ring-2 focus:ring-[#B8922A]"
                  data-testid={`photo-${img.id}`}
                >
                  <img
                    src={img.thumb_url || img.url}
                    alt={img.filename}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                  />
                  <div className="absolute inset-0 bg-[#0A0A0A]/0 group-hover:bg-[#0A0A0A]/15 transition-colors" />
                </button>
              ))}
            </div>
          )}

          {hasMore && (
            <div className="text-center mt-10">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-3 border border-[#B8922A] text-[#B8922A] text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#B8922A]/5 transition-colors disabled:opacity-50"
                data-testid="load-more-photos"
              >
                {loading ? "Chargement…" : `Charger ${Math.min(PAGE_SIZE, total - items.length)} photos de plus`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ===== Lightbox ===== */}
      {lightboxIdx >= 0 && items[lightboxIdx] && (
        <Lightbox
          image={items[lightboxIdx]}
          hasPrev={lightboxIdx > 0}
          hasNext={lightboxIdx < items.length - 1}
          onClose={() => setLightboxIdx(-1)}
          onPrev={() => setLightboxIdx((i) => Math.max(0, i - 1))}
          onNext={() => setLightboxIdx((i) => Math.min(items.length - 1, i + 1))}
        />
      )}
    </div>
  );
}

function Lightbox({ image, hasPrev, hasNext, onClose, onPrev, onNext }) {
  const downloadImage = async () => {
    try {
      const res = await fetch(image.url, { credentials: "omit" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Preserve the original filename when available (browser-friendly)
      a.download = image.filename || `bbr-${image.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Téléchargement impossible");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0A0A0A]/95 flex items-center justify-center p-4"
      data-testid="lightbox"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white hover:text-[#B8922A] p-2"
        data-testid="lightbox-close"
        aria-label="Fermer"
      >
        <X size={28} />
      </button>

      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 text-white hover:text-[#B8922A] p-2"
          data-testid="lightbox-prev"
          aria-label="Photo précédente"
        >
          <ChevronL size={36} />
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 text-white hover:text-[#B8922A] p-2"
          data-testid="lightbox-next"
          aria-label="Photo suivante"
        >
          <ChevronRight size={36} />
        </button>
      )}

      <div className="max-w-[95vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={image.url}
          alt={image.filename}
          className="max-w-[95vw] max-h-[85vh] object-contain"
        />
        <div className="mt-3 flex items-center justify-between gap-4 text-white">
          <div className="text-xs text-white/60 truncate">{image.filename}</div>
          <button
            onClick={downloadImage}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#B8922A] hover:bg-[#9d7a23] text-white text-[0.68rem] uppercase tracking-[0.22em]"
            data-testid="download-photo"
          >
            <Download size={13} /> Télécharger l'original
          </button>
        </div>
      </div>
    </div>
  );
}

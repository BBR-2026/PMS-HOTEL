import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { ArrowRight, Camera } from "lucide-react";

/**
 * Public album index. Lists every album (auto-derived from offers + published
 * events) as a responsive masonry grid. Empty albums are still surfaced so
 * users can preview the offers' hero shots — they just don't open into a
 * photo page until the resort uploads content.
 */
export default function Gallery() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/gallery/albums")
      .then((r) => setAlbums(r.data?.albums || []))
      .catch(() => setAlbums([]))
      .finally(() => setLoading(false));
  }, []);

  const withPhotos = albums; // all albums are user-created — show as-is

  return (
    <div className="bg-white text-[#0A0A0A] min-h-screen" data-testid="gallery-page">
      <section className="pt-32 md:pt-40 pb-10 px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-3 flex items-center gap-2">
            <Camera size={14} /> Galerie photo
          </div>
          <h1 className="font-display-serif text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight leading-[1.05] mb-5">
            Revivez vos<br />moments BBR.
          </h1>
          <div className="gold-divider mb-5" />
          <p className="text-base text-[#0A0A0A]/60 max-w-2xl leading-relaxed">
            Parcourez nos albums photos et téléchargez librement vos clichés préférés.
          </p>
        </div>
      </section>

      <section className="pb-24 px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          {loading && (
            <div className="text-center text-[#0A0A0A]/50 py-16 text-sm" data-testid="gallery-loading">Chargement…</div>
          )}

          {!loading && withPhotos.length === 0 && (
            <div className="text-center py-20 border border-dashed border-[#0A0A0A]/15 bg-[#FAFAF7]" data-testid="gallery-empty">
              <Camera size={32} className="mx-auto text-[#0A0A0A]/25 mb-4" />
              <p className="text-sm text-[#0A0A0A]/55">Aucun album n'a encore été publié. Revenez bientôt.</p>
            </div>
          )}

          {!loading && withPhotos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7" data-testid="albums-grid">
              {withPhotos.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AlbumCard({ album }) {
  return (
    <Link
      to={`/galerie/${encodeURIComponent(album.id)}`}
      className="group block relative overflow-hidden border border-[#0A0A0A]/8 bg-[#FAFAF7] aspect-[4/3]"
      data-testid={`album-card-${album.id}`}
    >
      {album.cover_url ? (
        <img
          src={album.cover_url}
          alt={album.label}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#B8922A]/20 to-[#0A0A0A]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/85 via-[#0A0A0A]/15 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6 text-white">
        <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-1.5">
          {album.kind === "special_event"
            ? "Événement spécial"
            : album.kind === "custom"
            ? "Album libre"
            : "Expérience signature"}
        </div>
        <h3 className="font-display-serif text-2xl md:text-3xl tracking-tight leading-tight mb-2">
          {album.label}
        </h3>
        <div className="flex items-center gap-3 text-[0.72rem] text-white/80">
          <span>{album.photo_count} photo{album.photo_count > 1 ? "s" : ""}</span>
          <span className="inline-flex items-center gap-1 text-[#B8922A] group-hover:gap-2 transition-all">
            Voir <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}

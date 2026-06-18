/**
 * Vitrine Blog (Journal) — Public list page.
 *
 * Editorial luxury hotel feel : large feature card + grid of recent articles.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function VitrineBlog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/api/blog/articles?limit=30`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const featured = items[0];
  const rest = items.slice(1);

  return (
    <div className="bg-white text-[#0A0A0A]" data-testid="vitrine-blog">
      {/* HERO */}
      <section className="border-b border-[#0A0A0A]/8">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
          <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-6">
            · Le journal BBR ·
          </div>
          <h1 className="font-serif font-light text-5xl md:text-7xl leading-[1.05]">
            Récits de l'île.
          </h1>
          <p className="mt-8 text-base md:text-lg text-[#0A0A0A]/65 max-w-2xl mx-auto font-light leading-relaxed">
            Chroniques, rencontres, recettes du Kaai, art de vivre lagunaire.
            Carnet ouvert sur la vie au Boulay Beach Resort.
          </p>
          <div className="w-12 h-px bg-[#B8922A] mx-auto mt-10" />
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6">
          {loading ? (
            <div className="text-center py-20 text-sm text-[#0A0A0A]/45">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 max-w-md mx-auto">
              <p className="text-base text-[#0A0A0A]/65 leading-relaxed font-light">
                Notre rédaction prépare les premiers récits.
                Revenez très bientôt pour découvrir nos chroniques.
              </p>
            </div>
          ) : (
            <>
              {/* Featured article */}
              {featured && (
                <Link
                  to={`/blog/${featured.slug}`}
                  className="group grid lg:grid-cols-12 gap-8 lg:gap-14 items-center mb-20 md:mb-28"
                  data-testid="blog-featured"
                >
                  <div className="lg:col-span-7 aspect-[4/3] lg:aspect-[5/4] overflow-hidden bg-[#FAF7F2]">
                    {featured.cover_image_url && (
                      <img
                        src={featured.cover_image_url}
                        alt={featured.title}
                        className="w-full h-full object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-[1.04]"
                      />
                    )}
                  </div>
                  <div className="lg:col-span-5">
                    <div className="text-[0.6rem] tracking-[0.5em] uppercase text-[#B8922A] mb-5">
                      {featured.category || "À la une"}
                    </div>
                    <h2 className="font-serif font-light text-3xl md:text-5xl leading-[1.1] mb-6 group-hover:text-[#B8922A] transition-colors">
                      {featured.title}
                    </h2>
                    {featured.excerpt && (
                      <p className="text-base md:text-lg text-[#0A0A0A]/70 leading-relaxed font-light mb-7">
                        {featured.excerpt}
                      </p>
                    )}
                    <ArticleMeta a={featured} />
                    <div className="mt-7 inline-flex items-center gap-2 text-[0.65rem] tracking-[0.35em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A] pb-1 group-hover:text-[#B8922A] group-hover:border-[#B8922A] transition-colors">
                      Lire l'article <ArrowRight size={12} />
                    </div>
                  </div>
                </Link>
              )}

              {/* Grid of rest */}
              {rest.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14"
                     data-testid="blog-grid">
                  {rest.map((a) => (
                    <BlogCard key={a.id} a={a} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function BlogCard({ a }) {
  return (
    <Link
      to={`/blog/${a.slug}`}
      className="group block"
      data-testid={`blog-card-${a.slug}`}
    >
      <div className="aspect-[4/5] overflow-hidden bg-[#FAF7F2] mb-6">
        {a.cover_image_url && (
          <img
            src={a.cover_image_url}
            alt={a.title}
            className="w-full h-full object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-[1.05]"
          />
        )}
      </div>
      <div className="text-[0.55rem] tracking-[0.45em] uppercase text-[#B8922A] mb-3">
        {a.category || "Journal"}
      </div>
      <h3 className="font-serif font-light text-xl md:text-2xl leading-tight text-[#0A0A0A] mb-3 group-hover:text-[#B8922A] transition-colors">
        {a.title}
      </h3>
      {a.excerpt && (
        <p className="text-sm text-[#0A0A0A]/65 leading-relaxed line-clamp-3 font-light mb-4">
          {a.excerpt}
        </p>
      )}
      <ArticleMeta a={a} compact />
    </Link>
  );
}

function ArticleMeta({ a, compact }) {
  const date = a.published_at
    ? new Date(a.published_at).toLocaleDateString("fr-FR", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : null;
  return (
    <div className={`flex items-center gap-4 ${compact ? "text-[10px]" : "text-xs"} text-[#0A0A0A]/55 uppercase tracking-[0.2em]`}>
      {a.author_name && <span>{a.author_name}</span>}
      {date && <span>· {date}</span>}
      {a.read_minutes && (
        <span className="inline-flex items-center gap-1">
          <Clock size={11} />{a.read_minutes} min
        </span>
      )}
    </div>
  );
}

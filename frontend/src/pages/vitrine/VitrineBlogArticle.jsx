/**
 * Vitrine Blog Article — Single article view.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Clock, ArrowRight } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function VitrineBlogArticle() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND}/api/blog/articles/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => {
        if (d) { setArticle(d.article); setRelated(d.related || []); }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="py-32 text-center text-sm text-[#0A0A0A]/45">Chargement…</div>
    );
  }
  if (notFound || !article) {
    return (
      <div className="py-32 text-center" data-testid="blog-article-notfound">
        <p className="text-lg text-[#0A0A0A]/70 mb-6 font-light">Article introuvable.</p>
        <Link to="/blog" className="inline-flex items-center gap-2 text-[0.7rem] tracking-[0.3em] uppercase text-[#B8922A] border-b border-[#B8922A]">
          <ArrowLeft size={13} /> Retour au journal
        </Link>
      </div>
    );
  }

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString("fr-FR", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : null;

  return (
    <article className="bg-white text-[#0A0A0A]" data-testid="vitrine-blog-article">
      {/* Hero */}
      {article.cover_image_url && (
        <div className="relative w-full h-[60vh] min-h-[420px] overflow-hidden">
          <img
            src={article.cover_image_url}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/55" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 hover:text-[#B8922A] transition-colors mb-10"
        >
          <ArrowLeft size={13} /> Retour au journal
        </Link>

        <div className="text-[0.6rem] tracking-[0.45em] uppercase text-[#B8922A] mb-5"
             data-testid="blog-article-category">
          {article.category || "Journal"}
        </div>
        <h1 className="font-serif font-light text-4xl md:text-6xl leading-[1.05] mb-8"
            data-testid="blog-article-title">
          {article.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#0A0A0A]/55 uppercase tracking-[0.2em] mb-12 pb-12 border-b border-[#0A0A0A]/10">
          {article.author_name && <span>par {article.author_name}</span>}
          {date && <span>· {date}</span>}
          {article.read_minutes && (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} />{article.read_minutes} min de lecture
            </span>
          )}
        </div>

        {article.excerpt && (
          <p className="text-xl md:text-2xl text-[#0A0A0A]/80 font-light leading-relaxed mb-12">
            {article.excerpt}
          </p>
        )}

        <div
          className="prose prose-lg max-w-none font-light leading-[1.85] text-[#0A0A0A]/85
                     [&_p]:mb-6 [&_p]:text-base [&_p]:md:text-lg
                     [&_h2]:font-serif [&_h2]:font-light [&_h2]:text-3xl [&_h2]:md:text-4xl [&_h2]:mt-12 [&_h2]:mb-6
                     [&_h3]:font-serif [&_h3]:font-light [&_h3]:text-2xl [&_h3]:mt-10 [&_h3]:mb-4
                     [&_a]:text-[#B8922A] [&_a]:underline [&_a]:underline-offset-4
                     [&_blockquote]:border-l-2 [&_blockquote]:border-[#B8922A] [&_blockquote]:pl-6 [&_blockquote]:text-[#0A0A0A]/65 [&_blockquote]:my-8
                     [&_img]:my-8 [&_img]:w-full
                     [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-6 [&_ul_li]:mb-2
                     [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-6"
          dangerouslySetInnerHTML={{ __html: article.body }}
          data-testid="blog-article-body"
        />
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="bg-[#FAF7F2] py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-[0.6rem] tracking-[0.5em] uppercase text-[#B8922A] mb-4 text-center">
              · À lire aussi ·
            </div>
            <h2 className="font-serif font-light text-3xl md:text-4xl text-center mb-14">
              Dans le même esprit.
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12" data-testid="blog-related">
              {related.map((a) => (
                <Link
                  key={a.id}
                  to={`/blog/${a.slug}`}
                  className="group block"
                >
                  <div className="aspect-[4/5] overflow-hidden bg-white mb-5">
                    {a.cover_image_url && (
                      <img src={a.cover_image_url} alt={a.title}
                        className="w-full h-full object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-[1.04]" />
                    )}
                  </div>
                  <div className="text-[0.55rem] tracking-[0.45em] uppercase text-[#B8922A] mb-2">
                    {a.category}
                  </div>
                  <h3 className="font-serif text-xl md:text-2xl leading-tight group-hover:text-[#B8922A] transition-colors">
                    {a.title}
                  </h3>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-[0.6rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55">
                    Lire <ArrowRight size={11} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}

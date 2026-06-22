/**
 * Vitrine — Landing page (Nikki Beach inspired).
 *
 * Editorial layout: full-bleed hero, locations grid, narrative sections,
 * lifestyle gallery, story, footer. Serif headings (Cormorant), white space,
 * photos do the talking.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Instagram, ArrowRight, Check } from "lucide-react";
import { trackEvent } from "../../lib/tracking";
import { useSiteConfig, sel } from "../../lib/site-config";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const UNIVERS = [
  {
    to: "/univers/beach-club",
    bookOfferId: "pass_day",
    name: "Beach Club",
    description:
      "Day Pass, The Sunset, B Brunch — trois rituels signature pour vivre l'île à votre rythme. Une parenthèse exclusive entre lagune et océan, ouverte sept jours sur sept.",
    image:
      "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/trz2j0jd_BEACH%20CLUB.png",
  },
  {
    to: "/univers/hebergement",
    bookOfferId: "hebergement",
    name: "Hébergement",
    description:
      "Une nuit en suspens entre lagune et océan, dans nos suites signature. Chambres Supérieures et Suites côté jardin ou côté lagune, soins Spa & Wellness signature au bord de l'eau.",
    image:
      "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/7bcipz8w_HEBERGEMENT.png",
  },
  {
    to: "/le-kaai",
    bookOfferId: "le_kaai",
    name: "Restaurant Le Kaai",
    description:
      "Le KAAÏ est le nouveau restaurant du BBr. Une table à l'ambition gastronomique affirmée, portée par des saveurs d'inspiration africaine contemporaine, dans une atmosphère élégante et chaleureuse.",
    image:
      "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/v2f73qqm_KAAI.png",
  },
  {
    to: "/univers/corporate",
    bookOfferId: "seminaire",
    name: "Corporate",
    description:
      "Séminaires résidentiels, journées d'étude, team building, déjeuners et dîners d'entreprise — salles équipées, vue océan, hébergement et pauses gastronomiques pour vos événements professionnels.",
    image:
      "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/oy7zzngs_SEMINAIRE.png",
  },
  {
    to: "/univers/activites",
    bookOfferId: "offres_loisirs",
    name: "Activités & Events",
    description:
      "Jet ski, paddle, kayak et plus — une journée d'activités lagunaires. Privatisations, soirées privées et expériences sur-mesure pour fédérer vos équipes ou célébrer vos grands moments.",
    image:
      "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/ocqva33h_ACTIVITE.png",
  },
];

// Instagram-style posts (curated) — using existing BBR assets.
const INSTAGRAM_POSTS = [
  { src: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/4kr4z5g1_DAY%20PASS.jpeg", caption: "Day Pass" },
  { src: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/3g3onmkg_THE%20SUNSET.jpeg", caption: "The Sunset" },
  { src: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/1txrnqdp_B%20BRUNCH.jpeg", caption: "B Brunch" },
  { src: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/kgqk46mw_LE%20KAAI.jpeg", caption: "Le Kaai" },
  { src: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/ivhtbefz_BBR%20_SHOOT%202_15.jpg", caption: "Île Boulay" },
  { src: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/2hilix5p_BBR%20_SHOOT%202_29.jpg", caption: "BBR Life" },
];

const LIFESTYLE = [
  "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1400&q=85",
];

export default function VitrineLanding() {
  const [blogArticles, setBlogArticles] = useState([]);
  const cfg = useSiteConfig();
  const hero = sel.hero(cfg);
  const universCfg = sel.univers(cfg);
  const instagramCfg = sel.instagram(cfg);
  const testimonialsCfg = sel.testimonials(cfg);
  const faqCfg = sel.faq(cfg);

  // Merge CMS univers list with the hardcoded routing map (bookOfferId).
  const universList = (universCfg.items && universCfg.items.length > 0
    ? universCfg.items.map((cmsItem) => {
        const fallback = UNIVERS.find((u) => u.to === cmsItem.to) || {};
        return {
          to: cmsItem.to || fallback.to,
          bookOfferId: fallback.bookOfferId,
          name: cmsItem.name || fallback.name,
          description: cmsItem.description || fallback.description,
          image: cmsItem.image || fallback.image,
        };
      })
    : UNIVERS);

  const instagramPosts = (instagramCfg.posts && instagramCfg.posts.length > 0)
    ? instagramCfg.posts
    : INSTAGRAM_POSTS;
  const instagramHandle = instagramCfg.handle || "@boulaybeachresort";

  useEffect(() => {
    fetch(`${BACKEND}/api/blog/articles?limit=3`)
      .then((r) => r.json())
      .then((d) => setBlogArticles(d.items || []))
      .catch(() => {});
  }, []);

  return (
    <div data-testid="vitrine-landing" className="bg-white text-[#0A0A0A]">
      {/* ─── HERO ───────────────────────────────────────── */}
      <section className="relative w-full h-screen min-h-[640px] overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
          data-testid="hero-video"
          poster={hero.poster_url || "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/0frg347a_BBR%20_SHOOT%202_139.jpg.jpeg"}
        >
          <source
            src={hero.video_url || "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/4d9005uu_IMG_4425.MOV"}
            type="video/quicktime"
          />
          <source
            src={hero.video_url || "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/4d9005uu_IMG_4425.MOV"}
            type="video/mp4"
          />
        </video>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
          <div className="text-[0.7rem] tracking-[0.55em] uppercase text-white/80 mb-10">
            {hero.kicker || "Île Boulay  ·  Abidjan"}
          </div>
          <h1
            className="font-serif text-white leading-[0.95] text-7xl sm:text-[5.5rem] md:text-[7.5rem] lg:text-[9rem] xl:text-[10.5rem] max-w-6xl"
            style={{ fontWeight: 400, letterSpacing: "0.04em" }}
            data-testid="vitrine-hero-title"
          >
            {hero.title || "LIFE IS HERE"}
          </h1>
          <p
            className="mt-10 text-xl sm:text-2xl md:text-3xl text-white/90 max-w-3xl leading-relaxed font-light"
            data-testid="vitrine-hero-subtitle"
          >
            {hero.subtitle || "Une île privée, à quelques minutes d'Abidjan. Un autre rythme. Une autre énergie. Des expériences premium inoubliables."}
          </p>
          <div className="mt-12 w-px h-12 bg-white/60" />
          <div className="mt-6 text-[0.65rem] tracking-[0.4em] uppercase text-white/70">
            Découvrir
          </div>
        </div>
      </section>

      {/* ─── NOS UNIVERS — 2 per row vertical rectangles ─────── */}
      <section id="univers" className="py-28 md:py-40 bg-white" data-testid="univers-section">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 md:mb-20">
            <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-6">
              · Nos univers ·
            </div>
            <h2 className="font-serif font-light text-3xl sm:text-4xl md:text-5xl leading-[1.15] text-[#0A0A0A] max-w-2xl mx-auto">
              Cinq expériences,<br />une seule destination d'exception.
            </h2>
            <div className="w-12 h-px bg-[#B8922A] mx-auto mt-10" />
          </div>

          {/* 2 cards per row — vertical rectangles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {UNIVERS.map((u) => <UniversCard key={u.to} u={u} />)}
          </div>
        </div>
      </section>

      {/* ─── BEACH CLUB EDITORIAL ───────────────────────── */}
      <section className="py-24 md:py-32 bg-[#FAF7F2]">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div className="order-2 md:order-1">
            <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
              Notre Beach Club
            </div>
            <h2 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] mb-8 text-[#0A0A0A]">
              L'art de vivre balnéaire, à l'ivoirienne.
            </h2>
            <p className="text-base md:text-lg leading-[1.85] text-[#0A0A0A]/75 mb-8 font-light">
              Pionnier du concept de beach club de luxe en Afrique de l'Ouest, BBR transforme
              chaque visite en un voyage sensoriel. Service chaleureux, cuisine généreuse,
              musique soigneusement programmée, vue lagune. Où que vous choisissiez de vous
              poser, l'expérience est inoubliable.
            </p>
            <Link
              to="/univers/beach-club"
              onClick={() => trackEvent("view_offer", { offer: "Beach Club" })}
              className="inline-block text-[0.7rem] tracking-[0.3em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A] pb-1 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors"
              data-testid="editorial-beach-club-cta"
            >
              Explorer le Beach Club
            </Link>
          </div>
          <div className="order-1 md:order-2">
            <img
              src="https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1600&q=85"
              alt="Beach club BBR"
              className="w-full aspect-[4/5] object-cover"
            />
          </div>
        </div>
      </section>

      {/* ─── LE KAAI — CUISINE ─────────────────────────── */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            <img
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=85"
              alt="Restaurant Le Kaai"
              className="w-full aspect-[4/5] object-cover"
            />
          </div>
          <div>
            <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
              Le Kaai · Restaurant signature
            </div>
            <h2 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] mb-8 text-[#0A0A0A]">
              Une cuisine qui voyage,<br />face à la lagune.
            </h2>
            <p className="text-base md:text-lg leading-[1.85] text-[#0A0A0A]/75 mb-8 font-light">
              Savourez nos plateaux à partager, nos bateaux à sushi, nos salades fraîches
              et nos plats internationaux inspirés des destinations qui nous façonnent.
              Une cuisine de la ferme à la table, des produits locaux d'exception, et une
              cave construite avec passion.
            </p>
            <Link
              to="/le-kaai"
              onClick={() => trackEvent("view_offer", { offer: "Le Kaai" })}
              className="inline-block text-[0.7rem] tracking-[0.3em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A] pb-1 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors"
              data-testid="editorial-kaai-cta"
            >
              Découvrir Le Kaai
            </Link>
          </div>
        </div>
      </section>

      {/* ─── LIFESTYLE GALLERY STRIP ─────────────────────── */}
      <section className="bg-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          {LIFESTYLE.map((src, i) => (
            <div key={i} className="relative aspect-square overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center hover:scale-[1.05] transition-transform duration-[1.5s] ease-out"
                style={{ backgroundImage: `url(${src})` }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── NOTRE HISTOIRE ─────────────────────────────── */}
      <section className="py-24 md:py-32 bg-[#FAF7F2]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
            Notre histoire
          </div>
          <h2 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] mb-10 text-[#0A0A0A]">
            Une île, une vision,<br />un art de recevoir.
          </h2>
          <p className="text-base md:text-lg leading-[1.85] text-[#0A0A0A]/75 mb-10 font-light">
            Boulay Beach Resort est né d'une volonté simple&nbsp;: créer en Côte d'Ivoire
            un lieu d'exception où le voyage commence dès la traversée. Une île discrète,
            une lagune protégée, un service signature et l'envie de célébrer la vie sous
            toutes ses formes&nbsp;— du brunch dominical à l'événement le plus intime.
          </p>
          <Link
            to="/univers/hebergement"
            className="inline-block text-[0.7rem] tracking-[0.3em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A] pb-1 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors"
          >
            En savoir plus
          </Link>
        </div>
      </section>

      {/* ─── TÉMOIGNAGES ─────────────────────────────────── */}
      {(testimonialsCfg.items || []).length > 0 && (
        <section className="py-24 md:py-32 bg-[#FAF7F2]" data-testid="vitrine-testimonials">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12 md:mb-16">
              <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-5">
                · Témoignages ·
              </div>
              <h2 className="font-serif font-light text-3xl sm:text-4xl md:text-5xl leading-[1.15] text-[#0A0A0A]">
                {testimonialsCfg.section_title || "Ils en parlent"}
              </h2>
              <div className="w-12 h-px bg-[#B8922A] mx-auto mt-8" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(testimonialsCfg.items || []).map((t, i) => (
                <figure
                  key={i}
                  className="bg-white border border-[#0A0A0A]/8 p-7 md:p-8 flex flex-col"
                  data-testid={`testimonial-${i}`}
                >
                  <div className="text-[#B8922A] tracking-widest text-sm mb-4">
                    {"★".repeat(Math.max(0, Math.min(5, Number(t.rating ?? 5))))}
                    {"☆".repeat(5 - Math.max(0, Math.min(5, Number(t.rating ?? 5))))}
                  </div>
                  <blockquote className="font-serif italic text-[#0A0A0A]/85 text-base leading-relaxed flex-1">
                    « {t.quote} »
                  </blockquote>
                  <figcaption className="mt-6 pt-5 border-t border-[#0A0A0A]/10 flex items-center gap-3">
                    {t.image ? (
                      <img
                        src={t.image.startsWith("/") ? `${process.env.REACT_APP_BACKEND_URL}${t.image}` : t.image}
                        alt={t.author}
                        className="w-10 h-10 rounded-full object-cover border border-[#B8922A]/30"
                      />
                    ) : null}
                    <div>
                      <div className="text-sm font-medium text-[#0A0A0A]">{t.author}</div>
                      {t.role && (
                        <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 mt-0.5">
                          {t.role}
                        </div>
                      )}
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── FAQ ─────────────────────────────────────────── */}
      {(faqCfg.items || []).length > 0 && (
        <section className="py-24 md:py-32 bg-white" data-testid="vitrine-faq">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-12 md:mb-16">
              <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-5">
                · FAQ ·
              </div>
              <h2 className="font-serif font-light text-3xl sm:text-4xl md:text-5xl leading-[1.15] text-[#0A0A0A]">
                {faqCfg.section_title || "Questions fréquentes"}
              </h2>
              <div className="w-12 h-px bg-[#B8922A] mx-auto mt-8" />
            </div>
            <div className="space-y-3">
              {(faqCfg.items || []).map((it, i) => (
                <details
                  key={i}
                  className="group border border-[#0A0A0A]/10 bg-white open:border-[#B8922A]/40 transition-colors"
                  data-testid={`faq-item-${i}`}
                >
                  <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 text-sm md:text-base font-medium text-[#0A0A0A] hover:text-[#B8922A]">
                    <span>{it.q}</span>
                    <span className="text-[#B8922A] text-xl font-light leading-none transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="px-5 pb-5 -mt-1 text-sm text-[#0A0A0A]/75 leading-relaxed">
                    {it.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── INSTAGRAM FEED ──────────────────────────────── */}
      <section className="py-24 md:py-32 bg-white" data-testid="vitrine-instagram">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12 md:mb-16">
            <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-5 inline-flex items-center justify-center gap-2">
              <Instagram size={13} strokeWidth={1.5} /> · {instagramHandle} ·
            </div>
            <h2 className="font-serif font-light text-3xl sm:text-4xl md:text-5xl leading-[1.15] text-[#0A0A0A]">
              L'instant BBR.
            </h2>
            <div className="w-12 h-px bg-[#B8922A] mx-auto mt-8" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
            {instagramPosts.map((p, i) => (
              <a
                key={i}
                href="https://www.instagram.com/boulaybeachresort"
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-square overflow-hidden bg-[#FAF7F2]"
                data-testid={`ig-post-${i}`}
                onClick={() => trackEvent("click_instagram", { post: p.caption })}
              >
                <img
                  src={p.src}
                  alt={p.caption}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                  <Instagram
                    size={26}
                    strokeWidth={1.5}
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                </div>
              </a>
            ))}
          </div>
          <div className="text-center mt-12">
            <a
              href="https://www.instagram.com/boulaybeachresort"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-[0.65rem] tracking-[0.35em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A]/60 pb-1 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors"
              data-testid="ig-follow-link"
            >
              <Instagram size={13} />
              Suivez-nous sur Instagram
            </a>
          </div>
        </div>
      </section>

      {/* ─── JOURNAL — recent blog articles ───────────────── */}
      {blogArticles.length > 0 && (
        <section className="py-24 md:py-32 bg-[#FAF7F2]" data-testid="vitrine-blog-preview">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-14">
              <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-5">
                · Le Journal ·
              </div>
              <h2 className="font-serif font-light text-3xl sm:text-4xl md:text-5xl leading-[1.15] text-[#0A0A0A]">
                Récits de l'île.
              </h2>
              <div className="w-12 h-px bg-[#B8922A] mx-auto mt-8" />
            </div>
            <div className="grid md:grid-cols-3 gap-8 md:gap-10">
              {blogArticles.slice(0, 3).map((a) => (
                <Link
                  key={a.id}
                  to={`/blog/${a.slug}`}
                  className="group block"
                  data-testid={`landing-blog-${a.slug}`}
                >
                  <div className="aspect-[4/5] overflow-hidden bg-white mb-6">
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
                    <p className="text-sm text-[#0A0A0A]/65 leading-relaxed line-clamp-2 font-light">
                      {a.excerpt}
                    </p>
                  )}
                </Link>
              ))}
            </div>
            <div className="text-center mt-14">
              <Link
                to="/blog"
                className="inline-flex items-center gap-2 text-[0.65rem] tracking-[0.35em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A]/60 pb-1 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors"
                data-testid="landing-blog-all"
              >
                Tous les articles
                <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ─── NEWSLETTER ──────────────────────────────────── */}
      <NewsletterSection />

      {/* ─── FINAL — RÉSERVATION ────────────────────────── */}
      <section className="relative py-32 md:py-44 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2400&q=85)",
          }}
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center text-white">
          <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/75 mb-8">
            Réservation directe
          </div>
          <h2 className="font-serif font-light text-4xl sm:text-5xl md:text-6xl leading-[1.05] mb-10">
            Votre prochaine évasion<br />commence ici.
          </h2>
          <p className="text-white/75 text-base md:text-lg leading-relaxed mb-12 max-w-xl mx-auto font-light">
            Tarif garanti meilleur prix. Annulation flexible jusqu'à 72h avant l'arrivée.
            Confirmation immédiate.
          </p>
          <Link
            to="/reserver"
            onClick={() => trackEvent("start_booking", { source: "landing_final" })}
            className="inline-block text-[0.7rem] tracking-[0.35em] uppercase text-white border-b border-white pb-2 hover:text-[#D4B256] hover:border-[#D4B256] transition-colors"
            data-testid="final-cta-reserver"
          >
            Réserver maintenant
          </Link>
        </div>
      </section>
    </div>
  );
}

/**
 * Vertical rectangle universe card — 2 per row.
 * Image above (aspect 4/5), title + description below.
 * Two CTAs : "Découvrir" (link to universe page) and "Réserver" (direct
 * link to the matching booking tunnel /booking/<offerId>).
 */
function UniversCard({ u }) {
  return (
    <article className="group block" data-testid={`univers-card-${u.to.split("/").pop()}`}>
      <Link
        to={u.to}
        onClick={() => trackEvent("view_offer", { offer: u.name })}
        className="block"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-[#FAF7F2]">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.8s] ease-out group-hover:scale-[1.04]"
            style={{ backgroundImage: `url(${u.image})` }}
          />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      </Link>
      <div className="pt-7 px-1">
        <h3 className="font-serif font-light text-2xl md:text-3xl leading-tight text-[#0A0A0A] mb-4">
          {u.name}
        </h3>
        <p className="text-sm md:text-base text-[#0A0A0A]/65 leading-relaxed line-clamp-3 font-light mb-6">
          {u.description}
        </p>
        <div className="flex items-center gap-6">
          <Link
            to={u.to}
            className="inline-flex items-center gap-2 text-[0.65rem] tracking-[0.35em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A]/60 pb-1 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors"
            data-testid={`univers-discover-${u.to.split("/").pop()}`}
          >
            Découvrir
            <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ─── Newsletter section ────────────────────────────────────── */
function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/newsletter-subscribers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          first_name: firstName.trim() || null,
          source: "landing_newsletter",
        }),
      });
      if (!res.ok) throw new Error("network");
      trackEvent("submit_lead", { channel: "newsletter", source: "landing" });
      setDone(true);
    } catch {
      setError("Impossible d'enregistrer votre email. Réessayez dans un instant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="relative py-24 md:py-32 bg-[#FAF7F2]" data-testid="landing-newsletter">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-5">
          · Newsletter ·
        </div>
        <h2 className="font-serif font-light text-3xl md:text-5xl leading-[1.1] text-[#0A0A0A] mb-8">
          Restez en lien avec l'île.
        </h2>
        <p className="text-base md:text-lg text-[#0A0A0A]/65 leading-relaxed font-light mb-12 max-w-xl mx-auto">
          Nos prochaines soirées, les nouveautés du Kaai, les offres réservées
          aux abonnés. Une fois par mois, rien de plus.
        </p>

        {done ? (
          <div
            className="inline-flex items-center gap-3 border border-[#B8922A] px-8 py-5 text-[#B8922A]"
            data-testid="newsletter-success"
          >
            <Check size={18} strokeWidth={1.5} />
            <span className="text-sm tracking-[0.2em] uppercase">
              Merci, vous êtes inscrit.
            </span>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 max-w-lg mx-auto" data-testid="newsletter-form">
            <input
              type="text"
              placeholder="Prénom (facultatif)"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-transparent border-b border-[#0A0A0A]/25 py-4 px-1 text-[#0A0A0A] placeholder-[#0A0A0A]/40 focus:outline-none focus:border-[#B8922A] transition-colors text-center"
              data-testid="newsletter-firstname"
              maxLength={80}
            />
            <input
              type="email"
              required
              placeholder="Adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-b border-[#0A0A0A]/25 py-4 px-1 text-[#0A0A0A] placeholder-[#0A0A0A]/40 focus:outline-none focus:border-[#B8922A] transition-colors text-center"
              data-testid="newsletter-email"
            />
            {error && (
              <p className="text-sm text-[#C24226] pt-2" data-testid="newsletter-error">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="mt-6 inline-flex items-center gap-3 text-[0.7rem] tracking-[0.35em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A] pb-2 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors disabled:opacity-50"
              data-testid="newsletter-submit"
            >
              {submitting ? "Envoi en cours…" : "M'inscrire"}
              <ArrowRight size={14} strokeWidth={1.5} />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

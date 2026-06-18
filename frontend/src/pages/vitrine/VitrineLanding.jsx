/**
 * Vitrine — Landing page (the homepage).
 *
 * Conversion-focused: hero immersif → univers → social proof → CTA final.
 */
import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import { trackEvent } from "../../lib/tracking";

const UNIVERS = [
  {
    to: "/univers/hebergement",
    label: "Hébergement",
    title: "Suites & Chambres",
    tagline: "Suites Lagune face à l'eau, chambres exclusives au cœur du jardin.",
    image: "https://images.unsplash.com/photo-1582610116397-edb318620f90?auto=format&fit=crop&w=1600&q=80",
  },
  {
    to: "/univers/beach-club",
    label: "Beach Club",
    title: "Day Pass · Sunset · Brunch",
    tagline: "Une plage privée, trois moments d'évasion à vivre toute l'année.",
    image: "https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?auto=format&fit=crop&w=1600&q=80",
  },
  {
    to: "/univers/activites",
    label: "Activités",
    title: "Jet ski · Padel · Quad",
    tagline: "Sept activités sport et glisse pour pimenter votre séjour.",
    image: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1600&q=80",
  },
  {
    to: "/univers/evenementiel",
    label: "Événementiel",
    title: "Mariages · Soirées · Concerts",
    tagline: "Privatisation totale ou partielle pour des événements inoubliables.",
    image: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1600&q=80",
  },
  {
    to: "/univers/corporate",
    label: "Corporate",
    title: "Séminaires & Team Building",
    tagline: "Une bulle de productivité face à la lagune, sur-mesure.",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
  },
  {
    to: "/le-kaai",
    label: "Le Kaai",
    title: "Restaurant signature",
    tagline: "Cuisine du monde, vue panoramique, ambiance feutrée.",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
  },
];

const TESTIMONIALS = [
  {
    text: "Un cadre paradisiaque, un service irréprochable. On reviendra !",
    name: "Aïssatou D.",
    context: "Suite Lagune · juin 2026",
  },
  {
    text: "Le brunch dominical est le meilleur d'Abidjan. Vue spectaculaire.",
    name: "Mehdi K.",
    context: "Brunch · mai 2026",
  },
  {
    text: "Notre mariage avait des étoiles dans les yeux. Tout était parfait.",
    name: "Sarah & Jean-Marc",
    context: "Mariage · avril 2026",
  },
];

export default function VitrineLanding() {
  return (
    <div data-testid="vitrine-landing">
      {/* ─── HERO ─────────────────────────────────────── */}
      <section className="relative w-full h-screen min-h-[600px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=2400&q=85)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/80" />
        <div className="relative z-10 h-full max-w-7xl mx-auto px-6 flex flex-col justify-center">
          <div className="text-[0.7rem] tracking-[0.5em] uppercase text-[#D4B256] mb-6 font-medium">
            Boulay  ·  Beach  ·  Resort
          </div>
          <h1 className="text-white font-bold leading-[0.95] mb-8 max-w-4xl text-5xl sm:text-6xl lg:text-7xl xl:text-8xl">
            L'élégance d'une<br />
            <span className="text-[#D4B256]">île privée</span><br />
            à Abidjan.
          </h1>
          <p className="text-white/85 text-lg lg:text-xl max-w-2xl leading-relaxed mb-10">
            Un resort 5 étoiles posé sur une lagune secrète. Hébergement signature,
            beach club d'exception, gastronomie et événementiel sur mesure.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/reserver"
              onClick={() => trackEvent("start_booking", { source: "hero" })}
              className="inline-flex items-center gap-3 px-8 py-4 bg-[#B8922A] hover:bg-[#A07D1F] text-white text-[0.75rem] tracking-[0.22em] uppercase font-semibold transition-colors"
              data-testid="hero-cta-primary"
            >
              Réserver mon séjour
              <ArrowRight size={16} />
            </Link>
            <a
              href="#univers"
              className="inline-flex items-center gap-3 px-8 py-4 border border-white/40 hover:border-[#D4B256] hover:text-[#D4B256] text-white text-[0.75rem] tracking-[0.22em] uppercase font-semibold transition-colors"
              data-testid="hero-cta-secondary"
            >
              Découvrir nos univers
            </a>
          </div>
        </div>
        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-[0.65rem] tracking-[0.3em] uppercase animate-pulse">
          ↓ Scroll
        </div>
      </section>

      {/* ─── INTRO ─────────────────────────────────────── */}
      <section className="py-24 lg:py-32 bg-[#FAF7F2]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#B8922A] mb-5 font-bold">
            Bienvenue
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-8 text-[#0A0A0A]">
            Six univers, une seule destination d'exception.
          </h2>
          <p className="text-base lg:text-lg text-[#0A0A0A]/70 leading-relaxed">
            À 30 minutes du centre d'Abidjan, BBr conjugue le calme d'une île, l'audace
            d'un beach club contemporain et le raffinement d'un resort 5 étoiles.
            Chaque détail a été pensé pour que vous y ressentiez l'ailleurs, dès l'arrivée.
          </p>
        </div>
      </section>

      {/* ─── UNIVERS GRID ──────────────────────────────── */}
      <section id="univers" className="pb-24 lg:pb-32 bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {UNIVERS.map((u, idx) => (
              <Link
                key={u.to}
                to={u.to}
                onClick={() => trackEvent("view_offer", { offer: u.label })}
                className={`group relative overflow-hidden block ${
                  idx === 0 ? "md:row-span-2 h-[600px] md:h-auto" : "h-[420px]"
                }`}
                data-testid={`univers-card-${u.to.split('/').pop()}`}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-700"
                  style={{ backgroundImage: `url(${u.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/85" />
                <div className="relative z-10 h-full flex flex-col justify-end p-7 lg:p-10">
                  <div className="text-[0.65rem] tracking-[0.35em] uppercase text-[#D4B256] mb-3 font-medium">
                    {u.label}
                  </div>
                  <div className="text-white font-bold text-2xl lg:text-4xl leading-tight mb-3">
                    {u.title}
                  </div>
                  <div className="text-white/80 text-sm lg:text-base leading-relaxed mb-5 max-w-md">
                    {u.tagline}
                  </div>
                  <div className="inline-flex items-center gap-2 text-white text-[0.7rem] tracking-[0.22em] uppercase font-semibold">
                    Découvrir <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── KPIS / TRUST ──────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-[#0A0A0A] text-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
          {[
            { k: "5★", v: "Resort d'exception" },
            { k: "8 ans", v: "Au service de nos hôtes" },
            { k: "60+", v: "Suites & chambres" },
            { k: "100%", v: "Vue lagune" },
          ].map((s) => (
            <div key={s.k}>
              <div className="text-4xl lg:text-5xl font-bold text-[#D4B256] mb-3">{s.k}</div>
              <div className="text-[0.7rem] tracking-[0.22em] uppercase text-white/70">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TESTIMONIALS ──────────────────────────────── */}
      <section className="py-24 lg:py-32 bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#B8922A] mb-5 font-bold">
              Ils en parlent mieux que nous
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0A0A0A]">
              Témoignages
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white p-8 lg:p-10 border-t-2 border-[#B8922A]">
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={14} className="fill-[#B8922A] text-[#B8922A]" />
                  ))}
                </div>
                <p className="text-[#0A0A0A]/85 text-base leading-relaxed italic mb-6">
                  « {t.text} »
                </p>
                <div className="text-[0.75rem] tracking-[0.15em] uppercase font-bold text-[#0A0A0A]">
                  {t.name}
                </div>
                <div className="text-[0.7rem] text-[#0A0A0A]/50 mt-1">{t.context}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─────────────────────────────────── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2400&q=85)",
          }}
        />
        <div className="absolute inset-0 bg-[#0A0A0A]/75" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center text-white">
          <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#D4B256] mb-5 font-bold">
            Réservation directe
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
            Votre prochaine évasion<br />commence ici.
          </h2>
          <p className="text-white/80 text-base lg:text-lg leading-relaxed mb-10 max-w-xl mx-auto">
            Tarif garanti meilleur prix sur ce site. Annulation flexible jusqu'à 72h
            avant l'arrivée. Confirmation immédiate.
          </p>
          <Link
            to="/reserver"
            onClick={() => trackEvent("start_booking", { source: "final_cta" })}
            className="inline-flex items-center gap-3 px-10 py-5 bg-[#B8922A] hover:bg-[#A07D1F] text-white text-[0.75rem] tracking-[0.25em] uppercase font-semibold transition-colors"
            data-testid="final-cta-reserver"
          >
            Réserver maintenant
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

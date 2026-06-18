/**
 * Reusable hero block for vitrine pages.
 *
 * - Full-bleed background image with dark overlay.
 * - Kicker (small label) + Title + Tagline + optional CTA.
 * - Designed mobile-first.
 */
import { Link } from "react-router-dom";

export default function UniversHero({
  image,
  kicker,
  title,
  tagline,
  cta,
  height = "h-[85vh]",
}) {
  return (
    <section
      className={`relative w-full ${height} flex items-end overflow-hidden`}
      data-testid="univers-hero"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/85" />
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 pb-20 md:pb-28">
        {kicker && (
          <div className="text-[0.7rem] tracking-[0.4em] uppercase text-[#D4B256] mb-5 font-medium">
            {kicker}
          </div>
        )}
        <h1 className="text-white font-bold leading-[0.95] mb-6 max-w-4xl text-4xl sm:text-5xl lg:text-6xl xl:text-7xl">
          {title}
        </h1>
        {tagline && (
          <p className="text-white/85 text-base sm:text-lg lg:text-xl max-w-2xl leading-relaxed mb-8">
            {tagline}
          </p>
        )}
        {cta && (
          <Link
            to={cta.to}
            className="inline-flex items-center gap-3 px-7 py-4 bg-[#B8922A] hover:bg-[#A07D1F] text-white text-[0.75rem] tracking-[0.22em] uppercase font-semibold transition-colors"
            data-testid="hero-cta"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </section>
  );
}

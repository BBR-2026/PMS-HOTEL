/**
 * Editorial hero for univers pages — Nikki Beach inspired.
 *
 * Full-bleed image, centered serif title, subtle kicker. No big CTA button
 * on hero (CTA lives further down for a more editorial feel).
 */
export default function UniversHero({
  image,
  kicker,
  title,
  tagline,
  height = "h-[88vh]",
}) {
  return (
    <section
      className={`relative w-full ${height} min-h-[560px] flex items-end overflow-hidden`}
      data-testid="univers-hero"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
      />
      <div className="absolute inset-0 bg-black/35" />
      <div className="relative z-10 w-full px-6 pb-20 md:pb-28">
        <div className="max-w-5xl mx-auto text-center">
          {kicker && (
            <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/75 mb-7">
              {kicker}
            </div>
          )}
          <h1 className="font-serif italic font-light text-white leading-[1] text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5rem]">
            {title}
          </h1>
          {tagline && (
            <p className="text-white/80 text-base md:text-lg mt-8 max-w-2xl mx-auto leading-relaxed font-light">
              {tagline}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Generic editorial univers page template (Nikki Beach inspired).
 *
 * Sections in order:
 *  1. Hero (full-bleed)
 *  2. Intro (centered narrative)
 *  3. Offers grid (text-led, big photos, no aggressive badges)
 *  4. Optional editorial side-by-side (image | text)
 *  5. Final CTA (subtle text link, not screaming button)
 */
import { Link } from "react-router-dom";
import UniversHero from "./UniversHero";
import { trackEvent } from "../../lib/tracking";

export default function UniversPage({
  testId,
  hero,
  intro,
  offers = [],
  editorial,
  finalCta,
}) {
  return (
    <div data-testid={testId} className="bg-white text-[#0A0A0A]">
      <UniversHero {...hero} />

      {/* Intro */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
            {intro.kicker}
          </div>
          <h2 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] mb-10 text-[#0A0A0A]">
            {intro.title}
          </h2>
          <p className="text-base md:text-lg leading-[1.85] text-[#0A0A0A]/75 font-light">
            {intro.body}
          </p>
        </div>
      </section>

      {/* Offers grid */}
      {offers.length > 0 && (
        <section className="pb-24 md:pb-32 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className={`grid gap-x-6 gap-y-16 md:gap-y-24 ${
              offers.length === 1 ? "" :
              offers.length === 2 ? "md:grid-cols-2" :
              "md:grid-cols-2 lg:grid-cols-3"
            }`}>
              {offers.map((o) => (
                <article
                  key={o.title}
                  className="group flex flex-col"
                  data-testid={`offer-${o.testId || o.title.toLowerCase().replace(/\W/g, "-")}`}
                >
                  <div className="relative overflow-hidden aspect-[4/5] mb-6">
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-[2s] ease-out group-hover:scale-[1.04]"
                      style={{ backgroundImage: `url(${o.image})` }}
                    />
                    {o.badge && (
                      <div className="absolute top-4 left-4 px-3 py-1 bg-white/95 text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]">
                        {o.badge}
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="font-serif font-light text-2xl md:text-3xl mb-3 text-[#0A0A0A]">
                      {o.title}
                    </h3>
                    <p className="text-sm text-[#0A0A0A]/65 leading-relaxed mb-5 max-w-sm mx-auto">
                      {o.description}
                    </p>
                    {o.features && o.features.length > 0 && (
                      <ul className="text-xs text-[#0A0A0A]/55 space-y-1 mb-6 leading-relaxed">
                        {o.features.map((f, i) => <li key={i}>· {f}</li>)}
                      </ul>
                    )}
                    {o.price && (
                      <div className="mb-6 text-[0.7rem] tracking-[0.25em] uppercase text-[#0A0A0A]/85">
                        {o.price}{o.priceSuffix && <span className="text-[#0A0A0A]/55"> {o.priceSuffix}</span>}
                      </div>
                    )}
                    {o.cta && (
                      <Link
                        to={o.cta.to}
                        onClick={() => trackEvent("view_offer", { offer: o.title })}
                        className="inline-block text-[0.65rem] tracking-[0.32em] uppercase text-[#0A0A0A] border-b border-[#0A0A0A] pb-1 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors"
                      >
                        {o.cta.label}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Editorial side-by-side (optional) */}
      {editorial && (
        <section className="py-24 md:py-32 bg-[#FAF7F2]">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div className={editorial.imageLeft ? "" : "order-2 md:order-1"}>
              {editorial.imageLeft ? (
                <img src={editorial.image} alt="" className="w-full aspect-[4/5] object-cover" />
              ) : (
                <>
                  {editorial.kicker && (
                    <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
                      {editorial.kicker}
                    </div>
                  )}
                  <h2 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] mb-8 text-[#0A0A0A]">
                    {editorial.title}
                  </h2>
                  <p className="text-base md:text-lg leading-[1.85] text-[#0A0A0A]/75 font-light">
                    {editorial.body}
                  </p>
                </>
              )}
            </div>
            <div className={editorial.imageLeft ? "" : "order-1 md:order-2"}>
              {editorial.imageLeft ? (
                <>
                  {editorial.kicker && (
                    <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
                      {editorial.kicker}
                    </div>
                  )}
                  <h2 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] mb-8 text-[#0A0A0A]">
                    {editorial.title}
                  </h2>
                  <p className="text-base md:text-lg leading-[1.85] text-[#0A0A0A]/75 font-light">
                    {editorial.body}
                  </p>
                </>
              ) : (
                <img src={editorial.image} alt="" className="w-full aspect-[4/5] object-cover" />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      {finalCta && (
        <section className="relative py-32 md:py-44 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${finalCta.image})` }}
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative z-10 max-w-3xl mx-auto px-6 text-center text-white">
            <h2 className="font-serif font-light text-4xl sm:text-5xl md:text-6xl leading-[1.05] mb-8">
              {finalCta.title}
            </h2>
            <p className="text-white/80 text-base md:text-lg leading-relaxed mb-12 max-w-xl mx-auto font-light">
              {finalCta.body}
            </p>
            <Link
              to={finalCta.to}
              onClick={() => trackEvent("start_booking", { source: testId })}
              className="inline-block text-[0.7rem] tracking-[0.35em] uppercase text-white border-b border-white pb-2 hover:text-[#D4B256] hover:border-[#D4B256] transition-colors"
              data-testid="univers-final-cta"
            >
              {finalCta.label}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

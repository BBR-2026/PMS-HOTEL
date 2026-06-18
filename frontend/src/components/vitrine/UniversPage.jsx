/**
 * Generic page template for a single "univers" of BBR.
 *
 * Used by Hébergement, Beach Club, Activités, Corporate, Le Kaai.
 * Événementiel uses its own page because it needs a quote form.
 */
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import UniversHero from "../../components/vitrine/UniversHero";
import { trackEvent } from "../../lib/tracking";

export default function UniversPage({
  testId,
  hero,
  intro,
  offers = [],
  highlights = [],
  finalCta,
}) {
  return (
    <div data-testid={testId}>
      <UniversHero {...hero} />

      {/* INTRO */}
      <section className="py-20 lg:py-28 bg-[#FAF7F2]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#B8922A] mb-5 font-bold">
            {intro.kicker}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-8 text-[#0A0A0A]">
            {intro.title}
          </h2>
          <p className="text-base lg:text-lg text-[#0A0A0A]/70 leading-relaxed">
            {intro.body}
          </p>
        </div>
      </section>

      {/* OFFERS GRID */}
      {offers.length > 0 && (
        <section className="pb-20 lg:pb-28 bg-[#FAF7F2]">
          <div className="max-w-7xl mx-auto px-6">
            <div className={`grid gap-6 lg:gap-8 ${
              offers.length === 1 ? "" :
              offers.length === 2 ? "md:grid-cols-2" :
              "md:grid-cols-2 lg:grid-cols-3"
            }`}>
              {offers.map((o) => (
                <article
                  key={o.title}
                  className="bg-white overflow-hidden group flex flex-col"
                  data-testid={`offer-${o.testId || o.title.toLowerCase().replace(/\W/g, "-")}`}
                >
                  <div className="relative h-64 overflow-hidden">
                    <div
                      className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-700"
                      style={{ backgroundImage: `url(${o.image})` }}
                    />
                    {o.badge && (
                      <div className="absolute top-4 left-4 px-3 py-1.5 bg-[#B8922A] text-white text-[0.6rem] tracking-[0.2em] uppercase font-bold">
                        {o.badge}
                      </div>
                    )}
                  </div>
                  <div className="p-7 lg:p-8 flex flex-col flex-1">
                    <h3 className="text-xl lg:text-2xl font-bold mb-3 text-[#0A0A0A]">
                      {o.title}
                    </h3>
                    <p className="text-sm text-[#0A0A0A]/70 leading-relaxed mb-5 flex-1">
                      {o.description}
                    </p>
                    {o.features && (
                      <ul className="space-y-2 mb-6">
                        {o.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#0A0A0A]/75">
                            <Check size={14} className="mt-0.5 text-[#B8922A] flex-shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {o.price && (
                      <div className="mb-5">
                        <span className="text-2xl font-bold text-[#0A0A0A]">{o.price}</span>
                        {o.priceSuffix && (
                          <span className="text-sm text-[#0A0A0A]/50 ml-2">{o.priceSuffix}</span>
                        )}
                      </div>
                    )}
                    {o.cta && (
                      <Link
                        to={o.cta.to}
                        onClick={() => trackEvent("view_offer", { offer: o.title })}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#0A0A0A] hover:bg-[#B8922A] text-white text-[0.7rem] tracking-[0.22em] uppercase font-semibold transition-colors"
                      >
                        {o.cta.label}
                        <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* HIGHLIGHTS */}
      {highlights.length > 0 && (
        <section className="py-20 lg:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12">
              {highlights.map((h, i) => (
                <div key={i}>
                  <div className="text-[#B8922A] mb-5">{h.icon}</div>
                  <h3 className="text-xl font-bold mb-3 text-[#0A0A0A]">{h.title}</h3>
                  <p className="text-sm text-[#0A0A0A]/70 leading-relaxed">{h.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      {finalCta && (
        <section className="relative py-24 lg:py-28 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${finalCta.image})` }}
          />
          <div className="absolute inset-0 bg-[#0A0A0A]/75" />
          <div className="relative z-10 max-w-3xl mx-auto px-6 text-center text-white">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
              {finalCta.title}
            </h2>
            <p className="text-white/80 text-base lg:text-lg leading-relaxed mb-10 max-w-xl mx-auto">
              {finalCta.body}
            </p>
            <Link
              to={finalCta.to}
              onClick={() => trackEvent("start_booking", { source: testId })}
              className="inline-flex items-center gap-3 px-10 py-5 bg-[#B8922A] hover:bg-[#A07D1F] text-white text-[0.75rem] tracking-[0.25em] uppercase font-semibold transition-colors"
              data-testid="univers-final-cta"
            >
              {finalCta.label}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

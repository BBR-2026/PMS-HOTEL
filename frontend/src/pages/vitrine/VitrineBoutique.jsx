/**
 * Boutique — "Coming soon" editorial page with newsletter capture.
 *
 * Keeps the hamburger menu "Boutique" link functional. Until the actual
 * shop module ships, visitors can subscribe to the waiting list so the
 * marketing team can ping them on launch + warm the leads pipeline.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, ArrowRight, Check } from "lucide-react";
import { trackEvent, getAttribution } from "../../lib/tracking";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const PREVIEW_LINEUP = [
  {
    label: "Signature",
    name: "Le sac de plage BBR",
    note: "Toile écrue · cuir naturel",
    image:
      "https://images.unsplash.com/photo-1591348278863-a8fb3887e2aa?auto=format&fit=crop&w=900&q=80",
  },
  {
    label: "Wellness",
    name: "Huile sèche solaire",
    note: "Monoï · vanille · 100 ml",
    image:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80",
  },
  {
    label: "Prêt-à-porter",
    name: "Caftan blanc Île Boulay",
    note: "Lin lavé · brodé main",
    image:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80",
  },
  {
    label: "Art de vivre",
    name: "Bougie · brise marine",
    note: "Cire végétale · 60 h",
    image:
      "https://images.unsplash.com/photo-1602874801006-e26c4b8c8b2c?auto=format&fit=crop&w=900&q=80",
  },
];

export default function VitrineBoutique() {
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
          source: "boutique_waitlist",
          attribution: getAttribution(),
        }),
      });
      if (!res.ok) throw new Error("network");
      trackEvent("submit_lead", { channel: "newsletter", source: "boutique_waitlist" });
      setDone(true);
    } catch {
      setError("Impossible d'enregistrer votre email. Réessayez dans un instant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white text-[#0A0A0A]" data-testid="vitrine-boutique">
      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative h-[60vh] min-h-[460px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=2400&q=85)",
          }}
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 w-full px-6 pb-16 md:pb-20 text-center text-white">
          <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/80 mb-6 flex items-center justify-center gap-3">
            <ShoppingBag size={14} strokeWidth={1.5} />
            Boutique BBR · Très bientôt
          </div>
          <h1 className="font-serif italic font-light text-5xl md:text-7xl leading-[1.05] max-w-4xl mx-auto">
            L'île à emporter.
          </h1>
        </div>
      </section>

      {/* ─── Manifesto ────────────────────────────────────── */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
            Notre vestiaire
          </div>
          <h2 className="font-serif italic font-light text-4xl md:text-5xl leading-[1.1] mb-10">
            Des pièces signature,<br />pour prolonger l'expérience.
          </h2>
          <p className="text-base md:text-lg leading-[1.85] text-[#0A0A0A]/75 font-light">
            La boutique officielle BBR ouvre ses portes très prochainement.
            Articles signature, cosmétiques solaires, prêt-à-porter en lin et coton,
            accessoires de plage, art de vivre. Chaque pièce racontera l'île Boulay et
            sera fabriquée en édition limitée, avec un soin du détail digne de la maison.
          </p>
        </div>
      </section>

      {/* ─── Preview lineup ───────────────────────────────── */}
      <section className="py-16 md:py-24 bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-7">
            {PREVIEW_LINEUP.map((p) => (
              <article key={p.name} className="group" data-testid={`boutique-preview-${p.name.toLowerCase().replace(/\W+/g, "-")}`}>
                <div className="aspect-[4/5] overflow-hidden bg-white mb-5">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div className="text-[0.55rem] tracking-[0.4em] uppercase text-[#B8922A] mb-2">
                  {p.label}
                </div>
                <h3 className="font-serif italic font-light text-xl md:text-2xl leading-tight mb-1">
                  {p.name}
                </h3>
                <p className="text-xs md:text-sm text-[#0A0A0A]/60 font-light">{p.note}</p>
              </article>
            ))}
          </div>
          <div className="text-center mt-10 text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/40">
            Avant-première · sélection non contractuelle
          </div>
        </div>
      </section>

      {/* ─── Waitlist form ────────────────────────────────── */}
      <section className="py-24 md:py-32 bg-[#0A0A0A] text-white" data-testid="boutique-waitlist-section">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/60 mb-6">
            Liste d'attente
          </div>
          <h2 className="font-serif italic font-light text-3xl md:text-5xl leading-[1.1] mb-8">
            Soyez les premiers prévenus.
          </h2>
          <p className="text-base md:text-lg leading-[1.85] text-white/70 font-light mb-12">
            Inscrivez-vous pour découvrir la boutique en avant-première,
            accéder aux séries limitées et bénéficier d'avantages réservés
            aux clients fidèles BBR.
          </p>

          {done ? (
            <div
              className="inline-flex items-center gap-3 border border-[#B8922A] px-8 py-5 text-[#D4B256]"
              data-testid="boutique-waitlist-success"
            >
              <Check size={18} strokeWidth={1.5} />
              <span className="text-sm tracking-[0.2em] uppercase">
                Merci, vous êtes inscrit.
              </span>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4 max-w-xl mx-auto" data-testid="boutique-waitlist-form">
              <input
                type="text"
                placeholder="Prénom (facultatif)"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-transparent border-b border-white/30 py-4 px-2 text-white placeholder-white/40 focus:outline-none focus:border-[#B8922A] transition-colors"
                data-testid="boutique-waitlist-firstname"
                maxLength={80}
              />
              <input
                type="email"
                required
                placeholder="Adresse email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-white/30 py-4 px-2 text-white placeholder-white/40 focus:outline-none focus:border-[#B8922A] transition-colors"
                data-testid="boutique-waitlist-email"
              />
              {error && (
                <p className="text-sm text-[#E2715F] pt-2" data-testid="boutique-waitlist-error">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="mt-8 inline-flex items-center gap-3 text-[0.7rem] tracking-[0.35em] uppercase border-b border-white pb-2 hover:text-[#D4B256] hover:border-[#D4B256] transition-colors disabled:opacity-50"
                data-testid="boutique-waitlist-submit"
              >
                {submitting ? "Envoi en cours…" : "Rejoindre la liste"}
                <ArrowRight size={14} strokeWidth={1.5} />
              </button>
            </form>
          )}

          <div className="mt-16 text-[0.55rem] tracking-[0.45em] uppercase text-white/35">
            <Link to="/" className="hover:text-white/70 transition-colors">
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

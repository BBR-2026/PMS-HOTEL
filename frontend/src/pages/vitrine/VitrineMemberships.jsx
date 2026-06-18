/**
 * Vitrine Memberships — Public page.
 *
 * Editorial presentation of the 3 BBR Cards (Sunset / Beach / Royal),
 * with inline subscription form (lead capture, no card payment yet —
 * concierge contacts the prospect to close).
 */
import { useEffect, useState } from "react";
import { Check, Crown, Sparkles, Sunrise, ArrowRight } from "lucide-react";
import { trackEvent, getAttribution } from "../../lib/tracking";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const TIER_ICON = {
  silver: Sunrise,
  gold: Sparkles,
  platinum: Crown,
};

export default function VitrineMemberships() {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", company: "", message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/memberships/plans`)
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => {});
  }, []);

  function openPlan(plan) {
    setSelectedPlan(plan);
    setDone(false);
    setError(null);
    trackEvent("view_offer", { offer_id: plan.id, offer_type: "membership" });
    setTimeout(() => {
      document.getElementById("memberships-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!selectedPlan) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/memberships/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form, plan_id: selectedPlan.id,
          attribution: getAttribution(),
        }),
      });
      if (!res.ok) throw new Error("network");
      trackEvent("submit_lead", { channel: "membership", plan_id: selectedPlan.id });
      setDone(true);
    } catch {
      setError("Votre demande n'a pas pu être envoyée. Réessayez ou contactez-nous directement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white text-[#0A0A0A]" data-testid="vitrine-memberships">
      {/* HERO */}
      <section className="relative h-[60vh] min-h-[460px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=2400&q=85)",
          }}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 w-full px-6 pb-16 md:pb-20 text-center text-white">
          <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/80 mb-6 flex items-center justify-center gap-3">
            <Crown size={14} strokeWidth={1.5} />
            BBR Memberships
          </div>
          <h1 className="font-serif font-light text-5xl md:text-7xl leading-[1.05] max-w-4xl mx-auto">
            L'île pour habitude.
          </h1>
          <p className="mt-6 text-base md:text-lg text-white/75 max-w-2xl mx-auto leading-relaxed font-light">
            Trois cartes pour vivre Boulay Beach Resort comme une seconde maison.
            Avantages signature, accès prioritaire, conciergerie dédiée.
          </p>
        </div>
      </section>

      {/* PLANS */}
      <section className="py-20 md:py-28 bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-4">
              Choisissez votre carte
            </div>
            <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight">
              Trois manières<br />de vous appartenir à l'île.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6" data-testid="memberships-plans">
            {plans.length === 0 ? (
              <div className="col-span-3 text-center text-sm text-[#0A0A0A]/45 py-12">
                Chargement…
              </div>
            ) : plans.map((p) => {
              const Icon = TIER_ICON[p.tier] || Crown;
              return (
                <article
                  key={p.id}
                  className={`relative bg-white p-8 md:p-10 flex flex-col ${
                    p.highlight ? "ring-2 ring-[#0A0A0A] -mt-4 md:-mt-8 md:pb-12" : "border border-[#0A0A0A]/10"
                  }`}
                  data-testid={`membership-plan-${p.id}`}
                >
                  {p.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#B8922A] text-white text-[10px] tracking-[0.3em] uppercase px-4 py-1">
                      Le choix BBR
                    </div>
                  )}
                  <div
                    className="w-12 h-12 mb-6 flex items-center justify-center"
                    style={{ background: `${p.color}15`, color: p.color }}
                  >
                    <Icon size={20} strokeWidth={1.5} />
                  </div>
                  <h3 className="font-serif font-light text-3xl md:text-4xl mb-2">{p.name}</h3>
                  <p className="text-sm text-[#0A0A0A]/65 leading-relaxed mb-6">
                    {p.tagline}
                  </p>
                  <div className="mb-6">
                    <div className="font-serif text-3xl text-[#0A0A0A]">
                      {p.price_xof.toLocaleString("fr-FR")}
                      <span className="text-base text-[#0A0A0A]/55 font-sans"> XOF</span>
                    </div>
                    <div className="text-[10px] tracking-[0.3em] uppercase text-[#0A0A0A]/45 mt-1">
                      / an
                    </div>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {p.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[#0A0A0A]/85">
                        <Check size={14} strokeWidth={2} className="text-[#B8922A] mt-0.5 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => openPlan(p)}
                    className={`mt-auto inline-flex items-center justify-center gap-2 py-3 text-[0.7rem] tracking-[0.35em] uppercase transition-colors ${
                      p.highlight
                        ? "bg-[#0A0A0A] text-white hover:bg-[#B8922A]"
                        : "border border-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white"
                    }`}
                    data-testid={`membership-select-${p.id}`}
                  >
                    Choisir cette carte
                    <ArrowRight size={13} />
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* FORM */}
      <section id="memberships-form" className="py-20 md:py-28 bg-[#0A0A0A] text-white">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/60 mb-4">
              {selectedPlan ? `Carte ${selectedPlan.name}` : "Souscription"}
            </div>
            <h2 className="font-serif font-light text-3xl md:text-5xl leading-tight mb-6">
              Réservez votre carte.
            </h2>
            <p className="text-base text-white/70 leading-relaxed font-light">
              Notre concierge vous appelle sous 24 h pour finaliser votre souscription
              et programmer votre première visite.
            </p>
          </div>

          {done ? (
            <div
              className="text-center py-12 border border-[#B8922A] space-y-4"
              data-testid="membership-form-success"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 border border-[#B8922A] text-[#B8922A]">
                <Check size={20} strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-2xl md:text-3xl">Demande enregistrée.</h3>
              <p className="text-sm text-white/70">
                Merci. Notre conciergerie revient vers vous sous 24 h.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5" data-testid="membership-form">
              {!selectedPlan && (
                <p className="text-center text-sm text-white/60 pb-3">
                  Sélectionnez d'abord une carte ci-dessus.
                </p>
              )}
              <FInput type="text" placeholder="Nom complet *" required value={form.full_name}
                onChange={(v) => setForm({ ...form, full_name: v })}
                testid="membership-input-name" maxLength={120} />
              <div className="grid sm:grid-cols-2 gap-5">
                <FInput type="email" placeholder="Email *" required value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  testid="membership-input-email" />
                <FInput type="tel" placeholder="Téléphone" value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  testid="membership-input-phone" maxLength={40} />
              </div>
              <FInput type="text" placeholder="Entreprise (facultatif)" value={form.company}
                onChange={(v) => setForm({ ...form, company: v })}
                testid="membership-input-company" maxLength={160} />
              <FTextarea placeholder="Note pour la conciergerie (facultatif)"
                value={form.message}
                onChange={(v) => setForm({ ...form, message: v })}
                testid="membership-input-message" />
              {error && (
                <p className="text-sm text-[#E2715F]" data-testid="membership-form-error">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting || !selectedPlan}
                className="w-full inline-flex items-center justify-center gap-3 py-4 bg-[#B8922A] text-white text-[0.7rem] tracking-[0.35em] uppercase hover:bg-[#D4B256] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="membership-submit"
              >
                {submitting ? "Envoi en cours…" : "Demander à être contacté"}
                <ArrowRight size={13} />
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function FInput({ type = "text", placeholder, required, value, onChange, testid, maxLength }) {
  return (
    <input
      type={type}
      required={required}
      placeholder={placeholder}
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent border-b border-white/25 py-4 px-1 text-white placeholder-white/45 focus:outline-none focus:border-[#B8922A] transition-colors"
      data-testid={testid}
    />
  );
}

function FTextarea({ placeholder, value, onChange, testid }) {
  return (
    <textarea
      rows={3}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent border-b border-white/25 py-4 px-1 text-white placeholder-white/45 focus:outline-none focus:border-[#B8922A] transition-colors resize-none"
      data-testid={testid}
      maxLength={2000}
    />
  );
}

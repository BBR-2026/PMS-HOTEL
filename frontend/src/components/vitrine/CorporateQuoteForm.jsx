/**
 * Corporate quote request form — section anchored at #devis.
 *
 * Persists the request through the existing /api/events/privatization
 * endpoint (collection `event_requests`) so the back-office Events
 * pipeline picks it up automatically.
 */
import { useState } from "react";
import { Check, ArrowRight, Briefcase } from "lucide-react";
import { trackEvent, getAttribution } from "../../lib/tracking";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const EVENT_TYPES = [
  "Séminaire",
  "Journée d'étude",
  "Conférence",
  "Team building",
  "Déjeuner / dîner d'entreprise",
  "Convention annuelle",
  "Autre projet corporate",
];

export default function CorporateQuoteForm() {
  const [form, setForm] = useState({
    name: "", surname: "", company: "", phone: "", email: "",
    event_type: EVENT_TYPES[0],
    event_date: "",
    guest_count: 20,
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Save in event_requests via the existing privatization endpoint.
      const res = await fetch(`${BACKEND}/api/events/privatization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          surname: form.surname.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          event_type: form.event_type,
          event_date: form.event_date,
          guest_count: parseInt(form.guest_count, 10) || 0,
          message: [form.company && `Société : ${form.company}`, form.message]
            .filter(Boolean).join("\n\n"),
        }),
      });
      if (!res.ok) throw new Error("network");
      trackEvent("submit_lead", { channel: "corporate_quote", event_type: form.event_type });

      // Mirror also into contact_messages for the inbox + attribution.
      try {
        await fetch(`${BACKEND}/api/contact-messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${form.surname} ${form.name}`.trim(),
            email: form.email,
            phone: form.phone,
            subject: `Devis Corporate — ${form.event_type}`,
            company: form.company,
            message: `Date souhaitée : ${form.event_date || "non précisée"}\nNombre de convives : ${form.guest_count}\n\n${form.message}`,
            page: "/univers/corporate",
            attribution: getAttribution(),
          }),
        });
      } catch { /* mirror is best-effort */ }

      setDone(true);
    } catch {
      setError("Votre demande n'a pas pu être envoyée. Réessayez ou appelez-nous directement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="devis" className="py-24 md:py-32 bg-[#0A0A0A] text-white" data-testid="corporate-quote-section">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-5 inline-flex items-center justify-center gap-2">
            <Briefcase size={13} strokeWidth={1.5} /> · Demande de devis ·
          </div>
          <h2 className="font-serif font-light text-3xl md:text-5xl leading-tight">
            Construisons votre événement.
          </h2>
          <p className="mt-6 text-base md:text-lg text-white/70 max-w-xl mx-auto font-light leading-relaxed">
            Notre équipe vous répond sous 24 h avec une proposition sur-mesure adaptée à vos besoins.
          </p>
        </div>

        {done ? (
          <div
            className="text-center py-14 border border-[#B8922A] max-w-xl mx-auto"
            data-testid="corporate-form-success"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 border border-[#B8922A] text-[#B8922A] mx-auto mb-6">
              <Check size={22} strokeWidth={1.5} />
            </div>
            <h3 className="font-serif text-2xl md:text-3xl mb-4">Demande envoyée.</h3>
            <p className="text-sm text-white/70 max-w-md mx-auto">
              Merci. Un chargé de compte BBR vous appelle sous 24 h pour préparer
              votre devis sur-mesure.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5" data-testid="corporate-quote-form">
            <div className="grid sm:grid-cols-2 gap-5">
              <FInput placeholder="Prénom *" required value={form.name}
                onChange={(v) => setField("name", v)} testid="corp-input-name" maxLength={80} />
              <FInput placeholder="Nom *" required value={form.surname}
                onChange={(v) => setField("surname", v)} testid="corp-input-surname" maxLength={80} />
            </div>
            <FInput placeholder="Entreprise / Organisation *" required value={form.company}
              onChange={(v) => setField("company", v)} testid="corp-input-company" maxLength={120} />
            <div className="grid sm:grid-cols-2 gap-5">
              <FInput type="email" placeholder="Email professionnel *" required value={form.email}
                onChange={(v) => setField("email", v)} testid="corp-input-email" />
              <FInput type="tel" placeholder="Téléphone *" required value={form.phone}
                onChange={(v) => setField("phone", v)} testid="corp-input-phone" maxLength={40} />
            </div>
            <div>
              <label className="block text-[0.55rem] tracking-[0.4em] uppercase text-white/55 mb-2">
                Type d'événement *
              </label>
              <select
                value={form.event_type}
                onChange={(e) => setField("event_type", e.target.value)}
                className="w-full bg-transparent border-b border-white/25 py-3 px-1 text-white focus:outline-none focus:border-[#B8922A]"
                data-testid="corp-input-event-type"
              >
                {EVENT_TYPES.map((t) => <option key={t} value={t} className="bg-[#0A0A0A]">{t}</option>)}
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[0.55rem] tracking-[0.4em] uppercase text-white/55 mb-2">
                  Date souhaitée *
                </label>
                <input
                  type="date"
                  required
                  value={form.event_date}
                  onChange={(e) => setField("event_date", e.target.value)}
                  className="w-full bg-transparent border-b border-white/25 py-3 px-1 text-white focus:outline-none focus:border-[#B8922A]"
                  data-testid="corp-input-date"
                />
              </div>
              <div>
                <label className="block text-[0.55rem] tracking-[0.4em] uppercase text-white/55 mb-2">
                  Nombre de convives *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={500}
                  value={form.guest_count}
                  onChange={(e) => setField("guest_count", e.target.value)}
                  className="w-full bg-transparent border-b border-white/25 py-3 px-1 text-white focus:outline-none focus:border-[#B8922A]"
                  data-testid="corp-input-guests"
                />
              </div>
            </div>
            <FTextarea placeholder="Précisions sur votre projet (programme, hébergement, animations…)"
              value={form.message}
              onChange={(v) => setField("message", v)}
              testid="corp-input-message" />

            {error && (
              <p className="text-sm text-[#E2715F]" data-testid="corporate-form-error">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-3 py-4 bg-[#B8922A] text-white text-[0.7rem] tracking-[0.35em] uppercase hover:bg-[#D4AF37] transition-colors disabled:opacity-40"
              data-testid="corporate-form-submit"
            >
              {submitting ? "Envoi en cours…" : "Demander mon devis"}
              <ArrowRight size={13} />
            </button>
          </form>
        )}
      </div>
    </section>
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
      className="w-full bg-transparent border-b border-white/25 py-3 px-1 text-white placeholder-white/45 focus:outline-none focus:border-[#B8922A] transition-colors"
      data-testid={testid}
    />
  );
}

function FTextarea({ placeholder, value, onChange, testid }) {
  return (
    <textarea
      rows={4}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent border-b border-white/25 py-3 px-1 text-white placeholder-white/45 focus:outline-none focus:border-[#B8922A] transition-colors resize-none"
      maxLength={2000}
      data-testid={testid}
    />
  );
}

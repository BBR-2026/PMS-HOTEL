/**
 * Contact — Editorial contact page with working form.
 *
 * Persists the message into ``contact_messages`` (back-office staff inbox)
 * and mirrors it as a ``submit_lead`` marketing event for funnel attribution.
 */
import { useState } from "react";
import { Phone, Mail, MapPin, MessageCircle, ArrowRight, Check } from "lucide-react";
import { trackEvent, getAttribution } from "../../lib/tracking";
import { useSiteConfig, sel } from "../../lib/site-config";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const SUBJECTS = [
  "Réservation séjour ou day pass",
  "Séminaire / événement corporate",
  "Privatisation / événement privé",
  "Le Kaai — Restaurant",
  "Presse & partenariats",
  "Autre demande",
];

export default function VitrineContact() {
  const cfg = useSiteConfig();
  const contact = sel.contact(cfg);
  const phone = contact.phone || "+225 07 04 60 06 00";
  const phoneTel = phone.replace(/\s+/g, "");
  const whatsapp = contact.whatsapp || phone;
  const whatsappLink = `https://wa.me/${whatsapp.replace(/\D+/g, "")}`;
  const email = contact.email || "reservations@boulaybeachresort.com";
  const addr1 = contact.address_line_1 || "Île Boulay";
  const addr2 = contact.address_line_2 || "Abidjan, Côte d'Ivoire";
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: SUBJECTS[0],
    message: "",
    company: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/contact-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          attribution: getAttribution(),
          page: window.location.pathname,
        }),
      });
      if (!res.ok) throw new Error("network");
      trackEvent("submit_lead", { channel: "contact_form", subject: form.subject });
      setDone(true);
    } catch {
      setError(
        "Votre message n'a pas pu être envoyé. Veuillez réessayer ou nous appeler directement."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white text-[#0A0A0A]" data-testid="vitrine-contact">
      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative h-[55vh] min-h-[400px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2400&q=85)",
          }}
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 w-full px-6 pb-16 text-center text-white">
          <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/80 mb-6">
            Contactez-nous
          </div>
          <h1 className="font-serif font-light text-5xl md:text-7xl leading-[1.05]">
            Restons en lien.
          </h1>
        </div>
      </section>

      {/* ─── Two-column layout : Info + Form ──────────────── */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 md:gap-24">
          {/* LEFT — Info */}
          <div>
            <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
              Notre équipe vous répond
            </div>
            <h2 className="font-serif font-light text-3xl md:text-5xl mb-10 leading-[1.05]">
              Une question,<br />une réservation,<br />un projet sur-mesure ?
            </h2>
            <p className="text-base md:text-lg text-[#0A0A0A]/75 leading-[1.85] font-light mb-12">
              Notre équipe vous répond en français et en anglais, sept jours sur sept,
              de 8h à 22h. Pour les groupes, séminaires et événements privés, un chargé
              de compte dédié vous accompagne pour construire votre offre sur-mesure.
            </p>

            <div className="space-y-8">
              <Item icon={<MapPin size={18} strokeWidth={1.5} />} title="Adresse">
                {addr1}<br />{addr2}
              </Item>
              <Item icon={<Phone size={18} strokeWidth={1.5} />} title="Téléphone">
                <a
                  href={`tel:${phoneTel}`}
                  className="hover:text-[#B8922A] transition-colors"
                  data-testid="contact-phone"
                >
                  {phone}
                </a>
              </Item>
              <Item icon={<MessageCircle size={18} strokeWidth={1.5} />} title="WhatsApp">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#B8922A] transition-colors"
                  data-testid="contact-whatsapp"
                >
                  {whatsapp}
                </a>
              </Item>
              <Item icon={<Mail size={18} strokeWidth={1.5} />} title="Email">
                <a
                  href={`mailto:${email}`}
                  className="hover:text-[#B8922A] transition-colors"
                  data-testid="contact-email"
                >
                  {email}
                </a>
              </Item>
            </div>
          </div>

          {/* RIGHT — Form */}
          <div>
            <div className="bg-[#FAF7F2] p-8 md:p-12">
              {done ? (
                <div
                  className="text-center py-12 space-y-6"
                  data-testid="contact-form-success"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 border border-[#B8922A] text-[#B8922A]">
                    <Check size={22} strokeWidth={1.5} />
                  </div>
                  <h3 className="font-serif text-3xl md:text-4xl leading-tight">
                    Message envoyé.
                  </h3>
                  <p className="text-[#0A0A0A]/75 leading-relaxed font-light">
                    Merci, nous reviendrons vers vous sous 24 heures. À très bientôt
                    sur l'île Boulay.
                  </p>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-6" data-testid="contact-form">
                  <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-4">
                    Formulaire de contact
                  </div>

                  <Field label="Nom *">
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className="w-full bg-transparent border-b border-[#0A0A0A]/20 py-3 px-1 focus:outline-none focus:border-[#B8922A] transition-colors"
                      data-testid="contact-input-name"
                      maxLength={120}
                    />
                  </Field>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <Field label="Email *">
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setField("email", e.target.value)}
                        className="w-full bg-transparent border-b border-[#0A0A0A]/20 py-3 px-1 focus:outline-none focus:border-[#B8922A] transition-colors"
                        data-testid="contact-input-email"
                      />
                    </Field>
                    <Field label="Téléphone">
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setField("phone", e.target.value)}
                        className="w-full bg-transparent border-b border-[#0A0A0A]/20 py-3 px-1 focus:outline-none focus:border-[#B8922A] transition-colors"
                        data-testid="contact-input-phone"
                        maxLength={40}
                      />
                    </Field>
                  </div>

                  <Field label="Entreprise (facultatif)">
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) => setField("company", e.target.value)}
                      className="w-full bg-transparent border-b border-[#0A0A0A]/20 py-3 px-1 focus:outline-none focus:border-[#B8922A] transition-colors"
                      data-testid="contact-input-company"
                      maxLength={120}
                    />
                  </Field>

                  <Field label="Sujet">
                    <select
                      value={form.subject}
                      onChange={(e) => setField("subject", e.target.value)}
                      className="w-full bg-transparent border-b border-[#0A0A0A]/20 py-3 px-1 focus:outline-none focus:border-[#B8922A] transition-colors"
                      data-testid="contact-input-subject"
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Message *">
                    <textarea
                      required
                      rows={5}
                      value={form.message}
                      onChange={(e) => setField("message", e.target.value)}
                      className="w-full bg-transparent border-b border-[#0A0A0A]/20 py-3 px-1 focus:outline-none focus:border-[#B8922A] transition-colors resize-none"
                      data-testid="contact-input-message"
                      maxLength={4000}
                    />
                  </Field>

                  {error && (
                    <p
                      className="text-sm text-[#C24226] pt-1"
                      data-testid="contact-form-error"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-4 inline-flex items-center gap-3 text-[0.7rem] tracking-[0.35em] uppercase border-b border-[#0A0A0A] pb-2 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors disabled:opacity-50"
                    data-testid="contact-form-submit"
                  >
                    {submitting ? "Envoi en cours…" : "Envoyer le message"}
                    <ArrowRight size={14} strokeWidth={1.5} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[0.55rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}

function Item({ icon, title, children }) {
  return (
    <div className="flex items-start gap-5 pb-6 border-b border-[#0A0A0A]/10">
      <div className="text-[#B8922A] mt-1 flex-shrink-0">{icon}</div>
      <div>
        <div className="text-[0.55rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-2">
          {title}
        </div>
        <div className="text-base text-[#0A0A0A]/85 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

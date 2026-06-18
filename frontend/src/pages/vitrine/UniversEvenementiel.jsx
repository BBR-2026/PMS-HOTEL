/**
 * Événementiel — Univers + integrated quote request form.
 *
 * Submits to /api/marketing/events (event_type=submit_lead) so the request
 * lands in the marketing pipeline AND is visible to the commercial team
 * via the back-office Marketing dashboard (Phase B).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, Music, Sparkles, Send, Check } from "lucide-react";
import UniversHero from "../../components/vitrine/UniversHero";
import { trackEvent, getAttribution } from "../../lib/tracking";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const EVENT_TYPES = [
  { id: "mariage", label: "Mariage", icon: <Heart size={28} strokeWidth={1.5} />, image: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=80", description: "La cérémonie la plus belle de votre vie face à la lagune." },
  { id: "anniversaire", label: "Anniversaire", icon: <Sparkles size={28} strokeWidth={1.5} />, image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80", description: "Anniversaires intimistes ou grands soirs — tout est possible." },
  { id: "soiree-privee", label: "Soirée privée", icon: <Music size={28} strokeWidth={1.5} />, image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80", description: "Privatisez les espaces — du beach club au rooftop signature." },
  { id: "concert", label: "Concert", icon: <Music size={28} strokeWidth={1.5} />, image: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80", description: "Capacité jusqu'à 800 personnes, scène et régie pro." },
];

export default function UniversEvenementiel() {
  const [form, setForm] = useState({
    event_type: "mariage",
    full_name: "",
    email: "",
    phone: "",
    target_date: "",
    guests: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      // Save lead via the marketing events sink + dedicated lead doc.
      const payload = {
        visitor_id: localStorage.getItem("bbr_visitor_id"),
        session_id: sessionStorage.getItem("bbr_session_id"),
        event_type: "submit_lead",
        page: "/univers/evenementiel",
        attribution: getAttribution(),
        props: {
          lead_type: "evenementiel",
          ...form,
        },
        value: null,
        user_agent: navigator.userAgent,
        occurred_at: new Date().toISOString(),
      };
      const r = await fetch(`${BACKEND}/api/marketing/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      trackEvent("submit_lead", { lead_type: "evenementiel", event_type: form.event_type });
      setSuccess(true);
    } catch (err) {
      setError("Erreur lors de l'envoi. Merci de réessayer ou de nous appeler au +225 07 04 60 06 00.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="univers-evenementiel">
      <UniversHero
        image="https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=2400&q=85"
        kicker="Univers · Événementiel"
        title="L'écrin de vos plus beaux souvenirs."
        tagline="Mariages, anniversaires, soirées privées, concerts. Privatisez tout ou partie de BBr pour des événements à votre image."
        cta={{ to: "#devis", label: "Demander un devis" }}
      />

      {/* Intro */}
      <section className="py-20 lg:py-28 bg-[#FAF7F2]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#B8922A] mb-5 font-bold">
            Une scène, mille possibilités
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-8 text-[#0A0A0A]">
            Là où vos rêves prennent vie.
          </h2>
          <p className="text-base lg:text-lg text-[#0A0A0A]/70 leading-relaxed">
            Plage privée pour les cérémonies, rooftop pour les cocktails, salle de réception
            pour 300 convives, jardin tropical pour les photos. BBr met à votre disposition
            l'écrin idéal et une équipe coordinatrice qui s'occupe de tout, de A à Z.
          </p>
        </div>
      </section>

      {/* Event types grid */}
      <section className="pb-20 lg:pb-28 bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {EVENT_TYPES.map((t) => (
              <div
                key={t.id}
                className="relative overflow-hidden h-80 group cursor-pointer"
                onClick={() => {
                  setForm({ ...form, event_type: t.id });
                  document.getElementById("devis")?.scrollIntoView({ behavior: "smooth" });
                }}
                data-testid={`event-type-${t.id}`}
              >
                <div className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-700"
                     style={{ backgroundImage: `url(${t.image})` }} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/85" />
                <div className="relative z-10 h-full flex flex-col justify-end p-6">
                  <div className="text-[#D4B256] mb-3">{t.icon}</div>
                  <h3 className="text-white font-bold text-xl mb-2">{t.label}</h3>
                  <p className="text-white/75 text-sm leading-relaxed">{t.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEVIS FORM */}
      <section id="devis" className="py-24 lg:py-32 bg-[#0A0A0A]" data-testid="evenementiel-devis-section">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#D4B256] mb-5 font-bold">
              Parlons de votre événement
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
              Demandez votre devis personnalisé.
            </h2>
            <p className="text-white/70 text-base lg:text-lg leading-relaxed">
              Réponse de l'équipe commerciale sous 24h ouvrées. Visite des espaces sur rendez-vous.
            </p>
          </div>

          {success ? (
            <div className="bg-white p-12 text-center" data-testid="evenementiel-success">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#B8922A] text-white flex items-center justify-center">
                <Check size={32} strokeWidth={2} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Demande reçue.</h3>
              <p className="text-[#0A0A0A]/70 mb-8 leading-relaxed">
                Notre équipe commerciale revient vers vous sous 24h ouvrées. En attendant,
                explorez nos autres univers ou contactez-nous directement.
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#0A0A0A] hover:bg-[#B8922A] text-white text-[0.7rem] tracking-[0.22em] uppercase font-semibold transition-colors"
              >
                Retour à l'accueil
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white p-8 lg:p-12 space-y-6" data-testid="evenementiel-form">
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="Type d'événement *">
                  <select required value={form.event_type} onChange={update("event_type")}
                          className="w-full px-4 py-3 border border-[#0A0A0A]/15 focus:outline-none focus:border-[#B8922A] text-sm bg-white"
                          data-testid="evenementiel-event-type">
                    {EVENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Date envisagée">
                  <input type="date" value={form.target_date} onChange={update("target_date")}
                         className="w-full px-4 py-3 border border-[#0A0A0A]/15 focus:outline-none focus:border-[#B8922A] text-sm"
                         data-testid="evenementiel-date" />
                </Field>
              </div>
              <Field label="Nom & Prénom *">
                <input required type="text" value={form.full_name} onChange={update("full_name")}
                       placeholder="Aïssatou Diallo"
                       className="w-full px-4 py-3 border border-[#0A0A0A]/15 focus:outline-none focus:border-[#B8922A] text-sm"
                       data-testid="evenementiel-name" />
              </Field>
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="Email *">
                  <input required type="email" value={form.email} onChange={update("email")}
                         placeholder="aissatou@example.com"
                         className="w-full px-4 py-3 border border-[#0A0A0A]/15 focus:outline-none focus:border-[#B8922A] text-sm"
                         data-testid="evenementiel-email" />
                </Field>
                <Field label="Téléphone (WhatsApp) *">
                  <input required type="tel" value={form.phone} onChange={update("phone")}
                         placeholder="+225 07 04 60 06 00"
                         className="w-full px-4 py-3 border border-[#0A0A0A]/15 focus:outline-none focus:border-[#B8922A] text-sm"
                         data-testid="evenementiel-phone" />
                </Field>
              </div>
              <Field label="Nombre d'invités estimé">
                <input type="number" min="1" value={form.guests} onChange={update("guests")}
                       placeholder="80"
                       className="w-full px-4 py-3 border border-[#0A0A0A]/15 focus:outline-none focus:border-[#B8922A] text-sm"
                       data-testid="evenementiel-guests" />
              </Field>
              <Field label="Parlez-nous de votre projet">
                <textarea rows={4} value={form.message} onChange={update("message")}
                          placeholder="Format souhaité, ambiance, particularités…"
                          className="w-full px-4 py-3 border border-[#0A0A0A]/15 focus:outline-none focus:border-[#B8922A] text-sm resize-none"
                          data-testid="evenementiel-message" />
              </Field>
              {error && <div className="text-red-600 text-sm bg-red-50 p-3">{error}</div>}
              <button type="submit" disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 px-7 py-4 bg-[#B8922A] hover:bg-[#A07D1F] disabled:opacity-50 text-white text-[0.75rem] tracking-[0.22em] uppercase font-semibold transition-colors"
                      data-testid="evenementiel-submit">
                {submitting ? "Envoi en cours…" : <>Envoyer ma demande <Send size={14} /></>}
              </button>
              <p className="text-xs text-[#0A0A0A]/45 text-center pt-2">
                Aucun engagement. Réponse sous 24h ouvrées.
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[0.65rem] tracking-[0.22em] uppercase font-bold text-[#0A0A0A]/65 mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}

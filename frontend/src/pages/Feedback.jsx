import { useState } from "react";
import { Link } from "react-router-dom";
import { Star, CheckCircle2, Send } from "lucide-react";
import axios from "axios";

const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "") + "/api";

const EXPERIENCES = [
  { id: "pass_day", label: "Pass Day" },
  { id: "sunset", label: "Sunset" },
  { id: "brunch", label: "Brunch" },
  { id: "lounge", label: "Lounge" },
  { id: "restaurant", label: "Restaurant" },
  { id: "hebergement", label: "Hébergement" },
  { id: "evenement_prive", label: "Événement privé" },
  { id: "autre", label: "Autre" },
];

const CRITERIA = [
  { id: "accueil_arrivee",     label: "Accueil & arrivée" },
  { id: "service_amabilite",   label: "Service & amabilité du personnel" },
  { id: "restauration_boissons", label: "Restauration & boissons" },
  { id: "ambiance_cadre",      label: "Ambiance & cadre" },
  { id: "proprete_confort",    label: "Propreté & confort" },
  { id: "experience_globale",  label: "Expérience globale au BBr" },
];

export default function Feedback() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    experience_type: "",
    other_label: "",
    visit_date: "",
    full_name: "",
    email: "",
    phone: "",
    accueil_arrivee: 0,
    service_amabilite: 0,
    restauration_boissons: 0,
    ambiance_cadre: 0,
    proprete_confort: 0,
    experience_globale: 0,
    most_appreciated: "",
    improvement_suggestion: "",
    staff_member_mention: "",
  });

  const update = (k, v) => setForm({ ...form, [k]: v });

  const validate = () => {
    if (!form.experience_type) return "Choisissez votre type d'expérience.";
    for (const c of CRITERIA) {
      if (!form[c.id] || form[c.id] < 1) return `Notez « ${c.label} » de 1 à 5 étoiles.`;
    }
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setSubmitting(true);
    try {
      await axios.post(`${API}/feedback`, form);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (ex) {
      setError(ex.response?.data?.detail || "Une erreur est survenue. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center" data-testid="feedback-thanks">
          <img
            src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png"
            alt="Boulay Beach Resort"
            className="h-[70px] w-auto object-contain mx-auto mb-8"
            style={{ filter: "brightness(0.9)" }}
          />
          <CheckCircle2 size={56} className="mx-auto text-[#B8922A] mb-6" />
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-3">Merci !</div>
          <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-4">Votre retour est précieux</h1>
          <p className="text-[#0A0A0A]/65 text-sm leading-relaxed mb-8">
            Merci d'avoir partagé votre expérience. Votre retour nous aide à rendre chaque visite encore plus mémorable.
          </p>
          <Link to="/" className="inline-block bg-[#0A0A0A] text-white px-6 py-3 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#B8922A] transition-colors" data-testid="back-home">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 md:px-12" data-testid="feedback-page">
      {/* Logo BBR — centered on mobile, left-aligned on desktop */}
      <div className="max-w-6xl mx-auto mb-10 flex justify-center md:justify-start">
        <img
          src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png"
          alt="Boulay Beach Resort"
          className="h-[120px] sm:h-[150px] w-auto object-contain"
          style={{ filter: "brightness(0.9)" }}
        />
      </div>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-3">Retour Expérience</div>
          <h1 className="font-display-serif text-3xl sm:text-4xl md:text-5xl text-[#0A0A0A] mb-5 leading-tight">
            Merci d'avoir choisi le BBr
          </h1>
          <p className="text-[#0A0A0A]/65 text-base max-w-xl mx-auto">
            Votre avis nous aide à rendre chaque expérience encore plus mémorable.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 mb-6 text-sm" data-testid="feedback-error">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-10 bg-white p-6 sm:p-10 border border-[#0A0A0A]/8">

          {/* Experience type */}
          <Section title="Votre expérience au BBr">
            <div className="grid sm:grid-cols-2 gap-3">
              {EXPERIENCES.map((e) => (
                <label key={e.id} className={`flex items-center gap-3 px-4 py-3 border cursor-pointer transition-colors ${form.experience_type === e.id ? "border-[#B8922A] bg-[#B8922A]/5" : "border-[#0A0A0A]/15 hover:border-[#0A0A0A]/30"}`} data-testid={`exp-${e.id}`}>
                  <input type="radio" name="experience_type" value={e.id} checked={form.experience_type === e.id} onChange={() => update("experience_type", e.id)} className="accent-[#B8922A]" />
                  <span className="text-sm">{e.label}</span>
                </label>
              ))}
            </div>
            {form.experience_type === "autre" && (
              <input type="text" value={form.other_label} onChange={(e) => update("other_label", e.target.value)} placeholder="Précisez…" className="mt-3 w-full border border-[#0A0A0A]/15 px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8922A]" data-testid="other-label" />
            )}
          </Section>

          {/* Date */}
          <Section title="Date de votre visite">
            <input type="date" value={form.visit_date} onChange={(e) => update("visit_date", e.target.value)} className="w-full sm:w-64 border border-[#0A0A0A]/15 px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8922A]" data-testid="visit-date" />
          </Section>

          {/* Ratings */}
          <Section title="Évaluation de votre expérience">
            <div className="space-y-5">
              {CRITERIA.map((c) => (
                <div key={c.id} className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-[#0A0A0A]/8 last:border-0">
                  <div className="text-sm text-[#0A0A0A]/90 flex-1 min-w-[200px]">{c.label}</div>
                  <StarRating value={form[c.id]} onChange={(v) => update(c.id, v)} testid={`rate-${c.id}`} />
                </div>
              ))}
            </div>
          </Section>

          {/* Free text */}
          <Section title="Vos impressions">
            <FieldTA label="Qu'avez-vous le plus apprécié ?" value={form.most_appreciated} onChange={(v) => update("most_appreciated", v)} testid="most-appreciated" />
            <FieldTA label="Que pourrions-nous améliorer pour rendre votre prochaine expérience encore plus exceptionnelle ?" value={form.improvement_suggestion} onChange={(v) => update("improvement_suggestion", v)} testid="improvement" />
            <FieldTA label="Un membre de notre équipe vous a marqué ?" value={form.staff_member_mention} onChange={(v) => update("staff_member_mention", v)} testid="staff-mention" />
          </Section>

          {/* Optional identity */}
          <Section title="Vos coordonnées (facultatif)">
            <div className="grid sm:grid-cols-2 gap-4">
              <input type="text" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="Nom & prénom" className="border border-[#0A0A0A]/15 px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8922A]" data-testid="full-name" />
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="Email" className="border border-[#0A0A0A]/15 px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8922A]" data-testid="email" />
              <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Téléphone" className="border border-[#0A0A0A]/15 px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8922A]" data-testid="phone" />
            </div>
          </Section>

          <button type="submit" disabled={submitting} className="w-full bg-[#0A0A0A] text-white px-6 py-4 text-[0.75rem] uppercase tracking-[0.22em] hover:bg-[#B8922A] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2" data-testid="submit-btn">
            <Send size={14} /> {submitting ? "Envoi en cours…" : "Envoyer mon retour"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="font-display-serif text-xl sm:text-2xl text-[#0A0A0A] mb-5">{title}</h2>
      {children}
    </div>
  );
}

function FieldTA({ label, value, onChange, testid }) {
  return (
    <div className="mb-5">
      <label className="block text-sm text-[#0A0A0A]/80 mb-2">{label}</label>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-4 py-3 text-sm focus:outline-none focus:border-[#B8922A] resize-y" data-testid={testid} />
    </div>
  );
}

function StarRating({ value, onChange, testid }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" data-testid={testid}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-1 transition-transform hover:scale-110"
          data-testid={`${testid}-${n}`}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
        >
          <Star
            size={26}
            className={(hover || value) >= n ? "fill-[#B8922A] text-[#B8922A]" : "text-[#0A0A0A]/25"}
            fill={(hover || value) >= n ? "#B8922A" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, UserCheck, Download, CheckCircle2, Loader2,
  Briefcase, Users, UserPlus, Truck, Handshake, User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";

const BBR_LOGO =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";

const KIND_OPTIONS = [
  { id: "client",      label: "Client",      description: "Je viens profiter d'une expérience BBR",   icon: UserCheck, accent: "#B8922A" },
  { id: "personnel",   label: "Personnel",   description: "Je suis salarié·e du resort",              icon: Briefcase, accent: "#0A0A0A" },
  { id: "prestataire", label: "Prestataire", description: "Intervention, maintenance, mission",       icon: Users,     accent: "#6B7280" },
  { id: "fournisseur", label: "Fournisseur", description: "Livraison ou approvisionnement",           icon: Truck,     accent: "#0EA5E9" },
  { id: "invite",      label: "Invité",      description: "Invité·e par le resort ou un événement",    icon: UserPlus,  accent: "#16A34A" },
  { id: "partenaire",  label: "Partenaire",  description: "Rendez-vous professionnel ou réunion",     icon: Handshake, accent: "#9333EA" },
  { id: "visiteur",    label: "Visiteur",    description: "Visite ponctuelle / autre",                icon: UserIcon,  accent: "#A16207" },
];

const VISIT_REASONS = [
  "Réunion", "Maintenance", "Livraison", "Visite privée",
  "Rendez-vous professionnel", "Événement", "Contrôle", "Mission de service",
];

const POSITION_HINTS = [
  "Réceptionniste", "Serveur", "Agent de sécurité", "Comptable",
  "Manager", "Chauffeur",
];

export default function Enregistrement() {
  const [offers, setOffers] = useState([]);
  const [kind, setKind] = useState(null);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    offer_id: "", offer_other: "", company: "",
    position: "", visit_reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    api.get("/registration-offers")
      .then(({ data }) => setOffers(data.offers || []))
      .catch(() => toast.error("Impossible de charger les offres"));
  }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!kind) {
      toast.error("Veuillez sélectionner votre statut");
      return;
    }
    if (kind === "client" && form.offer_id === "autre" && !form.offer_other.trim()) {
      toast.error("Précisez l'offre dans le champ 'Autre'");
      return;
    }
    if (kind === "client" && !form.offer_id) {
      toast.error("Sélectionnez une offre");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        kind,
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (kind === "client") {
        payload.offer_id = form.offer_id;
        if (form.offer_id === "autre") payload.offer_other = form.offer_other;
      }
      if (kind === "personnel" && form.position.trim()) {
        payload.position = form.position.trim();
      }
      if (kind !== "client" && kind !== "personnel" && form.visit_reason.trim()) {
        payload.visit_reason = form.visit_reason.trim();
      }
      if (form.company.trim()) payload.company = form.company.trim();
      const { data } = await api.post("/registrations", payload);
      setSuccess(data);
      toast.success(
        data.email
          ? "Enregistrement validé ! Votre pass a été envoyé par email."
          : "Enregistrement validé ! Téléchargez votre pass."
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    const downloadUrl = `${api.defaults.baseURL}/registrations/${success.id}/pass.pdf?token=${success.pass_token}`;
    return (
      <div className="min-h-screen bg-white" data-testid="enregistrement-success">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
          <img src={BBR_LOGO} alt="BBr" className="h-14 w-auto object-contain mx-auto mb-8" />
          <CheckCircle2 className="mx-auto text-emerald-500 mb-5" size={64} strokeWidth={1.5} />
          <h1 className="font-display-serif text-3xl sm:text-4xl text-[#0A0A0A] mb-3">
            Merci {success.first_name} !
          </h1>
          <p className="text-[#0A0A0A]/70 text-sm sm:text-base mb-2 leading-relaxed">
            {success.email
              ? "Vous venez de recevoir votre pass d'embarquement par email."
              : "Votre pass d'embarquement est prêt — téléchargez-le ci-dessous."}
          </p>
          <p className="text-[#0A0A0A]/55 text-sm mb-8">
            Référence : <span className="font-mono text-[#0A0A0A]">{success.ref}</span><br/>
            Expérience : <span className="text-[#0A0A0A]">{success.offer_label}</span>
          </p>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#B8922A] text-white px-6 py-3 text-[0.72rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] transition-colors"
            data-testid="download-pass-btn"
          >
            <Download size={14} /> Télécharger mon pass
          </a>
          <div className="mt-10">
            <Link
              to="/accueil"
              className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A]"
              data-testid="back-accueil"
            >
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="enregistrement-page">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <Link
            to="/accueil"
            className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] inline-flex items-center gap-2"
            data-testid="back-accueil"
          >
            <ArrowLeft size={14} /> Retour
          </Link>
          <img src={BBR_LOGO} alt="BBr" className="h-12 w-auto object-contain" style={{ filter: "brightness(0.9)" }} />
        </div>

        <div className="text-center mb-8 sm:mb-10">
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2 flex items-center justify-center gap-2">
            <UserCheck size={12} /> Enregistrement
          </div>
          <h1 className="font-display-serif text-3xl sm:text-4xl text-[#0A0A0A] mb-3">
            Bienvenue au BBr
          </h1>
          <p className="text-[#0A0A0A]/65 text-sm sm:text-base leading-relaxed px-2">
            Veuillez renseigner vos informations pour vous enregistrer
            et recevoir un ticket d'embarquement.
          </p>
        </div>

        {/* Kind picker — 4 cards */}
        <div className="mb-8" data-testid="kind-picker">
          <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-3 text-center">
            Vous êtes <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
            {KIND_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = kind === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setKind(opt.id)}
                  className={`p-3 sm:p-4 border text-left transition-all ${
                    isActive
                      ? "border-[#B8922A] bg-[#FAF7F2] shadow-[0_0_0_1px_#B8922A_inset]"
                      : "border-[#0A0A0A]/15 bg-white hover:border-[#0A0A0A]/35"
                  }`}
                  data-testid={`kind-${opt.id}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon size={16} style={{ color: isActive ? opt.accent : "#0A0A0A" }} />
                    <span className={`text-sm font-medium ${isActive ? "text-[#0A0A0A]" : "text-[#0A0A0A]/85"}`}>
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-[0.68rem] sm:text-xs text-[#0A0A0A]/55 leading-snug">
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {kind && (
          <form onSubmit={submit} className="space-y-4" data-testid="enregistrement-form">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nom" required value={form.last_name}
                onChange={(v) => update("last_name", v)} testid="field-last-name" />
              <Field label="Prénom" required value={form.first_name}
                onChange={(v) => update("first_name", v)} testid="field-first-name" />
            </div>
            <Field label="Numéro" type="tel" required value={form.phone}
              placeholder="+225 07 ..."
              onChange={(v) => update("phone", v)} testid="field-phone" />
            {/* iter-50c: email kept ONLY for clients (they receive the pass by email).
                Personnel / prestataires / invités / etc. → enregistrement express. */}
            {kind === "client" && (
              <Field label="Email" type="email" value={form.email}
                onChange={(v) => update("email", v)} testid="field-email"
                placeholder="Pour recevoir votre pass" />
            )}

            {kind === "client" && (
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5">
                  Offre <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.offer_id}
                  onChange={(e) => update("offer_id", e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
                  data-testid="field-offer"
                >
                  <option value="">— Sélectionnez une offre —</option>
                  {offers.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {kind === "client" && form.offer_id === "autre" && (
              <Field
                label="Précisez l'offre"
                required
                value={form.offer_other}
                onChange={(v) => update("offer_other", v)}
                testid="field-offer-other"
                placeholder="Ex : événement privé, séminaire spécifique…"
              />
            )}

            {kind === "personnel" && (
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5">
                  Poste / Fonction
                </label>
                <input
                  list="position-hints"
                  value={form.position}
                  onChange={(e) => update("position", e.target.value)}
                  placeholder="Ex : Réceptionniste, Serveur, Sécurité…"
                  className="w-full px-3 py-2.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                  data-testid="field-position"
                />
                <datalist id="position-hints">
                  {POSITION_HINTS.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
            )}

            {kind && kind !== "client" && kind !== "personnel" && (
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5">
                  Motif de la visite
                </label>
                <input
                  list="reason-hints"
                  value={form.visit_reason}
                  onChange={(e) => update("visit_reason", e.target.value)}
                  placeholder="Ex : Maintenance, Livraison, Réunion…"
                  className="w-full px-3 py-2.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                  data-testid="field-visit-reason"
                />
                <datalist id="reason-hints">
                  {VISIT_REASONS.map((r) => <option key={r} value={r} />)}
                </datalist>
              </div>
            )}

            {kind && kind !== "client" && (
              <Field
                label={kind === "personnel" ? "Service / département" : "Entreprise"}
                value={form.company}
                onChange={(v) => update("company", v)}
                testid="field-company"
                placeholder={
                  kind === "personnel" ? "Ex : Réception, F&B, Sécurité…"
                    : "Optionnel"
                }
              />
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#B8922A] text-white py-3 text-[0.72rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] disabled:opacity-50 inline-flex items-center justify-center gap-2 mt-6"
              data-testid="submit-registration"
            >
              {submitting ? (
                <><Loader2 size={14} className="animate-spin" /> Enregistrement…</>
              ) : (
                <>Valider</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, type = "text", required, value, onChange, placeholder, testid }) {
  return (
    <div>
      <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
        data-testid={testid}
      />
    </div>
  );
}

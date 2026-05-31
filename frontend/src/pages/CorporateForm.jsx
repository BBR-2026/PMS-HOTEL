import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { ArrowLeft, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BBR_LOGO =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";

const OFFER_LABELS = {
  seminaire: "Séminaire",
  team_building: "Team Building",
  journee_etude: "Journée d'étude",
  dejeuner_diner_entreprise: "Déjeuner ou dîner d'entreprise",
  formule_personnalisee: "Formule personnalisée",
};

const SECTORS = [
  "Banque & Finance", "Assurance", "Industrie", "Énergie", "Télécommunications",
  "Technologies / IT", "Conseil & Audit", "Juridique", "Santé / Pharmaceutique",
  "Grande distribution", "Hôtellerie & Restauration", "Tourisme", "Transport & Logistique",
  "Immobilier", "Médias & Communication", "Éducation", "ONG / Associations",
  "Administration publique", "Agroalimentaire", "Construction & BTP", "Autre",
];

export default function CorporateForm() {
  const { offerId } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState({
    company_name: "",
    sector: "",
    description: "",
    requested_date: "",
    head_count: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Redirect if the offer slug isn't one of our corporate offers
  useEffect(() => {
    if (offerId && !OFFER_LABELS[offerId]) nav("/pole/corporate", { replace: true });
  }, [offerId, nav]);

  const offerLabel = OFFER_LABELS[offerId] || "Corporate";

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/corporate-inquiries", {
        offer_id: offerId,
        ...form,
        contact_email: form.contact_email || undefined,
        head_count: parseInt(form.head_count) || 1,
      });
      setDone(true);
      toast.success("Votre demande a été transmise à notre équipe.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-white" data-testid="corporate-form-success">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 text-center">
          <img src={BBR_LOGO} alt="BBr" className="h-14 w-auto object-contain mx-auto mb-8" />
          <CheckCircle2 className="mx-auto text-emerald-500 mb-5" size={64} strokeWidth={1.5} />
          <h1 className="font-display-serif text-3xl sm:text-4xl text-[#0A0A0A] mb-3">
            Demande envoyée
          </h1>
          <p className="text-[#0A0A0A]/70 text-sm sm:text-base mb-8 leading-relaxed">
            Merci pour votre demande pour <strong>{offerLabel}</strong>.
            Notre équipe commerciale vous recontactera sous <strong>24 à 48 heures</strong> au numéro indiqué.
          </p>
          <Link
            to="/pole/corporate"
            className="inline-flex items-center gap-2 bg-[#B8922A] text-white px-6 py-3 text-[0.72rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23]"
          >
            <ArrowLeft size={14} /> Retour aux offres Corporate
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="corporate-form">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <Link
            to="/pole/corporate"
            className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] inline-flex items-center gap-2"
            data-testid="back-corporate"
          >
            <ArrowLeft size={14} /> Retour
          </Link>
          <img src={BBR_LOGO} alt="BBr" className="h-12 w-auto object-contain" style={{ filter: "brightness(0.9)" }} />
        </div>

        <div className="text-center mb-8 sm:mb-10">
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2 flex items-center justify-center gap-2">
            <Building2 size={12} /> Corporate
          </div>
          <h1 className="font-display-serif text-3xl sm:text-4xl text-[#0A0A0A] mb-3">
            {offerLabel}
          </h1>
          <p className="text-[#0A0A0A]/65 text-sm sm:text-base">
            Renseignez les informations ci-dessous, notre équipe vous recontactera
            sous 24 à 48 heures pour finaliser votre demande.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Nom de l'entreprise" required value={form.company_name}
            onChange={(v) => update("company_name", v)} testid="field-company-name" />
          <div>
            <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5">
              Secteur d'activité <span className="text-red-500">*</span>
            </label>
            <select
              required value={form.sector}
              onChange={(e) => update("sector", e.target.value)}
              className="w-full px-3 py-2.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
              data-testid="field-sector"
            >
              <option value="">— Sélectionnez —</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5">
              Description de la demande <span className="text-red-500">*</span>
            </label>
            <textarea
              required rows={5}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Objectifs, format souhaité, prestations attendues, contraintes…"
              className="w-full px-3 py-2.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm leading-relaxed"
              data-testid="field-description"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Date souhaitée" type="date" required value={form.requested_date}
              onChange={(v) => update("requested_date", v)} testid="field-date" />
            <Field label="Nombre de personnes" type="number" required min={1}
              value={form.head_count}
              onChange={(v) => update("head_count", v)} testid="field-head-count" />
          </div>

          <Field label="Nom du correspondant" required value={form.contact_name}
            onChange={(v) => update("contact_name", v)} testid="field-contact-name" />

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Téléphone" type="tel" required placeholder="+225 07 ..."
              value={form.contact_phone}
              onChange={(v) => update("contact_phone", v)} testid="field-contact-phone" />
            <Field label="Email (optionnel)" type="email" value={form.contact_email}
              onChange={(v) => update("contact_email", v)} testid="field-contact-email" />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#B8922A] text-white py-3 text-[0.72rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] disabled:opacity-50 inline-flex items-center justify-center gap-2 mt-6"
            data-testid="submit-corporate-inquiry"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Envoi…</> : "Valider ma demande"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, type = "text", required, value, onChange, placeholder, testid, min }) {
  return (
    <div>
      <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type} required={required} value={value} min={min}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
        data-testid={testid}
      />
    </div>
  );
}

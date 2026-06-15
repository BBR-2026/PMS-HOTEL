import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2, UserPlus, CheckCircle2, User, Briefcase, Building2,
  Phone, ArrowLeft, Copy,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const BBR_LOGO =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";

export default function CantineInscription() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({
    first_name: "", last_name: "", service: "",
    position: "", type: "personnel", phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null); // { code, first_name, ..., credits_attributed }

  useEffect(() => {
    api.get("/cantine/public/services").then(({ data }) => {
      setServices(data.items || []);
    }).catch(() => setServices([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()
        || !form.service.trim() || !form.position.trim()) {
      toast.error("Tous les champs marqués * sont obligatoires");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/cantine/public/users", {
        first_name: form.first_name,
        last_name: form.last_name,
        service: form.service,
        position: form.position,
        type: form.type,
        phone: form.phone || undefined,
      });
      setSuccess(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la création du compte");
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(success.code);
    toast.success("Code copié !");
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]" data-testid="cantine-inscription-success">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
          <img src={BBR_LOGO} alt="BBR" className="h-14 w-auto object-contain mx-auto mb-6" />
          <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={56} strokeWidth={1.5} />
          <h1 className="font-display-serif text-3xl text-[#0A0A0A] mb-2">
            Compte créé avec succès
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mb-6">
            Conservez précieusement votre code Cantine. Il vous servira à réserver vos repas.
          </p>

          <div className="bg-white border-2 border-[#B8922A] p-6 mb-6">
            <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">
              Votre code Cantine
            </div>
            <div className="font-mono text-5xl font-bold text-[#0A0A0A] tracking-widest mb-4"
                 data-testid="cantine-generated-code">
              {success.code}
            </div>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] hover:text-[#9d7a23] transition-colors"
              data-testid="cantine-copy-code"
            >
              <Copy size={12} /> Copier le code
            </button>
          </div>

          <div className="bg-white border border-[#0A0A0A]/10 p-4 text-left text-sm mb-6">
            <Row label="Nom complet" value={`${success.first_name} ${success.last_name}`} />
            <Row label="Service" value={success.service} />
            <Row label="Fonction" value={success.position} />
            <Row label="Type" value={success.type === "personnel" ? "Personnel" : "Prestataire"} />
            <Row label="Crédits attribués" value={`${success.credits_attributed} repas / mois`} />
          </div>

          <Link
            to="/cantine/reserver"
            className="block bg-[#B8922A] hover:bg-[#9d7a23] text-white py-3 text-[0.7rem] uppercase tracking-[0.22em]"
            data-testid="cantine-goto-reserve"
          >
            Réserver mon repas de demain →
          </Link>
          <Link
            to="/cantine"
            className="block mt-3 text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#0A0A0A]"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]" data-testid="cantine-inscription-page">
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link
          to="/cantine"
          className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] mb-6"
        >
          <ArrowLeft size={12} /> Retour
        </Link>

        <div className="text-center mb-6">
          <img src={BBR_LOGO} alt="BBR" className="h-12 w-auto object-contain mx-auto mb-5" />
          <div className="text-[0.62rem] uppercase tracking-[0.3em] text-[#B8922A] mb-1.5 inline-flex items-center gap-1.5">
            <UserPlus size={11} /> Inscription
          </div>
          <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A] mb-2">
            Créer mon compte cantine
          </h1>
          <p className="text-sm text-[#0A0A0A]/60">
            Renseignez vos informations pour recevoir votre code unique.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3" data-testid="cantine-inscription-form">
          <Field icon={User} label="Prénom" required value={form.first_name}
                 onChange={(v) => setForm((f) => ({ ...f, first_name: v }))}
                 testid="cantine-first-name" />
          <Field icon={User} label="Nom" required value={form.last_name}
                 onChange={(v) => setForm((f) => ({ ...f, last_name: v }))}
                 testid="cantine-last-name" />

          <div>
            <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5 inline-flex items-center gap-1.5">
              <Building2 size={10} /> Service / Département <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.service}
              onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
              className="w-full px-3 py-2.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
              data-testid="cantine-service"
            >
              <option value="">— Sélectionner un service —</option>
              {services.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <Field icon={Briefcase} label="Fonction / Poste" required value={form.position}
                 onChange={(v) => setForm((f) => ({ ...f, position: v }))}
                 testid="cantine-position" />

          <div>
            <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5">
              Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <TypeBtn active={form.type === "personnel"} label="Personnel"
                       onClick={() => setForm((f) => ({ ...f, type: "personnel" }))}
                       testid="cantine-type-personnel" />
              <TypeBtn active={form.type === "prestataire"} label="Prestataire"
                       onClick={() => setForm((f) => ({ ...f, type: "prestataire" }))}
                       testid="cantine-type-prestataire" />
            </div>
          </div>

          <Field icon={Phone} label="Téléphone (optionnel)" type="tel"
                 placeholder="+225 07 …" value={form.phone}
                 onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                 testid="cantine-phone" />

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-50 text-white py-3 text-[0.7rem] uppercase tracking-[0.22em] inline-flex items-center justify-center gap-2 mt-4"
            data-testid="cantine-inscription-submit"
          >
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> Création…</>
            ) : (
              <>Créer mon compte</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-[#0A0A0A]/5 last:border-0">
      <span className="text-[0.65rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50">{label}</span>
      <span className="text-sm font-medium text-[#0A0A0A] text-right ml-3">{value}</span>
    </div>
  );
}

function Field({ icon: Icon, label, type = "text", required, value, onChange, placeholder, testid }) {
  return (
    <div>
      <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5 inline-flex items-center gap-1.5">
        {Icon && <Icon size={10} />}
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
        data-testid={testid}
      />
    </div>
  );
}

function TypeBtn({ active, label, onClick, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={`py-2.5 text-[0.7rem] uppercase tracking-[0.18em] border transition-colors ${
        active
          ? "bg-[#B8922A] text-white border-[#B8922A]"
          : "bg-white text-[#0A0A0A]/70 border-[#0A0A0A]/15 hover:border-[#B8922A]"
      }`}
    >
      {label}
    </button>
  );
}

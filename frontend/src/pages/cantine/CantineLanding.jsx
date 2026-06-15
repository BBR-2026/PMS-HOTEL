import { useEffect, useState } from "react";
import {
  UtensilsCrossed, UserPlus, Clock, Loader2, CheckCircle2,
  User, Briefcase, Building2, Phone, Copy, Search, Hash,
  Calendar, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const BBR_LOGO =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";

const TABS = [
  { id: "register", label: "Créer mon compte", icon: UserPlus },
  { id: "reserve",  label: "Réserver mon repas", icon: Clock },
];

export default function CantineLanding() {
  const [tab, setTab] = useState("register");

  return (
    <div className="min-h-screen bg-[#FAF7F2]" data-testid="cantine-landing">
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-12">
        {/* Header */}
        <div className="text-center mb-7 sm:mb-9">
          <img
            src={BBR_LOGO}
            alt="Boulay Beach Resort"
            className="h-12 sm:h-14 w-auto object-contain mx-auto mb-5"
          />
          <div className="text-[0.62rem] uppercase tracking-[0.3em] text-[#B8922A] mb-1.5 inline-flex items-center gap-1.5">
            <UtensilsCrossed size={11} /> Pré-enregistrement cantine
          </div>
          <h1 className="font-display-serif text-3xl sm:text-4xl text-[#0A0A0A] mb-2 leading-tight">
            Cantine du personnel
          </h1>
          <p className="text-sm text-[#0A0A0A]/60">
            Créez votre compte une seule fois, puis réservez chaque jour votre
            repas du lendemain.
          </p>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-0 border-b border-[#0A0A0A]/10 mb-6"
             data-testid="cantine-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`cantine-tab-${t.id}`}
              className={`py-3 text-[0.7rem] uppercase tracking-[0.2em] transition-colors inline-flex items-center justify-center gap-2 border-b-2 ${
                tab === t.id
                  ? "border-[#B8922A] text-[#B8922A] font-medium"
                  : "border-transparent text-[#0A0A0A]/55 hover:text-[#0A0A0A]"
              }`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "register" ? <RegisterPanel /> : <ReservePanel />}

        <p className="text-center text-[0.7rem] text-[#0A0A0A]/40 mt-10 leading-relaxed">
          Boulay Beach Resort — Cantine du personnel
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Register Panel
// ─────────────────────────────────────────────────────────────────────────
function RegisterPanel() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({
    first_name: "", last_name: "", service: "",
    position: "", type: "personnel", phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    api.get("/cantine/public/services").then(({ data }) =>
      setServices(data.items || []),
    ).catch(() => setServices([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
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
      toast.error(err.response?.data?.detail || "Échec de la création");
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
      <div className="text-center" data-testid="cantine-register-success">
        <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={50} strokeWidth={1.5} />
        <h2 className="font-display-serif text-2xl text-[#0A0A0A] mb-1.5">
          Compte créé avec succès
        </h2>
        <p className="text-sm text-[#0A0A0A]/60 mb-5">
          Conservez votre code Cantine. Il vous servira chaque jour à réserver
          votre repas.
        </p>

        <div className="bg-white border-2 border-[#B8922A] p-5 mb-4">
          <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-2">
            Votre code Cantine
          </div>
          <div className="font-mono text-5xl font-bold text-[#0A0A0A] tracking-widest mb-3"
               data-testid="cantine-generated-code">
            {success.code}
          </div>
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] hover:text-[#9d7a23]"
            data-testid="cantine-copy-code"
          >
            <Copy size={12} /> Copier le code
          </button>
        </div>

        <div className="bg-white border border-[#0A0A0A]/10 p-4 text-left text-sm mb-5">
          <Row label="Nom complet" value={`${success.first_name} ${success.last_name}`} />
          <Row label="Service" value={success.service} />
          <Row label="Fonction" value={success.position} />
          <Row label="Type" value={success.type === "personnel" ? "Personnel" : "Prestataire"} />
          <Row label="Crédits attribués" value={`${success.credits_attributed} repas / mois`} />
        </div>

        <button
          onClick={() => setSuccess(null)}
          className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#0A0A0A]"
          data-testid="cantine-register-another"
        >
          Créer un autre compte
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="cantine-inscription-form">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field icon={User} label="Prénom" required value={form.first_name}
               onChange={(v) => setForm((f) => ({ ...f, first_name: v }))}
               testid="cantine-first-name" />
        <Field icon={User} label="Nom" required value={form.last_name}
               onChange={(v) => setForm((f) => ({ ...f, last_name: v }))}
               testid="cantine-last-name" />
      </div>

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
        className="w-full bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-50 text-white py-3 text-[0.7rem] uppercase tracking-[0.22em] inline-flex items-center justify-center gap-2 mt-3"
        data-testid="cantine-inscription-submit"
      >
        {submitting ? (
          <><Loader2 size={14} className="animate-spin" /> Création…</>
        ) : (
          <>Créer mon compte</>
        )}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Reserve Panel
// ─────────────────────────────────────────────────────────────────────────
function ReservePanel() {
  const [code, setCode] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [windowInfo, setWindowInfo] = useState(null);

  useEffect(() => {
    api.get("/cantine/public/window").then(({ data }) => setWindowInfo(data))
      .catch(() => {});
  }, []);

  const lookup = async (e) => {
    e?.preventDefault?.();
    const c = code.trim().toUpperCase();
    if (c.length !== 6) {
      toast.error("Le code doit comporter 6 caractères");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(`/cantine/public/users/${c}`);
      setUser(data);
    } catch (err) {
      setUser(null);
      toast.error(err.response?.data?.detail || "Code Cantine introuvable");
    } finally {
      setLoading(false);
    }
  };

  const reserve = async (e) => {
    e.preventDefault();
    if (!confirmed) {
      toast.error("Veuillez confirmer votre présence");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/cantine/public/reservations", {
        code: user.code, confirmed: true,
      });
      setSuccess(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSuccess(null);
    setUser(null);
    setCode("");
    setConfirmed(false);
  };

  if (success) {
    return (
      <div className="text-center" data-testid="cantine-reserve-success">
        <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={50} strokeWidth={1.5} />
        <h2 className="font-display-serif text-2xl text-[#0A0A0A] mb-1.5">
          Inscription enregistrée
        </h2>
        <p className="text-sm text-[#0A0A0A]/65 mb-5">
          {success.guest_name}, votre repas du{" "}
          <strong className="text-[#0A0A0A]">{formatDate(success.meal_date)}</strong>{" "}
          est confirmé.
        </p>

        <div className="bg-white border-2 border-[#B8922A] p-5 mb-5">
          <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1.5">
            Crédits restants
          </div>
          <div className="font-display-serif text-4xl font-bold text-[#0A0A0A] mb-1"
               data-testid="cantine-credits-remaining">
            {success.credits_remaining}
          </div>
          <div className="text-[0.7rem] text-[#0A0A0A]/50">
            repas pour le mois en cours
          </div>
        </div>

        <button
          onClick={reset}
          className="text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] hover:text-[#9d7a23]"
          data-testid="cantine-reserve-again"
        >
          Inscrire une autre personne →
        </button>
      </div>
    );
  }

  return (
    <div>
      {windowInfo && (
        <div className={`mb-4 p-3 border text-sm flex items-start gap-2 ${
          windowInfo.is_open
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-red-50 border-red-200 text-red-700"
        }`} data-testid="cantine-window-info">
          {windowInfo.is_open
            ? <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
            : <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />}
          <div>
            <div className="font-medium">
              {windowInfo.is_open ? "Inscriptions ouvertes" : "Inscriptions fermées"} ·
              Repas du {formatDate(windowInfo.meal_date)}
            </div>
            <div className="text-[0.72rem] opacity-80">
              Plage horaire : {windowInfo.open_hhmm} – {windowInfo.close_hhmm} (Abidjan)
            </div>
          </div>
        </div>
      )}

      <form onSubmit={lookup} className="mb-5">
        <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1.5 inline-flex items-center gap-1.5">
          <Hash size={10} /> Code Cantine <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            required
            maxLength={6}
            value={code}
            placeholder="FRA428"
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setUser(null);
              setConfirmed(false);
            }}
            className="flex-1 px-3 py-3 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-base font-mono tracking-widest text-center bg-white uppercase"
            data-testid="cantine-reserve-code-input"
          />
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="bg-[#0A0A0A] hover:bg-[#1f1f1f] disabled:opacity-40 text-white px-4 inline-flex items-center justify-center"
            data-testid="cantine-reserve-lookup-btn"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </button>
        </div>
      </form>

      {user && (
        <div className="bg-white border border-[#0A0A0A]/10 p-4 animate-in fade-in slide-in-from-bottom-2"
             data-testid="cantine-reserve-user-card">
          <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] mb-2 inline-flex items-center gap-1.5">
            <User size={10} /> Profil identifié
          </div>
          <div className="font-display-serif text-xl text-[#0A0A0A] mb-0.5">
            {user.first_name} {user.last_name}
          </div>
          <div className="text-sm text-[#0A0A0A]/65 mb-3">
            {user.service} · {user.position}
            <br />
            <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[#B8922A]">
              {user.type === "personnel" ? "Personnel" : "Prestataire"}
            </span>
          </div>

          <div className="border-t border-[#0A0A0A]/8 pt-3 flex items-baseline justify-between">
            <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55">
              Crédits restants
            </span>
            <span className={`text-lg font-bold ${user.credits_remaining > 0 ? "text-[#B8922A]" : "text-red-500"}`}>
              {user.credits_remaining} / {user.credits_attributed}
            </span>
          </div>

          {user.credits_remaining === 0 ? (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 text-sm flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>Vous n&apos;avez plus de crédits repas disponibles ce mois-ci.</span>
            </div>
          ) : (
            <form onSubmit={reserve} className="mt-4 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[#B8922A]"
                  data-testid="cantine-reserve-checkbox"
                />
                <span className="text-sm text-[#0A0A0A]/80 leading-relaxed">
                  <span className="font-medium text-[#0A0A0A] inline-flex items-center gap-1.5">
                    <Calendar size={12} className="text-[#B8922A]" />
                    Je serai présent au déjeuner de demain
                  </span>
                  <br />
                  <span className="text-[0.72rem] text-[#0A0A0A]/55">
                    1 crédit sera décompté de votre solde mensuel.
                  </span>
                </span>
              </label>
              <button
                type="submit"
                disabled={submitting || !confirmed}
                className="w-full bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-50 text-white py-3 text-[0.7rem] uppercase tracking-[0.22em] inline-flex items-center justify-center gap-2"
                data-testid="cantine-reserve-submit"
              >
                {submitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Enregistrement…</>
                ) : (
                  <>Valider mon inscription</>
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shared little components
// ─────────────────────────────────────────────────────────────────────────
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

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

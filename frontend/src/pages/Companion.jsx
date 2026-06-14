import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2, UserCheck, CheckCircle2, AlertCircle, Users,
  Mail, Phone, User, Hash, Download,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";

const BBR_LOGO =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";

export default function Companion() {
  const { code } = useParams();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(null);   // { guest_name, surname, ticket_image }
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "" });

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/companion/${code}`);
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Code invalide");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
      toast.error("Nom, prénom et téléphone sont requis");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post(`/companion/${code}/register`, {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        email: form.email || undefined,
      });
      setRegistered(data.registered);
      setSummary(data);
      toast.success("Enregistré · votre billet est prêt !");
    } catch (err) {
      const detail = err.response?.data?.detail || "Échec de l'enregistrement";
      toast.error(detail);
      if (err.response?.status === 410) await reload(); // closed → refresh state
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]" data-testid="companion-loading">
        <Loader2 size={32} className="animate-spin text-[#B8922A]" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAF7F2]" data-testid="companion-error">
        <div className="max-w-md text-center">
          <AlertCircle size={56} className="mx-auto text-red-500 mb-4" strokeWidth={1.5} />
          <h1 className="font-display-serif text-2xl text-[#0A0A0A] mb-2">Lien indisponible</h1>
          <p className="text-sm text-[#0A0A0A]/65">{error}</p>
        </div>
      </div>
    );
  }

  // Success: ticket has been generated
  if (registered) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]" data-testid="companion-success">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
          <img src={BBR_LOGO} alt="BBR" className="h-14 w-auto object-contain mx-auto mb-6" />
          <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={56} strokeWidth={1.5} />
          <h1 className="font-display-serif text-3xl text-[#0A0A0A] mb-2">
            Bienvenue {registered.guest_name} !
          </h1>
          <p className="text-[#0A0A0A]/65 text-sm mb-6">
            Votre billet d'embarquement est généré. Conservez-le et présentez-le au quai.
          </p>
          {registered.ticket_image && (
            <img
              src={registered.ticket_image}
              alt="Billet BBR"
              className="w-full border border-[#B8922A]/30 mb-5"
              data-testid="companion-ticket-image"
            />
          )}
          {registered.ticket_image && (
            <a
              href={registered.ticket_image}
              download={`BBR-billet-${summary.ref}.png`}
              className="inline-flex items-center gap-2 bg-[#B8922A] text-white px-5 py-2.5 text-[0.72rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] transition-colors"
              data-testid="companion-download-btn"
            >
              <Download size={13} /> Télécharger mon billet
            </a>
          )}
          <p className="text-[0.7rem] text-[#0A0A0A]/45 mt-8">
            Réservation {summary.ref} · {summary.slots_used}/{summary.slots_total} adultes enregistrés
          </p>
        </div>
      </div>
    );
  }

  // Closed (quota reached or status incompatible)
  if (summary.closed || summary.slots_remaining === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAF7F2]" data-testid="companion-closed">
        <div className="max-w-md text-center">
          <img src={BBR_LOGO} alt="BBR" className="h-14 w-auto object-contain mx-auto mb-6" />
          <Users className="mx-auto text-[#B8922A] mb-4" size={48} />
          <h1 className="font-display-serif text-2xl text-[#0A0A0A] mb-2">
            Enregistrements clôturés
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mb-1">
            Tous les passagers prévus dans cette réservation ont déjà été enregistrés.
          </p>
          <p className="text-[0.78rem] text-[#0A0A0A]/45 mt-4">
            {summary.slots_used}/{summary.slots_total} adultes · Réf {summary.ref}
          </p>
        </div>
      </div>
    );
  }

  // Active form
  return (
    <div className="min-h-screen bg-[#FAF7F2]" data-testid="companion-page">
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-6">
          <img src={BBR_LOGO} alt="BBR" className="h-12 w-auto object-contain mx-auto mb-5" />
          <div className="text-[0.62rem] uppercase tracking-[0.3em] text-[#B8922A] mb-1.5 inline-flex items-center gap-1.5">
            <UserCheck size={11} /> Enregistrement passager
          </div>
          <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A] mb-2">
            Rejoindre la réservation de {summary.booker_name || "votre groupe"}
          </h1>
        </div>

        {/* Summary card */}
        <div className="bg-white border border-[#0A0A0A]/10 p-4 mb-5" data-testid="companion-summary">
          <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[#0A0A0A]/45 mb-1">
            Réservation
          </div>
          <div className="font-display-serif text-lg text-[#0A0A0A] mb-2">
            {summary.offer_label}
          </div>
          <div className="text-sm text-[#0A0A0A]/65 leading-relaxed">
            Date : <strong className="text-[#0A0A0A]">{summary.date}</strong>
            {summary.boat_time && <> · Embarquement <strong className="text-[#0A0A0A]">{summary.boat_time}</strong></>}
            <br />
            Réf : <span className="font-mono text-[#0A0A0A]">{summary.ref}</span>
          </div>

          {/* Dynamic slot counter */}
          <div className="mt-4 pt-3 border-t border-[#0A0A0A]/8">
            <div className="flex items-center justify-between text-[0.78rem]">
              <span className="text-[#0A0A0A]/55">Adultes enregistrés</span>
              <span className="font-medium text-[#B8922A]" data-testid="companion-slot-counter">
                {summary.slots_used} / {summary.slots_total}
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-[#0A0A0A]/8 rounded">
              <div
                className="h-full bg-[#B8922A] transition-all"
                style={{ width: `${(summary.slots_used / Math.max(1, summary.slots_total)) * 100}%` }}
              />
            </div>
            <div className="mt-2 text-[0.7rem] text-[#0A0A0A]/50">
              Il reste <strong>{summary.slots_remaining}</strong> place{summary.slots_remaining > 1 ? "s" : ""} à enregistrer.
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3" data-testid="companion-form">
          <Field icon={User} label="Prénom" required value={form.first_name}
                 onChange={(v) => setForm((f) => ({ ...f, first_name: v }))} testid="companion-first-name" />
          <Field icon={User} label="Nom" required value={form.last_name}
                 onChange={(v) => setForm((f) => ({ ...f, last_name: v }))} testid="companion-last-name" />
          <Field icon={Phone} type="tel" label="Téléphone" required placeholder="+225 07 …"
                 value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                 testid="companion-phone" />
          <Field icon={Mail} type="email" label="Email (optionnel)" value={form.email}
                 onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                 testid="companion-email" />

          {/* Display the booking code so the user confirms it's the right one */}
          <div className="text-[0.7rem] text-[#0A0A0A]/55 flex items-center gap-1.5 mt-1">
            <Hash size={11} /> Code de réservation : <span className="font-mono text-[#0A0A0A]">{summary.booking_code}</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-50 text-white py-3 text-[0.7rem] uppercase tracking-[0.22em] inline-flex items-center justify-center gap-2 mt-4"
            data-testid="companion-submit"
          >
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> Enregistrement…</>
            ) : (
              <>Valider mon enregistrement</>
            )}
          </button>
        </form>
      </div>
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

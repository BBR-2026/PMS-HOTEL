import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, AlertCircle, Lock } from "lucide-react";
import api from "../lib/api";
import NationalityAutocomplete from "../components/NationalityAutocomplete";

/**
 * Public corporate registration form — shared by the company's organiser to
 * each participant. Decrements seats server-side. Locks itself when the cap
 * is reached. Personnel/Prestataire/Invité never see paid offers.
 */
const BBR_LOGO =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/5jjvd8zn_LOGO_BBr_VF_Plan_de_travail_1-removebg-preview.png";

export default function CorporateRegistration() {
  const { token } = useParams();
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    phone: "",
    whatsapp: "",
    nationality: "",
    payment_method: "cash",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/corporate-form/${token}`);
      setMeta(data);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.detail || "Lien invalide ou expiré");
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [token]);

  const submit = async () => {
    const required = ["name", "surname", "email", "phone", "nationality"];
    for (const k of required) {
      if (!form[k]?.trim()) {
        toast.error(`Champ requis : ${k}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        kind: "client",
        name: form.name.trim(),
        surname: form.surname.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        whatsapp: (form.whatsapp || form.phone).trim(),
        nationality: form.nationality.trim(),
      };
      const paymentMode = meta.payment_mode;
      if (paymentMode === "paid" || paymentMode === "configurable") {
        payload.payment_method = form.payment_method;
      }
      const { data } = await api.post(`/corporate-form/${token}/register`, payload);
      setSubmitted(data);
      toast.success("Inscription confirmée");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[#0A0A0A]/55">Chargement…</div>;
  }

  if (error || !meta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7] px-6">
        <div className="max-w-md w-full bg-white border border-[#0A0A0A]/8 p-10 text-center" data-testid="corporate-form-error">
          <Lock size={28} className="mx-auto text-[#B8922A] mb-4" />
          <h1 className="font-display-serif text-2xl text-[#0A0A0A] mb-3">Lien indisponible</h1>
          <p className="text-sm text-[#0A0A0A]/65">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7] px-6 py-10">
        <div className="max-w-md w-full bg-white border border-[#0A0A0A]/8 p-10 text-center" data-testid="corporate-form-success">
          <Check size={32} className="mx-auto text-green-600 mb-4" />
          <h1 className="font-display-serif text-3xl text-[#0A0A0A] mb-3">Inscription confirmée</h1>
          <p className="text-sm text-[#0A0A0A]/65 mb-5">
            Votre place pour <b>{meta.company_name}</b> est réservée.
          </p>
          <div className="bg-[#FAFAF7] border border-[#0A0A0A]/8 p-4 text-left text-[0.78rem] text-[#0A0A0A]/70 leading-relaxed">
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-2">Référence</div>
            <code className="text-[#0A0A0A] block break-all">{submitted.qr_token}</code>
            <div className="mt-3 text-[0.7rem]">
              Places restantes : <b>{submitted.remaining_seats}</b> / {meta.max_participants}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isPaid = meta.payment_mode === "paid" || meta.payment_mode === "configurable";

  return (
    <div className="min-h-screen bg-[#FAFAF7] py-10 px-4" data-testid="corporate-form-page">
      <div className="max-w-xl mx-auto">
        {/* Header — event info on top */}
        <div className="bg-[#0A0A0A] text-white p-8 text-center">
          <img src={BBR_LOGO} alt="BBR" className="h-14 mx-auto mb-4 opacity-95" />
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#E5D9C0] mb-2">
            Inscription événement
          </div>
          <h1 className="font-display-serif text-3xl tracking-tight" data-testid="corporate-form-title">
            {meta.company_name}
          </h1>
          <div className="mt-2 text-[0.85rem] text-white/75">
            {meta.reservation_type}{meta.event_date ? ` · ${meta.event_date}` : ""}
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[#E5D9C0]/80">
            <AlertCircle size={11} />
            {meta.remaining_seats} place{meta.remaining_seats > 1 ? "s" : ""} restante{meta.remaining_seats > 1 ? "s" : ""} sur {meta.max_participants}
          </div>
        </div>

        {/* Form — simple, single-purpose */}
        <div className="bg-white border border-[#0A0A0A]/8 border-t-0 p-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ["surname", "Nom *", "text"],
              ["name", "Prénom *", "text"],
              ["email", "Email *", "email"],
              ["phone", "Téléphone *", "tel"],
              ["whatsapp", "WhatsApp", "tel"],
            ].map(([key, label, type]) => (
              <div key={key} className={key === "whatsapp" ? "sm:col-span-2" : ""}>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={key === "whatsapp" ? "Optionnel — par défaut = téléphone" : ""}
                  className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none"
                  data-testid={`corp-${key}`}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Nationalité *</label>
              <NationalityAutocomplete
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: typeof e === "string" ? e : e?.target?.value || "" })}
                lang="fr"
                testId="corp-nationality"
              />
            </div>
          </div>

          {isPaid && (
            <div>
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Mode de paiement *</label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none"
                data-testid="corp-payment-method"
              >
                <option value="cash">Espèces (à l&apos;arrivée)</option>
                <option value="card">Carte bancaire</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-[#0A0A0A] text-white py-3 text-[0.7rem] uppercase tracking-[0.28em] hover:bg-[#B8922A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            data-testid="corp-submit"
          >
            {submitting ? "Inscription…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

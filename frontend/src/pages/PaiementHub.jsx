import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Anchor, UtensilsCrossed, Beer, ConciergeBell, Wine, ShoppingBag, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BBR_LOGO = "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";
const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "") + "/api";

const LOCATIONS = [
  { id: "quai_bbr",       label: "Quai BBr",        icon: Anchor,            color: "#3B82F6" },
  { id: "restaurant",     label: "Restaurant",      icon: UtensilsCrossed,   color: "#B8922A" },
  { id: "bar_beach_club", label: "Bar Beach Club",  icon: Beer,              color: "#0EA5E9" },
  { id: "reception",      label: "Réception",       icon: ConciergeBell,     color: "#0A0A0A" },
  { id: "lounge",         label: "Lounge",          icon: Wine,              color: "#7C2D12" },
  { id: "boutique",       label: "Boutique",        icon: ShoppingBag,       color: "#16A34A" },
];

const fmtFCFA = (n) => (Number(n) || 0).toLocaleString("fr-FR") + " FCFA";

export default function PaiementHub() {
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e?.preventDefault();
    const amt = parseInt(String(amount).replace(/\D/g, ""), 10);
    if (!selected || !amt || amt <= 0) {
      toast.error("Indiquez un montant valide.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/payments/fineo/onsite-checkout`, {
        location: selected.id,
        amount: amt,
        customer_name: name || null,
        customer_phone: phone || null,
      });
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error("Impossible d'initialiser le paiement.");
      }
    } catch (ex) {
      toast.error(ex.response?.data?.detail || "Erreur paiement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white" data-testid="paiement-hub">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <Link to="/accueil" className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] inline-flex items-center gap-2" data-testid="back-accueil">
            <ArrowLeft size={14} /> Retour
          </Link>
          <img src={BBR_LOGO} alt="BBr" className="h-12 w-auto object-contain" style={{ filter: "brightness(0.9)" }} />
        </div>

        {!selected ? (
          <>
            <div className="text-center mb-8">
              <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2 flex items-center justify-center gap-2">
                <CreditCard size={12} /> Paiement
              </div>
              <h1 className="font-display-serif text-3xl sm:text-4xl text-[#0A0A0A] mb-3">Choisissez un point de paiement</h1>
              <p className="text-[#0A0A0A]/55 text-sm sm:text-base">Sélectionnez l'endroit où vous souhaitez régler votre consommation</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4" data-testid="locations-grid">
              {LOCATIONS.map((loc) => {
                const Icon = loc.icon;
                return (
                  <button
                    key={loc.id}
                    onClick={() => setSelected(loc)}
                    data-testid={`location-${loc.id}`}
                    className="group bg-white border border-[#0A0A0A]/12 p-5 sm:p-6 flex flex-col items-center text-center hover:border-[#B8922A] hover:shadow-md transition-all hover:-translate-y-0.5"
                  >
                    <Icon size={32} strokeWidth={1.5} style={{ color: loc.color }} className="mb-3 group-hover:scale-110 transition-transform" />
                    <div className="font-medium text-[#0A0A0A] text-sm sm:text-base">{loc.label}</div>
                    <div className="mt-2 text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/35 group-hover:text-[#B8922A] transition-colors inline-flex items-center gap-1">
                      Payer <ChevronRight size={11} />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-6" data-testid="payment-form">
            <button type="button" onClick={() => { setSelected(null); setAmount(""); }} className="text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] inline-flex items-center gap-1 hover:underline mb-2">
              ← Changer de point
            </button>

            <div className="flex items-center gap-3 p-4 bg-[#FAFAF7] border border-[#0A0A0A]/8">
              <selected.icon size={28} strokeWidth={1.5} style={{ color: selected.color }} />
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Point de paiement</div>
                <div className="font-medium text-[#0A0A0A]">{selected.label}</div>
              </div>
            </div>

            <div>
              <label className="block text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-2">Montant à régler (FCFA) *</label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={amount ? Number(String(amount).replace(/\D/g, "")).toLocaleString("fr-FR") : ""}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 25 000"
                className="w-full border border-[#0A0A0A]/15 px-4 py-4 text-2xl font-display-serif text-center text-[#0A0A0A] focus:outline-none focus:border-[#B8922A]"
                data-testid="amount-input"
              />
              {amount && (
                <div className="mt-2 text-center text-[#B8922A] text-sm font-medium">
                  Total : {fmtFCFA(amount)}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-2">Votre nom (facultatif)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom & prénom" className="w-full border border-[#0A0A0A]/15 px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8922A]" data-testid="cust-name" />
              </div>
              <div>
                <label className="block text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-2">Téléphone (facultatif)</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+225 …" className="w-full border border-[#0A0A0A]/15 px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8922A]" data-testid="cust-phone" />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !amount}
              className="w-full bg-[#0A0A0A] text-white px-6 py-4 text-[0.75rem] uppercase tracking-[0.22em] hover:bg-[#B8922A] transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
              data-testid="pay-btn"
            >
              {submitting ? "Redirection…" : `Payer ${amount ? fmtFCFA(amount) : ""} via FineoPay`}
            </button>

            <p className="text-center text-[0.7rem] text-[#0A0A0A]/45">
              Paiement sécurisé · Mobile Money · Visa · Mastercard
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

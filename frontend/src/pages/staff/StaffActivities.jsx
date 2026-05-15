import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { Search, Plus, X, Trash2, Lock, CreditCard, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useStaffAuth } from "../../context/StaffAuthContext";

const STATUS_LABEL = {
  open: { label: "Ouvert", color: "bg-green-50 text-green-700 border-green-200" },
  closed: { label: "Soldé", color: "bg-[#FAFAF7] text-[#0A0A0A]/55 border-[#0A0A0A]/15" },
};

const PAYMENT_METHOD_FR = {
  cash: "Espèces",
  card: "Carte bancaire",
  mobile_money: "Mobile Money",
};

const PAYMENT_METHOD_OPTIONS = [
  { id: "cash", label: "Espèces", icon: "💵" },
  { id: "card", label: "Carte bancaire", icon: "💳" },
  { id: "mobile_money", label: "Mobile Money", icon: "📱" },
];

export default function StaffActivities() {
  const { user } = useStaffAuth();
  const canManage = ["manager", "admin"].includes(user?.role);
  const [activities, setActivities] = useState([]);
  const [tokenInput, setTokenInput] = useState("");
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customForm, setCustomForm] = useState({ label: "", amount: "", quantity: 1, note: "" });

  useEffect(() => {
    api.get("/staff/activities").then((r) => setActivities(r.data.items || [])).catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    // Two-level grouping: category > subcategory. Each leaf is an array of activities.
    const out = {};
    (activities || []).filter((a) => a.active).forEach((a) => {
      const cat = a.category || "Autre";
      const sub = a.subcategory || "—";
      out[cat] = out[cat] || {};
      out[cat][sub] = out[cat][sub] || [];
      out[cat][sub].push(a);
    });
    return out;
  }, [activities]);

  // Fixed display order — pinned categories first, then the rest alphabetically
  const CATEGORY_ORDER = ["Menus", "Espace privatif", "Activités & Loisirs", "Offres spéciales", "Autre"];
  const orderedCategories = useMemo(() => {
    const keys = Object.keys(grouped);
    const pinned = CATEGORY_ORDER.filter((k) => keys.includes(k));
    const rest = keys.filter((k) => !CATEGORY_ORDER.includes(k)).sort();
    return [...pinned, ...rest];
  }, [grouped]);

  const CATEGORY_META = {
    "Menus": { icon: "🍽️", accent: "#B8922A", desc: "Carte du jour selon le point de service" },
    "Espace privatif": { icon: "🏖️", accent: "#3B82F6", desc: "Privatisation de zones le temps de la prestation" },
    "Activités & Loisirs": { icon: "🚤", accent: "#16A34A", desc: "Sport, terrain, bien-être" },
    "Offres spéciales": { icon: "✨", accent: "#A855F7", desc: "Personnalisable selon l'offre" },
  };

  const lookup = async (token) => {
    const t = (token || tokenInput || "").trim();
    if (!t) return;
    setLoading(true);
    setWallet(null);
    try {
      const { data } = await api.get(`/staff/wallets/${encodeURIComponent(t)}`);
      setWallet(data);
      setTokenInput(t);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Carte introuvable");
    } finally {
      setLoading(false);
    }
  };

  const charge = async (payload) => {
    if (!wallet) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/staff/wallets/${wallet.token}/charge`, payload);
      setWallet(data);
      toast.success("Activité ajoutée");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  const voidTx = async (txId) => {
    if (!wallet) return;
    if (!window.confirm("Annuler cette ligne ?")) return;
    setBusy(true);
    try {
      const { data } = await api.delete(`/staff/wallets/${wallet.token}/charge/${txId}`);
      setWallet(data);
      toast.success("Ligne annulée");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Annulation impossible");
    } finally {
      setBusy(false);
    }
  };

  const [showCloseModal, setShowCloseModal] = useState(false);

  const close = async (method) => {
    if (!wallet) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/staff/wallets/${wallet.token}/close`, { payment_method: method });
      setWallet(data);
      toast.success(`Paiement validé · ${PAYMENT_METHOD_FR[method] || method}`);
      setShowCloseModal(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  const submitCustom = async () => {
    const amt = parseInt(customForm.amount, 10);
    if (!customForm.label.trim() || !amt || amt <= 0) {
      toast.error("Libellé et montant valides requis");
      return;
    }
    await charge({
      label: customForm.label.trim(),
      amount: amt,
      quantity: Math.max(1, parseInt(customForm.quantity, 10) || 1),
      note: customForm.note,
    });
    setShowCustom(false);
    setCustomForm({ label: "", amount: "", quantity: 1, note: "" });
  };

  const closed = wallet?.status === "closed";
  const txs = wallet?.transactions || [];
  const active_txs = txs.filter((t) => t.status !== "voided");

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-activities">
      <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A] mb-2">Consommation sur place</h1>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">
        Scannez la carte du client pour facturer un menu, une privatisation d'espace, une activité loisirs ou une offre sur mesure.
      </p>

      {/* Lookup */}
      <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-5 mb-6">
        <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">
          Référence carte (QR token ou code court)
        </label>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/40" />
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="Collez le token QR ou le code court (ex: A1B2C3D4)"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none"
              data-testid="wallet-token-input"
            />
          </div>
          <button
            onClick={() => lookup()}
            disabled={loading || !tokenInput.trim()}
            className="bg-[#B8922A] text-white px-5 py-2.5 text-[0.65rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] disabled:opacity-50"
            data-testid="wallet-lookup-btn"
          >
            {loading ? "…" : "Ouvrir la carte"}
          </button>
        </div>
      </div>

      {wallet && (
        <div className="space-y-5" data-testid="wallet-detail">
          {/* Wallet header */}
          <div className="bg-white border border-[#0A0A0A]/8 p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">
                  Carte #{wallet.booking_ref}
                </div>
                <div className="font-display-serif text-xl text-[#0A0A0A] mt-0.5">{wallet.owner_name}</div>
                {wallet.booking && (
                  <div className="text-[0.75rem] text-[#0A0A0A]/60 mt-1">
                    {wallet.booking.offer_name} · {wallet.booking.date}
                    {wallet.booking.checkout_date && ` → ${wallet.booking.checkout_date}`}
                    {wallet.booking.phone ? ` · ${wallet.booking.phone}` : ""}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className={`inline-block px-2 py-1 text-[0.6rem] uppercase tracking-[0.18em] border ${STATUS_LABEL[wallet.status]?.color || ""}`}>
                  {STATUS_LABEL[wallet.status]?.label || wallet.status}
                </span>
                <div className="font-display-serif text-3xl text-[#0A0A0A] mt-2">{formatXOF(wallet.total_charged)}</div>
                <div className="text-[0.65rem] text-[#0A0A0A]/45">{active_txs.length} prestation{active_txs.length > 1 ? "s" : ""}</div>
              </div>
            </div>
            {wallet.booking?.balance_due > 0 && (
              <div className="mt-3 pt-3 border-t border-[#0A0A0A]/8 flex items-start gap-2 text-[0.72rem] text-orange-700">
                <AlertCircle size={13} className="mt-0.5" />
                <span>
                  Solde de réservation à régler : <strong>{formatXOF(wallet.booking.balance_due)}</strong>
                  {wallet.booking.deposit_pct && ` (acompte ${wallet.booking.deposit_pct}% déjà versé)`}
                </span>
              </div>
            )}
          </div>

          {/* Activity catalog */}
          {!closed && (
            <div className="bg-white border border-[#0A0A0A]/8 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A]">Ajouter une prestation</div>
                <button
                  onClick={() => setShowCustom(true)}
                  className="text-[0.65rem] uppercase tracking-[0.22em] text-[#B8922A] hover:text-[#9d7a23] inline-flex items-center gap-1.5"
                  data-testid="custom-charge-btn"
                >
                  <Plus size={11} /> Montant libre
                </button>
              </div>
              {orderedCategories.map((cat) => {
                const meta = CATEGORY_META[cat] || { icon: "•", accent: "#B8922A", desc: "" };
                const subgroups = grouped[cat] || {};
                const subs = Object.keys(subgroups).sort();
                return (
                  <div key={cat} className="mb-6 last:mb-0" data-testid={`activity-cat-${cat}`}>
                    <div className="border-b border-[#0A0A0A]/8 pb-2 mb-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl leading-none">{meta.icon}</span>
                        <h3 className="font-display-serif text-lg text-[#0A0A0A]" style={{ color: meta.accent }}>{cat}</h3>
                      </div>
                      {meta.desc && <div className="text-[0.65rem] text-[#0A0A0A]/50 mt-0.5">{meta.desc}</div>}
                    </div>
                    {subs.map((sub) => (
                      <div key={sub} className="mb-3 last:mb-0">
                        {sub !== "—" && (
                          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60 mb-2 inline-flex items-center gap-1.5">
                            <span className="inline-block w-1 h-1 rounded-full" style={{ backgroundColor: meta.accent }} />
                            {sub}
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {subgroups[sub].map((a) => (
                            <button
                              key={a.id}
                              onClick={() => charge({ activity_id: a.id, quantity: 1 })}
                              disabled={busy}
                              className="text-left border border-[#0A0A0A]/10 p-3 hover:border-[#B8922A] hover:bg-[#B8922A]/5 transition-colors disabled:opacity-50"
                              data-testid={`activity-${a.id}`}
                            >
                              <div className="text-sm text-[#0A0A0A] leading-tight">{a.name_fr}</div>
                              <div className="text-xs font-medium text-[#B8922A] mt-1">{formatXOF(a.price)}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Offres spéciales — customizable canvas */}
              <div className="mt-2 border border-dashed border-[#A855F7]/40 bg-[#A855F7]/5 p-4" data-testid="special-offers-canvas">
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <div className="font-display-serif text-base text-[#A855F7] inline-flex items-center gap-2">
                      ✨ Offres spéciales
                    </div>
                    <div className="text-[0.65rem] text-[#0A0A0A]/55 mt-0.5">
                      Composez une prestation sur mesure — libellé, montant et notes 100% personnalisables.
                    </div>
                  </div>
                  <Link
                    to="/staff/configuration/activites"
                    className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45 hover:text-[#A855F7]"
                  >
                    Catalogue →
                  </Link>
                </div>
                <button
                  onClick={() => setShowCustom(true)}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#A855F7] text-white text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9333EA] disabled:opacity-50"
                  data-testid="open-special-offer-canvas"
                >
                  <Plus size={13} /> Créer une offre spéciale
                </button>
              </div>
            </div>
          )}

          {/* Transactions */}
          <div className="bg-white border border-[#0A0A0A]/8 p-5">
            <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">
              Historique ({txs.length})
            </div>
            {txs.length === 0 ? (
              <div className="text-sm text-[#0A0A0A]/50">Aucune prestation enregistrée.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                      <th className="text-left py-2.5">Date</th>
                      <th className="text-left py-2.5">Prestation</th>
                      <th className="text-center py-2.5">Qté</th>
                      <th className="text-right py-2.5">Montant</th>
                      <th className="text-right py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.slice().reverse().map((t) => {
                      const voided = t.status === "voided";
                      return (
                        <tr key={t.id} className="border-b border-[#0A0A0A]/5">
                          <td className={`py-2.5 text-[#0A0A0A]/70 text-xs ${voided ? "line-through opacity-50" : ""}`}>
                            {(t.created_at || "").slice(0, 16).replace("T", " ")}
                          </td>
                          <td className={`py-2.5 ${voided ? "line-through opacity-50" : "text-[#0A0A0A]"}`}>
                            {t.label}
                            {t.participant_name && (
                              <div className="text-[0.65rem] text-[#B8922A] mt-0.5">
                                Pour {t.participant_name}
                              </div>
                            )}
                            {t.note && <div className="text-[0.65rem] text-[#0A0A0A]/50">{t.note}</div>}
                            {voided && <span className="ml-2 text-[0.6rem] uppercase tracking-[0.18em] text-red-600">Annulée</span>}
                          </td>
                          <td className={`py-2.5 text-center ${voided ? "line-through opacity-50" : ""}`}>{t.quantity}</td>
                          <td className={`py-2.5 text-right font-medium ${voided ? "line-through opacity-50" : ""}`}>
                            {formatXOF(t.amount)}
                          </td>
                          <td className="py-2.5 text-right">
                            {!voided && !closed && canManage && (
                              <button
                                onClick={() => voidTx(t.id)}
                                className="text-red-600 hover:text-red-800 inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-[0.18em]"
                                data-testid={`void-tx-${t.id}`}
                              >
                                <Trash2 size={10} /> Annuler
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Close action */}
          {!closed && wallet.total_charged > 0 && canManage && (
            <div className="text-right">
              <button
                onClick={() => setShowCloseModal(true)}
                disabled={busy}
                className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#0A0A0A]/85 disabled:opacity-50"
                data-testid="close-wallet-btn"
              >
                <CreditCard size={13} /> Valider le paiement ({formatXOF(wallet.total_charged)})
              </button>
            </div>
          )}
          {!closed && wallet.total_charged > 0 && !canManage && (
            <div className="text-right text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45 italic">
              Validation du paiement réservée au manager
            </div>
          )}
          {closed && (
            <div className="bg-green-50/60 border border-green-200 p-4 text-sm" data-testid="wallet-paid-summary">
              <div className="flex items-center gap-2 text-green-800 mb-2">
                <Lock size={14} />
                <span className="font-medium">Carte soldée — paiement encaissé</span>
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[0.78rem] text-green-900">
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-green-700/80">Méthode</dt>
                  <dd className="font-medium mt-0.5">{PAYMENT_METHOD_FR[wallet.payment_method] || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-green-700/80">Montant</dt>
                  <dd className="font-medium mt-0.5 tabular-nums">{formatXOF(wallet.paid_amount || wallet.total_charged)}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-green-700/80">Encaissé le</dt>
                  <dd className="font-medium mt-0.5 tabular-nums">{(wallet.paid_at || wallet.closed_at || "").slice(0, 16).replace("T", " ")}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-green-700/80">Encaissé par</dt>
                  <dd className="font-medium mt-0.5">{wallet.closed_by || "—"}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}

      {/* Close (validate payment) modal */}
      {showCloseModal && wallet && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && setShowCloseModal(false)} data-testid="close-wallet-modal">
          <div className="bg-white p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display-serif text-2xl text-[#0A0A0A]">Valider le paiement</h3>
              <button onClick={() => !busy && setShowCloseModal(false)} className="text-[#0A0A0A]/50 hover:text-[#0A0A0A]">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-[#0A0A0A]/60">
              Le client règle <span className="font-medium text-[#B8922A] tabular-nums">{formatXOF(wallet.total_charged)}</span> pour {active_txs.length} prestation{active_txs.length > 1 ? "s" : ""}.
            </p>
            <p className="text-[0.7rem] text-[#0A0A0A]/45 mt-1 mb-5">
              Sélectionnez la méthode de paiement utilisée par le client. Cette sélection vaut preuve d'encaissement.
            </p>
            <div className="space-y-2">
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => close(m.id)}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-between gap-3 border border-[#B8922A]/40 hover:bg-[#B8922A]/5 hover:border-[#B8922A] px-4 py-3 text-left text-sm transition-colors disabled:opacity-50"
                  data-testid={`close-payment-${m.id}`}
                >
                  <span className="inline-flex items-center gap-3">
                    <span className="text-xl leading-none">{m.icon}</span>
                    <span className="text-[#0A0A0A]">{m.label}</span>
                  </span>
                  <Check size={14} className="text-[#B8922A]" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCloseModal(false)}
              disabled={busy}
              className="w-full mt-4 py-2 text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#0A0A0A]"
              data-testid="close-modal-cancel"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Custom charge modal */}
      {showCustom && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCustom(false)}>
          <div className="bg-white p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display-serif text-2xl text-[#0A0A0A]">Montant libre</h3>
              <button onClick={() => setShowCustom(false)} className="text-[#0A0A0A]/50 hover:text-[#0A0A0A]">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Libellé</label>
                <input
                  value={customForm.label}
                  onChange={(e) => setCustomForm({ ...customForm, label: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                  placeholder="Ex: Bouteille de Champagne"
                  data-testid="custom-charge-label"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Montant (FCFA)</label>
                  <input
                    type="number"
                    value={customForm.amount}
                    onChange={(e) => setCustomForm({ ...customForm, amount: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                    data-testid="custom-charge-amount"
                  />
                </div>
                <div>
                  <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Quantité</label>
                  <input
                    type="number"
                    min={1}
                    value={customForm.quantity}
                    onChange={(e) => setCustomForm({ ...customForm, quantity: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                    data-testid="custom-charge-qty"
                  />
                </div>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Note (optionnel)</label>
                <input
                  value={customForm.note}
                  onChange={(e) => setCustomForm({ ...customForm, note: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                  data-testid="custom-charge-note"
                />
              </div>
            </div>
            <button
              onClick={submitCustom}
              disabled={busy}
              className="w-full mt-5 bg-[#B8922A] text-white py-2.5 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] disabled:opacity-50"
              data-testid="custom-charge-submit"
            >
              <Check size={13} className="inline mr-1" /> Ajouter à la carte
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

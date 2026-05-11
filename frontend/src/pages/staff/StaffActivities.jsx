import { useEffect, useState, useMemo } from "react";
import api from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { Sparkles, Search, Plus, X, Trash2, Lock, CreditCard, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL = {
  open: { label: "Ouvert", color: "bg-green-50 text-green-700 border-green-200" },
  closed: { label: "Soldé", color: "bg-[#FAFAF7] text-[#0A0A0A]/55 border-[#0A0A0A]/15" },
};

export default function StaffActivities() {
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
    const out = {};
    (activities || []).filter((a) => a.active).forEach((a) => {
      const c = a.category || "Autre";
      out[c] = out[c] || [];
      out[c].push(a);
    });
    return out;
  }, [activities]);

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

  const close = async () => {
    if (!wallet) return;
    if (!window.confirm(`Solder la carte (${formatXOF(wallet.total_charged)}) ?`)) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/staff/wallets/${wallet.token}/close`);
      setWallet(data);
      toast.success("Carte soldée");
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
      <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A] mb-2">Activités sur place</h1>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">
        Scannez la carte Activités du client pour ajouter Jet Ski, Quad, Paddle, Spa…
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
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="mb-5 last:mb-0">
                  <div className="text-[0.6rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 mb-2 flex items-center gap-1.5">
                    <Sparkles size={11} className="text-[#B8922A]" /> {cat}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {items.map((a) => (
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
                            {t.note && <div className="text-[0.65rem] text-[#0A0A0A]/50">{t.note}</div>}
                            {voided && <span className="ml-2 text-[0.6rem] uppercase tracking-[0.18em] text-red-600">Annulée</span>}
                          </td>
                          <td className={`py-2.5 text-center ${voided ? "line-through opacity-50" : ""}`}>{t.quantity}</td>
                          <td className={`py-2.5 text-right font-medium ${voided ? "line-through opacity-50" : ""}`}>
                            {formatXOF(t.amount)}
                          </td>
                          <td className="py-2.5 text-right">
                            {!voided && !closed && (
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
          {!closed && wallet.total_charged > 0 && (
            <div className="text-right">
              <button
                onClick={close}
                disabled={busy}
                className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#0A0A0A]/85 disabled:opacity-50"
                data-testid="close-wallet-btn"
              >
                <CreditCard size={13} /> Solder la carte ({formatXOF(wallet.total_charged)})
              </button>
            </div>
          )}
          {closed && (
            <div className="flex items-center gap-2 text-sm text-[#0A0A0A]/55 justify-end">
              <Lock size={13} /> Carte soldée le {(wallet.closed_at || "").slice(0, 16).replace("T", " ")}
            </div>
          )}
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

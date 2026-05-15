import { useEffect, useState, useCallback } from "react";
import api from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { toast } from "sonner";
import {
  Wallet, AlertCircle, CreditCard, Banknote, Smartphone, ArrowDownToLine,
  CheckCircle2, XCircle, Search, Filter, Send, ChevronRight, Clock,
} from "lucide-react";

const PAYMENT_METHODS = [
  { id: "cash", label: "Espèces", icon: Banknote, color: "#16A34A" },
  { id: "card", label: "Carte", icon: CreditCard, color: "#2563EB" },
  { id: "mobile_money", label: "Mobile Money", icon: Smartphone, color: "#EA580C" },
  { id: "fineo", label: "FINEO en ligne", icon: Wallet, color: "#B8922A" },
  { id: "deposit", label: "Acompte", icon: ArrowDownToLine, color: "#A855F7" },
];
const METHOD_LABEL = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m.label]));
const POLE_LABEL = {
  beach_club: "Beach Club",
  hebergement: "Hébergement",
  corporate: "Corporate",
  activites_events: "Activités & Événements",
  le_kaai: "Le Kaai",
};
const STATUS_FR = {
  pending: "En attente",
  confirmed: "Confirmée",
  arrived: "Arrivée",
  completed: "Terminée",
  cancelled: "Annulée",
};
const STATUS_COLOR = {
  pending: "bg-[#FAFAF7] text-[#0A0A0A]/55 border-[#0A0A0A]/15",
  confirmed: "bg-[#B8922A]/10 text-[#B8922A] border-[#B8922A]/30",
  arrived: "bg-green-50 text-green-700 border-green-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

function fmtDateFR(iso) {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
function fmtDateTimeFR(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }); } catch { return iso; }
}

function MethodKpi({ method, count, total }) {
  const Icon = method.icon;
  return (
    <div className="bg-white border border-[#0A0A0A]/8 p-4" data-testid={`payments-kpi-${method.id}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.6rem] uppercase tracking-[0.22em]" style={{ color: method.color }}>{method.label}</span>
        <Icon size={14} style={{ color: method.color }} />
      </div>
      <div className="font-display-serif text-2xl text-[#0A0A0A]">{count}</div>
      <div className="text-[0.7rem] text-[#0A0A0A]/55 mt-1">{formatXOF(total)}</div>
    </div>
  );
}

function PoleBadge({ pole }) {
  if (!pole) return null;
  const COLORS = {
    beach_club: "text-[#B8922A] border-[#B8922A]/40 bg-[#B8922A]/5",
    hebergement: "text-blue-700 border-blue-300 bg-blue-50",
    corporate: "text-slate-700 border-slate-300 bg-slate-50",
    activites_events: "text-rose-700 border-rose-300 bg-rose-50",
    le_kaai: "text-purple-700 border-purple-300 bg-purple-50",
  };
  return (
    <span className={`text-[0.55rem] uppercase tracking-[0.18em] px-1.5 py-0.5 border whitespace-nowrap ${COLORS[pole] || "text-[#0A0A0A]/55 border-[#0A0A0A]/15"}`}>
      {POLE_LABEL[pole] || pole}
    </span>
  );
}

function ActionDrawer({ booking, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState(booking.payment_method || "cash");
  const isPaid = !!booking.paid_at;
  const isCancelled = booking.status === "cancelled";

  const markPaid = async () => {
    setBusy(true);
    try {
      await api.patch(`/staff/bookings/${booking.id}/payment`, { payment_method: method, paid: true });
      toast.success(`Paiement enregistré (${METHOD_LABEL[method] || method})`);
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally { setBusy(false); }
  };
  const markUnpaid = async () => {
    if (!window.confirm("Annuler le paiement de cette réservation ?")) return;
    setBusy(true);
    try {
      await api.patch(`/staff/bookings/${booking.id}/payment`, { payment_method: booking.payment_method || "cash", paid: false });
      toast.success("Paiement annulé");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally { setBusy(false); }
  };
  const setStatus = async (status) => {
    setBusy(true);
    try {
      await api.patch(`/staff/bookings/${booking.id}/status`, { status });
      toast.success(`Statut changé : ${STATUS_FR[status]}`);
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally { setBusy(false); }
  };
  const sendQr = async () => {
    setBusy(true);
    try {
      await api.post(`/staff/bookings/${booking.id}/resend-qr`);
      toast.success("QR re-envoyé par email/SMS");
    } catch (e) {
      // Graceful fallback — endpoint may not exist yet
      toast.message("Cette fonctionnalité sera disponible avec les notifications automatiques.");
    } finally { setBusy(false); }
  };

  const guestName = (booking.participants && booking.participants[0])
    ? `${booking.participants[0].surname || ""} ${booking.participants[0].name || ""}`.trim()
    : booking.phone;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={() => !busy && onClose()} />
      <aside className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 overflow-y-auto" data-testid="payment-drawer">
        <div className="p-5 border-b border-[#0A0A0A]/8 sticky top-0 bg-white flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Réservation #{booking.id.slice(0, 8).toUpperCase()}</div>
            <h3 className="font-display-serif text-xl text-[#0A0A0A] mt-1 truncate">{booking.offer_name}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <PoleBadge pole={booking.pole} />
              <span className={`text-[0.55rem] uppercase tracking-[0.18em] px-1.5 py-0.5 border ${STATUS_COLOR[booking.status]}`}>{STATUS_FR[booking.status]}</span>
              {isPaid ? (
                <span className="text-[0.55rem] uppercase tracking-[0.18em] px-1.5 py-0.5 border bg-green-50 text-green-700 border-green-200">Payée</span>
              ) : (
                <span className="text-[0.55rem] uppercase tracking-[0.18em] px-1.5 py-0.5 border bg-red-50 text-red-700 border-red-200">Impayée</span>
              )}
            </div>
          </div>
          <button onClick={onClose} disabled={busy} className="p-2 text-[#0A0A0A]/55 hover:text-[#0A0A0A]"><XCircle size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Identity */}
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5">Client</div>
            <div className="text-sm text-[#0A0A0A]">{guestName}</div>
            <div className="text-[0.72rem] text-[#0A0A0A]/55 mt-0.5">{booking.phone} · {booking.email || "—"}</div>
          </div>

          {/* Booking details */}
          <div className="grid grid-cols-2 gap-3 text-[0.78rem]">
            <div>
              <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Date</div>
              <div className="text-[#0A0A0A]">{fmtDateFR(booking.date)} · {booking.boat_time || "—"}</div>
            </div>
            <div>
              <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Convives</div>
              <div className="text-[#0A0A0A]">{booking.adults || 0}A{booking.children > 0 ? ` + ${booking.children}E` : ""}</div>
            </div>
            <div>
              <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Montant total</div>
              <div className="text-[#0A0A0A] font-medium tabular-nums">{formatXOF(booking.total_amount || 0)}</div>
            </div>
            <div>
              <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Déjà payé</div>
              <div className="text-[#0A0A0A] tabular-nums">{formatXOF(booking.paid_amount || 0)}</div>
            </div>
            {booking.deposit_pct > 0 && (
              <div className="col-span-2">
                <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Acompte</div>
                <div className="text-[#0A0A0A]">{booking.deposit_pct}% · solde dû {formatXOF((booking.total_amount || 0) - (booking.paid_amount || 0))}</div>
              </div>
            )}
            {booking.paid_at && (
              <div className="col-span-2">
                <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Payée le</div>
                <div className="text-[#0A0A0A]">{fmtDateTimeFR(booking.paid_at)} · {METHOD_LABEL[booking.payment_method] || booking.payment_method || "—"}</div>
              </div>
            )}
          </div>

          {/* Payment action */}
          {!isPaid && !isCancelled && (
            <div className="border-t border-[#0A0A0A]/8 pt-5">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3">Enregistrer le paiement</div>
              <div className="grid grid-cols-3 gap-1.5 mb-4">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = method === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      disabled={busy}
                      className={`p-2.5 border text-[0.62rem] uppercase tracking-[0.18em] flex flex-col items-center gap-1.5 transition-colors ${
                        active ? "border-[#B8922A] bg-[#B8922A]/5 text-[#B8922A] font-medium" : "border-[#0A0A0A]/10 text-[#0A0A0A]/65 hover:border-[#0A0A0A]/40"
                      }`}
                      data-testid={`method-${m.id}`}
                    >
                      <Icon size={14} style={active ? { color: m.color } : {}} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={markPaid}
                disabled={busy}
                className="w-full py-3 bg-[#B8922A] text-white text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#a37e1f] disabled:opacity-50 inline-flex items-center justify-center gap-2"
                data-testid="mark-paid-btn"
              >
                <CheckCircle2 size={14} /> Confirmer le paiement
              </button>
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    const isDeposit = booking.payment_method === "deposit" || (booking.deposit_pct && (booking.balance_due || 0) > 0);
                    const intent = isDeposit ? "deposit" : "booking";
                    const payload = { booking_id: booking.id, intent };
                    if (isDeposit) {
                      payload.amount = booking.balance_due || ((booking.total_amount || 0) - (booking.paid_amount || 0));
                    }
                    const { data } = await api.post(`/payments/fineo/checkout`, payload);
                    if (data?.checkout_url) {
                      try {
                        await navigator.clipboard.writeText(data.checkout_url);
                        toast.success("Lien FineoPay copié dans le presse-papier");
                      } catch {
                        toast.success("Lien FineoPay généré");
                      }
                      window.open(data.checkout_url, "_blank", "noopener,noreferrer");
                    }
                  } catch (e) {
                    toast.error(e.response?.data?.detail || "FineoPay indisponible");
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="w-full mt-2 py-2.5 border border-[#0A0A0A] bg-[#0A0A0A] text-white text-[0.65rem] uppercase tracking-[0.22em] hover:bg-[#0A0A0A]/85 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                data-testid="fineo-checkout-btn"
              >
                <ArrowDownToLine size={12} /> Générer un lien FineoPay
              </button>
              <p className="text-[0.6rem] text-[#0A0A0A]/45 mt-1.5 leading-snug">
                Crée un lien de paiement sécurisé à envoyer au client (carte / Orange Money / MTN / Moov / Wave). Le statut sera mis à jour automatiquement après paiement.
              </p>
            </div>
          )}

          {/* Status actions */}
          {!isCancelled && (
            <div className="border-t border-[#0A0A0A]/8 pt-5">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3">Cycle de vie</div>
              <div className="grid grid-cols-2 gap-2">
                {booking.status === "pending" && (
                  <button onClick={() => setStatus("confirmed")} disabled={busy} className="py-2 px-3 border border-[#B8922A]/40 text-[#B8922A] text-[0.65rem] uppercase tracking-[0.22em] hover:bg-[#B8922A]/5" data-testid="status-confirm-btn">
                    Confirmer
                  </button>
                )}
                {["pending", "confirmed"].includes(booking.status) && (
                  <button onClick={() => setStatus("arrived")} disabled={busy} className="py-2 px-3 border border-green-300 text-green-700 text-[0.65rem] uppercase tracking-[0.22em] hover:bg-green-50" data-testid="status-arrived-btn">
                    Client arrivé
                  </button>
                )}
                {["arrived", "confirmed"].includes(booking.status) && (
                  <button onClick={() => setStatus("completed")} disabled={busy} className="py-2 px-3 border border-blue-300 text-blue-700 text-[0.65rem] uppercase tracking-[0.22em] hover:bg-blue-50" data-testid="status-complete-btn">
                    Terminer
                  </button>
                )}
                <button onClick={() => setStatus("cancelled")} disabled={busy} className="py-2 px-3 border border-red-200 text-red-600 text-[0.65rem] uppercase tracking-[0.22em] hover:bg-red-50" data-testid="status-cancel-btn">
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Communication + paid management */}
          <div className="border-t border-[#0A0A0A]/8 pt-5 space-y-2">
            <button onClick={sendQr} disabled={busy} className="w-full py-2.5 border border-[#0A0A0A]/15 text-[#0A0A0A]/75 text-[0.65rem] uppercase tracking-[0.22em] hover:border-[#B8922A] hover:text-[#B8922A] inline-flex items-center justify-center gap-2">
              <Send size={12} /> Renvoyer QR / Reçu
            </button>
            {isPaid && (
              <button onClick={markUnpaid} disabled={busy} className="w-full py-2.5 border border-red-200 text-red-600 text-[0.65rem] uppercase tracking-[0.22em] hover:bg-red-50 inline-flex items-center justify-center gap-2" data-testid="mark-unpaid-btn">
                <XCircle size={12} /> Annuler le paiement
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default function StaffPayments() {
  const [pole, setPole] = useState("");
  const [period, setPeriod] = useState("30d");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("unpaid"); // unpaid | paid
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawerBooking, setDrawerBooking] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchSummary = useCallback(() => {
    setLoading(true);
    const params = {};
    if (pole) params.pole = pole;
    if (period) params.period = period;
    api.get("/staff/payments/summary", { params })
      .then((r) => setData(r.data))
      .catch((e) => {
        if (e.response?.status === 403) toast.error("Accès refusé");
        else toast.error("Erreur de chargement");
      })
      .finally(() => setLoading(false));
  }, [pole, period]);

  useEffect(() => { fetchSummary(); }, [fetchSummary, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  if (loading && !data) return <div className="p-10 text-[#0A0A0A]/50">Chargement…</div>;
  if (!data) return <div className="p-10 text-red-600">Impossible de charger les paiements.</div>;

  const methods = data.by_method || {};
  const unpaid = data.unpaid || [];
  const paid = data.recent_paid || [];
  const filteredUnpaid = !search ? unpaid : unpaid.filter((b) => {
    const s = search.toLowerCase();
    const name = ((b.participants && b.participants[0]) || {});
    return (
      (b.offer_name || "").toLowerCase().includes(s) ||
      (b.phone || "").toLowerCase().includes(s) ||
      (b.email || "").toLowerCase().includes(s) ||
      (name.surname || "").toLowerCase().includes(s) ||
      (name.name || "").toLowerCase().includes(s) ||
      b.id.toLowerCase().includes(s)
    );
  });
  const filteredPaid = !search ? paid : paid.filter((b) => {
    const s = search.toLowerCase();
    const name = ((b.participants && b.participants[0]) || {});
    return (
      (b.offer_name || "").toLowerCase().includes(s) ||
      (b.phone || "").toLowerCase().includes(s) ||
      (name.surname || "").toLowerCase().includes(s) ||
      (name.name || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-payments">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] inline-flex items-center gap-3">
            <Wallet size={26} className="text-[#B8922A]" /> Paiements
          </h1>
          <p className="text-sm text-[#0A0A0A]/55 mt-1">Suivi des encaissements et confirmations clients</p>
        </div>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-red-200 p-4" data-testid="kpi-unpaid">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.6rem] uppercase tracking-[0.22em] text-red-700">Impayés</span>
            <AlertCircle size={14} className="text-red-700" />
          </div>
          <div className="font-display-serif text-2xl text-[#0A0A0A]">{data.unpaid_count}</div>
          <div className="text-[0.7rem] text-[#0A0A0A]/55 mt-1">{formatXOF(data.unpaid_total)} en attente</div>
        </div>
        <div className="bg-white border border-green-200 p-4" data-testid="kpi-today">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.6rem] uppercase tracking-[0.22em] text-green-700">Encaissé aujourd'hui</span>
            <CheckCircle2 size={14} className="text-green-700" />
          </div>
          <div className="font-display-serif text-2xl text-[#0A0A0A]">{formatXOF(data.today_revenue || 0)}</div>
          <div className="text-[0.7rem] text-[#0A0A0A]/55 mt-1">{data.today_paid_count || 0} paiement{(data.today_paid_count || 0) > 1 ? "s" : ""}</div>
        </div>
        <div className="bg-white border border-[#B8922A]/30 p-4" data-testid="kpi-period">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Sur la période</span>
            <Wallet size={14} className="text-[#B8922A]" />
          </div>
          <div className="font-display-serif text-2xl text-[#0A0A0A]">{formatXOF(data.paid_total)}</div>
          <div className="text-[0.7rem] text-[#0A0A0A]/55 mt-1">{data.paid_count} paiements</div>
        </div>
        <div className="bg-white border border-[#0A0A0A]/8 p-4 flex items-center justify-center text-center" data-testid="kpi-period-selector">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-2">Période</div>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="border border-[#0A0A0A]/15 px-3 py-1.5 text-sm focus:border-[#B8922A] outline-none bg-white" data-testid="period-select">
              <option value="today">Aujourd'hui</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
              <option value="90d">90 jours</option>
              <option value="all">Tout</option>
            </select>
          </div>
        </div>
      </div>

      {/* By-method breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {PAYMENT_METHODS.map((m) => (
          <MethodKpi key={m.id} method={m} count={methods[m.id]?.count || 0} total={methods[m.id]?.total || 0} />
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, téléphone, email, ID…"
            className="w-full pl-9 pr-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white"
            data-testid="payments-search"
          />
        </div>
        <div className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">
          <Filter size={12} /> Pôle
        </div>
        <select value={pole} onChange={(e) => setPole(e.target.value)} className="border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none bg-white" data-testid="payments-pole-filter">
          <option value="">Tous</option>
          {Object.entries(POLE_LABEL).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      {/* View toggle */}
      <div className="border-b border-[#0A0A0A]/10 flex gap-1 mb-4" data-testid="payments-view-toggle">
        <button onClick={() => setView("unpaid")} className={`px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] border-b-2 -mb-px ${view === "unpaid" ? "border-[#B8922A] text-[#B8922A] font-medium" : "border-transparent text-[#0A0A0A]/55 hover:text-[#0A0A0A]"}`} data-testid="view-unpaid">
          Impayés ({data.unpaid_count})
        </button>
        <button onClick={() => setView("paid")} className={`px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] border-b-2 -mb-px ${view === "paid" ? "border-[#B8922A] text-[#B8922A] font-medium" : "border-transparent text-[#0A0A0A]/55 hover:text-[#0A0A0A]"}`} data-testid="view-paid">
          Récemment payés
        </button>
      </div>

      {/* Booking list */}
      {view === "unpaid" ? (
        filteredUnpaid.length === 0 ? (
          <p className="text-sm text-[#0A0A0A]/45 py-12 text-center">{unpaid.length === 0 ? "Aucun impayé en attente." : "Aucun résultat pour cette recherche."}</p>
        ) : (
          <div className="bg-white border border-[#0A0A0A]/8 overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]" data-testid="unpaid-table">
              <thead className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 bg-[#FAFAF7]">
                <tr>
                  <th className="text-left py-3 px-4">Client</th>
                  <th className="text-left py-3 px-4">Offre / Pôle</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-right py-3 px-4">Montant</th>
                  <th className="text-left py-3 px-4">Statut</th>
                  <th className="text-right py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnpaid.map((b) => {
                  const primary = (b.participants && b.participants[0]) || {};
                  const guestName = primary.surname || primary.name
                    ? `${primary.surname || ""} ${primary.name || ""}`.trim()
                    : b.phone || "—";
                  return (
                    <tr key={b.id} className="border-t border-[#0A0A0A]/5 hover:bg-[#FAFAF7]/60" data-testid={`unpaid-row-${b.id.slice(0,8)}`}>
                      <td className="py-3 px-4">
                        <div className="text-[#0A0A0A] truncate">{guestName}</div>
                        <div className="text-[0.65rem] text-[#0A0A0A]/55">{b.phone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[#0A0A0A]/80 truncate">{b.offer_name}</div>
                        <div className="mt-1"><PoleBadge pole={b.pole} /></div>
                      </td>
                      <td className="py-3 px-4 text-[#0A0A0A]/75 tabular-nums whitespace-nowrap">{fmtDateFR(b.date)} {b.boat_time && <span className="text-[#0A0A0A]/45">· {b.boat_time}</span>}</td>
                      <td className="py-3 px-4 text-right font-medium text-[#B8922A] tabular-nums whitespace-nowrap">{formatXOF(b.total_amount || 0)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[0.55rem] uppercase tracking-[0.18em] px-1.5 py-0.5 border ${STATUS_COLOR[b.status]}`}>{STATUS_FR[b.status]}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => setDrawerBooking(b)} className="inline-flex items-center gap-1 px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.22em] bg-[#B8922A] text-white hover:bg-[#a37e1f]" data-testid={`pay-btn-${b.id.slice(0,8)}`}>
                          Encaisser <ChevronRight size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        filteredPaid.length === 0 ? (
          <p className="text-sm text-[#0A0A0A]/45 py-12 text-center">Aucun paiement enregistré sur cette période.</p>
        ) : (
          <div className="bg-white border border-[#0A0A0A]/8 overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]" data-testid="paid-table">
              <thead className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 bg-[#FAFAF7]">
                <tr>
                  <th className="text-left py-3 px-4">Client</th>
                  <th className="text-left py-3 px-4">Offre / Pôle</th>
                  <th className="text-left py-3 px-4">Méthode</th>
                  <th className="text-left py-3 px-4">Payé le</th>
                  <th className="text-right py-3 px-4">Montant</th>
                  <th className="text-right py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPaid.map((b) => {
                  const primary = (b.participants && b.participants[0]) || {};
                  const guestName = primary.surname || primary.name
                    ? `${primary.surname || ""} ${primary.name || ""}`.trim()
                    : b.phone || "—";
                  return (
                    <tr key={b.id} className="border-t border-[#0A0A0A]/5 hover:bg-[#FAFAF7]/60" data-testid={`paid-row-${b.id.slice(0,8)}`}>
                      <td className="py-3 px-4">
                        <div className="text-[#0A0A0A] truncate">{guestName}</div>
                        <div className="text-[0.65rem] text-[#0A0A0A]/55">{b.phone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[#0A0A0A]/80 truncate">{b.offer_name}</div>
                        <div className="mt-1"><PoleBadge pole={b.pole} /></div>
                      </td>
                      <td className="py-3 px-4 text-[#0A0A0A]/75 whitespace-nowrap">{METHOD_LABEL[b.payment_method] || b.payment_method || "—"}</td>
                      <td className="py-3 px-4 text-[0.72rem] text-[#0A0A0A]/65 whitespace-nowrap">{fmtDateTimeFR(b.paid_at)}</td>
                      <td className="py-3 px-4 text-right font-medium tabular-nums whitespace-nowrap">{formatXOF(b.total_amount || 0)}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => setDrawerBooking(b)} className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] hover:underline" data-testid={`view-btn-${b.id.slice(0,8)}`}>
                          Détails
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {drawerBooking && (
        <ActionDrawer
          booking={drawerBooking}
          onClose={() => setDrawerBooking(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { toast } from "sonner";
import {
  CalendarDays,
  List as ListIcon,
  Search,
  X,
  CheckCircle2,
  XCircle,
  Ticket as TicketIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const STATUS_FR = {
  pending: "En attente",
  confirmed: "Confirmée",
  arrived: "Arrivée",
  completed: "Terminée",
  cancelled: "Annulée",
};
const STATUS_COLORS = {
  pending: "bg-[#FAFAF7] text-[#0A0A0A]/55 border-[#0A0A0A]/15",
  confirmed: "bg-[#B8922A]/10 text-[#B8922A] border-[#B8922A]/30",
  arrived: "bg-green-50 text-green-700 border-green-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};
const OFFER_DOT = {
  pass_day: "bg-[#B8922A]",
  sunset: "bg-orange-500",
  brunch: "bg-green-600",
  le_kaai: "bg-purple-500",
  hebergement: "bg-blue-600",
  spa_wellness: "bg-pink-500",
  seminaire: "bg-slate-600",
  team_building: "bg-slate-500",
  offres_loisirs: "bg-cyan-500",
  special_event: "bg-rose-600",
};

const POLE_LABEL = {
  beach_club: "Beach Club",
  hebergement: "Hébergement",
  corporate: "Corporate",
  activites_events: "Activités & Événements",
  le_kaai: "Le Kaai",
};
const POLE_COLOR = {
  beach_club: "text-[#B8922A] border-[#B8922A]/40 bg-[#B8922A]/5",
  hebergement: "text-blue-700 border-blue-300 bg-blue-50",
  corporate: "text-slate-700 border-slate-300 bg-slate-50",
  activites_events: "text-rose-700 border-rose-300 bg-rose-50",
  le_kaai: "text-purple-700 border-purple-300 bg-purple-50",
};

const PAYMENT_METHOD_FR = {
  cash: "Espèces",
  card: "Carte bancaire",
  mobile_money: "Mobile Money",
  fineo: "FINEO",
  deposit: "Acompte",
};

const POLE_TABS = [
  { id: "all", label: "Toutes", filter: null },
  { id: "beach_club", label: "Beach Club", filter: "beach_club" },
  { id: "hebergement", label: "Hébergement", filter: "hebergement" },
  { id: "corporate", label: "Corporate", filter: "corporate" },
  { id: "activites_events", label: "Activités & Événements", filter: "activites_events" },
  { id: "le_kaai", label: "Le Kaai", filter: "le_kaai" },
];

function PoleBadge({ pole }) {
  if (!pole) return null;
  const label = POLE_LABEL[pole] || pole;
  const color = POLE_COLOR[pole] || "text-[#0A0A0A]/55 border-[#0A0A0A]/15 bg-[#FAFAF7]";
  return (
    <span className={`text-[0.55rem] uppercase tracking-[0.18em] px-1.5 py-0.5 border rounded-sm whitespace-nowrap ${color}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`text-[0.6rem] uppercase tracking-[0.18em] px-2 py-0.5 border whitespace-nowrap ${STATUS_COLORS[status] || STATUS_COLORS.pending}`}>
      {STATUS_FR[status] || status}
    </span>
  );
}

function PaymentBadge({ booking }) {
  const paid = !!booking.paid_at;
  if (paid) {
    return <span className="text-[0.6rem] uppercase tracking-[0.18em] px-2 py-0.5 border bg-green-50 text-green-700 border-green-200">Payé</span>;
  }
  if (booking.total_amount === 0) {
    return <span className="text-[0.6rem] uppercase tracking-[0.18em] px-2 py-0.5 border bg-[#FAFAF7] text-[#0A0A0A]/55 border-[#0A0A0A]/15">Sur réservation</span>;
  }
  return <span className="text-[0.6rem] uppercase tracking-[0.18em] px-2 py-0.5 border bg-red-50 text-red-700 border-red-200">Impayé</span>;
}

// ------------------ List view ------------------
function BookingsList({ bookings, onOpen }) {
  if (bookings.length === 0) {
    return <p className="text-sm text-[#0A0A0A]/45 py-12 text-center">Aucune réservation pour ces filtres.</p>;
  }
  return (
    <table className="w-full text-sm" data-testid="bookings-table">
      <thead>
        <tr className="text-left text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
          <th className="py-3 px-3">Date</th>
          <th className="py-3 px-3">Heure</th>
          <th className="py-3 px-3">Client</th>
          <th className="py-3 px-3">Offre</th>
          <th className="py-3 px-3">Pers.</th>
          <th className="py-3 px-3 text-right">Total</th>
          <th className="py-3 px-3">Statut</th>
          <th className="py-3 px-3">Paiement</th>
          <th className="py-3 px-3"></th>
        </tr>
      </thead>
      <tbody>
        {bookings.map((b) => {
          const primary = b.participants?.[0];
          return (
            <tr
              key={b.id}
              onClick={() => onOpen(b.id)}
              className="border-b border-[#0A0A0A]/5 hover:bg-[#FAFAF7] cursor-pointer transition-colors"
              data-testid={`booking-${b.id.slice(0, 8)}`}
            >
              <td className="py-3 px-3 tabular-nums">{b.date}</td>
              <td className="py-3 px-3 tabular-nums text-[#B8922A]">{b.boat_time || "—"}</td>
              <td className="py-3 px-3">
                <div className="text-[#0A0A0A] font-medium">
                  {primary ? `${primary.surname} ${primary.name}` : (b.phone || "—")}
                </div>
                {b.phone && <div className="text-[0.7rem] text-[#0A0A0A]/45">{b.phone}</div>}
              </td>
              <td className="py-3 px-3">
                <span className="inline-flex items-center gap-2">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${OFFER_DOT[b.offer_type] || "bg-[#0A0A0A]/30"}`} />
                  {b.offer_name}
                </span>
                <div className="mt-1"><PoleBadge pole={b.pole} /></div>
              </td>
              <td className="py-3 px-3 tabular-nums">
                {b.adults}A{b.children > 0 ? ` · ${b.children}E` : ""}
              </td>
              <td className="py-3 px-3 text-right tabular-nums">{b.total_amount > 0 ? formatXOF(b.total_amount) : "—"}</td>
              <td className="py-3 px-3"><StatusBadge status={b.status} /></td>
              <td className="py-3 px-3"><PaymentBadge booking={b} /></td>
              <td className="py-3 px-3 text-right text-[0.7rem] text-[#B8922A]">Voir →</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ------------------ Calendar view ------------------
function BookingsCalendar({ month, onChangeMonth, byDate, onOpen }) {
  const [year, m] = month.split("-").map(Number);
  const firstDay = new Date(year, m - 1, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const monthLabel = firstDay.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const changeMonth = (delta) => {
    const nm = new Date(year, m - 1 + delta, 1);
    onChangeMonth(`${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, "0")}`);
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div data-testid="bookings-calendar">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-[#FAFAF7]" data-testid="cal-prev"><ChevronLeft size={16} /></button>
        <div className="font-display-serif text-2xl text-[#0A0A0A] capitalize">{monthLabel}</div>
        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-[#FAFAF7]" data-testid="cal-next"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 text-center pb-2">{d}</div>
        ))}
        {cells.map((d, idx) => {
          if (d === null) return <div key={`e-${idx}`} />;
          const iso = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dayBookings = byDate[iso] || [];
          const isToday = iso === today;
          return (
            <div
              key={iso}
              className={`min-h-[110px] border p-2 ${isToday ? "border-[#B8922A] bg-[#B8922A]/5" : "border-[#0A0A0A]/8 bg-white"}`}
              data-testid={`cal-day-${iso}`}
            >
              <div className="text-[0.7rem] tabular-nums text-[#0A0A0A]/60 mb-1">{d}</div>
              <div className="space-y-1">
                {dayBookings.slice(0, 4).map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onOpen(b.id)}
                    className="w-full text-left flex items-center gap-1.5 text-[0.65rem] leading-tight hover:opacity-80"
                  >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${OFFER_DOT[b.offer_type] || "bg-[#0A0A0A]/30"}`} />
                    <span className="truncate text-[#0A0A0A]/75">{b.boat_time || ""} · {b.adults + b.children}p</span>
                  </button>
                ))}
                {dayBookings.length > 4 && (
                  <div className="text-[0.6rem] text-[#B8922A]">+{dayBookings.length - 4}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------ Detail drawer ------------------
function BookingDrawer({ id, onClose, onUpdated }) {
  const [b, setB] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/staff/bookings/${id}`)
      .then((r) => setB(r.data))
      .catch(() => {
        toast.error("Impossible de charger cette réservation");
        onClose?.();
      });
  }, [id, onClose]);

  const setStatus = async (status) => {
    setBusy(true);
    try {
      await api.patch(`/staff/bookings/${id}/status`, { status });
      toast.success(`Statut → ${STATUS_FR[status]}`);
      const { data } = await api.get(`/staff/bookings/${id}`);
      setB(data);
      onUpdated?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setBusy(false);
    }
  };
  if (!id) return null;
  return (
    <div className="fixed inset-0 z-40" data-testid="booking-drawer">
      <div className="absolute inset-0 bg-[#0A0A0A]/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#0A0A0A]/10 px-6 py-4 flex items-center justify-between">
          <div className="text-[0.6rem] uppercase tracking-[0.28em] text-[#B8922A]">Détail réservation</div>
          <button onClick={onClose} className="hover:bg-[#FAFAF7] p-1" data-testid="drawer-close"><X size={16} /></button>
        </div>
        {!b ? (
          <p className="text-sm text-[#0A0A0A]/45 p-10 text-center">Chargement…</p>
        ) : (
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <h2 className="font-display-serif text-2xl text-[#0A0A0A]">{b.offer_name}</h2>
              <p className="text-sm text-[#0A0A0A]/55 mt-1">
                #{b.id.slice(0, 8).toUpperCase()} · Créée le {new Date(b.created_at).toLocaleString("fr-FR")}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <PoleBadge pole={b.pole} />
                <StatusBadge status={b.status} />
                <PaymentBadge booking={b} />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm border-y border-[#0A0A0A]/10 py-5">
              <div>
                <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Date</dt>
                <dd className="text-[#0A0A0A] font-medium mt-0.5">{b.date}{b.checkout_date ? ` → ${b.checkout_date}` : ""}{b.nights ? ` · ${b.nights} nuit${b.nights > 1 ? "s" : ""}` : ""}</dd>
              </div>
              <div>
                <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Bateau</dt>
                <dd className="text-[#0A0A0A] font-medium mt-0.5">{b.boat_time || "—"}</dd>
              </div>
              <div>
                <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Convives</dt>
                <dd className="text-[#0A0A0A] font-medium mt-0.5">{b.adults} adulte{b.adults > 1 ? "s" : ""}{b.children ? ` · ${b.children} enfant${b.children > 1 ? "s" : ""}` : ""}</dd>
              </div>
              <div>
                <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Total</dt>
                <dd className="text-[#0A0A0A] font-medium mt-0.5">{b.total_amount > 0 ? formatXOF(b.total_amount) : "Sur réservation"}</dd>
              </div>
              {b.payment_method === "deposit" && b.deposit_pct && (
                <div className="col-span-2 bg-[#FAFAF7] border border-[#B8922A]/30 p-3">
                  <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Acompte {b.deposit_pct}% versé</dt>
                  <dd className="text-sm text-[#0A0A0A] mt-1 flex justify-between">
                    <span>Payé en ligne&nbsp;: <span className="font-medium">{formatXOF(b.paid_amount || 0)}</span></span>
                    <span>Solde à l'arrivée&nbsp;: <span className="font-medium text-[#B8922A]">{formatXOF(b.balance_due || 0)}</span></span>
                  </dd>
                </div>
              )}
              {b.room_tier_name && (
                <div className="col-span-2">
                  <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Hébergement</dt>
                  <dd className="text-[#0A0A0A] font-medium mt-0.5">{b.rooms || 1} × {b.room_tier_name} ({formatXOF(b.room_tier_price)} / nuit)</dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Contact principal</dt>
                <dd className="text-[#0A0A0A] mt-0.5">
                  {b.phone} · {b.email}
                </dd>
              </div>
            </dl>

            <div>
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-2">
                Participants ({b.participants?.length || 0})
              </div>
              <ul className="space-y-2">
                {(b.participants || []).map((p, i) => (
                  <li key={i} className="text-sm bg-[#FAFAF7] p-3">
                    <div className="font-medium">{p.surname} {p.name} <span className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45 ml-2">{p.kind}</span></div>
                    <div className="text-[0.7rem] text-[#0A0A0A]/55 mt-0.5">{p.nationality} · {p.email} · {p.phone}</div>
                  </li>
                ))}
              </ul>
            </div>

            {b.special_requests && (
              <div>
                <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-2">Demandes spéciales</div>
                <p className="text-sm text-[#0A0A0A]/80 bg-[#FAFAF7] p-3">{b.special_requests}</p>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 border-t border-[#0A0A0A]/10 space-y-3">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-1">Actions</div>
              <div className="grid grid-cols-2 gap-2">
                {b.status === "pending" && (
                  <button onClick={() => setStatus("confirmed")} disabled={busy} className="px-4 py-2 bg-[#B8922A] hover:bg-[#9c7c1f] text-white text-xs uppercase tracking-[0.18em] inline-flex items-center justify-center gap-2" data-testid="action-confirm">
                    <CheckCircle2 size={13} /> Confirmer
                  </button>
                )}
                {b.status !== "completed" && b.status !== "cancelled" && (
                  <button onClick={() => setStatus("completed")} disabled={busy} className="px-4 py-2 border border-[#0A0A0A]/15 text-xs uppercase tracking-[0.18em] hover:border-[#B8922A]" data-testid="action-complete">
                    Terminer
                  </button>
                )}
                {b.status !== "cancelled" && (
                  <button onClick={() => setStatus("cancelled")} disabled={busy} className="px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50 text-xs uppercase tracking-[0.18em] inline-flex items-center justify-center gap-2" data-testid="action-cancel">
                    <XCircle size={13} /> Annuler
                  </button>
                )}
              </div>
              {!b.paid_at && b.total_amount > 0 && (
                <div className="border border-red-200 bg-red-50/60 p-3 text-[0.78rem] text-red-800" data-testid="payment-readonly-unpaid">
                  <div className="text-[0.6rem] uppercase tracking-[0.22em] mb-1">Paiement</div>
                  <div className="flex items-center justify-between">
                    <span>Impayé — à encaisser</span>
                    <Link to="/staff/paiements" className="text-[0.62rem] uppercase tracking-[0.22em] underline hover:no-underline" data-testid="payment-go-to-payments">
                      Gérer dans Paiements
                    </Link>
                  </div>
                </div>
              )}
              {b.paid_at && (
                <div className="border border-green-200 bg-green-50/60 p-3 text-[0.78rem] text-green-900" data-testid="payment-readonly-paid">
                  <div className="text-[0.6rem] uppercase tracking-[0.22em] mb-1">Paiement encaissé</div>
                  <dl className="space-y-1">
                    <div className="flex justify-between">
                      <dt>Méthode</dt>
                      <dd className="font-medium">{PAYMENT_METHOD_FR[b.payment_method] || b.payment_method || "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Montant payé</dt>
                      <dd className="font-medium tabular-nums">{formatXOF(b.paid_amount || b.total_amount || 0)}</dd>
                    </div>
                    {b.balance_due > 0 && (
                      <div className="flex justify-between">
                        <dt>Solde restant</dt>
                        <dd className="font-medium tabular-nums text-[#B8922A]">{formatXOF(b.balance_due)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt>Encaissé le</dt>
                      <dd className="font-medium tabular-nums">{new Date(b.paid_at).toLocaleString("fr-FR")}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

// ------------------ Main page ------------------
export default function StaffReservations() {
  const [searchParams] = useSearchParams();
  const initialPole = searchParams.get("pole");
  const [view, setView] = useState("list"); // list | calendar
  const [tab, setTab] = useState(initialPole && POLE_TABS.find((t) => t.id === initialPole) ? initialPole : "all");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [bookings, setBookings] = useState([]);
  const [calendarData, setCalendarData] = useState({ by_date: {} });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const poleFilter = useMemo(() => {
    const t = POLE_TABS.find((x) => x.id === tab);
    return t?.filter && t.filter !== "__payments__" ? t.filter : null;
  }, [tab]);

  useEffect(() => {
    if (tab === "payments") return;
    setLoading(true);
    const params = {};
    if (poleFilter) params.pole = poleFilter;
    if (status) params.status = status;
    if (paymentStatus) params.payment_status = paymentStatus;
    if (search) params.search = search;
    const url = view === "list" ? "/staff/bookings" : `/staff/bookings/calendar?month=${month}`;
    const config = view === "list" ? { params } : {};
    api.get(url, config)
      .then((r) => {
        if (view === "list") setBookings(r.data);
        else setCalendarData(r.data);
      })
      .catch((e) => {
        const code = e.response?.status;
        if (code === 403) toast.error("Accès refusé — droits insuffisants");
        else toast.error("Erreur de chargement des réservations");
      })
      .finally(() => setLoading(false));
  }, [view, tab, poleFilter, status, paymentStatus, search, month, refreshKey]);

  const refresh = () => setRefreshKey((x) => x + 1);

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-reservations">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A]">Réservations</h1>
          <p className="text-sm text-[#0A0A0A]/55 mt-1">Pipeline complet des réservations</p>
        </div>
        <Link
          to="/staff/reservations/nouvelle"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] bg-[#B8922A] text-white hover:bg-[#a37e1f] transition-all self-start sm:self-auto"
          data-testid="newbooking-cta"
        >
          + Nouvelle réservation
        </Link>
      </div>

      {/* Pôle tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#0A0A0A]/10 mb-6" data-testid="reservation-tabs">
        {POLE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-[#B8922A] text-[#B8922A] font-medium" : "border-transparent text-[#0A0A0A]/55 hover:text-[#0A0A0A]"
            }`}
            data-testid={`tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, téléphone, email…"
            className="w-full border border-[#0A0A0A]/15 pl-9 pr-3 py-2 text-sm focus:border-[#B8922A] outline-none"
            data-testid="reservations-search"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none" data-testid="filter-status">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_FR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none" data-testid="filter-payment">
          <option value="">Tous paiements</option>
          <option value="paid">Payé</option>
          <option value="unpaid">Impayé</option>
        </select>
        <div className="flex border border-[#0A0A0A]/15 ml-auto">
          <button onClick={() => setView("list")} className={`px-3 py-2 inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.18em] ${view === "list" ? "bg-[#B8922A] text-white" : "text-[#0A0A0A]/55 hover:text-[#0A0A0A]"}`} data-testid="view-list">
            <ListIcon size={12} /> Liste
          </button>
          <button onClick={() => setView("calendar")} className={`px-3 py-2 inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.18em] ${view === "calendar" ? "bg-[#B8922A] text-white" : "text-[#0A0A0A]/55 hover:text-[#0A0A0A]"}`} data-testid="view-calendar">
            <CalendarDays size={12} /> Calendrier
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6">
        {loading ? (
          <p className="text-sm text-[#0A0A0A]/45 py-12 text-center">Chargement…</p>
        ) : view === "list" ? (
          <BookingsList bookings={bookings} onOpen={setOpenId} />
        ) : (
          <BookingsCalendar month={month} onChangeMonth={setMonth} byDate={calendarData.by_date} onOpen={setOpenId} />
        )}
      </div>

      <BookingDrawer id={openId} onClose={() => setOpenId(null)} onUpdated={refresh} />
    </div>
  );
}

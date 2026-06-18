/**
 * Staff Events Pipeline — Revenue Engine Phase B.
 *
 * Kanban view over the existing ``event_requests`` collection
 * (privatisations + événements corporate + soirées privées).
 *
 * Columns map to the status workflow:
 *   new → contacted → confirmed → completed
 *           ↓
 *        declined  (terminal lane on the right)
 *
 * Each card shows : nom client, type d'événement, date prévue, guests,
 * montant estimé (si fourni), age (jours en colonne).
 * Click → opens a side drawer with full details + "Move" actions +
 * notes + payments history (re-use existing GET endpoint).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Megaphone, Users, CalendarDays, ChevronRight, X,
  Mail, Phone, RefreshCw, Wallet, Building2, Sparkles, Search,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const COLUMNS = [
  { id: "new",       label: "Nouvelles",  color: "#E1306C", bg: "#FCE7F3" },
  { id: "contacted", label: "Contactées", color: "#1F8FFF", bg: "#DBEAFE" },
  { id: "confirmed", label: "Confirmées", color: "#B8922A", bg: "#FAF3E1" },
  { id: "completed", label: "Réalisées",  color: "#16A34A", bg: "#DCFCE7" },
  { id: "declined",  label: "Déclinées",  color: "#9CA3AF", bg: "#F3F4F6" },
];

const NEXT_STATUS = {
  new: "contacted",
  contacted: "confirmed",
  confirmed: "completed",
};

const NEXT_LABEL = {
  new: "Marquer contactée",
  contacted: "Confirmer",
  confirmed: "Marquer réalisée",
};

export default function StaffEventsPipeline() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [movingId, setMovingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/staff/loisirs/events");
      setItems(data.items || []);
    } catch {
      toast.error("Impossible de charger le pipeline événementiel");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const filtered = q.trim()
      ? items.filter((e) => {
          const s = q.toLowerCase();
          return [e.name, e.surname, e.email, e.phone, e.event_type, e.company]
            .filter(Boolean).some((v) => v.toLowerCase().includes(s));
        })
      : items;
    const map = Object.fromEntries(COLUMNS.map((c) => [c.id, []]));
    filtered.forEach((e) => {
      const key = e.status || "new";
      if (map[key]) map[key].push(e);
      else map.new.push(e); // fallback
    });
    return map;
  }, [items, q]);

  const totals = useMemo(() => ({
    pipeline: items.reduce((s, e) => s + (e.budget_estimate || 0), 0),
    confirmed: items.filter((e) => e.status === "confirmed")
                    .reduce((s, e) => s + (e.budget_estimate || 0), 0),
  }), [items]);

  async function moveTo(event, next) {
    setMovingId(event.id);
    try {
      await api.patch(`/staff/loisirs/events/${event.id}`, { status: next });
      toast.success(`Déplacé vers : ${COLUMNS.find((c) => c.id === next)?.label}`);
      setItems((prev) => prev.map((i) => (i.id === event.id ? { ...i, status: next } : i)));
      if (selected?.id === event.id) setSelected({ ...selected, status: next });
    } catch {
      toast.error("Déplacement impossible");
    } finally {
      setMovingId(null);
    }
  }

  async function decline(event) {
    setMovingId(event.id);
    try {
      await api.patch(`/staff/loisirs/events/${event.id}`, { status: "declined" });
      toast.info("Demande déclinée");
      setItems((prev) => prev.map((i) => (i.id === event.id ? { ...i, status: "declined" } : i)));
      if (selected?.id === event.id) setSelected({ ...selected, status: "declined" });
    } catch {
      toast.error("Déclinaison impossible");
    } finally {
      setMovingId(null);
    }
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-5" data-testid="staff-events-pipeline">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-2">
            Revenue Engine · Phase B
          </div>
          <h1 className="font-serif italic font-light text-3xl md:text-5xl leading-tight">
            Pipeline événementiel
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
            Privatisations, séminaires, soirées privées — du premier contact à l'événement réalisé.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-[#0A0A0A]/15 px-3 bg-white">
            <Search size={14} className="text-[#0A0A0A]/40" />
            <input
              placeholder="Rechercher…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="py-2 text-sm bg-transparent focus:outline-none w-56"
              data-testid="events-search"
            />
          </div>
          <button
            onClick={load}
            className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] transition-colors"
            data-testid="events-refresh-btn"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="events-pipeline-kpis">
        {COLUMNS.map((c) => (
          <div
            key={c.id}
            className="bg-white border border-[#0A0A0A]/10 p-4"
            data-testid={`events-kpi-${c.id}`}
          >
            <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: c.color }}>
              {c.label}
            </div>
            <div className="font-serif italic text-2xl tabular-nums">
              {grouped[c.id]?.length || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3" data-testid="events-board">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            column={col}
            events={grouped[col.id] || []}
            onSelect={setSelected}
            selectedId={selected?.id}
            loading={loading}
          />
        ))}
      </div>

      {/* Drawer */}
      {selected && (
        <Drawer
          event={selected}
          onClose={() => setSelected(null)}
          onMove={moveTo}
          onDecline={decline}
          moving={movingId === selected.id}
        />
      )}
    </div>
  );
}

function Column({ column, events, onSelect, selectedId, loading }) {
  return (
    <div
      className="rounded-sm border border-[#0A0A0A]/8 bg-[#FAFAFA] flex flex-col min-h-[420px]"
      data-testid={`events-col-${column.id}`}
    >
      <header
        className="px-3 py-2.5 border-b border-[#0A0A0A]/8 flex items-center justify-between"
        style={{ background: column.bg }}
      >
        <span
          className="text-[10px] tracking-[0.3em] uppercase font-medium"
          style={{ color: column.color }}
        >
          {column.label}
        </span>
        <span className="text-xs font-medium" style={{ color: column.color }}>
          {events.length}
        </span>
      </header>
      <div className="flex-1 p-2 space-y-2 max-h-[640px] overflow-y-auto">
        {loading ? (
          <div className="text-center text-xs text-[#0A0A0A]/40 py-8">Chargement…</div>
        ) : events.length === 0 ? (
          <div className="text-center text-xs text-[#0A0A0A]/40 py-8 italic">Aucune demande</div>
        ) : (
          events.map((e) => (
            <Card
              key={e.id}
              event={e}
              active={selectedId === e.id}
              accent={column.color}
              onClick={() => onSelect(e)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Card({ event, active, accent, onClick }) {
  const fullName = `${event.surname || ""} ${event.name || ""}`.trim() || event.email;
  const day = event.event_date
    ? new Date(event.event_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
    : null;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white p-3 border ${
        active ? "border-[#B8922A] ring-1 ring-[#B8922A]/30" : "border-[#0A0A0A]/8"
      } hover:border-[#B8922A]/60 transition-colors`}
      data-testid={`event-card-${event.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[10px] tracking-wider uppercase truncate" style={{ color: accent }}>
          {event.event_type || "Événement"}
        </span>
        {day && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#0A0A0A]/55">
            <CalendarDays size={10} />{day}
          </span>
        )}
      </div>
      <div className="text-sm font-medium text-[#0A0A0A] truncate">{fullName}</div>
      {event.company && (
        <div className="text-xs text-[#0A0A0A]/55 truncate flex items-center gap-1 mt-0.5">
          <Building2 size={10} />{event.company}
        </div>
      )}
      <div className="flex items-center justify-between mt-2 text-[10px] text-[#0A0A0A]/55">
        <span className="inline-flex items-center gap-1">
          <Users size={10} />{event.guest_count || "—"} convives
        </span>
        {event.budget_estimate ? (
          <span className="tabular-nums text-[#B8922A]">
            {Number(event.budget_estimate).toLocaleString("fr-FR")}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function Drawer({ event, onClose, onMove, onDecline, moving }) {
  const fullName = `${event.surname || ""} ${event.name || ""}`.trim() || event.email;
  const next = NEXT_STATUS[event.status];
  const totalPaid = (event.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end" data-testid="events-drawer">
      <button
        className="flex-1 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fermer"
      />
      <aside className="w-full max-w-md bg-white shadow-2xl flex flex-col">
        <header className="flex items-start justify-between p-6 border-b border-[#0A0A0A]/10">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1">
              {event.event_type || "Événement"}
            </div>
            <h2 className="font-serif italic text-2xl">{fullName}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-[#0A0A0A]/55 hover:text-[#0A0A0A]" data-testid="events-drawer-close">
            <X size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="space-y-2 text-sm">
            <a href={`mailto:${event.email}`} className="flex items-center gap-2 hover:text-[#B8922A]">
              <Mail size={14} />{event.email}
            </a>
            {event.phone && (
              <a href={`tel:${event.phone}`} className="flex items-center gap-2 hover:text-[#B8922A]">
                <Phone size={14} />{event.phone}
              </a>
            )}
            {event.company && (
              <div className="flex items-center gap-2 text-[#0A0A0A]/70">
                <Building2 size={14} />{event.company}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Tile label="Date" value={event.event_date || "—"} />
            <Tile label="Convives" value={event.guest_count || "—"} />
            <Tile label="Budget estimé"
              value={event.budget_estimate
                ? `${Number(event.budget_estimate).toLocaleString("fr-FR")} XOF`
                : "—"} />
            <Tile label="Payé"
              value={totalPaid
                ? `${totalPaid.toLocaleString("fr-FR")} XOF`
                : "—"}
              accent={!!totalPaid} />
          </div>

          {event.notes && (
            <div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-2">
                Notes équipe
              </div>
              <p className="text-sm whitespace-pre-wrap text-[#0A0A0A]/85 bg-[#FAF7F2] p-3">
                {event.notes}
              </p>
            </div>
          )}

          {event.message && (
            <div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-2">
                Demande du client
              </div>
              <p className="text-sm whitespace-pre-wrap text-[#0A0A0A]/85">{event.message}</p>
            </div>
          )}

          {event.payments && event.payments.length > 0 && (
            <div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-2 flex items-center gap-2">
                <Wallet size={12} />Historique paiements
              </div>
              <ul className="space-y-1 text-sm">
                {event.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between border-b border-[#0A0A0A]/5 pb-1">
                    <span>{p.receipt_number}</span>
                    <span className="tabular-nums font-medium">
                      {Number(p.amount).toLocaleString("fr-FR")} XOF
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <footer className="p-6 border-t border-[#0A0A0A]/10 space-y-2">
          {next && (
            <button
              disabled={moving}
              onClick={() => onMove(event, next)}
              className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#0A0A0A] text-white text-[0.7rem] tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors disabled:opacity-50"
              data-testid="events-drawer-advance"
            >
              {NEXT_LABEL[event.status]}
              <ChevronRight size={13} />
            </button>
          )}
          {event.status !== "declined" && event.status !== "completed" && (
            <button
              disabled={moving}
              onClick={() => onDecline(event)}
              className="w-full py-3 border border-[#0A0A0A]/15 text-[#0A0A0A]/65 text-[0.7rem] tracking-[0.3em] uppercase hover:border-red-300 hover:text-red-700 transition-colors disabled:opacity-50"
              data-testid="events-drawer-decline"
            >
              Décliner
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

function Tile({ label, value, accent }) {
  return (
    <div className={`p-3 border ${accent ? "border-[#B8922A] bg-[#FAF3E1]" : "border-[#0A0A0A]/10 bg-[#FAF7F2]"}`}>
      <div className="text-[9px] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

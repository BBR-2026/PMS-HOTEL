import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

/**
 * In-dashboard notifications bell — polls `/staff/notifications/new-bookings`
 * every 30s. Shows a badge with the count of bookings created since the user
 * last opened the dropdown, plus a toast when a new booking arrives.
 *
 * Last-seen timestamp is persisted in localStorage so unread state survives
 * full page reloads (but not user logout — handled by `staff:lastSeenAt`).
 */
const LS_KEY = "staff:lastSeenBookingAt";
const POLL_INTERVAL_MS = 30_000;

const fmtXOF = (n) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " FCFA";

const fmtRelativeTime = (iso) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

export default function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => localStorage.getItem(LS_KEY) || null);
  const lastSeenRef = useRef(lastSeen);
  const knownIdsRef = useRef(new Set());
  const dropdownRef = useRef(null);

  // Keep the ref in sync so the interval callback always reads the latest cursor.
  useEffect(() => { lastSeenRef.current = lastSeen; }, [lastSeen]);

  const poll = useCallback(async () => {
    try {
      const since = lastSeenRef.current || "";
      const { data } = await api.get(
        `/staff/notifications/new-bookings${since ? `?since=${encodeURIComponent(since)}` : ""}`,
      );
      const incoming = data?.items || [];
      // Detect brand-new bookings (not seen before in this session)
      const fresh = incoming.filter((b) => !knownIdsRef.current.has(b.id));
      fresh.forEach((b) => knownIdsRef.current.add(b.id));
      // Toast for every fresh booking (but only when we already had a cursor —
      // skip the initial load to avoid spamming on mount).
      if (since && fresh.length > 0) {
        fresh.slice(0, 3).forEach((b) => {
          toast.success(`Nouvelle réservation · ${b.label}`, {
            description: `${b.booker} · ${b.guests_total} pers · ${fmtXOF(b.total_amount)}`,
            duration: 6000,
          });
        });
      }
      setItems(incoming);
    } catch {
      // silent — bell is best-effort
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = items.length;

  const markAllSeen = () => {
    if (items.length > 0) {
      const latest = items[0].created_at;
      localStorage.setItem(LS_KEY, latest);
      setLastSeen(latest);
      setItems([]);
    }
  };

  const handleOpen = () => {
    setOpen((o) => {
      const next = !o;
      if (next) markAllSeen();
      return next;
    });
  };

  return (
    <div className="relative" ref={dropdownRef} data-testid="notifications-bell-wrapper">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative p-2 rounded-full hover:bg-[#B8922A]/10 text-[#0A0A0A]/70 hover:text-[#B8922A] transition-colors"
        data-testid="notifications-bell-btn"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B8922A] text-white text-[0.6rem] font-semibold flex items-center justify-center leading-none"
            data-testid="notifications-bell-badge"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[20rem] sm:w-[24rem] max-h-[28rem] bg-white border border-[#0A0A0A]/10 shadow-xl z-50 overflow-hidden"
          data-testid="notifications-dropdown"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#0A0A0A]/8 bg-[#FAFAF7]">
            <div className="font-display-serif text-base text-[#0A0A0A]">Nouvelles réservations</div>
            <button onClick={() => setOpen(false)} className="text-[#0A0A0A]/50 hover:text-[#0A0A0A]" aria-label="Fermer">
              <X size={14} />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[24rem]" data-testid="notifications-list">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#0A0A0A]/45">
                Aucune nouvelle réservation.
              </div>
            ) : (
              items.map((b) => (
                <Link
                  key={b.id}
                  to={`/staff/reservations?id=${b.id}`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 border-b border-[#0A0A0A]/5 hover:bg-[#FAFAF7] transition-colors"
                  data-testid={`notification-item-${b.id}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display-serif text-sm text-[#0A0A0A] truncate">{b.label}</span>
                    <span className="text-[0.62rem] text-[#0A0A0A]/45 whitespace-nowrap">{fmtRelativeTime(b.created_at)}</span>
                  </div>
                  <div className="text-[0.72rem] text-[#0A0A0A]/65 mt-0.5 truncate">{b.booker}</div>
                  <div className="flex items-center justify-between mt-1 text-[0.7rem] text-[#0A0A0A]/55">
                    <span>{b.date} {b.boat_time ? `· ${b.boat_time}` : ""}</span>
                    <span className="tabular-nums text-[#B8922A] font-medium">{fmtXOF(b.total_amount)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="px-4 py-2 border-t border-[#0A0A0A]/8 bg-[#FAFAF7] text-right">
            <Link
              to="/staff/reservations"
              onClick={() => setOpen(false)}
              className="text-[0.65rem] uppercase tracking-[0.18em] text-[#B8922A] hover:text-[#9d7a23]"
              data-testid="notifications-see-all"
            >
              Voir toutes les réservations →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

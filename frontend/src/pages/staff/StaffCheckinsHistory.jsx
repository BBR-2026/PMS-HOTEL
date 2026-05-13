import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Anchor, Search, ChevronLeft, ChevronRight } from "lucide-react";

const DIRECTION_FR = { aller: "Aller", retour: "Retour" };

function formatDateTimeFR(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function formatDateFR(iso) {
  if (!iso || typeof iso !== "string") return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export default function StaffCheckinsHistory() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [boatTime, setBoatTime] = useState("");
  const [direction, setDirection] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "50" });
    if (date) params.append("date", date);
    if (boatTime) params.append("boat_time", boatTime);
    if (direction) params.append("direction", direction);
    if (search) params.append("q", search);
    api.get(`/staff/checkins/history?${params}`)
      .then((r) => {
        setItems(r.data.items || []);
        setSummary(r.data.summary || []);
        setTotal(r.data.total || 0);
        setPages(r.data.pages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, date, boatTime, direction, search]);

  const reset = () => {
    setDate("");
    setBoatTime("");
    setDirection("");
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-checkins-history">
      <div className="mb-8">
        <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] inline-flex items-center gap-3">
          <Anchor size={26} className="text-[#B8922A]" /> Historique embarquements
        </h1>
        <p className="text-sm text-[#0A0A0A]/55 mt-1">
          Traçabilité de chaque scan ticket par bateau, par date et par heure.
        </p>
      </div>

      {/* Summary by boat (current filter) */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6" data-testid="checkins-summary">
          {summary.slice(0, 12).map((s, i) => (
            <div key={i} className="bg-white border border-[#0A0A0A]/8 p-3">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 truncate">{s.boat_label}</div>
              <div className="font-display-serif text-xl text-[#0A0A0A] mt-0.5">{s.count}</div>
              <div className="text-[0.65rem] text-[#0A0A0A]/45">{formatDateFR(s.boat_date)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-5 mb-6" data-testid="checkins-filters">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Recherche</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/40" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
                placeholder="Nom du client, du staff ou du skipper…"
                className="w-full pl-9 pr-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white"
                data-testid="checkins-search"
              />
            </div>
          </div>
          <div>
            <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white"
              data-testid="checkins-date"
            />
          </div>
          <div>
            <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Bateau</label>
            <input
              type="text"
              value={boatTime}
              onChange={(e) => { setBoatTime(e.target.value); setPage(1); }}
              placeholder="ex. 10H"
              className="w-24 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white"
              data-testid="checkins-boat"
            />
          </div>
          <button onClick={reset} className="px-4 py-2 text-[0.65rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/65 hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors" data-testid="checkins-reset">
            Réinitialiser
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="checkins-direction-tabs">
          {[["", "Tous"], ["aller", "Aller"], ["retour", "Retour"]].map(([id, label]) => (
            <button
              key={id || "all"}
              onClick={() => { setDirection(id); setPage(1); }}
              className={`px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.22em] border transition-all ${
                direction === id ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
              }`}
              data-testid={`checkins-direction-${id || "all"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#0A0A0A]/8 overflow-x-auto" data-testid="checkins-table">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="text-left text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10 bg-[#FAFAF7]">
              <th className="py-3 px-4">Date / Heure</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Sens</th>
              <th className="py-3 px-4">Bateau</th>
              <th className="py-3 px-4">Offre</th>
              <th className="py-3 px-4">Staff</th>
              <th className="py-3 px-4">Skipper</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#0A0A0A]/50">Chargement…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#0A0A0A]/50">Aucun embarquement pour ces filtres.</td></tr>
            ) : (
              items.map((s, i) => (
                <tr key={`${s.booking_id}-${s.qr_token}-${i}`} className="border-b border-[#0A0A0A]/5 hover:bg-[#FAFAF7]/50" data-testid={`checkin-row-${i}`}>
                  <td className="py-2.5 px-4 text-[0.78rem] text-[#0A0A0A]">{formatDateTimeFR(s.scanned_at)}</td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-[#0A0A0A]">{s.guest_surname} {s.guest_name}</div>
                    {(s.guest_phone || s.guest_email) && (
                      <div className="text-[0.68rem] text-[#0A0A0A]/55">{s.guest_phone || s.guest_email}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-block px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] border rounded-sm ${s.direction === "aller" ? "text-green-700 border-green-300 bg-green-50" : "text-blue-700 border-blue-300 bg-blue-50"}`}>
                      {DIRECTION_FR[s.direction] || s.direction}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-[#0A0A0A]">{s.boat_time || "—"}</div>
                    {s.boat_name && (
                      <div className="text-[0.68rem] text-[#B8922A]">{s.boat_name}</div>
                    )}
                    <div className="text-[0.68rem] text-[#0A0A0A]/55">{formatDateFR(s.boat_date)}</div>
                    {s.overridden && (
                      <span className="inline-block mt-0.5 text-[0.58rem] uppercase tracking-[0.18em] text-amber-700 border border-amber-300 bg-amber-50 px-1.5 py-0.5 rounded-sm" title={`Prévu : ${s.planned_boat_time || "—"}`}>
                        Modifié
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-[0.78rem] text-[#0A0A0A]/75">{s.offer_name || "—"}</td>
                  <td className="py-2.5 px-4 text-[0.78rem] text-[#0A0A0A]/75">
                    <div>{s.staff_name || s.staff_email?.split("@")[0] || "—"}</div>
                    {s.staff_email && <div className="text-[0.62rem] text-[#0A0A0A]/45">{s.staff_email}</div>}
                  </td>
                  <td className="py-2.5 px-4 text-[0.78rem] text-[#0A0A0A]/75" data-testid={`checkin-skipper-${i}`}>
                    {s.skipper_name || <span className="text-[#0A0A0A]/35">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="text-[0.72rem] text-[#0A0A0A]/55">Page {page} / {pages} · {total} embarquements</div>
          <div className="flex gap-1.5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] disabled:opacity-30" data-testid="checkins-prev"><ChevronLeft size={13} /></button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] disabled:opacity-30" data-testid="checkins-next"><ChevronRight size={13} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

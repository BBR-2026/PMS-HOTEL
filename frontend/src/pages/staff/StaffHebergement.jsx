import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { BedDouble, ChevronLeft, ChevronRight, LogIn, LogOut } from "lucide-react";

const TIER_COLORS = {
  superieure: "#B8922A",
  suite_jardin: "#16A34A",
  suite_mer: "#2563EB",
};

function ymOf(d) {
  return d.toISOString().slice(0, 7);
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return ymOf(d);
}

export default function StaffHebergement() {
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(today);
  const [calendar, setCalendar] = useState(null);
  const [today_, setToday_] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/staff/hebergement/calendar?month=${month}`),
      api.get(`/staff/hebergement/today?date=${selectedDay}`),
    ])
      .then(([cal, tdy]) => {
        setCalendar(cal.data);
        setToday_(tdy.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, selectedDay]);

  const daysGrid = useMemo(() => {
    if (!calendar) return [];
    return calendar.days || [];
  }, [calendar]);

  const monthLabel = format(new Date(month + "-01T12:00:00"), "MMMM yyyy", { locale: frLocale });

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-hebergement">
      <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A] mb-2">Hébergement</h1>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">Calendrier d'occupation et arrivées / départs du jour.</p>

      {/* Month navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]" data-testid="month-prev">
            <ChevronLeft size={14} />
          </button>
          <div className="font-display-serif text-lg sm:text-xl text-[#0A0A0A] capitalize min-w-[140px] sm:min-w-[180px] text-center">{monthLabel}</div>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]" data-testid="month-next">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[0.6rem] sm:text-[0.65rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ background: TIER_COLORS.superieure }}></span> Supérieure</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ background: TIER_COLORS.suite_jardin }}></span> Jardin</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ background: TIER_COLORS.suite_mer }}></span> Mer</span>
          <span className="flex items-center gap-1.5 text-red-700"><span className="w-2.5 h-2.5 bg-red-500"></span> Surbookée</span>
        </div>
      </div>

      {/* Overbooking summary banner */}
      {calendar?.days?.some((d) => d.is_overbooked) && (
        <div className="mb-4 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800" data-testid="overbooking-banner">
          ⚠️ Certaines nuits dépassent la capacité disponible
          {(() => {
            const overDays = calendar.days.filter((d) => d.is_overbooked).map((d) => d.date);
            return overDays.length > 0 && (
              <span className="block text-[0.72rem] mt-0.5 text-red-700/80">Dates concernées : {overDays.join(", ")}</span>
            );
          })()}
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white border border-[#0A0A0A]/8 p-3 sm:p-5 mb-8 overflow-x-auto" data-testid="hebergement-calendar">
        {loading && !calendar ? (
          <div className="text-sm text-[#0A0A0A]/50">Chargement…</div>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 min-w-[420px]">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="text-[0.55rem] sm:text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 text-center py-2">{d}</div>
            ))}
            {(() => {
              if (daysGrid.length === 0) return null;
              const firstDay = new Date(daysGrid[0].date + "T12:00:00");
              const dow = (firstDay.getDay() + 6) % 7;
              const blanks = Array.from({ length: dow });
              return [
                ...blanks.map((_, i) => <div key={`b${i}`} />),
                ...daysGrid.map((d) => {
                  const isSelected = d.date === selectedDay;
                  const isToday = d.date === today;
                  const over = d.is_overbooked;
                  return (
                    <button
                      key={d.date}
                      onClick={() => setSelectedDay(d.date)}
                      className={`relative aspect-square border p-1.5 sm:p-2 text-left transition-all ${
                        over
                          ? "border-red-500 bg-red-50 ring-1 ring-red-500"
                          : isSelected
                          ? "border-[#B8922A] bg-[#B8922A]/5 ring-1 ring-[#B8922A]"
                          : isToday
                          ? "border-[#B8922A]/40 bg-[#B8922A]/[0.02]"
                          : "border-[#0A0A0A]/10 hover:border-[#B8922A]/40"
                      }`}
                      data-testid={`heb-day-${d.date}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] sm:text-xs font-medium text-[#0A0A0A]">{parseInt(d.date.slice(-2))}</div>
                        {d.total_rooms > 0 && (
                          <div className={`text-[9px] sm:text-[0.55rem] font-medium ${over ? "text-red-700" : "text-[#B8922A]"}`}>
                            {d.total_rooms}/{d.total_inventory || ""}
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-1 sm:bottom-1.5 left-1 right-1 sm:left-1.5 sm:right-1.5 flex gap-0.5 h-1">
                        {(d.by_tier || []).map((t) => (
                          <div
                            key={t.tier_id}
                            className="flex-1"
                            style={{ background: t.is_overbooked ? "#EF4444" : TIER_COLORS[t.tier_id] || "#B8922A" }}
                            title={`${t.tier_name}: ${t.rooms}${t.inventory ? `/${t.inventory}` : ""}`}
                          />
                        ))}
                      </div>
                    </button>
                  );
                }),
              ];
            })()}
          </div>
        )}
      </div>

      {/* Today / selected day arrivals & departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-[#0A0A0A]/8 p-5">
          <div className="flex items-center gap-2 mb-4">
            <LogIn size={14} className="text-[#B8922A]" />
            <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A]">
              Arrivées · {selectedDay}
            </div>
            <span className="text-xs text-[#0A0A0A]/45 ml-auto">{today_?.arrivals?.length || 0}</span>
          </div>
          {!today_ ? <div className="text-sm text-[#0A0A0A]/50">…</div> : today_.arrivals.length === 0 ? (
            <div className="text-sm text-[#0A0A0A]/50">Aucune arrivée ce jour.</div>
          ) : (
            <div className="space-y-2">
              {today_.arrivals.map((b) => {
                const p = (b.participants || [])[0] || {};
                return (
                  <div key={b.id} className="border border-[#0A0A0A]/10 p-3" data-testid={`arrival-${b.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-[#0A0A0A]">{p.surname} {p.name}</div>
                      <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Bateau {b.boat_time}</div>
                    </div>
                    <div className="text-[0.72rem] text-[#0A0A0A]/65 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{b.room_tier_name}</span>
                      <span>{b.rooms} ch. · {(b.adults || 0) + (b.children || 0)} pers.</span>
                      <span>{b.nights} nuit{b.nights > 1 ? "s" : ""}</span>
                      <span>{b.phone || "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#0A0A0A]/8 p-5">
          <div className="flex items-center gap-2 mb-4">
            <LogOut size={14} className="text-[#B8922A]" />
            <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A]">
              Départs · {selectedDay}
            </div>
            <span className="text-xs text-[#0A0A0A]/45 ml-auto">{today_?.departures?.length || 0}</span>
          </div>
          {!today_ ? <div className="text-sm text-[#0A0A0A]/50">…</div> : today_.departures.length === 0 ? (
            <div className="text-sm text-[#0A0A0A]/50">Aucun départ ce jour.</div>
          ) : (
            <div className="space-y-2">
              {today_.departures.map((b) => {
                const p = (b.participants || [])[0] || {};
                return (
                  <div key={b.id} className="border border-[#0A0A0A]/10 p-3" data-testid={`departure-${b.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-[#0A0A0A]">{p.surname} {p.name}</div>
                      <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Bateau {b.return_boat_time}</div>
                    </div>
                    <div className="text-[0.72rem] text-[#0A0A0A]/65 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{b.room_tier_name}</span>
                      <span>{b.rooms} ch. · {(b.adults || 0) + (b.children || 0)} pers.</span>
                      <span>Check-in {b.date}</span>
                      <span>{b.phone || "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

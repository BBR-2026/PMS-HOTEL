import { useEffect, useState } from "react";
import api from "../../lib/api";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { UtensilsCrossed, Plus, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useStaffAuth } from "../../context/StaffAuthContext";

const STATUS_COLORS = {
  pending: "border-[#0A0A0A]/20 bg-[#FAFAF7]",
  confirmed: "border-[#B8922A]/40 bg-[#B8922A]/5",
  arrived: "border-green-500/40 bg-green-50",
  completed: "border-blue-500/40 bg-blue-50",
};

function shiftDate(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function StaffKaai() {
  const { user } = useStaffAuth();
  const isAdmin = user?.role === "admin";
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tables, setTables] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ number: "", capacity: 4, zone: "Salle" });
  const [selectedBookingId, setSelectedBookingId] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/staff/kaai/day?date=${date}`);
      setBookings(data.bookings || []);
      setTables(data.tables || []);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const addTable = async () => {
    if (!form.number.trim()) {
      toast.error("Numéro de table requis");
      return;
    }
    try {
      await api.post("/staff/kaai/tables", form);
      setShowCreate(false);
      setForm({ number: "", capacity: 4, zone: "Salle" });
      refresh();
      toast.success("Table créée");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Création impossible");
    }
  };

  const deleteTable = async (tableId) => {
    if (!window.confirm("Supprimer cette table ?")) return;
    try {
      await api.delete(`/staff/kaai/tables/${tableId}`);
      refresh();
      toast.success("Table supprimée");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Suppression impossible");
    }
  };

  const assignTable = async (bookingId, tableId) => {
    try {
      await api.patch(`/staff/kaai/bookings/${bookingId}/table`, { table_id: tableId || null });
      refresh();
      toast.success(tableId ? "Table assignée" : "Table libérée");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Action impossible");
    }
  };

  const totalGuests = bookings.reduce((s, b) => s + (b.adults || 0) + (b.children || 0), 0);
  const assignedCount = bookings.filter((b) => b.table_id).length;
  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);

  // Group tables by zone
  const zones = Array.from(new Set(tables.map((t) => t.zone || "Salle")));

  return (
    <div className="p-8 md:p-10 max-w-7xl mx-auto" data-testid="staff-kaai">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A]">Le Kaai — Restaurant</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-[#B8922A] text-[#B8922A] text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#B8922A]/5 transition-colors"
          data-testid="add-table-btn"
        >
          <Plus size={13} /> Ajouter une table
        </button>
      </div>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">Plan de salle et assignation des réservations.</p>

      {/* Date selector */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setDate(shiftDate(date, -1))} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]" data-testid="kaai-date-prev">
          <ChevronLeft size={14} />
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
          data-testid="kaai-date-input"
        />
        <button onClick={() => setDate(shiftDate(date, 1))} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]" data-testid="kaai-date-next">
          <ChevronRight size={14} />
        </button>
        <div className="text-sm text-[#0A0A0A]/70">
          {format(new Date(date + "T12:00:00"), "EEEE d MMMM yyyy", { locale: frLocale })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-white border border-[#0A0A0A]/8 p-4">
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Réservations</div>
          <div className="font-display-serif text-2xl text-[#0A0A0A] mt-1">{bookings.length}</div>
        </div>
        <div className="bg-white border border-[#0A0A0A]/8 p-4">
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Convives</div>
          <div className="font-display-serif text-2xl text-[#0A0A0A] mt-1">{totalGuests}</div>
        </div>
        <div className="bg-white border border-[#B8922A]/30 p-4">
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Tables assignées</div>
          <div className="font-display-serif text-2xl text-[#0A0A0A] mt-1">{assignedCount} / {bookings.length}</div>
        </div>
        <div className="bg-white border border-[#0A0A0A]/8 p-4">
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Tables actives</div>
          <div className="font-display-serif text-2xl text-[#0A0A0A] mt-1">{tables.filter((t) => t.status === "active").length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bookings list */}
        <div className="bg-white border border-[#0A0A0A]/8 p-5">
          <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">Réservations du jour ({bookings.length})</div>
          {loading && <div className="text-sm text-[#0A0A0A]/50">Chargement…</div>}
          {!loading && bookings.length === 0 && <div className="text-sm text-[#0A0A0A]/50">Aucune réservation pour cette date.</div>}
          <div className="space-y-2">
            {bookings.map((b) => {
              const primary = (b.participants || [])[0] || {};
              const table = tables.find((t) => t.id === b.table_id);
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBookingId(b.id)}
                  className={`w-full text-left border-l-4 ${STATUS_COLORS[b.status] || STATUS_COLORS.pending} border border-[#0A0A0A]/10 p-3 hover:border-[#B8922A]/40 transition-colors ${selectedBookingId === b.id ? "ring-2 ring-[#B8922A]" : ""}`}
                  data-testid={`kaai-booking-${b.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium text-[#0A0A0A]">
                      {primary.surname || ""} {primary.name || ""}
                    </div>
                    <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">{b.boat_time || "—"}</div>
                  </div>
                  <div className="text-[0.72rem] text-[#0A0A0A]/60 flex justify-between">
                    <span>{(b.adults || 0) + (b.children || 0)} pers. · {b.phone || "—"}</span>
                    <span className={table ? "text-[#B8922A] font-medium" : "text-[#0A0A0A]/40"}>
                      {table ? `Table ${table.number}` : "Sans table"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tables grid */}
        <div className="bg-white border border-[#0A0A0A]/8 p-5">
          <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-4">
            Plan de salle {selectedBooking ? "— cliquez une table pour assigner" : ""}
          </div>
          {zones.map((zone) => (
            <div key={zone} className="mb-5">
              <div className="text-[0.65rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 mb-2">{zone}</div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {tables.filter((t) => (t.zone || "Salle") === zone).map((t) => {
                  const assignedBooking = bookings.find((b) => b.table_id === t.id);
                  const occupied = !!assignedBooking;
                  const canAssign = selectedBooking && !occupied && t.status === "active";
                  return (
                    <div
                      key={t.id}
                      className={`relative border p-3 text-center transition-all ${
                        occupied
                          ? "bg-[#B8922A] text-white border-[#B8922A]"
                          : t.status === "indisponible"
                          ? "bg-[#FAFAF7] text-[#0A0A0A]/40 border-[#0A0A0A]/10"
                          : canAssign
                          ? "bg-white border-[#B8922A]/40 hover:bg-[#B8922A]/10 cursor-pointer"
                          : "bg-white border-[#0A0A0A]/15"
                      }`}
                      onClick={() => {
                        if (canAssign) assignTable(selectedBooking.id, t.id);
                      }}
                      data-testid={`kaai-table-${t.number}`}
                    >
                      <div className="font-display-serif text-base leading-none">{t.number}</div>
                      <div className={`text-[0.6rem] mt-0.5 ${occupied ? "text-white/80" : "text-[#0A0A0A]/45"}`}>{t.capacity} pers.</div>
                      {occupied && assignedBooking && (
                        <div className="text-[0.55rem] uppercase tracking-[0.16em] mt-1 truncate">
                          {(assignedBooking.participants || [])[0]?.surname || "—"}
                        </div>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTable(t.id);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border border-red-500 text-red-500 rounded-full flex items-center justify-center hover:bg-red-50"
                          title="Supprimer"
                        >
                          <X size={9} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {selectedBooking?.table_id && (
            <button
              onClick={() => assignTable(selectedBooking.id, null)}
              className="mt-4 text-[0.7rem] uppercase tracking-[0.22em] text-red-600 hover:text-red-800 inline-flex items-center gap-1.5"
              data-testid="unassign-table-btn"
            >
              <Trash2 size={11} /> Libérer la table de {(selectedBooking.participants || [])[0]?.surname}
            </button>
          )}
        </div>
      </div>

      {/* Create table modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display-serif text-2xl text-[#0A0A0A] mb-5">Nouvelle table</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[0.65rem] uppercase tracking-[0.22em] text-[#B8922A]">Numéro</label>
                <input
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                  data-testid="new-table-number"
                />
              </div>
              <div>
                <label className="text-[0.65rem] uppercase tracking-[0.22em] text-[#B8922A]">Capacité</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })}
                  className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                  data-testid="new-table-capacity"
                />
              </div>
              <div>
                <label className="text-[0.65rem] uppercase tracking-[0.22em] text-[#B8922A]">Zone</label>
                <select
                  value={form.zone}
                  onChange={(e) => setForm({ ...form, zone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                  data-testid="new-table-zone"
                >
                  <option>Salle</option>
                  <option>Terrasse</option>
                  <option>Bord de mer</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="text-[0.7rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60 hover:text-[#0A0A0A] px-4">
                Annuler
              </button>
              <button onClick={addTable} className="bg-[#B8922A] text-white px-5 py-2 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] transition-colors" data-testid="save-table-btn">
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

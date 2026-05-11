import { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";
import { Anchor, Plus, Ship, Trash2, CheckCircle2, Circle } from "lucide-react";
import { useStaffAuth } from "../../context/StaffAuthContext";

const BOAT_TIMES = ["10H", "12H", "14H", "16H", "18H", "20H"];

export default function StaffEmbarquement() {
  const { user } = useStaffAuth();
  const isAdmin = user?.role === "admin";
  const isManager = ["manager", "admin"].includes(user?.role);
  const [bateaux, setBateaux] = useState([]);
  const [traversees, setTraversees] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [newBoat, setNewBoat] = useState({ name: "", capacity: 30 });
  const [newCrossing, setNewCrossing] = useState({ bateau_id: "", depart_time: "10H" });

  const refresh = async () => {
    setLoading(true);
    try {
      const [bs, ts, dashboard] = await Promise.all([
        api.get("/staff/bateaux"),
        api.get(`/staff/traversees?date=${date}`),
        api.get("/staff/dashboard"),
      ]);
      setBateaux(bs.data);
      setTraversees(ts.data);
      setBookings(dashboard.data.bookings_today || []);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [date]);

  const addBoat = async () => {
    if (!newBoat.name) return;
    await api.post("/staff/bateaux", newBoat);
    setNewBoat({ name: "", capacity: 30 });
    toast.success("Bateau ajouté");
    refresh();
  };
  const deleteBoat = async (id) => {
    if (!window.confirm("Supprimer ce bateau ?")) return;
    await api.delete(`/staff/bateaux/${id}`);
    toast.success("Bateau supprimé");
    refresh();
  };
  const addCrossing = async () => {
    if (!newCrossing.bateau_id) {
      toast.error("Sélectionnez un bateau");
      return;
    }
    await api.post("/staff/traversees", { ...newCrossing, date, direction: "aller" });
    toast.success("Traversée créée (aller + retour automatique)");
    refresh();
  };
  const board = async (tid, booking_id) => {
    try {
      const { data } = await api.post(`/staff/traversees/${tid}/board`, { booking_id });
      toast.success(`${data.guests_boarded} passager(s) embarqué(s)`);
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };
  const unboard = async (tid, booking_id) => {
    await api.delete(`/staff/traversees/${tid}/board/${booking_id}`);
    refresh();
  };
  const setStatus = async (tid, status) => {
    await api.patch(`/staff/traversees/${tid}/status`, { status });
    refresh();
  };

  const isBoardedFor = (crossing, bookingId) =>
    crossing.passengers?.some((p) => p.booking_id === bookingId);

  // Filter bookings eligible for boarding (Day Pass/Sunset/Brunch matching boat_time)
  const eligibleBookings = (crossing) =>
    bookings.filter((b) => b.boat_time === crossing.depart_time && b.offer_type !== "hebergement");

  return (
    <div className="p-8 md:p-10 max-w-7xl mx-auto" data-testid="staff-embarquement">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A]">Embarquement & Traversée</h1>
          <p className="text-sm text-[#0A0A0A]/55 mt-1">Gestion des bateaux et passagers</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none"
          data-testid="embarquement-date"
        />
      </div>

      {/* Boats */}
      <section className="bg-white border border-[#0A0A0A]/8 p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display-serif text-xl text-[#0A0A0A] flex items-center gap-2">
            <Ship size={16} className="text-[#B8922A]" /> Bateaux ({bateaux.length})
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {bateaux.map((b) => (
            <div key={b.id} className="border border-[#0A0A0A]/10 p-4 bg-[#FAFAF7]" data-testid={`bateau-${b.id.slice(0, 8)}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display-serif text-base text-[#0A0A0A]">{b.name}</div>
                  <div className="text-xs text-[#0A0A0A]/55 mt-1">{b.capacity} places · {b.status}</div>
                </div>
                {isAdmin && (
                  <button onClick={() => deleteBoat(b.id)} className="text-[#0A0A0A]/30 hover:text-red-600" data-testid={`delete-bateau-${b.id.slice(0, 8)}`}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {isManager && (
          <div className="flex flex-wrap items-end gap-3 pt-4 border-t border-[#0A0A0A]/10">
            <div>
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Nom</label>
              <input
                value={newBoat.name}
                onChange={(e) => setNewBoat({ ...newBoat, name: e.target.value })}
                placeholder="Le Sunset Express"
                className="border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none"
                data-testid="new-bateau-name"
              />
            </div>
            <div>
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Capacité</label>
              <input
                type="number"
                min={1}
                max={300}
                value={newBoat.capacity}
                onChange={(e) => setNewBoat({ ...newBoat, capacity: parseInt(e.target.value || 1) })}
                className="w-24 border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none"
                data-testid="new-bateau-capacity"
              />
            </div>
            <button onClick={addBoat} className="btn-gold flex items-center gap-2" data-testid="add-bateau-btn">
              <Plus size={13} /> Ajouter
            </button>
          </div>
        )}
      </section>

      {/* Crossings */}
      <section className="bg-white border border-[#0A0A0A]/8 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display-serif text-xl text-[#0A0A0A] flex items-center gap-2">
            <Anchor size={16} className="text-[#B8922A]" /> Traversées du {date}
          </h2>
        </div>

        {isManager && (
          <div className="flex flex-wrap items-end gap-3 mb-6 pb-5 border-b border-[#0A0A0A]/10">
            <div>
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Bateau</label>
              <select
                value={newCrossing.bateau_id}
                onChange={(e) => setNewCrossing({ ...newCrossing, bateau_id: e.target.value })}
                className="border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none"
                data-testid="new-crossing-bateau"
              >
                <option value="">— Choisir —</option>
                {bateaux.filter((b) => b.status === "actif").map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.capacity})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Heure aller</label>
              <select
                value={newCrossing.depart_time}
                onChange={(e) => setNewCrossing({ ...newCrossing, depart_time: e.target.value })}
                className="border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none"
                data-testid="new-crossing-time"
              >
                {BOAT_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={addCrossing} className="btn-gold flex items-center gap-2" data-testid="add-crossing-btn">
              <Plus size={13} /> Programmer
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#0A0A0A]/40 py-8 text-center">Chargement…</p>
        ) : traversees.length === 0 ? (
          <p className="text-sm text-[#0A0A0A]/40 py-8 text-center">Aucune traversée programmée pour cette date.</p>
        ) : (
          <ul className="space-y-5" data-testid="traversees-list">
            {traversees.map((t) => {
              const cap = t.bateau?.capacity || 0;
              const left = cap - t.passenger_count;
              const eligible = t.direction === "aller" ? eligibleBookings(t) : [];
              return (
                <li key={t.id} className="border border-[#0A0A0A]/10 p-5" data-testid={`traversee-${t.id.slice(0, 8)}`}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-display-serif text-2xl text-[#B8922A]">{t.depart_time}</span>
                        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">
                          {t.direction === "aller" ? "Aller (vers l'île)" : "Retour"}
                        </span>
                      </div>
                      <div className="text-sm text-[#0A0A0A]/70">{t.bateau?.name || "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl tabular-nums">
                        <span className={left < cap * 0.1 ? "text-red-600 font-bold" : "text-[#0A0A0A]"}>
                          {t.passenger_count}
                        </span>
                        <span className="text-[#0A0A0A]/40"> / {cap}</span>
                      </div>
                      <select
                        value={t.status}
                        onChange={(e) => setStatus(t.id, e.target.value)}
                        className="mt-1 text-xs border border-[#0A0A0A]/15 px-2 py-1 focus:border-[#B8922A] outline-none"
                        data-testid={`traversee-${t.id.slice(0, 8)}-status`}
                      >
                        <option value="programmé">Programmé</option>
                        <option value="en_cours">En cours</option>
                        <option value="terminé">Terminé</option>
                      </select>
                    </div>
                  </div>

                  {t.direction === "aller" && (
                    <>
                      {eligible.length > 0 && (
                        <div className="mt-3">
                          <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-2">
                            Réservations éligibles ({eligible.length})
                          </div>
                          <ul className="space-y-1.5">
                            {eligible.map((b) => {
                              const boarded = isBoardedFor(t, b.id);
                              const name = b.participants?.[0] ? `${b.participants[0].surname} ${b.participants[0].name}` : b.phone;
                              return (
                                <li key={b.id} className="flex items-center justify-between text-sm bg-[#FAFAF7] p-2.5">
                                  <span className="flex items-center gap-2">
                                    {boarded ? <CheckCircle2 size={14} className="text-green-600" /> : <Circle size={14} className="text-[#0A0A0A]/30" />}
                                    <span>{name} <span className="text-[#0A0A0A]/45">· {b.offer_name} · {b.adults}A {b.children > 0 && `+${b.children}E`}</span></span>
                                  </span>
                                  {boarded ? (
                                    <button onClick={() => unboard(t.id, b.id)} className="text-xs text-[#0A0A0A]/55 hover:text-red-600" data-testid={`unboard-${t.id.slice(0, 8)}-${b.id.slice(0, 8)}`}>
                                      Retirer
                                    </button>
                                  ) : (
                                    <button onClick={() => board(t.id, b.id)} className="text-xs px-3 py-1 bg-[#B8922A] text-white hover:bg-[#9c7c1f]" data-testid={`board-${t.id.slice(0, 8)}-${b.id.slice(0, 8)}`}>
                                      Embarquer
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                      {t.passengers?.length > 0 && eligible.length === 0 && (
                        <div className="mt-3">
                          <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-2">
                            Embarqués ({t.passenger_count})
                          </div>
                          <ul className="text-xs text-[#0A0A0A]/70 space-y-1">
                            {t.passengers.map((p) => <li key={p.booking_id}>· {p.client_name} ({p.guests})</li>)}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

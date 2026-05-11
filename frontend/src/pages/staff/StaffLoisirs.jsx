import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Sparkles, X, Mail, Phone, Calendar, Users } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL = {
  new: { label: "Nouvelle", color: "bg-orange-50 text-orange-700 border-orange-200" },
  contacted: { label: "Contactée", color: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed: { label: "Confirmée", color: "bg-[#B8922A]/10 text-[#B8922A] border-[#B8922A]/30" },
  declined: { label: "Refusée", color: "bg-red-50 text-red-700 border-red-200" },
  completed: { label: "Terminée", color: "bg-green-50 text-green-700 border-green-200" },
};

const STATUS_FLOW = ["new", "contacted", "confirmed", "completed", "declined"];

export default function StaffLoisirs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const url = filter ? `/staff/loisirs/events?status=${filter}` : "/staff/loisirs/events";
      const { data } = await api.get(url);
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/staff/loisirs/events/${id}`, { status });
      refresh();
      toast.success("Statut mis à jour");
      if (selected?.id === id) setSelected({ ...selected, status });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Action impossible");
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    try {
      await api.patch(`/staff/loisirs/events/${selected.id}`, { notes });
      toast.success("Notes enregistrées");
      setSelected({ ...selected, notes });
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Action impossible");
    }
  };

  return (
    <div className="p-8 md:p-10 max-w-7xl mx-auto" data-testid="staff-loisirs">
      <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2">Loisirs & Privatisations</h1>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">Demandes de privatisation, événements et activités spéciales.</p>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter("")}
          className={`px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] border transition-all ${!filter ? "bg-[#B8922A] text-white border-[#B8922A]" : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"}`}
          data-testid="filter-all"
        >
          Toutes
        </button>
        {STATUS_FLOW.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] border transition-all ${filter === s ? "bg-[#B8922A] text-white border-[#B8922A]" : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"}`}
            data-testid={`filter-${s}`}
          >
            {STATUS_LABEL[s].label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#0A0A0A]/8">
        <div className="grid grid-cols-12 text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50 px-5 py-3 border-b border-[#0A0A0A]/10 bg-[#FAFAF7]">
          <div className="col-span-3">Demandeur</div>
          <div className="col-span-2">Événement</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Invités</div>
          <div className="col-span-2">Statut</div>
          <div className="col-span-1 text-right">Reçue</div>
        </div>
        {loading && <div className="p-6 text-sm text-[#0A0A0A]/50">Chargement…</div>}
        {!loading && items.length === 0 && <div className="p-6 text-sm text-[#0A0A0A]/50">Aucune demande.</div>}
        {items.map((e) => {
          const st = STATUS_LABEL[e.status] || { label: e.status, color: "border-[#0A0A0A]/15" };
          return (
            <button
              key={e.id}
              onClick={() => {
                setSelected(e);
                setNotes(e.notes || "");
              }}
              className="w-full grid grid-cols-12 items-center px-5 py-4 text-left border-b border-[#0A0A0A]/5 hover:bg-[#FAFAF7] transition-colors"
              data-testid={`event-row-${e.id}`}
            >
              <div className="col-span-3">
                <div className="text-sm text-[#0A0A0A]">{e.surname} {e.name}</div>
                <div className="text-[0.7rem] text-[#0A0A0A]/45 mt-0.5">{e.email}</div>
              </div>
              <div className="col-span-2 text-sm text-[#0A0A0A]/75 capitalize">{e.event_type}</div>
              <div className="col-span-2 text-sm text-[#0A0A0A]/75">{e.event_date}</div>
              <div className="col-span-2 text-sm text-[#0A0A0A]/75">{e.guest_count}</div>
              <div className="col-span-2">
                <span className={`inline-block px-2 py-1 text-[0.6rem] uppercase tracking-[0.18em] border ${st.color}`}>{st.label}</span>
              </div>
              <div className="col-span-1 text-right text-[0.7rem] text-[#0A0A0A]/45">{(e.created_at || "").slice(0, 10)}</div>
            </button>
          );
        })}
      </div>

      {/* Detail */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#0A0A0A]/10 px-7 py-5 flex items-center justify-between z-10">
              <h2 className="font-display-serif text-2xl text-[#0A0A0A]">Demande {(selected.event_type || "").toUpperCase()}</h2>
              <button onClick={() => setSelected(null)} data-testid="close-event-detail" className="text-[#0A0A0A]/50 hover:text-[#0A0A0A]">
                <X size={18} />
              </button>
            </div>
            <div className="p-7">
              <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-2">Contact</div>
              <div className="font-display-serif text-xl text-[#0A0A0A] mb-3">{selected.surname} {selected.name}</div>
              <div className="text-sm text-[#0A0A0A]/65 space-y-1.5 mb-6">
                <div className="flex items-center gap-2"><Mail size={13} className="text-[#B8922A]" /> {selected.email}</div>
                <div className="flex items-center gap-2"><Phone size={13} className="text-[#B8922A]" /> {selected.phone}</div>
                <div className="flex items-center gap-2"><Calendar size={13} className="text-[#B8922A]" /> {selected.event_date}</div>
                <div className="flex items-center gap-2"><Users size={13} className="text-[#B8922A]" /> {selected.guest_count} invités</div>
              </div>

              {selected.message && (
                <div className="mb-6">
                  <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-2">Message du client</div>
                  <div className="border border-[#0A0A0A]/10 bg-[#FAFAF7] p-4 text-sm text-[#0A0A0A]/75 whitespace-pre-wrap">
                    {selected.message}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-2">Statut</div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FLOW.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selected.id, s)}
                      className={`px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.22em] border transition-all ${
                        selected.status === s
                          ? "bg-[#B8922A] text-white border-[#B8922A]"
                          : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
                      }`}
                      data-testid={`set-status-${s}`}
                    >
                      {STATUS_LABEL[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-2">Notes internes</div>
                <textarea
                  value={notes}
                  onChange={(ev) => setNotes(ev.target.value)}
                  rows={5}
                  className="w-full border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none p-3 text-sm"
                  placeholder="Notes pour l'équipe…"
                  data-testid="event-notes-input"
                />
                <button
                  onClick={saveNotes}
                  className="mt-2 bg-[#B8922A] text-white px-4 py-2 text-[0.65rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23]"
                  data-testid="save-event-notes"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

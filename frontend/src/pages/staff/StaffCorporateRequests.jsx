import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Copy, FileDown, FileText, BarChart3, X } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";
import { useStaffAuth } from "../../context/StaffAuthContext";

/**
 * Staff Corporate Requests — list / create / inspect / export corporate
 * group registration links. Each request mints a `shareable_token` that
 * the company contact uses on `/corporate-form/{token}` to invite their
 * participants. Capacity is enforced server-side.
 */
const fmtDate = (iso) => (iso ? iso.slice(0, 10) : "");

const PAYMENT_MODE_LABEL = {
  free: "Gratuit (tous les participants)",
  paid: "Payant (CB / Mobile Money)",
  configurable: "Configurable par le participant",
};

export default function StaffCorporateRequests() {
  const { user } = useStaffAuth();
  const isManager = ["manager", "admin"].includes(user?.role);
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null); // detail object
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    reservation_type: "",
    event_date: "",
    max_participants: 20,
    payment_mode: "configurable",
    contact_email: "",
    contact_phone: "",
    notes: "",
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/staff/corporate-requests");
      setRequests(data.items || []);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    if (!form.company_name?.trim() || !form.reservation_type?.trim()) {
      toast.error("Nom de l'entreprise et type de réservation requis");
      return;
    }
    try {
      const payload = { ...form };
      if (!payload.event_date) delete payload.event_date;
      if (!payload.contact_email) delete payload.contact_email;
      if (!payload.contact_phone) delete payload.contact_phone;
      if (!payload.notes) delete payload.notes;
      await api.post("/staff/corporate-requests", payload);
      toast.success("Demande corporate créée");
      setCreating(false);
      setForm({
        company_name: "", reservation_type: "", event_date: "",
        max_participants: 20, payment_mode: "configurable",
        contact_email: "", contact_phone: "", notes: "",
      });
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const openDetail = async (id) => {
    try {
      const [d, s] = await Promise.all([
        api.get(`/staff/corporate-requests/${id}`),
        api.get(`/staff/corporate-requests/${id}/stats`),
      ]);
      setSelected(d.data);
      setStats(s.data);
    } catch {
      toast.error("Erreur de chargement détail");
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setStats(null);
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer cette demande ? Tous les participants enregistrés seront perdus.")) return;
    try {
      await api.delete(`/staff/corporate-requests/${id}`);
      toast.success("Supprimé");
      refresh();
      if (selected?.id === id) closeDetail();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const copyLink = (slugOrToken) => {
    // Prefer the human-readable slug; fall back to the legacy hex token for
    // pre-iter22 requests that have no slug yet.
    const url = `${window.location.origin}/corporate-form/${slugOrToken}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Lien copié dans le presse-papiers"),
      () => toast.error("Impossible de copier — copiez manuellement"),
    );
  };

  const downloadExport = async (id, kind) => {
    try {
      const url = `${api.defaults.baseURL}/staff/corporate-requests/${id}/participants.${kind}`;
      const token = localStorage.getItem("staff_token") || "";
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `participants.${kind}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Échec de l'export");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="staff-corporate-requests">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-7">
        <div>
          <h1 className="font-display-serif text-3xl text-[#0A0A0A]">Corporate · Demandes</h1>
          <p className="text-sm text-[#0A0A0A]/55 mt-1">
            Créez un lien d&apos;inscription par entreprise, suivez les inscriptions en temps réel.
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setCreating(true)}
            className="btn-gold inline-flex items-center gap-2"
            data-testid="open-create-corporate"
          >
            <Plus size={14} /> Nouvelle demande
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-[#0A0A0A]/55 text-sm">Chargement…</div>
      ) : requests.length === 0 ? (
        <div className="bg-white border border-dashed border-[#0A0A0A]/15 p-12 text-center">
          <p className="text-sm text-[#0A0A0A]/55">Aucune demande corporate.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="corporate-requests-list">
          {requests.map((r) => {
            const pct = r.max_participants > 0
              ? Math.min(100, Math.round((r.registered_count / r.max_participants) * 100))
              : 0;
            const color = r.is_full ? "#16A34A" : "#B8922A";
            return (
              <div
                key={r.id}
                className="bg-white border border-[#0A0A0A]/8 p-5 hover:border-[#B8922A]/40 transition-colors"
                data-testid={`corporate-card-${r.id.slice(0, 8)}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-display-serif text-lg text-[#0A0A0A] truncate">{r.company_name}</div>
                    <div className="text-[0.7rem] text-[#0A0A0A]/55 mt-0.5">
                      {r.reservation_type}{r.event_date ? ` · ${r.event_date}` : ""}
                    </div>
                  </div>
                  <span
                    className={`text-[0.55rem] uppercase tracking-[0.18em] px-2 py-1 ${
                      r.status === "closed" ? "bg-[#0A0A0A]/5 text-[#0A0A0A]/55" : "bg-green-50 text-green-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between text-[0.72rem] text-[#0A0A0A]/65 mb-1">
                    <span>
                      <span className="font-medium text-[#0A0A0A]">{r.registered_count}</span> / {r.max_participants} inscrits
                    </span>
                    <span className="tabular-nums">{r.remaining_seats} restants</span>
                  </div>
                  <div className="h-1.5 bg-[#0A0A0A]/5 overflow-hidden">
                    <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color, transition: "width 800ms ease-out" }} />
                  </div>
                </div>
                <div className="text-[0.7rem] text-[#0A0A0A]/55 mb-3">
                  {PAYMENT_MODE_LABEL[r.payment_mode] || r.payment_mode}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => copyLink(r.slug || r.shareable_token)}
                    className="inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.18em] text-[#B8922A] hover:text-[#9d7a23] border border-[#B8922A]/30 px-2.5 py-1.5"
                    data-testid={`copy-link-${r.id.slice(0, 8)}`}
                    title={`/corporate-form/${r.slug || r.shareable_token}`}
                  >
                    <Copy size={11} /> Copier lien
                  </button>
                  <button
                    onClick={() => openDetail(r.id)}
                    className="inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A] hover:text-[#B8922A] border border-[#0A0A0A]/15 px-2.5 py-1.5"
                    data-testid={`open-detail-${r.id.slice(0, 8)}`}
                  >
                    <BarChart3 size={11} /> Détail
                  </button>
                  <button
                    onClick={() => downloadExport(r.id, "csv")}
                    className="inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A] hover:text-[#B8922A] border border-[#0A0A0A]/15 px-2.5 py-1.5"
                    data-testid={`export-csv-${r.id.slice(0, 8)}`}
                  >
                    <FileDown size={11} /> CSV
                  </button>
                  <button
                    onClick={() => downloadExport(r.id, "pdf")}
                    className="inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A] hover:text-[#B8922A] border border-[#0A0A0A]/15 px-2.5 py-1.5"
                    data-testid={`export-pdf-${r.id.slice(0, 8)}`}
                  >
                    <FileText size={11} /> PDF
                  </button>
                  {isManager && (
                    <button
                      onClick={() => remove(r.id)}
                      className="ml-auto text-[#0A0A0A]/40 hover:text-red-600 p-1.5"
                      data-testid={`delete-corporate-${r.id.slice(0, 8)}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" data-testid="create-corporate-modal">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display-serif text-xl text-[#0A0A0A]">Nouvelle demande corporate</h2>
              <button onClick={() => setCreating(false)} className="text-[#0A0A0A]/55 hover:text-[#0A0A0A]"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {[
                ["company_name", "Nom de l'entreprise *", "text", "Acme Corp"],
                ["reservation_type", "Type de réservation *", "text", "ex. Séminaire, Team-building"],
                ["event_date", "Date de l'événement", "date", ""],
                ["max_participants", "Nombre de personnes *", "number", ""],
                ["contact_email", "Email contact", "email", ""],
                ["contact_phone", "Téléphone contact", "tel", ""],
              ].map(([key, label, type, ph]) => (
                <div key={key}>
                  <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key] ?? ""}
                    onChange={(e) => setForm({ ...form, [key]: type === "number" ? parseInt(e.target.value || 0) : e.target.value })}
                    placeholder={ph}
                    className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none"
                    data-testid={`new-corp-${key}`}
                  />
                </div>
              ))}
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Mode de paiement</label>
                <select
                  value={form.payment_mode}
                  onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                  className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none"
                  data-testid="new-corp-payment-mode"
                >
                  <option value="configurable">Configurable par le participant</option>
                  <option value="free">Gratuit pour tous</option>
                  <option value="paid">Payant (CB / Mobile Money)</option>
                </select>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Notes internes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none"
                  data-testid="new-corp-notes"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-[#0A0A0A]/70 hover:text-[#0A0A0A]">Annuler</button>
              <button onClick={create} className="btn-gold" data-testid="submit-create-corporate">Créer la demande</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto" data-testid="corporate-detail-modal">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display-serif text-xl text-[#0A0A0A]">{selected.company_name}</h2>
                <div className="text-[0.7rem] text-[#0A0A0A]/55 mt-0.5">
                  {selected.reservation_type}{selected.event_date ? ` · ${selected.event_date}` : ""}
                </div>
              </div>
              <button onClick={closeDetail} className="text-[#0A0A0A]/55 hover:text-[#0A0A0A]"><X size={16} /></button>
            </div>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="border border-[#0A0A0A]/8 p-3">
                  <div className="text-[0.55rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Inscrits</div>
                  <div className="font-display-serif text-2xl mt-1">{stats.total}</div>
                </div>
                {Object.entries(stats.by_kind).map(([k, v]) => (
                  <div key={k} className="border border-[#0A0A0A]/8 p-3">
                    <div className="text-[0.55rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">{k}</div>
                    <div className="font-display-serif text-2xl mt-1">{v}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                    <th className="text-left py-2 pr-3">Nom</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Email</th>
                    <th className="text-left py-2 px-3">Téléphone</th>
                    <th className="text-left py-2 px-3">WhatsApp</th>
                    <th className="text-left py-2 pl-3">Nationalité</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.participants || []).map((p) => (
                    <tr key={p.id} className="border-b border-[#0A0A0A]/5 last:border-0">
                      <td className="py-2 pr-3">{p.surname} {p.name}</td>
                      <td className="py-2 px-3 capitalize">{p.kind}</td>
                      <td className="py-2 px-3">{p.email}</td>
                      <td className="py-2 px-3">{p.phone}</td>
                      <td className="py-2 px-3">{p.whatsapp || "—"}</td>
                      <td className="py-2 pl-3">{p.nationality}</td>
                    </tr>
                  ))}
                  {(!selected.participants || selected.participants.length === 0) && (
                    <tr><td colSpan={6} className="py-6 text-center text-[#0A0A0A]/45">Aucun participant.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

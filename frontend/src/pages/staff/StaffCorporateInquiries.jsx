import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Building2, Search, Loader2, Trash2, Phone, Mail, Calendar, Users } from "lucide-react";
import { toast } from "sonner";
import { useStaffAuth } from "../../context/StaffAuthContext";

const STATUS_LABELS = {
  new: { label: "Nouvelle", color: "text-blue-600 bg-blue-50" },
  in_progress: { label: "En cours", color: "text-amber-600 bg-amber-50" },
  won: { label: "Confirmée", color: "text-emerald-600 bg-emerald-50" },
  lost: { label: "Perdue", color: "text-red-600 bg-red-50" },
};

export default function StaffCorporateInquiries() {
  const { user } = useStaffAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const limit = 25;

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/staff/corporate-inquiries", {
        params: {
          page, limit,
          q: query || undefined,
          period: period !== "all" ? period : undefined,
          status: statusFilter || undefined,
        },
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec du chargement");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, period, statusFilter]);

  const onSearch = (e) => { e.preventDefault(); setPage(1); load(); };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/staff/corporate-inquiries/${id}`, { status });
      toast.success("Statut mis à jour");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer définitivement cette demande ?")) return;
    try {
      await api.delete(`/staff/corporate-inquiries/${id}`);
      toast.success("Supprimée");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec");
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-corporate-inquiries">
      <div className="flex items-center gap-3 mb-1">
        <Building2 className="text-[#B8922A]" size={22} />
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">Demandes Corporate</h1>
      </div>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">
        Demandes envoyées via le formulaire du pôle Corporate ({total} au total).
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <form onSubmit={onSearch} className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/40" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher entreprise, secteur, correspondant…"
              className="w-full pl-9 pr-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
              data-testid="ci-search"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-[#0A0A0A] text-white text-[0.65rem] uppercase tracking-[0.18em] hover:bg-[#1A1A1A]">
            Chercher
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mr-1">Période :</span>
        {[
          { v: "all", label: "Toutes" },
          { v: "day", label: "Aujourd'hui" },
          { v: "week", label: "Cette semaine" },
          { v: "month", label: "Ce mois-ci" },
        ].map((p) => (
          <button key={p.v} onClick={() => { setPage(1); setPeriod(p.v); }}
            className={`px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] border transition-colors ${
              period === p.v
                ? "bg-[#B8922A] text-white border-[#B8922A]"
                : "bg-white text-[#0A0A0A]/70 border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 ml-3 mr-1">Statut :</span>
        <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
          className="px-3 py-1.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white">
          <option value="">— Tous —</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#0A0A0A]/50 py-10 justify-center">
          <Loader2 className="animate-spin" size={14} /> Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#0A0A0A]/50 border border-dashed border-[#0A0A0A]/15">
          Aucune demande corporate pour cette sélection.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const sl = STATUS_LABELS[it.status] || STATUS_LABELS.new;
            const isOpen = expanded === it.id;
            return (
              <div key={it.id} className="border border-[#0A0A0A]/10 bg-white" data-testid={`ci-row-${it.id.slice(0, 8)}`}>
                <button
                  onClick={() => setExpanded(isOpen ? null : it.id)}
                  className="w-full text-left p-4 hover:bg-[#FAFAF7] grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                >
                  <div className="md:col-span-3">
                    <div className="font-medium text-[#0A0A0A]">{it.company_name}</div>
                    <div className="text-[0.72rem] text-[#0A0A0A]/55">{it.sector}</div>
                  </div>
                  <div className="md:col-span-2 text-[0.78rem]">{it.offer_label}</div>
                  <div className="md:col-span-2 text-[0.78rem] inline-flex items-center gap-1 text-[#0A0A0A]/70">
                    <Calendar size={11} /> {it.requested_date}
                  </div>
                  <div className="md:col-span-1 text-[0.78rem] inline-flex items-center gap-1 text-[#0A0A0A]/70">
                    <Users size={11} /> {it.head_count}
                  </div>
                  <div className="md:col-span-2 text-[0.78rem]">
                    <div className="text-[#0A0A0A]">{it.contact_name}</div>
                    <div className="text-[#0A0A0A]/55">{it.contact_phone}</div>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <span className={`text-[0.65rem] uppercase tracking-[0.18em] px-2 py-1 ${sl.color}`}>
                      {sl.label}
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-[#0A0A0A]/8 p-4 bg-[#FAFAF7]" data-testid={`ci-detail-${it.id.slice(0, 8)}`}>
                    <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-2">Description</div>
                    <div className="text-sm text-[#0A0A0A] whitespace-pre-wrap leading-relaxed mb-4">{it.description}</div>
                    <div className="grid sm:grid-cols-2 gap-3 text-[0.78rem] text-[#0A0A0A]/75 mb-4">
                      <div className="inline-flex items-center gap-2"><Phone size={12} /> <a href={`tel:${it.contact_phone}`} className="hover:underline">{it.contact_phone}</a></div>
                      {it.contact_email && (
                        <div className="inline-flex items-center gap-2"><Mail size={12} /> <a href={`mailto:${it.contact_email}`} className="hover:underline">{it.contact_email}</a></div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#0A0A0A]/8">
                      <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mr-1">Statut :</span>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <button key={k} onClick={() => updateStatus(it.id, k)}
                          disabled={it.status === k}
                          className={`px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.18em] border transition-colors ${
                            it.status === k
                              ? `${v.color} border-current cursor-default`
                              : "border-[#0A0A0A]/15 text-[#0A0A0A]/65 hover:border-[#B8922A] hover:text-[#B8922A]"
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                      {isAdmin && (
                        <button onClick={() => remove(it.id)}
                          className="ml-auto text-red-500 hover:text-red-700 inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.18em]">
                          <Trash2 size={12} /> Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 border border-[#0A0A0A]/15 text-[0.65rem] uppercase tracking-[0.18em] disabled:opacity-40">
            Précédent
          </button>
          <span className="text-[0.72rem] text-[#0A0A0A]/65">Page {page} / {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
            className="px-3 py-1.5 border border-[#0A0A0A]/15 text-[0.65rem] uppercase tracking-[0.18em] disabled:opacity-40">
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import api, { getStaffToken } from "../../lib/api";
import { Search, Trash2, FileSpreadsheet, FileText, FileType, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStaffAuth } from "../../context/StaffAuthContext";

export default function StaffRegistrations() {
  const { user } = useStaffAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 25;

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/staff/registrations", {
        params: { page, limit, q: query || undefined },
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer cet enregistrement ?")) return;
    try {
      await api.delete(`/staff/registrations/${id}`);
      toast.success("Enregistrement supprimé");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec de la suppression");
    }
  };

  const download = (format) => {
    const url = `${api.defaults.baseURL}/staff/registrations/export.${format}`;
    fetch(url, { headers: { Authorization: `Bearer ${getStaffToken()}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Export refusé");
        return r.blob();
      })
      .then((blob) => {
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = `bbr-enregistrements.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(u);
      })
      .catch((err) => toast.error(err.message || "Export indisponible"));
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-registrations">
      <div className="flex items-center gap-3 mb-1">
        <UserCheck className="text-[#B8922A]" size={22} />
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">Enregistrements</h1>
      </div>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">
        Personnes enregistrées via la page Bienvenue ({total} au total).
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <form onSubmit={onSearch} className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher nom, email, nationalité, offre…"
              className="w-full pl-9 pr-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
              data-testid="reg-search"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-[#0A0A0A] text-white text-[0.65rem] uppercase tracking-[0.18em] hover:bg-[#1A1A1A]" data-testid="reg-search-btn">
            Chercher
          </button>
        </form>

        <div className="flex items-center gap-2">
          <button onClick={() => download("csv")} className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#0A0A0A]/15 text-[0.65rem] uppercase tracking-[0.18em] hover:bg-[#0A0A0A]/5" data-testid="export-csv">
            <FileText size={12} /> CSV
          </button>
          <button onClick={() => download("xlsx")} className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#0A0A0A]/15 text-[0.65rem] uppercase tracking-[0.18em] hover:bg-[#0A0A0A]/5" data-testid="export-xlsx">
            <FileSpreadsheet size={12} /> Excel
          </button>
          <button onClick={() => download("pdf")} className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#0A0A0A]/15 text-[0.65rem] uppercase tracking-[0.18em] hover:bg-[#0A0A0A]/5" data-testid="export-pdf">
            <FileType size={12} /> PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#0A0A0A]/50 py-10 justify-center">
          <Loader2 className="animate-spin" size={14} /> Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#0A0A0A]/50 border border-dashed border-[#0A0A0A]/15">
          Aucun enregistrement.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#0A0A0A]/10">
          <table className="w-full text-sm" data-testid="reg-table">
            <thead className="bg-[#FAF7F2]">
              <tr className="text-left text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/65">
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Réf.</th>
                <th className="px-3 py-3">Nom</th>
                <th className="px-3 py-3">Prénom</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Téléphone</th>
                <th className="px-3 py-3">Nationalité</th>
                <th className="px-3 py-3">Offre</th>
                {isAdmin && <th className="px-3 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-[#0A0A0A]/8 hover:bg-[#0A0A0A]/2">
                  <td className="px-3 py-2.5 text-[0.78rem] text-[#0A0A0A]/70 whitespace-nowrap">
                    {(r.created_at || "").slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[0.78rem]">{(r.id || "").slice(0, 8).toUpperCase()}</td>
                  <td className="px-3 py-2.5">{r.last_name}</td>
                  <td className="px-3 py-2.5">{r.first_name}</td>
                  <td className="px-3 py-2.5 text-[0.8rem]">{r.email}</td>
                  <td className="px-3 py-2.5 text-[0.8rem]">{r.phone}</td>
                  <td className="px-3 py-2.5 text-[0.8rem]">{r.nationality}</td>
                  <td className="px-3 py-2.5 text-[0.8rem]">{r.offer_label}</td>
                  {isAdmin && (
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => remove(r.id)}
                        className="text-red-500 hover:text-red-700"
                        title="Supprimer"
                        data-testid={`del-reg-${r.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-[#0A0A0A]/15 text-[0.65rem] uppercase tracking-[0.18em] disabled:opacity-40"
          >
            Précédent
          </button>
          <span className="text-[0.72rem] text-[#0A0A0A]/65">Page {page} / {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="px-3 py-1.5 border border-[#0A0A0A]/15 text-[0.65rem] uppercase tracking-[0.18em] disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

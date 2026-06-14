import { useEffect, useState } from "react";
import api, { getStaffToken } from "../../lib/api";
import {
  Search, Trash2, FileSpreadsheet, FileText, FileType, UserCheck, Loader2,
  RefreshCw, Briefcase, Users, UserPlus, Truck, Handshake, User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useStaffAuth } from "../../context/StaffAuthContext";

const KIND_META = {
  client:      { label: "Client",      icon: UserCheck,  color: "#B8922A" },
  personnel:   { label: "Personnel",   icon: Briefcase,  color: "#0A0A0A" },
  prestataire: { label: "Prestataire", icon: Users,      color: "#6B7280" },
  fournisseur: { label: "Fournisseur", icon: Truck,      color: "#0EA5E9" },
  invite:      { label: "Invité",      icon: UserPlus,   color: "#16A34A" },
  partenaire:  { label: "Partenaire",  icon: Handshake,  color: "#9333EA" },
  visiteur:    { label: "Visiteur",    icon: UserIcon,   color: "#A16207" },
};

export default function StaffRegistrations() {
  const { user } = useStaffAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [kindCounts, setKindCounts] = useState({ client: 0, personnel: 0, prestataire: 0, fournisseur: 0, invite: 0, partenaire: 0, visiteur: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [specificDate, setSpecificDate] = useState("");
  const [offerId, setOfferId] = useState("");
  const [kind, setKind] = useState(null);  // null = all kinds
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const limit = 25;

  // Load offer list once for the dropdown
  useEffect(() => {
    api.get("/registration-offers")
      .then(({ data }) => setOffers(data.offers || []))
      .catch(() => { /* silent */ });
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/staff/registrations", {
        params: {
          page, limit,
          q: query || undefined,
          // A specific date takes precedence over a rolling period.
          date: specificDate || undefined,
          period: !specificDate && period !== "all" ? period : undefined,
          offer_id: offerId || undefined,
          kind: kind || undefined,
        },
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
      // Counts per kind for the tabs (separate call, doesn't apply kind filter)
      try {
        const { data: cd } = await api.get("/staff/registrations/counts-by-kind", {
          params: {
            q: query || undefined,
            date: specificDate || undefined,
            period: !specificDate && period !== "all" ? period : undefined,
            offer_id: offerId || undefined,
          },
        });
        setKindCounts(cd.counts || { client: 0, personnel: 0, prestataire: 0, invite: 0 });
      } catch { /* tab counts are best-effort */ }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec du chargement");
    } finally {
      setLoading(false);
    }
  };

  // Reload whenever page or filters change. eslint-disable: load is intentionally
  // referenced from a closure that captures the filters — that's fine here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, period, specificDate, offerId, kind]);

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
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (specificDate) params.set("date", specificDate);
    else if (period !== "all") params.set("period", period);
    if (offerId) params.set("offer_id", offerId);
    if (kind) params.set("kind", kind);
    const qs = params.toString();
    const url = `${api.defaults.baseURL}/staff/registrations/export.${format}${qs ? `?${qs}` : ""}`;
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

      {/* Kind tabs (filter by visiteur statut) */}
      <div className="flex flex-wrap gap-2 mb-4" data-testid="kind-tabs">
        <button
          onClick={() => { setKind(null); setPage(1); }}
          className={`px-3.5 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] border transition-colors inline-flex items-center gap-1.5 ${
            kind === null
              ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
              : "bg-white text-[#0A0A0A]/70 border-[#0A0A0A]/15 hover:border-[#0A0A0A]"
          }`}
          data-testid="kind-tab-all"
        >
          Tous <span className="text-[0.62rem] opacity-70">({Object.values(kindCounts).reduce((a, b) => a + b, 0)})</span>
        </button>
        {["client", "personnel", "prestataire", "fournisseur", "invite", "partenaire", "visiteur"].map((k) => {
          const meta = KIND_META[k];
          const Icon = meta.icon;
          const isActive = kind === k;
          return (
            <button
              key={k}
              onClick={() => { setKind(k); setPage(1); }}
              className={`px-3.5 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] border transition-colors inline-flex items-center gap-1.5 ${
                isActive
                  ? "text-white border-transparent"
                  : "bg-white text-[#0A0A0A]/75 border-[#0A0A0A]/15 hover:border-[#B8922A]"
              }`}
              style={isActive ? { backgroundColor: meta.color, borderColor: meta.color } : {}}
              data-testid={`kind-tab-${k}`}
            >
              <Icon size={11} /> {meta.label}
              <span className="text-[0.62rem] opacity-70">({kindCounts[k] || 0})</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
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
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#0A0A0A]/15 text-[0.65rem] uppercase tracking-[0.18em] hover:border-[#B8922A] hover:text-[#B8922A] disabled:opacity-50" data-testid="reg-refresh" title="Rafraîchir">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Rafraîchir
          </button>
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

      {/* Period + Specific Date + Offer filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mr-1">Période :</span>
        {[
          { v: "all",   label: "Toutes" },
          { v: "day",   label: "Aujourd'hui" },
          { v: "week",  label: "Cette semaine" },
          { v: "month", label: "Ce mois-ci" },
        ].map((p) => (
          <button
            key={p.v}
            onClick={() => { setPage(1); setSpecificDate(""); setPeriod(p.v); }}
            disabled={!!specificDate}
            className={`px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              !specificDate && period === p.v
                ? "bg-[#B8922A] text-white border-[#B8922A]"
                : "bg-white text-[#0A0A0A]/70 border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"
            }`}
            data-testid={`period-${p.v}`}
          >
            {p.label}
          </button>
        ))}
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 ml-3 mr-1">Date précise :</span>
        <input
          type="date"
          value={specificDate}
          onChange={(e) => { setPage(1); setSpecificDate(e.target.value); }}
          className="px-3 py-1.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
          data-testid="filter-date"
        />
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 ml-3 mr-1">Offre :</span>
        <select
          value={offerId}
          onChange={(e) => { setPage(1); setOfferId(e.target.value); }}
          className="px-3 py-1.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white min-w-[200px]"
          data-testid="filter-offer"
        >
          <option value="">— Toutes les offres —</option>
          {offers.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {(period !== "all" || specificDate || offerId || kind) && (
          <button
            onClick={() => { setPage(1); setPeriod("all"); setSpecificDate(""); setOfferId(""); setKind(null); }}
            className="ml-2 text-[0.65rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 hover:text-[#B8922A]"
            data-testid="clear-filters"
          >
            ✕ Réinitialiser
          </button>
        )}
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
                <th className="px-3 py-3">Statut</th>
                <th className="px-3 py-3">Nom</th>
                <th className="px-3 py-3">Prénom</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Téléphone</th>
                <th className="px-3 py-3">Nationalité</th>
                <th className="px-3 py-3">Offre / Entreprise</th>
                {isAdmin && <th className="px-3 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const k = r.kind || "client";
                const meta = KIND_META[k] || KIND_META.client;
                const Icon = meta.icon;
                return (
                  <tr key={r.id} className="border-t border-[#0A0A0A]/8 hover:bg-[#0A0A0A]/2">
                    <td className="px-3 py-2.5 text-[0.78rem] text-[#0A0A0A]/70 whitespace-nowrap">
                      {(r.created_at || "").slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[0.78rem]">{(r.id || "").slice(0, 8).toUpperCase()}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide border"
                        style={{ borderColor: meta.color, color: meta.color }}
                        data-testid={`kind-badge-${r.id}`}
                      >
                        <Icon size={10} /> {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{r.last_name}</td>
                    <td className="px-3 py-2.5">{r.first_name}</td>
                    <td className="px-3 py-2.5 text-[0.8rem]">{r.email}</td>
                    <td className="px-3 py-2.5 text-[0.8rem]">{r.phone}</td>
                    <td className="px-3 py-2.5 text-[0.8rem]">{r.nationality}</td>
                    <td className="px-3 py-2.5 text-[0.8rem]">
                      {r.offer_label}
                      {r.company && <div className="text-[0.7rem] text-[#0A0A0A]/50">{r.company}</div>}
                      {r.position && <div className="text-[0.7rem] text-[#0A0A0A]/50">Poste · {r.position}</div>}
                      {r.visit_reason && <div className="text-[0.7rem] text-[#0A0A0A]/50">Motif · {r.visit_reason}</div>}
                    </td>
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
                );
              })}
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

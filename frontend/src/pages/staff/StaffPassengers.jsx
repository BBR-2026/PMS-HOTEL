import { useEffect, useMemo, useState } from "react";
import {
  Users, Search, Calendar, FileSpreadsheet, Loader2,
  Clock, CheckCircle2, Ticket, Anchor, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const STATUS_TABS = [
  { id: "all",        label: "Tous",         color: "#0A0A0A", icon: Users },
  { id: "en_attente", label: "En attente",   color: "#D97706", icon: Clock },
  { id: "enregistre", label: "Enregistré",   color: "#2563EB", icon: Ticket },
  { id: "embarque",   label: "Embarqué",     color: "#0EA5E9", icon: Anchor },
  { id: "finalise",   label: "Finalisé",     color: "#16A34A", icon: CheckCircle2 },
];

const PERIODS = [
  { id: "all",       label: "Toutes" },
  { id: "today",     label: "Aujourd'hui" },
  { id: "yesterday", label: "Hier" },
  { id: "week",      label: "Semaine" },
  { id: "custom",    label: "Personnalisée" },
];

const fmtDate = (s) => (s || "").slice(0, 10);
const fmtTime = (s) => (s || "").slice(11, 16);
const fmtMoney = (n) =>
  `${new Intl.NumberFormat("fr-FR").format(Math.round(n || 0))} FCFA`;

export default function StaffPassengers() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { status, period };
      if (period === "custom") {
        if (!dateFrom || !dateTo) {
          setLoading(false); return;
        }
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }
      if (query.trim()) params.q = query.trim();
      const { data } = await api.get("/staff/passengers", { params });
      setItems(data.items || []);
      setSummary(data.summary || {});
      setTotal(data.total || 0);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Erreur API";
      setError(detail);
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [status, period, dateFrom, dateTo]);

  const exportXlsx = async () => {
    try {
      const params = { status, period };
      if (period === "custom") {
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }
      const res = await api.get("/staff/passengers/export.xlsx", {
        params, responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `BBR-passagers-${status}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
      toast.success("Liste Excel téléchargée");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'export");
    }
  };

  const filteredCount = useMemo(() => items.length, [items]);

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-7xl" data-testid="staff-passengers">
      <header>
        <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-1">
          Module · Enregistrement client
        </div>
        <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A]">
          Passagers — registre centralisé
        </h1>
        <p className="text-sm text-[#0A0A0A]/60 mt-1 max-w-2xl">
          Base unique consolidant tous les passagers, quelle que soit leur origine
          (réservation en ligne, sur place, lien d'enregistrement, accueil manuel).
        </p>
      </header>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2" data-testid="status-tabs">
        {STATUS_TABS.map((s) => {
          const Icon = s.icon;
          const isActive = status === s.id;
          const n = s.id === "all" ? total : (summary[s.id] ?? 0);
          return (
            <button
              key={s.id}
              onClick={() => setStatus(s.id)}
              className={`px-3.5 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] border transition-colors inline-flex items-center gap-1.5 ${
                isActive
                  ? "text-white border-transparent"
                  : "bg-white text-[#0A0A0A]/75 border-[#0A0A0A]/15 hover:border-[#B8922A]"
              }`}
              style={isActive ? { backgroundColor: s.color, borderColor: s.color } : {}}
              data-testid={`status-${s.id}`}
            >
              <Icon size={11} /> {s.label} <span className="opacity-70">({n})</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 text-xs uppercase tracking-wide border transition-colors ${
              period === p.id
                ? "border-[#B8922A] bg-[#B8922A] text-white"
                : "border-[#0A0A0A]/15 text-[#0A0A0A]/70 hover:border-[#0A0A0A]/40"
            }`}
            data-testid={`period-${p.id}`}
          >
            {p.label}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-1.5 ml-1.5">
            <input
              type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 border border-[#0A0A0A]/15 text-xs"
              data-testid="passengers-date-from"
            />
            <span className="text-[#0A0A0A]/40 text-xs">→</span>
            <input
              type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 border border-[#0A0A0A]/15 text-xs"
              data-testid="passengers-date-to"
            />
          </div>
        )}

        <div className="flex-1 min-w-[240px]" />
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#0A0A0A]/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Rechercher nom, réf, code…"
            className="pl-7 pr-3 py-1.5 border border-[#0A0A0A]/15 text-xs focus:outline-none focus:border-[#B8922A] w-60"
            data-testid="passengers-search"
          />
        </div>
        <button
          onClick={exportXlsx}
          className="px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] bg-[#0A0A0A] text-white hover:bg-[#1a1a1a] inline-flex items-center gap-1.5"
          data-testid="passengers-export-xlsx"
        >
          <FileSpreadsheet size={12} /> Exporter Excel
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-300 text-[0.78rem] text-red-700 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#0A0A0A]/10 overflow-x-auto">
        <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45 px-3 pt-3 pb-1.5">
          {loading ? "Chargement…" : `${filteredCount} passager${filteredCount > 1 ? "s" : ""}`} · tri décroissant par création
        </div>
        <table className="w-full text-sm" data-testid="passengers-table">
          <thead className="bg-[#FAFAF7] border-y border-[#0A0A0A]/8">
            <tr className="text-left text-[0.6rem] uppercase tracking-[0.18em] text-[#0A0A0A]/65">
              <th className="px-3 py-2.5">Statut</th>
              <th className="px-3 py-2.5">Nom complet</th>
              <th className="px-3 py-2.5">Réf.</th>
              <th className="px-3 py-2.5">Catégorie</th>
              <th className="px-3 py-2.5">Date résa</th>
              <th className="px-3 py-2.5">Enregistrement</th>
              <th className="px-3 py-2.5">Embarquement</th>
              <th className="px-3 py-2.5">Bateau</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="inline animate-spin text-[#B8922A]" size={20} /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-[#0A0A0A]/50">Aucun passager pour ces filtres.</td></tr>
            ) : (
              items.map((p, idx) => {
                const meta = STATUS_TABS.find((s) => s.id === p.registration_status) || STATUS_TABS[0];
                const Icon = meta.icon;
                return (
                  <tr key={`${p.booking_id}-${idx}`} className="border-t border-[#0A0A0A]/6 hover:bg-[#FAFAF7]" data-testid={`passenger-row-${idx}`}>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.62rem] uppercase tracking-wide border"
                        style={{ borderColor: meta.color, color: meta.color }}
                      >
                        <Icon size={10} /> {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-[#0A0A0A]">{p.last_name} {p.first_name}</div>
                      {p.is_booker && (p.children_paid > 0 || p.children_free > 0) && (
                        <div className="text-[10px] text-[#0A0A0A]/55 mt-0.5">
                          + {p.children_paid > 0 && `${p.children_paid} enf. 6-12`}
                          {p.children_paid > 0 && p.children_free > 0 && " · "}
                          {p.children_free > 0 && `${p.children_free} enf. <6`}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[0.78rem]">{p.booking_ref}</td>
                    <td className="px-3 py-2.5 text-[0.82rem]">{p.category}</td>
                    <td className="px-3 py-2.5 text-[0.78rem]">{fmtDate(p.booking_date)}</td>
                    <td className="px-3 py-2.5 text-[0.78rem]">
                      {p.registered_at ? (
                        <>
                          {fmtDate(p.registered_at)}<br/>
                          <span className="text-[#0A0A0A]/45 text-[10px]">{fmtTime(p.registered_at)}</span>
                        </>
                      ) : <span className="text-[#0A0A0A]/35">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[0.78rem]">
                      {p.boarding_scanned_at ? (
                        <>
                          {fmtDate(p.boarding_scanned_at)}<br/>
                          <span className="text-[#0A0A0A]/45 text-[10px]">{fmtTime(p.boarding_scanned_at)}</span>
                        </>
                      ) : <span className="text-[#0A0A0A]/35">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[0.78rem]">
                      {p.boarding_boat_name || p.boarding_boat_time || <span className="text-[#0A0A0A]/35">—</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      {!loading && items.length > 0 && (
        <div className="text-[0.7rem] text-[#0A0A0A]/55 px-1">
          Total : <strong>{total}</strong> · En attente : <strong>{summary.en_attente || 0}</strong>
          · Enregistré : <strong>{summary.enregistre || 0}</strong>
          · Embarqué : <strong>{summary.embarque || 0}</strong>
          · Finalisé : <strong className="text-emerald-600">{summary.finalise || 0}</strong>
        </div>
      )}
    </div>
  );
}

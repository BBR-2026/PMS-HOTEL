import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Ship, Loader2, CheckCircle2, Clock, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { formatXOF } from "../../lib/i18n";

const PERIODS = [
  { v: "all",   label: "Toutes" },
  { v: "day",   label: "Aujourd'hui" },
  { v: "week",  label: "Cette semaine" },
  { v: "month", label: "Ce mois-ci" },
];

export default function StaffCharters() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total_revenue: 0, paid_count: 0 });
  const [period, setPeriod] = useState("all");
  const [boatId, setBoatId] = useState("");
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    api.get("/bateaux/charter").then(({ data }) => setBoats(data.items || [])).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = { boat_id: boatId || undefined };
      if (dateFrom || dateTo) {
        params.date_from = dateFrom || undefined;
        params.date_to = dateTo || undefined;
      } else if (period !== "all") {
        params.period = period;
      }
      const { data } = await api.get("/staff/charters", { params });
      setItems(data.items || []);
      setSummary(data.summary || { count: 0, total_revenue: 0, paid_count: 0 });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec du chargement");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [period, boatId, dateFrom, dateTo]);

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return iso.slice(0, 10); }
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-charters">
      <div className="flex items-center gap-3 mb-1">
        <Ship className="text-[#B8922A]" size={22} />
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">Privatisations de bateaux</h1>
      </div>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">
        Liste des clients ayant privatisé un bateau avec leur réservation.
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="border border-[#0A0A0A]/10 p-4 bg-white">
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Privatisations</div>
          <div className="font-display-serif text-3xl mt-1 text-[#0A0A0A]">{summary.count}</div>
        </div>
        <div className="border border-[#0A0A0A]/10 p-4 bg-white">
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">CA généré</div>
          <div className="font-display-serif text-3xl mt-1 text-[#B8922A]">{formatXOF(summary.total_revenue)}</div>
        </div>
        <div className="border border-[#0A0A0A]/10 p-4 bg-white">
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Payées</div>
          <div className="font-display-serif text-3xl mt-1 text-emerald-600">{summary.paid_count} / {summary.count}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mr-1">Période :</span>
        {PERIODS.map((p) => (
          <button
            key={p.v}
            onClick={() => { setPeriod(p.v); setDateFrom(""); setDateTo(""); }}
            disabled={!!(dateFrom || dateTo)}
            className={`px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] border transition-colors disabled:opacity-40 ${
              period === p.v && !dateFrom && !dateTo
                ? "bg-[#B8922A] text-white border-[#B8922A]"
                : "bg-white text-[#0A0A0A]/70 border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"
            }`}
            data-testid={`period-${p.v}`}
          >
            {p.label}
          </button>
        ))}
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 ml-3 mr-1">Bateau :</span>
        <select
          value={boatId}
          onChange={(e) => setBoatId(e.target.value)}
          className="px-3 py-1.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white min-w-[200px]"
          data-testid="filter-boat"
        >
          <option value="">— Tous les bateaux —</option>
          {boats.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#0A0A0A]/15 text-[0.65rem] uppercase tracking-[0.18em] hover:border-[#B8922A] hover:text-[#B8922A] disabled:opacity-50"
          data-testid="charters-refresh"
          title="Rafraîchir"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Rafraîchir
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mr-1">Dates précises :</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-2.5 py-1.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-xs bg-white"
          data-testid="filter-date-from"
        />
        <span className="text-[0.65rem] text-[#0A0A0A]/55">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-2.5 py-1.5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-xs bg-white"
          data-testid="filter-date-to"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/60 hover:text-red-600"
            data-testid="filter-clear-dates"
          >
            <X size={11} /> Effacer
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#0A0A0A]/50 py-10 justify-center">
          <Loader2 className="animate-spin" size={14} /> Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#0A0A0A]/50 border border-dashed border-[#0A0A0A]/15">
          Aucune privatisation pour cette sélection.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#0A0A0A]/10" data-testid="charters-table-wrap">
          <table className="w-full text-sm">
            <thead className="bg-[#FAF7F2]">
              <tr className="text-left text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/65">
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Horaires</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Contact</th>
                <th className="px-3 py-3">Bateau</th>
                <th className="px-3 py-3 text-right">Montant</th>
                <th className="px-3 py-3 text-right">Total réservation</th>
                <th className="px-3 py-3">Paiement</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-t border-[#0A0A0A]/8 hover:bg-[#0A0A0A]/2" data-testid={`charter-row-${b.id.slice(0, 8)}`}>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(b.date)}</td>
                  <td className="px-3 py-2.5 text-[0.78rem] text-[#0A0A0A]/75 whitespace-nowrap">
                    {b.boat_time || "—"}
                    {b.return_boat_time && <span className="text-[#0A0A0A]/40"> → {b.return_boat_time}</span>}
                  </td>
                  <td className="px-3 py-2.5">{b.name || "—"}</td>
                  <td className="px-3 py-2.5 text-[0.78rem]">
                    {b.email && <div className="truncate max-w-[200px]">{b.email}</div>}
                    {b.phone && <div className="text-[#0A0A0A]/55">{b.phone}</div>}
                  </td>
                  <td className="px-3 py-2.5">{b.charter_boat_name || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-[#B8922A] whitespace-nowrap">
                    {formatXOF(b.charter_amount || 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#0A0A0A]/75 whitespace-nowrap">
                    {formatXOF(b.total_amount || 0)}
                  </td>
                  <td className="px-3 py-2.5">
                    {b.paid_at ? (
                      <span className="inline-flex items-center gap-1 text-[0.7rem] text-emerald-600">
                        <CheckCircle2 size={12} /> Payée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[0.7rem] text-[#0A0A0A]/50">
                        <Clock size={12} /> En attente
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

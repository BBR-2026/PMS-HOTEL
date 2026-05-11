import { useEffect, useMemo, useState } from "react";
import api, { API } from "../../lib/api";
import { format, parseISO } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { Anchor, FileDown, ChevronLeft, ChevronRight, Ship, Clock, CheckCircle2, Activity, Users } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const PERIODS = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
];

const STATUS_OPTIONS = [
  { id: "", label: "Tous" },
  { id: "programmé", label: "Programmées" },
  { id: "en_cours", label: "En cours" },
  { id: "terminé", label: "Terminées" },
];

const STATUS_BADGE = {
  programmé: { label: "Programmée", color: "bg-[#FAFAF7] text-[#0A0A0A]/65 border-[#0A0A0A]/15" },
  en_cours: { label: "En cours", color: "bg-orange-50 text-orange-700 border-orange-200" },
  terminé: { label: "Terminée", color: "bg-green-50 text-green-700 border-green-200" },
};

function shiftRef(period, ref, delta) {
  const d = parseISO(ref);
  if (period === "day") d.setDate(d.getDate() + delta);
  if (period === "week") d.setDate(d.getDate() + delta * 7);
  if (period === "month") d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 10);
}

function Kpi({ icon: Icon, label, value, color = "#B8922A", sub }) {
  return (
    <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-5">
      <div className="flex items-start justify-between mb-2">
        <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">{label}</div>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A] leading-none">{value}</div>
      {sub && <div className="text-[0.65rem] text-[#0A0A0A]/45 mt-1.5">{sub}</div>}
    </div>
  );
}

export default function StaffTraverseesHistory() {
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState("week");
  const [ref, setRef] = useState(today);
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ period, date: ref });
    if (status) params.set("status", status);
    api.get(`/staff/traversees/history?${params}`)
      .then((r) => setData(r.data))
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [period, ref, status]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const raw = localStorage.getItem("bbr_staff_session");
      const token = raw ? (JSON.parse(raw).token || "") : "";
      const params = new URLSearchParams({ period, date: ref });
      if (status) params.set("status", status);
      const res = await fetch(`${API}/staff/traversees/history/report.pdf?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error("Export PDF impossible");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bbr-traversees-${period}-${ref}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Rapport téléchargé");
    } finally {
      setDownloading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!data) return [];
    if (period === "day") {
      // Group by hour-ish from depart_time
      const buckets = {};
      data.items.forEach((it) => {
        const k = it.depart_time || "—";
        buckets[k] = (buckets[k] || 0) + 1;
      });
      return Object.entries(buckets).map(([k, v]) => ({ label: k, count: v })).sort((a, b) => a.label.localeCompare(b.label));
    }
    // week / month: by_day already aggregated
    return (data.by_day || []).map((d) => ({
      label: format(parseISO(d.date), period === "week" ? "EEE d" : "d MMM", { locale: frLocale }),
      count: d.total,
      terminé: d["terminé"] || 0,
    }));
  }, [data, period]);

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-traversees-history">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">Historique des traversées</h1>
        <button
          onClick={downloadPdf}
          disabled={downloading || !data}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#B8922A] text-white text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] transition-colors disabled:opacity-50 self-start sm:self-auto"
          data-testid="download-pdf-btn"
        >
          <FileDown size={13} /> {downloading ? "Génération…" : "Rapport PDF"}
        </button>
      </div>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">Vue agrégée des traversées (programmées, en cours, terminées).</p>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 mb-4" data-testid="period-selector">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 sm:px-4 py-2 text-[0.65rem] sm:text-[0.7rem] uppercase tracking-[0.22em] border transition-all ${
              period === p.id
                ? "bg-[#B8922A] text-white border-[#B8922A]"
                : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
            }`}
            data-testid={`period-${p.id}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Status filter + date navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setRef(shiftRef(period, ref, -1))} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]" data-testid="ref-prev">
            <ChevronLeft size={14} />
          </button>
          <input
            type="date"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className="border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] focus:outline-none"
            data-testid="ref-date"
          />
          <button onClick={() => setRef(shiftRef(period, ref, 1))} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]" data-testid="ref-next">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.id || "all"}
              onClick={() => setStatus(s.id)}
              className={`px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.22em] border transition-all ${
                status === s.id
                  ? "bg-[#B8922A] text-white border-[#B8922A]"
                  : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
              }`}
              data-testid={`status-filter-${s.id || "all"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <div className="mb-6 text-sm text-[#0A0A0A]/70" data-testid="history-label">
          {data.label}
          <span className="text-[#0A0A0A]/45 ml-2">· {data.total} traversée(s)</span>
        </div>
      )}

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Kpi icon={Ship} label="Total" value={data.total} />
          <Kpi icon={Clock} label="Programmées" value={data.by_status["programmé"] || 0} color="#9CA3AF" />
          <Kpi icon={Activity} label="En cours" value={data.by_status["en_cours"] || 0} color="#F97316" />
          <Kpi icon={CheckCircle2} label="Terminées" value={data.by_status["terminé"] || 0} color="#16A34A" />
          <Kpi icon={Users} label="Passagers" value={data.total_guests} sub={`${data.by_direction["aller"] || 0} aller · ${data.by_direction["retour"] || 0} retour`} />
        </div>
      )}

      {/* Chart */}
      {data && chartData.length > 0 && (
        <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-5 mb-6">
          <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">
            {period === "day" ? "Répartition par horaire" : "Évolution journalière"}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#999" />
              <YAxis tick={{ fontSize: 11 }} stroke="#999" allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="#B8922A" name="Total" radius={[2, 2, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#B8922A" />
                ))}
              </Bar>
              {period !== "day" && <Bar dataKey="terminé" fill="#16A34A" name="Terminées" radius={[2, 2, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By boat */}
      {data && data.by_boat?.length > 0 && (
        <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-5 mb-6">
          <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">Répartition par bateau</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                  <th className="text-left py-2">Bateau</th>
                  <th className="text-center py-2">Total</th>
                  <th className="text-center py-2">Terminées</th>
                  <th className="text-right py-2">Passagers</th>
                </tr>
              </thead>
              <tbody>
                {data.by_boat.map((b) => (
                  <tr key={b.bateau_id} className="border-b border-[#0A0A0A]/5">
                    <td className="py-2 text-[#0A0A0A]">{b.bateau_name}</td>
                    <td className="py-2 text-center">{b.total}</td>
                    <td className="py-2 text-center text-green-700">{b["terminé"]}</td>
                    <td className="py-2 text-right font-medium">{b.guests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Crossings list */}
      <div className="bg-white border border-[#0A0A0A]/8" data-testid="crossings-list">
        <div className="hidden md:grid grid-cols-12 text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50 px-5 py-3 border-b border-[#0A0A0A]/10 bg-[#FAFAF7]">
          <div className="col-span-2">Date</div>
          <div className="col-span-1">Heure</div>
          <div className="col-span-2">Direction</div>
          <div className="col-span-3">Bateau</div>
          <div className="col-span-2">Statut</div>
          <div className="col-span-2 text-right">Passagers</div>
        </div>
        {loading && <div className="p-6 text-sm text-[#0A0A0A]/50">Chargement…</div>}
        {!loading && (!data?.items || data.items.length === 0) && (
          <div className="p-6 text-sm text-[#0A0A0A]/50">Aucune traversée pour cette période.</div>
        )}
        {data?.items?.map((it) => {
          const st = STATUS_BADGE[it.status] || { label: it.status, color: "border-[#0A0A0A]/15" };
          return (
            <div
              key={it.id}
              className="md:grid md:grid-cols-12 md:items-center flex flex-col items-start gap-2 md:gap-0 px-5 py-3.5 border-b border-[#0A0A0A]/5 hover:bg-[#FAFAF7] transition-colors"
              data-testid={`crossing-row-${it.id}`}
            >
              <div className="md:col-span-2 text-sm text-[#0A0A0A]">{it.date}</div>
              <div className="md:col-span-1 text-sm text-[#B8922A] font-medium">{it.depart_time}</div>
              <div className="md:col-span-2 text-sm text-[#0A0A0A]/70 capitalize">{it.direction}</div>
              <div className="md:col-span-3 text-sm text-[#0A0A0A]/75">{it.bateau_name}</div>
              <div className="md:col-span-2">
                <span className={`inline-block px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] border ${st.color}`}>{st.label}</span>
              </div>
              <div className="md:col-span-2 md:text-right text-sm w-full flex md:block items-center justify-between">
                <span className="md:hidden text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50">Passagers</span>
                <span className="font-medium">{it.guests}</span>
                <span className="text-[0.7rem] text-[#0A0A0A]/45 ml-1">({it.passenger_count} résa.)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

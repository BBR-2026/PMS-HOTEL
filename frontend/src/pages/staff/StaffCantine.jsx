import { useEffect, useState } from "react";
import {
  UtensilsCrossed, Users, Calendar, CheckCircle2, AlertTriangle,
  Loader2, FileSpreadsheet, FileText, Briefcase, Building2,
  TrendingUp, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const STATUS_LABEL = {
  reserved: { label: "Réservé", color: "#D97706", bg: "#FEF3C7" },
  consumed: { label: "Consommé", color: "#16A34A", bg: "#D1FAE5" },
  absent:   { label: "Absent",   color: "#DC2626", bg: "#FEE2E2" },
};

const SCOPES = [
  { id: "tomorrow", label: "Demain" },
  { id: "today",    label: "Aujourd'hui" },
];

export default function StaffCantine() {
  const [dash, setDash] = useState(null);
  const [scope, setScope] = useState("tomorrow");
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: d }, { data: r }] = await Promise.all([
        api.get("/staff/cantine/dashboard"),
        api.get("/staff/cantine/reservations", { params: { scope } }),
      ]);
      setDash(d);
      setReservations(r.items || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope]);

  const downloadFile = async (type) => {
    try {
      const res = await api.get(`/staff/cantine/exports/${type}`, {
        params: { scope }, responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `cantine_${scope}.${type === "xlsx" ? "xlsx" : "pdf"}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Échec du téléchargement");
    }
  };

  if (loading || !dash) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="cantine-dashboard-loading">
        <Loader2 className="animate-spin text-[#B8922A]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="staff-cantine-dashboard">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[0.62rem] uppercase tracking-[0.3em] text-[#B8922A] mb-1 inline-flex items-center gap-1.5">
            <UtensilsCrossed size={11} /> Cantine du personnel
          </div>
          <h1 className="font-display-serif text-3xl text-[#0A0A0A]">
            Tableau de bord cantine
          </h1>
          <p className="text-sm text-[#0A0A0A]/55 mt-1">
            Anticiper la cuisine, suivre la présence, contrôler les crédits.
          </p>
        </div>
        <div className="inline-flex items-center bg-white border border-[#0A0A0A]/10">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              data-testid={`cantine-scope-${s.id}`}
              className={`px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] transition-colors ${
                scope === s.id
                  ? "bg-[#B8922A] text-white"
                  : "text-[#0A0A0A]/65 hover:bg-[#FAF7F2]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Repas prévus demain" value={dash.tomorrow_total}
                 icon={Calendar} tone="primary" testid="kpi-tomorrow-total" />
        <KpiCard label="Consommés aujourd'hui" value={dash.today_consumed}
                 icon={CheckCircle2} tone="success" testid="kpi-today-consumed" />
        <KpiCard label="Absents aujourd'hui" value={dash.today_absent}
                 icon={AlertTriangle} tone="danger" testid="kpi-today-absent" />
        <KpiCard label="Taux de présence" value={`${dash.attendance_rate}%`}
                 icon={TrendingUp} tone="neutral" testid="kpi-attendance-rate" />
      </div>

      {/* Repartition by category & service */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-[#0A0A0A]/10 p-5">
          <h3 className="font-display-serif text-lg text-[#0A0A0A] mb-3">
            Demain — par catégorie
          </h3>
          <BreakdownRow icon={Users} label="Personnel"
                        value={dash.tomorrow_personnel} accent="#B8922A" />
          <BreakdownRow icon={Briefcase} label="Prestataires"
                        value={dash.tomorrow_prestataire} accent="#0A0A0A" />
          <div className="border-t border-[#0A0A0A]/8 mt-3 pt-3 flex items-baseline justify-between">
            <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55">
              Total
            </span>
            <span className="font-display-serif text-2xl text-[#0A0A0A]">
              {dash.tomorrow_total}
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#0A0A0A]/10 p-5 lg:col-span-2">
          <h3 className="font-display-serif text-lg text-[#0A0A0A] mb-3">
            Demain — par service
          </h3>
          {dash.by_service_tomorrow.length === 0 ? (
            <p className="text-sm text-[#0A0A0A]/45">Aucune réservation pour demain.</p>
          ) : (
            <div className="space-y-2">
              {dash.by_service_tomorrow.map((s) => (
                <div key={s.service} className="flex items-baseline gap-3" data-testid={`svc-row-${s.service}`}>
                  <Building2 size={12} className="text-[#B8922A] flex-shrink-0" />
                  <span className="text-sm text-[#0A0A0A]/80 flex-1 truncate">{s.service}</span>
                  <div className="flex-1 h-2 bg-[#0A0A0A]/5 rounded">
                    <div
                      className="h-full bg-[#B8922A] rounded transition-all"
                      style={{ width: `${(s.count / Math.max(1, dash.tomorrow_total)) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm text-[#0A0A0A] w-8 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reservations list + exports */}
      <div className="bg-white border border-[#0A0A0A]/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#0A0A0A]/8">
          <h3 className="font-display-serif text-lg text-[#0A0A0A]">
            Liste — {scope === "tomorrow" ? "Demain" : "Aujourd'hui"} ({reservations.length})
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => downloadFile("xlsx")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#0A0A0A]/15 hover:border-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#B8922A]"
              data-testid="cantine-export-xlsx"
            >
              <FileSpreadsheet size={12} /> Excel
            </button>
            <button
              onClick={() => downloadFile("pdf")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#0A0A0A]/15 hover:border-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#B8922A]"
              data-testid="cantine-export-pdf"
            >
              <FileText size={12} /> PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="cantine-reservations-table">
            <thead>
              <tr className="bg-[#FAF7F2] text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 text-left">
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Nom & prénom</th>
                <th className="px-4 py-2.5">Service</th>
                <th className="px-4 py-2.5">Fonction</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Inscrit</th>
                <th className="px-4 py-2.5">Consommé</th>
                <th className="px-4 py-2.5">Statut</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[#0A0A0A]/45">
                    Aucune réservation pour ce jour.
                  </td>
                </tr>
              ) : reservations.map((r) => {
                const meta = STATUS_LABEL[r.status] || {};
                return (
                  <tr key={r.id} className="border-t border-[#0A0A0A]/5 hover:bg-[#FAF7F2]/60">
                    <td className="px-4 py-2.5 font-mono text-[#0A0A0A]">{r.user_code}</td>
                    <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">
                      {r.last_name} {r.first_name}
                    </td>
                    <td className="px-4 py-2.5 text-[#0A0A0A]/70">{r.service}</td>
                    <td className="px-4 py-2.5 text-[#0A0A0A]/70 text-[0.78rem]">{r.position}</td>
                    <td className="px-4 py-2.5 text-[#0A0A0A]/70 text-[0.78rem]">
                      {r.type === "personnel" ? "Personnel" : "Prestataire"}
                    </td>
                    <td className="px-4 py-2.5 text-[0.78rem] text-[#0A0A0A]/55">
                      {(r.reserved_at || "").slice(11, 16)}
                    </td>
                    <td className="px-4 py-2.5 text-[0.78rem] text-[#0A0A0A]/55">
                      {(r.consumed_at || "—").slice(11, 16)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.15em] font-medium"
                        style={{ backgroundColor: meta.bg, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[0.7rem] text-[#0A0A0A]/45 flex items-center gap-2">
        <ChevronRight size={11} /> Le pointage tablette est disponible dans le menu
        « Cantine — Pointage » (l'accès est aussi ouvert aux hôtesses).
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone, testid }) {
  const tones = {
    primary: { bg: "#FAF3DC", color: "#B8922A" },
    success: { bg: "#D1FAE5", color: "#16A34A" },
    danger:  { bg: "#FEE2E2", color: "#DC2626" },
    neutral: { bg: "#F3F4F6", color: "#0A0A0A" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-4" data-testid={testid}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50">
          {label}
        </span>
        <div className="w-7 h-7 flex items-center justify-center rounded-full"
             style={{ backgroundColor: t.bg, color: t.color }}>
          <Icon size={13} />
        </div>
      </div>
      <div className="font-display-serif text-3xl text-[#0A0A0A]">{value}</div>
    </div>
  );
}

function BreakdownRow({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-baseline gap-3 py-2 border-b border-[#0A0A0A]/5 last:border-0">
      <Icon size={12} className="flex-shrink-0" style={{ color: accent }} />
      <span className="text-sm text-[#0A0A0A]/80 flex-1">{label}</span>
      <span className="font-display-serif text-xl text-[#0A0A0A]">{value}</span>
    </div>
  );
}

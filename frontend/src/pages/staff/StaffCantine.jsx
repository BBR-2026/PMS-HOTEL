import { useEffect, useState } from "react";
import {
  UtensilsCrossed, Users, Calendar, CheckCircle2, AlertTriangle,
  Loader2, FileSpreadsheet, FileText, Briefcase, Building2,
  TrendingUp, ChevronRight, RefreshCw, Settings as SettingsIcon, X,
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
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const load = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [{ data: d }, { data: r }] = await Promise.all([
        api.get("/staff/cantine/dashboard"),
        api.get("/staff/cantine/reservations", { params: { scope } }),
      ]);
      setDash(d);
      setReservations(r.items || []);
      setLastRefresh(new Date());
      if (silent) toast.success("Données mises à jour");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec du chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      <div className="p-4 sm:p-6 flex items-center justify-center py-20" data-testid="cantine-dashboard-loading">
        <Loader2 className="animate-spin text-[#B8922A]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-7xl" data-testid="staff-cantine-dashboard">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-1 inline-flex items-center gap-1.5">
            <UtensilsCrossed size={11} /> Cantine du personnel
          </div>
          <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A]">
            Tableau de bord cantine
          </h1>
          <p className="text-sm text-[#0A0A0A]/60 mt-1 max-w-2xl">
            Anticiper la cuisine, suivre la présence, contrôler les crédits.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <a
            href="/Manuel_Cantine_BBr.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#B8922A]/40 hover:bg-[#FAF7F2] text-[0.7rem] uppercase tracking-[0.18em] text-[#B8922A]"
            data-testid="cantine-manual-pdf"
            title="Télécharger le manuel d'utilisation (PDF)"
          >
            <FileText size={12} /> Manuel
          </a>
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#0A0A0A]/10 hover:border-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#B8922A]"
            data-testid="cantine-open-settings"
          >
            <SettingsIcon size={12} /> Paramètres
          </button>
          <button
            onClick={() => load({ silent: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#0A0A0A]/10 hover:border-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#B8922A] disabled:opacity-50"
            data-testid="cantine-refresh-dashboard"
            title={lastRefresh ? `Dernière mise à jour : ${lastRefresh.toLocaleTimeString("fr-FR")}` : ""}
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Rafraîchir
          </button>
        </div>
      </div>

      {lastRefresh && (
        <div className="text-[0.7rem] text-[#0A0A0A]/45 -mt-3" data-testid="cantine-last-refresh">
          Dernière mise à jour : {lastRefresh.toLocaleTimeString("fr-FR")}
        </div>
      )}

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

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  <span className="text-sm text-[#0A0A0A]/80 flex-1 truncate min-w-[80px]">{s.service}</span>
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
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#0A0A0A]/8 gap-3 flex-wrap">
          <h3 className="font-display-serif text-lg text-[#0A0A0A]">
            Liste — {scope === "tomorrow" ? "Demain" : "Aujourd'hui"} ({reservations.length})
          </h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={async () => {
                const date = scope === "tomorrow"
                  ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
                  : new Date().toISOString().slice(0, 10);
                if (!window.confirm(`Clôturer définitivement les inscriptions du ${date} ?`)) return;
                try {
                  await api.post(`/staff/cantine/manual-close/${date}`);
                  toast.success(`Inscriptions du ${date} clôturées`);
                  load({ silent: true });
                } catch (e) {
                  toast.error(e.response?.data?.detail || "Échec");
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 hover:border-red-500 text-[0.7rem] uppercase tracking-[0.18em] text-red-600 hover:text-red-700"
              data-testid="cantine-manual-close"
            >
              Clôturer
            </button>
            <button
              onClick={async () => {
                const date = scope === "tomorrow"
                  ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
                  : new Date().toISOString().slice(0, 10);
                try {
                  await api.post(`/staff/cantine/manual-reopen/${date}`);
                  toast.success(`Inscriptions du ${date} rouvertes`);
                  load({ silent: true });
                } catch (e) {
                  toast.error(e.response?.data?.detail || "Échec");
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#15803D]/40 hover:border-[#15803D] text-[0.7rem] uppercase tracking-[0.18em] text-[#15803D] hover:text-[#15803D]"
              data-testid="cantine-manual-reopen"
            >
              Rouvrir
            </button>
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
                <th className="px-4 py-2.5 hidden md:table-cell">Fonction</th>
                <th className="px-4 py-2.5 hidden sm:table-cell">Type</th>
                <th className="px-4 py-2.5 hidden lg:table-cell">Inscrit</th>
                <th className="px-4 py-2.5 hidden lg:table-cell">Consommé</th>
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
                    <td className="px-4 py-2.5 text-[#0A0A0A]/70 text-[0.78rem] hidden md:table-cell">{r.position}</td>
                    <td className="px-4 py-2.5 text-[#0A0A0A]/70 text-[0.78rem] hidden sm:table-cell">
                      {r.type === "personnel" ? "Personnel" : "Prestataire"}
                    </td>
                    <td className="px-4 py-2.5 text-[0.78rem] text-[#0A0A0A]/55 hidden lg:table-cell">
                      {(r.reserved_at || "").slice(11, 16)}
                    </td>
                    <td className="px-4 py-2.5 text-[0.78rem] text-[#0A0A0A]/55 hidden lg:table-cell">
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
        <ChevronRight size={11} /> Pointage tablette : menu « Cantine — Pointage ».
        Personnel enregistré : menu « Cantine — Personnel ».
      </div>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
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
      <div className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A]">{value}</div>
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

// ─────────────────────────────────────────────────────────────────────────
// Settings Modal — admin-configurable reservation window + monthly credits
// ─────────────────────────────────────────────────────────────────────────
function SettingsModal({ onClose }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/staff/cantine/settings").then(({ data }) => setForm({
      meal_offset_days: data.meal_offset_days ?? 1,
      reservation_open_hhmm: data.reservation_open_hhmm || "00:00",
      reservation_close_hhmm: data.reservation_close_hhmm || "23:59",
      default_credits_personnel: data.default_credits_personnel ?? 22,
      default_credits_prestataire: data.default_credits_prestataire ?? 0,
      auto_renew_enabled: data.auto_renew_enabled !== false,
      max_capacity_per_day: data.max_capacity_per_day ?? 100,
      waitlist_enabled: data.waitlist_enabled !== false,
    })).catch(() => toast.error("Impossible de charger les paramètres"));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/staff/cantine/settings", form);
      toast.success("Paramètres enregistrés");
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <Loader2 className="text-white animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in"
         data-testid="cantine-settings-modal">
      <div className="bg-white shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-2 relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 hover:bg-[#FAF7F2] rounded">
          <X size={16} />
        </button>
        <div className="p-6">
          <div className="text-[0.62rem] uppercase tracking-[0.3em] text-[#B8922A] mb-1">
            Configuration cantine
          </div>
          <h3 className="font-display-serif text-2xl text-[#0A0A0A] mb-6">
            Paramètres de réservation
          </h3>

          {/* Reservation window */}
          <div className="border border-[#0A0A0A]/10 p-4 mb-4">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3 font-medium">
              Fenêtre d&apos;inscription
            </div>

            <div className="mb-4">
              <label className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 block mb-1.5">
                Jour du repas réservé
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 1, l: "Demain (recommandé)" },
                  { v: 2, l: "J+2" },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setForm((f) => ({ ...f, meal_offset_days: o.v }))}
                    data-testid={`settings-offset-${o.v}`}
                    className={`py-2 text-[0.7rem] uppercase tracking-[0.18em] border ${
                      form.meal_offset_days === o.v
                        ? "bg-[#B8922A] text-white border-[#B8922A]"
                        : "bg-white text-[#0A0A0A]/70 border-[#0A0A0A]/15 hover:border-[#B8922A]"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
              <p className="text-[0.7rem] text-[#0A0A0A]/45 mt-2">
                Les employés s&apos;inscrivent toujours au minimum pour le lendemain.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 block mb-1">
                  Ouverture (HH:MM)
                </label>
                <input
                  type="time"
                  value={form.reservation_open_hhmm}
                  onChange={(e) => setForm((f) => ({ ...f, reservation_open_hhmm: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
                  data-testid="settings-open-hhmm"
                />
              </div>
              <div>
                <label className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 block mb-1">
                  Clôture (HH:MM)
                </label>
                <input
                  type="time"
                  value={form.reservation_close_hhmm}
                  onChange={(e) => setForm((f) => ({ ...f, reservation_close_hhmm: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
                  data-testid="settings-close-hhmm"
                />
              </div>
            </div>
            <p className="text-[0.7rem] text-[#0A0A0A]/45 mt-2">
              Heure Abidjan (UTC+0). Si la fermeture est antérieure à l&apos;ouverture
              (ex. 18:00 → 09:00), la fenêtre traverse minuit.
            </p>
          </div>

          {/* Credits */}
          <div className="border border-[#0A0A0A]/10 p-4 mb-4">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3 font-medium">
              Crédits repas mensuels (par défaut)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 block mb-1">
                  Personnel
                </label>
                <input
                  type="number" min="0" max="62"
                  value={form.default_credits_personnel}
                  onChange={(e) => setForm((f) => ({ ...f, default_credits_personnel: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
                  data-testid="settings-credits-personnel"
                />
              </div>
              <div>
                <label className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 block mb-1">
                  Prestataires
                </label>
                <input
                  type="number" min="0" max="62"
                  value={form.default_credits_prestataire}
                  onChange={(e) => setForm((f) => ({ ...f, default_credits_prestataire: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
                  data-testid="settings-credits-prestataire"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.auto_renew_enabled}
                onChange={(e) => setForm((f) => ({ ...f, auto_renew_enabled: e.target.checked }))}
                className="w-4 h-4 accent-[#B8922A]"
                data-testid="settings-auto-renew"
              />
              <span className="text-sm text-[#0A0A0A]/75">
                Renouvellement automatique le 1<sup>er</sup> de chaque mois
              </span>
            </label>
          </div>

          {/* Prompt 3 — Capacity & waitlist */}
          <div className="border border-[#0A0A0A]/10 p-4 mb-4">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3 font-medium">
              Capacité & liste d&apos;attente
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 block mb-1">
                  Capacité max / jour
                </label>
                <input
                  type="number" min="0" max="10000"
                  value={form.max_capacity_per_day}
                  onChange={(e) => setForm((f) => ({ ...f, max_capacity_per_day: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
                  data-testid="settings-max-capacity"
                />
                <p className="text-[10px] text-[#0A0A0A]/45 mt-1">0 = illimité</p>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.waitlist_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, waitlist_enabled: e.target.checked }))}
                    className="w-4 h-4 accent-[#B8922A]"
                    data-testid="settings-waitlist-enabled"
                  />
                  <span className="text-sm text-[#0A0A0A]/75">
                    Liste d&apos;attente si capacité atteinte
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-50 text-white py-2.5 text-[0.7rem] uppercase tracking-[0.22em]"
              data-testid="settings-save"
            >
              {saving ? <Loader2 size={13} className="animate-spin inline" /> : "Enregistrer"}
            </button>
            <button
              onClick={onClose}
              className="px-4 bg-white hover:bg-[#FAF7F2] border border-[#0A0A0A]/15 text-[#0A0A0A]/70 py-2.5 text-[0.7rem] uppercase tracking-[0.22em]"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

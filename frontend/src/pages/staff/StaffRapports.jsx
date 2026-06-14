import { useEffect, useMemo, useState } from "react";
import {
  FileText, Anchor, Ship, UserCheck, TrendingUp, Calendar, Download,
  Loader2, FileSpreadsheet, CheckSquare, Square,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const REPORT_META = {
  reservation:      { label: "Réservations",       icon: FileText,   accent: "#B8922A" },
  embarquement:     { label: "Embarquements",      icon: Anchor,     accent: "#0EA5E9" },
  traversee:        { label: "Traversées",         icon: Ship,       accent: "#0A0A0A" },
  enregistrement:   { label: "Enregistrements",    icon: UserCheck,  accent: "#16A34A" },
  chiffre_affaires: { label: "Chiffre d'affaires", icon: TrendingUp, accent: "#9333EA" },
};

const PERIODS = [
  { id: "day",    label: "Aujourd'hui" },
  { id: "week",   label: "Cette semaine" },
  { id: "month",  label: "Ce mois" },
  { id: "custom", label: "Personnalisé" },
];

export default function StaffRapports() {
  const [schema, setSchema] = useState(null);
  const [reportType, setReportType] = useState("reservation");
  const [period, setPeriod] = useState("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState({});      // {reportType: [colKeys]}
  const [format, setFormat] = useState("pdf");
  const [loading, setLoading] = useState(false);

  // Load catalog
  useEffect(() => {
    api.get("/staff/reports/custom/schema").then(({ data }) => {
      setSchema(data);
      // Default: all columns selected for each type
      const sel = {};
      data.reports.forEach((r) => { sel[r.key] = r.columns.map((c) => c.key); });
      setSelected(sel);
    }).catch(() => toast.error("Impossible de charger le catalogue des rapports"));
  }, []);

  const currentReport = useMemo(() => {
    if (!schema) return null;
    return schema.reports.find((r) => r.key === reportType);
  }, [schema, reportType]);

  const currentColumns = selected[reportType] || [];

  const toggleColumn = (col) => {
    setSelected((s) => {
      const cur = s[reportType] || [];
      const next = cur.includes(col) ? cur.filter((c) => c !== col) : [...cur, col];
      return { ...s, [reportType]: next };
    });
  };

  const selectAll = () => {
    if (!currentReport) return;
    setSelected((s) => ({ ...s, [reportType]: currentReport.columns.map((c) => c.key) }));
  };

  const clearAll = () => {
    setSelected((s) => ({ ...s, [reportType]: [] }));
  };

  const generate = async () => {
    if (currentColumns.length === 0) {
      toast.error("Sélectionnez au moins une colonne");
      return;
    }
    if (period === "custom" && (!dateFrom || !dateTo)) {
      toast.error("Renseignez la période personnalisée");
      return;
    }
    if (period === "custom" && dateFrom > dateTo) {
      toast.error("La date de début doit précéder la date de fin");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        report_type: reportType,
        period,
        columns: currentColumns,
        format,
      };
      if (period === "custom") {
        payload.date_from = dateFrom;
        payload.date_to = dateTo;
      }
      const res = await api.post("/staff/reports/custom", payload, { responseType: "blob" });
      // Build filename from content-disposition or fallback
      const cd = res.headers["content-disposition"] || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `BBR-${reportType}.${format}`;
      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Rapport ${format.toUpperCase()} téléchargé`);
    } catch (err) {
      const detail = err.response?.data?.detail
        || (err.response?.data instanceof Blob ? "Erreur serveur" : null)
        || "Échec de génération du rapport";
      toast.error(typeof detail === "string" ? detail : "Échec de génération");
    } finally {
      setLoading(false);
    }
  };

  if (!schema) {
    return (
      <div className="p-8 text-center text-[#0A0A0A]/50 text-sm" data-testid="rapports-loading">
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl" data-testid="staff-rapports">
      <header>
        <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-1">
          Rapports personnalisés
        </div>
        <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A]">
          Générer un rapport
        </h1>
        <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
          Choisissez le type de rapport, la période et les colonnes à inclure.
          Le fichier est généré en PDF (avec graphique) ou en Excel.
        </p>
      </header>

      {/* Step 1 — Type */}
      <section className="bg-white border border-[#0A0A0A]/10 p-4 sm:p-5">
        <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3">
          1. Type de rapport
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          {schema.reports.map((r) => {
            const meta = REPORT_META[r.key] || {};
            const Icon = meta.icon || FileText;
            const isActive = r.key === reportType;
            return (
              <button
                key={r.key}
                onClick={() => setReportType(r.key)}
                className={`p-3 border text-left transition-all ${
                  isActive
                    ? "border-[#B8922A] bg-[#FAF7F2] shadow-[0_0_0_1px_#B8922A_inset]"
                    : "border-[#0A0A0A]/12 bg-white hover:border-[#0A0A0A]/30"
                }`}
                data-testid={`report-type-${r.key}`}
              >
                <Icon size={18} style={{ color: isActive ? meta.accent : "#0A0A0A" }} className="mb-1.5" />
                <div className="text-xs font-medium text-[#0A0A0A]">{r.label}</div>
                <div className="text-[10px] text-[#0A0A0A]/50 mt-0.5">
                  {r.columns.length} colonnes disponibles
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2 — Period */}
      <section className="bg-white border border-[#0A0A0A]/10 p-4 sm:p-5">
        <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3 flex items-center gap-2">
          <Calendar size={12} /> 2. Période
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3.5 py-1.5 text-xs uppercase tracking-wide border transition-colors ${
                period === p.id
                  ? "border-[#B8922A] bg-[#B8922A] text-white"
                  : "border-[#0A0A0A]/15 text-[#0A0A0A]/75 hover:border-[#0A0A0A]/35"
              }`}
              data-testid={`period-${p.id}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="grid sm:grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-[#0A0A0A]/60 block mb-1">Du</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-[#0A0A0A]/15 text-sm focus:outline-none focus:border-[#B8922A]"
                data-testid="date-from"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-[#0A0A0A]/60 block mb-1">Au</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-[#0A0A0A]/15 text-sm focus:outline-none focus:border-[#B8922A]"
                data-testid="date-to"
              />
            </div>
          </div>
        )}
      </section>

      {/* Step 3 — Columns */}
      <section className="bg-white border border-[#0A0A0A]/10 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">
            3. Colonnes ({currentColumns.length} sélectionnée{currentColumns.length > 1 ? "s" : ""})
          </div>
          <div className="flex gap-1.5 text-[10px]">
            <button
              onClick={selectAll}
              className="px-2.5 py-1 border border-[#0A0A0A]/15 hover:border-[#B8922A] uppercase tracking-wide text-[#0A0A0A]/70 hover:text-[#B8922A]"
              data-testid="select-all-cols"
            >
              Tout cocher
            </button>
            <button
              onClick={clearAll}
              className="px-2.5 py-1 border border-[#0A0A0A]/15 hover:border-[#0A0A0A] uppercase tracking-wide text-[#0A0A0A]/70"
              data-testid="clear-all-cols"
            >
              Tout décocher
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {currentReport?.columns.map((c) => {
            const isOn = currentColumns.includes(c.key);
            const Box = isOn ? CheckSquare : Square;
            return (
              <button
                key={c.key}
                onClick={() => toggleColumn(c.key)}
                className={`p-2.5 flex items-center gap-2 text-left text-sm border transition-colors ${
                  isOn
                    ? "border-[#B8922A] bg-[#FAF7F2] text-[#0A0A0A]"
                    : "border-[#0A0A0A]/12 text-[#0A0A0A]/80 hover:border-[#0A0A0A]/35"
                }`}
                data-testid={`col-${c.key}`}
              >
                <Box size={15} className={isOn ? "text-[#B8922A]" : "text-[#0A0A0A]/40"} />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 4 — Format + generate */}
      <section className="bg-[#0A0A0A] text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-1.5">
            4. Format
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat("pdf")}
              className={`px-3.5 py-1.5 text-xs uppercase tracking-wide border transition-colors inline-flex items-center gap-1.5 ${
                format === "pdf"
                  ? "border-[#B8922A] bg-[#B8922A] text-white"
                  : "border-white/20 text-white/70 hover:border-white/50"
              }`}
              data-testid="format-pdf"
            >
              <FileText size={13} /> PDF
            </button>
            <button
              onClick={() => setFormat("xlsx")}
              className={`px-3.5 py-1.5 text-xs uppercase tracking-wide border transition-colors inline-flex items-center gap-1.5 ${
                format === "xlsx"
                  ? "border-[#B8922A] bg-[#B8922A] text-white"
                  : "border-white/20 text-white/70 hover:border-white/50"
              }`}
              data-testid="format-xlsx"
            >
              <FileSpreadsheet size={13} /> Excel
            </button>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading || currentColumns.length === 0}
          className="bg-[#B8922A] hover:bg-[#9d7a23] text-white px-5 py-2.5 text-xs uppercase tracking-[0.22em] disabled:opacity-40 inline-flex items-center gap-2"
          data-testid="generate-report-btn"
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" /> Génération…</>
          ) : (
            <><Download size={14} /> Générer le rapport</>
          )}
        </button>
      </section>
    </div>
  );
}

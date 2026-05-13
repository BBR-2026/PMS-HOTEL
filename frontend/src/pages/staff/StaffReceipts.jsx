import { useEffect, useMemo, useState } from "react";
import api, { getStaffToken } from "../../lib/api";
import { ReceiptText, Search, FileDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";

const SOURCES = [
  { id: "", label: "Tous", color: "#0A0A0A" },
  { id: "activity", label: "Activités", color: "#B8922A" },
  { id: "booking", label: "Réservations", color: "#16A34A" },
  { id: "event", label: "Événements", color: "#2563EB" },
];
const SOURCE_FR = {
  activity: "Activité",
  booking: "Réservation",
  event: "Événement",
};
const PAYMENT_FR = {
  card: "Carte",
  fineo: "Carte",
  mobile_money: "Mobile Money",
  cash: "Espèces",
  deposit: "Acompte",
  on_site: "Sur place",
  transfer: "Virement",
};

const fmtXOF = (n) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n || 0))} FCFA`;

function formatDateTimeFR(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export default function StaffReceipts() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "30" });
      if (source) params.append("source", source);
      if (search) params.append("q", search);
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      const { data } = await api.get(`/staff/receipts?${params}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setSummary(data.summary_by_source || {});
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, source, search, dateFrom, dateTo]);

  const downloadPdf = async (receipt) => {
    const token = getStaffToken();
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/staff/receipts/${receipt.id}.pdf`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      toast.error("Téléchargement impossible");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${receipt.receipt_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const grandTotal = useMemo(
    () => Object.values(summary).reduce((s, x) => s + (x.total || 0), 0),
    [summary],
  );

  const resetFilters = () => {
    setSource("");
    setDateFrom("");
    setDateTo("");
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-receipts">
      <div className="mb-8">
        <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] inline-flex items-center gap-3">
          <ReceiptText size={26} className="text-[#B8922A]" />
          Reçus de paiement
        </h1>
        <p className="text-sm text-[#0A0A0A]/55 mt-1">
          Historique signé numériquement de tous les paiements (activités, réservations, événements).
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6" data-testid="receipts-summary">
        <SummaryCard label="Total reçus" value={total} subtitle={`${fmtXOF(grandTotal)} encaissé`} accent />
        <SummaryCard label="Activités" value={summary.activity?.count || 0} subtitle={fmtXOF(summary.activity?.total || 0)} />
        <SummaryCard label="Réservations" value={summary.booking?.count || 0} subtitle={fmtXOF(summary.booking?.total || 0)} />
        <SummaryCard label="Événements" value={summary.event?.count || 0} subtitle={fmtXOF(summary.event?.total || 0)} />
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#0A0A0A]/8 p-4 sm:p-5 mb-6" data-testid="receipts-filters">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Recherche</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/40" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearch(searchInput);
                    setPage(1);
                  }
                }}
                placeholder="N° de reçu, client, email, téléphone…"
                className="w-full pl-9 pr-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white"
                data-testid="receipts-search"
              />
            </div>
          </div>
          <div>
            <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white"
              data-testid="receipts-date-from"
            />
          </div>
          <div>
            <label className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] outline-none text-sm bg-white"
              data-testid="receipts-date-to"
            />
          </div>
          <button
            onClick={resetFilters}
            className="px-4 py-2 text-[0.65rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/65 hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors"
            data-testid="receipts-reset"
          >
            Réinitialiser
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-4" data-testid="receipts-source-tabs">
          {SOURCES.map((s) => (
            <button
              key={s.id || "all"}
              onClick={() => { setSource(s.id); setPage(1); }}
              className={`px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.22em] border transition-all ${
                source === s.id
                  ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                  : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
              }`}
              data-testid={`receipts-source-${s.id || "all"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#0A0A0A]/8 overflow-x-auto" data-testid="receipts-table">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10 bg-[#FAFAF7]">
              <th className="py-3 px-4">N° reçu</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4 text-right">Montant</th>
              <th className="py-3 px-4">Mode</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#0A0A0A]/50">Chargement…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#0A0A0A]/50">Aucun reçu pour cette recherche.</td></tr>
            ) : (
              items.map((r) => {
                const srcColor = SOURCES.find((s) => s.id === r.source)?.color || "#0A0A0A";
                return (
                  <tr key={r.id} className="border-b border-[#0A0A0A]/5 hover:bg-[#FAFAF7]/60" data-testid={`receipt-row-${r.id}`}>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setSelected(r)}
                        className="font-mono text-[0.78rem] text-[#0A0A0A] hover:text-[#B8922A]"
                        data-testid={`receipt-open-${r.id}`}
                      >
                        {r.receipt_number}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-[0.78rem] text-[#0A0A0A]/75">{formatDateTimeFR(r.issued_at)}</td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] border rounded-sm"
                        style={{ color: srcColor, borderColor: srcColor + "40" }}
                      >
                        {SOURCE_FR[r.source] || r.source}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#0A0A0A]">{r.customer_name || "—"}</div>
                      {(r.customer_email || r.customer_phone) && (
                        <div className="text-[0.68rem] text-[#0A0A0A]/55">{r.customer_email || r.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-[#0A0A0A]">{fmtXOF(r.total)}</td>
                    <td className="py-3 px-4 text-[0.78rem] text-[#0A0A0A]/75">{PAYMENT_FR[r.payment_method] || r.payment_method}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => downloadPdf(r)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.22em] border border-[#B8922A] text-[#B8922A] hover:bg-[#B8922A] hover:text-white transition-colors"
                        data-testid={`receipt-pdf-${r.id}`}
                      >
                        <FileDown size={11} /> PDF
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm" data-testid="receipts-pagination">
          <div className="text-[0.72rem] text-[#0A0A0A]/55">Page {page} / {pages} · {total} reçus</div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] disabled:opacity-30"
              data-testid="receipts-prev"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] disabled:opacity-30"
              data-testid="receipts-next"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)} data-testid="receipt-detail-modal">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 sm:p-7 border-b border-[#0A0A0A]/8">
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A]">
                  {SOURCE_FR[selected.source] || selected.source}
                </div>
                <div className="font-mono text-base text-[#0A0A0A] mt-0.5">{selected.receipt_number}</div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-[#FAFAF7]"><X size={16} /></button>
            </div>
            <div className="p-5 sm:p-7 space-y-4">
              <Field label="Date d'émission" value={formatDateTimeFR(selected.issued_at)} />
              <Field label="Client" value={selected.customer_name || "—"} />
              {selected.customer_email && <Field label="Email" value={selected.customer_email} />}
              {selected.customer_phone && <Field label="Téléphone" value={selected.customer_phone} />}
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-2">Lignes</div>
                <table className="w-full text-sm border border-[#0A0A0A]/8">
                  <thead className="bg-[#FAFAF7] text-[0.6rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55">
                    <tr><th className="py-2 px-3 text-left">Description</th><th className="py-2 px-3 text-right">Qté</th><th className="py-2 px-3 text-right">P.U.</th><th className="py-2 px-3 text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {selected.lines.map((ln, i) => (
                      <tr key={i} className="border-t border-[#0A0A0A]/5">
                        <td className="py-2 px-3">{ln.description}</td>
                        <td className="py-2 px-3 text-right">{ln.quantity}</td>
                        <td className="py-2 px-3 text-right">{fmtXOF(ln.unit_price)}</td>
                        <td className="py-2 px-3 text-right font-medium">{fmtXOF(ln.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[#B8922A]/30 pt-4 flex items-baseline justify-between">
                <span className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Total payé</span>
                <span className="font-display-serif text-2xl text-[#B8922A]">{fmtXOF(selected.total)}</span>
              </div>
              <Field label="Mode de paiement" value={PAYMENT_FR[selected.payment_method] || selected.payment_method} />
              <Field label="Émis par" value={`${selected.issued_by || "—"} (${selected.issued_by_role || "—"})`} />
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1">Signature numérique</div>
                <div className="font-mono text-[0.78rem] text-[#0A0A0A]/80 bg-[#FAFAF7] border border-[#0A0A0A]/8 px-3 py-2 break-all">{selected.signature}</div>
              </div>
              <button
                onClick={() => downloadPdf(selected)}
                className="w-full bg-[#B8922A] hover:bg-[#a37e1f] text-white py-3 text-[0.7rem] uppercase tracking-[0.22em] inline-flex items-center justify-center gap-3 transition-colors"
                data-testid="receipt-detail-pdf"
              >
                <FileDown size={14} /> Télécharger le PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, subtitle, accent }) {
  return (
    <div className={`${accent ? "bg-white border border-[#B8922A]/40" : "bg-white border border-[#0A0A0A]/8"} p-4`}>
      <div className={`text-[0.6rem] uppercase tracking-[0.22em] ${accent ? "text-[#B8922A]" : "text-[#0A0A0A]/55"}`}>{label}</div>
      <div className="font-display-serif text-2xl text-[#0A0A0A] mt-1">{value}</div>
      {subtitle && <div className="text-[0.68rem] text-[#0A0A0A]/55 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">{label}</span>
      <span className="text-sm text-[#0A0A0A] text-right">{value}</span>
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import api, { API, getStaffToken } from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { Users, Download, FileDown, Search, X, Mail, Phone, Globe } from "lucide-react";
import { toast } from "sonner";

const OFFER_BADGES = {
  pass_day: { label: "Day Pass", color: "bg-[#B8922A]/10 text-[#B8922A] border-[#B8922A]/30" },
  sunset: { label: "Sunset", color: "bg-orange-50 text-orange-700 border-orange-200" },
  brunch: { label: "Brunch", color: "bg-green-50 text-green-700 border-green-200" },
  le_kaai: { label: "Le Kaai", color: "bg-purple-50 text-purple-700 border-purple-200" },
  hebergement: { label: "Hébergement", color: "bg-blue-50 text-blue-700 border-blue-200" },
};

export default function StaffClients() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get("/staff/clients").then((r) => setItems(r.data.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.trim().toLowerCase();
    return items.filter(
      (c) =>
        (c.email || "").toLowerCase().includes(s) ||
        (c.phone || "").toLowerCase().includes(s) ||
        (c.name || "").toLowerCase().includes(s) ||
        (c.surname || "").toLowerCase().includes(s),
    );
  }, [items, search]);

  const openDetail = async (email) => {
    setSelected(email);
    setDetail(null);
    try {
      const { data } = await api.get(`/staff/clients/${encodeURIComponent(email)}`);
      setDetail(data);
    } catch {
      toast.error("Impossible de charger la fiche client");
      setSelected(null);
    }
  };

  const downloadCsv = async () => {
    const token = getStaffToken();
    const res = await fetch(`${API}/staff/clients/export.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      toast.error("Export impossible");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bbr-clients.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export téléchargé");
  };

  const downloadPdf = async () => {
    const token = getStaffToken();
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`${API}/staff/clients/report.pdf?${params}`, {
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
    a.download = "bbr-clients.pdf";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Rapport PDF téléchargé");
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-clients">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">Clients</h1>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={downloadCsv}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#B8922A] text-[#B8922A] text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#B8922A]/5 transition-colors"
            data-testid="export-csv-btn"
          >
            <Download size={13} /> CSV
          </button>
          <button
            onClick={downloadPdf}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#B8922A] text-white text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] transition-colors"
            data-testid="export-pdf-btn"
          >
            <FileDown size={13} /> PDF
          </button>
        </div>
      </div>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">Base agrégée à partir des réservations confirmées et payées.</p>

      <div className="relative mb-6 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom, email ou téléphone"
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none bg-white"
          data-testid="clients-search-input"
        />
      </div>

      <div className="bg-white border border-[#0A0A0A]/8">
        <div className="hidden md:grid grid-cols-12 text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50 px-5 py-3 border-b border-[#0A0A0A]/10 bg-[#FAFAF7]">
          <div className="col-span-3">Client</div>
          <div className="col-span-3">Contact</div>
          <div className="col-span-2">Réservations</div>
          <div className="col-span-2">Total dépensé</div>
          <div className="col-span-2">Dernière visite</div>
        </div>
        {loading && <div className="p-6 text-sm text-[#0A0A0A]/50">Chargement…</div>}
        {!loading && filtered.length === 0 && <div className="p-6 text-sm text-[#0A0A0A]/50">Aucun client trouvé.</div>}
        {filtered.map((c) => (
          <button
            key={c.email}
            onClick={() => openDetail(c.email)}
            className="w-full md:grid md:grid-cols-12 md:items-center flex flex-col items-start gap-2 md:gap-0 px-5 py-4 text-left border-b border-[#0A0A0A]/5 hover:bg-[#FAFAF7] transition-colors"
            data-testid={`client-row-${c.email}`}
          >
            <div className="md:col-span-3 w-full">
              <div className="text-sm text-[#0A0A0A]">
                {c.surname || ""} {c.name || ""}
              </div>
              <div className="text-[0.7rem] text-[#0A0A0A]/45 mt-0.5">{c.nationality || "—"}</div>
            </div>
            <div className="md:col-span-3 text-sm text-[#0A0A0A]/70 w-full">
              <div className="break-all">{c.email}</div>
              <div className="text-[0.72rem] text-[#0A0A0A]/45 mt-0.5">{c.phone || "—"}</div>
            </div>
            <div className="md:col-span-2 w-full flex items-center gap-2 md:block">
              <span className="inline-block px-2 py-1 text-xs bg-[#B8922A]/10 text-[#B8922A] font-medium">{c.bookings_count}</span>
              <div className="flex gap-1 md:mt-2 flex-wrap">
                {(c.offers || []).map((o) => (
                  <span key={o} className={`text-[0.58rem] uppercase tracking-[0.18em] px-1.5 py-0.5 border ${OFFER_BADGES[o]?.color || "border-[#0A0A0A]/15"}`}>
                    {OFFER_BADGES[o]?.label || o}
                  </span>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 text-sm font-medium text-[#0A0A0A] flex md:block items-center justify-between w-full">
              <span className="md:hidden text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50">Total dépensé</span>
              {formatXOF(c.total_spent || 0)}
            </div>
            <div className="md:col-span-2 text-sm text-[#0A0A0A]/70 flex md:block items-center justify-between w-full">
              <span className="md:hidden text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50">Dernière visite</span>
              {c.last_visit || "—"}
            </div>
          </button>
        ))}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex justify-end"
          onClick={() => setSelected(null)}
          data-testid="client-detail-overlay"
        >
          <div
            className="bg-white w-full max-w-2xl h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#0A0A0A]/10 px-7 py-5 flex items-center justify-between z-10">
              <h2 className="font-display-serif text-2xl text-[#0A0A0A]">Fiche client</h2>
              <button onClick={() => setSelected(null)} data-testid="close-client-detail" className="text-[#0A0A0A]/50 hover:text-[#0A0A0A]">
                <X size={18} />
              </button>
            </div>
            {!detail ? (
              <div className="p-7 text-sm text-[#0A0A0A]/50">Chargement…</div>
            ) : (
              <div className="p-7">
                <div className="mb-7">
                  <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-2">Identité</div>
                  <div className="font-display-serif text-2xl text-[#0A0A0A] mb-1">
                    {detail.surname} {detail.name}
                  </div>
                  <div className="text-sm text-[#0A0A0A]/60 space-y-1.5 mt-3">
                    <div className="flex items-center gap-2"><Mail size={13} className="text-[#B8922A]" /> {detail.email}</div>
                    <div className="flex items-center gap-2"><Phone size={13} className="text-[#B8922A]" /> {detail.phone || "—"}</div>
                    <div className="flex items-center gap-2"><Globe size={13} className="text-[#B8922A]" /> {detail.nationality || "—"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-7">
                  <div className="border border-[#0A0A0A]/10 p-4 bg-[#FAFAF7]">
                    <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Réservations</div>
                    <div className="font-display-serif text-2xl text-[#0A0A0A] mt-1">{detail.bookings_count}</div>
                  </div>
                  <div className="border border-[#B8922A]/30 p-4 bg-[#B8922A]/5">
                    <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Total dépensé</div>
                    <div className="font-display-serif text-2xl text-[#0A0A0A] mt-1">{formatXOF(detail.total_spent)}</div>
                  </div>
                </div>
                <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">Historique</div>
                <div className="space-y-2">
                  {detail.bookings.map((b) => (
                    <div key={b.id} className="border border-[#0A0A0A]/10 p-4 hover:border-[#B8922A]/40 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-[#0A0A0A]">{b.offer_name}</div>
                        <div className="text-[0.7rem] text-[#0A0A0A]/55">#{b.id.slice(0, 8).toUpperCase()}</div>
                      </div>
                      <div className="text-[0.75rem] text-[#0A0A0A]/65 flex flex-wrap gap-x-4 gap-y-1">
                        <span>{b.date}{b.checkout_date ? ` → ${b.checkout_date}` : ""}</span>
                        <span>{(b.adults || 0) + (b.children || 0)} pers.</span>
                        <span>{b.boat_time}</span>
                        <span className="font-medium text-[#B8922A]">{formatXOF(b.total_amount || 0)}</span>
                        <span className={b.paid_at ? "text-green-700" : "text-orange-700"}>{b.paid_at ? "Payé" : "Non payé"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

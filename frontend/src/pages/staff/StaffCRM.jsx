/**
 * Staff CRM 360° — Revenue Engine Phase B.
 *
 * Master/detail view :
 *   LEFT  — searchable customer list with segment chips (VIP, Lead, Dormant…)
 *   RIGHT — full 360° fiche with KPIs (LTV, avg basket, …), marketing
 *           attribution (first/last UTM), and unified activity timeline
 *           merging bookings, contact messages, marketing events,
 *           newsletter signup, and event_requests.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Search, RefreshCw, Crown, Sparkles, Moon, Mail as MailIcon,
  User, Phone, Globe, CalendarClock, TrendingUp, Wallet, Eye,
  Inbox, BookOpen, Megaphone, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const SEGMENT_LABEL = {
  vip: { label: "VIP", icon: Crown, color: "#B8922A", bg: "#FAF3E1" },
  recent_visitor: { label: "Récent", icon: Sparkles, color: "#16A34A", bg: "#ECFDF5" },
  dormant: { label: "Dormant", icon: Moon, color: "#64748B", bg: "#F1F5F9" },
  lead: { label: "Lead", icon: MailIcon, color: "#E1306C", bg: "#FCE7F3" },
  customer: { label: "Client", icon: User, color: "#0A0A0A", bg: "#F5F5F5" },
  prospect: { label: "Prospect", icon: User, color: "#9CA3AF", bg: "#F5F5F5" },
};

const SEG_FILTERS = [
  { id: "all", label: "Tous" },
  { id: "vip", label: "VIP" },
  { id: "recent_visitor", label: "Récents" },
  { id: "lead", label: "Leads" },
  { id: "dormant", label: "Dormants" },
];

const TIMELINE_ICON = {
  booking: BookOpen,
  contact_message: Inbox,
  newsletter: MailIcon,
  event_request: Megaphone,
  marketing_event: Eye,
};

const TIMELINE_COLOR = {
  booking: "#16A34A",
  contact_message: "#E1306C",
  newsletter: "#B8922A",
  event_request: "#1F8FFF",
  marketing_event: "#9CA3AF",
};

export default function StaffCRM() {
  const [segments, setSegments] = useState({});
  const [filterSeg, setFilterSeg] = useState("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function loadSegments() {
    try {
      const { data } = await api.get("/staff/crm/segments");
      setSegments(data.counts || {});
    } catch { /* silent */ }
  }

  async function loadList() {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (filterSeg && filterSeg !== "all") params.set("segment", filterSeg);
      if (q.trim()) params.set("q", q.trim());
      const { data } = await api.get(`/staff/crm/customers?${params.toString()}`);
      setItems(data.items || []);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de charger la liste clients");
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetail(email) {
    setSelectedEmail(email);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const { data } = await api.get(`/staff/crm/customers/${encodeURIComponent(email)}`);
      setDetail(data);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de charger la fiche client");
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => { loadSegments(); }, []);
  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, [filterSeg]);

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-crm">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-2">
            Revenue Engine · Phase B
          </div>
          <h1 className="font-serif italic font-light text-3xl md:text-5xl leading-tight text-[#0A0A0A]">
            CRM 360°
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
            Vue unifiée de chaque client — historique de réservations, messages,
            attribution marketing, lifetime value, segments.
          </p>
        </div>
        <button
          onClick={() => { loadSegments(); loadList(); if (selectedEmail) loadDetail(selectedEmail); }}
          className="inline-flex items-center gap-2 px-4 py-2 border border-[#0A0A0A]/15 text-[0.65rem] tracking-[0.3em] uppercase hover:border-[#B8922A] hover:text-[#B8922A] transition-colors self-start"
          data-testid="crm-refresh-btn"
        >
          <RefreshCw size={14} />
          Rafraîchir
        </button>
      </header>

      {/* Segment chips */}
      <div className="flex flex-wrap gap-2" data-testid="crm-segments">
        {SEG_FILTERS.map((s) => {
          const count = segments[s.id === "all" ? "all" : s.id] || 0;
          const meta = SEGMENT_LABEL[s.id];
          const Icon = meta?.icon;
          const active = filterSeg === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setFilterSeg(s.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-[0.65rem] tracking-[0.3em] uppercase border transition-colors ${
                active
                  ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                  : "bg-white text-[#0A0A0A]/75 border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"
              }`}
              data-testid={`crm-segment-${s.id}`}
            >
              {Icon && <Icon size={12} />}
              {s.label}
              <span className={active ? "text-white/70" : "text-[#0A0A0A]/45"}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* LIST */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 border border-[#0A0A0A]/15 px-3 bg-white">
            <Search size={14} className="text-[#0A0A0A]/40" />
            <input
              placeholder="Rechercher email, nom, téléphone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") loadList(); }}
              className="flex-1 py-2 text-sm bg-transparent focus:outline-none"
              data-testid="crm-search-input"
            />
            <button
              onClick={loadList}
              className="text-[0.6rem] tracking-[0.3em] uppercase text-[#B8922A]"
            >
              GO
            </button>
          </div>

          <div className="bg-white border border-[#0A0A0A]/10">
            {loadingList ? (
              <div className="py-16 text-center text-sm text-[#0A0A0A]/45">Chargement…</div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#0A0A0A]/45">
                Aucun client trouvé
              </div>
            ) : (
              <ul className="divide-y divide-[#0A0A0A]/8 max-h-[800px] overflow-y-auto"
                  data-testid="crm-list">
                {items.map((c) => (
                  <li
                    key={c.email}
                    onClick={() => loadDetail(c.email)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedEmail === c.email ? "bg-[#FAF7F2]" : "hover:bg-[#FAF7F2]/60"
                    }`}
                    data-testid={`crm-item-${c.email}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-[#0A0A0A] truncate">
                          {c.surname || c.name
                            ? `${c.surname || ""} ${c.name || ""}`.trim()
                            : c.email}
                        </div>
                        <div className="text-xs text-[#0A0A0A]/55 truncate">{c.email}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-serif italic text-[#0A0A0A]">
                          {formatXOF(c.total_spent)}
                        </div>
                        <div className="text-[10px] text-[#0A0A0A]/45 uppercase tracking-wide">
                          {c.bookings_count} {c.bookings_count > 1 ? "résas" : "résa"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(c.segments || []).map((seg) => (
                        <SegBadge key={seg} segment={seg} />
                      ))}
                      {c.first_utm_source && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#0A0A0A]/5 text-[#0A0A0A]/65">
                          {c.first_utm_source}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* DETAIL */}
        <div className="lg:col-span-3" data-testid="crm-detail-pane">
          {!selectedEmail ? (
            <div className="bg-white border border-[#0A0A0A]/10 p-16 text-center text-sm text-[#0A0A0A]/45">
              Sélectionnez un client pour voir sa fiche 360°.
            </div>
          ) : loadingDetail ? (
            <div className="bg-white border border-[#0A0A0A]/10 p-16 text-center text-sm text-[#0A0A0A]/45">
              Chargement de la fiche…
            </div>
          ) : !detail ? null : (
            <CustomerDetail detail={detail} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Customer 360° detail
// ─────────────────────────────────────────────────────────────────

function CustomerDetail({ detail }) {
  const { profile, kpis, attribution, segments, bookings, timeline } = detail;
  const fullName = `${profile.surname || ""} ${profile.name || ""}`.trim() || detail.email;

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="bg-white border border-[#0A0A0A]/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif italic text-3xl md:text-4xl leading-tight">{fullName}</h2>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-[#0A0A0A]/70">
              <a href={`mailto:${detail.email}`}
                 className="inline-flex items-center gap-1.5 hover:text-[#B8922A]"
                 data-testid="crm-detail-email">
                <MailIcon size={13} />{detail.email}
              </a>
              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-1.5 hover:text-[#B8922A]">
                  <Phone size={13} />{profile.phone}
                </a>
              )}
              {profile.nationality && (
                <span className="inline-flex items-center gap-1.5">
                  <Globe size={13} />{profile.nationality}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 max-w-[40%] justify-end">
            {segments.map((s) => <SegBadge key={s} segment={s} large />)}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="crm-detail-kpis">
        <MiniKpi icon={Wallet} label="Lifetime Value" value={formatXOF(kpis.ltv)} accent />
        <MiniKpi icon={BookOpen} label="Réservations payées" value={kpis.paid_bookings_count} />
        <MiniKpi icon={TrendingUp} label="Panier moyen" value={formatXOF(kpis.avg_basket)} />
        <MiniKpi icon={CalendarClock} label="Dernière visite" value={kpis.last_visit || "—"} />
      </div>

      {/* ATTRIBUTION */}
      {attribution && (attribution.first_utm_source || attribution.last_utm_source) && (
        <div className="bg-white border border-[#0A0A0A]/10 p-5" data-testid="crm-attribution">
          <h3 className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/65 mb-4">
            Attribution marketing
          </h3>
          <div className="grid sm:grid-cols-2 gap-5 text-sm">
            <AttrCol
              label="Premier contact"
              utmSource={attribution.first_utm_source}
              utmCampaign={attribution.first_utm_campaign}
              utmMedium={attribution.first_utm_medium}
              at={attribution.first_seen_at}
            />
            <AttrCol
              label="Dernier contact"
              utmSource={attribution.last_utm_source}
              utmCampaign={attribution.last_utm_campaign}
              utmMedium={attribution.last_utm_medium}
            />
          </div>
        </div>
      )}

      {/* Bookings table */}
      {bookings.length > 0 && (
        <div className="bg-white border border-[#0A0A0A]/10 p-5">
          <h3 className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/65 mb-4">
            Historique réservations
          </h3>
          <div className="overflow-x-auto" data-testid="crm-bookings-list">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Offre</th>
                  <th className="text-left py-2">Convives</th>
                  <th className="text-right py-2">Montant</th>
                  <th className="text-left py-2 pl-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 10).map((b) => (
                  <tr key={b.id} className="border-b border-[#0A0A0A]/5">
                    <td className="py-2">{b.date}</td>
                    <td className="py-2">{b.offer_name || b.offer_type}</td>
                    <td className="py-2">{(b.participants || []).length}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatXOF(b.total_amount)}
                    </td>
                    <td className="py-2 pl-3">
                      {b.paid_at ? (
                        <span className="text-[10px] uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                          payé
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 border border-amber-200">
                          en attente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white border border-[#0A0A0A]/10 p-5">
        <h3 className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/65 mb-4">
          Timeline unifiée
        </h3>
        {timeline.length === 0 ? (
          <div className="text-sm text-[#0A0A0A]/45 py-6 text-center">Pas encore d'activité.</div>
        ) : (
          <ol className="space-y-3" data-testid="crm-timeline">
            {timeline.slice(0, 30).map((t, i) => {
              const Icon = TIMELINE_ICON[t.type] || ExternalLink;
              const color = TIMELINE_COLOR[t.type] || "#9CA3AF";
              return (
                <li
                  key={i}
                  className="flex gap-3 pb-3 border-b border-[#0A0A0A]/5 last:border-0"
                  data-testid={`crm-timeline-item-${t.type}`}
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full"
                    style={{ background: `${color}15`, color }}
                  >
                    <Icon size={14} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-[#0A0A0A]">{t.label || t.type}</span>
                      {t.amount && (
                        <span className="text-sm font-medium tabular-nums">
                          {formatXOF(t.amount)}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#0A0A0A]/45 mt-0.5">
                      {formatTs(t.ts)} · {t.type.replace("_", " ")}
                      {t.status && <span className="ml-2">· {t.status}</span>}
                    </div>
                    {t.extra?.message && (
                      <div className="text-xs text-[#0A0A0A]/65 mt-1 italic line-clamp-2">
                        "{t.extra.message}"
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function SegBadge({ segment, large = false }) {
  const meta = SEGMENT_LABEL[segment];
  if (!meta) return null;
  const I = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 ${large ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]"} uppercase tracking-wider`}
      style={{ color: meta.color, background: meta.bg }}
    >
      <I size={large ? 11 : 9} />
      {meta.label}
    </span>
  );
}

function MiniKpi({ icon: Icon, label, value, accent }) {
  return (
    <div className={`bg-white border p-4 ${accent ? "border-[#B8922A]" : "border-[#0A0A0A]/10"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.5rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55">{label}</span>
        <Icon size={13} className={accent ? "text-[#B8922A]" : "text-[#0A0A0A]/45"} />
      </div>
      <div className={`font-serif italic font-light ${accent ? "text-2xl text-[#B8922A]" : "text-xl text-[#0A0A0A]"} tabular-nums`}>
        {value}
      </div>
    </div>
  );
}

function AttrCol({ label, utmSource, utmCampaign, utmMedium, at }) {
  return (
    <div>
      <div className="text-[0.5rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-2">
        {label}
      </div>
      <dl className="space-y-1 font-mono text-xs">
        <Row k="source" v={utmSource} />
        <Row k="campaign" v={utmCampaign} />
        <Row k="medium" v={utmMedium} />
        {at && <Row k="vu" v={formatTs(at)} />}
      </dl>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex gap-2">
      <dt className="text-[#0A0A0A]/45 w-20 flex-shrink-0">{k}</dt>
      <dd className="text-[#0A0A0A]">{v || "—"}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────

function formatXOF(n) {
  if (n === null || n === undefined) return "—";
  const num = typeof n === "number" ? n : parseInt(n, 10) || 0;
  return `${num.toLocaleString("fr-FR")} XOF`;
}

function formatTs(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

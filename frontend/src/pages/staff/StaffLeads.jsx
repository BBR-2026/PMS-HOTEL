/**
 * Staff Leads — Contact messages inbox + Newsletter subscribers list.
 *
 * Two tabs:
 *  - Messages → list of inbound contact_messages with status workflow
 *    (new → in_progress → replied → archived) + internal notes.
 *  - Newsletter → list of newsletter_subscribers with source breakdown
 *    and CSV export.
 */
import { useEffect, useState } from "react";
import {
  Mail, Inbox, Download, RefreshCw, Search, Filter,
  Check, MessageSquare, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const STATUS_TABS = [
  { id: "", label: "Tous" },
  { id: "new", label: "Nouveaux" },
  { id: "in_progress", label: "En cours" },
  { id: "replied", label: "Répondu" },
  { id: "archived", label: "Archivés" },
];

const STATUS_BADGE = {
  new: "bg-amber-50 text-amber-800 border-amber-300",
  in_progress: "bg-sky-50 text-sky-800 border-sky-300",
  replied: "bg-emerald-50 text-emerald-800 border-emerald-300",
  archived: "bg-stone-50 text-stone-700 border-stone-300",
};

const STATUS_LABEL = {
  new: "Nouveau",
  in_progress: "En cours",
  replied: "Répondu",
  archived: "Archivé",
};

const NEXT_STATUS = {
  new: "in_progress",
  in_progress: "replied",
  replied: "archived",
  archived: null,
};

const NEXT_STATUS_LABEL = {
  new: "Marquer en cours",
  in_progress: "Marquer répondu",
  replied: "Archiver",
};

export default function StaffLeads() {
  const [tab, setTab] = useState("messages"); // messages | newsletter

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-leads">
      <header>
        <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-2">
          Revenue Engine · Phase B
        </div>
        <h1 className="font-serif italic font-light text-3xl md:text-5xl leading-tight text-[#0A0A0A]">
          Inbox & Leads
        </h1>
        <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
          Messages reçus depuis le formulaire de contact public et inscrits à la
          liste d'attente Boutique / newsletter.
        </p>
      </header>

      <div className="flex items-center gap-1 border-b border-[#0A0A0A]/10">
        <TabBtn
          active={tab === "messages"}
          onClick={() => setTab("messages")}
          icon={Inbox}
          label="Messages"
          testid="leads-tab-messages"
        />
        <TabBtn
          active={tab === "newsletter"}
          onClick={() => setTab("newsletter")}
          icon={Mail}
          label="Newsletter"
          testid="leads-tab-newsletter"
        />
      </div>

      {tab === "messages" ? <MessagesPane /> : <NewsletterPane />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, testid }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-5 py-3 text-[0.7rem] tracking-[0.3em] uppercase transition-colors border-b-2 ${
        active
          ? "border-[#B8922A] text-[#B8922A]"
          : "border-transparent text-[#0A0A0A]/65 hover:text-[#0A0A0A]"
      }`}
      data-testid={testid}
    >
      <Icon size={14} strokeWidth={1.5} />
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Messages Pane
// ─────────────────────────────────────────────────────────────────

function MessagesPane() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [totalNew, setTotalNew] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const { data } = await api.get(`/staff/contact-messages?${params.toString()}`);
      setItems(data.items || []);
      setTotalNew(data.total_new || 0);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de charger les messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  async function advance(msg) {
    const next = NEXT_STATUS[msg.status || "new"];
    if (!next) return;
    try {
      await api.patch(`/staff/contact-messages/${msg.id}`, { status: next });
      toast.success(`Statut → ${STATUS_LABEL[next]}`);
      await load();
      if (selected?.id === msg.id) {
        setSelected({ ...selected, status: next });
      }
    } catch {
      toast.error("Mise à jour impossible");
    }
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((s) => (
            <button
              key={s.id || "all"}
              onClick={() => setStatus(s.id)}
              className={`px-3 py-2 text-[0.6rem] tracking-[0.3em] uppercase border transition-colors ${
                status === s.id
                  ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                  : "bg-white text-[#0A0A0A]/65 border-[#0A0A0A]/15 hover:border-[#B8922A]"
              }`}
              data-testid={`lead-status-${s.id || "all"}`}
            >
              {s.label}
              {s.id === "new" && totalNew > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] bg-[#B8922A] text-white rounded-full">
                  {totalNew}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-1 flex items-center gap-2 border border-[#0A0A0A]/15 px-3 bg-white max-w-sm">
          <Search size={14} className="text-[#0A0A0A]/40" />
          <input
            placeholder="Rechercher nom, email, message…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            className="flex-1 py-2 text-sm bg-transparent focus:outline-none"
            data-testid="lead-search-input"
          />
          {q && (
            <button onClick={() => { setQ(""); load(); }} className="text-xs text-[#0A0A0A]/50">×</button>
          )}
        </div>
        <button
          onClick={load}
          className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A] transition-colors"
          data-testid="lead-refresh-btn"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* List + Detail */}
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white border border-[#0A0A0A]/10">
          {loading ? (
            <div className="py-16 text-center text-sm text-[#0A0A0A]/45">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#0A0A0A]/45">
              Aucun message
            </div>
          ) : (
            <ul className="divide-y divide-[#0A0A0A]/8" data-testid="lead-messages-list">
              {items.map((m) => (
                <li
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selected?.id === m.id ? "bg-[#FAF7F2]" : "hover:bg-[#FAF7F2]/60"
                  }`}
                  data-testid={`lead-msg-${m.id}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[#0A0A0A] truncate">{m.name}</div>
                      <div className="text-xs text-[#0A0A0A]/55 truncate">{m.email}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] tracking-wider uppercase border ${STATUS_BADGE[m.status] || ""}`}
                    >
                      {STATUS_LABEL[m.status] || m.status}
                    </span>
                  </div>
                  {m.subject && (
                    <div className="text-sm text-[#B8922A] italic mt-1">{m.subject}</div>
                  )}
                  <div className="text-sm text-[#0A0A0A]/65 line-clamp-2 mt-1">{m.message}</div>
                  <div className="text-[10px] text-[#0A0A0A]/40 mt-2">
                    {formatDate(m.created_at)}
                    {m.attribution?.utm_source && (
                      <span className="ml-3">
                        · UTM: <strong>{m.attribution.utm_source}</strong>
                        {m.attribution.utm_campaign && ` / ${m.attribution.utm_campaign}`}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2 bg-white border border-[#0A0A0A]/10 p-6 lg:sticky lg:top-4 lg:self-start" data-testid="lead-detail-pane">
          {!selected ? (
            <div className="text-center py-12 text-sm text-[#0A0A0A]/45">
              Sélectionnez un message pour voir le détail.
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="text-[0.55rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55 mb-2">
                  Message
                </div>
                <h2 className="font-serif italic text-2xl">{selected.name}</h2>
                <a
                  href={`mailto:${selected.email}`}
                  className="text-sm text-[#B8922A] hover:underline inline-flex items-center gap-1.5 mt-1"
                  data-testid="lead-detail-email-link"
                >
                  {selected.email}
                  <ExternalLink size={11} />
                </a>
                {selected.phone && (
                  <div className="text-sm text-[#0A0A0A]/70 mt-1">{selected.phone}</div>
                )}
              </div>

              {selected.subject && (
                <Field label="Sujet">{selected.subject}</Field>
              )}
              {selected.company && (
                <Field label="Entreprise">{selected.company}</Field>
              )}

              <Field label="Message">
                <p className="text-sm leading-relaxed text-[#0A0A0A]/85 whitespace-pre-wrap">
                  {selected.message}
                </p>
              </Field>

              {selected.attribution && (
                <Field label="Attribution">
                  <div className="text-xs space-y-1 font-mono">
                    {Object.entries(selected.attribution).filter(([_, v]) => v).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-[#0A0A0A]/55">{k}:</span> {String(v)}
                      </div>
                    ))}
                  </div>
                </Field>
              )}

              <Field label="Reçu">
                <span className="text-sm">{formatDate(selected.created_at)}</span>
              </Field>

              <div className="pt-4 border-t border-[#0A0A0A]/10 space-y-2">
                {NEXT_STATUS[selected.status] && (
                  <button
                    onClick={() => advance(selected)}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#0A0A0A] text-white text-[0.7rem] tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors"
                    data-testid="lead-advance-status-btn"
                  >
                    <Check size={14} />
                    {NEXT_STATUS_LABEL[selected.status]}
                  </button>
                )}
                <a
                  href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject || "Votre demande Boulay Beach Resort")}`}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 border border-[#B8922A] text-[#B8922A] text-[0.7rem] tracking-[0.3em] uppercase hover:bg-[#B8922A] hover:text-white transition-colors"
                  data-testid="lead-reply-email-btn"
                >
                  <MessageSquare size={14} />
                  Répondre par email
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Newsletter Pane
// ─────────────────────────────────────────────────────────────────

function NewsletterPane() {
  const [items, setItems] = useState([]);
  const [bySource, setBySource] = useState([]);
  const [totalActive, setTotalActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (q) params.set("q", q);
      const { data } = await api.get(`/staff/newsletter-subscribers?${params.toString()}`);
      setItems(data.items || []);
      setBySource(data.by_source || []);
      setTotalActive(data.total_active || 0);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de charger la newsletter");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [source]);

  async function exportCsv() {
    try {
      const { data } = await api.get(`/staff/newsletter-subscribers/export.csv`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bbr_newsletter_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } catch {
      toast.error("Export impossible");
    }
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#0A0A0A]/10 p-5" data-testid="newsletter-kpi-active">
          <div className="text-[0.55rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55 mb-2">
            Inscrits actifs
          </div>
          <div className="font-serif italic font-light text-3xl">{totalActive}</div>
        </div>
        <div className="bg-white border border-[#0A0A0A]/10 p-5 sm:col-span-2" data-testid="newsletter-kpi-sources">
          <div className="text-[0.55rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55 mb-2">
            Par source
          </div>
          <div className="flex flex-wrap gap-2">
            {bySource.length === 0 ? (
              <span className="text-sm text-[#0A0A0A]/45">—</span>
            ) : (
              bySource.map((s) => (
                <button
                  key={s.source}
                  onClick={() => setSource(source === s.source ? "" : s.source)}
                  className={`px-3 py-1.5 text-xs border transition-colors ${
                    source === s.source
                      ? "border-[#B8922A] bg-[#B8922A] text-white"
                      : "border-[#0A0A0A]/15 hover:border-[#B8922A]"
                  }`}
                >
                  {s.source} <span className="opacity-60">· {s.count}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2 border border-[#0A0A0A]/15 px-3 bg-white max-w-sm">
          <Search size={14} className="text-[#0A0A0A]/40" />
          <input
            placeholder="Rechercher email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            className="flex-1 py-2 text-sm bg-transparent focus:outline-none"
            data-testid="newsletter-search-input"
          />
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 border border-[#0A0A0A]/15 text-[0.65rem] tracking-[0.3em] uppercase hover:border-[#B8922A] hover:text-[#B8922A] transition-colors"
          data-testid="newsletter-export-csv-btn"
        >
          <Download size={14} />
          Export CSV
        </button>
        <button
          onClick={load}
          className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* List */}
      <div className="bg-white border border-[#0A0A0A]/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[0.55rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
            <tr>
              <th className="text-left py-3 px-4">Email</th>
              <th className="text-left py-3 px-4">Prénom</th>
              <th className="text-left py-3 px-4">Source</th>
              <th className="text-left py-3 px-4">UTM</th>
              <th className="text-left py-3 px-4">Inscrit</th>
            </tr>
          </thead>
          <tbody data-testid="newsletter-list">
            {loading ? (
              <tr><td colSpan={5} className="py-10 text-center text-[#0A0A0A]/45">Chargement…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-[#0A0A0A]/45">Aucun inscrit</td></tr>
            ) : items.map((s) => (
              <tr key={s.id} className="border-b border-[#0A0A0A]/5 hover:bg-[#FAF7F2] transition-colors">
                <td className="py-3 px-4 font-medium">{s.email}</td>
                <td className="py-3 px-4 text-[#0A0A0A]/70">{s.first_name || "—"}</td>
                <td className="py-3 px-4">
                  <span className="inline-block px-2 py-0.5 bg-[#FAF7F2] text-xs">
                    {s.source}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs text-[#0A0A0A]/60">
                  {s.attribution?.utm_source || "—"}
                  {s.attribution?.utm_campaign && (
                    <span className="text-[#0A0A0A]/40"> / {s.attribution.utm_campaign}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-xs text-[#0A0A0A]/60">
                  {formatDate(s.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[0.55rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-1.5">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

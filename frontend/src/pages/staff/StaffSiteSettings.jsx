/**
 * Staff Site Settings — Vitrine CMS portal.
 *
 * Non-technical editor : tabs by section. Each tab renders a structured
 * form for the typed fields PLUS a raw JSON editor at the bottom for power
 * users. Saves the entire section atomically. Reset to default available.
 */
import { useEffect, useState } from "react";
import {
  Save, RefreshCw, Undo2, Image as ImageIcon, Plus, Trash2,
  AlertCircle, History, Settings, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";
import { invalidateSiteConfig } from "../../lib/site-config";

const SECTION_LABELS = {
  hero: "Hero / Accueil",
  univers: "Univers (5 cartes)",
  offers: "Offres & Prix",
  contact: "Contact",
  footer: "Pied de page",
  instagram: "Instagram",
};

const SECTION_ORDER = ["hero", "univers", "offers", "contact", "footer", "instagram"];

export default function StaffSiteSettings() {
  const [sections, setSections] = useState({});
  const [active, setActive] = useState("hero");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/staff/site/sections");
      const map = {};
      (data.items || []).forEach((i) => { map[i.key] = i; });
      setSections(map);
      if (!draft && map[active]) setDraft(map[active].data);
    } catch {
      toast.error("Impossible de charger la configuration");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function selectTab(k) {
    setActive(k);
    setDraft(sections[k]?.data || {});
  }

  async function save() {
    setSaving(true);
    try {
      await api.put(`/staff/site/sections/${active}`, { data: draft });
      invalidateSiteConfig();
      toast.success("Section enregistrée — visible sur le site immédiatement");
      load();
    } catch {
      toast.error("Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefault() {
    if (!window.confirm(`Restaurer les valeurs par défaut de "${SECTION_LABELS[active] || active}" ?`)) return;
    try {
      const { data } = await api.post(`/staff/site/sections/${active}/reset`);
      invalidateSiteConfig();
      setDraft(data.data);
      toast.info("Valeurs par défaut restaurées");
      load();
    } catch {
      toast.error("Réinitialisation impossible");
    }
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-site-settings">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-2">
            Vitrine · CMS
          </div>
          <h1 className="font-serif font-light text-3xl md:text-5xl leading-tight">
            Configuration du site
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
            Modifiez le contenu de la Vitrine en temps réel — textes, images, prix,
            descriptions, contacts. Pas besoin de coder.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 border border-[#0A0A0A]/15 text-[0.6rem] tracking-[0.3em] uppercase hover:border-[#B8922A] hover:text-[#B8922A] transition-colors"
            data-testid="site-preview-btn"
          >
            <ExternalLink size={12} />
            Voir le site
          </a>
          <button
            onClick={load}
            className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]"
            data-testid="site-refresh-btn"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#0A0A0A]/10 pb-px">
        {SECTION_ORDER.map((k) => (
          <button
            key={k}
            onClick={() => selectTab(k)}
            className={`px-4 py-2.5 text-[0.65rem] tracking-[0.3em] uppercase border-b-2 -mb-px transition-colors ${
              active === k
                ? "border-[#B8922A] text-[#B8922A]"
                : "border-transparent text-[#0A0A0A]/65 hover:text-[#0A0A0A]"
            }`}
            data-testid={`site-tab-${k}`}
          >
            {SECTION_LABELS[k] || k}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="bg-white border border-[#0A0A0A]/10 p-6" data-testid={`site-editor-${active}`}>
        {!draft ? (
          <div className="py-16 text-center text-sm text-[#0A0A0A]/45">Chargement…</div>
        ) : (
          <SectionEditor section={active} value={draft} onChange={setDraft} />
        )}

        <details className="mt-8 pt-6 border-t border-[#0A0A0A]/10 group">
          <summary className="text-[0.6rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 cursor-pointer hover:text-[#0A0A0A]">
            Édition JSON brut (avancé)
          </summary>
          <textarea
            rows={14}
            value={draft ? JSON.stringify(draft, null, 2) : ""}
            onChange={(e) => {
              try { setDraft(JSON.parse(e.target.value)); }
              catch { /* ignore until valid */ }
            }}
            className="mt-3 w-full border border-[#0A0A0A]/15 px-3 py-2 text-[12px] font-mono focus:outline-none focus:border-[#B8922A]"
            data-testid="site-raw-json"
          />
          <p className="text-[10px] text-[#0A0A0A]/45 mt-1">
            <AlertCircle size={10} className="inline mr-1" />
            En cas d'erreur de syntaxe, l'éditeur visuel ci-dessus prime.
          </p>
        </details>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-6 mt-6 border-t border-[#0A0A0A]/10">
          <button
            onClick={resetDefault}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#0A0A0A]/15 text-[0.6rem] tracking-[0.3em] uppercase hover:border-amber-400 hover:text-amber-700 transition-colors"
            data-testid="site-reset-btn"
          >
            <Undo2 size={12} />
            Restaurer par défaut
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A0A0A] text-white text-[0.65rem] tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors disabled:opacity-50"
            data-testid="site-save-btn"
          >
            <Save size={13} />
            {saving ? "Enregistrement…" : "Publier les changements"}
          </button>
        </div>
      </div>

      {sections[active]?.updated_at && (
        <p className="text-[10px] tracking-wider uppercase text-[#0A0A0A]/45 text-right">
          <History size={11} className="inline mr-1" />
          Dernière modification : {sections[active].updated_at?.slice(0, 16).replace("T", " ")}
          {sections[active].updated_by && ` · par ${sections[active].updated_by}`}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Per-section editors
// ─────────────────────────────────────────────────────────────────

function SectionEditor({ section, value, onChange }) {
  if (section === "hero") return <HeroEditor v={value} on={onChange} />;
  if (section === "univers") return <UniversEditor v={value} on={onChange} />;
  if (section === "offers") return <OffersEditor v={value} on={onChange} />;
  if (section === "contact") return <ContactEditor v={value} on={onChange} />;
  if (section === "footer") return <FooterEditor v={value} on={onChange} />;
  if (section === "instagram") return <InstagramEditor v={value} on={onChange} />;
  return null;
}

const set = (v, on, k, x) => on({ ...(v || {}), [k]: x });

function HeroEditor({ v, on }) {
  return (
    <div className="space-y-5">
      <FInput label="Petit texte au-dessus du titre" value={v.kicker || ""} onChange={(x) => set(v, on, "kicker", x)} testid="hero-kicker" />
      <FInput label="Titre principal" value={v.title || ""} onChange={(x) => set(v, on, "title", x)} testid="hero-title" />
      <FTextarea label="Sous-titre" rows={3} value={v.subtitle || ""} onChange={(x) => set(v, on, "subtitle", x)} testid="hero-subtitle" />
      <FInput label="URL de la vidéo (mp4/mov)" value={v.video_url || ""} onChange={(x) => set(v, on, "video_url", x)} testid="hero-video" placeholder="https://..." icon={<ImageIcon size={12} />} />
      <FInput label="URL de l'image poster (fallback)" value={v.poster_url || ""} onChange={(x) => set(v, on, "poster_url", x)} testid="hero-poster" placeholder="https://..." />
    </div>
  );
}

function UniversEditor({ v, on }) {
  const items = v.items || [];
  function update(i, x) { const next = [...items]; next[i] = x; on({ ...v, items: next }); }
  function add() { on({ ...v, items: [...items, { id: `new-${Date.now()}`, to: "/", name: "Nouvel univers", description: "", image: "" }] }); }
  function remove(i) { on({ ...v, items: items.filter((_, idx) => idx !== i) }); }
  return (
    <div className="space-y-6">
      <FTextarea label="Titre de la section" rows={2} value={v.section_title || ""} onChange={(x) => set(v, on, "section_title", x)} testid="univers-title" />
      {items.map((u, i) => (
        <div key={i} className="bg-[#FAF7F2] p-4 border border-[#0A0A0A]/8 space-y-3" data-testid={`univers-item-${i}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] tracking-[0.3em] uppercase text-[#B8922A]">Univers #{i + 1}</span>
            <button onClick={() => remove(i)} className="text-[#0A0A0A]/55 hover:text-red-700"><Trash2 size={13} /></button>
          </div>
          <FInput label="Nom" value={u.name || ""} onChange={(x) => update(i, { ...u, name: x })} testid={`univers-name-${i}`} />
          <FInput label="Lien (slug)" value={u.to || ""} onChange={(x) => update(i, { ...u, to: x })} testid={`univers-to-${i}`} placeholder="/univers/..." />
          <FInput label="URL image" value={u.image || ""} onChange={(x) => update(i, { ...u, image: x })} testid={`univers-image-${i}`} placeholder="https://..." />
          <FTextarea label="Description" rows={3} value={u.description || ""} onChange={(x) => update(i, { ...u, description: x })} testid={`univers-desc-${i}`} />
        </div>
      ))}
      <button onClick={add} className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#B8922A] text-[#B8922A] text-[0.65rem] tracking-[0.3em] uppercase">
        <Plus size={12} /> Ajouter un univers
      </button>
    </div>
  );
}

function OffersEditor({ v, on }) {
  const groups = Object.keys(v || {});
  function updateGroup(g, x) { on({ ...v, [g]: x }); }
  return (
    <div className="space-y-7">
      {groups.map(function (g) {
        return (
          <div key={g} className="border border-[#0A0A0A]/8 p-4">
            <h3 className="font-serif text-xl mb-4">{g.replace("_", " ").toUpperCase()}</h3>
            <RawJsonGroup value={v[g]} onChange={function (x) { updateGroup(g, x); }} />
          </div>
        );
      })}
    </div>
  );
}

function RawJsonGroup({ value, onChange }) {
  const [text, setText] = useState(JSON.stringify(value || {}, null, 2));
  useEffect(function () { setText(JSON.stringify(value || {}, null, 2)); }, [value]);
  return (
    <textarea
      rows={10}
      value={text}
      onChange={function (e) {
        setText(e.target.value);
        try { onChange(JSON.parse(e.target.value)); } catch { /* invalid */ }
      }}
      className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-[12px] font-mono focus:outline-none focus:border-[#B8922A]"
    />
  );
}

function ContactEditor({ v, on }) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <FInput label="Téléphone" value={v.phone || ""} onChange={(x) => set(v, on, "phone", x)} testid="contact-phone" />
        <FInput label="WhatsApp" value={v.whatsapp || ""} onChange={(x) => set(v, on, "whatsapp", x)} testid="contact-whatsapp" />
      </div>
      <FInput label="Email" value={v.email || ""} onChange={(x) => set(v, on, "email", x)} testid="contact-email" />
      <FInput label="Adresse — ligne 1" value={v.address_line_1 || ""} onChange={(x) => set(v, on, "address_line_1", x)} testid="contact-addr1" />
      <FInput label="Adresse — ligne 2" value={v.address_line_2 || ""} onChange={(x) => set(v, on, "address_line_2", x)} testid="contact-addr2" />
      <FInput label="Horaires" value={v.opening_hours || ""} onChange={(x) => set(v, on, "opening_hours", x)} testid="contact-hours" />
    </div>
  );
}

function FooterEditor({ v, on }) {
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={!!v.show_tagline} onChange={(e) => set(v, on, "show_tagline", e.target.checked)} data-testid="footer-show-tagline" />
        <span className="text-sm">Afficher la baseline sous le logo</span>
      </label>
      <FInput label="Baseline (si activée)" value={v.tagline || ""} onChange={(x) => set(v, on, "tagline", x)} testid="footer-tagline" />
      <FInput label="Accroche newsletter" value={v.newsletter_pitch || ""} onChange={(x) => set(v, on, "newsletter_pitch", x)} testid="footer-newsletter-pitch" />
      <FInput label="URL Instagram" value={v.social_instagram || ""} onChange={(x) => set(v, on, "social_instagram", x)} testid="footer-ig" />
      <FInput label="URL Facebook" value={v.social_facebook || ""} onChange={(x) => set(v, on, "social_facebook", x)} testid="footer-fb" />
      <FInput label="URL YouTube" value={v.social_youtube || ""} onChange={(x) => set(v, on, "social_youtube", x)} testid="footer-yt" />
    </div>
  );
}

function InstagramEditor({ v, on }) {
  const posts = v.posts || [];
  function update(i, x) { const n = [...posts]; n[i] = x; on({ ...v, posts: n }); }
  function add() { on({ ...v, posts: [...posts, { src: "", caption: "" }] }); }
  function remove(i) { on({ ...v, posts: posts.filter((_, idx) => idx !== i) }); }
  return (
    <div className="space-y-4">
      <FInput label="Handle Instagram" value={v.handle || ""} onChange={(x) => set(v, on, "handle", x)} testid="ig-handle" placeholder="@boulaybeachresort" />
      {posts.map((p, i) => (
        <div key={i} className="bg-[#FAF7F2] p-3 border border-[#0A0A0A]/8 grid grid-cols-[1fr_auto] gap-2 items-end" data-testid={`ig-post-${i}`}>
          <div className="space-y-2 flex-1">
            <FInput label={`Image #${i + 1}`} value={p.src || ""} onChange={(x) => update(i, { ...p, src: x })} testid={`ig-src-${i}`} />
            <FInput label="Légende" value={p.caption || ""} onChange={(x) => update(i, { ...p, caption: x })} testid={`ig-cap-${i}`} />
          </div>
          <button onClick={() => remove(i)} className="p-2 text-[#0A0A0A]/55 hover:text-red-700"><Trash2 size={13} /></button>
        </div>
      ))}
      <button onClick={add} className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#B8922A] text-[#B8922A] text-[0.65rem] tracking-[0.3em] uppercase">
        <Plus size={12} /> Ajouter une publication
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────

function FInput({ label, value, onChange, type = "text", placeholder, testid, icon }) {
  return (
    <label className="block">
      <span className="block text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1.5 inline-flex items-center gap-1">
        {icon}{label}
      </span>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:outline-none focus:border-[#B8922A]"
        data-testid={testid}
      />
    </label>
  );
}

function FTextarea({ label, value, onChange, rows = 3, testid }) {
  return (
    <label className="block">
      <span className="block text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1.5">{label}</span>
      <textarea
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:outline-none focus:border-[#B8922A] resize-y"
        data-testid={testid}
      />
    </label>
  );
}

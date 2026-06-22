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
import { useStaffAuth } from "../../context/StaffAuthContext";

const SECTION_LABELS = {
  hero: "Hero / Accueil",
  univers: "Univers (6 cartes)",
  offers: "Offres & Prix",
  menus_nav: "Menus de navigation",
  faq: "FAQ",
  testimonials: "Témoignages",
  contact: "Contact",
  footer: "Pied de page",
  instagram: "Instagram",
  mentions_legales: "Mentions légales",
  seo: "SEO & Méta",
  tracking: "Tracking (GTM)",
};

const SECTION_ORDER = ["hero", "univers", "offers", "menus_nav", "faq", "testimonials", "contact", "footer", "instagram", "mentions_legales", "seo", "tracking"];

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
  if (section === "tracking") return <TrackingEditor v={value} on={onChange} />;
  if (section === "faq") return <FAQEditor v={value} on={onChange} />;
  if (section === "testimonials") return <TestimonialsEditor v={value} on={onChange} />;
  if (section === "mentions_legales") return <MentionsEditor v={value} on={onChange} />;
  if (section === "menus_nav") return <MenusNavEditor v={value} on={onChange} />;
  if (section === "seo") return <SEOEditor v={value} on={onChange} />;
  return null;
}

const set = (v, on, k, x) => on({ ...(v || {}), [k]: x });

function TrackingEditor({ v, on }) {
  return (
    <div className="space-y-5" data-testid="tracking-editor">
      <div className="bg-[#FAF7F2]/60 border border-[#B8922A]/20 px-4 py-3 text-xs text-[#0A0A0A]/75 leading-relaxed">
        <strong className="text-[#B8922A]">Stratégie GTM unique :</strong>{" "}
        un seul conteneur Google Tag Manager pilote tous vos pixels
        (Meta Pixel, GA4, Google Ads Conversion, TikTok Pixel). Demandez à
        votre agence l'ID du conteneur (format <code className="font-mono">GTM-XXXXXXX</code>),
        collez-le ci-dessous, activez, et c'est tout.
      </div>
      <FInput
        label="ID du conteneur GTM"
        placeholder="GTM-XXXXXXX"
        value={v.gtm_container_id || ""}
        onChange={(x) => set(v, on, "gtm_container_id", x.trim())}
        testid="tracking-gtm-id"
      />
      <label className="flex items-center gap-3 cursor-pointer" data-testid="tracking-gtm-enabled-row">
        <input
          type="checkbox"
          checked={!!v.gtm_enabled}
          onChange={(e) => set(v, on, "gtm_enabled", e.target.checked)}
          className="h-4 w-4"
          data-testid="tracking-gtm-enabled"
        />
        <span className="text-sm text-[#0A0A0A]">
          Activer l'injection GTM sur la Vitrine
        </span>
      </label>
      <FTextarea
        label="Notes internes"
        rows={3}
        value={v.notes || ""}
        onChange={(x) => set(v, on, "notes", x)}
        testid="tracking-notes"
      />
    </div>
  );
}

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
  function add() { on({ ...v, items: [...items, { id: `new-${Date.now()}`, to: "/", name: "Nouvel univers", description: "", image: "", highlighted: false, order: items.length + 1, cta_label: "Découvrir", cta_url: "/" }] }); }
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FInput label="Nom" value={u.name || ""} onChange={(x) => update(i, { ...u, name: x })} testid={`univers-name-${i}`} />
            <FInput label="Lien (slug)" value={u.to || ""} onChange={(x) => update(i, { ...u, to: x })} testid={`univers-to-${i}`} placeholder="/univers/..." />
          </div>
          <ImageField label="Image principale" value={u.image} onChange={(x) => update(i, { ...u, image: x })} testid={`univers-image-${i}`} />
          <FTextarea label="Description" rows={3} value={u.description || ""} onChange={(x) => update(i, { ...u, description: x })} testid={`univers-desc-${i}`} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FInput label="Bouton CTA (libellé)" value={u.cta_label || ""} onChange={(x) => update(i, { ...u, cta_label: x })} placeholder="Découvrir" />
            <FInput label="CTA URL" value={u.cta_url || ""} onChange={(x) => update(i, { ...u, cta_url: x })} placeholder="/univers/..." />
            <FInput label="Ordre d'affichage" type="number" value={u.order ?? i + 1} onChange={(x) => update(i, { ...u, order: Number(x) || 0 })} />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={!!u.highlighted} onChange={(e) => update(i, { ...u, highlighted: e.target.checked })} className="h-4 w-4" />
            Mettre en avant sur la page d'accueil
          </label>
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
      {groups.map((g) => (
        <OfferGroup key={g} groupKey={g} group={v[g]} onChange={(x) => updateGroup(g, x)} />
      ))}
    </div>
  );
}

function OfferGroup({ groupKey, group, onChange }) {
  // Pull out scalar group-level keys (e.g. crossing_fee_xof) vs object offers
  const offerKeys = Object.keys(group || {}).filter((k) => typeof group[k] === "object" && group[k] !== null);
  const scalarKeys = Object.keys(group || {}).filter((k) => typeof group[k] !== "object" || group[k] === null);
  function updateOffer(k, x) { onChange({ ...group, [k]: x }); }
  function updateScalar(k, x) { onChange({ ...group, [k]: x }); }
  return (
    <div className="border border-[#0A0A0A]/10 p-5" data-testid={`offer-group-${groupKey}`}>
      <h3 className="font-serif text-xl mb-4">{groupKey.replace(/_/g, " ").toUpperCase()}</h3>
      {scalarKeys.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5 pb-5 border-b border-[#0A0A0A]/8">
          {scalarKeys.map((k) => (
            typeof group[k] === "number"
              ? <FInput key={k} label={k.replace(/_/g, " ")} type="number" value={group[k]} onChange={(x) => updateScalar(k, Number(x) || 0)} testid={`offer-${groupKey}-${k}`} />
              : <FInput key={k} label={k.replace(/_/g, " ")} value={group[k] || ""} onChange={(x) => updateScalar(k, x)} testid={`offer-${groupKey}-${k}`} />
          ))}
        </div>
      )}
      <div className="space-y-5">
        {offerKeys.map((k) => (
          <OfferCard key={k} offerKey={k} offer={group[k]} onChange={(x) => updateOffer(k, x)} testidPrefix={`${groupKey}-${k}`} />
        ))}
      </div>
    </div>
  );
}

function OfferCard({ offerKey, offer, onChange, testidPrefix }) {
  const u = (k, x) => onChange({ ...offer, [k]: x });
  return (
    <div className="bg-[#FAF7F2] p-4 border border-[#0A0A0A]/8" data-testid={`offer-card-${testidPrefix}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] tracking-[0.3em] uppercase text-[#B8922A] font-mono">{offerKey}</span>
        {offer.badge && (
          <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-[#B8922A] text-white">{offer.badge}</span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FInput label="Nom" value={offer.name || ""} onChange={(x) => u("name", x)} testid={`${testidPrefix}-name`} />
        <FInput label="Sous-titre" value={offer.subtitle || ""} onChange={(x) => u("subtitle", x)} testid={`${testidPrefix}-subtitle`} />
        <FInput label="Prix (XOF)" type="number" value={offer.price_xof ?? 0} onChange={(x) => u("price_xof", Number(x) || 0)} testid={`${testidPrefix}-price`} />
        <FInput label="Ancien prix (barré, 0 = aucun)" type="number" value={offer.old_price_xof ?? 0} onChange={(x) => u("old_price_xof", Number(x) || 0)} testid={`${testidPrefix}-oldprice`} />
        <FInput label="Places disponibles" type="number" value={offer.places_available ?? 0} onChange={(x) => u("places_available", Number(x) || 0)} testid={`${testidPrefix}-places`} />
        <FInput label="Badge (Nouveau, Best Seller, Limité…)" value={offer.badge || ""} onChange={(x) => u("badge", x)} testid={`${testidPrefix}-badge`} placeholder="Best Seller" />
        <FInput label="Disponible à partir du" type="date" value={offer.date_start || ""} onChange={(x) => u("date_start", x)} />
        <FInput label="Jusqu'au" type="date" value={offer.date_end || ""} onChange={(x) => u("date_end", x)} />
      </div>
      <div className="mt-3 space-y-3">
        <FTextarea label="Description courte" rows={2} value={offer.description || ""} onChange={(x) => u("description", x)} testid={`${testidPrefix}-desc`} />
        <FTextarea label="Description détaillée" rows={4} value={offer.description_long || ""} onChange={(x) => u("description_long", x)} testid={`${testidPrefix}-desclong`} />
        <FTextarea label="Conditions de réservation" rows={2} value={offer.conditions_reservation || ""} onChange={(x) => u("conditions_reservation", x)} />
        <FTextarea label="Conditions d'annulation" rows={2} value={offer.conditions_annulation || ""} onChange={(x) => u("conditions_annulation", x)} />
        <ImageField label="Image principale" value={offer.image_url} onChange={(x) => u("image_url", x)} testid={`${testidPrefix}-image`} />
        <GalleryField label="Galerie photos" value={offer.gallery || []} onChange={(x) => u("gallery", x)} testid={`${testidPrefix}-gallery`} />
        <FInput label="URL vidéo (mp4/mov)" value={offer.video_url || ""} onChange={(x) => u("video_url", x)} testid={`${testidPrefix}-video`} placeholder="https://..." />
      </div>
    </div>
  );
}

// ── New editors for Prompt 1 ────────────────────────────────────

function FAQEditor({ v, on }) {
  const items = v.items || [];
  const upd = (i, x) => { const n = [...items]; n[i] = x; on({ ...v, items: n }); };
  return (
    <div className="space-y-5" data-testid="faq-editor">
      <FInput label="Titre de la section" value={v.section_title || ""} onChange={(x) => set(v, on, "section_title", x)} />
      {items.map((it, i) => (
        <div key={i} className="bg-[#FAF7F2] p-4 border border-[#0A0A0A]/8 space-y-3" data-testid={`faq-item-${i}`}>
          <div className="flex justify-between items-center">
            <span className="text-[10px] tracking-[0.3em] uppercase text-[#B8922A]">Question #{i + 1}</span>
            <button onClick={() => on({ ...v, items: items.filter((_, x) => x !== i) })} className="text-[#0A0A0A]/55 hover:text-red-700"><Trash2 size={13} /></button>
          </div>
          <FInput label="Question" value={it.q || ""} onChange={(x) => upd(i, { ...it, q: x })} testid={`faq-q-${i}`} />
          <FTextarea label="Réponse" rows={3} value={it.a || ""} onChange={(x) => upd(i, { ...it, a: x })} testid={`faq-a-${i}`} />
        </div>
      ))}
      <button onClick={() => on({ ...v, items: [...items, { q: "", a: "" }] })} className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#B8922A] text-[#B8922A] text-[0.65rem] tracking-[0.3em] uppercase">
        <Plus size={12} /> Ajouter une question
      </button>
    </div>
  );
}

function TestimonialsEditor({ v, on }) {
  const items = v.items || [];
  const upd = (i, x) => { const n = [...items]; n[i] = x; on({ ...v, items: n }); };
  return (
    <div className="space-y-5" data-testid="testimonials-editor">
      <FInput label="Titre de la section" value={v.section_title || ""} onChange={(x) => set(v, on, "section_title", x)} />
      {items.map((it, i) => (
        <div key={i} className="bg-[#FAF7F2] p-4 border border-[#0A0A0A]/8 space-y-3" data-testid={`testi-item-${i}`}>
          <div className="flex justify-between items-center">
            <span className="text-[10px] tracking-[0.3em] uppercase text-[#B8922A]">Témoignage #{i + 1}</span>
            <button onClick={() => on({ ...v, items: items.filter((_, x) => x !== i) })} className="text-[#0A0A0A]/55 hover:text-red-700"><Trash2 size={13} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FInput label="Auteur" value={it.author || ""} onChange={(x) => upd(i, { ...it, author: x })} />
            <FInput label="Rôle / Type" value={it.role || ""} onChange={(x) => upd(i, { ...it, role: x })} />
            <FInput label="Note (1-5)" type="number" value={it.rating ?? 5} onChange={(x) => upd(i, { ...it, rating: Math.min(5, Math.max(0, Number(x) || 0)) })} />
          </div>
          <FTextarea label="Citation" rows={3} value={it.quote || ""} onChange={(x) => upd(i, { ...it, quote: x })} />
          <ImageField label="Photo (optionnel)" value={it.image} onChange={(x) => upd(i, { ...it, image: x })} />
        </div>
      ))}
      <button onClick={() => on({ ...v, items: [...items, { author: "", role: "", quote: "", rating: 5, image: "" }] })} className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#B8922A] text-[#B8922A] text-[0.65rem] tracking-[0.3em] uppercase">
        <Plus size={12} /> Ajouter un témoignage
      </button>
    </div>
  );
}

function MentionsEditor({ v, on }) {
  return (
    <div className="space-y-4" data-testid="mentions-editor">
      <FInput label="Raison sociale" value={v.company_name || ""} onChange={(x) => set(v, on, "company_name", x)} />
      <FInput label="RCCM / N° entreprise" value={v.rccm || ""} onChange={(x) => set(v, on, "rccm", x)} />
      <FInput label="Siège social" value={v.siege_social || ""} onChange={(x) => set(v, on, "siege_social", x)} />
      <FInput label="Directeur de publication" value={v.publication_director || ""} onChange={(x) => set(v, on, "publication_director", x)} />
      <FInput label="Hébergeur" value={v.hosting || ""} onChange={(x) => set(v, on, "hosting", x)} />
      <FInput label="URL CGV (PDF ou page)" value={v.cgv_url || ""} onChange={(x) => set(v, on, "cgv_url", x)} />
      <FInput label="URL Politique de confidentialité" value={v.privacy_url || ""} onChange={(x) => set(v, on, "privacy_url", x)} />
      <FTextarea label="Bandeau cookies" rows={3} value={v.cookies_text || ""} onChange={(x) => set(v, on, "cookies_text", x)} />
    </div>
  );
}

function MenusNavEditor({ v, on }) {
  const items = v.primary || [];
  const upd = (i, x) => { const n = [...items]; n[i] = x; on({ ...v, primary: n }); };
  return (
    <div className="space-y-5" data-testid="menus-editor">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FInput label="Bouton CTA (libellé)" value={v.cta_label || ""} onChange={(x) => set(v, on, "cta_label", x)} />
        <FInput label="CTA URL" value={v.cta_to || ""} onChange={(x) => set(v, on, "cta_to", x)} placeholder="/booking" />
      </div>
      <div className="text-[10px] tracking-[0.3em] uppercase text-[#0A0A0A]/55 pt-3 border-t border-[#0A0A0A]/8">Menu principal</div>
      {items.map((it, i) => (
        <div key={i} className="bg-[#FAF7F2] p-3 border border-[#0A0A0A]/8 grid grid-cols-1 md:grid-cols-4 gap-3 items-end" data-testid={`menu-item-${i}`}>
          <FInput label="Libellé" value={it.label || ""} onChange={(x) => upd(i, { ...it, label: x })} />
          <FInput label="Lien" value={it.to || ""} onChange={(x) => upd(i, { ...it, to: x })} />
          <FInput label="Ordre" type="number" value={it.order ?? i + 1} onChange={(x) => upd(i, { ...it, order: Number(x) || 0 })} />
          <button onClick={() => on({ ...v, primary: items.filter((_, x) => x !== i) })} className="px-3 py-2 border border-[#0A0A0A]/15 hover:border-red-500 hover:text-red-600 text-xs"><Trash2 size={13} /></button>
        </div>
      ))}
      <button onClick={() => on({ ...v, primary: [...items, { label: "", to: "/", order: items.length + 1 }] })} className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#B8922A] text-[#B8922A] text-[0.65rem] tracking-[0.3em] uppercase">
        <Plus size={12} /> Ajouter un lien
      </button>
    </div>
  );
}

function SEOEditor({ v, on }) {
  const def = v.default || {};
  const pages = v.pages || {};
  const pageKeys = Object.keys(pages);
  return (
    <div className="space-y-6" data-testid="seo-editor">
      <div className="border border-[#0A0A0A]/10 p-4 bg-[#FBF8EF]/40">
        <h3 className="font-serif text-lg mb-3">Défauts SEO (fallback sur tout le site)</h3>
        <div className="space-y-3">
          <FInput label="Nom du site" value={def.site_name || ""} onChange={(x) => on({ ...v, default: { ...def, site_name: x } })} />
          <FInput label="Title par défaut" value={def.default_title || ""} onChange={(x) => on({ ...v, default: { ...def, default_title: x } })} testid="seo-default-title" />
          <FTextarea label="Description par défaut" rows={2} value={def.default_description || ""} onChange={(x) => on({ ...v, default: { ...def, default_description: x } })} testid="seo-default-desc" />
          <ImageField label="Open Graph Image par défaut" value={def.default_og_image} onChange={(x) => on({ ...v, default: { ...def, default_og_image: x } })} />
          <FInput label="Mots-clés (séparés par virgules)" value={def.keywords || ""} onChange={(x) => on({ ...v, default: { ...def, keywords: x } })} />
        </div>
      </div>
      <div className="text-[10px] tracking-[0.3em] uppercase text-[#0A0A0A]/55">SEO par page</div>
      {pageKeys.map((pk) => {
        const p = pages[pk] || {};
        const u = (k, x) => on({ ...v, pages: { ...pages, [pk]: { ...p, [k]: x } } });
        return (
          <div key={pk} className="bg-[#FAF7F2] p-4 border border-[#0A0A0A]/8 space-y-3" data-testid={`seo-page-${pk.replace(/\//g, '_')}`}>
            <div className="font-mono text-xs text-[#B8922A]">{pk}</div>
            <FInput label="Meta Title" value={p.title || ""} onChange={(x) => u("title", x)} />
            <FTextarea label="Meta Description" rows={2} value={p.description || ""} onChange={(x) => u("description", x)} />
            <ImageField label="Open Graph Image" value={p.og_image} onChange={(x) => u("og_image", x)} />
            <FInput label="Mots-clés" value={p.keywords || ""} onChange={(x) => u("keywords", x)} />
          </div>
        );
      })}
    </div>
  );
}

// Image picker that integrates with the Media Library.
function ImageField({ label, value, onChange, testid }) {
  const [picking, setPicking] = useState(false);
  return (
    <div data-testid={testid}>
      <div className="block text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1.5">{label}</div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… ou /api/media-library/…"
          className="flex-1 border border-[#0A0A0A]/15 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#B8922A]"
        />
        <button type="button" onClick={() => setPicking(true)} className="px-3 py-2 border border-[#0A0A0A]/15 text-[0.6rem] tracking-[0.3em] uppercase hover:border-[#B8922A] hover:text-[#B8922A] whitespace-nowrap">
          <ImageIcon size={12} className="inline mr-1" /> Médiathèque
        </button>
      </div>
      {value && (
        <div className="mt-2"><img src={value.startsWith("/") ? `${process.env.REACT_APP_BACKEND_URL}${value}` : value} alt="" className="h-20 w-32 object-cover border border-[#0A0A0A]/10" /></div>
      )}
      {picking && <MediaPickerModal onClose={() => setPicking(false)} onPick={(url) => { onChange(url); setPicking(false); }} />}
    </div>
  );
}

function GalleryField({ label, value = [], onChange, testid }) {
  const [picking, setPicking] = useState(false);
  return (
    <div data-testid={testid}>
      <div className="block text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((url, i) => (
          <div key={i} className="relative group">
            <img src={url.startsWith("/") ? `${process.env.REACT_APP_BACKEND_URL}${url}` : url} alt="" className="h-20 w-20 object-cover border border-[#0A0A0A]/10" />
            <button onClick={() => onChange(value.filter((_, x) => x !== i))} className="absolute top-0 right-0 p-0.5 bg-white border border-[#0A0A0A]/15 opacity-0 group-hover:opacity-100"><Trash2 size={10} className="text-red-600" /></button>
          </div>
        ))}
        <button onClick={() => setPicking(true)} className="h-20 w-20 border border-dashed border-[#B8922A] text-[#B8922A] flex items-center justify-center hover:bg-[#FBF8EF]/30"><Plus size={16} /></button>
      </div>
      {picking && <MediaPickerModal onClose={() => setPicking(false)} onPick={(url) => { onChange([...value, url]); setPicking(false); }} />}
    </div>
  );
}

function MediaPickerModal({ onClose, onPick }) {
  const { token } = useStaffAuth();
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/staff/media-library?limit=200`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) setItems((await r.json()).items || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [token]);
  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("label", file.name);
    const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/staff/media-library`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
    });
    if (r.ok) {
      const m = await r.json();
      onPick(m.url);
    }
    setUploading(false);
  }
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" data-testid="media-picker-modal">
      <div className="bg-white max-w-3xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#0A0A0A]/10">
          <div className="font-display-serif text-lg">Médiathèque</div>
          <div className="flex items-center gap-2">
            <label className="px-3 py-2 border border-[#0A0A0A]/15 text-[0.6rem] tracking-[0.3em] uppercase hover:border-[#B8922A] hover:text-[#B8922A] cursor-pointer" data-testid="media-picker-upload">
              {uploading ? "Upload…" : "Uploader"}
              <input type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />
            </label>
            <button onClick={onClose} className="px-3 py-2 text-xs tracking-wider uppercase">Fermer</button>
          </div>
        </div>
        <div className="p-4">
          {loading ? <div className="text-sm text-[#0A0A0A]/45 py-8 text-center">Chargement…</div> : items.length === 0 ? (
            <div className="text-sm text-[#0A0A0A]/45 py-8 text-center">Aucun média. Uploadez votre premier fichier.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((m) => (
                <button key={m.id} onClick={() => onPick(m.url)} className="border border-[#0A0A0A]/10 hover:border-[#B8922A] p-1.5 text-left">
                  {m.kind === "image"
                    ? <img src={`${process.env.REACT_APP_BACKEND_URL}${m.url}`} alt="" className="w-full aspect-square object-cover" />
                    : <div className="w-full aspect-square bg-[#0A0A0A]/5 flex items-center justify-center text-[10px] uppercase">VIDÉO</div>
                  }
                  <div className="text-[10px] mt-1 truncate">{m.label || m.original_filename}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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

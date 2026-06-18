/**
 * Staff Blog — Editorial CRUD for the Vitrine Journal.
 *
 * Capabilities:
 *  - List all articles (draft + published), search, filter by status.
 *  - Create / edit article in a modal editor (HTML body).
 *  - Publish / unpublish + delete (admin only).
 *  - Preview link to the public /blog/{slug}.
 */
import { useEffect, useState } from "react";
import {
  Plus, RefreshCw, Search, Edit2, Trash2, Save, X,
  Eye, Send, FileText, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const STATUS_TABS = [
  { id: "", label: "Tous" },
  { id: "draft", label: "Brouillons" },
  { id: "published", label: "Publiés" },
];

const STATUS_BADGE = {
  draft: "bg-amber-50 text-amber-800 border-amber-300",
  published: "bg-emerald-50 text-emerald-800 border-emerald-300",
};

const EMPTY = {
  title: "", excerpt: "", body: "<p></p>",
  cover_image_url: "", author_name: "L'équipe BBR",
  category: "", tags: [], read_minutes: 4, status: "draft",
};

export default function StaffBlog() {
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState({ published: 0, draft: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | "<id>"
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const { data } = await api.get(`/staff/blog/articles?${params.toString()}`);
      setItems(data.items || []);
      setTotals({ published: data.total_published || 0, draft: data.total_draft || 0 });
    } catch {
      toast.error("Impossible de charger les articles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  function openNew() { setEditing("new"); setForm(EMPTY); }

  async function openEdit(a) {
    try {
      const { data } = await api.get(`/staff/blog/articles/${a.id}`);
      setForm({ ...EMPTY, ...data, tags: data.tags || [] });
      setEditing(a.id);
    } catch {
      toast.error("Impossible d'ouvrir l'article");
    }
  }

  function closeEdit() { setEditing(null); }

  async function save() {
    setSaving(true);
    try {
      const payload = { ...form };
      if (typeof payload.tags === "string") {
        payload.tags = payload.tags.split(",").map((t) => t.trim()).filter(Boolean);
      }
      if (editing === "new") {
        await api.post("/staff/blog/articles", payload);
        toast.success("Article créé");
      } else {
        await api.patch(`/staff/blog/articles/${editing}`, payload);
        toast.success("Article mis à jour");
      }
      closeEdit();
      load();
    } catch (err) {
      toast.error("Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  async function quickPublish(a) {
    try {
      await api.patch(`/staff/blog/articles/${a.id}`, { status: "published" });
      toast.success("Article publié");
      load();
    } catch { toast.error("Publication impossible"); }
  }

  async function quickUnpublish(a) {
    try {
      await api.patch(`/staff/blog/articles/${a.id}`, { status: "draft" });
      toast.info("Article repassé en brouillon");
      load();
    } catch { toast.error("Modification impossible"); }
  }

  async function remove(a) {
    if (!window.confirm(`Supprimer "${a.title}" ?`)) return;
    try {
      await api.delete(`/staff/blog/articles/${a.id}`);
      toast.success("Article supprimé");
      load();
    } catch {
      toast.error("Suppression impossible (admin requis)");
    }
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-blog">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-2">
            Vitrine · Éditorial
          </div>
          <h1 className="font-serif italic font-light text-3xl md:text-5xl leading-tight">
            Journal BBR
          </h1>
          <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
            Rédigez et publiez les chroniques de l'île pour le grand public.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#0A0A0A] text-white text-[0.65rem] tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors"
          data-testid="blog-new-btn"
        >
          <Plus size={14} />
          Nouvel article
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile label="Articles publiés" value={totals.published} accent />
        <StatTile label="Brouillons" value={totals.draft} />
        <StatTile label="Total" value={totals.published + totals.draft} />
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2">
          {STATUS_TABS.map((s) => (
            <button
              key={s.id || "all"}
              onClick={() => setStatus(s.id)}
              className={`px-3 py-2 text-[0.6rem] tracking-[0.3em] uppercase border ${
                status === s.id
                  ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                  : "bg-white text-[#0A0A0A]/65 border-[#0A0A0A]/15 hover:border-[#B8922A]"
              }`}
              data-testid={`blog-status-${s.id || "all"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex-1 flex items-center gap-2 border border-[#0A0A0A]/15 px-3 bg-white max-w-sm">
          <Search size={14} className="text-[#0A0A0A]/40" />
          <input
            placeholder="Rechercher titre, slug, catégorie…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            className="flex-1 py-2 text-sm bg-transparent focus:outline-none"
            data-testid="blog-search-input"
          />
        </div>
        <button onClick={load} className="p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A]" data-testid="blog-refresh-btn">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="bg-white border border-[#0A0A0A]/10 overflow-x-auto" data-testid="blog-list">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#0A0A0A]/45">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#0A0A0A]/45">Aucun article</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[0.55rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
              <tr>
                <th className="text-left py-3 px-4">Titre</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Catégorie</th>
                <th className="text-left py-3 px-4 hidden lg:table-cell">Slug</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-[#0A0A0A]/5 hover:bg-[#FAF7F2] transition-colors"
                    data-testid={`blog-row-${a.slug}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {a.cover_image_url ? (
                        <img src={a.cover_image_url} alt="" className="w-10 h-12 object-cover bg-[#FAF7F2]" />
                      ) : (
                        <div className="w-10 h-12 bg-[#FAF7F2] flex items-center justify-center text-[#0A0A0A]/30">
                          <FileText size={14} />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-[#0A0A0A]">{a.title}</div>
                        {a.excerpt && (
                          <div className="text-xs text-[#0A0A0A]/55 line-clamp-1 max-w-md">
                            {a.excerpt}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-xs text-[#0A0A0A]/65">
                    {a.category || "—"}
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell text-xs font-mono text-[#0A0A0A]/55">
                    /{a.slug}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-[10px] tracking-wider uppercase border ${STATUS_BADGE[a.status] || ""}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      {a.status === "published" ? (
                        <>
                          <a
                            href={`/blog/${a.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-[#0A0A0A]/55 hover:text-[#B8922A]"
                            title="Voir publié"
                          >
                            <ExternalLink size={13} />
                          </a>
                          <button onClick={() => quickUnpublish(a)} className="p-2 text-[#0A0A0A]/55 hover:text-amber-600" title="Repasser en brouillon">
                            <Eye size={13} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => quickPublish(a)} className="p-2 text-[#0A0A0A]/55 hover:text-emerald-600" title="Publier" data-testid={`blog-publish-${a.slug}`}>
                          <Send size={13} />
                        </button>
                      )}
                      <button onClick={() => openEdit(a)} className="p-2 text-[#0A0A0A]/55 hover:text-[#B8922A]" title="Modifier" data-testid={`blog-edit-${a.slug}`}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => remove(a)} className="p-2 text-[#0A0A0A]/55 hover:text-red-700" title="Supprimer">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ArticleModal
          isNew={editing === "new"}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={closeEdit}
          onSave={save}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <div className={`bg-white border p-5 ${accent ? "border-[#B8922A]" : "border-[#0A0A0A]/10"}`}>
      <div className="text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-2">{label}</div>
      <div className={`font-serif italic font-light text-2xl ${accent ? "text-[#B8922A]" : ""} tabular-nums`}>
        {value}
      </div>
    </div>
  );
}

function ArticleModal({ isNew, form, setForm, saving, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 md:p-4 bg-black/55 backdrop-blur-sm overflow-y-auto" data-testid="blog-modal">
      <div className="bg-white w-full max-w-3xl my-0 md:my-8 flex flex-col" style={{ maxHeight: "100vh" }}>
        <header className="flex items-center justify-between p-6 border-b border-[#0A0A0A]/10 sticky top-0 bg-white z-10">
          <h2 className="font-serif italic text-2xl">{isNew ? "Nouvel article" : "Modifier l'article"}</h2>
          <button onClick={onClose} className="p-1 text-[#0A0A0A]/55" data-testid="blog-modal-close">
            <X size={20} />
          </button>
        </header>
        <div className="p-6 space-y-4 overflow-y-auto">
          <FInput label="Titre *" value={form.title}
            onChange={(v) => setForm({ ...form, title: v })} testid="blog-input-title" />
          <FTextarea label="Extrait (1–2 phrases)" rows={2} value={form.excerpt || ""}
            onChange={(v) => setForm({ ...form, excerpt: v })} testid="blog-input-excerpt" maxLength={600} />
          <FInput label="URL image de couverture" value={form.cover_image_url || ""}
            onChange={(v) => setForm({ ...form, cover_image_url: v })}
            placeholder="https://..." testid="blog-input-cover" />
          <div className="grid grid-cols-2 gap-3">
            <FInput label="Auteur" value={form.author_name || ""}
              onChange={(v) => setForm({ ...form, author_name: v })} testid="blog-input-author" />
            <FInput label="Catégorie" value={form.category || ""}
              onChange={(v) => setForm({ ...form, category: v })}
              placeholder="ex: Art de vivre" testid="blog-input-category" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FInput label="Tags (séparés par virgule)"
              value={Array.isArray(form.tags) ? form.tags.join(", ") : form.tags}
              onChange={(v) => setForm({ ...form, tags: v })}
              testid="blog-input-tags" />
            <FInput label="Temps de lecture (min)" type="number"
              value={form.read_minutes || ""}
              onChange={(v) => setForm({ ...form, read_minutes: parseInt(v, 10) || null })}
              testid="blog-input-readtime" />
          </div>
          <FTextarea label="Corps de l'article (HTML accepté) *" rows={14}
            value={form.body || ""}
            onChange={(v) => setForm({ ...form, body: v })}
            testid="blog-input-body"
            mono
            maxLength={80000} />
          <label className="block">
            <span className="block text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1.5">Statut</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm bg-white"
              data-testid="blog-input-status"
            >
              <option value="draft">Brouillon</option>
              <option value="published">Publié</option>
            </select>
          </label>
        </div>
        <footer className="p-6 border-t border-[#0A0A0A]/10 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-5 py-2.5 border border-[#0A0A0A]/15 text-[0.65rem] tracking-[0.3em] uppercase">
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.title || !form.body}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A0A0A] text-white text-[0.65rem] tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors disabled:opacity-50"
            data-testid="blog-form-save"
          >
            <Save size={13} />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function FInput({ label, value, onChange, type = "text", placeholder, testid }) {
  return (
    <label className="block">
      <span className="block text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1.5">{label}</span>
      <input
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:outline-none focus:border-[#B8922A]"
        data-testid={testid}
      />
    </label>
  );
}

function FTextarea({ label, value, onChange, rows = 3, mono, maxLength, testid }) {
  return (
    <label className="block">
      <span className="block text-[0.55rem] tracking-[0.3em] uppercase text-[#0A0A0A]/55 mb-1.5">{label}</span>
      <textarea
        rows={rows}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:outline-none focus:border-[#B8922A] resize-y ${mono ? "font-mono text-[13px]" : ""}`}
        maxLength={maxLength}
        data-testid={testid}
      />
    </label>
  );
}

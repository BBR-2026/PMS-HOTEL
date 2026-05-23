import { useEffect, useState } from "react";
import { Upload, Megaphone, Send, Trash2, X, Eye, FileSpreadsheet, Calendar, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const OFFER_TYPES = [
  { id: "pass_day", label: "Day Pass (Beach Club)" },
  { id: "sunset", label: "The Sunset Experience" },
  { id: "brunch", label: "B Brunch" },
  { id: "le_kaai", label: "Le Kaaï (restaurant)" },
  { id: "hebergement", label: "Hébergement" },
  { id: "spa_wellness", label: "Spa & Wellness" },
  { id: "lounge", label: "Lounge" },
  { id: "seminaire", label: "Séminaire résidentiel" },
  { id: "team_building", label: "Team Building" },
  { id: "journee_etude", label: "Journée d'étude" },
  { id: "dejeuner_diner_entreprise", label: "Déjeuner & dîner entreprise" },
  { id: "formule_personnalisee", label: "Formule personnalisée" },
  { id: "offres_loisirs", label: "Offres Loisirs" },
  { id: "special_event", label: "Événement spécial" },
];

const STATUS_BADGE = {
  draft:     { color: "bg-[#0A0A0A]/10 text-[#0A0A0A]/70", label: "Brouillon", icon: Clock },
  scheduled: { color: "bg-[#B8922A]/15 text-[#B8922A]",    label: "Programmée", icon: Calendar },
  sending:   { color: "bg-blue-100 text-blue-700",         label: "Envoi en cours", icon: Send },
  done:      { color: "bg-green-100 text-green-700",       label: "Envoyée", icon: CheckCircle2 },
  cancelled: { color: "bg-[#0A0A0A]/10 text-[#0A0A0A]/50", label: "Annulée", icon: X },
  failed:    { color: "bg-red-100 text-red-700",           label: "Échec", icon: AlertCircle },
};

export default function StaffCampaigns() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/staff/campaigns");
      setItems(data.items || []);
    } catch {
      toast.error("Impossible de charger les campagnes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-campaigns">
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2">
            <Megaphone size={14} /> Marketing
          </div>
          <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A]">Campagnes e-mail</h1>
          <p className="text-sm text-[#0A0A0A]/55 max-w-2xl mt-2">
            Importez une liste CSV ou Excel et programmez l'envoi d'un e-mail signature BBr à vos contacts.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-[#0A0A0A] text-white px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] inline-flex items-center gap-2 hover:bg-[#B8922A] transition-colors"
          data-testid="new-campaign-btn"
        >
          <Megaphone size={14} /> Nouvelle campagne
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-[#0A0A0A]/50">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-[#0A0A0A]/15 p-10 text-center text-[#0A0A0A]/55 text-sm">
          Aucune campagne pour le moment. Cliquez sur <b>Nouvelle campagne</b> pour démarrer.
        </div>
      ) : (
        <div className="space-y-3" data-testid="campaign-list">
          {items.map((c) => <CampaignRow key={c.id} c={c} onChange={reload} />)}
        </div>
      )}

      {showCreate && (
        <CampaignWizard onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); reload(); }} />
      )}
    </div>
  );
}

function CampaignRow({ c, onChange }) {
  const badge = STATUS_BADGE[c.status] || STATUS_BADGE.draft;
  const Icon = badge.icon;

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const sendNow = async () => {
    if (!window.confirm(`Envoyer maintenant à ${c.stats?.total ?? 0} destinataires ?`)) return;
    try { await api.post(`/staff/campaigns/${c.id}/send-now`); toast.success("Envoi déclenché"); setTimeout(onChange, 1500); }
    catch (e) { toast.error(e.response?.data?.detail || "Échec"); }
  };
  const cancel = async () => {
    if (!window.confirm("Annuler cette campagne ?")) return;
    try { await api.post(`/staff/campaigns/${c.id}/cancel`); toast.success("Annulée"); onChange(); }
    catch (e) { toast.error(e.response?.data?.detail || "Échec"); }
  };
  const remove = async () => {
    if (!window.confirm("Supprimer définitivement cette campagne ?")) return;
    try { await api.delete(`/staff/campaigns/${c.id}`); toast.success("Supprimée"); onChange(); }
    catch (e) { toast.error(e.response?.data?.detail || "Échec"); }
  };

  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-5 flex items-center gap-4 flex-wrap" data-testid={`campaign-${c.id}`}>
      <div className="flex-1 min-w-[200px]">
        <div className="font-medium text-[#0A0A0A]">{c.name}</div>
        <div className="text-[0.78rem] text-[#0A0A0A]/55 mt-0.5 truncate max-w-xl">{c.subject}</div>
      </div>
      <div className="text-[0.78rem] text-[#0A0A0A]/65 flex flex-col">
        <span className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/40">Destinataires</span>
        <span className="font-semibold text-base">{c.stats?.total ?? 0}</span>
      </div>
      <div className="text-[0.78rem] text-[#0A0A0A]/65 flex flex-col">
        <span className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/40">Programmée</span>
        <span>{fmtDate(c.scheduled_at)}</span>
      </div>
      {c.stats?.sent > 0 && (
        <div className="text-[0.78rem] text-green-700 flex flex-col">
          <span className="text-[0.65rem] uppercase tracking-[0.22em] text-green-600">Envoyés</span>
          <span className="font-semibold">{c.stats.sent}/{c.stats.total}</span>
        </div>
      )}
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[0.65rem] uppercase tracking-[0.18em] ${badge.color}`}>
        <Icon size={12} /> {badge.label}
      </span>
      <div className="flex items-center gap-2">
        {(c.status === "draft" || c.status === "scheduled") && (
          <button onClick={sendNow} className="px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.18em] bg-[#B8922A] text-white hover:bg-[#9F7E22]" data-testid={`send-${c.id}`}>
            Envoyer
          </button>
        )}
        {(c.status === "scheduled" || c.status === "draft") && (
          <button onClick={cancel} className="px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.18em] border border-[#0A0A0A]/15 text-[#0A0A0A]/70 hover:border-[#0A0A0A]">
            Annuler
          </button>
        )}
        <button onClick={remove} className="p-1.5 text-[#0A0A0A]/40 hover:text-red-600" title="Supprimer">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function CampaignWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [recipients, setRecipients] = useState([]);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    title: "",
    body: "",
    offer_type: "pass_day",
    cta_label: "Réserver",
    cta_url: "https://workflow-boulaybeachresort.com",
    scheduled_at: "",
  });
  const [previewHtml, setPreviewHtml] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFileName(file.name);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/staff/campaigns/parse-list", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRecipients(data.recipients || []);
      if (data.total === 0) toast.warning("Aucun email détecté");
      else toast.success(`${data.total} destinataire(s) détecté(s)`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur de parsing");
    } finally {
      setUploading(false);
    }
  };

  const requestPreview = async () => {
    try {
      const { data } = await api.post("/staff/campaigns/preview", {
        ...form,
        recipients: recipients.slice(0, 1),
      });
      setPreviewHtml(data.html);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec preview");
    }
  };

  const submit = async (publish) => {
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        recipients,
        scheduled_at: publish && form.scheduled_at
          ? new Date(form.scheduled_at).toISOString()
          : null,
      };
      await api.post("/staff/campaigns", payload);
      toast.success(publish ? "Campagne programmée" : "Brouillon enregistré");
      onCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  const valid = recipients.length > 0 && form.subject.trim() && form.body.trim();

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" data-testid="campaign-wizard">
      <div className="bg-white max-w-4xl w-full my-8 max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#0A0A0A]/10 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A]">Étape {step}/3</div>
            <h2 className="font-display-serif text-xl text-[#0A0A0A]">
              {step === 1 ? "Importer la liste" : step === 2 ? "Composer l'e-mail" : "Programmer & valider"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#0A0A0A]/5" data-testid="close-wizard">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {step === 1 && (
            <>
              <p className="text-sm text-[#0A0A0A]/65">
                Importez un fichier <b>.csv</b> ou <b>.xlsx</b> contenant au minimum une colonne email.
                Le système détecte automatiquement les colonnes Nom et Email.
              </p>
              <label className="block border-2 border-dashed border-[#0A0A0A]/15 hover:border-[#B8922A] p-10 text-center cursor-pointer transition-colors" data-testid="upload-zone">
                <input type="file" accept=".csv,.xlsx" className="hidden" onChange={onFile} />
                <FileSpreadsheet size={32} className="mx-auto text-[#B8922A] mb-3" />
                <div className="font-medium text-[#0A0A0A]">{uploading ? "Lecture en cours…" : "Cliquez pour choisir un fichier"}</div>
                <div className="text-xs text-[#0A0A0A]/55 mt-1">{fileName || "CSV ou XLSX · 4 Mo max"}</div>
              </label>

              {recipients.length > 0 && (
                <div className="border border-[#0A0A0A]/10">
                  <div className="px-4 py-2.5 bg-[#FAFAF7] text-[0.78rem] flex justify-between">
                    <span><b>{recipients.length}</b> destinataire(s) détecté(s)</span>
                    <button onClick={() => { setRecipients([]); setFileName(""); }} className="text-[#B8922A] hover:underline">Effacer</button>
                  </div>
                  <div className="max-h-56 overflow-y-auto text-[0.82rem] divide-y divide-[#0A0A0A]/5">
                    {recipients.slice(0, 50).map((r, i) => (
                      <div key={i} className="px-4 py-1.5 flex justify-between" data-testid={`recipient-${i}`}>
                        <span className="text-[#0A0A0A]">{r.email}</span>
                        <span className="text-[#0A0A0A]/55">{r.name || "—"}</span>
                      </div>
                    ))}
                    {recipients.length > 50 && (
                      <div className="px-4 py-1.5 text-[#0A0A0A]/45 text-center">+ {recipients.length - 50} de plus…</div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button onClick={onClose} className="px-5 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15">Annuler</button>
                <button onClick={() => setStep(2)} disabled={recipients.length === 0} className="px-5 py-2 text-[0.7rem] uppercase tracking-[0.22em] bg-[#0A0A0A] text-white disabled:opacity-30">Suivant</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <FieldRow label="Nom interne de la campagne">
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex : Pré-lancement Sunset Saison 2026" className="input-style" data-testid="field-name" />
              </FieldRow>
              <FieldRow label="Objet de l'e-mail *">
                <input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Ex : Demain à Boulay — Sunset Experience" className="input-style" data-testid="field-subject" />
              </FieldRow>
              <FieldRow label="Titre affiché en haut de l'e-mail *">
                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Ex : Bonjour {prenom}, demain c'est dimanche" className="input-style" data-testid="field-title" />
                <div className="text-[0.7rem] text-[#0A0A0A]/45 mt-1">Variables : <code>{"{prenom}"}</code></div>
              </FieldRow>
              <FieldRow label="Corps du message *">
                <textarea rows={6} value={form.body} onChange={e => setForm({...form, body: e.target.value})}
                  placeholder={`Bonjour {prenom},\n\nNous avons le plaisir...\n\nÀ très bientôt sur l'île.`}
                  className="input-style font-mono text-[0.85rem]" data-testid="field-body" />
                <div className="text-[0.7rem] text-[#0A0A0A]/45 mt-1">Séparez les paragraphes avec une ligne vide. Variables : <code>{"{prenom}"}</code></div>
              </FieldRow>
              <div className="grid md:grid-cols-2 gap-4">
                <FieldRow label="Univers / Image hero">
                  <select value={form.offer_type} onChange={e => setForm({...form, offer_type: e.target.value})} className="input-style" data-testid="field-offer">
                    {OFFER_TYPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Lien du bouton CTA">
                  <input value={form.cta_url} onChange={e => setForm({...form, cta_url: e.target.value})} placeholder="https://…" className="input-style" data-testid="field-cta-url" />
                </FieldRow>
              </div>
              <FieldRow label="Libellé du bouton CTA">
                <input value={form.cta_label} onChange={e => setForm({...form, cta_label: e.target.value})} placeholder="Ex : Réserver" className="input-style" data-testid="field-cta-label" />
              </FieldRow>

              {previewHtml && (
                <div className="border border-[#0A0A0A]/10">
                  <div className="bg-[#FAFAF7] px-3 py-2 flex justify-between text-[0.78rem]">
                    <span><Eye size={12} className="inline mr-1" /> Aperçu (avec le 1er destinataire)</span>
                    <button onClick={() => setPreviewHtml("")} className="text-[#B8922A]">Fermer</button>
                  </div>
                  <iframe title="preview" srcDoc={previewHtml} className="w-full h-[400px] bg-white" />
                </div>
              )}

              <div className="flex justify-between gap-3 pt-4">
                <button onClick={() => setStep(1)} className="px-5 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15">Retour</button>
                <div className="flex gap-3">
                  <button onClick={requestPreview} disabled={!valid} className="px-5 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#B8922A] text-[#B8922A] disabled:opacity-30" data-testid="btn-preview">
                    <Eye size={12} className="inline mr-1" /> Aperçu
                  </button>
                  <button onClick={() => setStep(3)} disabled={!valid} className="px-5 py-2 text-[0.7rem] uppercase tracking-[0.22em] bg-[#0A0A0A] text-white disabled:opacity-30">Suivant</button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="bg-[#FAFAF7] border-l-4 border-[#B8922A] p-4 text-[0.85rem]">
                <div><b>Destinataires :</b> {recipients.length}</div>
                <div><b>Objet :</b> {form.subject}</div>
                <div><b>Univers :</b> {OFFER_TYPES.find(o => o.id === form.offer_type)?.label}</div>
              </div>
              <FieldRow label="Date et heure d'envoi (laissez vide pour brouillon)">
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({...form, scheduled_at: e.target.value})} className="input-style" data-testid="field-schedule" />
                <div className="text-[0.7rem] text-[#0A0A0A]/45 mt-1">Heure locale du navigateur ; convertie en UTC côté serveur. Si vide, vous pourrez déclencher l'envoi manuellement depuis la liste.</div>
              </FieldRow>

              <div className="flex justify-between gap-3 pt-4">
                <button onClick={() => setStep(2)} className="px-5 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15">Retour</button>
                <div className="flex gap-3">
                  <button onClick={() => submit(false)} disabled={submitting || !valid} className="px-5 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 disabled:opacity-30" data-testid="btn-save-draft">
                    Enregistrer en brouillon
                  </button>
                  <button onClick={() => submit(true)} disabled={submitting || !valid || !form.scheduled_at} className="px-5 py-2 text-[0.7rem] uppercase tracking-[0.22em] bg-[#B8922A] text-white disabled:opacity-30" data-testid="btn-schedule">
                    <Send size={12} className="inline mr-1" /> Programmer l'envoi
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        .input-style { width:100%; border:1px solid rgba(10,10,10,0.15); padding:10px 12px; font-size:14px; background:#fff; }
        .input-style:focus { outline:none; border-color:#B8922A; }
      `}</style>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div>
      <label className="block text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

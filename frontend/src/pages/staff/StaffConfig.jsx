import { useEffect, useState } from "react";
import api from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { Settings, UserPlus, Trash2, Save, X, Plug, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, Database, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useStaffAuth } from "../../context/StaffAuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

const ROLE_LABEL = {
  admin: "Administrateur",
  management_general: "Management général (consultation)",
  manager_pole: "Manager pôle",
  manager: "Manager (legacy)",
  hotesse: "Hôtesse",
  serveur_caisse: "Serveur & caisse",
  logistique: "Logistique",
  verification: "Vérification (Scanner QR)",
  receptionist: "Réception (legacy)",
};

const ROLE_OPTIONS = [
  { value: "hotesse", label: "Hôtesse — Toutes les réservations" },
  { value: "serveur_caisse", label: "Serveur & caisse — Consommation sur place" },
  { value: "logistique", label: "Logistique — Opérations & scanner" },
  { value: "verification", label: "Vérification — Scanner QR uniquement" },
  { value: "manager_pole", label: "Manager pôle — un pôle dédié" },
  { value: "management_general", label: "Management général — Consultation" },
  { value: "admin", label: "Administrateur — tout le dashboard" },
];

const POLE_OPTIONS = [
  { value: "beach_club", label: "Beach Club" },
  { value: "hebergement", label: "Hébergement" },
  { value: "corporate", label: "Corporate" },
  { value: "activites_events", label: "Activités & Événements" },
  { value: "le_kaai", label: "Le Kaai" },
];

export default function StaffConfig() {
  const { user: currentUser } = useStaffAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "hotesse", pole_id: "" });
  const [edits, setEdits] = useState({}); // offer_id -> changes

  const refresh = async () => {
    setLoading(true);
    try {
      const [u, o] = await Promise.all([
        api.get("/staff/config/users"),
        api.get("/staff/config/offers"),
      ]);
      setUsers(u.data.items || []);
      setOffers(o.data.items || []);
    } catch (e) {
      toast.error("Chargement impossible");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const createUser = async () => {
    if (!form.name || !form.email || form.password.length < 8) {
      toast.error("Nom, email et mot de passe (8+ car.) requis");
      return;
    }
    if (form.role === "manager_pole" && !form.pole_id) {
      toast.error("Sélectionnez un pôle pour ce manager.");
      return;
    }
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      };
      if (form.role === "manager_pole" && form.pole_id) payload.pole_id = form.pole_id;
      await api.post("/staff/config/users", payload);
      setShowCreate(false);
      setForm({ name: "", email: "", password: "", role: "hotesse", pole_id: "" });
      refresh();
      toast.success("Utilisateur créé");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Création impossible");
    }
  };

  const updateUserRole = async (id, role, pole_id) => {
    try {
      const payload = { role };
      if (role === "manager_pole" && pole_id) payload.pole_id = pole_id;
      await api.patch(`/staff/config/users/${id}`, payload);
      refresh();
      toast.success("Rôle mis à jour");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Action impossible");
    }
  };

  const updateUserPole = async (id, pole_id) => {
    try {
      await api.patch(`/staff/config/users/${id}`, { pole_id });
      refresh();
      toast.success("Pôle mis à jour");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Action impossible");
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    try {
      await api.delete(`/staff/config/users/${id}`);
      refresh();
      toast.success("Utilisateur supprimé");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Suppression impossible");
    }
  };

  const updateOfferField = (oid, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [oid]: { ...(prev[oid] || {}), [field]: value },
    }));
  };

  const updateTierField = (oid, tierId, field, value) => {
    setEdits((prev) => {
      const current = prev[oid]?.room_tiers || offers.find((o) => o.id === oid)?.room_tiers || [];
      const newTiers = current.map((t) => (t.id === tierId ? { ...t, [field]: value } : t));
      return { ...prev, [oid]: { ...(prev[oid] || {}), room_tiers: newTiers } };
    });
  };

  const saveOffer = async (oid) => {
    const payload = edits[oid];
    if (!payload) return;
    // Convert string -> int for numeric fields, pass through text fields as-is
    const body = {};
    if (payload.price_adult !== undefined) body.price_adult = parseInt(payload.price_adult) || 0;
    if (payload.price_child !== undefined) body.price_child = parseInt(payload.price_child) || 0;
    if (payload.max_capacity !== undefined) body.max_capacity = parseInt(payload.max_capacity) || 1;
    for (const k of ["name_fr", "name_en", "schedule_fr", "schedule_en", "tagline_fr", "tagline_en", "image_url"]) {
      if (payload[k] !== undefined) body[k] = payload[k];
    }
    if (payload.room_tiers) {
      body.room_tiers = payload.room_tiers.map((t) => ({
        ...t,
        price: parseInt(t.price) || 0,
        inventory: t.inventory !== undefined ? parseInt(t.inventory) || 0 : undefined,
      }));
    }
    try {
      await api.patch(`/staff/config/offers/${oid}`, body);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[oid];
        return next;
      });
      refresh();
      toast.success("Offre mise à jour");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Sauvegarde impossible");
    }
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto" data-testid="staff-config">
      <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A] mb-2">Configuration</h1>
      <p className="text-sm text-[#0A0A0A]/55 mb-6">Gestion du personnel et des tarifs (réservé administrateur).</p>

      <div className="flex gap-2 mb-7 border-b border-[#0A0A0A]/10 overflow-x-auto">
        <button
          onClick={() => setTab("users")}
          className={`px-4 sm:px-5 py-3 text-[0.65rem] sm:text-[0.7rem] uppercase tracking-[0.22em] border-b-2 transition-colors whitespace-nowrap ${
            tab === "users" ? "border-[#B8922A] text-[#B8922A]" : "border-transparent text-[#0A0A0A]/60 hover:text-[#0A0A0A]"
          }`}
          data-testid="tab-users"
        >
          Utilisateurs ({users.length})
        </button>
        <button
          onClick={() => setTab("offers")}
          className={`px-4 sm:px-5 py-3 text-[0.65rem] sm:text-[0.7rem] uppercase tracking-[0.22em] border-b-2 transition-colors whitespace-nowrap ${
            tab === "offers" ? "border-[#B8922A] text-[#B8922A]" : "border-transparent text-[#0A0A0A]/60 hover:text-[#0A0A0A]"
          }`}
          data-testid="tab-offers"
        >
          Offres & Tarifs ({offers.length})
        </button>
        <button
          onClick={() => setTab("integrations")}
          className={`px-4 sm:px-5 py-3 text-[0.65rem] sm:text-[0.7rem] uppercase tracking-[0.22em] border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
            tab === "integrations" ? "border-[#B8922A] text-[#B8922A]" : "border-transparent text-[#0A0A0A]/60 hover:text-[#0A0A0A]"
          }`}
          data-testid="tab-integrations"
        >
          <Plug size={11} /> Intégrations
        </button>
        <button
          onClick={() => setTab("maintenance")}
          className={`px-4 sm:px-5 py-3 text-[0.65rem] sm:text-[0.7rem] uppercase tracking-[0.22em] border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
            tab === "maintenance" ? "border-[#B8922A] text-[#B8922A]" : "border-transparent text-[#0A0A0A]/60 hover:text-[#0A0A0A]"
          }`}
          data-testid="tab-maintenance"
        >
          <Database size={11} /> Maintenance
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-[#0A0A0A]/50">Chargement…</div>
      ) : tab === "users" ? (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#B8922A] text-[#B8922A] text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#B8922A]/5"
              data-testid="add-user-btn"
            >
              <UserPlus size={13} /> Nouvel utilisateur
            </button>
          </div>          <div className="bg-white border border-[#0A0A0A]/8">
            <div className="hidden md:grid grid-cols-12 text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50 px-5 py-3 border-b border-[#0A0A0A]/10 bg-[#FAFAF7]">
              <div className="col-span-3">Nom</div>
              <div className="col-span-4">Email</div>
              <div className="col-span-3">Rôle</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            {users.map((u) => (
              <div
                key={u.id}
                className="md:grid md:grid-cols-12 md:items-center flex flex-col items-start gap-3 md:gap-0 px-5 py-4 border-b border-[#0A0A0A]/5"
                data-testid={`user-row-${u.id}`}
              >
                <div className="md:col-span-3 text-sm text-[#0A0A0A] w-full">{u.name}</div>
                <div className="md:col-span-4 text-sm text-[#0A0A0A]/70 break-all w-full">{u.email}</div>
                <div className="md:col-span-3 w-full md:w-auto space-y-2">
                  <Select
                    value={u.role}
                    onValueChange={(v) => updateUserRole(u.id, v, u.pole_id)}
                    disabled={u.id === currentUser?.id}
                  >
                    <SelectTrigger className="h-9 text-sm" data-testid={`user-role-${u.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {u.role === "manager_pole" && u.id !== currentUser?.id && (
                    <Select
                      value={u.pole_id || ""}
                      onValueChange={(v) => updateUserPole(u.id, v)}
                    >
                      <SelectTrigger className="h-9 text-xs" data-testid={`user-pole-${u.id}`}>
                        <SelectValue placeholder="Sélectionner le pôle…" />
                      </SelectTrigger>
                      <SelectContent>
                        {POLE_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="md:col-span-2 md:text-right w-full">
                  {u.id !== currentUser?.id && (
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="text-red-600 hover:text-red-800 inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.18em]"
                      data-testid={`delete-user-${u.id}`}
                    >
                      <Trash2 size={11} /> Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : tab === "offers" ? (
        <div className="space-y-5">
          {offers.map((o) => {
            const e = edits[o.id] || {};
            const dirty = Object.keys(e).length > 0;
            const currentTiers = e.room_tiers || o.room_tiers || [];
            return (
              <div key={o.id} className="bg-white border border-[#0A0A0A]/8 p-5" data-testid={`offer-config-${o.id}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-display-serif text-xl text-[#0A0A0A]">{o.name_fr}</div>
                    <div className="text-[0.7rem] text-[#0A0A0A]/55">{o.schedule_fr}</div>
                  </div>
                  {dirty && (
                    <button
                      onClick={() => saveOffer(o.id)}
                      className="inline-flex items-center gap-2 bg-[#B8922A] text-white px-4 py-2 text-[0.65rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23]"
                      data-testid={`save-offer-${o.id}`}
                    >
                      <Save size={11} /> Enregistrer
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {o.price_adult > 0 || !o.room_tiers ? (
                    <>
                      <div>
                        <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Prix adulte (FCFA)</label>
                        <input
                          type="number"
                          value={e.price_adult ?? o.price_adult}
                          onChange={(ev) => updateOfferField(o.id, "price_adult", ev.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                          data-testid={`price-adult-${o.id}`}
                        />
                      </div>
                      <div>
                        <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Prix enfant (FCFA)</label>
                        <input
                          type="number"
                          value={e.price_child ?? o.price_child}
                          onChange={(ev) => updateOfferField(o.id, "price_child", ev.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                          data-testid={`price-child-${o.id}`}
                        />
                      </div>
                    </>
                  ) : null}
                  <div>
                    <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Capacité max</label>
                    <input
                      type="number"
                      value={e.max_capacity ?? o.max_capacity}
                      onChange={(ev) => updateOfferField(o.id, "max_capacity", ev.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                      data-testid={`max-capacity-${o.id}`}
                    />
                  </div>
                </div>

                {o.room_tiers && o.room_tiers.length > 0 && (
                  <div className="mt-5">
                    <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3">
                      Tarifs chambres (par nuit) & inventaire
                    </div>
                    <div className="space-y-2">
                      {currentTiers.map((t) => (
                        <div key={t.id} className="grid grid-cols-12 items-center gap-2 sm:gap-3">
                          <div className="col-span-12 sm:col-span-4 text-sm text-[#0A0A0A]">{t.name_fr}</div>
                          <div className="col-span-6 sm:col-span-3">
                            <label className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50 block mb-0.5">Prix</label>
                            <input
                              type="number"
                              value={t.price}
                              onChange={(ev) => updateTierField(o.id, t.id, "price", ev.target.value)}
                              className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                              data-testid={`tier-price-${t.id}`}
                            />
                          </div>
                          <div className="col-span-6 sm:col-span-2">
                            <label className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50 block mb-0.5">Inventaire</label>
                            <input
                              type="number"
                              value={t.inventory ?? 0}
                              onChange={(ev) => updateTierField(o.id, t.id, "inventory", ev.target.value)}
                              className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                              data-testid={`tier-inventory-${t.id}`}
                            />
                          </div>
                          <div className="col-span-12 sm:col-span-3 text-sm text-[#0A0A0A]/55 sm:text-right">{formatXOF(parseInt(t.price) || 0)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Editorial content — name, schedule, tagline, image */}
                <div className="mt-6 pt-5 border-t border-[#0A0A0A]/8">
                  <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3">
                    Contenu éditorial
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50 block mb-1">Nom (FR)</label>
                      <input
                        value={e.name_fr ?? o.name_fr ?? ""}
                        onChange={(ev) => updateOfferField(o.id, "name_fr", ev.target.value)}
                        className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                        data-testid={`name-fr-${o.id}`}
                      />
                    </div>
                    <div>
                      <label className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50 block mb-1">Nom (EN)</label>
                      <input
                        value={e.name_en ?? o.name_en ?? ""}
                        onChange={(ev) => updateOfferField(o.id, "name_en", ev.target.value)}
                        className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                        data-testid={`name-en-${o.id}`}
                      />
                    </div>
                    <div>
                      <label className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50 block mb-1">Horaire (FR)</label>
                      <input
                        value={e.schedule_fr ?? o.schedule_fr ?? ""}
                        onChange={(ev) => updateOfferField(o.id, "schedule_fr", ev.target.value)}
                        className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                        data-testid={`schedule-fr-${o.id}`}
                      />
                    </div>
                    <div>
                      <label className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50 block mb-1">Horaire (EN)</label>
                      <input
                        value={e.schedule_en ?? o.schedule_en ?? ""}
                        onChange={(ev) => updateOfferField(o.id, "schedule_en", ev.target.value)}
                        className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                        data-testid={`schedule-en-${o.id}`}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50 block mb-1">Description (FR)</label>
                      <textarea
                        rows={5}
                        value={e.tagline_fr ?? o.tagline_fr ?? ""}
                        onChange={(ev) => updateOfferField(o.id, "tagline_fr", ev.target.value)}
                        className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm font-sans leading-relaxed"
                        data-testid={`tagline-fr-${o.id}`}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50 block mb-1">Description (EN)</label>
                      <textarea
                        rows={5}
                        value={e.tagline_en ?? o.tagline_en ?? ""}
                        onChange={(ev) => updateOfferField(o.id, "tagline_en", ev.target.value)}
                        className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm font-sans leading-relaxed"
                        data-testid={`tagline-en-${o.id}`}
                      />
                    </div>
                  </div>

                  {/* Image — URL or local file upload */}
                  <div className="mt-4">
                    <label className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50 block mb-2">
                      Image de l'offre
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      {(e.image_url ?? o.image_url) ? (
                        <div className="relative group shrink-0">
                          <img
                            src={e.image_url ?? o.image_url}
                            alt=""
                            className="w-32 h-32 object-cover border border-[#0A0A0A]/15"
                            data-testid={`image-preview-${o.id}`}
                          />
                          <button
                            type="button"
                            onClick={() => updateOfferField(o.id, "image_url", "")}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-[0.8rem] hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`image-clear-${o.id}`}
                            title="Retirer l'image"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-32 h-32 border-2 border-dashed border-[#0A0A0A]/15 flex items-center justify-center text-[0.7rem] text-[#0A0A0A]/40 shrink-0">
                          Aucune image
                        </div>
                      )}
                      <div className="flex-1 w-full space-y-3">
                        <label
                          className="inline-flex items-center gap-2 cursor-pointer bg-[#0A0A0A] text-white px-4 py-2.5 text-[0.65rem] uppercase tracking-[0.22em] hover:bg-[#1A1A1A] transition-colors"
                          data-testid={`image-upload-label-${o.id}`}
                        >
                          <UploadCloud size={14} />
                          Choisir un fichier depuis le PC
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            data-testid={`image-upload-${o.id}`}
                            onChange={async (ev) => {
                              const f = ev.target.files?.[0];
                              if (!f) return;
                              if (!f.type.startsWith("image/")) {
                                toast.error("Le fichier doit être une image");
                                ev.target.value = "";
                                return;
                              }
                              if (f.size > 5 * 1024 * 1024) {
                                toast.error(`Image trop volumineuse (${(f.size / 1024 / 1024).toFixed(1)} Mo). Max 5 Mo.`);
                                ev.target.value = "";
                                return;
                              }
                              try {
                                const fd = new FormData();
                                fd.append("file", f);
                                const { data } = await api.post("/staff/uploads/image", fd, {
                                  headers: { "Content-Type": "multipart/form-data" },
                                });
                                updateOfferField(o.id, "image_url", data.url);
                                toast.success("Image téléversée");
                              } catch (err) {
                                toast.error(err.response?.data?.detail || "Échec de l'upload");
                              }
                              ev.target.value = "";
                            }}
                          />
                        </label>
                        <div className="text-[0.65rem] text-[#0A0A0A]/45">
                          Formats : JPG, PNG, WebP · Max 5 Mo · Ratio recommandé 16:9
                        </div>
                        <div>
                          <label className="text-[0.55rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50 block mb-1">
                            ou coller une URL d'image
                          </label>
                          <input
                            type="url"
                            placeholder="https://..."
                            value={(e.image_url ?? o.image_url ?? "").startsWith("data:") ? "" : (e.image_url ?? o.image_url ?? "")}
                            onChange={(ev) => updateOfferField(o.id, "image_url", ev.target.value)}
                            className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                            data-testid={`image-url-${o.id}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === "integrations" ? (
        <IntegrationsPanel />
      ) : tab === "maintenance" ? (
        <MaintenancePanel />
      ) : null}

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white p-7 w-full max-w-md" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display-serif text-2xl text-[#0A0A0A]">Nouvel utilisateur</h3>
              <button onClick={() => setShowCreate(false)} className="text-[#0A0A0A]/50 hover:text-[#0A0A0A]">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Nom complet</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                  data-testid="new-user-name"
                />
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                  data-testid="new-user-email"
                />
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Mot de passe (8+ caractères)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm"
                  data-testid="new-user-password"
                />
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Rôle</label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v, pole_id: v === "manager_pole" ? form.pole_id : "" })}>
                  <SelectTrigger className="mt-1 h-10 text-sm" data-testid="new-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.role === "manager_pole" && (
                <div>
                  <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Pôle attribué</label>
                  <Select value={form.pole_id} onValueChange={(v) => setForm({ ...form, pole_id: v })}>
                    <SelectTrigger className="mt-1 h-10 text-sm" data-testid="new-user-pole">
                      <SelectValue placeholder="Choisir un pôle…" />
                    </SelectTrigger>
                    <SelectContent>
                      {POLE_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <button
              onClick={createUser}
              className="w-full mt-5 bg-[#B8922A] text-white py-2.5 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23]"
              data-testid="create-user-btn"
            >
              Créer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// INTEGRATIONS PANEL — admin connectivity test for Fineo & Twilio
// ============================================================
function IntegrationsPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fineoResult, setFineoResult] = useState(null);
  const [fineoBusy, setFineoBusy] = useState(false);
  const [sgResult, setSgResult] = useState(null);
  const [sgBusy, setSgBusy] = useState(false);
  const [sgTo, setSgTo] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/staff/integrations/status`);
      setStatus(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const testFineo = async () => {
    setFineoBusy(true);
    setFineoResult(null);
    try {
      const { data } = await api.post(`/staff/integrations/fineo/test`);
      setFineoResult(data);
      if (data.ok) toast.success("Connexion FineoPay OK");
      else toast.error("FineoPay : test échoué — voir détails ci-dessous", { duration: 8000 });
    } catch (e) {
      const detail = e.response?.data?.detail || e.message;
      setFineoResult({ ok: false, stage: "http", message: detail });
      toast.error(detail);
    } finally {
      setFineoBusy(false);
    }
  };

  const testSendGrid = async () => {
    if (!sgTo) { toast.error("Saisissez une adresse email"); return; }
    setSgBusy(true);
    setSgResult(null);
    try {
      const { data } = await api.post(`/staff/integrations/sendgrid/test`, { to_email: sgTo });
      setSgResult(data);
      if (data.ok) toast.success(`Email envoyé à ${sgTo}`);
      else toast.error(data.message || data.error || "Échec", { duration: 8000 });
    } catch (e) {
      const detail = e.response?.data?.detail || e.message;
      setSgResult({ ok: false, error: detail });
      toast.error(detail);
    } finally {
      setSgBusy(false);
    }
  };

  if (loading || !status) return <div className="text-sm text-[#0A0A0A]/50">Chargement…</div>;

  return (
    <div className="space-y-6" data-testid="integrations-panel">
      <p className="text-sm text-[#0A0A0A]/55 max-w-3xl">
        Vérifiez l'état de chaque intégration tierce et lancez un test de connectivité réel.
        Les valeurs sensibles (clés API) sont masquées.
      </p>

      {/* ============ FINEOPAY ============ */}
      <div className="bg-white border border-[#0A0A0A]/8 p-5 sm:p-6" data-testid="integ-fineo">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">Paiement en ligne</div>
            <h3 className="font-display-serif text-xl sm:text-2xl text-[#0A0A0A]">FineoPay</h3>
            <p className="text-[0.75rem] text-[#0A0A0A]/55 mt-1 max-w-2xl">
              Passerelle de paiement (carte bancaire, Mobile Money) — hosted-checkout.
            </p>
          </div>
          <StatusBadge ok={status.fineo.enabled} okLabel="Configuré" koLabel="Non configuré" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <ConfigRow label="Base URL" value={status.fineo.base_url} mono />
          <ConfigRow label="Business code" value={status.fineo.business_code} mono />
          <ConfigRow label="Clé API" value={status.fineo.api_key_prefix} mono />
          <ConfigRow label="URL publique callback" value={status.fineo.public_base_url} mono small />
        </div>

        <button
          onClick={testFineo}
          disabled={fineoBusy || !status.fineo.enabled}
          className="bg-[#B8922A] text-white px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] disabled:opacity-50 inline-flex items-center gap-2"
          data-testid="fineo-test-btn"
        >
          {fineoBusy ? <RefreshCw size={12} className="animate-spin" /> : <Plug size={12} />}
          Tester la connexion FineoPay
        </button>

        {fineoResult && (
          <div className={`mt-5 border p-4 text-sm ${fineoResult.ok ? "border-emerald-300 bg-emerald-50/60" : "border-rose-300 bg-rose-50/60"}`} data-testid="fineo-test-result">
            <div className="flex items-start gap-2 mb-2">
              {fineoResult.ok
                ? <CheckCircle2 size={16} className="mt-0.5 text-emerald-700 flex-shrink-0" />
                : <AlertTriangle size={16} className="mt-0.5 text-rose-700 flex-shrink-0" />}
              <div className={`font-medium ${fineoResult.ok ? "text-emerald-900" : "text-rose-900"}`}>
                {fineoResult.message || (fineoResult.ok ? "OK" : "Échec")}
              </div>
            </div>
            {fineoResult.ok && fineoResult.checkout_url && (
              <a
                href={fineoResult.checkout_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-emerald-800 hover:underline mt-1"
              >
                <ExternalLink size={11} /> Ouvrir le lien de paiement test
              </a>
            )}
            {!fineoResult.ok && (
              <div className="text-[0.72rem] text-[#0A0A0A]/65 space-y-0.5 mt-2 pl-6">
                {fineoResult.fineo_message && (
                  <div>
                    <span className="font-medium text-[#0A0A0A]/80">Réponse FineoPay :</span>{" "}
                    <span className="font-mono">{fineoResult.fineo_message}</span>
                  </div>
                )}
                {fineoResult.http_status && (
                  <div><span className="font-medium text-[#0A0A0A]/80">HTTP :</span> {fineoResult.http_status}</div>
                )}
                {fineoResult.stage && (
                  <div><span className="font-medium text-[#0A0A0A]/80">Étape :</span> {fineoResult.stage}</div>
                )}
                {fineoResult.request?.url && (
                  <div className="break-all">
                    <span className="font-medium text-[#0A0A0A]/80">URL appelée :</span>{" "}
                    <span className="font-mono text-[0.68rem]">{fineoResult.request.url}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============ SENDGRID ============ */}
      <div className="bg-white border border-[#0A0A0A]/8 p-5 sm:p-6" data-testid="integ-sendgrid">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">Email transactionnel</div>
            <h3 className="font-display-serif text-xl sm:text-2xl text-[#0A0A0A]">SendGrid (Twilio Email)</h3>
            <p className="text-[0.75rem] text-[#0A0A0A]/55 mt-1 max-w-2xl">
              Confirmations de paiement (avec QR PNG), rappels J-1, demandes d'avis J+1 — envoyés en parallèle de WhatsApp/SMS.
            </p>
          </div>
          <StatusBadge ok={status.sendgrid?.enabled} okLabel="Configuré" koLabel="Non configuré" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <ConfigRow label="From email" value={status.sendgrid?.from_email} mono />
          <ConfigRow label="From name" value={status.sendgrid?.from_name} />
          <ConfigRow label="Clé API" value={status.sendgrid?.api_key_prefix} mono />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60 mb-1">Email destinataire de test</label>
            <input
              type="email"
              value={sgTo}
              onChange={(e) => setSgTo(e.target.value)}
              placeholder="vous@exemple.com"
              className="w-full border border-[#0A0A0A]/15 px-3 py-2.5 text-sm focus:outline-none focus:border-[#B8922A]"
              data-testid="sg-test-to"
            />
          </div>
          <button
            onClick={testSendGrid}
            disabled={sgBusy || !status.sendgrid?.enabled || !sgTo}
            className="bg-[#B8922A] text-white px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] disabled:opacity-50 inline-flex items-center gap-2"
            data-testid="sg-test-btn"
          >
            {sgBusy ? <RefreshCw size={12} className="animate-spin" /> : <Plug size={12} />}
            Envoyer un email test
          </button>
        </div>
        {sgResult && (
          <div className={`mt-4 border p-3 text-sm ${sgResult.ok ? "border-emerald-300 bg-emerald-50/60" : "border-rose-300 bg-rose-50/60"}`}>
            <div className="flex items-start gap-2">
              {sgResult.ok
                ? <CheckCircle2 size={15} className="mt-0.5 text-emerald-700 flex-shrink-0" />
                : <AlertTriangle size={15} className="mt-0.5 text-rose-700 flex-shrink-0" />}
              <div className={`${sgResult.ok ? "text-emerald-900" : "text-rose-900"}`}>
                {sgResult.ok
                  ? <>Email accepté par SendGrid (HTTP {sgResult.status}) · ID : <span className="font-mono">{sgResult.message_id?.slice(0, 14)}…</span></>
                  : (sgResult.message || sgResult.error || "Échec")}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ TWILIO ============ */}
      <div className="bg-white border border-[#0A0A0A]/8 p-5 sm:p-6" data-testid="integ-twilio">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">Notifications</div>
            <h3 className="font-display-serif text-xl sm:text-2xl text-[#0A0A0A]">Twilio (SMS + WhatsApp)</h3>
            <p className="text-[0.75rem] text-[#0A0A0A]/55 mt-1 max-w-2xl">
              Envois transactionnels : confirmation paiement (J), rappel J-1, demande d'avis J+1.
              Pour tester un envoi réel, utilisez la page "Notifications SMS & WhatsApp".
            </p>
          </div>
          <StatusBadge ok={status.twilio.enabled} okLabel="Configuré" koLabel="Non configuré" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ConfigRow label="WhatsApp From" value={status.twilio.whatsapp_from} mono />
          <ConfigRow label="SMS From" value={status.twilio.sms_from} mono />
          <ConfigRow label="Messaging Service SID" value={status.twilio.messaging_service_sid} mono />
          <ConfigRow label="Mode trial-safe (défaut)" value={status.twilio.trial_safe_default ? "Activé (test only)" : "Désactivé (production)"} />
        </div>

        {status.twilio.whatsapp_from === "whatsapp:+14155238886" && (
          <div className="mt-4 bg-amber-50 border border-amber-300 p-3 text-[0.72rem] text-amber-900 inline-flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              Vous utilisez le <strong>Sandbox WhatsApp</strong> (+1 415 523 8886). Chaque destinataire doit
              faire un opt-in (envoyer "join &lt;code&gt;") avant de recevoir des messages.
              Pour la production, demandez un WhatsApp Business Sender approuvé via la console Twilio.
            </span>
          </div>
        )}
      </div>

      <button
        onClick={refresh}
        className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] hover:underline inline-flex items-center gap-1.5"
        data-testid="integ-refresh"
      >
        <RefreshCw size={11} /> Rafraîchir l'état
      </button>
    </div>
  );
}

function StatusBadge({ ok, okLabel, koLabel }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.22em] border ${
      ok ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-rose-400 bg-rose-50 text-rose-800"
    }`}>
      {ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
      {ok ? okLabel : koLabel}
    </span>
  );
}

function ConfigRow({ label, value, mono, small }) {
  return (
    <div className="bg-[#FAFAF7] border border-[#0A0A0A]/8 px-3 py-2">
      <div className="text-[0.55rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-0.5">{label}</div>
      <div className={`${mono ? "font-mono" : ""} ${small ? "text-[0.72rem]" : "text-[0.8rem]"} text-[#0A0A0A] break-all`}>
        {value || <span className="text-[#0A0A0A]/40">—</span>}
      </div>
    </div>
  );
}


// ===== Maintenance Panel (admin-only data wipe per section) =====
function MaintenancePanel() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState(null); // {keys: [], label: ""}
  const [confirmText, setConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/staff/admin/wipe-sections");
      setSections(data.sections || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Impossible de charger les sections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const totalAll = sections.reduce((a, s) => a + (s.count || 0), 0);

  const openConfirm = (keys, label) => {
    setConfirmText("");
    setConfirmModal({ keys, label });
  };

  const runWipe = async () => {
    if (!confirmModal) return;
    if (confirmText !== "VIDER LES DONNEES BBR") {
      toast.error("Texte de confirmation incorrect");
      return;
    }
    setWiping(true);
    try {
      const { data } = await api.post("/staff/admin/wipe-test-data", {
        confirmation: "VIDER LES DONNEES BBR",
        sections: confirmModal.keys,
      });
      toast.success(`${data.total_wiped} document(s) supprimé(s)`);
      setConfirmModal(null);
      setConfirmText("");
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec du vidage");
    } finally {
      setWiping(false);
    }
  };

  if (loading) return <div className="text-sm text-[#0A0A0A]/50">Chargement…</div>;

  return (
    <div data-testid="maintenance-panel">
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <div className="font-medium text-red-900 mb-1">Zone dangereuse</div>
            <div className="text-[0.78rem] text-red-800/85 leading-relaxed">
              Le vidage supprime <strong>définitivement</strong> les données de la
              section choisie. Les comptes staff, le catalogue d'offres, les chambres,
              les événements spéciaux et les intégrations sont <strong>préservés</strong>.
              Action irréversible.
            </div>
          </div>
        </div>
      </div>

      <MigrateDataUrlsCard />

      <div className="grid sm:grid-cols-2 gap-3 mb-6" data-testid="wipe-sections-grid">
        {sections.map((s) => (
          <div
            key={s.key}
            className="border border-[#0A0A0A]/12 p-4 flex items-center justify-between hover:border-red-300 transition-colors"
            data-testid={`wipe-section-${s.key}`}
          >
            <div className="min-w-0 pr-3">
              <div className="text-sm font-medium text-[#0A0A0A] truncate">{s.label}</div>
              <div className="text-[0.7rem] text-[#0A0A0A]/55 mt-0.5">
                {s.count} document(s) · {s.collections.join(", ")}
              </div>
            </div>
            <button
              onClick={() => openConfirm([s.key], s.label)}
              disabled={s.count === 0}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid={`wipe-btn-${s.key}`}
            >
              <Trash2 size={12} /> Vider
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-[#0A0A0A]/10 pt-5">
        <div className="text-sm text-[#0A0A0A]/65 mb-3">
          Total documents transactionnels : <strong>{totalAll}</strong>
        </div>
        <button
          onClick={() => openConfirm(["all"], "TOUTES les sections")}
          disabled={totalAll === 0}
          className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="wipe-all-btn"
        >
          <Trash2 size={14} /> Tout vider
        </button>
      </div>

      {confirmModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !wiping && setConfirmModal(null)}
          data-testid="wipe-confirm-modal"
        >
          <div className="bg-white p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-red-500" size={22} />
              <h3 className="font-display-serif text-2xl text-[#0A0A0A]">Confirmer le vidage</h3>
            </div>
            <p className="text-sm text-[#0A0A0A]/75 mb-1">
              Vous êtes sur le point de vider :
            </p>
            <p className="text-sm text-red-700 font-medium mb-4">
              {confirmModal.label}
            </p>
            <p className="text-[0.78rem] text-[#0A0A0A]/65 mb-3">
              Pour confirmer, saisissez exactement la phrase ci-dessous :
            </p>
            <div className="text-[0.78rem] font-mono text-[#0A0A0A] bg-[#F5F1E8] px-3 py-2 mb-2">
              VIDER LES DONNEES BBR
            </div>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Saisissez la phrase…"
              className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-red-400 focus:outline-none text-sm font-mono"
              data-testid="wipe-confirm-input"
              disabled={wiping}
            />
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setConfirmModal(null)}
                disabled={wiping}
                className="flex-1 px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 hover:bg-[#0A0A0A]/5 disabled:opacity-40"
                data-testid="wipe-cancel-btn"
              >
                Annuler
              </button>
              <button
                onClick={runWipe}
                disabled={wiping || confirmText !== "VIDER LES DONNEES BBR"}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="wipe-execute-btn"
              >
                {wiping ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Migrate data: URLs card =====
function MigrateDataUrlsCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const { data } = await api.post("/staff/admin/migrate-data-urls");
      setResult(data.migrated);
      const total = (data.migrated?.special_events || 0) + (data.migrated?.offer_overrides || 0);
      if (total > 0) {
        toast.success(`${total} image(s) migrée(s) avec succès`);
      } else {
        toast.success("Rien à migrer — toutes les images sont déjà en URL publique");
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec de la migration");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6" data-testid="migrate-data-urls-card">
      <div className="flex items-start gap-3">
        <RefreshCw className="text-blue-500 shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <div className="font-medium text-blue-900 mb-1">Réparer les images d'emails</div>
          <div className="text-[0.78rem] text-blue-800/85 leading-relaxed mb-3">
            Si vos campagnes envoient des emails sans image (icône cassée
            chez Outlook / Gmail), c'est parce que l'image a été téléversée
            avant le correctif. Cliquez ci-dessous pour <strong>convertir toutes les
            images stockées en data: URL en URL publique HTTPS</strong>.
            Action idempotente, sans risque.
          </div>
          <button
            onClick={run}
            disabled={busy}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-blue-700 disabled:opacity-50"
            data-testid="migrate-data-urls-btn"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Lancer la migration
          </button>
          {result && (
            <div className="mt-3 text-[0.75rem] text-blue-900">
              Migrées : événements spéciaux ({result.special_events}) · offres ({result.offer_overrides})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


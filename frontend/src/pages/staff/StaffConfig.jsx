import { useEffect, useState } from "react";
import api from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { Settings, UserPlus, Trash2, Save, X } from "lucide-react";
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
    // Convert string -> int for numeric fields
    const body = {};
    if (payload.price_adult !== undefined) body.price_adult = parseInt(payload.price_adult) || 0;
    if (payload.price_child !== undefined) body.price_child = parseInt(payload.price_child) || 0;
    if (payload.max_capacity !== undefined) body.max_capacity = parseInt(payload.max_capacity) || 1;
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
          </div>

          <div className="bg-white border border-[#0A0A0A]/8">
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
      ) : (
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
              </div>
            );
          })}
        </div>
      )}

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

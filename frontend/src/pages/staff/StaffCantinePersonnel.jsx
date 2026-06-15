import { useEffect, useState, useCallback } from "react";
import {
  Users, Search, Filter, RefreshCw, Pencil, RotateCw, PowerOff,
  Power, Trash2, X, Loader2, Copy, AlertTriangle, Hash,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const TYPE_FILTERS = [
  { id: "all",         label: "Tous" },
  { id: "personnel",   label: "Personnel" },
  { id: "prestataire", label: "Prestataires" },
];

export default function StaffCantinePersonnel() {
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [filterService, setFilterService] = useState("");
  const [filterActive, setFilterActive] = useState("all"); // all | active | inactive
  const [search, setSearch] = useState("");
  // modals
  const [editing, setEditing] = useState(null);     // user obj
  const [confirming, setConfirming] = useState(null); // { kind, user }
  const [regenerated, setRegenerated] = useState(null); // {code, previous_code, user}

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (filterType !== "all") params.type = filterType;
      if (filterService) params.service = filterService;
      if (filterActive === "active") params.active = true;
      if (filterActive === "inactive") params.active = false;
      if (search.trim()) params.q = search.trim();
      const { data } = await api.get("/staff/cantine/users", { params });
      setUsers(data.items || []);
      setLastRefresh(new Date());
      if (silent) toast.success("Données mises à jour");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec du chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterType, filterService, filterActive, search]);

  useEffect(() => {
    api.get("/staff/cantine/services").then(({ data }) =>
      setServices(data.items || []),
    ).catch(() => {});
  }, []);

  useEffect(() => {
    // Debounce on search input
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // CRUD actions
  const saveEdit = async (payload) => {
    try {
      await api.patch(`/staff/cantine/users/${editing.id}`, payload);
      toast.success("Utilisateur mis à jour");
      setEditing(null);
      load({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la mise à jour");
    }
  };

  const regenerate = async (user) => {
    try {
      const { data } = await api.post(`/staff/cantine/users/${user.id}/regenerate-code`);
      setRegenerated({ ...data, user });
      // UX: if the search bar is currently holding the OLD code (or a fragment
      // of it), clear it so the user can see the freshly-coded entry without
      // it being filtered out by a stale query.
      if (search && (user.code.includes(search.toUpperCase())
                     || search.toUpperCase().includes(user.code))) {
        setSearch("");
      }
      load({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec");
    }
  };

  const toggleActive = async (user) => {
    try {
      const url = `/staff/cantine/users/${user.id}/${user.active ? "deactivate" : "activate"}`;
      await api.post(url);
      toast.success(user.active ? "Utilisateur désactivé" : "Utilisateur réactivé");
      load({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec");
    }
  };

  const hardDelete = async (user) => {
    try {
      await api.delete(`/staff/cantine/users/${user.id}`);
      toast.success(`Utilisateur supprimé`);
      setConfirming(null);
      load({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la suppression");
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-7xl" data-testid="staff-cantine-personnel">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-1 inline-flex items-center gap-1.5">
            <Users size={11} /> Cantine — Personnel
          </div>
          <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A]">
            Personnel enregistré
          </h1>
          <p className="text-sm text-[#0A0A0A]/60 mt-1 max-w-2xl">
            Gérer les comptes cantine, régénérer les codes, désactiver ou supprimer.
          </p>
        </div>
        <button
          onClick={() => load({ silent: true })}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#0A0A0A]/10 hover:border-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#B8922A] disabled:opacity-50"
          data-testid="cantine-refresh-personnel"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Rafraîchir
        </button>
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-[#0A0A0A]/10 p-3 sm:p-4 space-y-3" data-testid="cantine-filters">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A0A0A]/40" />
            <input
              type="text"
              placeholder="Rechercher (nom, prénom, code, fonction, téléphone)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
              data-testid="cantine-personnel-search"
            />
          </div>
          <select
            value={filterService}
            onChange={(e) => setFilterService(e.target.value)}
            className="px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
            data-testid="cantine-personnel-filter-service"
          >
            <option value="">Tous les services</option>
            {services.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
            data-testid="cantine-personnel-filter-active"
          >
            <option value="all">Actifs + désactivés</option>
            <option value="active">Actifs uniquement</option>
            <option value="inactive">Désactivés uniquement</option>
          </select>
        </div>

        <div className="inline-flex items-center bg-[#FAF7F2] border border-[#0A0A0A]/10">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterType(t.id)}
              data-testid={`cantine-filter-${t.id}`}
              className={`px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.18em] transition-colors ${
                filterType === t.id
                  ? "bg-[#B8922A] text-white"
                  : "text-[#0A0A0A]/65 hover:text-[#0A0A0A]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {lastRefresh && (
        <div className="text-[0.7rem] text-[#0A0A0A]/45 -mt-3" data-testid="cantine-personnel-last-refresh">
          Dernière mise à jour : {lastRefresh.toLocaleTimeString("fr-FR")} · {users.length} utilisateur{users.length > 1 ? "s" : ""}
        </div>
      )}

      {/* Users table */}
      <div className="bg-white border border-[#0A0A0A]/10 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#B8922A]" size={24} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="cantine-personnel-table">
              <thead>
                <tr className="bg-[#FAF7F2] text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 text-left">
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Nom & prénom</th>
                  <th className="px-4 py-2.5 hidden md:table-cell">Service</th>
                  <th className="px-4 py-2.5 hidden lg:table-cell">Fonction</th>
                  <th className="px-4 py-2.5 hidden sm:table-cell">Type</th>
                  <th className="px-4 py-2.5 hidden xl:table-cell">Téléphone</th>
                  <th className="px-4 py-2.5 hidden xl:table-cell">Créé</th>
                  <th className="px-4 py-2.5 hidden sm:table-cell">Crédits</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-[#0A0A0A]/45">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : users.map((u) => (
                  <tr key={u.id} className={`border-t border-[#0A0A0A]/5 hover:bg-[#FAF7F2]/60 ${!u.active ? "opacity-50" : ""}`}
                      data-testid={`cantine-user-row-${u.code}`}>
                    <td className="px-4 py-2.5 font-mono text-[#0A0A0A] font-bold">{u.code}</td>
                    <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">
                      {u.last_name} {u.first_name}
                      {!u.active && <span className="ml-2 text-[0.6rem] uppercase tracking-[0.15em] text-red-500">Désactivé</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[#0A0A0A]/70 hidden md:table-cell">{u.service}</td>
                    <td className="px-4 py-2.5 text-[#0A0A0A]/70 text-[0.78rem] hidden lg:table-cell">{u.position}</td>
                    <td className="px-4 py-2.5 text-[0.78rem] hidden sm:table-cell">
                      <span className={`px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.15em] ${
                        u.type === "personnel"
                          ? "bg-[#FAF3DC] text-[#B8922A]"
                          : "bg-gray-100 text-gray-700"}`}>
                        {u.type === "personnel" ? "Personnel" : "Prestataire"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#0A0A0A]/70 text-[0.78rem] hidden xl:table-cell font-mono">
                      {u.phone || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[#0A0A0A]/55 text-[0.78rem] hidden xl:table-cell">
                      {(u.created_at || "").slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 text-[0.78rem] hidden sm:table-cell">
                      <span className="font-mono text-[#0A0A0A]">{u.credits_remaining}</span>
                      <span className="text-[#0A0A0A]/40"> / {u.credits_attributed}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <IconBtn icon={Pencil} title="Modifier"
                                 onClick={() => setEditing(u)} testid={`cantine-edit-${u.code}`} />
                        <IconBtn icon={RotateCw} title="Régénérer le code"
                                 onClick={() => setConfirming({ kind: "regen", user: u })} testid={`cantine-regen-${u.code}`} />
                        <IconBtn icon={u.active ? PowerOff : Power}
                                 title={u.active ? "Désactiver" : "Réactiver"}
                                 onClick={() => setConfirming({ kind: u.active ? "deactivate" : "activate", user: u })}
                                 testid={`cantine-toggle-${u.code}`} />
                        <IconBtn icon={Trash2} title="Supprimer" danger
                                 onClick={() => setConfirming({ kind: "delete", user: u })}
                                 testid={`cantine-delete-${u.code}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <EditModal
          user={editing}
          services={services}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      {/* Confirm modal (regen / deactivate / activate / delete) */}
      {confirming && (
        <ConfirmModal
          kind={confirming.kind}
          user={confirming.user}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            if (confirming.kind === "regen") regenerate(confirming.user).then(() => setConfirming(null));
            else if (confirming.kind === "delete") hardDelete(confirming.user);
            else toggleActive(confirming.user).then(() => setConfirming(null));
          }}
        />
      )}

      {/* Regenerated code result modal */}
      {regenerated && (
        <RegeneratedModal data={regenerated} onClose={() => setRegenerated(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────
function IconBtn({ icon: Icon, title, onClick, danger, testid }) {
  return (
    <button
      onClick={onClick}
      title={title}
      data-testid={testid}
      className={`p-1.5 hover:bg-[#FAF7F2] rounded ${
        danger ? "text-red-500 hover:text-red-700" : "text-[#0A0A0A]/55 hover:text-[#B8922A]"
      }`}
    >
      <Icon size={14} />
    </button>
  );
}

function Modal({ children, onClose, testid, wide }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in" data-testid={testid}>
      <div className={`bg-white shadow-xl w-full ${wide ? "max-w-lg" : "max-w-sm"} max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-2`}>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 hover:bg-[#FAF7F2] rounded"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

function EditModal({ user, services, onClose, onSave }) {
  const [form, setForm] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone || "",
    service: user.service,
    position: user.position,
    type: user.type,
  });
  const [saving, setSaving] = useState(false);
  return (
    <Modal onClose={onClose} testid="cantine-edit-modal" wide>
      <div className="p-6 relative">
        <h3 className="font-display-serif text-xl text-[#0A0A0A] mb-1">
          Modifier l&apos;utilisateur
        </h3>
        <p className="text-sm text-[#0A0A0A]/55 mb-5 font-mono">{user.code}</p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <SmallField label="Prénom" value={form.first_name}
              onChange={(v) => setForm((f) => ({ ...f, first_name: v }))} testid="edit-first-name" />
            <SmallField label="Nom" value={form.last_name}
              onChange={(v) => setForm((f) => ({ ...f, last_name: v }))} testid="edit-last-name" />
          </div>
          <SmallField label="Téléphone" type="tel" value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))} testid="edit-phone" />
          <div>
            <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1">
              Service
            </label>
            <select value={form.service} onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
                    data-testid="edit-service">
              {services.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <SmallField label="Fonction" value={form.position}
            onChange={(v) => setForm((f) => ({ ...f, position: v }))} testid="edit-position" />
          <div>
            <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <TypeBtn active={form.type === "personnel"} label="Personnel"
                onClick={() => setForm((f) => ({ ...f, type: "personnel" }))} />
              <TypeBtn active={form.type === "prestataire"} label="Prestataire"
                onClick={() => setForm((f) => ({ ...f, type: "prestataire" }))} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => { setSaving(true); onSave(form); }}
            disabled={saving}
            className="flex-1 bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-50 text-white py-2.5 text-[0.7rem] uppercase tracking-[0.22em]"
            data-testid="cantine-edit-save"
          >
            {saving ? <Loader2 size={13} className="animate-spin inline" /> : "Enregistrer"}
          </button>
          <button onClick={onClose} className="px-4 bg-white hover:bg-[#FAF7F2] border border-[#0A0A0A]/15 text-[#0A0A0A]/70 py-2.5 text-[0.7rem] uppercase tracking-[0.22em]">
            Annuler
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmModal({ kind, user, onCancel, onConfirm }) {
  const config = {
    regen: { title: "Régénérer le code ?",
      body: "L'ancien code deviendra invalide. L'utilisateur devra utiliser le nouveau code à partir de maintenant.",
      btn: "Régénérer", color: "#B8922A" },
    deactivate: { title: "Désactiver cet utilisateur ?",
      body: "Le compte sera désactivé sans suppression de l'historique. Il pourra être réactivé à tout moment.",
      btn: "Désactiver", color: "#D97706" },
    activate: { title: "Réactiver cet utilisateur ?",
      body: "Le compte redeviendra fonctionnel et l'utilisateur pourra à nouveau réserver.",
      btn: "Réactiver", color: "#16A34A" },
    delete: { title: "Supprimer définitivement ?",
      body: "Cette action est irréversible. L'utilisateur sera supprimé mais l'historique des réservations sera conservé.",
      btn: "Supprimer", color: "#DC2626", danger: true },
  }[kind] || {};
  return (
    <Modal onClose={onCancel} testid={`cantine-confirm-${kind}`}>
      <div className="p-5 relative">
        {config.danger && (
          <AlertTriangle className="text-red-500 mb-3" size={28} />
        )}
        <h3 className="font-display-serif text-xl text-[#0A0A0A] mb-2">{config.title}</h3>
        <div className="bg-[#FAF7F2] border border-[#0A0A0A]/10 p-3 mb-3 text-sm">
          <div className="font-medium text-[#0A0A0A]">{user.last_name} {user.first_name}</div>
          <div className="text-[#0A0A0A]/60 text-xs font-mono">{user.code} · {user.service}</div>
        </div>
        <p className="text-sm text-[#0A0A0A]/70 mb-5">{config.body}</p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 text-white py-2.5 text-[0.7rem] uppercase tracking-[0.22em]"
            style={{ backgroundColor: config.color }}
            data-testid={`cantine-confirm-${kind}-yes`}
          >
            {config.btn}
          </button>
          <button onClick={onCancel} className="px-4 bg-white hover:bg-[#FAF7F2] border border-[#0A0A0A]/15 text-[#0A0A0A]/70 py-2.5 text-[0.7rem] uppercase tracking-[0.22em]">
            Annuler
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RegeneratedModal({ data, onClose }) {
  const copy = () => {
    navigator.clipboard.writeText(data.code);
    toast.success("Code copié");
  };
  return (
    <Modal onClose={onClose} testid="cantine-regenerated-modal">
      <div className="p-6 text-center relative">
        <Hash className="mx-auto text-[#B8922A] mb-3" size={36} />
        <h3 className="font-display-serif text-xl text-[#0A0A0A] mb-1">
          Nouveau code généré
        </h3>
        <p className="text-sm text-[#0A0A0A]/55 mb-4">
          Pour {data.user.last_name} {data.user.first_name}.
          L&apos;ancien code <span className="font-mono">{data.previous_code}</span> est désormais invalide.
        </p>
        <div className="bg-white border-2 border-[#B8922A] py-4 mb-4">
          <div className="font-mono text-4xl font-bold text-[#0A0A0A] tracking-widest mb-2"
               data-testid="cantine-new-code-display">
            {data.code}
          </div>
          <button onClick={copy} className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A]">
            <Copy size={11} /> Copier
          </button>
        </div>
        <button onClick={onClose}
          className="w-full bg-[#0A0A0A] hover:bg-[#1f1f1f] text-white py-2.5 text-[0.7rem] uppercase tracking-[0.22em]">
          Fermer
        </button>
      </div>
    </Modal>
  );
}

function SmallField({ label, type = "text", value, onChange, testid }) {
  return (
    <div>
      <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
        data-testid={testid} />
    </div>
  );
}

function TypeBtn({ active, label, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`py-2 text-[0.7rem] uppercase tracking-[0.18em] border ${
        active ? "bg-[#B8922A] text-white border-[#B8922A]" : "bg-white text-[#0A0A0A]/70 border-[#0A0A0A]/15"
      }`}>
      {label}
    </button>
  );
}

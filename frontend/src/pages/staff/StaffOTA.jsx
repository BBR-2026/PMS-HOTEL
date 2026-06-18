import { useEffect, useMemo, useState } from "react";
import { useStaffAuth } from "../../context/StaffAuthContext";
import {
  RefreshCw, Plus, Trash2, Edit3, X, ShieldCheck, AlertCircle,
  CheckCircle2, Globe, Wifi, ToggleLeft, ToggleRight, Upload,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TABS = [
  { key: "status",       label: "Tableau de bord" },
  { key: "config",       label: "Configuration" },
  { key: "mappings",     label: "Mapping chambres" },
  { key: "sync",         label: "Synchronisation" },
  { key: "reservations", label: "Réservations OTA" },
];

const CHANNEL_LABELS = {
  booking_com: "Booking.com",
  airbnb:      "Airbnb",
  expedia:     "Expedia",
  hotels_com:  "Hotels.com",
  agoda:       "Agoda",
  unknown:     "Inconnu",
};

export default function StaffOTA() {
  const [tab, setTab] = useState("status");
  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-ota">
      <header>
        <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#B8922A]/85 mb-1">
          Revenue Engine · Phase C · Vague 3
        </div>
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">
          OTA & Channel Manager
        </h1>
        <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
          Connexion bidirectionnelle <strong>SiteMinder pmsXchange</strong> :
          un seul push pour distribuer disponibilités et tarifs à Booking.com,
          Airbnb, Expedia, Hotels.com et Agoda.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#0A0A0A]/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-[0.65rem] tracking-[0.3em] uppercase border-b-2 transition-colors ${
              tab === t.key
                ? "border-[#B8922A] text-[#0A0A0A]"
                : "border-transparent text-[#0A0A0A]/55 hover:text-[#0A0A0A]"
            }`}
            data-testid={`ota-tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "status"       && <StatusTab />}
      {tab === "config"       && <ConfigTab />}
      {tab === "mappings"     && <MappingsTab />}
      {tab === "sync"         && <SyncTab />}
      {tab === "reservations" && <ReservationsTab />}
    </div>
  );
}

// ── STATUS ─────────────────────────────────────────────────────
function StatusTab() {
  const { token } = useStaffAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/staff/ota/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setData(await r.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading || !data) return <div className="py-10 text-sm text-[#0A0A0A]/55">Chargement…</div>;

  const modeBadge = data.mode === "production"
    ? { color: "#15803D", bg: "#DCFCE7", text: "PRODUCTION" }
    : { color: "#B45309", bg: "#FEF3C7", text: "SANDBOX" };

  return (
    <div className="space-y-6" data-testid="ota-status">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em]"
          style={{ color: modeBadge.color, background: modeBadge.bg }}
        >
          <ShieldCheck size={12} /> {modeBadge.text}
        </span>
        <span className="text-xs text-[#0A0A0A]/55">Hotel code : <span className="tabular-nums">{data.hotel_code}</span></span>
        <button onClick={load} className="ml-auto p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"><RefreshCw size={14} /></button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Mappings actifs" value={`${data.mappings_enabled} / ${data.mappings_total}`} />
        <Kpi label="Réservations totales" value={data.reservations_total} accent />
        <Kpi label="Réservations aujourd'hui" value={data.reservations_today} />
        <Kpi label="Canaux OTA" value={data.ota_channels?.length || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InfoCard
          title="Dernier push disponibilités"
          status={data.last_availability_push}
          empty="Aucun push effectué."
          render={(s) => (
            <>
              <div className="text-xs">{s.at?.replace("T", " ").slice(0, 16)}</div>
              <div className="text-xs mt-1">{s.updates} mise(s) à jour</div>
              <div className={`text-[10px] uppercase tracking-wider mt-2 ${s.ok ? "text-[#15803D]" : "text-red-600"}`}>
                {s.ok ? "Succès" : "Échec"}
              </div>
            </>
          )}
        />
        <InfoCard
          title="Dernier fetch room/rates"
          status={data.last_room_rates_fetch}
          empty="Jamais synchronisé."
          render={(s) => (
            <>
              <div className="text-xs">{s.at?.replace("T", " ").slice(0, 16)}</div>
              <div className="text-xs mt-1">{s.items || 0} room types</div>
              <div className={`text-[10px] uppercase tracking-wider mt-2 ${s.ok ? "text-[#15803D]" : "text-red-600"}`}>
                {s.ok ? "Succès" : "Échec"}
              </div>
            </>
          )}
        />
        <InfoCard
          title="Dernière erreur"
          status={data.last_error}
          empty="Aucune erreur récente ✓"
          render={(s) => (
            <>
              <div className="text-xs text-red-600">{s.kind}</div>
              <div className="text-[10px] text-[#0A0A0A]/65 mt-1 line-clamp-3">{s.message}</div>
              <div className="text-[10px] text-[#0A0A0A]/45 mt-1">{s.at?.replace("T", " ").slice(0, 16)}</div>
            </>
          )}
        />
      </div>

      <section>
        <h3 className="font-display-serif text-lg mb-3">Réservations par canal</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(CHANNEL_LABELS).filter(([k]) => k !== "unknown").map(([k, label]) => (
            <div key={k} className="bg-white border border-[#0A0A0A]/10 p-4">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">{label}</div>
              <div className="font-serif italic font-light text-2xl text-[#0A0A0A] mt-2 tabular-nums">
                {data.by_channel?.[k] || 0}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, accent = false }) {
  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-5">
      <div className="text-[0.55rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55 mb-3">{label}</div>
      <div className={`font-serif italic font-light text-3xl tabular-nums ${accent ? "text-[#B8922A]" : "text-[#0A0A0A]"}`}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </div>
    </div>
  );
}

function InfoCard({ title, status, empty, render }) {
  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-4">
      <div className="text-[0.55rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55 mb-3">{title}</div>
      {status ? render(status) : <div className="text-xs text-[#0A0A0A]/45 italic">{empty}</div>}
    </div>
  );
}

// ── CONFIG ─────────────────────────────────────────────────────
function ConfigTab() {
  const { token } = useStaffAuth();
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  async function load() {
    const r = await fetch(`${API}/staff/ota/config`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const d = await r.json();
      setCfg(d);
      setForm({
        base_url_rest: d.base_url_rest,
        base_url_soap: d.base_url_soap,
        pms_username: d.pms_username,
        pms_password: "",  // intentionally empty — only fill to update
        pms_code: d.pms_code,
        hotel_code: d.hotel_code,
        webhook_username: d.webhook_username || "",
        webhook_password: "",
        mode: d.mode,
        auto_sync_enabled: !!d.auto_sync_enabled,
        auto_sync_on_booking: !!d.auto_sync_on_booking,
        auto_sync_default_limit: d.auto_sync_default_limit ?? 5,
      });
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const payload = { ...form };
    if (!payload.pms_password) delete payload.pms_password;
    if (!payload.webhook_password) delete payload.webhook_password;
    // Booleans must be explicitly sent (false is meaningful).
    payload.auto_sync_enabled = !!payload.auto_sync_enabled;
    payload.auto_sync_on_booking = !!payload.auto_sync_on_booking;
    const r = await fetch(`${API}/staff/ota/config`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (r.ok) {
      await load();
      alert("Configuration sauvegardée");
    } else {
      alert("Échec de sauvegarde");
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    const r = await fetch(`${API}/staff/ota/test-connection`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setTesting(false);
    if (r.ok) setTestResult(await r.json());
    else setTestResult({ ok: false, error: "HTTP " + r.status });
  }

  if (!cfg) return <div className="py-10 text-sm text-[#0A0A0A]/55">Chargement…</div>;

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-6" data-testid="ota-config">
      <div className="bg-[#FAF7F2]/60 border border-[#B8922A]/20 px-4 py-3 text-xs text-[#0A0A0A]/75">
        <strong className="text-[#B8922A]">Sandbox actif par défaut.</strong> Les
        valeurs <code>PMSXTEST</code> permettent de valider l'architecture sans
        impact production. Saisissez vos credentials pmsXchange réels et passez
        en mode "production" quand vous êtes prêt.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-white border border-[#0A0A0A]/10 p-6">
        <Field label="Mode">
          <select value={form.mode} onChange={upd("mode")} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" data-testid="cfg-mode">
            <option value="sandbox">Sandbox (test)</option>
            <option value="production">Production</option>
          </select>
        </Field>
        <Field label="PMS code">
          <input value={form.pms_code} onChange={upd("pms_code")} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm uppercase tracking-wider" data-testid="cfg-pmscode" />
        </Field>
        <Field label="Hotel code">
          <input value={form.hotel_code} onChange={upd("hotel_code")} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm uppercase tracking-wider" data-testid="cfg-hotel" />
        </Field>
        <Field label="PMS username">
          <input value={form.pms_username} onChange={upd("pms_username")} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" data-testid="cfg-pmsuser" />
        </Field>
        <Field label={`PMS password ${cfg.pms_password_set ? "(saisi — laisser vide pour conserver)" : "*"}`} col2>
          <input type="password" value={form.pms_password} onChange={upd("pms_password")} placeholder="••••••••" className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" data-testid="cfg-pmspass" />
        </Field>
        <Field label="Base URL REST" col2>
          <input value={form.base_url_rest} onChange={upd("base_url_rest")} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm font-mono text-xs" />
        </Field>
        <Field label="Base URL SOAP" col2>
          <input value={form.base_url_soap} onChange={upd("base_url_soap")} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm font-mono text-xs" />
        </Field>

        <div className="md:col-span-2 mt-2 border-t border-[#0A0A0A]/10 pt-4">
          <div className="text-[0.55rem] uppercase tracking-[0.35em] text-[#B8922A]/85 mb-3">Auto-synchronisation</div>
        </div>
        <Field label="Sync périodique (15 min)" col2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.auto_sync_enabled}
              onChange={(e) => setForm({ ...form, auto_sync_enabled: e.target.checked })}
              className="h-4 w-4"
              data-testid="cfg-auto-sync"
            />
            Pousser automatiquement les disponibilités vers SiteMinder toutes les 15 minutes
          </label>
        </Field>
        <Field label="Sync à chaque réservation directe" col2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.auto_sync_on_booking}
              onChange={(e) => setForm({ ...form, auto_sync_on_booking: e.target.checked })}
              className="h-4 w-4"
              data-testid="cfg-auto-sync-booking"
            />
            Décrémenter l'inventaire OTA dès qu'une réservation directe est créée (anti-overbooking)
          </label>
        </Field>
        <Field label="Booking limit par défaut" col2>
          <input
            type="number" min="0" max="999"
            value={form.auto_sync_default_limit}
            onChange={(e) => setForm({ ...form, auto_sync_default_limit: Number(e.target.value) || 0 })}
            className="w-32 border border-[#0A0A0A]/15 px-3 py-2 text-sm tabular-nums"
            data-testid="cfg-default-limit"
          />
          <span className="text-[10px] text-[#0A0A0A]/55 ml-2">chambres disponibles communiquées aux OTA pour chaque mapping actif.</span>
        </Field>

        <div className="md:col-span-2 mt-2 border-t border-[#0A0A0A]/10 pt-4">
          <div className="text-[0.55rem] uppercase tracking-[0.35em] text-[#B8922A]/85 mb-3">Webhook réservations (WS-Security)</div>
        </div>
        <Field label="Webhook username">
          <input value={form.webhook_username} onChange={upd("webhook_username")} placeholder="Optionnel — laissé vide = pas de validation" className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" />
        </Field>
        <Field label={`Webhook password ${cfg.webhook_password_set ? "(saisi)" : ""}`}>
          <input type="password" value={form.webhook_password} onChange={upd("webhook_password")} placeholder="••••••••" className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" />
        </Field>

        <div className="md:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 border-t border-[#0A0A0A]/10">
          <button onClick={save} disabled={saving} className="px-5 py-2.5 text-xs tracking-[0.3em] uppercase bg-[#0A0A0A] text-white hover:bg-[#B8922A] disabled:opacity-60" data-testid="cfg-save">
            {saving ? "Sauvegarde…" : "Enregistrer"}
          </button>
          <button onClick={testConnection} disabled={testing} className="px-5 py-2.5 text-xs tracking-[0.3em] uppercase border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A] inline-flex items-center gap-2 justify-center" data-testid="cfg-test">
            <Wifi size={14} /> {testing ? "Test…" : "Tester la connexion"}
          </button>
          {testResult && (
            <div className={`flex items-center gap-2 text-xs ${testResult.ok ? "text-[#15803D]" : "text-red-600"}`}>
              {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {testResult.ok
                ? `Connexion OK (${testResult.items_count} room types)`
                : `Échec : ${testResult.error?.slice(0, 100)}`}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#0A0A0A]/10 p-5">
        <div className="text-[0.55rem] uppercase tracking-[0.35em] text-[#B8922A]/85 mb-3">URL webhook à fournir à SiteMinder</div>
        <code className="block bg-[#FAF7F2] px-3 py-2 text-xs font-mono break-all">
          {process.env.REACT_APP_BACKEND_URL}/api/webhooks/siteminder/reservations
        </code>
        <p className="text-xs text-[#0A0A0A]/55 mt-2">
          Communiquez cette URL à votre contact pmsXchange ainsi que les
          identifiants WS-Security ci-dessus. SiteMinder enverra
          <code className="mx-1 font-mono">OTA_HotelResNotifRQ</code> pour
          chaque réservation entrante via Booking.com / Airbnb / Expedia /
          Hotels.com / Agoda.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children, col2 = false }) {
  return (
    <label className={`block ${col2 ? "md:col-span-2" : ""}`}>
      <span className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// ── MAPPINGS ───────────────────────────────────────────────────
function MappingsTab() {
  const { token } = useStaffAuth();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [otaChannels, setOtaChannels] = useState([]);
  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  async function load() {
    const r = await fetch(`${API}/staff/ota/mappings`, { headers: authHeaders });
    if (r.ok) {
      const d = await r.json();
      setItems(d.items || []);
      setOtaChannels(d.ota_channels || []);
    }
  }
  useEffect(() => { load(); }, []);

  async function save(payload) {
    const url = payload.id
      ? `${API}/staff/ota/mappings/${payload.id}`
      : `${API}/staff/ota/mappings`;
    const method = payload.id ? "PATCH" : "POST";
    const body = { ...payload };
    delete body.id;
    const r = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(body) });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(`Échec : ${d.detail || r.statusText}`);
      return;
    }
    setEditing(null);
    load();
  }

  async function remove(id) {
    if (!window.confirm("Supprimer ce mapping ?")) return;
    const r = await fetch(`${API}/staff/ota/mappings/${id}`, { method: "DELETE", headers: authHeaders });
    if (r.ok) load();
  }

  async function toggleEnabled(m) {
    const r = await fetch(`${API}/staff/ota/mappings/${m.id}`, {
      method: "PATCH", headers: authHeaders, body: JSON.stringify({ enabled: !m.enabled }),
    });
    if (r.ok) load();
  }

  return (
    <div className="space-y-5" data-testid="ota-mappings">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-[#0A0A0A]/65 max-w-2xl">
          Liez chaque offre interne (chambre, suite, day pass…) à son code de
          chambre SiteMinder. SiteMinder répartira ensuite la disponibilité
          aux canaux activés.
        </p>
        <button onClick={() => setEditing({})} className="self-start inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-3 text-xs tracking-[0.3em] uppercase hover:bg-[#B8922A]" data-testid="map-new">
          <Plus size={14} /> Nouveau mapping
        </button>
      </div>

      <div className="bg-white border border-[#0A0A0A]/10 overflow-x-auto" data-testid="map-list">
        {items.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#0A0A0A]/45">
            Aucun mapping. Créez-en pour commencer.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                <th className="py-3 px-4">Offre interne</th>
                <th className="py-3 px-4">Code SM Room</th>
                <th className="py-3 px-4">Code SM Rate</th>
                <th className="py-3 px-4">Canaux</th>
                <th className="py-3 px-4 text-center">Actif</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-b border-[#0A0A0A]/5 hover:bg-[#FAF7F2]/40" data-testid={`map-row-${m.id}`}>
                  <td className="py-3 px-4">
                    <div className="font-medium">{m.label || m.internal_offer_id}</div>
                    {m.label && <div className="text-[10px] text-[#0A0A0A]/45 font-mono">{m.internal_offer_id}</div>}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">{m.sm_room_type_code}</td>
                  <td className="py-3 px-4 font-mono text-xs text-[#0A0A0A]/55">{m.sm_rate_plan_code || "—"}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {(m.channels || []).map((c) => (
                        <span key={c} className="px-2 py-0.5 text-[10px] bg-[#FAF7F2] border border-[#0A0A0A]/10">
                          {CHANNEL_LABELS[c] || c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => toggleEnabled(m)} data-testid={`map-toggle-${m.id}`}>
                      {m.enabled ? <ToggleRight size={22} className="text-[#15803D]" /> : <ToggleLeft size={22} className="text-[#0A0A0A]/35" />}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(m)} className="p-1.5 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]"><Edit3 size={13} /></button>
                      <button onClick={() => remove(m.id)} className="p-1.5 border border-[#0A0A0A]/15 hover:border-red-500 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <MappingForm initial={editing} channels={otaChannels} onClose={() => setEditing(null)} onSave={save} />
      )}
    </div>
  );
}

function MappingForm({ initial, channels, onClose, onSave }) {
  const [internalOfferId, setInternalOfferId] = useState(initial.internal_offer_id || "");
  const [label, setLabel] = useState(initial.label || "");
  const [smRoom, setSmRoom] = useState(initial.sm_room_type_code || "");
  const [smRate, setSmRate] = useState(initial.sm_rate_plan_code || "");
  const [enabled, setEnabled] = useState(initial.enabled !== false);
  const [picked, setPicked] = useState(new Set(initial.channels || channels));

  function togglePick(c) {
    const ns = new Set(picked);
    ns.has(c) ? ns.delete(c) : ns.add(c);
    setPicked(ns);
  }

  function submit(e) {
    e.preventDefault();
    if (!internalOfferId.trim() || !smRoom.trim()) return;
    onSave({
      id: initial.id,
      internal_offer_id: internalOfferId.trim(),
      label: label.trim() || null,
      sm_room_type_code: smRoom.trim(),
      sm_rate_plan_code: smRate.trim() || null,
      enabled,
      channels: Array.from(picked),
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="map-form-modal">
      <form onSubmit={submit} className="bg-white max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#0A0A0A]/10">
          <div className="font-display-serif text-xl">
            {initial.id ? "Modifier le mapping" : "Nouveau mapping"}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-[#FAF7F2]"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="ID offre interne *" col2>
            <input
              value={internalOfferId}
              onChange={(e) => setInternalOfferId(e.target.value)}
              required
              disabled={!!initial.id}
              placeholder="ex: chambre_exclusive"
              className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm font-mono disabled:bg-[#FAF7F2]"
              data-testid="map-id-input"
            />
          </Field>
          <Field label="Libellé">
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" placeholder="Chambre Exclusive" />
          </Field>
          <Field label="Code SM Room Type *">
            <input value={smRoom} onChange={(e) => setSmRoom(e.target.value)} required className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm font-mono" data-testid="map-room-input" />
          </Field>
          <Field label="Code SM Rate Plan" col2>
            <input value={smRate} onChange={(e) => setSmRate(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm font-mono" placeholder="ex: BAR" />
          </Field>
          <Field label="Canaux OTA" col2>
            <div className="flex flex-wrap gap-2">
              {channels.map((c) => (
                <button key={c} type="button" onClick={() => togglePick(c)} className={`px-3 py-1.5 text-[10px] uppercase tracking-wider border ${picked.has(c) ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#0A0A0A]/65 border-[#0A0A0A]/15"}`}>
                  <Globe size={11} className="inline mr-1" /> {CHANNEL_LABELS[c] || c}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Statut" col2>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
              Mapping activé (publié vers SiteMinder)
            </label>
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#0A0A0A]/10">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs tracking-[0.3em] uppercase border border-[#0A0A0A]/15">Annuler</button>
          <button type="submit" className="px-5 py-2 text-xs tracking-[0.3em] uppercase bg-[#0A0A0A] text-white hover:bg-[#B8922A]" data-testid="map-submit">
            {initial.id ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── SYNC ───────────────────────────────────────────────────────
function SyncTab() {
  const { token } = useStaffAuth();
  const [logs, setLogs] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [bookingLimit, setBookingLimit] = useState(5);
  const [selectedMappingId, setSelectedMappingId] = useState("");

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`, "Content-Type": "application/json",
  }), [token]);

  async function load() {
    const [logRes, mapRes] = await Promise.all([
      fetch(`${API}/staff/ota/sync-logs?limit=25`, { headers }),
      fetch(`${API}/staff/ota/mappings`, { headers }),
    ]);
    if (logRes.ok) setLogs((await logRes.json()).items || []);
    if (mapRes.ok) {
      const m = (await mapRes.json()).items || [];
      setMappings(m);
      if (m.length > 0 && !selectedMappingId) setSelectedMappingId(m[0].id);
    }
  }
  useEffect(() => { load(); }, []);

  async function fetchRoomRates() {
    setPushing(true);
    setPushResult(null);
    const r = await fetch(`${API}/staff/ota/sync/room-rates`, { method: "POST", headers });
    setPushing(false);
    if (r.ok) {
      setPushResult(await r.json());
      load();
    }
  }

  async function pushAvailability() {
    if (!selectedMappingId) {
      alert("Sélectionnez un mapping d'abord");
      return;
    }
    setPushing(true);
    setPushResult(null);
    const r = await fetch(`${API}/staff/ota/sync/availability`, {
      method: "POST", headers,
      body: JSON.stringify({
        updates: [{ mapping_id: selectedMappingId, start_date: startDate, end_date: endDate, booking_limit: Number(bookingLimit) }],
      }),
    });
    setPushing(false);
    const d = await r.json();
    setPushResult(d);
    load();
  }

  return (
    <div className="space-y-6" data-testid="ota-sync">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#0A0A0A]/10 p-5">
          <h3 className="font-display-serif text-lg mb-3">Récupérer Room & Rates</h3>
          <p className="text-xs text-[#0A0A0A]/65 mb-4">
            Importe les codes SiteMinder canoniques pour ce hotel code.
            Utile avant de créer vos mappings.
          </p>
          <button onClick={fetchRoomRates} disabled={pushing} className="w-full px-5 py-3 text-xs tracking-[0.3em] uppercase bg-[#0A0A0A] text-white hover:bg-[#B8922A] disabled:opacity-60 inline-flex items-center justify-center gap-2" data-testid="sync-fetch">
            <RefreshCw size={14} /> Fetch maintenant
          </button>
        </div>

        <div className="bg-white border border-[#0A0A0A]/10 p-5">
          <h3 className="font-display-serif text-lg mb-3">Pousser disponibilités</h3>
          <div className="space-y-3">
            <Field label="Mapping (offre)">
              <select value={selectedMappingId} onChange={(e) => setSelectedMappingId(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" data-testid="sync-map-select">
                {mappings.length === 0 && <option value="">Aucun mapping disponible</option>}
                {mappings.filter((m) => m.enabled).map((m) => (
                  <option key={m.id} value={m.id}>
                    {(m.label || m.internal_offer_id) + " (" + m.sm_room_type_code + ")"}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Du">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" />
              </Field>
              <Field label="Au">
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm" />
              </Field>
            </div>
            <Field label="Booking limit (nb. de chambres disponibles)">
              <input type="number" min="0" value={bookingLimit} onChange={(e) => setBookingLimit(e.target.value)} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm tabular-nums" />
            </Field>
            <button onClick={pushAvailability} disabled={pushing || !selectedMappingId} className="w-full px-5 py-3 text-xs tracking-[0.3em] uppercase bg-[#0A0A0A] text-white hover:bg-[#B8922A] disabled:opacity-60 inline-flex items-center justify-center gap-2" data-testid="sync-push">
              <Upload size={14} /> Push vers SiteMinder
            </button>
          </div>
        </div>
      </div>

      {pushResult && (
        <div className={`p-4 border ${pushResult.ok ? "border-[#15803D]/30 bg-[#DCFCE7]/40" : "border-red-500/30 bg-red-50"}`} data-testid="sync-result">
          <div className={`flex items-center gap-2 text-sm ${pushResult.ok ? "text-[#15803D]" : "text-red-600"}`}>
            {pushResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {pushResult.ok ? "Synchronisation OK" : "Échec de synchronisation"}
          </div>
          {pushResult.echo_token && <div className="text-[10px] mt-1 font-mono text-[#0A0A0A]/55">EchoToken : {pushResult.echo_token}</div>}
          {pushResult.error && <div className="text-xs mt-1 text-red-600">{pushResult.error}</div>}
          {pushResult.errors && pushResult.errors.length > 0 && (
            <ul className="text-xs mt-1 text-red-600 list-disc list-inside">
              {pushResult.errors.map((e, i) => <li key={i}>{Array.isArray(e) ? e.join(": ") : String(e)}</li>)}
            </ul>
          )}
        </div>
      )}

      <section>
        <h3 className="font-display-serif text-lg mb-3">Journal de synchronisation</h3>
        <div className="bg-white border border-[#0A0A0A]/10 overflow-x-auto" data-testid="sync-logs">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#0A0A0A]/45">Aucun log.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                  <th className="py-2 px-4">Quand</th>
                  <th className="py-2 px-4">Type</th>
                  <th className="py-2 px-4">Statut</th>
                  <th className="py-2 px-4">Détails</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-[#0A0A0A]/5">
                    <td className="py-2 px-4 text-xs tabular-nums">{l.started_at?.replace("T", " ").slice(0, 16)}</td>
                    <td className="py-2 px-4 text-xs">{l.kind}</td>
                    <td className="py-2 px-4">
                      {l.ok ? <span className="text-[#15803D] text-xs">✓ OK</span> : <span className="text-red-600 text-xs">✗ ÉCHEC</span>}
                    </td>
                    <td className="py-2 px-4 text-xs text-[#0A0A0A]/65">
                      {l.echo_token && <span className="font-mono">{l.echo_token.slice(0, 8)}…</span>}
                      {l.updates_count != null && ` · ${l.updates_count} updates`}
                      {l.items_count != null && ` · ${l.items_count} items`}
                      {l.error && <span className="text-red-600"> · {l.error.slice(0, 60)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

// ── RESERVATIONS ──────────────────────────────────────────────
function ReservationsTab() {
  const { token } = useStaffAuth();
  const [items, setItems] = useState([]);
  const [channelFilter, setChannelFilter] = useState("");

  async function load() {
    const url = new URL(`${API}/staff/ota/reservations`);
    if (channelFilter) url.searchParams.set("channel", channelFilter);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setItems((await r.json()).items || []);
  }
  useEffect(() => { load(); }, [channelFilter]);

  return (
    <div className="space-y-5" data-testid="ota-reservations">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setChannelFilter("")} className={chipCls(channelFilter === "")}>Tous</button>
        {Object.entries(CHANNEL_LABELS).filter(([k]) => k !== "unknown").map(([k, label]) => (
          <button key={k} onClick={() => setChannelFilter(k)} className={chipCls(channelFilter === k)}>{label}</button>
        ))}
      </div>
      <div className="bg-white border border-[#0A0A0A]/10 overflow-x-auto" data-testid="res-list">
        {items.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#0A0A0A]/45">
            Aucune réservation OTA reçue.
            <div className="text-[10px] mt-2 text-[#0A0A0A]/35">
              Les réservations arrivent automatiquement via le webhook SiteMinder.
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                <th className="py-3 px-4">Reçue le</th>
                <th className="py-3 px-4">Canal</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Séjour</th>
                <th className="py-3 px-4">Type / Tarif</th>
                <th className="py-3 px-4 text-right">Montant</th>
                <th className="py-3 px-4">Statut</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-[#0A0A0A]/5 hover:bg-[#FAF7F2]/40">
                  <td className="py-3 px-4 text-xs tabular-nums">{r.received_at?.replace("T", " ").slice(0, 16)}</td>
                  <td className="py-3 px-4 text-xs">{CHANNEL_LABELS[r.channel] || r.channel}</td>
                  <td className="py-3 px-4">
                    <div className="text-xs font-medium">{r.guest_name || "—"}</div>
                    <div className="text-[10px] text-[#0A0A0A]/55">{r.guest_email}</div>
                  </td>
                  <td className="py-3 px-4 text-xs tabular-nums">{r.checkin} → {r.checkout}</td>
                  <td className="py-3 px-4 text-xs font-mono">{r.room_type_code} / {r.rate_plan_code || "—"}</td>
                  <td className="py-3 px-4 text-xs text-right tabular-nums">{r.total_amount} {r.currency}</td>
                  <td className="py-3 px-4 text-xs">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const chipCls = (active) => `px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] border ${
  active ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#0A0A0A]/65 border-[#0A0A0A]/15 hover:border-[#B8922A]"
}`;

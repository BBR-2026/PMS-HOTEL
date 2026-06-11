import { useEffect, useState } from "react";
import { Ship, UserCheck, UserPlus, Briefcase, Users, Search, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";
import NationalityAutocomplete from "../../components/NationalityAutocomplete";

/**
 * Staff Enregistrement — on-site registration of arrivals on the island.
 * 4 kinds: client / personnel / prestataire / invite.
 *
 * - "client" → redirect to /staff/reservations/nouvelle (full booking flow)
 * - others → in-page free-transport registration (visitor_registrations API)
 *
 * Header tabs filter the list by kind. Search box filters all kinds.
 */
const KIND_META = {
  client: { label: "Client", icon: UserCheck, color: "#B8922A" },
  personnel: { label: "Personnel", icon: Briefcase, color: "#0A0A0A" },
  prestataire: { label: "Prestataire", icon: Users, color: "#6B7280" },
  invite: { label: "Invité", icon: UserPlus, color: "#16A34A" },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function StaffEnregistrement() {
  const [step, setStep] = useState("pick"); // pick | form | client-redirect
  const [kind, setKind] = useState(null);
  const [filterKind, setFilterKind] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ client: 0, personnel: 0, prestataire: 0, invite: 0 });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [traversees, setTraversees] = useState([]);
  const [form, setForm] = useState({
    name: "", surname: "", email: "", phone: "", whatsapp: "",
    nationality: "", company: "", traversee_id: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterKind) params.set("kind", filterKind);
      if (date) params.set("date", date);
      if (q) params.set("q", q);
      const { data } = await api.get(`/staff/visitor-registrations?${params.toString()}`);
      setItems(data.items || []);
      setCounts(data.counts || {});
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const loadTraversees = async () => {
    try {
      const { data } = await api.get(`/staff/traversees?date=${date}`);
      // Only show programmé crossings (not en_cours / terminé)
      const programmed = (data || []).filter((t) => !t.status || t.status === "programmé");
      setTraversees(programmed);
    } catch {
      setTraversees([]);
    }
  };

  useEffect(() => { refresh(); }, [filterKind, date]); // eslint-disable-line
  useEffect(() => { loadTraversees(); }, [date]); // eslint-disable-line

  const startForm = (k) => {
    if (k === "client") {
      // Redirect to existing booking creation flow
      window.location.href = "/staff/reservations/nouvelle";
      return;
    }
    setKind(k);
    setForm({
      name: "", surname: "", email: "", phone: "", whatsapp: "",
      nationality: "", company: "", traversee_id: "", notes: "",
    });
    setStep("form");
  };

  const submit = async () => {
    const required = ["name", "surname", "phone", "nationality"];
    for (const r of required) {
      if (!form[r]?.trim()) {
        toast.error(`Champ requis : ${r}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        kind,
        name: form.name.trim(),
        surname: form.surname.trim(),
        email: form.email?.trim() || null,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp?.trim() || null,
        nationality: form.nationality.trim(),
        company: form.company?.trim() || null,
        date,
        traversee_id: form.traversee_id || null,
        notes: form.notes?.trim() || null,
      };
      Object.keys(payload).forEach((k) => payload[k] === null && delete payload[k]);
      const { data } = await api.post("/staff/visitor-registrations", payload);
      toast.success(`${KIND_META[kind].label} enregistré · QR ${data.qr_token.slice(0, 8).toUpperCase()}`);
      setStep("pick");
      setKind(null);
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (filterKind) params.set("kind", filterKind);
      if (date) params.set("date", date);
      const url = `${api.defaults.baseURL}/staff/visitor-registrations/export.csv?${params.toString()}`;
      const token = localStorage.getItem("staff_token") || "";
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `enregistrements-${date}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Échec de l'export");
    }
  };

  if (step === "form" && kind && kind !== "client") {
    const Icon = KIND_META[kind].icon;
    return (
      <div className="p-6 max-w-2xl mx-auto" data-testid="enregistrement-form">
        <button
          onClick={() => setStep("pick")}
          className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] mb-4"
        >
          ← Retour
        </button>
        <div className="bg-white border border-[#0A0A0A]/8 p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#0A0A0A]/8">
            <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: `${KIND_META[kind].color}15` }}>
              <Icon size={18} style={{ color: KIND_META[kind].color }} />
            </div>
            <div>
              <h2 className="font-display-serif text-xl text-[#0A0A0A]">Enregistrer · {KIND_META[kind].label}</h2>
              <p className="text-[0.72rem] text-[#0A0A0A]/55">Pas d&apos;offre commerciale — QR de transport gratuit.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Nom *</label>
              <input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none" data-testid="enr-surname" />
            </div>
            <div>
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Prénom *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none" data-testid="enr-name" />
            </div>
            <div>
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Téléphone *</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none" data-testid="enr-phone" />
            </div>
            <div>
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">WhatsApp</label>
              <input type="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="Optionnel" className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none" data-testid="enr-whatsapp" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none" data-testid="enr-email" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Nationalité *</label>
              <NationalityAutocomplete
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: typeof e === "string" ? e : e?.target?.value || "" })}
                lang="fr"
                testId="enr-nationality"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">Entreprise / Société</label>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Optionnel" className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none" data-testid="enr-company" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[0.6rem] uppercase tracking-[0.2em] text-[#0A0A0A]/55 block mb-1">
                <Ship size={11} className="inline mr-1" /> Traversée programmée
              </label>
              <select
                value={form.traversee_id}
                onChange={(e) => setForm({ ...form, traversee_id: e.target.value })}
                className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none"
                data-testid="enr-traversee"
              >
                <option value="">— Aucune (pas encore assigné) —</option>
                {traversees.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.depart_time} · {t.direction === "aller" ? "Aller" : "Retour"} · {t.bateau?.name || "—"} {t.skipper_name ? `· ${t.skipper_name}` : ""}
                  </option>
                ))}
              </select>
              {traversees.length === 0 && (
                <p className="text-[0.65rem] text-[#0A0A0A]/45 mt-1">Aucune traversée programmée pour cette date. Programmez-en dans Embarquement.</p>
              )}
            </div>
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            className="mt-6 w-full bg-[#0A0A0A] text-white py-3 text-[0.7rem] uppercase tracking-[0.28em] hover:bg-[#B8922A] transition-colors disabled:opacity-50"
            data-testid="enr-submit"
          >
            {submitting ? "Enregistrement…" : "Enregistrer & générer le QR"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="staff-enregistrement">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display-serif text-3xl text-[#0A0A0A]">Enregistrement</h1>
          <p className="text-sm text-[#0A0A0A]/55 mt-1">Enregistrez chaque arrivée sur l&apos;île — client, personnel, prestataire ou invité.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none" data-testid="enr-date-picker" />
          <button onClick={refresh} className="p-2 hover:bg-[#B8922A]/10 text-[#0A0A0A]/65 hover:text-[#B8922A]" data-testid="enr-refresh"><RefreshCw size={15} /></button>
          <button onClick={downloadCSV} className="inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.18em] border border-[#0A0A0A]/15 px-3 py-2 hover:border-[#B8922A] hover:text-[#B8922A]" data-testid="enr-export-csv"><Download size={11} /> CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Object.entries(KIND_META).map(([k, meta]) => {
          const Icon = meta.icon;
          const active = filterKind === k;
          return (
            <div key={k} className="bg-white border border-[#0A0A0A]/8 p-4 flex items-center justify-between" data-testid={`enr-tile-${k}`}>
              <div>
                <div className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">
                  <Icon size={12} style={{ color: meta.color }} /> {meta.label}
                </div>
                <div className="font-display-serif text-3xl text-[#0A0A0A] mt-1">{counts[k] || 0}</div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => startForm(k)}
                  className="text-[0.55rem] uppercase tracking-[0.22em] bg-[#0A0A0A] text-white px-2.5 py-1.5 hover:bg-[#B8922A] transition-colors"
                  data-testid={`enr-new-${k}`}
                >
                  Nouveau
                </button>
                <button
                  onClick={() => setFilterKind(active ? null : k)}
                  className={`text-[0.55rem] uppercase tracking-[0.22em] px-2.5 py-1.5 border transition-colors ${active ? "bg-[#B8922A] text-white border-[#B8922A]" : "border-[#0A0A0A]/15 text-[#0A0A0A]/65"}`}
                  data-testid={`enr-filter-${k}`}
                >
                  {active ? "Filtre actif" : "Filtrer"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-[#0A0A0A]/8">
        <div className="flex items-center gap-2 p-4 border-b border-[#0A0A0A]/8">
          <Search size={14} className="text-[#0A0A0A]/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refresh()}
            placeholder="Rechercher nom, email, entreprise…"
            className="flex-1 text-sm outline-none border-none"
            data-testid="enr-search"
          />
          <button onClick={refresh} className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] hover:text-[#9d7a23]">Filtrer</button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-[#0A0A0A]/45">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-[#0A0A0A]/45">Aucun enregistrement.</div>
          ) : (
            <table className="w-full text-sm" data-testid="enr-list">
              <thead>
                <tr className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Nom</th>
                  <th className="text-left py-3 px-4">Téléphone</th>
                  <th className="text-left py-3 px-4">WhatsApp</th>
                  <th className="text-left py-3 px-4">Nationalité</th>
                  <th className="text-left py-3 px-4">Entreprise</th>
                  <th className="text-left py-3 px-4">Bateau</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-[#0A0A0A]/5 last:border-0" data-testid={`enr-row-${p.id.slice(0,8)}`}>
                    <td className="py-2.5 px-4">
                      <span className="text-[0.6rem] uppercase tracking-[0.18em] px-2 py-1" style={{ backgroundColor: `${KIND_META[p.kind]?.color || '#0A0A0A'}12`, color: KIND_META[p.kind]?.color || '#0A0A0A' }}>
                        {KIND_META[p.kind]?.label || p.kind}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">{p.surname} {p.name}</td>
                    <td className="py-2.5 px-4">{p.phone}</td>
                    <td className="py-2.5 px-4">{p.whatsapp || "—"}</td>
                    <td className="py-2.5 px-4">{p.nationality}</td>
                    <td className="py-2.5 px-4">{p.company || "—"}</td>
                    <td className="py-2.5 px-4">{p.boat_time || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

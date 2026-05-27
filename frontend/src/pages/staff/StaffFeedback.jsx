import { useEffect, useState } from "react";
import { Star, MessageSquare, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const EXP_LABELS = {
  pass_day: "Pass Day",
  sunset: "Sunset",
  restaurant: "Restaurant",
  hebergement: "Hébergement",
  evenement_prive: "Événement privé",
  autre: "Autre",
};

const CRIT = [
  ["avg_accueil",  "Accueil"],
  ["avg_service",  "Service"],
  ["avg_restau",   "Restauration"],
  ["avg_ambiance", "Ambiance"],
  ["avg_proprete", "Propreté"],
  ["avg_globale",  "Expérience globale"],
];

export default function StaffFeedback() {
  const [items, setItems] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        api.get("/staff/feedback"),
        api.get("/staff/feedback/analytics"),
      ]);
      setItems(a.data.items || []);
      setAnalytics(b.data);
    } catch {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm("Supprimer ce retour ?")) return;
    try { await api.delete(`/staff/feedback/${id}`); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const filtered = filterType ? items.filter((i) => i.experience_type === filterType) : items;
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-feedback-page">
      <div className="mb-8">
        <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-2 flex items-center gap-2">
          <MessageSquare size={14} /> Voix du client
        </div>
        <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A]">Retour expérience</h1>
        <p className="text-sm text-[#0A0A0A]/55 max-w-2xl mt-2">
          Avis et notes des clients après leur passage au Boulay Beach Resort.
        </p>
      </div>

      {analytics && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8" data-testid="feedback-kpis">
          <KPI label="Total retours" value={analytics.overall?.total ?? 0} />
          <KPI label="Note globale moyenne" value={analytics.overall?.avg_globale ? analytics.overall.avg_globale.toFixed(2) + " / 5" : "—"} gold />
          <KPI label="Meilleure note" value={
            (analytics.distribution || []).length
              ? (Math.max(...analytics.distribution.map(d => d.rating)) + " ★")
              : "—"
          } />
          <KPI label="Catégorie #1" value={analytics.by_type?.[0]?.type ? EXP_LABELS[analytics.by_type[0].type] : "—"} />
        </div>
      )}

      {analytics?.overall?.total > 0 && (
        <div className="bg-white border border-[#0A0A0A]/10 p-6 mb-8">
          <h3 className="font-display-serif text-lg mb-4">Moyennes par critère</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {CRIT.map(([k, lbl]) => {
              const v = analytics.overall?.[k];
              return (
                <div key={k}>
                  <div className="text-[0.7rem] uppercase tracking-[0.2em] text-[#0A0A0A]/50 mb-1">{lbl}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-display-serif text-[#0A0A0A]">{v ? v.toFixed(2) : "—"}</div>
                    <div className="flex items-center gap-0.5 text-[#B8922A]">
                      {[1,2,3,4,5].map((n) => (
                        <Star key={n} size={14} fill={v && v >= n ? "#B8922A" : "none"} className={v && v >= n ? "fill-[#B8922A]" : "text-[#0A0A0A]/15"} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Filter size={14} className="text-[#0A0A0A]/50" />
        <button onClick={() => setFilterType("")} className={`px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.18em] border ${!filterType ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "border-[#0A0A0A]/15 hover:border-[#0A0A0A]"}`}>
          Tous ({items.length})
        </button>
        {Object.entries(EXP_LABELS).map(([id, lbl]) => {
          const c = items.filter((i) => i.experience_type === id).length;
          if (c === 0) return null;
          return (
            <button key={id} onClick={() => setFilterType(id)} className={`px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.18em] border ${filterType === id ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "border-[#0A0A0A]/15 hover:border-[#0A0A0A]"}`}>
              {lbl} ({c})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-sm text-[#0A0A0A]/50">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-[#0A0A0A]/15 p-10 text-center text-[#0A0A0A]/55 text-sm">
          Aucun retour pour le moment.
        </div>
      ) : (
        <div className="space-y-3" data-testid="feedback-items">
          {filtered.map((f) => <FeedbackCard key={f.id} f={f} onDelete={remove} fmtDate={fmtDate} />)}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, gold }) {
  return (
    <div className={`p-5 border ${gold ? "bg-[#B8922A]/8 border-[#B8922A]/30" : "bg-white border-[#0A0A0A]/10"}`}>
      <div className="text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50 mb-2">{label}</div>
      <div className={`text-2xl font-display-serif ${gold ? "text-[#B8922A]" : "text-[#0A0A0A]"}`}>{value}</div>
    </div>
  );
}

function FeedbackCard({ f, onDelete, fmtDate }) {
  const stars = (n) => (
    <div className="flex items-center gap-0.5 text-[#B8922A]">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} size={12} className={n >= i ? "fill-[#B8922A]" : "text-[#0A0A0A]/15"} fill={n >= i ? "#B8922A" : "none"} />
      ))}
    </div>
  );

  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-5" data-testid={`feedback-${f.id}`}>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] bg-[#B8922A]/15 text-[#B8922A]">
              {EXP_LABELS[f.experience_type] || f.experience_type}
            </span>
            {f.full_name && <span className="text-sm font-medium text-[#0A0A0A]">{f.full_name}</span>}
            {f.email && <span className="text-xs text-[#0A0A0A]/55">{f.email}</span>}
            {f.phone && <span className="text-xs text-[#0A0A0A]/55">· {f.phone}</span>}
          </div>
          <div className="text-[0.7rem] text-[#0A0A0A]/50 mt-1">
            Soumis : {fmtDate(f.created_at)}
            {f.visit_date && ` · Visite : ${f.visit_date}`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50">Globale</div>
            {stars(f.experience_globale)}
          </div>
          <button onClick={() => onDelete(f.id)} className="p-1.5 text-[#0A0A0A]/35 hover:text-red-600" title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3 text-[0.8rem]">
        <Row label="Accueil"     stars={stars(f.accueil_arrivee)} />
        <Row label="Service"     stars={stars(f.service_amabilite)} />
        <Row label="Restauration" stars={stars(f.restauration_boissons)} />
        <Row label="Ambiance"    stars={stars(f.ambiance_cadre)} />
        <Row label="Propreté"    stars={stars(f.proprete_confort)} />
      </div>

      {(f.most_appreciated || f.improvement_suggestion || f.staff_member_mention) && (
        <div className="bg-[#FAFAF7] p-4 space-y-3 text-[0.85rem] text-[#0A0A0A]/85">
          {f.most_appreciated && <Quote label="Le plus apprécié" text={f.most_appreciated} />}
          {f.improvement_suggestion && <Quote label="À améliorer" text={f.improvement_suggestion} />}
          {f.staff_member_mention && <Quote label="Membre marquant" text={f.staff_member_mention} />}
        </div>
      )}
    </div>
  );
}

function Row({ label, stars }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#0A0A0A]/65">{label}</span>
      {stars}
    </div>
  );
}

function Quote({ label, text }) {
  return (
    <div>
      <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] mb-1">{label}</div>
      <div className="italic">« {text} »</div>
    </div>
  );
}

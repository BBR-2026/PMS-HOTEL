import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../lib/api";
import { formatXOF } from "../../lib/i18n";
import { toast } from "sonner";
import {
  CalendarDays, Wallet, Users, ArrowRight, ChevronRight, Briefcase, BedDouble,
  UtensilsCrossed, Waves, CalendarHeart,
} from "lucide-react";

const POLE_ICON = {
  beach_club: Waves,
  hebergement: BedDouble,
  corporate: Briefcase,
  activites_events: CalendarHeart,
  le_kaai: UtensilsCrossed,
};
const POLE_ACCENT = {
  beach_club: "#B8922A",
  hebergement: "#3B82F6",
  corporate: "#64748B",
  activites_events: "#E11D48",
  le_kaai: "#A855F7",
};

const STATUS_LABEL = {
  pending: "En attente",
  confirmed: "Confirmée",
  arrived: "Arrivée",
  completed: "Terminée",
  cancelled: "Annulée",
};

function fmtDateFR(iso) {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function Kpi({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="bg-white border border-[#0A0A0A]/8 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">{label}</span>
        <Icon size={14} style={{ color: accent }} />
      </div>
      <div className="text-2xl md:text-3xl font-display-serif text-[#0A0A0A]">{value}</div>
      {sub && <div className="text-[0.7rem] text-[#0A0A0A]/45 mt-1.5">{sub}</div>}
    </div>
  );
}

export default function StaffPolePage() {
  const { poleId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    api.get(`/staff/poles/${poleId}/overview`)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch((e) => {
        if (cancelled) return;
        if (e.response?.status === 404) toast.error("Pôle introuvable");
        else if (e.response?.status === 403) toast.error("Accès refusé");
        else toast.error("Erreur de chargement");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [poleId]);

  if (loading) return <div className="p-10 text-[#0A0A0A]/50">Chargement…</div>;
  if (!data) return <div className="p-10 text-red-600">Impossible de charger ce pôle.</div>;

  const { pole, kpis, sub_offers, recent_bookings } = data;
  const Icon = POLE_ICON[pole.id] || Briefcase;
  const accent = POLE_ACCENT[pole.id] || "#B8922A";

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid={`staff-pole-page-${pole.id}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.28em]" style={{ color: accent }}>
            Pôle {pole.sort_order} · BBr
          </div>
          <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] inline-flex items-center gap-3 mt-1">
            <Icon size={26} style={{ color: accent }} /> {pole.name_fr}
          </h1>
          {pole.tagline_fr && (
            <p className="text-sm text-[#0A0A0A]/55 mt-1.5 max-w-2xl">{pole.tagline_fr}</p>
          )}
        </div>
        <Link
          to={`/staff/reservations?pole=${pole.id}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] text-white hover:opacity-90 transition-all self-start sm:self-auto"
          style={{ backgroundColor: accent }}
          data-testid={`pole-reservations-link-${pole.id}`}
        >
          Toutes les réservations <ArrowRight size={13} />
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Kpi
          icon={CalendarDays}
          label="Aujourd'hui"
          value={kpis.today?.count || 0}
          sub={`${kpis.today?.guests || 0} client${(kpis.today?.guests || 0) > 1 ? "s" : ""} attendu${(kpis.today?.guests || 0) > 1 ? "s" : ""}`}
          accent={accent}
        />
        <Kpi
          icon={Wallet}
          label="Revenus du jour"
          value={formatXOF(kpis.today?.revenue || 0)}
          sub="payés"
          accent={accent}
        />
        <Kpi
          icon={CalendarDays}
          label="30 derniers jours"
          value={kpis.last_30d?.count || 0}
          sub={`${formatXOF(kpis.last_30d?.revenue || 0)}`}
          accent={accent}
        />
        <Kpi
          icon={Users}
          label="Sous-offres actives"
          value={sub_offers.filter((s) => (s.stats?.count || 0) > 0).length}
          sub={`${sub_offers.length} configurée${sub_offers.length > 1 ? "s" : ""}`}
          accent={accent}
        />
      </div>

      {/* Sub-offers breakdown */}
      <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6 mb-8" data-testid="pole-sub-offers-breakdown">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display-serif text-xl text-[#0A0A0A]">Sous-offres</h2>
          <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Activité 30 jours</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {sub_offers.map((s) => {
            const count = s.stats?.count || 0;
            const revenue = s.stats?.revenue || 0;
            return (
              <Link
                key={s.id}
                to={`/staff/reservations?pole=${pole.id}`}
                className="border border-[#0A0A0A]/8 p-4 hover:border-[#B8922A] transition-colors group"
                data-testid={`pole-sub-offer-${s.id}`}
              >
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm font-medium text-[#0A0A0A] group-hover:text-[#B8922A] transition-colors">
                    {s.name_fr}
                  </span>
                  {s.is_synthetic && (
                    <span className="text-[0.55rem] uppercase tracking-[0.22em] px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200">
                      Synthétique
                    </span>
                  )}
                </div>
                {s.schedule_fr && <div className="text-[0.65rem] text-[#0A0A0A]/55 mb-3">{s.schedule_fr}</div>}
                {!s.is_synthetic && s.price_adult > 0 && (
                  <div className="text-[0.7rem] text-[#0A0A0A]/65 mb-3">
                    {formatXOF(s.price_adult)} <span className="text-[#0A0A0A]/40">/ adulte</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#0A0A0A]/8">
                  <div>
                    <div className="text-[0.55rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">Réservations</div>
                    <div className="text-lg font-display-serif text-[#0A0A0A]">{count}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[0.55rem] uppercase tracking-[0.22em] text-[#0A0A0A]/45">CA</div>
                    <div className="text-[0.85rem] font-medium" style={{ color: accent }}>{formatXOF(revenue)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick access to operational modules */}
      {pole.id === "hebergement" && (
        <div className="bg-white border border-[#0A0A0A]/8 p-5 mb-8 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[#0A0A0A]">Occupation des chambres</div>
            <div className="text-[0.72rem] text-[#0A0A0A]/55 mt-0.5">Inventaire en temps réel par catégorie</div>
          </div>
          <Link to="/staff/hebergement" className="inline-flex items-center gap-2 px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/75 hover:border-[#B8922A] hover:text-[#B8922A]" data-testid="hebergement-module-link">
            Voir l'occupation <ChevronRight size={13} />
          </Link>
        </div>
      )}
      {pole.id === "le_kaai" && (
        <div className="bg-white border border-[#0A0A0A]/8 p-5 mb-8 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[#0A0A0A]">Plan de salle Le Kaai</div>
            <div className="text-[0.72rem] text-[#0A0A0A]/55 mt-0.5">Capacité par zone (Terrasse 1, 2, Salle)</div>
          </div>
          <Link to="/staff/kaai" className="inline-flex items-center gap-2 px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/75 hover:border-[#B8922A] hover:text-[#B8922A]" data-testid="kaai-module-link">
            Gérer les tables <ChevronRight size={13} />
          </Link>
        </div>
      )}
      {pole.id === "activites_events" && (
        <div className="bg-white border border-[#0A0A0A]/8 p-5 mb-8 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[#0A0A0A]">Événements spéciaux</div>
            <div className="text-[0.72rem] text-[#0A0A0A]/55 mt-0.5">CRUD + Mise en avant du prochain Event Maison</div>
          </div>
          <Link to="/staff/evenements-speciaux" className="inline-flex items-center gap-2 px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/75 hover:border-[#B8922A] hover:text-[#B8922A]" data-testid="events-module-link">
            Gérer les events <ChevronRight size={13} />
          </Link>
        </div>
      )}

      {/* Recent bookings */}
      <div className="bg-white border border-[#0A0A0A]/8 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display-serif text-xl text-[#0A0A0A]">Réservations récentes</h2>
          <Link to={`/staff/reservations?pole=${pole.id}`} className="text-[0.65rem] uppercase tracking-[0.22em] text-[#B8922A] hover:underline">
            Voir tout
          </Link>
        </div>
        {recent_bookings.length === 0 ? (
          <p className="text-sm text-[#0A0A0A]/45 py-10 text-center">Aucune réservation pour ce pôle.</p>
        ) : (
          <div className="divide-y divide-[#0A0A0A]/5" data-testid="pole-recent-bookings">
            {recent_bookings.map((b) => {
              const primary = (b.participants && b.participants[0]) || {};
              const guestName = primary.surname || primary.name
                ? `${primary.surname || ""} ${primary.name || ""}`.trim()
                : b.phone || "—";
              return (
                <div key={b.id} className="py-3 flex items-center gap-4">
                  <div className="text-[0.7rem] tabular-nums w-14 text-center" style={{ color: accent }}>
                    {b.boat_time || "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#0A0A0A] truncate">{guestName}</div>
                    <div className="text-[0.7rem] text-[#0A0A0A]/55 truncate">
                      {b.offer_name} · {fmtDateFR(b.date)} · {b.adults}A{b.children > 0 ? ` + ${b.children}E` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-[#0A0A0A] tabular-nums">{formatXOF(b.total_amount || 0)}</div>
                    <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/45 mt-0.5">{STATUS_LABEL[b.status] || b.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

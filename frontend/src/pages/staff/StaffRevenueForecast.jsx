import { useEffect, useMemo, useState } from "react";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { TrendingUp, RefreshCw, Sliders, Calendar, Sparkles } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PERIODS = [
  { id: 7,   label: "7 j"   },
  { id: 30,  label: "30 j"  },
  { id: 60,  label: "60 j"  },
  { id: 90,  label: "90 j"  },
  { id: 365, label: "1 an"  },
];

const UNIVERSE_LABELS = {
  beach_club: "Beach Club",
  hebergement: "Hébergement",
  le_kaai: "Restaurant Le Kaai",
  corporate: "Corporate",
  activites_events: "Activités & Events",
};

const UNIVERSE_COLORS = {
  beach_club: "#0EA5E9",
  hebergement: "#7C3AED",
  le_kaai: "#EA580C",
  corporate: "#15803D",
  activites_events: "#B8922A",
};

const fmt = (v) => Math.round(v || 0).toLocaleString("fr-FR");

export default function StaffRevenueForecast() {
  const { token } = useStaffAuth();
  const [days, setDays] = useState(30);
  const [occupation, setOccupation] = useState(60);
  const [liftRatio, setLiftRatio] = useState(0.0001);
  const [liftCap, setLiftCap] = useState(25);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const url = new URL(`${API}/staff/revenue/forecast`);
      url.searchParams.set("days", days);
      url.searchParams.set("occupation_pct", occupation);
      url.searchParams.set("campaign_lift_max_pct", liftCap);
      url.searchParams.set("budget_to_lift_ratio", liftRatio);
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setData(await r.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [days, occupation, liftCap, liftRatio]); // eslint-disable-line

  const maxRevenue = useMemo(() => {
    if (!data?.by_universe) return 1;
    return Math.max(...data.by_universe.map((u) => u.revenue), 1);
  }, [data]);

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="staff-revenue-forecast">
      <header>
        <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[#B8922A]/85 mb-1">
          Revenue Engine · Synthèse
        </div>
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">
          Revenue Forecast
        </h1>
        <p className="text-sm text-[#0A0A0A]/65 mt-2 max-w-2xl">
          Projection de chiffre d'affaires combinant capacités, taux d'occupation,
          rate plans actifs et budgets de campagnes en cours.
        </p>
      </header>

      {/* Period chips */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setDays(p.id)}
            className={`px-4 py-2 text-[0.65rem] tracking-[0.3em] uppercase border ${
              days === p.id
                ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                : "bg-white text-[#0A0A0A]/65 border-[#0A0A0A]/15 hover:border-[#B8922A]"
            }`}
            data-testid={`forecast-period-${p.id}`}
          >
            <Calendar size={11} className="inline mr-1" /> {p.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-2 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A]">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Assumptions tuner */}
      <div className="bg-white border border-[#0A0A0A]/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sliders size={14} className="text-[#B8922A]" />
          <div className="text-[0.55rem] uppercase tracking-[0.35em] text-[#B8922A]/85">
            Hypothèses de calcul
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Slider
            label="Taux d'occupation prévisionnel"
            value={occupation}
            min={0} max={100} step={5}
            suffix="%"
            onChange={setOccupation}
            testid="forecast-occupation"
          />
          <Slider
            label="Plafond uplift campagnes"
            value={liftCap}
            min={0} max={100} step={5}
            suffix="%"
            onChange={setLiftCap}
            testid="forecast-cap"
          />
          <Slider
            label="Ratio budget → lift"
            value={liftRatio * 10000}
            min={0} max={20} step={1}
            suffix="‰"
            onChange={(v) => setLiftRatio(v / 10000)}
            testid="forecast-ratio"
            note="lift% par 10 000 XOF/j de budget"
          />
        </div>
      </div>

      {!data ? (
        <div className="py-12 text-center text-sm text-[#0A0A0A]/55">Chargement…</div>
      ) : (
        <>
          {/* Headline KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi
              icon={TrendingUp}
              label={`CA projeté · ${days} j`}
              value={`${fmt(data.total.revenue)} XOF`}
              accent
            />
            <Kpi
              label="CA brut (sans uplift)"
              value={`${fmt(data.total.gross_before_lift)} XOF`}
            />
            <Kpi
              label="Volume total"
              value={fmt(data.total.volume)}
            />
            <Kpi
              icon={Sparkles}
              label="Uplift campagnes"
              value={`+${(((data.total.revenue / Math.max(data.total.gross_before_lift, 1) - 1) * 100) || 0).toFixed(1)}%`}
            />
          </div>

          {/* Universe breakdown — bar chart + table */}
          <div className="bg-white border border-[#0A0A0A]/10 p-5" data-testid="forecast-universes">
            <h3 className="font-display-serif text-lg mb-4">Projection par univers</h3>
            <div className="space-y-3">
              {data.by_universe.map((u) => {
                const pct = (u.revenue / maxRevenue) * 100;
                return (
                  <div key={u.universe}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm font-medium text-[#0A0A0A]">
                        {UNIVERSE_LABELS[u.universe] || u.universe}
                      </span>
                      <span className="font-display-serif text-base tabular-nums text-[#0A0A0A]">
                        {fmt(u.revenue)} XOF
                      </span>
                    </div>
                    <div className="h-2 bg-[#FAF7F2] relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: UNIVERSE_COLORS[u.universe] || "#B8922A",
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#0A0A0A]/55 mt-1">
                      <span>{u.offer_count} offres · {u.active_campaigns} campagne(s) active(s)</span>
                      <span className="tabular-nums">{fmt(u.volume)} unités</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-offer detail table */}
          <div className="bg-white border border-[#0A0A0A]/10 overflow-x-auto" data-testid="forecast-offers">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                  <th className="py-3 px-4">Offre</th>
                  <th className="py-3 px-4 text-right">Prix base</th>
                  <th className="py-3 px-4 text-right">Prix ajusté</th>
                  <th className="py-3 px-4 text-right">Volume {days}j</th>
                  <th className="py-3 px-4 text-right">Lift</th>
                  <th className="py-3 px-4 text-right">CA projeté</th>
                </tr>
              </thead>
              <tbody>
                {data.offers.map((o) => {
                  const delta = ((o.avg_adjusted_price - o.base_price) / o.base_price) * 100;
                  const deltaColor = delta > 0.2 ? "text-[#B45309]" : delta < -0.2 ? "text-[#15803D]" : "text-[#0A0A0A]/55";
                  return (
                    <tr key={o.offer_key} className="border-b border-[#0A0A0A]/5 hover:bg-[#FAF7F2]/40" data-testid={`forecast-row-${o.offer_key}`}>
                      <td className="py-3 px-4">
                        <div className="font-medium">{o.label}</div>
                        <div className="text-[10px] uppercase tracking-wider text-[#0A0A0A]/45">
                          {UNIVERSE_LABELS[o.universe] || o.universe}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#0A0A0A]/65">{fmt(o.base_price)}</td>
                      <td className={`py-3 px-4 text-right tabular-nums ${deltaColor}`}>
                        {fmt(o.avg_adjusted_price)}
                        <div className="text-[10px]">{delta > 0 ? "+" : ""}{delta.toFixed(1)}%</div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">{fmt(o.estimated_volume)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#B8922A]">
                        +{o.campaign_lift_pct}%
                      </td>
                      <td className="py-3 px-4 text-right font-display-serif text-base tabular-nums text-[#0A0A0A]">
                        {fmt(o.projected_revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="text-[10px] uppercase tracking-wider text-[#0A0A0A]/45 text-center">
            Horizon : {data.horizon_start} → {data.horizon_end} · Capacités &
            prix de base configurables côté backend (OFFER_CATALOG).
          </div>
        </>
      )}
    </div>
  );
}

function Slider({ label, value, min, max, step, suffix, onChange, testid, note }) {
  return (
    <div data-testid={testid}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.25em] text-[#0A0A0A]/55">{label}</span>
        <span className="font-display-serif text-base tabular-nums text-[#B8922A]">
          {Number(value).toFixed(suffix === "‰" ? 0 : 0)}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#B8922A]"
      />
      {note && <div className="text-[10px] text-[#0A0A0A]/45 mt-1">{note}</div>}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent = false }) {
  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={12} className={accent ? "text-[#B8922A]" : "text-[#0A0A0A]/55"} />}
        <div className="text-[0.55rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55">{label}</div>
      </div>
      <div className={`font-serif italic font-light text-2xl tabular-nums ${accent ? "text-[#B8922A]" : "text-[#0A0A0A]"}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * BookingExtras — Public page for cross-selling add-ons after a booking.
 *
 * Customer arrives via a link in their confirmation email OR a CTA on
 * the ticket page : `/booking-extras/{booking_ref}`.
 * They can browse the upsell catalog (transats VIP, Champagne, soin spa,
 * table Kaai…) and add items to their stay. Selections are persisted in
 * `upsell_selections` and confirmed by the team within 24 h.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ShoppingBag, Check, Plus, Minus, Waves, Sparkles,
  UtensilsCrossed, Anchor, Heart, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "../lib/tracking";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const CATEGORY_META = {
  beach_club:  { label: "Beach Club",   icon: Waves },
  wellness:    { label: "Spa & Soins",  icon: Heart },
  gastronomy:  { label: "Gastronomie",  icon: UtensilsCrossed },
  experience:  { label: "Expériences",  icon: Sparkles },
  transport:   { label: "Transport",    icon: Anchor },
};

const CAT_ORDER = ["beach_club", "wellness", "gastronomy", "experience", "transport"];

export default function BookingExtras() {
  const { ref } = useParams();
  const [catalog, setCatalog] = useState({});
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [error, setError] = useState(null);

  async function loadCatalog() {
    const r = await fetch(`${BACKEND}/api/upsells/catalog`);
    if (!r.ok) throw new Error("catalog");
    const d = await r.json();
    setCatalog(d.by_category || {});
  }

  async function loadSelections() {
    const r = await fetch(`${BACKEND}/api/upsells/bookings/${encodeURIComponent(ref)}`);
    if (!r.ok) return;
    const d = await r.json();
    setSelections(d.items || []);
  }

  useEffect(() => {
    Promise.all([loadCatalog(), loadSelections()])
      .catch(() => setError("Impossible de charger les extras."))
      .finally(() => setLoading(false));
    trackEvent("view_offer", { offer_type: "upsell", booking_ref: ref });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  async function addExtra(offer) {
    const qty = quantities[offer.id] || 1;
    setAddingId(offer.id);
    try {
      const res = await fetch(`${BACKEND}/api/upsells/bookings/${encodeURIComponent(ref)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsell_id: offer.id, quantity: qty }),
      });
      if (res.status === 404) {
        toast.error("Référence de réservation introuvable.");
        return;
      }
      if (!res.ok) throw new Error("network");
      const d = await res.json();
      setSelections((prev) => [d.selection, ...prev]);
      trackEvent("upsell_added", { upsell_id: offer.id, amount_xof: offer.price_xof * qty });
      toast.success(`${offer.name} ajouté à votre séjour.`);
      setQuantities({ ...quantities, [offer.id]: 1 });
    } catch {
      toast.error("Ajout impossible.");
    } finally {
      setAddingId(null);
    }
  }

  const totalSelected = useMemo(
    () => selections.reduce((s, x) => s + (x.amount_xof || 0), 0),
    [selections]
  );

  const orderedCats = useMemo(
    () => CAT_ORDER.filter((c) => (catalog[c] || []).length > 0),
    [catalog]
  );

  return (
    <div className="bg-white text-[#0A0A0A]" data-testid="booking-extras">
      <section className="relative h-[45vh] min-h-[340px] flex items-end overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{
          backgroundImage: "url(https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=2400&q=85)"
        }} />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 w-full px-6 pb-14 text-center text-white">
          <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/80 mb-5">
            <ShoppingBag size={14} className="inline mr-2" />
            Sublimez votre séjour
          </div>
          <h1 className="font-serif font-light text-4xl md:text-6xl leading-tight">
            Ajoutez l'inattendu.
          </h1>
          <p className="text-white/70 text-sm mt-4 font-mono">
            Réservation #{ref}
          </p>
        </div>
      </section>

      {error && (
        <div className="max-w-2xl mx-auto mt-10 px-6 text-center">
          <p className="text-sm text-[#C24226]" data-testid="booking-extras-error">{error}</p>
        </div>
      )}

      {/* Selections summary */}
      {selections.length > 0 && (
        <section className="bg-[#FAF7F2] border-y border-[#0A0A0A]/10 py-8" data-testid="booking-extras-selection">
          <div className="max-w-4xl mx-auto px-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[0.65rem] tracking-[0.4em] uppercase text-[#0A0A0A]/65">
                Déjà ajoutés à votre séjour
              </h3>
              <div className="text-sm font-medium tabular-nums">
                {totalSelected.toLocaleString("fr-FR")} XOF
              </div>
            </div>
            <ul className="space-y-2">
              {selections.map((s) => (
                <li key={s.id || s._id || `${s.upsell_id}-${s.created_at}`}
                    className="flex items-center justify-between text-sm bg-white border border-[#0A0A0A]/8 px-4 py-2">
                  <span className="flex items-center gap-2">
                    <Check size={13} className="text-[#16A34A]" />
                    {s.upsell_name} × {s.quantity}
                  </span>
                  <span className="tabular-nums text-[#B8922A]">
                    {(s.amount_xof || 0).toLocaleString("fr-FR")} XOF
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Catalog */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          {loading ? (
            <div className="text-center py-12 text-sm text-[#0A0A0A]/45">Chargement du catalogue…</div>
          ) : orderedCats.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#0A0A0A]/45">
              Aucun extra disponible pour le moment.
            </div>
          ) : (
            orderedCats.map((cat) => {
              const meta = CATEGORY_META[cat];
              const Icon = meta.icon;
              return (
                <div key={cat} data-testid={`extras-cat-${cat}`}>
                  <div className="flex items-center gap-3 mb-8">
                    <Icon size={18} className="text-[#B8922A]" strokeWidth={1.5} />
                    <h2 className="font-serif font-light text-2xl md:text-3xl">
                      {meta.label}
                    </h2>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {catalog[cat].map((o) => {
                      const qty = quantities[o.id] || 1;
                      return (
                        <article
                          key={o.id}
                          className="bg-white border border-[#0A0A0A]/10 overflow-hidden flex flex-col"
                          data-testid={`extra-${o.id}`}
                        >
                          {o.image_url && (
                            <div className="aspect-[4/3] overflow-hidden bg-[#FAF7F2]">
                              <img src={o.image_url} alt={o.name}
                                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                            </div>
                          )}
                          <div className="p-5 flex-1 flex flex-col">
                            <h3 className="font-serif text-xl mb-2">{o.name}</h3>
                            {o.description && (
                              <p className="text-sm text-[#0A0A0A]/65 leading-relaxed flex-1">
                                {o.description}
                              </p>
                            )}
                            <div className="flex items-end justify-between mt-5">
                              <div className="font-serif text-2xl tabular-nums">
                                {o.price_xof.toLocaleString("fr-FR")}
                                <span className="text-xs text-[#0A0A0A]/55 not-italic font-sans"> XOF</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setQuantities({ ...quantities, [o.id]: Math.max(1, qty - 1) })}
                                  className="w-7 h-7 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A] flex items-center justify-center transition-colors"
                                  data-testid={`extra-${o.id}-minus`}
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => setQuantities({
                                    ...quantities,
                                    [o.id]: Math.min(o.max_per_booking || 10, qty + 1),
                                  })}
                                  className="w-7 h-7 border border-[#0A0A0A]/15 hover:border-[#B8922A] hover:text-[#B8922A] flex items-center justify-center transition-colors"
                                  data-testid={`extra-${o.id}-plus`}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => addExtra(o)}
                              disabled={addingId === o.id}
                              className="mt-5 inline-flex items-center justify-center gap-2 py-3 bg-[#0A0A0A] text-white text-[0.65rem] tracking-[0.3em] uppercase hover:bg-[#B8922A] transition-colors disabled:opacity-50"
                              data-testid={`extra-add-${o.id}`}
                            >
                              {addingId === o.id ? "Ajout…" : "Ajouter au séjour"}
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="py-16 bg-[#0A0A0A] text-white text-center">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-white/65 text-sm leading-relaxed mb-6">
            Notre conciergerie reviendra vers vous pour confirmer la disponibilité
            de chaque extra et organiser votre journée parfaite.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[0.7rem] tracking-[0.35em] uppercase border-b border-white/40 pb-1 hover:text-[#D4B256] hover:border-[#D4B256] transition-colors"
            data-testid="extras-back-home"
          >
            Retour à l'accueil
            <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    </div>
  );
}

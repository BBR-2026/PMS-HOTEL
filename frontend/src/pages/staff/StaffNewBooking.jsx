import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { toast } from "sonner";
import { ArrowLeft, Plus, Minus, ChevronRight, BedDouble, Sun, Coffee, Wine, Anchor, Loader2 } from "lucide-react";
import { format } from "date-fns";

const OFFER_ICONS = {
  pass_day: Sun,
  sunset: Wine,
  brunch: Coffee,
  le_kaai: Anchor,
  hebergement: BedDouble,
};

const PAYMENT_METHODS = [
  { id: "cash", label: "Espèces" },
  { id: "card", label: "Carte bancaire" },
  { id: "mobile_money", label: "Mobile Money" },
];

const fmtXOF = (n) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n || 0))} FCFA`;

function buildEmpty(kind) {
  return { name: "", surname: "", email: "", phone: "", nationality: "", kind };
}

export default function StaffNewBooking() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [offerId, setOfferId] = useState(null);
  const [date, setDate] = useState("");
  const [checkoutDate, setCheckoutDate] = useState("");
  const [roomTier, setRoomTier] = useState(null);
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [participants, setParticipants] = useState([buildEmpty("adult"), buildEmpty("adult")]);
  const [boatTime, setBoatTime] = useState("");
  const [returnBoatTime, setReturnBoatTime] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [depositPct, setDepositPct] = useState(30);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get("/offers").then((r) => setOffers(r.data)).catch(() => {});
  }, []);

  const offer = useMemo(() => offers.find((o) => o.id === offerId), [offers, offerId]);
  const isOvernight = !!offer?.is_overnight;
  const hasTiers = !!(offer?.room_tiers || []).length;
  const selectedTier = hasTiers ? offer.room_tiers.find((t) => t.id === roomTier) : null;

  // Sync participants array with adults/children counts
  useEffect(() => {
    setParticipants((prev) => {
      const prevAdults = prev.filter((p) => p.kind === "adult");
      const prevChildren = prev.filter((p) => p.kind === "child");
      const nextAdults = Array.from({ length: adults }, (_, i) => prevAdults[i] || buildEmpty("adult"));
      const nextChildren = Array.from({ length: children }, (_, i) => prevChildren[i] || buildEmpty("child"));
      return [...nextAdults, ...nextChildren];
    });
  }, [adults, children]);

  // Compute boat times for the chosen date
  const boatTimes = useMemo(() => {
    if (!offer) return [];
    if (offer.boat_times_weekday && offer.boat_times_weekend) {
      if (!date) return offer.boat_times_weekday;
      const d = new Date(date + "T12:00:00");
      const pyWd = (d.getDay() + 6) % 7;
      return pyWd >= 5 ? offer.boat_times_weekend : offer.boat_times_weekday;
    }
    return offer.boat_times || [];
  }, [offer, date]);

  const returnBoatTimes = useMemo(() => {
    if (!offer || !isOvernight) return [];
    if (offer.boat_times_weekday && offer.boat_times_weekend) {
      if (!checkoutDate) return offer.boat_times_weekday;
      const d = new Date(checkoutDate + "T12:00:00");
      const pyWd = (d.getDay() + 6) % 7;
      return pyWd >= 5 ? offer.boat_times_weekend : offer.boat_times_weekday;
    }
    return offer.boat_times || [];
  }, [offer, isOvernight, checkoutDate]);

  const nights = useMemo(() => {
    if (!isOvernight || !date || !checkoutDate) return 0;
    const a = new Date(date + "T12:00:00");
    const b = new Date(checkoutDate + "T12:00:00");
    return Math.max(0, Math.round((b - a) / 86400000));
  }, [isOvernight, date, checkoutDate]);

  const total = useMemo(() => {
    if (!offer) return 0;
    if (isOvernight && hasTiers) {
      return selectedTier ? selectedTier.price * nights * rooms : 0;
    }
    const base = adults * (offer.price_adult || 0) + children * (offer.price_child || 0);
    return isOvernight ? base * nights : base;
  }, [offer, adults, children, isOvernight, hasTiers, selectedTier, nights, rooms]);

  const reset = () => {
    setOfferId(null);
    setDate("");
    setCheckoutDate("");
    setRoomTier(null);
    setRooms(1);
    setAdults(2);
    setChildren(0);
    setParticipants([buildEmpty("adult"), buildEmpty("adult")]);
    setBoatTime("");
    setReturnBoatTime("");
    setSpecialRequests("");
    setPaymentMethod("cash");
  };

  const participantsValid = participants.length === adults + children && participants.every(
    (p) => p.name.trim() && p.surname.trim() && p.nationality.trim() && p.phone.trim() && /\S+@\S+\.\S+/.test(p.email),
  );

  const canSubmit =
    !!offer &&
    !!date &&
    (!isOvernight || (!!checkoutDate && nights >= 1)) &&
    (!hasTiers || !!selectedTier) &&
    adults + children >= 1 &&
    participantsValid &&
    !!boatTime &&
    (!isOvernight || !!returnBoatTime);

  const submit = async () => {
    if (!canSubmit) return;
    setCreating(true);
    try {
      const body = {
        offer_type: offer.id,
        date,
        checkout_date: isOvernight ? checkoutDate : null,
        room_tier: hasTiers ? roomTier : null,
        rooms: hasTiers ? rooms : 1,
        adults,
        children,
        boat_time: boatTime,
        return_boat_time: isOvernight ? returnBoatTime : null,
        participants: participants.map((p) => ({
          name: p.name.trim(),
          surname: p.surname.trim(),
          email: p.email.trim().toLowerCase(),
          phone: p.phone.trim(),
          nationality: p.nationality.trim(),
          kind: p.kind,
        })),
        special_requests: specialRequests,
        payment_method: paymentMethod,
        deposit_pct: paymentMethod === "deposit" ? depositPct : null,
      };
      const { data } = await api.post("/staff/bookings", body);
      toast.success(`Réservation créée · #${data.id.slice(0, 8).toUpperCase()}`);
      navigate("/staff/reservations");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-5xl mx-auto" data-testid="staff-new-booking">
      <button
        onClick={() => navigate("/staff/reservations")}
        className="text-[0.7rem] uppercase tracking-[0.28em] text-[#0A0A0A]/50 hover:text-[#B8922A] transition-colors inline-flex items-center gap-2 mb-5"
        data-testid="newbooking-back"
      >
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="mb-8">
        <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">Back-office</div>
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">Nouvelle réservation</h1>
        <p className="text-sm text-[#0A0A0A]/55 mt-1">Créer une réservation au nom d'un client et générer immédiatement les billets.</p>
      </div>

      {/* Offer selector */}
      <Section title="Offre">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="newbooking-offers">
          {offers.map((o) => {
            const Icon = OFFER_ICONS[o.id] || Sun;
            const selected = offerId === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setOfferId(o.id);
                  setRoomTier(null);
                  setDate("");
                  setCheckoutDate("");
                  setBoatTime("");
                  setReturnBoatTime("");
                }}
                className={`text-left border p-3 sm:p-4 transition-all ${
                  selected ? "border-[#B8922A] bg-[#B8922A]/5 ring-1 ring-[#B8922A]/40" : "border-[#0A0A0A]/15 hover:border-[#B8922A]/50"
                }`}
                data-testid={`newbooking-offer-${o.id}`}
              >
                <Icon size={16} className="text-[#B8922A] mb-2" />
                <div className="font-display-serif text-sm sm:text-base text-[#0A0A0A] leading-tight">
                  {o.name_fr}
                </div>
                <div className="text-[0.62rem] text-[#0A0A0A]/50 mt-1 line-clamp-1">{o.schedule_fr}</div>
              </button>
            );
          })}
        </div>
      </Section>

      {offer && (
        <>
          {/* Dates */}
          <Section title={isOvernight ? "Dates de séjour" : "Date"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldDate
                label={isOvernight ? "Arrivée" : "Date"}
                value={date}
                min={today}
                onChange={(v) => {
                  setDate(v);
                  if (checkoutDate && checkoutDate <= v) setCheckoutDate("");
                  setBoatTime("");
                }}
                testid="newbooking-date"
              />
              {isOvernight && (
                <FieldDate
                  label="Départ"
                  value={checkoutDate}
                  min={date || today}
                  onChange={(v) => {
                    setCheckoutDate(v);
                    setReturnBoatTime("");
                  }}
                  testid="newbooking-checkout"
                />
              )}
            </div>
            {isOvernight && nights > 0 && (
              <div className="text-[0.72rem] text-[#0A0A0A]/55 mt-3" data-testid="newbooking-nights">
                {nights} nuit{nights > 1 ? "s" : ""}
              </div>
            )}
          </Section>

          {/* Room tier (hebergement) */}
          {hasTiers && (
            <Section title="Catégorie de chambre">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="newbooking-tiers">
                {offer.room_tiers.map((t) => {
                  const selected = roomTier === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setRoomTier(t.id)}
                      className={`text-left p-4 border transition-all ${
                        selected ? "border-[#B8922A] bg-[#B8922A]/5" : "border-[#0A0A0A]/15 hover:border-[#B8922A]/40"
                      }`}
                      data-testid={`newbooking-tier-${t.id}`}
                    >
                      <div className="font-display-serif text-base text-[#0A0A0A] leading-tight mb-1">{t.name_fr}</div>
                      <div className="text-sm text-[#B8922A] font-medium">{fmtXOF(t.price)} / nuit</div>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Guest counters */}
          <Section title="Convives">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {hasTiers && (
                <CounterCard label="Chambres" value={rooms} onDec={() => setRooms(Math.max(1, rooms - 1))} onInc={() => setRooms(rooms + 1)} testid="newbooking-rooms" />
              )}
              <CounterCard label="Adultes" value={adults} onDec={() => setAdults(Math.max(0, adults - 1))} onInc={() => setAdults(adults + 1)} testid="newbooking-adults" />
              <CounterCard label="Enfants" value={children} onDec={() => setChildren(Math.max(0, children - 1))} onInc={() => setChildren(children + 1)} testid="newbooking-children" />
            </div>
          </Section>

          {/* Boat times */}
          <Section title={isOvernight ? "Bateaux" : "Heure du bateau"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-2">
                  {isOvernight ? "Aller (arrivée)" : "Aller"}
                </div>
                <div className="flex flex-wrap gap-2" data-testid="newbooking-boat-times">
                  {boatTimes.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setBoatTime(h)}
                      className={`px-3 py-1.5 text-sm border transition-all ${
                        boatTime === h ? "bg-[#B8922A] text-white border-[#B8922A]" : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
                      }`}
                      data-testid={`newbooking-boat-${h}`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              {isOvernight && (
                <div>
                  <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-2">Retour (départ)</div>
                  <div className="flex flex-wrap gap-2" data-testid="newbooking-return-boat-times">
                    {returnBoatTimes.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setReturnBoatTime(h)}
                        className={`px-3 py-1.5 text-sm border transition-all ${
                          returnBoatTime === h ? "bg-[#B8922A] text-white border-[#B8922A]" : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
                        }`}
                        data-testid={`newbooking-return-boat-${h}`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Participants */}
          <Section title="Participants">
            <div className="space-y-4">
              {participants.map((p, i) => {
                const adultIndex = participants.slice(0, i + 1).filter((x) => x.kind === "adult").length;
                const childIndex = participants.slice(0, i + 1).filter((x) => x.kind === "child").length;
                const label = p.kind === "adult"
                  ? `Adulte ${adultIndex}${i === 0 ? " · Contact principal" : ""}`
                  : `Enfant ${childIndex}`;
                const update = (k) => (e) => {
                  const next = [...participants];
                  next[i] = { ...next[i], [k]: e.target.value };
                  setParticipants(next);
                };
                return (
                  <div key={i} className="border border-[#0A0A0A]/10 bg-[#FAFAF7] p-4" data-testid={`newbooking-participant-${i}`}>
                    <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#B8922A] mb-3">{label}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input placeholder="Nom" value={p.surname} onChange={update("surname")} testid={`newbooking-p-${i}-surname`} />
                      <Input placeholder="Prénom" value={p.name} onChange={update("name")} testid={`newbooking-p-${i}-name`} />
                      <Input type="email" placeholder="Email" value={p.email} onChange={update("email")} testid={`newbooking-p-${i}-email`} />
                      <Input placeholder="Téléphone" value={p.phone} onChange={update("phone")} testid={`newbooking-p-${i}-phone`} />
                      <div className="sm:col-span-2">
                        <Input placeholder="Nationalité (ex: Ivoirien)" value={p.nationality} onChange={update("nationality")} testid={`newbooking-p-${i}-nationality`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Special requests */}
          <Section title="Demandes spéciales (optionnel)">
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={3}
              className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none resize-none bg-white"
              placeholder="Allergie, préférence de table, anniversaire…"
              data-testid="newbooking-special"
            />
          </Section>

          {/* Payment */}
          <Section title="Paiement">
            <div className="flex flex-wrap gap-2 mb-4" data-testid="newbooking-payment-methods">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] border transition-all ${
                    paymentMethod === m.id ? "bg-[#B8922A] text-white border-[#B8922A]" : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
                  }`}
                  data-testid={`newbooking-pay-${m.id}`}
                >
                  {m.label}
                </button>
              ))}
              {isOvernight && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("deposit")}
                  className={`px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] border transition-all ${
                    paymentMethod === "deposit" ? "bg-[#B8922A] text-white border-[#B8922A]" : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#B8922A]"
                  }`}
                  data-testid="newbooking-pay-deposit"
                >
                  Acompte
                </button>
              )}
            </div>
            {paymentMethod === "deposit" && (
              <div className="flex flex-wrap gap-2 mb-4" data-testid="newbooking-deposit-pcts">
                {[10, 30, 70].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDepositPct(pct)}
                    className={`px-3 py-1.5 text-sm border transition-all ${
                      depositPct === pct ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#0A0A0A]"
                    }`}
                    data-testid={`newbooking-deposit-${pct}`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* Summary footer */}
          <div className="sticky bottom-0 bg-white border-t border-[#B8922A]/30 -mx-4 sm:-mx-8 lg:-mx-10 px-4 sm:px-8 lg:px-10 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-8" data-testid="newbooking-footer">
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Total</div>
              <div className="font-display-serif text-2xl sm:text-3xl text-[#B8922A]">
                {total > 0 ? fmtXOF(total) : "Sur réservation"}
              </div>
              {paymentMethod === "deposit" && total > 0 && (
                <div className="text-[0.72rem] text-[#0A0A0A]/55 mt-0.5">
                  Acompte {depositPct}% = {fmtXOF((total * depositPct) / 100)} · Solde {fmtXOF(total - Math.round((total * depositPct) / 100))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                disabled={creating}
                className="px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] border border-[#0A0A0A]/15 text-[#0A0A0A]/65 hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-all"
                data-testid="newbooking-reset"
              >
                Réinitialiser
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit || creating}
                className="px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] bg-[#B8922A] text-white hover:bg-[#a37e1f] transition-all inline-flex items-center gap-2 disabled:opacity-40"
                data-testid="newbooking-submit"
              >
                {creating ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={13} />}
                Créer la réservation
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">{title}</div>
      {children}
    </div>
  );
}

function FieldDate({ label, value, onChange, min, testid }) {
  return (
    <label className="block">
      <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 mb-1.5 block">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none bg-white"
        data-testid={testid}
      />
    </label>
  );
}

function Input({ value, onChange, placeholder, type = "text", testid }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm focus:border-[#B8922A] outline-none bg-white"
      data-testid={testid}
    />
  );
}

function CounterCard({ label, value, onDec, onInc, testid }) {
  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-3 sm:p-4 flex items-center justify-between gap-3" data-testid={testid}>
      <div className="font-display-serif text-base sm:text-lg text-[#0A0A0A]">{label}</div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onDec}
          className="w-8 h-8 border border-[#B8922A]/40 text-[#B8922A] flex items-center justify-center hover:bg-[#B8922A]/10 transition-colors"
          data-testid={`${testid}-dec`}
          type="button"
        >
          <Minus size={12} />
        </button>
        <span className="font-display-serif text-xl text-[#0A0A0A] w-6 text-center" data-testid={`${testid}-value`}>{value}</span>
        <button
          onClick={onInc}
          className="w-8 h-8 border border-[#B8922A] bg-[#B8922A]/10 text-[#B8922A] flex items-center justify-center hover:bg-[#B8922A]/20 transition-colors"
          data-testid={`${testid}-inc`}
          type="button"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Send, Bell, RefreshCw, MessageSquare, MessageCircle, Phone, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const STATUS_COLOR = {
  queued: "bg-amber-50 text-amber-800 border-amber-300",
  sending: "bg-amber-50 text-amber-800 border-amber-300",
  sent: "bg-sky-50 text-sky-800 border-sky-300",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-300",
  read: "bg-emerald-50 text-emerald-800 border-emerald-300",
  undelivered: "bg-rose-50 text-rose-800 border-rose-300",
  failed: "bg-rose-50 text-rose-800 border-rose-300",
};

const PURPOSE_LABEL = {
  booking_paid: "Réservation payée",
  j_minus_1: "Rappel J-1",
  j_plus_1: "Demande d'avis J+1",
  staff_alert: "Alerte staff",
  admin_test: "Test admin",
  generic: "Générique",
};

export default function StaffNotifications() {
  const [items, setItems] = useState([]);
  const [twilioEnabled, setTwilioEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("+2250704600600");
  const [body, setBody] = useState("Bonjour, ceci est un test de notification depuis le Back-office BBR ✨");
  const [busy, setBusy] = useState(false);
  const [trialSafe, setTrialSafe] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/staff/notifications/outbound?limit=50`);
      setItems(data.items || []);
      setTwilioEnabled(data.twilio_enabled);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const sendTest = async () => {
    if (!phone) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/staff/notifications/test`, { phone, body, trial_safe: trialSafe });
      const wa = data.whatsapp;
      const sm = data.sms;
      const errs = data.errors || [];
      const okFinal = (wa && ["queued", "sent", "delivered", "read", "accepted"].includes(wa.status) && !wa.error_code)
        || (sm && ["queued", "sent", "delivered", "accepted"].includes(sm.status) && !sm.error_code);
      if (okFinal) {
        const ch = wa && !wa.error_code ? "WhatsApp" : "SMS";
        const usedSid = (wa && !wa.error_code ? wa.sid : sm?.sid) || "";
        toast.success(`Envoyé via ${ch} (${usedSid.slice(0, 10)}…) — statut : ${(wa && !wa.error_code ? wa.status : sm?.status)}`);
      } else if (errs.length) {
        // Show the first detailed error in a long-lived toast
        toast.error(errs[0], { duration: 12000 });
      } else {
        toast.error("Échec inconnu — vérifiez l'historique");
      }
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Envoi impossible");
    } finally {
      setBusy(false);
    }
  };

  const runJob = async (which) => {
    setBusy(true);
    try {
      await api.post(`/staff/notifications/run-${which}`);
      toast.success(`Job ${which} lancé`);
      setTimeout(refresh, 1500);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto" data-testid="staff-notifications">
      <div className="mb-6 sm:mb-8">
        <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1.5 inline-flex items-center gap-2">
          <Bell size={12} /> Notifications transactionnelles
        </div>
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-4xl text-[#0A0A0A]">SMS & WhatsApp</h1>
        <p className="text-sm text-[#0A0A0A]/55 mt-1.5 max-w-2xl">
          Envois automatiques : confirmation de paiement · rappel J-1 (17h UTC) · demande d'avis J+1 (10h UTC) · alertes staff.
        </p>
      </div>

      {!twilioEnabled && (
        <div className="mb-6 bg-amber-50 border border-amber-300 p-4 inline-flex items-start gap-2 text-[0.8rem] text-amber-900" data-testid="twilio-disabled-banner">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          Twilio n'est pas configuré sur cette instance. Vérifiez les variables d'environnement.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-8">
        {/* Manual test send */}
        <div className="lg:col-span-2 bg-white border border-[#0A0A0A]/8 p-5">
          <h2 className="font-display-serif text-lg text-[#0A0A0A] mb-1 inline-flex items-center gap-2">
            <Send size={14} className="text-[#B8922A]" /> Envoi test
          </h2>
          <p className="text-[0.7rem] text-[#0A0A0A]/55 mb-4">Vérifiez votre configuration WhatsApp / SMS.</p>
          <div className="space-y-3.5">
            <div>
              <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] inline-flex items-center gap-1.5">
                <Phone size={11} /> Destinataire
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+225 0700 00 00 00"
                className="w-full mt-1 px-3 py-2 text-sm border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none"
                data-testid="notif-phone-input"
              />
            </div>
            <div>
              <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A]">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full mt-1 px-3 py-2 text-sm border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none resize-y"
                data-testid="notif-body-input"
              />
            </div>
            <button
              onClick={sendTest}
              disabled={busy || !phone || !body}
              className="bg-[#B8922A] text-white px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] hover:bg-[#9d7a23] disabled:opacity-50 inline-flex items-center gap-2"
              data-testid="notif-send-btn"
            >
              <Send size={12} /> Envoyer (WhatsApp puis SMS si nécessaire)
            </button>
            <label className="flex items-start gap-2 text-[0.7rem] text-[#0A0A0A]/70 cursor-pointer select-none" data-testid="notif-trial-safe-toggle">
              <input
                type="checkbox"
                checked={trialSafe}
                onChange={(e) => setTrialSafe(e.target.checked)}
                className="mt-0.5 accent-[#B8922A]"
              />
              <span>
                <span className="font-medium">Mode trial-safe</span> — rerouter ce test vers le numéro vérifié <span className="tabular-nums">+225 0704600600</span> (utile uniquement en compte Twilio Trial).
              </span>
            </label>
            <div className="bg-[#FAFAF7] border border-[#0A0A0A]/10 p-3 text-[0.65rem] leading-relaxed text-[#0A0A0A]/70 space-y-1.5">
              <div className="font-medium text-[#0A0A0A]/85 uppercase tracking-[0.18em] text-[0.58rem] text-[#B8922A]">WhatsApp Sandbox — Opt-in obligatoire</div>
              <p>
                Pour recevoir des messages WhatsApp depuis le numéro Twilio Sandbox <span className="tabular-nums font-medium">+1 415 523 8886</span>, le destinataire doit d'abord lui envoyer un code <span className="font-medium">"join &lt;votre-code&gt;"</span> depuis WhatsApp.
              </p>
              <p>
                Sans cet opt-in, le message part avec un statut "queued" puis tombe en "undelivered" (erreur 63007 / 63015). En SMS, ce n'est pas requis.
              </p>
            </div>
          </div>
        </div>

        {/* Manual job triggers */}
        <div className="bg-white border border-[#0A0A0A]/8 p-5">
          <h2 className="font-display-serif text-lg text-[#0A0A0A] mb-1 inline-flex items-center gap-2">
            <Bell size={13} className="text-[#B8922A]" /> Jobs planifiés
          </h2>
          <p className="text-[0.7rem] text-[#0A0A0A]/55 mb-4">Exécution manuelle hors-cron.</p>
          <div className="space-y-2">
            <button
              onClick={() => runJob("j-minus-1")}
              disabled={busy}
              className="w-full px-4 py-3 border border-[#0A0A0A]/15 text-left text-sm hover:border-[#B8922A] hover:bg-[#FAFAF7] disabled:opacity-50 transition-colors"
              data-testid="run-j-minus-1"
            >
              <div className="font-medium text-[#0A0A0A]">Lancer J-1 maintenant</div>
              <div className="text-[0.65rem] text-[#0A0A0A]/55 mt-0.5">Cron quotidien à 17:00 UTC (≈18h Abidjan)</div>
            </button>
            <button
              onClick={() => runJob("j-plus-1")}
              disabled={busy}
              className="w-full px-4 py-3 border border-[#0A0A0A]/15 text-left text-sm hover:border-[#B8922A] hover:bg-[#FAFAF7] disabled:opacity-50 transition-colors"
              data-testid="run-j-plus-1"
            >
              <div className="font-medium text-[#0A0A0A]">Lancer J+1 maintenant</div>
              <div className="text-[0.65rem] text-[#0A0A0A]/55 mt-0.5">Cron quotidien à 10:00 UTC (≈11h Abidjan)</div>
            </button>
          </div>
        </div>
      </div>

      {/* Outbound log */}
      <div className="bg-white border border-[#0A0A0A]/8 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display-serif text-lg text-[#0A0A0A]">Historique des envois</h2>
          <button onClick={refresh} className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] hover:underline inline-flex items-center gap-1.5">
            <RefreshCw size={11} /> Rafraîchir
          </button>
        </div>
        {loading ? (
          <div className="py-10 text-center text-[#0A0A0A]/50 text-sm">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-[#0A0A0A]/50 text-sm">Aucun envoi récent.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]" data-testid="notif-outbound-table">
              <thead>
                <tr className="text-left text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 border-b border-[#0A0A0A]/10">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Canal</th>
                  <th className="py-2 px-3">Statut</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Destinataire</th>
                  <th className="py-2 px-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.sid || it.created_at} className="border-b border-[#0A0A0A]/5">
                    <td className="py-2 px-3 text-[0.72rem] text-[#0A0A0A]/65 tabular-nums">
                      {(it.created_at || "").slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1 text-[0.7rem]">
                        {it.channel === "whatsapp" ? <MessageCircle size={12} className="text-emerald-700" /> : <MessageSquare size={12} className="text-sky-700" />}
                        {it.channel}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] border ${STATUS_COLOR[it.status] || "border-[#0A0A0A]/15"}`}>
                        {it.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[0.72rem] text-[#0A0A0A]/75">{PURPOSE_LABEL[it.purpose] || it.purpose}</td>
                    <td className="py-2 px-3 text-[0.72rem] text-[#0A0A0A]/65 tabular-nums">{it.to}</td>
                    <td className="py-2 px-3 text-[0.72rem] text-[#0A0A0A]/55 max-w-md truncate" title={it.body_preview}>
                      {it.body_preview}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

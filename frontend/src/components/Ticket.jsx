import { motion } from "framer-motion";
import { Download } from "lucide-react";

// Map each offer to its hero image + cursive title used on the luxury ticket.
// The cursive part is rendered with CSS to mirror the brand template ("DAY Pass",
// "THE Sunset", "THE Brunch", "Le Kaai", "Hébergement").
const TICKET_IMG_BY_ID = {
  pass_day: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/4kr4z5g1_DAY%20PASS.jpeg",
  sunset: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/3g3onmkg_THE%20SUNSET.jpeg",
  brunch: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/1txrnqdp_B%20BRUNCH.jpeg",
  le_kaai: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/kgqk46mw_LE%20KAAI.jpeg",
  hebergement: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=80",
};

// Cursive titles already baked into the offer brand images, so no overlay needed.
const BROWN = "#6B4423";

export default function Ticket({ booking, qr, t, lang, index = 0 }) {
  const formatDateLong = (iso) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const image = TICKET_IMG_BY_ID[booking.offer_type] || TICKET_IMG_BY_ID.pass_day;
  const ownerName = `${qr.guest_name} ${qr.guest_surname}`;
  const refCode = (qr.qr_token || "").slice(0, 10).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: index * 0.08 }}
      className="bg-white border border-[#B8922A]/30 p-4 max-w-md mx-auto w-full"
      data-testid={`ticket-${index}`}
    >
      {/* Header: official BBr logo */}
      <div className="border-y border-[#B8922A]/40 py-5 mb-2 flex items-center justify-center bg-white">
        <img
          src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/2p8ulkeu_LOGO_BBr_VF_Plan_de_travail_1-removebg-preview.png"
          alt="Boulay Beach Resort"
          className="h-20 w-auto"
          data-testid={`ticket-${index}-logo`}
        />
      </div>

      {/* Hero image with the offer's own brand title (already baked into the
          asset). object-position is shifted UP to hide the white footer band
          that brand marketing photos contain below the chevron decoration. */}
      <div className="relative overflow-hidden aspect-[16/9]">
        <img
          src={image}
          alt={booking.offer_name}
          className="absolute inset-0 w-full h-full object-cover block"
          style={{ objectPosition: "50% 35%" }}
        />
      </div>

      {/* Brown body with details — negative margin to eliminate sub-pixel gap
          that browsers can render between aspect-ratio'd images and siblings */}
      <div
        className="grid grid-cols-2 gap-5 p-6 md:p-7 text-white relative"
        style={{ backgroundColor: BROWN, marginTop: "-1px" }}
      >
        <div className="space-y-3">
          <div className="font-semibold leading-snug text-[0.95rem]">
            {t.booking.ticketGreetingLine1}
          </div>
          <div className="text-[0.8rem] leading-relaxed opacity-90">
            {t.booking.ticketGreetingLine2}
          </div>
          <div className="text-[0.8rem] opacity-90 italic pt-1">
            {t.booking.ticketSignature}
          </div>
        </div>
        <div className="space-y-3 text-[0.78rem]">
          <div className="border-b border-white/30 pb-2">
            <span className="opacity-80">{t.booking.ticketOwner} :</span>{" "}
            <span className="font-semibold block mt-0.5">{ownerName}</span>
          </div>
          <div className="border-b border-white/30 pb-2">
            <span className="opacity-80">{t.booking.ticketOffer} :</span>{" "}
            <span className="font-semibold block mt-0.5">{booking.offer_name}</span>
          </div>
          <div className="border-b border-white/30 pb-2">
            <span className="opacity-80">{t.booking.ticketDate} :</span>{" "}
            <span className="font-semibold block mt-0.5 capitalize">
              {formatDateLong(booking.date)}
            </span>
          </div>
          <div>
            <span className="opacity-80">{t.booking.ticketBoardingTime} :</span>{" "}
            <span className="font-semibold block mt-0.5">{booking.boat_time}</span>
          </div>
        </div>
      </div>

      {/* QR code section */}
      <div className="border border-[#B8922A]/30 mt-2 p-6 flex flex-col items-center">
        <img src={qr.qr_code} alt="QR" className="w-56 h-56 object-contain mb-3" />
        <div
          className="font-mono font-bold tracking-widest text-lg"
          style={{ color: BROWN }}
          data-testid={`ticket-${index}-ref`}
        >
          {refCode}
        </div>

        <a
          href={qr.ticket_image || qr.qr_code}
          download={`bbr-ticket-${(ownerName).replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`}
          className="mt-5 inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60 hover:text-[#B8922A] transition-colors"
          data-testid={`ticket-${index}-download`}
        >
          <Download size={11} />
          {t.booking.download}
        </a>
      </div>
    </motion.div>
  );
}

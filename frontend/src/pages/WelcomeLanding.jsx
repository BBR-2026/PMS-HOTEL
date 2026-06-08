import { Instagram, Linkedin } from "lucide-react";

/**
 * Resolves the reservation entry URL depending on the environment.
 * - Preview (Emergent): https://reserve-bbr.preview.emergentagent.com/
 * - Production (custom domain): https://workflow-boulaybeachresort.com/
 * - Any other host (local dev, alt previews): falls back to the site root.
 */
const RESERVATION_URL = (() => {
  if (typeof window === "undefined") return "/";
  const host = window.location.hostname;
  if (host.includes("workflow-boulaybeachresort.com")) {
    return "https://workflow-boulaybeachresort.com/";
  }
  if (host.includes("preview.emergentagent.com") || host.includes("emergent")) {
    return "https://reserve-bbr.preview.emergentagent.com/";
  }
  return "/";
})();

/**
 * BBr splash landing — pixel-faithful reproduction of the marketing mockup.
 * Uses the official Optima font family (self-hosted, see CSS @font-face in
 * `index.css`) and the real BBr logo provided by the brand team.
 *
 * Mounted at `/welcome`. Standalone (no PublicLayout) so the visual is
 * truly full-bleed.
 */
export default function WelcomeLanding() {
  // Real BBr hero photo (pool with parasols) — same shot used to build the mockup.
  const HERO_URL =
    "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/pg0bwsje_BBR%20_SHOOT%202_139.jpg.jpeg";
  // Official BBr logo (white version) — transparent PNG with "BBr · BOULAY BEACH RESORT · HOTEL & BEACH LIFE"
  const LOGO_URL =
    "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/mfik5e1e_LOGO%20BBr.png";
  // Cream beige used for the footer bar + reserve pill — picked from the mockup.
  const CREAM = "#E5D9C0";
  const FOOTER_INK = "#3D2F1A";

  return (
    <div
      className="relative w-full min-h-screen bg-white flex flex-col font-optima"
      data-testid="welcome-landing"
    >
      {/* ===== HERO ===== */}
      <div className="relative flex-1 w-full overflow-hidden min-h-[88vh]">
        {/* Background photo — same framing as the mockup (pool + parasols
            slightly low so the upper third stays uncluttered for the logo). */}
        <img
          src={HERO_URL}
          alt="Boulay Beach Resort — Beach Club"
          className="absolute inset-0 w-full h-full object-cover object-[center_60%]"
        />
        {/* Very subtle dark overlay so the white type stays legible against the sky */}
        <div className="absolute inset-0 bg-black/10" />

        {/* === Top bar ===
            Three-column grid: spacer · centered logo · reserve pill on the right. */}
        <header className="absolute top-0 inset-x-0 grid grid-cols-3 items-start px-6 sm:px-10 md:px-14 pt-5 sm:pt-7 z-10">
          {/* Left spacer */}
          <div />
          {/* Logo centered */}
          <div className="flex justify-center">
            <img
              src={LOGO_URL}
              alt="BBr — Boulay Beach Resort"
              className="block w-auto"
              style={{
                height: "clamp(82px, 11vw, 160px)",
                filter: "drop-shadow(0 2px 14px rgba(0,0,0,0.18))",
              }}
              data-testid="welcome-logo"
            />
          </div>
          {/* "Réserver" pill top-right */}
          <div className="flex justify-end items-center pt-2">
            <a
              href={RESERVATION_URL}
              className="inline-flex items-center justify-center uppercase transition-opacity hover:opacity-90"
              style={{
                background: CREAM,
                color: FOOTER_INK,
                padding: "13px 30px",
                fontFamily: "'Optima','Optima Web',sans-serif",
                fontWeight: 700,
                fontSize: "clamp(11px, 0.95vw, 13px)",
                letterSpacing: "0.32em",
              }}
              data-testid="welcome-reserve-top"
            >
              Réserver
            </a>
          </div>
        </header>

        {/* === Text block — bottom-left === */}
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 md:px-16 lg:px-20 pb-12 sm:pb-16 md:pb-20 z-10 text-white">
          <h1
            className="leading-[0.92] tracking-[-0.02em] uppercase"
            style={{
              fontFamily: "'Optima','Optima Web',serif",
              fontWeight: 900,
              fontSize: "clamp(56px, 11vw, 180px)",
              textShadow: "0 6px 28px rgba(0,0,0,0.20)",
            }}
            data-testid="welcome-title"
          >
            LIFE IS HERE
          </h1>

          <div
            className="mt-8 sm:mt-12 md:mt-14 space-y-2.5 sm:space-y-3 max-w-2xl"
            style={{
              fontFamily: "'Optima','Optima Web',sans-serif",
              fontWeight: 400,
            }}
          >
            <p
              className="leading-snug"
              style={{
                fontSize: "clamp(16px, 1.6vw, 23px)",
                textShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              Une île privée, à quelques minutes d&apos;Abidjan.
            </p>
            <p
              className="leading-snug"
              style={{
                fontSize: "clamp(16px, 1.6vw, 23px)",
                textShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              Un autre rythme. Une autre énergie.
            </p>
            <p
              className="leading-snug"
              style={{
                fontSize: "clamp(16px, 1.6vw, 23px)",
                textShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              Des expériences premium inoubliables.
            </p>
          </div>

          {/* Lower CTA — slimmer, thicker outline, Optima bold */}
          <a
            href={RESERVATION_URL}
            className="inline-flex items-center justify-center mt-10 sm:mt-14 uppercase transition-all hover:bg-white hover:text-[#3D2F1A]"
            style={{
              border: "1.5px solid rgba(255,255,255,0.95)",
              padding: "18px 48px",
              fontFamily: "'Optima','Optima Web',sans-serif",
              fontWeight: 700,
              fontSize: "clamp(12px, 1.05vw, 15px)",
              letterSpacing: "0.34em",
              color: "#FFFFFF",
              minWidth: "230px",
              backdropFilter: "blur(1px)",
            }}
            data-testid="welcome-reserve-cta"
          >
            Réserver
          </a>
        </div>
      </div>

      {/* ===== FOOTER BAR (cream beige) ===== */}
      <footer
        className="w-full"
        style={{
          background: CREAM,
          color: FOOTER_INK,
          fontFamily: "'Optima','Optima Web',sans-serif",
        }}
        data-testid="welcome-footer"
      >
        <div className="px-4 sm:px-8 md:px-14 py-3.5 sm:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-3 text-[0.74rem] sm:text-[0.8rem]">
          {/* Left — legal links */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a href="#cgv" className="hover:underline" data-testid="footer-cgv">
              Conditions générales de vente
            </a>
            <span className="opacity-50 hidden sm:inline">|</span>
            <a href="#legal" className="hover:underline" data-testid="footer-legal">
              Mentions légales
            </a>
          </div>

          {/* Center — contact (email + phones in BOLD) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href="mailto:reservations@boulaybeachresort.com"
              className="hover:underline font-bold"
              data-testid="footer-email"
            >
              reservations@boulaybeachresort.com
            </a>
            <a
              href="tel:+22507046000600"
              className="hover:underline whitespace-nowrap font-bold"
              data-testid="footer-phone-1"
            >
              (+225) 07 04 600 600
            </a>
            <a
              href="tel:+22507174000400"
              className="hover:underline whitespace-nowrap font-bold"
              data-testid="footer-phone-2"
            >
              (+225) 07 17 400 400
            </a>
          </div>

          {/* Right — socials + handle (Boulay Beach Resort in BOLD) */}
          <div className="flex items-center gap-2.5">
            <a
              href="https://instagram.com/boulaybeachresort"
              target="_blank"
              rel="noopener noreferrer"
              className="w-6 h-6 rounded-full border border-current flex items-center justify-center hover:bg-current hover:text-white transition-colors"
              aria-label="Instagram"
              data-testid="footer-instagram"
            >
              <Instagram size={11} />
            </a>
            <a
              href="https://linkedin.com/company/boulay-beach-resort"
              target="_blank"
              rel="noopener noreferrer"
              className="w-6 h-6 rounded-full border border-current flex items-center justify-center hover:bg-current hover:text-white transition-colors"
              aria-label="LinkedIn"
              data-testid="footer-linkedin"
            >
              <Linkedin size={11} />
            </a>
            <span className="ml-1 font-bold" data-testid="footer-handle">
              Boulay Beach Resort
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

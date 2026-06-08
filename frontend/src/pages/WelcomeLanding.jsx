import { Link } from "react-router-dom";
import { Instagram, Linkedin } from "lucide-react";

/**
 * Minimalist splash landing page — pixel-faithful reproduction of the
 * marketing mockup. Shows the BBr Beach Club hero photo as a full-bleed
 * background with the BBr monogram top-center, a "RÉSERVER" pill top-right,
 * the "LIFE IS HERE" title block + tagline + lower CTA, and a cream footer
 * bar with legal links, contact email, phone numbers and Instagram.
 *
 * The whole page links into the existing booking flow ("/"). It is mounted
 * at `/welcome` so it can be A/B tested or used as a stand-alone splash
 * without replacing the rich landing page used by the rest of the app.
 */
export default function WelcomeLanding() {
  // BBR hero photo provided by the user (pool with white parasols and
  // wooden cabanas). The same shot was used to build the original mockup.
  const HERO_URL =
    "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/pg0bwsje_BBR%20_SHOOT%202_139.jpg.jpeg";
  // Cream beige used for the footer bar + reserve pill — picked from the mockup.
  const CREAM = "#E5D9C0";

  return (
    <div className="relative w-full min-h-screen bg-white flex flex-col" data-testid="welcome-landing">
      {/* ===== HERO ===== */}
      <div className="relative flex-1 w-full overflow-hidden">
        <img
          src={HERO_URL}
          alt="Boulay Beach Resort — Beach Club"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Subtle dark overlay so the white type stays legible against the sky */}
        <div className="absolute inset-0 bg-black/15" />

        {/* === Top bar === */}
        <header className="absolute top-0 inset-x-0 flex items-start justify-between px-6 sm:px-10 md:px-14 pt-6 sm:pt-8 z-10">
          {/* Left spacer to balance the monogram visually centered */}
          <div className="w-[110px] sm:w-[130px] md:w-[150px]" />
          {/* Monogram centered */}
          <div className="flex flex-col items-center text-white">
            <div
              className="font-display-serif leading-none tracking-tight"
              style={{
                fontSize: "clamp(38px, 6vw, 76px)",
                fontWeight: 300,
                letterSpacing: "-0.02em",
              }}
              data-testid="welcome-monogram"
            >
              BBr
            </div>
            <div
              className="text-white/90 mt-1 sm:mt-2"
              style={{
                fontSize: "clamp(7px, 0.7vw, 10px)",
                letterSpacing: "0.32em",
                fontWeight: 400,
              }}
            >
              BOULAY BEACH RESORT
            </div>
            <div
              className="text-white/65 mt-0.5"
              style={{
                fontSize: "clamp(6px, 0.55vw, 8px)",
                letterSpacing: "0.28em",
              }}
            >
              HÔTEL &amp; BEACH CLUB
            </div>
          </div>
          {/* "Réserver" pill top-right */}
          <Link
            to="/"
            className="inline-flex items-center justify-center text-[0.7rem] sm:text-xs tracking-[0.32em] uppercase transition-opacity hover:opacity-85"
            style={{
              background: CREAM,
              color: "#5C4A2E",
              padding: "12px 22px",
              fontWeight: 500,
              letterSpacing: "0.3em",
              minWidth: "110px",
            }}
            data-testid="welcome-reserve-top"
          >
            Réserver
          </Link>
        </header>

        {/* === Text block — bottom-left ===
            Lifted from the mockup: huge "LIFE IS HERE" title, 3 tagline lines,
            and a slim outlined "RÉSERVER" button. All over the photo. */}
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 md:px-16 lg:px-20 pb-10 sm:pb-14 md:pb-16 z-10 text-white">
          <h1
            className="font-display-serif font-bold leading-[0.95] tracking-tight max-w-[90%] sm:max-w-none"
            style={{
              fontSize: "clamp(48px, 9.5vw, 160px)",
              letterSpacing: "-0.01em",
              textShadow: "0 4px 20px rgba(0,0,0,0.18)",
            }}
            data-testid="welcome-title"
          >
            LIFE IS HERE
          </h1>

          <div className="mt-8 sm:mt-12 md:mt-16 space-y-3 sm:space-y-4 max-w-xl">
            <p
              className="leading-tight"
              style={{
                fontSize: "clamp(15px, 1.5vw, 22px)",
                fontWeight: 300,
                textShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              Une île privée, à quelques minutes d&apos;Abidjan.
            </p>
            <p
              className="leading-tight"
              style={{
                fontSize: "clamp(15px, 1.5vw, 22px)",
                fontWeight: 300,
                textShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              Un autre rythme. Une autre énergie.
            </p>
            <p
              className="leading-tight"
              style={{
                fontSize: "clamp(15px, 1.5vw, 22px)",
                fontWeight: 300,
                textShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              Des expériences premium inoubliables.
            </p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center justify-center mt-10 sm:mt-12 border border-white/90 text-white uppercase transition-all hover:bg-white/10 backdrop-blur-[2px]"
            style={{
              padding: "16px 38px",
              fontSize: "clamp(11px, 1vw, 14px)",
              letterSpacing: "0.32em",
              fontWeight: 400,
              minWidth: "200px",
            }}
            data-testid="welcome-reserve-cta"
          >
            Réserver
          </Link>
        </div>
      </div>

      {/* ===== FOOTER BAR (cream beige) ===== */}
      <footer
        className="w-full"
        style={{ background: CREAM, color: "#3D2F1A" }}
        data-testid="welcome-footer"
      >
        <div className="px-4 sm:px-8 md:px-14 py-3 sm:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-3 text-[0.72rem] sm:text-[0.78rem]">
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

          {/* Center — contact */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href="mailto:reservations@boulaybeachresort.com"
              className="hover:underline"
              data-testid="footer-email"
            >
              reservations@boulaybeachresort.com
            </a>
            <a
              href="tel:+22507046000600"
              className="hover:underline whitespace-nowrap"
              data-testid="footer-phone-1"
            >
              (+225) 07 04 600 600
            </a>
            <a
              href="tel:+22507174000400"
              className="hover:underline whitespace-nowrap"
              data-testid="footer-phone-2"
            >
              (+225) 07 17 400 400
            </a>
          </div>

          {/* Right — socials */}
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
            <span className="ml-1 font-medium" data-testid="footer-handle">
              Boulaybeachresort
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

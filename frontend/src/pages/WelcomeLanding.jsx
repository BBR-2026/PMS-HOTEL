import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Instagram, Linkedin, Phone, Mail, ArrowRight, ChevronDown } from "lucide-react";
import api from "../lib/api";

/**
 * WelcomeLanding — Premium splash page for `/welcome`.
 *
 * Design constraints (must match the rest of the BBR site):
 *  - Color palette: #0A0A0A (charcoal), #B8922A (gold), #FAFAF7 / #F8F1DC (cream), white
 *  - Typography: `font-display-serif` (Optima) for headlines, sans for body
 *  - Wide tracking on caps labels (`tracking-[0.28em]`)
 *  - Subtle gold dividers, no harsh gradients
 *  - Framer-motion fade-up on scroll with cubic-bezier ease
 *
 * Routing :
 *  - Two "Réserver" CTAs point to either the preview or production reservation
 *    site root depending on the current hostname.
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

// Stable, free-licensed Pexels CDN clip — aerial tropical lagoon loop, ~10s.
// Staff can swap this URL later by editing this constant if they upload their
// own corporate B-roll to the Emergent assets bucket.
const HERO_VIDEO_URL =
  "https://videos.pexels.com/video-files/1448735/1448735-hd_1920_1080_25fps.mp4";
const HERO_POSTER_URL =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/g5p3da0v_BBR%20_SHOOT%202_140.jpg";
const BBR_LOGO_WHITE =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/5jjvd8zn_LOGO_BBr_VF_Plan_de_travail_1-removebg-preview.png";

const POLE_PREVIEW_IMAGES = {
  beach_club:
    "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/trz2j0jd_BEACH%20CLUB.png",
  hebergement:
    "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/7bcipz8w_HEBERGEMENT.png",
  corporate:
    "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/z5tyysqq_IMAGES%20BOOKING%20BBr%20WORKFLOW-07.png",
  activites_events:
    "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/ocqva33h_ACTIVITE.png",
  le_kaai:
    "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/v2f73qqm_KAAI.png",
};

const EASE = [0.22, 1, 0.36, 1];

function Hero() {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  // Subtle parallax on the title block as the user scrolls down
  const titleY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);

  // Autoplay is blocked by some browsers when not muted; we set both attrs
  // imperatively to maximize success rate.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.playsInline = true;
    const tryPlay = () => v.play().catch(() => {});
    tryPlay();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden bg-[#0A0A0A]"
      data-testid="welcome-hero"
    >
      {/* Background video */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-90"
        src={HERO_VIDEO_URL}
        poster={HERO_POSTER_URL}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        data-testid="welcome-hero-video"
      />
      {/* Cinematic dark scrim */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/35 via-[#0A0A0A]/35 to-[#0A0A0A]/85" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/60 via-transparent to-transparent" />
      {/* Subtle grain */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Top bar — logo + Reserver */}
      <div className="absolute top-0 left-0 right-0 z-20 px-6 md:px-12 lg:px-20 pt-7 md:pt-9 flex items-center justify-between">
        <img
          src={BBR_LOGO_WHITE}
          alt="Boulay Beach Resort"
          className="h-12 sm:h-14 md:h-16 w-auto opacity-95"
          data-testid="welcome-logo"
        />
        <a
          href={RESERVATION_URL}
          className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 border border-white/35 text-white text-[0.65rem] uppercase tracking-[0.28em] backdrop-blur-sm bg-white/5 hover:bg-white hover:text-[#0A0A0A] transition-all duration-500"
          data-testid="welcome-reserve-top"
        >
          Réserver <ArrowRight size={12} />
        </a>
      </div>

      {/* Center stage */}
      <motion.div
        style={{ y: titleY, opacity: titleOpacity }}
        className="relative z-10 h-full flex flex-col justify-center items-center px-6 md:px-12 text-center text-white"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.3 }}
          className="text-[0.65rem] sm:text-xs uppercase tracking-[0.42em] text-[#E5D9C0] mb-7"
          data-testid="welcome-eyebrow"
        >
          Île privée · Abidjan · Côte d&apos;Ivoire
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.5 }}
          className="font-display-serif tracking-tight leading-[0.95] text-[clamp(3rem,9vw,8rem)]"
          data-testid="welcome-title"
        >
          Life is here.
        </motion.h1>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.1, ease: EASE, delay: 1.1 }}
          className="origin-center w-20 h-px bg-[#E5D9C0] mt-10 mb-10"
        />
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: EASE, delay: 1.0 }}
          className="max-w-xl text-sm sm:text-base text-white/85 leading-relaxed font-light"
          data-testid="welcome-baseline"
        >
          Une île privée à dix minutes d&apos;Abidjan,<br className="hidden sm:block" />
          accessible uniquement par bateau, où le temps se suspend.
        </motion.p>
        <motion.a
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, ease: EASE, delay: 1.4 }}
          href={RESERVATION_URL}
          className="mt-12 inline-flex items-center gap-3 px-9 py-4 border border-white text-white text-[0.7rem] uppercase tracking-[0.32em] hover:bg-white hover:text-[#0A0A0A] transition-all duration-500"
          data-testid="welcome-reserve-cta"
        >
          Réserver votre escapade <ArrowRight size={13} />
        </motion.a>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-white/65"
        data-testid="welcome-scroll-indicator"
      >
        <span className="text-[0.55rem] uppercase tracking-[0.42em]">Découvrir</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown size={16} strokeWidth={1.4} />
        </motion.div>
      </motion.div>
    </section>
  );
}

function IslandIntro() {
  return (
    <section className="bg-[#FAFAF7] py-24 md:py-36 px-6 md:px-12 lg:px-24" data-testid="welcome-island">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.9, ease: EASE }}
          className="lg:col-span-5"
        >
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-4">
            L&apos;île de Boulay
          </div>
          <h2 className="font-display-serif text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight leading-[1.05] mb-7">
            Un sanctuaire<br />à quelques nœuds de la ville.
          </h2>
          <div className="w-12 h-px bg-[#B8922A] mb-7" />
          <p className="text-base text-[#0A0A0A]/70 leading-[1.85] mb-5">
            Boulay Beach Resort est une île privée et confidentielle, posée
            sur la lagune Ébrié. On y accède en quelques minutes de bateau
            depuis Abidjan, et l&apos;on en repart toujours différent.
          </p>
          <p className="text-base text-[#0A0A0A]/70 leading-[1.85]">
            Cinq univers, une même promesse : l&apos;art de la déconnexion,
            cultivé avec exigence, pensé dans le moindre détail.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 1.0, ease: EASE, delay: 0.15 }}
          className="lg:col-span-7 relative"
        >
          <div className="relative aspect-[4/5] sm:aspect-[5/4] overflow-hidden bg-[#0A0A0A]/5">
            <img
              src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/g5p3da0v_BBR%20_SHOOT%202_140.jpg"
              alt="Vue aérienne du resort"
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-[#B8922A]/15" />
          </div>
          {/* Decorative caption block */}
          <div className="hidden md:block absolute -bottom-8 -left-8 bg-[#0A0A0A] text-white px-7 py-5 max-w-[16rem] shadow-[0_18px_40px_-18px_rgba(10,10,10,0.55)]">
            <div className="text-[0.55rem] uppercase tracking-[0.32em] text-[#E5D9C0] mb-1.5">
              10 minutes
            </div>
            <div className="font-display-serif text-lg leading-snug">
              du centre-ville,<br />à mille milles de l&apos;agitation.
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FivePolesPreview({ poles }) {
  // Hide-list fallback if API hasn't loaded yet — render placeholder cards so
  // the section never appears empty.
  const items = (poles && poles.length > 0)
    ? poles
    : Object.keys(POLE_PREVIEW_IMAGES).map((id) => ({
        id,
        name_fr: ({
          beach_club: "Beach Club",
          hebergement: "Hébergement",
          corporate: "Corporate",
          activites_events: "Activités & Événements",
          le_kaai: "Le Kaaï",
        })[id],
      }));

  return (
    <section
      className="bg-white py-24 md:py-32 px-6 md:px-12 lg:px-24"
      data-testid="welcome-poles"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-14 md:mb-18">
          <div className="max-w-2xl">
            <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-4">
              Nos univers
            </div>
            <h2 className="font-display-serif text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight leading-[1.05]">
              Cinq univers,<br />une seule île.
            </h2>
          </div>
          <a
            href={RESERVATION_URL}
            className="hidden md:inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.28em] text-[#0A0A0A] hover:text-[#B8922A] transition-colors"
            data-testid="welcome-poles-cta"
          >
            Voir toutes les offres <ArrowRight size={13} />
          </a>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-5">
          {items.slice(0, 5).map((p, i) => (
            <motion.a
              key={p.id}
              href={RESERVATION_URL}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
              className="group relative aspect-[3/4] overflow-hidden bg-[#FAFAF7]"
              data-testid={`welcome-pole-${p.id}`}
            >
              <img
                src={POLE_PREVIEW_IMAGES[p.id]}
                alt={p.name_fr}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.06]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/85 via-[#0A0A0A]/15 to-transparent" />
              <div className="absolute inset-x-3 bottom-3 md:inset-x-5 md:bottom-5">
                <div className="text-[0.5rem] md:text-[0.55rem] uppercase tracking-[0.3em] text-[#E5D9C0] mb-1.5 opacity-90">
                  Pôle
                </div>
                <div className="font-display-serif text-white text-lg md:text-xl lg:text-2xl leading-tight tracking-tight">
                  {p.name_fr}
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 text-[0.55rem] md:text-[0.6rem] uppercase tracking-[0.28em] text-[#E5D9C0] opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  Découvrir <ArrowRight size={10} />
                </div>
              </div>
              <div className="absolute inset-0 ring-1 ring-inset ring-white/0 group-hover:ring-[#B8922A]/45 transition-all duration-700" />
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section className="bg-[#0A0A0A] text-white py-28 md:py-40 px-6 md:px-12 lg:px-24 relative overflow-hidden" data-testid="welcome-manifesto">
      {/* Decorative concentric circles in cream */}
      <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full border border-[#E5D9C0]/8" />
      <div className="absolute -bottom-40 -left-40 w-[34rem] h-[34rem] rounded-full border border-[#E5D9C0]/6" />
      <motion.blockquote
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1.1, ease: EASE }}
        className="relative max-w-4xl mx-auto text-center"
      >
        <div className="text-[0.62rem] uppercase tracking-[0.42em] text-[#B8922A] mb-7">
          Notre signature
        </div>
        <p className="font-display-serif italic text-3xl md:text-4xl lg:text-5xl leading-[1.25] text-white/95 tracking-tight">
          &ldquo;Une île à soi. Le luxe d&apos;une parenthèse, l&apos;élégance d&apos;une attention,<br className="hidden md:block" />
          la promesse d&apos;un retour.&rdquo;
        </p>
        <div className="mt-10 inline-flex items-center gap-3 text-[0.6rem] uppercase tracking-[0.42em] text-[#E5D9C0]/85">
          <span className="w-8 h-px bg-[#E5D9C0]/60" /> BBr — Life is here <span className="w-8 h-px bg-[#E5D9C0]/60" />
        </div>
      </motion.blockquote>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-[#F8F1DC] py-24 md:py-32 px-6 md:px-12 lg:px-24" data-testid="welcome-final-cta">
      <div className="max-w-5xl mx-auto text-center">
        <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#0A0A0A]/55 mb-5">
          Prêt à embarquer ?
        </div>
        <h2 className="font-display-serif text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight leading-[1.05] mb-10">
          Le bateau vous attend.
        </h2>
        <a
          href={RESERVATION_URL}
          className="inline-flex items-center gap-3 bg-[#0A0A0A] text-white px-10 py-4 text-[0.7rem] uppercase tracking-[0.32em] hover:bg-[#B8922A] transition-colors duration-500"
          data-testid="welcome-final-cta-btn"
        >
          Réserver maintenant <ArrowRight size={13} />
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0A0A0A] text-[#E5D9C0] py-16 md:py-20 px-6 md:px-12 lg:px-24" data-testid="welcome-footer">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
        <div>
          <img
            src={BBR_LOGO_WHITE}
            alt="Boulay Beach Resort"
            className="h-14 w-auto mb-5 opacity-95"
          />
          <p className="text-[0.78rem] leading-relaxed text-[#E5D9C0]/65 max-w-xs">
            Boulay Beach Resort — île privée d&apos;Abidjan,
            accessible uniquement par bateau.
          </p>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.32em] text-[#B8922A] mb-4">
            Contact
          </div>
          <div className="space-y-2 text-[0.85rem]">
            <a href="tel:+22507174000400" className="flex items-center gap-2 hover:text-white transition-colors" data-testid="footer-phone-1">
              <Phone size={11} /> <span className="font-bold">+225 07 17 400 400</span>
            </a>
            <a href="tel:+22507046000600" className="flex items-center gap-2 hover:text-white transition-colors" data-testid="footer-phone-2">
              <Phone size={11} /> <span className="font-bold">+225 07 04 600 600</span>
            </a>
            <a href="mailto:hello@boulaybeachresort.com" className="flex items-center gap-2 hover:text-white transition-colors" data-testid="footer-email">
              <Mail size={11} /> <span className="font-bold">hello@boulaybeachresort.com</span>
            </a>
          </div>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.32em] text-[#B8922A] mb-4">
            Suivez-nous
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://instagram.com/boulaybeachresort"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full border border-[#E5D9C0]/30 flex items-center justify-center hover:bg-[#E5D9C0] hover:text-[#0A0A0A] transition-colors"
              aria-label="Instagram"
              data-testid="footer-instagram"
            >
              <Instagram size={14} />
            </a>
            <a
              href="https://linkedin.com/company/boulay-beach-resort"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full border border-[#E5D9C0]/30 flex items-center justify-center hover:bg-[#E5D9C0] hover:text-[#0A0A0A] transition-colors"
              aria-label="LinkedIn"
              data-testid="footer-linkedin"
            >
              <Linkedin size={14} />
            </a>
            <span className="ml-2 text-[0.78rem] text-[#E5D9C0]/85 font-medium">@BoulayBeachResort</span>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-14 pt-7 border-t border-[#E5D9C0]/12 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[0.66rem] uppercase tracking-[0.22em] text-[#E5D9C0]/55">
        <span>© {new Date().getFullYear()} Boulay Beach Resort. Tous droits réservés.</span>
        <div className="flex gap-5">
          <a href="#" className="hover:text-white">Mentions légales</a>
          <a href="#" className="hover:text-white">CGV</a>
        </div>
      </div>
    </footer>
  );
}

export default function WelcomeLanding() {
  const [poles, setPoles] = useState([]);

  useEffect(() => {
    api.get("/poles").then((r) => setPoles(r.data || [])).catch(() => {});
  }, []);

  // Body styling lock — make sure no global PublicLayout chrome leaks in
  useEffect(() => {
    document.body.classList.add("welcome-landing-body");
    return () => document.body.classList.remove("welcome-landing-body");
  }, []);

  return (
    <div data-testid="welcome-landing" className="bg-white text-[#0A0A0A]">
      <Hero />
      <IslandIntro />
      <FivePolesPreview poles={poles} />
      <Manifesto />
      <FinalCTA />
      <Footer />
    </div>
  );
}

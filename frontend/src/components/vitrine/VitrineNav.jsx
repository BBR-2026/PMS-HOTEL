/**
 * Vitrine — Premium header (iteration 56 — luxury hotel layout).
 *
 * Layout
 * ------
 * Desktop (≥ 1024px) :
 *   LEFT   : BBR logo (compact, ~h-14)
 *   CENTER : horizontal inline nav (Hôtel · Beach Club · Le Kaai · Corporate ·
 *            Activités · Memberships · Boutique · Contact)
 *   RIGHT  : RÉSERVER button (gold)
 *
 * Mobile (< 1024px) :
 *   LEFT   : Hamburger
 *   CENTER : BBR logo (compact)
 *   RIGHT  : RÉSERVER button (gold)
 *   + Fullscreen overlay menu (unchanged)
 *
 * Behaviour : transparent on hero (landing), white + gold-tinted logo on
 * scroll. The logo NEVER appears in pure black.
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

// Inline horizontal nav items (desktop only).
const INLINE_ITEMS = [
  { to: "/univers/hebergement", label: "Hôtel" },
  { to: "/univers/beach-club", label: "Beach Club" },
  { to: "/le-kaai", label: "Le Kaai" },
  { to: "/univers/corporate", label: "Corporate" },
  { to: "/univers/activites", label: "Activités" },
  { to: "/memberships", label: "Memberships" },
  { to: "/boutique", label: "Boutique" },
  { to: "/blog", label: "Journal" },
  { to: "/contact", label: "Contact" },
];

// Fullscreen menu (mobile + extra discovery on desktop via hamburger if needed).
const FULL_MENU_ITEMS = [
  { to: "/", label: "Accueil" },
  { to: "/univers/hebergement", label: "Hôtel" },
  { to: "/univers/beach-club", label: "Beach Club" },
  { to: "/le-kaai", label: "Restaurant Le Kaai" },
  { to: "/univers/evenementiel", label: "Événements" },
  { to: "/univers/corporate", label: "Corporate" },
  { to: "/univers/activites", label: "Activités" },
  { to: "/notre-histoire", label: "Notre histoire" },
  { to: "/memberships", label: "Memberships" },
  { to: "/boutique", label: "Boutique" },
  { to: "/blog", label: "Journal" },
  { to: "/contact", label: "Contact" },
  { to: "/reserver", label: "Réserver", highlight: true },
];

export default function VitrineNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [loc.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const onHero = loc.pathname === "/" && !scrolled && !menuOpen;
  const textColor = onHero ? "text-white" : "text-[#0A0A0A]";
  const linkColor = onHero
    ? "text-white/85 hover:text-[#D4B256]"
    : "text-[#0A0A0A]/80 hover:text-[#B8922A]";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled || menuOpen
            ? "bg-white/95 backdrop-blur-md border-b border-[#0A0A0A]/8"
            : "bg-transparent"
        }`}
        data-testid="vitrine-nav"
        style={{ position: "fixed" }}
      >
        <div className="max-w-[1800px] mx-auto px-6 md:px-10 lg:px-12 h-24 md:h-28 lg:h-32 flex items-center gap-6">
          {/* MOBILE hamburger (only < lg) */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`lg:hidden p-2 -ml-2 transition-colors ${textColor}`}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            data-testid="vitrine-hamburger"
          >
            {menuOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
          </button>

          {/* LOGO — perfectly centered on mobile (absolute) ; left-aligned on desktop */}
          <Link
            to="/"
            className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 lg:left-auto flex items-center"
            data-testid="vitrine-logo"
            aria-label="Boulay Beach Resort — Accueil"
          >
            <img
              src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/lhn37du4_LOGO%20BBr.png"
              alt="BBR — Boulay Beach Resort"
              className={`h-20 md:h-24 lg:h-28 w-auto transition-all duration-500 ${
                onHero ? "brightness-0 invert" : "logo-gold"
              }`}
            />
          </Link>

          {/* DESKTOP horizontal inline nav (≥ lg only) — flex-1 takes remaining space */}
          <nav className="hidden lg:flex flex-1 items-center justify-center gap-4 xl:gap-6"
               data-testid="vitrine-inline-nav">
            {INLINE_ITEMS.map((item) => {
              const active = loc.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative text-[0.7rem] xl:text-[0.75rem] tracking-[0.22em] uppercase font-medium transition-colors ${linkColor} ${
                    active ? "text-[#B8922A] hover:text-[#B8922A]" : ""
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\W+/g, "-")}`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute -bottom-1.5 left-0 right-0 h-px bg-[#B8922A]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Spacer for mobile to balance the centered logo */}
          <div className="flex-1 lg:hidden" />

          {/* RÉSERVER button — gold (right). On the landing it smoothly scrolls
              to the #univers section (so guest can pick the offer first).
              Anywhere else, it navigates to /reserver (which shows the Vitrine). */}
          <div className="flex items-center justify-end ml-auto lg:ml-0">
            {loc.pathname === "/" ? (
              <a
                href="#univers"
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById("univers");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`inline-flex items-center px-4 md:px-5 lg:px-6 py-2 md:py-2.5 text-[0.62rem] md:text-[0.7rem] tracking-[0.3em] uppercase font-medium transition-all duration-300 border ${
                  onHero
                    ? "text-white border-white hover:bg-[#B8922A] hover:border-[#B8922A]"
                    : "text-white bg-[#B8922A] border-[#B8922A] hover:bg-[#D4AF37] hover:border-[#D4AF37]"
                }`}
                data-testid="vitrine-cta-reserver"
              >
                Réserver
              </a>
            ) : (
              <Link
                to="/#univers"
                className={`inline-flex items-center px-4 md:px-5 lg:px-6 py-2 md:py-2.5 text-[0.62rem] md:text-[0.7rem] tracking-[0.3em] uppercase font-medium transition-all duration-300 border ${
                  onHero
                    ? "text-white border-white hover:bg-[#B8922A] hover:border-[#B8922A]"
                    : "text-white bg-[#B8922A] border-[#B8922A] hover:bg-[#D4AF37] hover:border-[#D4AF37]"
                }`}
                data-testid="vitrine-cta-reserver"
              >
                Réserver
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* FULLSCREEN MENU OVERLAY (mobile-first, also reachable on desktop) */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-700 ease-out ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        data-testid="vitrine-fullscreen-menu"
      >
        <div className="absolute inset-0 bg-white">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.08]"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=2000&q=85)",
            }}
          />
        </div>

        <div className="relative h-full flex items-center justify-center pt-20 px-6">
          <nav className="w-full max-w-2xl">
            <ul className="space-y-2 md:space-y-3">
              {FULL_MENU_ITEMS.map((item, idx) => (
                <li
                  key={item.to}
                  className={`transition-all duration-700 ${
                    menuOpen
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-6"
                  }`}
                  style={{ transitionDelay: menuOpen ? `${100 + idx * 50}ms` : "0ms" }}
                >
                  <Link
                    to={item.to}
                    className={`group flex items-baseline justify-between border-b border-[#0A0A0A]/10 py-3 md:py-4 transition-colors ${
                      item.highlight ? "text-[#B8922A] hover:text-[#0A0A0A]" : "text-[#0A0A0A] hover:text-[#B8922A]"
                    }`}
                    data-testid={`menu-${item.label.toLowerCase().replace(/\W+/g, "-")}`}
                  >
                    <span className="font-serif text-2xl md:text-4xl leading-tight">
                      {item.label}
                    </span>
                    <span className="text-[0.6rem] tracking-[0.4em] uppercase opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-10 text-center text-[0.55rem] tracking-[0.55em] uppercase text-[#0A0A0A]/45">
              Île Boulay  ·  Abidjan
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}

/**
 * Vitrine — Minimal editorial navigation (Nikki Beach inspired).
 *
 * - Transparent over hero, switches to white on scroll.
 * - Centered logo · left/right links · subtle "Réserver" link.
 * - Mobile : hamburger → fullscreen drawer.
 */
import { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

const LINKS_LEFT = [
  { to: "/univers/hebergement", label: "Hébergement" },
  { to: "/univers/beach-club", label: "Beach Club" },
  { to: "/univers/activites", label: "Activités" },
];
const LINKS_RIGHT = [
  { to: "/univers/evenementiel", label: "Événementiel" },
  { to: "/univers/corporate", label: "Corporate" },
  { to: "/le-kaai", label: "Le Kaai" },
];

export default function VitrineNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  const onHero = loc.pathname === "/" && !scrolled;
  const textColor = onHero ? "text-white" : "text-[#0A0A0A]";
  const subColor = onHero ? "text-white/85 hover:text-white" : "text-[#0A0A0A]/70 hover:text-[#B8922A]";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-[#0A0A0A]/8 py-4"
          : "bg-transparent py-6"
      }`}
      data-testid="vitrine-nav"
    >
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-3 items-center">
        {/* Left links */}
        <nav className="hidden lg:flex items-center gap-7 justify-start">
          {LINKS_LEFT.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-[0.68rem] tracking-[0.28em] uppercase transition-colors ${
                  isActive ? (onHero ? "text-white" : "text-[#B8922A]") : subColor
                }`
              }
              data-testid={`vitrine-nav-${l.label.toLowerCase().replace(/\W/g, "-")}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Center logo */}
        <Link
          to="/"
          className="flex flex-col items-center justify-center"
          data-testid="vitrine-logo"
        >
          <span className={`font-serif italic text-2xl md:text-3xl tracking-wide font-light ${textColor}`}>
            BBR
          </span>
          <span className={`text-[0.55rem] tracking-[0.5em] uppercase mt-1 ${onHero ? "text-white/70" : "text-[#0A0A0A]/55"}`}>
            Boulay Beach Resort
          </span>
        </Link>

        {/* Right links + reserver */}
        <nav className="hidden lg:flex items-center gap-7 justify-end">
          {LINKS_RIGHT.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-[0.68rem] tracking-[0.28em] uppercase transition-colors ${
                  isActive ? (onHero ? "text-white" : "text-[#B8922A]") : subColor
                }`
              }
              data-testid={`vitrine-nav-${l.label.toLowerCase().replace(/\W/g, "-")}`}
            >
              {l.label}
            </NavLink>
          ))}
          <Link
            to="/reserver"
            className={`text-[0.68rem] tracking-[0.28em] uppercase border-b pb-0.5 transition-colors ${
              onHero
                ? "text-white border-white/80 hover:text-[#D4B256] hover:border-[#D4B256]"
                : "text-[#0A0A0A] border-[#0A0A0A] hover:text-[#B8922A] hover:border-[#B8922A]"
            }`}
            data-testid="vitrine-cta-reserver"
          >
            Réserver
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className={`lg:hidden p-2 col-start-3 justify-self-end ${textColor}`}
          aria-label="Menu"
          data-testid="vitrine-mobile-toggle"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 top-[60px] bg-white z-40">
          <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col gap-1">
            {[...LINKS_LEFT, ...LINKS_RIGHT].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="py-4 font-serif italic text-2xl text-[#0A0A0A] border-b border-[#0A0A0A]/8"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/reserver"
              className="mt-8 py-4 text-center text-[0.7rem] tracking-[0.3em] uppercase text-white bg-[#0A0A0A]"
            >
              Réserver
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

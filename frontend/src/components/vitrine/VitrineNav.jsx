/**
 * Vitrine — Navigation top bar (transparent over hero, solid on scroll).
 */
import { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

const LINKS = [
  { to: "/univers/hebergement", label: "Hébergement" },
  { to: "/univers/beach-club", label: "Beach Club" },
  { to: "/univers/activites", label: "Activités" },
  { to: "/univers/evenementiel", label: "Événementiel" },
  { to: "/univers/corporate", label: "Corporate" },
  { to: "/le-kaai", label: "Le Kaai" },
];

export default function VitrineNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  const onHero = loc.pathname === "/" && !scrolled;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#B8922A]/20 py-3"
          : "bg-transparent py-5"
      }`}
      data-testid="vitrine-nav"
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3" data-testid="vitrine-logo">
          <span
            className={`text-[0.65rem] tracking-[0.4em] font-bold ${
              onHero ? "text-white" : "text-[#D4B256]"
            }`}
          >
            BOULAY · BEACH · RESORT
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-[0.75rem] tracking-[0.18em] uppercase transition-colors ${
                  isActive
                    ? "text-[#B8922A]"
                    : onHero
                    ? "text-white/85 hover:text-white"
                    : "text-white/75 hover:text-[#D4B256]"
                }`
              }
              data-testid={`vitrine-nav-${l.label.toLowerCase().replace(/\W/g, "-")}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/reserver"
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-[#B8922A] hover:bg-[#A07D1F] text-white text-[0.7rem] tracking-[0.2em] uppercase font-semibold transition-colors"
            data-testid="vitrine-cta-reserver"
          >
            Réserver
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="lg:hidden text-white p-2"
            data-testid="vitrine-mobile-toggle"
            aria-label="Menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden mt-3 bg-[#0A0A0A]/98 border-t border-[#B8922A]/20">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="py-3 text-[0.75rem] tracking-[0.18em] uppercase text-white/85 border-b border-white/5"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/reserver"
              className="mt-4 py-3 text-center bg-[#B8922A] text-white text-[0.75rem] tracking-[0.2em] uppercase font-semibold"
            >
              Réserver maintenant
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

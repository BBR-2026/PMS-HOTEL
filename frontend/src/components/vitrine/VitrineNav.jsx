/**
 * Vitrine — Premium header (refonte iteration 54).
 *
 * Structure:
 *  - Sticky, transparent on hero, slight opacity on scroll.
 *  - LEFT  : empty (logo perfectly centered).
 *  - CENTER: BBR logo (large, serif).
 *  - RIGHT : SHOP · RÉSERVER (button) · Hamburger.
 *  - Fullscreen overlay menu when hamburger is open.
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ShoppingBag } from "lucide-react";

const MENU_ITEMS = [
  { to: "/", label: "Accueil" },
  { to: "/univers/hebergement", label: "Hôtel" },
  { to: "/univers/beach-club", label: "Beach Club" },
  { to: "/le-kaai", label: "Restaurant Le Kaai" },
  { to: "/univers/evenementiel", label: "Événements" },
  { to: "/univers/corporate", label: "Corporate" },
  { to: "/boutique", label: "Boutique" },
  { to: "/contact", label: "Contact" },
  { to: "/reserver", label: "Réservation", highlight: true },
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

  // Lock body scroll when fullscreen menu is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const onHero = loc.pathname === "/" && !scrolled && !menuOpen;
  const textColor = onHero ? "text-white" : "text-[#0A0A0A]";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled || menuOpen
            ? "bg-white/95 backdrop-blur-md border-b border-[#0A0A0A]/8"
            : "bg-transparent"
        }`}
        data-testid="vitrine-nav"
      >
        <div className="max-w-[1800px] mx-auto px-6 md:px-10 lg:px-14 h-24 md:h-28 grid grid-cols-3 items-center">
          {/* LEFT : HAMBURGER */}
          <div className="flex items-center justify-start">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-2 -ml-2 transition-colors ${textColor}`}
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              data-testid="vitrine-hamburger"
            >
              {menuOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
            </button>
          </div>

          {/* CENTER : LOGO (1.5× bigger) */}
          <Link
            to="/"
            className="flex items-center justify-center"
            data-testid="vitrine-logo"
            aria-label="Boulay Beach Resort — Accueil"
          >
            <img
              src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/lhn37du4_LOGO%20BBr.png"
              alt="BBR — Boulay Beach Resort"
              className={`h-20 md:h-28 w-auto transition-all duration-500 ${
                onHero ? "" : "invert"
              }`}
            />
          </Link>

          {/* RIGHT : SHOP · RÉSERVER (pushed to extreme right) */}
          <div className="flex items-center justify-end gap-6 md:gap-10 lg:gap-14">
            <Link
              to="/boutique"
              className={`hidden sm:inline-flex items-center gap-2 text-[0.65rem] md:text-[0.7rem] tracking-[0.3em] uppercase transition-colors ${
                onHero ? "text-white/85 hover:text-white" : "text-[#0A0A0A]/75 hover:text-[#B8922A]"
              }`}
              data-testid="vitrine-shop"
            >
              <ShoppingBag size={14} strokeWidth={1.5} />
              Shop
            </Link>
            <Link
              to="/reserver"
              className={`inline-flex items-center px-4 md:px-6 py-2 md:py-2.5 text-[0.6rem] md:text-[0.7rem] tracking-[0.3em] uppercase font-medium transition-all duration-300 border ${
                onHero
                  ? "text-white border-white hover:bg-white hover:text-[#0A0A0A]"
                  : "text-white bg-[#0A0A0A] border-[#0A0A0A] hover:bg-[#B8922A] hover:border-[#B8922A]"
              }`}
              data-testid="vitrine-cta-reserver"
            >
              Réserver
            </Link>
          </div>
        </div>
      </header>

      {/* FULLSCREEN MENU OVERLAY */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-700 ease-out ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        data-testid="vitrine-fullscreen-menu"
      >
        {/* Background */}
        <div className="absolute inset-0 bg-white">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.08]"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=2000&q=85)",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative h-full flex items-center justify-center pt-24 px-6">
          <nav className="w-full max-w-2xl">
            <ul className="space-y-3 md:space-y-4">
              {MENU_ITEMS.map((item, idx) => (
                <li
                  key={item.to}
                  className={`transition-all duration-700 ${
                    menuOpen
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-6"
                  }`}
                  style={{ transitionDelay: menuOpen ? `${100 + idx * 60}ms` : "0ms" }}
                >
                  <Link
                    to={item.to}
                    className={`group flex items-baseline justify-between border-b border-[#0A0A0A]/10 py-4 md:py-5 transition-colors ${
                      item.highlight ? "text-[#B8922A] hover:text-[#0A0A0A]" : "text-[#0A0A0A] hover:text-[#B8922A]"
                    }`}
                    data-testid={`menu-${item.label.toLowerCase().replace(/\W/g, "-")}`}
                  >
                    <span className="font-serif italic font-light text-3xl md:text-5xl leading-tight">
                      {item.label}
                    </span>
                    <span className="text-[0.6rem] tracking-[0.4em] uppercase opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-12 text-center text-[0.55rem] tracking-[0.55em] uppercase text-[#0A0A0A]/45">
              Île Boulay  ·  Abidjan
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}

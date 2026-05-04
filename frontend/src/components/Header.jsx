import { Link, NavLink, useNavigate } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";

export default function Header() {
  const { lang, toggle, t } = useLang();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkClass = ({ isActive }) =>
    `text-[0.72rem] uppercase tracking-[0.22em] transition-colors duration-300 ${
      isActive ? "text-[#B8922A]" : "text-[#F5F0E8]/70 hover:text-[#B8922A]"
    }`;

  return (
    <header
      data-testid="site-header"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "backdrop-blur-2xl bg-[#0A0A0A]/80 border-b border-[#F5F0E8]/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-3 md:py-4 flex items-center justify-between">
        <Link to="/" data-testid="logo-link" className="flex items-center gap-3 group">
          <img
            src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png"
            alt="Boulay Beach Resort"
            className="h-20 md:h-24 w-auto object-contain"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-10">
          <NavLink to="/" end className={linkClass} data-testid="nav-home">
            {t.nav.offers}
          </NavLink>
          <NavLink to="/events" className={linkClass} data-testid="nav-events">
            {t.nav.privatization}
          </NavLink>
          {user && (
            <NavLink to="/account" className={linkClass} data-testid="nav-account">
              {t.nav.account}
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-5">
          <button
            data-testid="language-toggle"
            onClick={toggle}
            className="text-[0.7rem] uppercase tracking-[0.22em] text-[#F5F0E8]/60 hover:text-[#B8922A] transition-colors"
          >
            <span className={lang === "fr" ? "text-[#B8922A]" : ""}>FR</span>
            <span className="mx-1.5 text-[#F5F0E8]/30">/</span>
            <span className={lang === "en" ? "text-[#B8922A]" : ""}>EN</span>
          </button>

          {user ? (
            <button
              data-testid="logout-btn"
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="hidden md:block text-[0.7rem] uppercase tracking-[0.22em] text-[#F5F0E8]/60 hover:text-[#B8922A] transition-colors"
            >
              {t.nav.logout}
            </button>
          ) : (
            <Link
              to="/login"
              data-testid="header-login-btn"
              className="hidden md:block text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] hover:text-[#D4AF37] transition-colors"
            >
              {t.nav.login}
            </Link>
          )}

          <button
            data-testid="menu-toggle"
            onClick={() => setOpen(!open)}
            className="md:hidden text-[#F5F0E8] text-xl"
          >
            ☰
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#F5F0E8]/10 px-6 py-6 flex flex-col gap-5">
          <Link to="/" onClick={() => setOpen(false)} className="text-[0.75rem] uppercase tracking-[0.22em] text-[#F5F0E8]/80">{t.nav.offers}</Link>
          <Link to="/events" onClick={() => setOpen(false)} className="text-[0.75rem] uppercase tracking-[0.22em] text-[#F5F0E8]/80">{t.nav.privatization}</Link>
          {user ? (
            <>
              <Link to="/account" onClick={() => setOpen(false)} className="text-[0.75rem] uppercase tracking-[0.22em] text-[#F5F0E8]/80">{t.nav.account}</Link>
              <button onClick={() => { logout(); setOpen(false); navigate("/"); }} className="text-[0.75rem] uppercase tracking-[0.22em] text-left text-[#B8922A]">{t.nav.logout}</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="text-[0.75rem] uppercase tracking-[0.22em] text-[#B8922A]">{t.nav.login}</Link>
              <Link to="/register" onClick={() => setOpen(false)} className="text-[0.75rem] uppercase tracking-[0.22em] text-[#F5F0E8]/80">{t.nav.register}</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

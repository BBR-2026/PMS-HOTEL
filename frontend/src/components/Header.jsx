import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";

export default function Header() {
  const { lang, toggle } = useLang();

  return (
    <header
      data-testid="site-header"
      className="absolute top-0 left-0 right-0 z-50 bg-transparent"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-3 md:py-4 flex items-center justify-between">
        <Link to="/" data-testid="logo-link" className="flex items-center gap-3">
          <img
            src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png"
            alt="Boulay Beach Resort"
            className="h-20 md:h-24 w-auto object-contain"
            style={{ filter: "brightness(0.9)" }}
          />
        </Link>

        <button
          data-testid="language-toggle"
          onClick={toggle}
          className="text-[0.72rem] uppercase tracking-[0.22em] text-[#0A0A0A]/60 hover:text-[#B8922A] transition-colors"
        >
          <span className={lang === "fr" ? "text-[#B8922A]" : ""}>FR</span>
          <span className="mx-1.5 text-[#0A0A0A]/30">/</span>
          <span className={lang === "en" ? "text-[#B8922A]" : ""}>EN</span>
        </button>
      </div>
    </header>
  );
}

import { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../lib/i18n";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  /**
   * Initial language resolution priority:
   *   1. User's explicit choice persisted in localStorage (`bbr_lang`)
   *   2. Browser/device language (navigator.language) — if it starts with 'en'
   *      we default to English; otherwise we use French (BBR's primary market).
   *   3. Hardcoded fallback to 'fr'.
   */
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem("bbr_lang");
      if (saved === "fr" || saved === "en") return saved;
      if (typeof navigator !== "undefined") {
        const code = (navigator.language || navigator.userLanguage || "").toLowerCase();
        if (code.startsWith("en")) return "en";
        if (code.startsWith("fr")) return "fr";
      }
    } catch (_) {
      // localStorage may be unavailable (private mode); fall through
    }
    return "fr";
  });

  useEffect(() => {
    localStorage.setItem("bbr_lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = translations[lang];
  const toggle = () => setLang((l) => (l === "fr" ? "en" : "fr"));

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
};

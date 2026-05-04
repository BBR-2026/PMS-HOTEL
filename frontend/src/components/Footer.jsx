import { useLang } from "../context/LanguageContext";
import { Instagram } from "lucide-react";

export default function Footer() {
  const { t } = useLang();
  return (
    <footer
      data-testid="site-footer"
      className="border-t border-[#F5F0E8]/10 bg-[#0A0A0A] pt-20 pb-10 px-6 md:px-12 lg:px-24"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-10">
        {/* Brand */}
        <div className="md:col-span-4">
          <img
            src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png"
            alt="Boulay Beach Resort"
            className="h-24 w-auto object-contain mb-6 -ml-2"
          />
          <p className="text-sm text-[#F5F0E8]/50 max-w-xs leading-relaxed">{t.footer.addr}</p>
        </div>

        {/* Reservations */}
        <div className="md:col-span-4">
          <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] mb-5">
            {t.footer.reservations}
          </div>
          <ul className="space-y-3 text-sm text-[#F5F0E8]/70">
            <li>
              <a
                href="mailto:reservation@boulaybeachresort.com"
                className="hover:text-[#B8922A] transition-colors"
                data-testid="footer-email"
              >
                reservation@boulaybeachresort.com
              </a>
            </li>
            <li>
              <a
                href="tel:+22507046000000"
                className="hover:text-[#B8922A] transition-colors"
                data-testid="footer-phone-1"
              >
                (+225) 07 04 600 000
              </a>
            </li>
            <li>
              <a
                href="tel:+22507174000600"
                className="hover:text-[#B8922A] transition-colors"
                data-testid="footer-phone-2"
              >
                (+225) 07 17 400 600
              </a>
            </li>
          </ul>
        </div>

        {/* Follow */}
        <div className="md:col-span-4">
          <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[#B8922A] mb-5">
            {t.footer.follow}
          </div>
          <a
            href="https://www.instagram.com/boulaybeachresort"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 text-sm text-[#F5F0E8]/70 hover:text-[#B8922A] transition-colors group"
            data-testid="footer-instagram"
          >
            <span className="w-10 h-10 border border-[#B8922A]/40 flex items-center justify-center group-hover:border-[#B8922A] group-hover:bg-[#B8922A]/10 transition-all">
              <Instagram size={16} className="text-[#B8922A]" />
            </span>
            <span>@Boulaybeachresort</span>
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-16 pt-7 border-t border-[#F5F0E8]/10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[#F5F0E8]/40">
          © {new Date().getFullYear()} Boulay Beach Resort. {t.footer.rights}
        </div>
        <div className="flex items-center gap-6 text-[0.7rem] uppercase tracking-[0.22em] text-[#F5F0E8]/50">
          <a href="#" className="hover:text-[#B8922A] transition-colors" data-testid="footer-cgv">
            {t.footer.legal_terms}
          </a>
          <span className="text-[#F5F0E8]/20">|</span>
          <a href="#" className="hover:text-[#B8922A] transition-colors" data-testid="footer-mentions">
            {t.footer.legal_mentions}
          </a>
        </div>
      </div>
    </footer>
  );
}

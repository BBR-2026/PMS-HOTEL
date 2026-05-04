import { useLang } from "../context/LanguageContext";

export default function Footer() {
  const { t } = useLang();
  return (
    <footer data-testid="site-footer" className="border-t border-[#F5F0E8]/10 bg-[#0A0A0A] py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <img
            src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png"
            alt="Boulay Beach Resort"
            className="h-20 w-auto object-contain mb-5 -ml-2"
          />
          <p className="text-sm text-[#F5F0E8]/50 max-w-xs leading-relaxed">{t.footer.addr}</p>
        </div>
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] mb-4">Contact</div>
          <p className="text-sm text-[#F5F0E8]/60 leading-relaxed">
            +225 27 21 00 00 00<br />
            concierge@boulay.ci
          </p>
        </div>
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] mb-4">Hours</div>
          <p className="text-sm text-[#F5F0E8]/60 leading-relaxed">
            Mon — Sun<br />
            10h00 — 23h00
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-[#F5F0E8]/10 text-[0.7rem] uppercase tracking-[0.22em] text-[#F5F0E8]/40">
        © {new Date().getFullYear()} Boulay Beach Resort. {t.footer.rights}
      </div>
    </footer>
  );
}

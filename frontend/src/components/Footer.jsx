import { useLang } from "../context/LanguageContext";

export default function Footer() {
  const { t } = useLang();
  return (
    <footer data-testid="site-footer" className="border-t border-[#F5F0E8]/10 bg-[#0A0A0A] py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 border border-[#B8922A] flex items-center justify-center">
              <span className="font-serif text-[#B8922A] text-xl leading-none">B</span>
            </div>
            <div>
              <div className="font-serif text-base text-[#F5F0E8]">Boulay</div>
              <div className="text-[0.6rem] uppercase tracking-[0.3em] text-[#B8922A]">Beach Resort</div>
            </div>
          </div>
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

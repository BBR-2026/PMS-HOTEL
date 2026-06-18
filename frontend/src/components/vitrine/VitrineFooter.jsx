/**
 * Vitrine — Footer with brand mark, contact info and quick links.
 */
import { Link } from "react-router-dom";
import { Instagram, Facebook, MessageCircle, Mail, Phone, MapPin } from "lucide-react";

export default function VitrineFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[#0A0A0A] text-white pt-20 pb-8" data-testid="vitrine-footer">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12 mb-16">
        <div className="md:col-span-1">
          <div className="text-[0.65rem] tracking-[0.4em] font-bold text-[#B8922A] mb-4">
            BBR
          </div>
          <div className="text-sm text-white/75 leading-relaxed mb-6">
            Boulay Beach Resort.<br />
            L'expérience balnéaire de référence à Abidjan.
          </div>
          <div className="flex items-center gap-4">
            <a href="https://www.instagram.com/boulaybeachresort" target="_blank" rel="noreferrer" className="text-white/60 hover:text-[#D4B256]" data-testid="footer-instagram">
              <Instagram size={18} />
            </a>
            <a href="https://www.facebook.com/boulaybeachresort" target="_blank" rel="noreferrer" className="text-white/60 hover:text-[#D4B256]" data-testid="footer-facebook">
              <Facebook size={18} />
            </a>
            <a href="https://wa.me/2250704600600" target="_blank" rel="noreferrer" className="text-white/60 hover:text-[#D4B256]" data-testid="footer-whatsapp">
              <MessageCircle size={18} />
            </a>
          </div>
        </div>

        <div>
          <div className="text-[0.7rem] tracking-[0.25em] uppercase text-[#D4B256] mb-5">
            Univers
          </div>
          <ul className="space-y-3 text-sm text-white/75">
            <li><Link to="/univers/hebergement" className="hover:text-[#D4B256]">Hébergement</Link></li>
            <li><Link to="/univers/beach-club" className="hover:text-[#D4B256]">Beach Club</Link></li>
            <li><Link to="/univers/activites" className="hover:text-[#D4B256]">Activités</Link></li>
            <li><Link to="/univers/evenementiel" className="hover:text-[#D4B256]">Événementiel</Link></li>
            <li><Link to="/univers/corporate" className="hover:text-[#D4B256]">Corporate</Link></li>
            <li><Link to="/le-kaai" className="hover:text-[#D4B256]">Restaurant Le Kaai</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-[0.7rem] tracking-[0.25em] uppercase text-[#D4B256] mb-5">
            Contact
          </div>
          <ul className="space-y-3 text-sm text-white/75">
            <li className="flex items-start gap-3">
              <MapPin size={14} className="mt-1 flex-shrink-0 text-[#B8922A]" />
              <span>Île Boulay, Abidjan<br />Côte d'Ivoire</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone size={14} className="text-[#B8922A]" />
              <a href="tel:+2250704600600" className="hover:text-[#D4B256]">+225 07 04 60 06 00</a>
            </li>
            <li className="flex items-center gap-3">
              <Mail size={14} className="text-[#B8922A]" />
              <a href="mailto:reservations@boulaybeachresort.com" className="hover:text-[#D4B256]">
                reservations@boulaybeachresort.com
              </a>
            </li>
          </ul>
        </div>

        <div>
          <div className="text-[0.7rem] tracking-[0.25em] uppercase text-[#D4B256] mb-5">
            Réservation directe
          </div>
          <div className="text-sm text-white/75 leading-relaxed mb-5">
            Tarif garanti meilleur prix. Annulation flexible.
          </div>
          <Link
            to="/reserver"
            className="inline-flex px-5 py-3 bg-[#B8922A] hover:bg-[#A07D1F] text-white text-[0.7rem] tracking-[0.22em] uppercase font-semibold transition-colors"
            data-testid="footer-cta-reserver"
          >
            Réserver maintenant
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-xs text-white/45">
          © {year} Boulay Beach Resort. Tous droits réservés.
        </div>
        <div className="flex items-center gap-6 text-xs text-white/45">
          <a href="#" className="hover:text-[#D4B256]">Mentions légales</a>
          <a href="#" className="hover:text-[#D4B256]">CGV</a>
          <a href="#" className="hover:text-[#D4B256]">Confidentialité</a>
        </div>
      </div>
    </footer>
  );
}

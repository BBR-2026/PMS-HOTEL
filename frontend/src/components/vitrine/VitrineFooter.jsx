/**
 * Vitrine — Editorial footer (Nikki-Beach inspired).
 *
 * White / cream tone, generous whitespace, serif accents, minimal links.
 */
import { Link } from "react-router-dom";
import { Instagram, Facebook, MessageCircle, Youtube } from "lucide-react";
import { useSiteConfig, sel } from "../../lib/site-config";

export default function VitrineFooter() {
  const year = new Date().getFullYear();
  const cfg = useSiteConfig();
  const footer = sel.footer(cfg);
  const contact = sel.contact(cfg);
  const phone = contact.phone || "+225 07 04 60 06 00";
  const phoneTel = phone.replace(/\s+/g, "");
  const email = contact.email || "reservations@boulaybeachresort.com";
  const ig = footer.social_instagram || "https://www.instagram.com/boulaybeachresort";
  const fb = footer.social_facebook;
  const yt = footer.social_youtube;
  const wa = contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\D+/g, "")}` : "https://wa.me/2250704600600";
  return (
    <footer className="bg-[#FAF7F2] text-[#0A0A0A] pt-24 pb-10" data-testid="vitrine-footer">
      <div className="max-w-7xl mx-auto px-6">

        {/* Top — brand, with optional CMS tagline */}
        <div className="text-center pb-16 border-b border-[#0A0A0A]/8">
          <img
            src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/lhn37du4_LOGO%20BBr.png"
            alt="Boulay Beach Resort"
            className={`h-20 md:h-24 w-auto mx-auto logo-gold ${footer.show_tagline ? "mb-3" : ""}`}
            data-testid="footer-logo"
          />
          {footer.show_tagline && footer.tagline && (
            <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#0A0A0A]/55">
              {footer.tagline}
            </div>
          )}
        </div>

        {/* Middle — 4 columns */}
        <div className="grid md:grid-cols-4 gap-12 py-16 text-sm">
          <div>
            <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-5">
              Nos univers
            </div>
            <ul className="space-y-3 text-[#0A0A0A]/80">
              <li><Link to="/univers/hebergement" className="hover:text-[#B8922A]">Hébergement</Link></li>
              <li><Link to="/univers/beach-club" className="hover:text-[#B8922A]">Beach Club</Link></li>
              <li><Link to="/univers/activites" className="hover:text-[#B8922A]">Activités</Link></li>
              <li><Link to="/univers/evenementiel" className="hover:text-[#B8922A]">Événementiel</Link></li>
              <li><Link to="/univers/corporate" className="hover:text-[#B8922A]">Corporate</Link></li>
              <li><Link to="/le-kaai" className="hover:text-[#B8922A]">Le Kaai</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-5">
              Réservation
            </div>
            <ul className="space-y-3 text-[#0A0A0A]/80">
              <li><Link to="/reserver" className="hover:text-[#B8922A]">Réserver un séjour</Link></li>
              <li><Link to="/booking/pass_day" className="hover:text-[#B8922A]">Day Pass</Link></li>
              <li><Link to="/booking/sunset" className="hover:text-[#B8922A]">Sunset Experience</Link></li>
              <li><Link to="/booking/brunch" className="hover:text-[#B8922A]">Brunch dominical</Link></li>
              <li><Link to="/univers/evenementiel#devis" className="hover:text-[#B8922A]">Demander un devis</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-5">
              Contact
            </div>
            <ul className="space-y-3 text-[#0A0A0A]/80">
              <li>{contact.address_line_1 || "Île Boulay, Abidjan"}<br />{contact.address_line_2 || "Côte d'Ivoire"}</li>
              <li><a href={`tel:${phoneTel}`} className="hover:text-[#B8922A]">{phone}</a></li>
              <li><a href={`mailto:${email}`} className="hover:text-[#B8922A]">{email}</a></li>
            </ul>
          </div>

          <div>
            <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 mb-5">
              Suivez-nous
            </div>
            <div className="flex items-center gap-5 mb-6">
              <a href={ig} target="_blank" rel="noreferrer" className="text-[#0A0A0A]/65 hover:text-[#B8922A]" data-testid="footer-instagram">
                <Instagram size={18} />
              </a>
              {fb && (
                <a href={fb} target="_blank" rel="noreferrer" className="text-[#0A0A0A]/65 hover:text-[#B8922A]" data-testid="footer-facebook">
                  <Facebook size={18} />
                </a>
              )}
              {yt && (
                <a href={yt} target="_blank" rel="noreferrer" className="text-[#0A0A0A]/65 hover:text-[#B8922A]" data-testid="footer-youtube">
                  <Youtube size={18} />
                </a>
              )}
              <a href={wa} target="_blank" rel="noreferrer" className="text-[#0A0A0A]/65 hover:text-[#B8922A]" data-testid="footer-whatsapp">
                <MessageCircle size={18} />
              </a>
            </div>
            <div className="text-[#0A0A0A]/65 text-xs leading-relaxed">
              {footer.newsletter_pitch || "Tarif garanti meilleur prix en réservation directe."}
            </div>
          </div>
        </div>

        {/* Bottom — legal */}
        <div className="pt-8 border-t border-[#0A0A0A]/8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#0A0A0A]/50">
          <div>© {year} Boulay Beach Resort. Tous droits réservés.</div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-[#B8922A]">Mentions légales</a>
            <a href="#" className="hover:text-[#B8922A]">CGV</a>
            <a href="#" className="hover:text-[#B8922A]">Confidentialité</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

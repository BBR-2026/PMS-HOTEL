/**
 * Vitrine — Editorial footer (Nikki-Beach inspired).
 *
 * White / cream tone, generous whitespace, serif accents, minimal links.
 * Legal links (Mentions légales, CGV, Confidentialité) come from the
 * headless CMS (`sel.mentionsLegales(cfg)`); the cookies banner uses
 * `cookies_text` from the same source. Banner consent persists in
 * localStorage under the key `bbr_cookies_ack`.
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Instagram, Facebook, MessageCircle, Youtube, Cookie, X } from "lucide-react";
import { useSiteConfig, sel } from "../../lib/site-config";

const COOKIE_ACK_KEY = "bbr_cookies_ack";

export default function VitrineFooter() {
  const year = new Date().getFullYear();
  const cfg = useSiteConfig();
  const footer = sel.footer(cfg);
  const contact = sel.contact(cfg);
  const ml = sel.mentionsLegales(cfg);
  const phone = contact.phone || "+225 07 04 60 06 00";
  const phoneTel = phone.replace(/\s+/g, "");
  const email = contact.email || "reservations@boulaybeachresort.com";
  const ig = footer.social_instagram || "https://www.instagram.com/boulaybeachresort";
  const fb = footer.social_facebook;
  const yt = footer.social_youtube;
  const wa = contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\D+/g, "")}` : "https://wa.me/2250704600600";
  const [legalOpen, setLegalOpen] = useState(false);
  const [cookieAck, setCookieAck] = useState(true); // start as ack=true to avoid flash; set to false in effect
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(COOKIE_ACK_KEY);
      if (!v) setCookieAck(false);
    } catch { /* ignore */ }
  }, []);
  const dismissCookies = () => {
    try { window.localStorage.setItem(COOKIE_ACK_KEY, new Date().toISOString()); } catch { /* ignore */ }
    setCookieAck(true);
  };
  const cgvHref = (ml.cgv_url || "").trim() || null;
  const privacyHref = (ml.privacy_url || "").trim() || null;
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
          <div data-testid="footer-copyright">
            © {year} {ml.company_name || "Boulay Beach Resort"}. Tous droits réservés.
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setLegalOpen(true)}
              className="hover:text-[#B8922A] transition-colors"
              data-testid="footer-mentions-legales"
            >
              Mentions légales
            </button>
            {cgvHref ? (
              <a
                href={cgvHref}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#B8922A] transition-colors"
                data-testid="footer-cgv"
              >
                CGV
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setLegalOpen(true)}
                className="hover:text-[#B8922A] transition-colors"
                data-testid="footer-cgv"
              >
                CGV
              </button>
            )}
            {privacyHref ? (
              <a
                href={privacyHref}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#B8922A] transition-colors"
                data-testid="footer-privacy"
              >
                Confidentialité
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setLegalOpen(true)}
                className="hover:text-[#B8922A] transition-colors"
                data-testid="footer-privacy"
              >
                Confidentialité
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mentions légales modal */}
      {legalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
          onClick={() => setLegalOpen(false)}
          data-testid="mentions-legales-modal"
        >
          <div
            className="bg-white text-[#0A0A0A] w-full max-w-lg p-6 sm:p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLegalOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-[#0A0A0A]/55 hover:text-[#0A0A0A]"
              data-testid="mentions-legales-close"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
            <div className="text-[0.6rem] tracking-[0.4em] uppercase text-[#B8922A] mb-2">
              Informations légales
            </div>
            <h2 className="font-display-serif text-2xl sm:text-3xl mb-5">
              Mentions légales
            </h2>
            <dl className="space-y-3 text-sm text-[#0A0A0A]/80">
              {ml.company_name && (
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Éditeur</dt>
                  <dd className="mt-0.5">{ml.company_name}</dd>
                </div>
              )}
              {ml.rccm && (
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">RCCM</dt>
                  <dd className="mt-0.5">{ml.rccm}</dd>
                </div>
              )}
              {ml.siege_social && (
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Siège social</dt>
                  <dd className="mt-0.5">{ml.siege_social}</dd>
                </div>
              )}
              {ml.publication_director && (
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Directeur de la publication</dt>
                  <dd className="mt-0.5">{ml.publication_director}</dd>
                </div>
              )}
              {ml.hosting && (
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55">Hébergement</dt>
                  <dd className="mt-0.5">{ml.hosting}</dd>
                </div>
              )}
            </dl>
            {(cgvHref || privacyHref) && (
              <div className="mt-6 pt-5 border-t border-[#0A0A0A]/8 flex flex-wrap gap-4 text-sm">
                {cgvHref && (
                  <a href={cgvHref} target="_blank" rel="noreferrer" className="text-[#B8922A] hover:underline">
                    Conditions générales de vente →
                  </a>
                )}
                {privacyHref && (
                  <a href={privacyHref} target="_blank" rel="noreferrer" className="text-[#B8922A] hover:underline">
                    Politique de confidentialité →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cookies banner (one-line, dismissible, persistent) */}
      {!cookieAck && (
        <div
          className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-6 md:bottom-6 md:max-w-md z-50 bg-[#0A0A0A] text-white shadow-xl border border-[#B8922A]/30"
          data-testid="cookie-banner"
        >
          <div className="p-4 sm:p-5 flex items-start gap-3">
            <Cookie size={18} className="text-[#B8922A] flex-shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-white/85 leading-relaxed flex-1">
              {ml.cookies_text || "Ce site utilise des cookies à des fins de mesure d'audience et de personnalisation."}
            </p>
          </div>
          <div className="px-4 sm:px-5 pb-4 flex items-center justify-end gap-2">
            {privacyHref && (
              <a
                href={privacyHref}
                target="_blank"
                rel="noreferrer"
                className="text-[0.65rem] uppercase tracking-[0.22em] text-white/65 hover:text-white px-3 py-2"
                data-testid="cookie-banner-learn-more"
              >
                En savoir plus
              </a>
            )}
            <button
              type="button"
              onClick={dismissCookies}
              className="text-[0.65rem] uppercase tracking-[0.22em] bg-[#B8922A] hover:bg-[#a37e1f] text-white px-4 py-2 transition-colors"
              data-testid="cookie-banner-accept"
            >
              J&apos;accepte
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}

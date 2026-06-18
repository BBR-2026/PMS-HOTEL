/**
 * Contact — Editorial contact page.
 */
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";

export default function VitrineContact() {
  return (
    <div className="bg-white text-[#0A0A0A]" data-testid="vitrine-contact">
      {/* Hero band */}
      <section className="relative h-[55vh] min-h-[400px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2400&q=85)",
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 w-full px-6 pb-16 text-center text-white">
          <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/80 mb-6">
            Contactez-nous
          </div>
          <h1 className="font-serif italic font-light text-5xl md:text-7xl leading-[1.05]">
            Restons en lien.
          </h1>
        </div>
      </section>

      {/* Content */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-12 md:gap-20">
          <div>
            <h2 className="font-serif italic font-light text-3xl md:text-4xl mb-8 leading-tight">
              Une question, une réservation,<br />un projet sur-mesure ?
            </h2>
            <p className="text-base md:text-lg text-[#0A0A0A]/75 leading-[1.85] font-light mb-10">
              Notre équipe vous répond en français et en anglais, sept jours sur sept,
              de 8h à 22h. Pour les groupes et événements, un chargé de compte dédié
              vous accompagne.
            </p>
          </div>
          <div className="space-y-8">
            <Item icon={<MapPin size={18} strokeWidth={1.5} />} title="Adresse">
              Île Boulay<br />Abidjan, Côte d'Ivoire
            </Item>
            <Item icon={<Phone size={18} strokeWidth={1.5} />} title="Téléphone">
              <a href="tel:+2250704600600" className="hover:text-[#B8922A]">
                +225 07 04 60 06 00
              </a>
            </Item>
            <Item icon={<MessageCircle size={18} strokeWidth={1.5} />} title="WhatsApp">
              <a href="https://wa.me/2250704600600" target="_blank" rel="noreferrer" className="hover:text-[#B8922A]">
                +225 07 04 60 06 00
              </a>
            </Item>
            <Item icon={<Mail size={18} strokeWidth={1.5} />} title="Email">
              <a href="mailto:reservations@boulaybeachresort.com" className="hover:text-[#B8922A]">
                reservations@boulaybeachresort.com
              </a>
            </Item>
          </div>
        </div>
      </section>
    </div>
  );
}

function Item({ icon, title, children }) {
  return (
    <div className="flex items-start gap-5 pb-6 border-b border-[#0A0A0A]/8">
      <div className="text-[#B8922A] mt-1 flex-shrink-0">{icon}</div>
      <div>
        <div className="text-[0.6rem] tracking-[0.35em] uppercase text-[#0A0A0A]/55 mb-2">
          {title}
        </div>
        <div className="text-base text-[#0A0A0A]/85 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

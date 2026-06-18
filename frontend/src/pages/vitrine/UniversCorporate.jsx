import UniversPage from "../../components/vitrine/UniversPage";
import CorporateQuoteForm from "../../components/vitrine/CorporateQuoteForm";
import { Briefcase, Users, Calendar } from "lucide-react";

export default function UniversCorporate() {
  return (
    <>
    <UniversPage
      testId="univers-corporate"
      hero={{
        image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2400&q=85",
        kicker: "Univers · Corporate",
        title: "Séminaires & journées d'études inoubliables.",
        tagline:
          "Sortez vos équipes du cadre. Travaillez face à la lagune, célébrez face au coucher de soleil.",
        cta: { to: "/univers/corporate#contact", label: "Demander un devis" },
      }}
      intro={{
        kicker: "Réinvente vos formats pro",
        title: "L'environnement change tout.",
        body:
          "Salles modulables jusqu'à 200 personnes, restauration sur mesure, animations team building, capacité d'hébergement sur place — BBr accueille vos séminaires, conférences, conventions et journées d'étude comme nulle part ailleurs en Côte d'Ivoire.",
      }}
      offers={[
        {
          testId: "seminaire",
          title: "Séminaire",
          description:
            "Demi-journée, journée complète ou résidentiel. Salles modulables.",
          features: [
            "Salle climatisée jusqu'à 80 pers.",
            "Vidéoprojecteur + sono incluse",
            "2 pauses café + déjeuner buffet",
            "Activité team building en option",
          ],
          price: "45 000 XOF",
          priceSuffix: "/ pers. / journée",
          image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/univers/corporate#contact", label: "Demander un devis" },
        },
        {
          testId: "conference",
          title: "Conférence",
          description:
            "Auditorium 200 places avec scène et régie audiovisuelle complète.",
          features: [
            "Capacité 200 personnes",
            "Régie son + lumière + vidéo",
            "Traduction simultanée disponible",
            "Espace catering attenant",
          ],
          price: "Sur devis",
          image: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/univers/corporate#contact", label: "Demander un devis" },
        },
        {
          testId: "team-building",
          title: "Team Building",
          description:
            "Activités sport, escape game extérieur, défis culinaires. Sur mesure.",
          features: [
            "Animation par coach pro",
            "10 à 200 participants",
            "Activités sur la plage incluses",
            "Format mi-journée à 3 jours",
          ],
          price: "Sur devis",
          image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/univers/corporate#contact", label: "Demander un devis" },
          badge: "Populaire",
        },
      ]}
      highlights={[
        {
          icon: <Briefcase size={32} strokeWidth={1.5} />,
          title: "Setup pro",
          body: "Fibre dédiée 200 Mbps, salles climatisées, projecteurs HD, écrans, sono Bose, paperboards.",
        },
        {
          icon: <Users size={32} strokeWidth={1.5} />,
          title: "Restauration adaptée",
          body: "Pauses café, déjeuners buffet, dîners de gala, cocktails — orchestrés par Le Kaai.",
        },
        {
          icon: <Calendar size={32} strokeWidth={1.5} />,
          title: "Coordination dédiée",
          body: "Un chargé de compte dédié de la signature du devis au dernier participant raccompagné.",
        },
      ]}
      finalCta={{
        image: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=2400&q=85",
        title: "Faites souffler vos équipes.",
        body: "Recevez un devis personnalisé sous 24h. Visite des espaces sur rendez-vous.",
        to: "#devis",
        label: "Demander un devis",
      }}
    />
    <CorporateQuoteForm />
    </>
  );
}

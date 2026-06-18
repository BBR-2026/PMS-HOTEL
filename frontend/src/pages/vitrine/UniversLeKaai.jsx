import UniversPage from "../../components/vitrine/UniversPage";
import { Utensils, Wine, Music2 } from "lucide-react";

export default function UniversLeKaai() {
  return (
    <UniversPage
      testId="univers-le-kaai"
      hero={{
        image: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/v2f73qqm_KAAI.png",
        kicker: "Restaurant signature",
        title: "Le Kaai.",
        tagline:
          "Cuisine d'inspiration africaine contemporaine. Une table à l'ambition gastronomique affirmée, dans une atmosphère élégante face à la lagune.",
        cta: { to: "/booking/le_kaai?service=dejeuner", label: "Réserver une table" },
      }}
      intro={{
        kicker: "Une cuisine qui raconte l'Afrique",
        title: "Saveurs contemporaines, face à la lagune.",
        body:
          "Du déjeuner à la tombée du jour au dîner signature, Le KAAÏ vous accueille pour une expérience gastronomique d'exception. Tous les produits sont sélectionnés en circuit court, la cuisine est ouverte, et la vue est imprenable.",
      }}
      offers={[
        {
          testId: "dejeuner",
          title: "Déjeuner",
          description:
            "Menu signature 3 services, servi de 12h à 14h30 face à la lagune.",
          features: [
            "Entrée + Plat + Dessert",
            "Menu enfant disponible",
            "Vin au verre en option",
            "Service de 12h à 14h30",
          ],
          price: "à partir de 18 000 XOF",
          image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/booking/le_kaai?service=dejeuner", label: "Réserver le déjeuner" },
        },
        {
          testId: "diner",
          title: "Dîner",
          description:
            "Menu dégustation 5 services + accords mets-vins. Service à partir de 19h.",
          features: [
            "5 services signature",
            "Accords mets-vins optionnels",
            "Live music tous les vendredis",
            "Service à partir de 19h",
          ],
          price: "à partir de 35 000 XOF",
          image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/booking/le_kaai?service=diner", label: "Réserver le dîner" },
          badge: "Signature",
        },
      ]}
      highlights={[
        {
          icon: <Utensils size={32} strokeWidth={1.5} />,
          title: "Cuisine d'auteur",
          body: "Une carte qui célèbre les terroirs d'Afrique contemporaine, en circuit court avec nos producteurs partenaires.",
        },
        {
          icon: <Wine size={32} strokeWidth={1.5} />,
          title: "Cave d'auteur",
          body: "Plus de 200 références dont 30 au verre. Notre sommelier vous accompagne avec passion.",
        },
        {
          icon: <Music2 size={32} strokeWidth={1.5} />,
          title: "Live music",
          body: "Vendredi sunset DJ, samedi jazz live — la musique fait partie de chaque voyage culinaire.",
        },
      ]}
      finalCta={{
        image: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/v2f73qqm_KAAI.png",
        title: "Réservez votre table.",
        body:
          "Important : la traversée vers l'île Boulay est facturée 10 000 XOF par personne (aller-retour). Le paiement de la traversée est requis pour valider votre réservation au Kaai.",
        to: "/booking/le_kaai?service=dejeuner",
        label: "Réserver maintenant",
      }}
    />
  );
}

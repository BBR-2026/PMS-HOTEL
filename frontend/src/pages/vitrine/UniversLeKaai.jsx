import UniversPage from "../../components/vitrine/UniversPage";
import { Utensils, Wine, Music2 } from "lucide-react";

export default function UniversLeKaai() {
  return (
    <UniversPage
      testId="univers-le-kaai"
      hero={{
        image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2400&q=85",
        kicker: "Restaurant signature",
        title: "Le Kaai.",
        tagline:
          "Cuisine du monde, vue panoramique, ambiance feutrée. Le restaurant de référence à BBr.",
        cta: { to: "/reserver", label: "Réserver une table" },
      }}
      intro={{
        kicker: "Une cuisine qui voyage",
        title: "Le monde dans l'assiette, face à la lagune.",
        body:
          "Chef étoilé Romain de la Pomelée à la direction. Une carte qui voyage du Pacifique aux Caraïbes, des produits locaux d'exception, une cave construite avec amour, et une vue qu'on n'oublie pas.",
      }}
      offers={[
        {
          testId: "dejeuner",
          title: "Déjeuner",
          description:
            "Menu signature 3 services. Service de 12h à 14h30.",
          features: [
            "Entrée + Plat + Dessert",
            "Menu enfant disponible",
            "Vin au verre inclus en option",
          ],
          price: "à partir de 18 000 XOF",
          image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/reserver", label: "Réserver une table" },
        },
        {
          testId: "diner",
          title: "Dîner",
          description:
            "Menu dégustation 5 services + accord mets-vins. À partir de 19h.",
          features: [
            "5 services signature",
            "Accords mets-vins optionnels",
            "Ambiance live tous les vendredis",
          ],
          price: "à partir de 35 000 XOF",
          image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/reserver", label: "Réserver une table" },
          badge: "Signature",
        },
        {
          testId: "brunch-dimanche",
          title: "Brunch dominical",
          description:
            "Le brunch attendu de tout Abidjan. Buffet illimité face à l'eau.",
          features: [
            "Buffet gastronomique",
            "Open bar : mimosa & cocktails",
            "DJ live de 12h à 16h",
          ],
          price: "22 000 XOF",
          priceSuffix: "/ adulte",
          image: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/booking/brunch", label: "Réserver mon brunch" },
        },
      ]}
      highlights={[
        {
          icon: <Utensils size={32} strokeWidth={1.5} />,
          title: "Cuisine du monde",
          body: "Du tataki de thon ivoirien au homard grillé sauce passion. La carte voyage, l'assiette éblouit.",
        },
        {
          icon: <Wine size={32} strokeWidth={1.5} />,
          title: "Cave d'auteur",
          body: "Plus de 200 références dont 30 au verre. Notre sommelier vous accompagne avec passion.",
        },
        {
          icon: <Music2 size={32} strokeWidth={1.5} />,
          title: "Live music",
          body: "Vendredi sunset DJ, samedi jazz live, dimanche brunch — la musique fait partie du voyage.",
        },
      ]}
      finalCta={{
        image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2400&q=85",
        title: "Réservez votre table.",
        body: "Le Kaai affiche complet la plupart des soirs. Pensez à réserver, surtout les week-ends.",
        to: "/reserver",
        label: "Réserver une table",
      }}
    />
  );
}

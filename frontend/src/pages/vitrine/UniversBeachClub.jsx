import UniversPage from "../../components/vitrine/UniversPage";
import { Sun, Music, UtensilsCrossed } from "lucide-react";

export default function UniversBeachClub() {
  return (
    <UniversPage
      testId="univers-beach-club"
      hero={{
        image: "https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?auto=format&fit=crop&w=2400&q=85",
        kicker: "Univers · Beach Club",
        title: "Trois expériences, une plage privée.",
        tagline:
          "Day Pass, Sunset Experience, Brunch dominical. Toute l'année, sept jours sur sept.",
        cta: { to: "/reserver", label: "Choisir mon expérience" },
      }}
      intro={{
        kicker: "L'art de vivre balnéaire",
        title: "Une journée parfaite, du matin au coucher du soleil.",
        body:
          "Notre beach club est plus qu'une plage : c'est un art de vivre. Transats premium, restaurant de bord d'eau, cocktail-bar signature, animation musicale lors du sunset.",
      }}
      offers={[
        {
          testId: "day-pass",
          title: "Day Pass",
          description:
            "L'accès complet au beach club pour une journée d'évasion totale.",
          features: [
            "Accès plage + 2 piscines",
            "Transat et serviette premium",
            "Vestiaires & douches privés",
            "30% de réduction au restaurant",
          ],
          price: "20 000 XOF",
          priceSuffix: "/ adulte",
          image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/booking/pass_day", label: "Réserver mon Day Pass" },
        },
        {
          testId: "sunset",
          title: "Sunset Experience",
          description:
            "Le coucher de soleil le plus spectaculaire d'Abidjan, en cocktail.",
          features: [
            "Accès dès 16h jusqu'au coucher",
            "Cocktail signature offert",
            "DJ live & ambiance",
            "Foodtruck gourmand",
          ],
          price: "15 000 XOF",
          priceSuffix: "/ adulte",
          image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/booking/sunset", label: "Réserver mon Sunset" },
          badge: "Best-seller",
        },
        {
          testId: "brunch",
          title: "Brunch dominical",
          description:
            "Le brunch attendu de tout Abidjan. Vue panoramique et buffet d'exception.",
          features: [
            "Buffet gastronomique illimité",
            "Open bar : mimosa & cocktails",
            "Animation musicale live",
            "Accès plage tout l'après-midi",
          ],
          price: "22 000 XOF",
          priceSuffix: "/ adulte",
          image: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/booking/brunch", label: "Réserver mon Brunch" },
        },
      ]}
      highlights={[
        {
          icon: <Sun size={32} strokeWidth={1.5} />,
          title: "Toute l'année",
          body: "Le beach club est ouvert 7j/7, peu importe la saison. Le climat lagunaire vous bichonne.",
        },
        {
          icon: <Music size={32} strokeWidth={1.5} />,
          title: "DJ & live",
          body: "Sets live chaque vendredi sunset et chaque dimanche brunch. L'ambiance des nuits étoilées d'Abidjan.",
        },
        {
          icon: <UtensilsCrossed size={32} strokeWidth={1.5} />,
          title: "Le Kaai inclus",
          body: "Notre restaurant signature à 200 mètres, accessible à pied. Cuisine du monde réinventée.",
        },
      ]}
      finalCta={{
        image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2400&q=85",
        title: "Votre prochaine journée parfaite ?",
        body: "Quota journalier limité (250 personnes max). Réservation conseillée pour les week-ends et le brunch.",
        to: "/reserver",
        label: "Réserver maintenant",
      }}
    />
  );
}

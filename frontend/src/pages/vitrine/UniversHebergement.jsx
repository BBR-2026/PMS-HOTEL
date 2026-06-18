import UniversPage from "../../components/vitrine/UniversPage";
import { Waves, Sparkles, Coffee } from "lucide-react";

export default function UniversHebergement() {
  return (
    <UniversPage
      testId="univers-hebergement"
      hero={{
        image: "https://images.unsplash.com/photo-1602002418816-5c0aeef426aa?auto=format&fit=crop&w=2400&q=85",
        kicker: "Univers · Hébergement",
        title: "Suites & Chambres face à la lagune.",
        tagline:
          "60+ hébergements signature pensés pour le repos absolu. Vue lagune garantie sur chaque suite.",
        cta: { to: "/reserver", label: "Vérifier les disponibilités" },
      }}
      intro={{
        kicker: "Trois catégories, une seule promesse",
        title: "Le luxe discret, sans compromis.",
        body:
          "De la Chambre Exclusive intimiste à la Suite Lagune privée, chaque hébergement BBr a été dessiné pour vous faire oublier le temps. Matériaux nobles, literie d'exception, vues panoramiques.",
      }}
      offers={[
        {
          testId: "chambre-exclusive",
          title: "Chambre Exclusive",
          description:
            "32 m² ouverts sur le jardin tropical. La porte d'entrée vers l'univers BBr.",
          features: [
            "Lit king-size 200×200",
            "Salle de bain en pierre naturelle",
            "Terrasse privée avec vue jardin",
            "Petit-déjeuner inclus",
          ],
          price: "75 000 XOF",
          priceSuffix: "/ nuit",
          image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/booking/hebergement?room=chambre_exclusive", label: "Réserver cette chambre" },
        },
        {
          testId: "suite-jardin",
          title: "Suite Jardin",
          description:
            "55 m² avec coin salon, baignoire balnéo, et jardin privatif tropical.",
          features: [
            "Suite avec salon séparé",
            "Baignoire balnéo + douche pluie",
            "Jardin privatif & hamac",
            "Service en chambre 24/7",
          ],
          price: "135 000 XOF",
          priceSuffix: "/ nuit",
          image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/booking/hebergement?room=suite_jardin", label: "Réserver cette suite" },
          badge: "Populaire",
        },
        {
          testId: "suite-lagune",
          title: "Suite Lagune",
          description:
            "80 m² face à l'eau. Piscine privée, terrasse panoramique, expérience absolue.",
          features: [
            "Piscine privée à débordement",
            "Terrasse 30 m² face lagune",
            "Champagne d'accueil",
            "Petit-déjeuner servi en terrasse",
          ],
          price: "245 000 XOF",
          priceSuffix: "/ nuit",
          image: "https://images.unsplash.com/photo-1582610116397-edb318620f90?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/booking/hebergement?room=suite_lagune", label: "Réserver cette suite" },
          badge: "Signature",
        },
      ]}
      highlights={[
        {
          icon: <Waves size={32} strokeWidth={1.5} />,
          title: "Vue lagune",
          body: "Chaque chambre donne sur la lagune ou le jardin tropical. Pas de chambre cour, pas de chambre sans âme.",
        },
        {
          icon: <Sparkles size={32} strokeWidth={1.5} />,
          title: "Service signature",
          body: "Conciergerie 24/7, room service gastronomique, navette gratuite Abidjan/BBr.",
        },
        {
          icon: <Coffee size={32} strokeWidth={1.5} />,
          title: "Petit-déjeuner inclus",
          body: "Servi sur votre terrasse ou en salle panoramique, jusqu'à 11h tous les jours.",
        },
      ]}
      finalCta={{
        image: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2400&q=85",
        title: "Quelle suite vous fait rêver ?",
        body: "Tarif garanti meilleur prix en réservant en direct. Annulation flexible jusqu'à 72h avant l'arrivée.",
        to: "/reserver",
        label: "Vérifier les disponibilités",
      }}
    />
  );
}

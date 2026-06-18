import UniversPage from "../../components/vitrine/UniversPage";
import { Zap, Target, Award } from "lucide-react";

export default function UniversActivites() {
  return (
    <UniversPage
      testId="univers-activites"
      hero={{
        image: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=2400&q=85",
        kicker: "Univers · Activités",
        title: "Sport, glisse, adrénaline.",
        tagline:
          "Sept activités sport et plein air pour pimenter votre séjour. Équipements premium, encadrants brevetés.",
        cta: { to: "/reserver", label: "Réserver une activité" },
      }}
      intro={{
        kicker: "L'aventure à portée de pas",
        title: "Sept disciplines pour bouger autrement.",
        body:
          "De la glisse sur la lagune au padel sous les palmiers, en passant par le quad et le buggy dans les pistes côtières — BBr déploie tout un éventail d'activités pour les sportifs et les curieux.",
      }}
      offers={[
        {
          testId: "jet-ski",
          title: "Jet Ski",
          description:
            "30 minutes de pure adrénaline sur la lagune. Sensations garanties.",
          features: ["Brief sécurité inclus", "Jet ski 1500cc dernière génération", "Tour guidé possible"],
          price: "35 000 XOF",
          priceSuffix: "/ 30 min",
          image: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/reserver", label: "Réserver" },
        },
        {
          testId: "padel",
          title: "Padel",
          description: "Deux courts internationaux sous les palmiers. Réservation par créneau.",
          features: ["Courts neufs (2025)", "Raquettes incluses", "Coach disponible"],
          price: "12 000 XOF",
          priceSuffix: "/ heure / court",
          image: "https://images.unsplash.com/photo-1554062614-6da4fa67725a?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/reserver", label: "Réserver" },
        },
        {
          testId: "paddle-canoe",
          title: "Paddle & Canoë",
          description: "L'exploration douce de la lagune et des criques cachées.",
          features: ["Gilet de sauvetage inclus", "Carte des criques fournie", "Idéal en famille"],
          price: "10 000 XOF",
          priceSuffix: "/ heure",
          image: "https://images.unsplash.com/photo-1526761122248-c31c93f8b2b9?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/reserver", label: "Réserver" },
        },
        {
          testId: "quad",
          title: "Quad",
          description: "Circuit côtier de 45 minutes à travers les pistes et la cocoteraie.",
          features: ["Casque + brief sécurité", "Encadrant motorisé", "Photos souvenir incluses"],
          price: "40 000 XOF",
          priceSuffix: "/ quad / 45 min",
          image: "https://images.unsplash.com/photo-1567204395950-e2eb2e89e93e?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/reserver", label: "Réserver" },
        },
        {
          testId: "buggy",
          title: "Buggy",
          description: "Buggy biplace pour explorer la côte sauvage à 2.",
          features: ["Buggy 2 places", "Circuit guidé 1h", "Pause photo plage"],
          price: "55 000 XOF",
          priceSuffix: "/ buggy / 1h",
          image: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/reserver", label: "Réserver" },
        },
        {
          testId: "multisports",
          title: "Multisports",
          description: "Beach volley, beach soccer, pétanque, ping-pong. Équipement libre.",
          features: ["Accès libre aux résidents", "Équipement gracieusement prêté", "Tournois hebdo"],
          price: "Inclus",
          priceSuffix: "pour les résidents",
          image: "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80",
          cta: { to: "/reserver", label: "En savoir plus" },
          badge: "Gratuit",
        },
      ]}
      highlights={[
        {
          icon: <Zap size={32} strokeWidth={1.5} />,
          title: "Équipements premium",
          body: "Tous nos équipements sont récents (≤ 2 ans) et entretenus quotidiennement.",
        },
        {
          icon: <Target size={32} strokeWidth={1.5} />,
          title: "Encadrants brevetés",
          body: "Tous nos moniteurs sont diplômés (BEES, BPJEPS) et formés à la sécurité.",
        },
        {
          icon: <Award size={32} strokeWidth={1.5} />,
          title: "Packs sportifs",
          body: "Combinez plusieurs activités et bénéficiez de tarifs préférentiels (-15% dès 2 activités).",
        },
      ]}
      finalCta={{
        image: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=2400&q=85",
        title: "Quelle aventure aujourd'hui ?",
        body: "Réservation conseillée, surtout en week-end. Les créneaux populaires partent vite.",
        to: "/reserver",
        label: "Réserver mon activité",
      }}
    />
  );
}

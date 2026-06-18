/**
 * Vitrine — Page de demande de devis (`/devis`).
 *
 * Page dédiée hébergeant le formulaire de devis Corporate / Activités /
 * Événement privé. Accepte ``?type=corporate|activites|prive`` pour
 * pré-sélectionner la catégorie et afficher un hero contextuel.
 */
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CorporateQuoteForm from "../../components/vitrine/CorporateQuoteForm";

const HERO_BY_TYPE = {
  corporate: {
    kicker: "Devis Corporate",
    title: "Construisons votre événement.",
    sub: "Séminaires, journées d'étude, team building. Notre équipe vous répond sous 24h.",
    image: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/oy7zzngs_SEMINAIRE.png",
  },
  activites: {
    kicker: "Devis Activités",
    title: "Une journée sur-mesure sur la lagune.",
    sub: "Jet ski, paddle, kayak, privatisations. Nous composons votre programme idéal.",
    image: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/ocqva33h_ACTIVITE.png",
  },
  prive: {
    kicker: "Devis Privatisation",
    title: "Privatisez votre île.",
    sub: "Anniversaires, mariages, événements signature. Votre événement, sans limites.",
    image: "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/ivhtbefz_BBR%20_SHOOT%202_15.jpg",
  },
};

export default function VitrineDevis() {
  const [params] = useSearchParams();
  const type = params.get("type") || "corporate";
  const hero = HERO_BY_TYPE[type] || HERO_BY_TYPE.corporate;

  return (
    <div className="bg-white text-[#0A0A0A]" data-testid="vitrine-devis">
      <section className="relative h-[55vh] min-h-[400px] flex items-end overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${hero.image})` }} />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 w-full px-6 pb-16 text-center text-white">
          <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/80 mb-6">
            {hero.kicker}
          </div>
          <h1 className="font-serif font-light text-4xl md:text-6xl leading-[1.05] max-w-4xl mx-auto">
            {hero.title}
          </h1>
          <p className="mt-6 text-base md:text-lg text-white/75 max-w-2xl mx-auto font-light leading-relaxed">
            {hero.sub}
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 pt-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[0.6rem] tracking-[0.4em] uppercase text-[#0A0A0A]/55 hover:text-[#B8922A] transition-colors"
          data-testid="devis-back-home"
        >
          <ArrowLeft size={13} /> Retour à l'accueil
        </Link>
      </div>

      <CorporateQuoteForm contextType={type} />
    </div>
  );
}

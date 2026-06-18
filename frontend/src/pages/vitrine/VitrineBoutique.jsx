/**
 * Boutique — Placeholder (to be implemented).
 *
 * Keeps the hamburger menu "Boutique" link functional while we design
 * the actual shop module in a future iteration.
 */
import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";

export default function VitrineBoutique() {
  return (
    <div className="bg-white text-[#0A0A0A] min-h-[calc(100vh-180px)] flex items-center"
         data-testid="vitrine-boutique">
      <div className="max-w-2xl mx-auto px-6 py-32 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-10 border border-[#0A0A0A]/15">
          <ShoppingBag size={24} strokeWidth={1.2} />
        </div>
        <div className="text-[0.65rem] tracking-[0.45em] uppercase text-[#0A0A0A]/55 mb-6">
          Boutique
        </div>
        <h1 className="font-serif italic font-light text-4xl md:text-6xl leading-[1.05] mb-8">
          Bientôt en boutique.
        </h1>
        <p className="text-base md:text-lg text-[#0A0A0A]/70 leading-[1.85] mb-10 font-light">
          La boutique officielle BBR ouvre ses portes très prochainement.
          Articles signature, cosmétiques, art de vivre, prêt-à-porter et accessoires
          inspirés de l'art de recevoir Boulay Beach Resort.
        </p>
        <Link
          to="/"
          className="inline-block text-[0.7rem] tracking-[0.32em] uppercase border-b border-[#0A0A0A] pb-1 hover:text-[#B8922A] hover:border-[#B8922A] transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

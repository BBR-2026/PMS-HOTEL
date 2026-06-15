import { Link } from "react-router-dom";
import { UtensilsCrossed, UserPlus, Clock } from "lucide-react";

const BBR_LOGO =
  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png";

export default function CantineLanding() {
  return (
    <div className="min-h-screen bg-[#FAF7F2]" data-testid="cantine-landing">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-10 sm:mb-12">
          <img
            src={BBR_LOGO}
            alt="Boulay Beach Resort"
            className="h-14 w-auto object-contain mx-auto mb-6"
          />
          <div className="text-[0.62rem] uppercase tracking-[0.3em] text-[#B8922A] mb-2 inline-flex items-center gap-1.5">
            <UtensilsCrossed size={11} /> Cantine du personnel
          </div>
          <h1 className="font-display-serif text-3xl sm:text-5xl text-[#0A0A0A] mb-3 leading-tight">
            Gestion de la Cantine
          </h1>
          <p className="text-sm sm:text-base text-[#0A0A0A]/65 max-w-md mx-auto">
            Inscrivez-vous puis réservez votre repas de demain en moins de 10 secondes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Link
            to="/cantine/inscription"
            data-testid="cantine-create-account-card"
            className="group bg-white border border-[#0A0A0A]/10 hover:border-[#B8922A] p-7 transition-all flex flex-col items-start gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-[#B8922A]/10 flex items-center justify-center group-hover:bg-[#B8922A] group-hover:text-white transition-colors text-[#B8922A]">
              <UserPlus size={22} strokeWidth={1.6} />
            </div>
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.25em] text-[#B8922A] mb-1.5">
                Étape 1
              </div>
              <div className="font-display-serif text-2xl text-[#0A0A0A] mb-1.5">
                Créer mon compte
              </div>
              <p className="text-sm text-[#0A0A0A]/60">
                Renseignez vos infos une seule fois et recevez votre code Cantine unique.
              </p>
            </div>
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] mt-auto pt-2">
              Commencer →
            </div>
          </Link>

          <Link
            to="/cantine/reserver"
            data-testid="cantine-reserve-card"
            className="group bg-white border border-[#0A0A0A]/10 hover:border-[#B8922A] p-7 transition-all flex flex-col items-start gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-[#B8922A]/10 flex items-center justify-center group-hover:bg-[#B8922A] group-hover:text-white transition-colors text-[#B8922A]">
              <Clock size={22} strokeWidth={1.6} />
            </div>
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.25em] text-[#B8922A] mb-1.5">
                Étape 2
              </div>
              <div className="font-display-serif text-2xl text-[#0A0A0A] mb-1.5">
                Cantine de demain
              </div>
              <p className="text-sm text-[#0A0A0A]/60">
                Confirmez votre présence avec votre code Cantine. Inscription jusqu&apos;à minuit.
              </p>
            </div>
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[#B8922A] mt-auto pt-2">
              Réserver →
            </div>
          </Link>
        </div>

        <p className="text-center text-[0.7rem] text-[#0A0A0A]/40 mt-10 leading-relaxed">
          Boulay Beach Resort — Cantine du personnel · Tous droits réservés
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import api from "../lib/api";
import { useLang } from "../context/LanguageContext";
import OfferCard from "../components/OfferCard";

const IMG_PASS_DAY = "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/ivhtbefz_BBR%20_SHOOT%202_15.jpg";
const IMG_SUNSET = "https://static.prod-images.emergentagent.com/jobs/4dc6ae3e-af48-4489-bfe0-ebc522484ad7/images/9e89b22524180e785f62f14ed8558a699ccd6bdf1259b8dea5c13cc732cb44c5.png";
const IMG_BRUNCH = "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/2hilix5p_BBR%20_SHOOT%202_29.jpg";

const IMG_BY_ID = {
  pass_day: IMG_PASS_DAY,
  sunset: IMG_SUNSET,
  brunch: IMG_BRUNCH,
};

export default function LandingPage() {
  const { t } = useLang();
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    api.get("/offers").then((r) => setOffers(r.data)).catch(() => {});
  }, []);

  const bulletsByOffer = {
    pass_day: t.offers.passDayBullets,
    sunset: t.offers.sunsetBullets,
    brunch: t.offers.brunchBullets,
  };

  return (
    <div data-testid="landing-page" className="bg-white text-[#0A0A0A] min-h-screen">
      <section
        id="offers"
        className="pt-44 md:pt-56 pb-24 md:pb-32 px-6 md:px-12 lg:px-24"
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 md:mb-20 max-w-2xl">
            <h2 className="font-display-serif text-4xl md:text-5xl lg:text-6xl text-[#0A0A0A] tracking-tight leading-[1.05] mb-6">
              {t.offers.title}
            </h2>
            <div className="gold-divider mb-6" />
            <p className="text-base text-[#0A0A0A]/60 leading-relaxed">{t.offers.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {offers.map((offer, i) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                image={IMG_BY_ID[offer.id]}
                bullets={bulletsByOffer[offer.id]}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Notre Histoire — BBR brand story page.
 *
 * Editorial layout using the same UniversPage hero header pattern + a
 * rich storytelling body (paragraphs, milestones timeline, two-column
 * image+text blocks).
 */
import { Link } from "react-router-dom";
import { ArrowRight, Compass, Anchor, Heart } from "lucide-react";

const MILESTONES = [
  { year: "2018", title: "L'idée", body: "L'envie folle de transformer l'Île Boulay en destination d'exception. Premiers croquis, premières équipes." },
  { year: "2020", title: "La construction", body: "Les premiers bungalows sortent de terre. Un projet pensé en respect du site naturel, en pierre, bois et toiles écrues." },
  { year: "2022", title: "L'ouverture", body: "Le Beach Club et les premières suites accueillent leurs hôtes. Le Sunset Saturday devient un rituel d'Abidjan." },
  { year: "2024", title: "L'épanouissement", body: "Ouverture du restaurant signature Le KAAÏ, lancement des Memberships BBR Cards, premières privatisations événementielles." },
  { year: "2026", title: "La nouvelle étape", body: "60+ suites, 5 univers complets, un Revenue Engine intégré. L'Île devient une destination à part entière, à dix minutes du Plateau." },
];

export default function NotreHistoire() {
  return (
    <div className="bg-white text-[#0A0A0A]" data-testid="notre-histoire">
      {/* HERO — same pattern as univers pages */}
      <section className="relative h-[60vh] min-h-[460px] flex items-end overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/ivhtbefz_BBR%20_SHOOT%202_15.jpg)" }} />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 w-full px-6 pb-16 md:pb-20 text-center text-white">
          <div className="text-[0.65rem] tracking-[0.5em] uppercase text-white/80 mb-6">
            Notre maison
          </div>
          <h1 className="font-serif font-light text-5xl md:text-7xl leading-[1.05] max-w-4xl mx-auto">
            Notre histoire.
          </h1>
          <p className="mt-8 text-base md:text-lg text-white/80 max-w-2xl mx-auto font-light leading-relaxed">
            Une île, une vision, et la passion d'inventer l'art de recevoir en Côte d'Ivoire.
          </p>
        </div>
      </section>

      {/* Manifesto */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-6">
            · Notre récit ·
          </div>
          <h2 className="font-serif font-light text-3xl md:text-5xl leading-[1.15] mb-10">
            L'Île Boulay,<br />une promesse devenue un lieu.
          </h2>
          <div className="space-y-6 text-base md:text-lg leading-[1.85] text-[#0A0A0A]/75 font-light">
            <p>
              Il y a quelques années, une équipe d'amoureux d'Abidjan a regardé
              l'Île Boulay et y a vu autre chose qu'une simple presqu'île. Ils
              y ont vu une destination. Un lieu pour ralentir, partager, célébrer.
              Un lieu où, dès la traversée en pinasse, le temps prend un autre rythme.
            </p>
            <p>
              Boulay Beach Resort est né de cette conviction&nbsp;: que la Côte d'Ivoire
              mérite un grand resort, à la fois ancré dans son territoire et ouvert
              sur le monde. Une maison qui réinvente l'art de recevoir en mettant
              le service, la cuisine, l'architecture et la musique au même niveau d'exigence.
            </p>
            <p>
              Aujourd'hui, BBR est devenu plus qu'un resort&nbsp;: c'est un terrain de jeu,
              un atelier d'événements, un théâtre culinaire, un lieu de retraites et de
              fêtes. Cinq univers, une même intention&nbsp;: que chaque visiteur reparte
              avec un souvenir précis, et l'envie de revenir.
            </p>
          </div>
          <div className="w-12 h-px bg-[#B8922A] mx-auto mt-14" />
        </div>
      </section>

      {/* Piliers */}
      <section className="py-20 md:py-28 bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-5">
              · Nos piliers ·
            </div>
            <h2 className="font-serif font-light text-3xl md:text-5xl leading-tight">
              Trois convictions qui guident chaque détail.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            <Pillar icon={<Compass size={28} strokeWidth={1.5} />} title="L'âme du lieu"
              body="Chaque salle, chaque transat, chaque assiette est pensé pour révéler la beauté brute de l'Île Boulay — pas pour la cacher." />
            <Pillar icon={<Heart size={28} strokeWidth={1.5} />} title="Le service signature"
              body="Une attention sincère, jamais ostentatoire. Notre équipe vous reconnaît, anticipe et discrètement enchante chaque moment." />
            <Pillar icon={<Anchor size={28} strokeWidth={1.5} />} title="L'ancrage ivoirien"
              body="Producteurs locaux, artisans ivoiriens, équipes formées sur place. BBR est une maison ivoirienne dans l'âme et dans le cœur." />
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="text-[0.6rem] tracking-[0.55em] uppercase text-[#B8922A] mb-5">
              · Étapes clés ·
            </div>
            <h2 className="font-serif font-light text-3xl md:text-5xl leading-tight">
              De l'idée au resort.
            </h2>
          </div>
          <ol className="relative border-l border-[#B8922A]/30 pl-8 md:pl-12 space-y-12">
            {MILESTONES.map((m) => (
              <li key={m.year} className="relative" data-testid={`milestone-${m.year}`}>
                <span className="absolute -left-[37px] md:-left-[49px] top-1 w-3 h-3 bg-[#B8922A] rounded-full" />
                <div className="text-[0.6rem] tracking-[0.5em] uppercase text-[#B8922A] mb-2">
                  {m.year}
                </div>
                <h3 className="font-serif text-2xl md:text-3xl mb-3">{m.title}</h3>
                <p className="text-base text-[#0A0A0A]/70 leading-relaxed font-light max-w-xl">
                  {m.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/2hilix5p_BBR%20_SHOOT%202_29.jpg)" }} />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center text-white">
          <h2 className="font-serif font-light text-3xl md:text-5xl leading-tight mb-8">
            Venez écrire la suite avec nous.
          </h2>
          <p className="text-base md:text-lg text-white/75 max-w-xl mx-auto leading-relaxed font-light mb-10">
            Chaque visite ajoute une page à notre histoire. La vôtre commence dès la prochaine traversée.
          </p>
          <Link to="/#univers"
            className="inline-flex items-center gap-3 text-[0.7rem] tracking-[0.35em] uppercase text-white border-b border-white pb-2 hover:text-[#D4B256] hover:border-[#D4B256] transition-colors"
            data-testid="histoire-cta-univers">
            Découvrir nos univers <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Pillar({ icon, title, body }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 text-[#B8922A] border border-[#B8922A] mb-6">
        {icon}
      </div>
      <h3 className="font-serif font-light text-2xl mb-4">{title}</h3>
      <p className="text-sm text-[#0A0A0A]/70 leading-relaxed font-light">{body}</p>
    </div>
  );
}

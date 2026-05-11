export default function StaffPlaceholder({ title, description }) {
  return (
    <div className="p-10 max-w-4xl mx-auto" data-testid={`placeholder-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <h1 className="font-display-serif text-3xl md:text-4xl text-[#0A0A0A] mb-2">{title}</h1>
      <p className="text-sm text-[#0A0A0A]/55 mb-10">{description}</p>
      <div className="border border-dashed border-[#B8922A]/40 bg-[#FAFAF7] p-12 text-center">
        <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[#B8922A] mb-3">Module en développement</div>
        <p className="text-sm text-[#0A0A0A]/55 max-w-md mx-auto">
          Ce module sera livré dans une prochaine itération. La structure backend
          et l'accès par rôle sont déjà en place.
        </p>
      </div>
    </div>
  );
}

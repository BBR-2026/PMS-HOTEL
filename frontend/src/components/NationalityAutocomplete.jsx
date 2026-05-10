import { useEffect, useMemo, useRef, useState } from "react";
import { searchNationalities } from "../lib/nationalities";

/**
 * Autocomplete input for nationality.
 * Filters a built-in list (FR / EN) as the user types and lets them pick
 * a suggestion with mouse or keyboard (Arrow + Enter).
 */
export default function NationalityAutocomplete({
  label,
  value,
  onChange,
  lang = "fr",
  testId,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  const suggestions = useMemo(
    () => searchNationalities(value || "", lang, 8),
    [value, lang]
  );

  // Close on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Reset highlight when suggestions change
  useEffect(() => setHighlight(0), [suggestions.length]);

  const select = (val) => {
    onChange({ target: { value: val } });
    setOpen(false);
  };

  const handleKey = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="label-luxury">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        className="input-luxury"
        data-testid={testId}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute left-0 right-0 z-30 mt-1 bg-white border border-[#0A0A0A]/15 shadow-lg max-h-64 overflow-y-auto"
          data-testid={`${testId}-suggestions`}
        >
          {suggestions.map((s, i) => (
            <li
              key={s}
              onMouseDown={(e) => {
                e.preventDefault();
                select(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                i === highlight
                  ? "bg-[#B8922A]/10 text-[#B8922A]"
                  : "text-[#0A0A0A] hover:bg-[#FAFAF7]"
              }`}
              data-testid={`${testId}-option-${i}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

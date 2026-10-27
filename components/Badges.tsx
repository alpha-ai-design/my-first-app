// Standard Indian food marks: green square + dot (veg), brown square + triangle (non-veg).
export function VegMark({ veg, className = "" }: { veg: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
      title={veg ? "Veg" : "Non-veg"}
      className={`inline-grid h-4 w-4 shrink-0 place-items-center border-2 bg-white ${
        veg ? "border-green-700" : "border-[#8b3a1a]"
      } ${className}`}
    >
      {veg ? (
        <span className="h-2 w-2 rounded-full bg-green-700" />
      ) : (
        <span className="h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-[#8b3a1a]" />
      )}
    </span>
  );
}

const spiceLabels = ["Not spicy", "Mild", "Medium spicy", "Hot"];

export function SpiceLevel({ level }: { level: number }) {
  if (level <= 0) return null;
  return (
    <span className="inline-flex items-center text-xs" role="img" aria-label={spiceLabels[level]} title={spiceLabels[level]}>
      {Array.from({ length: level }, (_, i) => (
        <span key={i} aria-hidden>
          🌶️
        </span>
      ))}
    </span>
  );
}

export function BestsellerBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-dark">
      ★ Bestseller
    </span>
  );
}

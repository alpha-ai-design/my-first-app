import { formatINR } from "@/lib/cart";

// Standard Indian food marks: green square + dot (veg), brown square + triangle (non-veg).
export function VegMark({ veg, className = "", decorative = false }: { veg: boolean; className?: string; decorative?: boolean }) {
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : veg ? "Vegetarian" : "Non-vegetarian"}
      aria-hidden={decorative || undefined}
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

// Veg mark with a visible "Veg" / "Non-veg" text label.
export function VegLabel({ veg }: { veg: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-caption font-semibold ${veg ? "text-green-800" : "text-[#8b3a1a]"}`}>
      <VegMark veg={veg} decorative />
      {veg ? "Veg" : "Non-veg"}
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
    <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[12px] font-semibold text-brand-dark">
      ★ Bestseller
    </span>
  );
}

// "20% off" / "₹30 off" on dishes with an offer.
export function OfferBadge({ label }: { label: string }) {
  return <span className="inline-flex items-center rounded-full bg-green-700 px-2 py-0.5 text-[12px] font-bold text-white">{label}</span>;
}

// Original price struck through, then the offer price.
export function OfferPrice({ base, price }: { base: number; price: number }) {
  if (price >= base) return <>{formatINR(base)}</>;
  return (
    <>
      <s className="font-normal text-stone-500" aria-label={`was ${formatINR(base)}`}>
        {formatINR(base)}
      </s>{" "}
      <span className="text-green-800">{formatINR(price)}</span>
    </>
  );
}

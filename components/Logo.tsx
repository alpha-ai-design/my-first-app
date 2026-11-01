// Text-only logo: a red-and-gold "seal" plus the wordmark, no images.
export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span
        className={`grid place-items-center rounded-md bg-brand font-display text-gold ring-2 ring-gold/70 ${
          big ? "h-14 w-14 text-3xl" : "h-8 w-8 text-heading"
        }`}
        aria-hidden
      >
        Xu
      </span>
      <span className="leading-none">
        <span
          className={`block font-display uppercase tracking-wide text-white ${big ? "text-3xl" : "text-heading"}`}
        >
          Xu <span className="text-gold">Noodles</span>
        </span>
        <span
          className={`block uppercase ${big ? "tracking-[0.25em]" : ""} text-gold-light/90 ${big ? "text-xs mt-1" : "mt-0.5 text-[12px] tracking-[0.12em]"}`}
        >
          Indo-Chinese Kitchen
        </span>
      </span>
    </span>
  );
}

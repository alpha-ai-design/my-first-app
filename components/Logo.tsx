// Text-only logo: a red-and-gold "seal" plus the wordmark, no images.
export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span
        className={`grid place-items-center rounded-md bg-brand font-display text-gold ring-2 ring-gold/70 ${
          big ? "h-14 w-14 text-3xl" : "h-9 w-9 text-xl"
        }`}
        aria-hidden
      >
        Xu
      </span>
      <span className="leading-none">
        <span
          className={`block font-display uppercase tracking-wide text-white ${big ? "text-3xl" : "text-xl"}`}
        >
          Xu <span className="text-gold">Noodles</span>
        </span>
        <span
          className={`block uppercase tracking-[0.25em] text-gold-light/80 ${big ? "text-xs mt-1" : "text-[9px] mt-0.5"}`}
        >
          Indo-Chinese Kitchen
        </span>
      </span>
    </span>
  );
}

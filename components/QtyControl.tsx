export default function QtyControl({
  qty,
  onMinus,
  onPlus,
  size = "md",
}: {
  qty: number;
  onMinus: () => void;
  onPlus: () => void;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-8" : "h-9";
  return (
    <div className={`inline-flex ${h} items-center overflow-hidden rounded-lg bg-brand text-white shadow-sm`}>
      <button type="button" onClick={onMinus} className="h-full w-9 text-lg font-bold hover:bg-brand-dark" aria-label="Decrease quantity">
        −
      </button>
      <span className="min-w-6 text-center font-bold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button type="button" onClick={onPlus} className="h-full w-9 text-lg font-bold hover:bg-brand-dark" aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}

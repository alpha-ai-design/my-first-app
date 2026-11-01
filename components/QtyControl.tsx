export default function QtyControl({
  qty,
  onMinus,
  onPlus,
}: {
  qty: number;
  onMinus: () => void;
  onPlus: () => void;
  size?: "sm" | "md"; // both sizes are 36px tall (minimum touch target)
}) {
  return (
    <div className={`inline-flex h-9 items-center overflow-hidden rounded-lg bg-brand text-white shadow-sm`}>
      <button type="button" onClick={onMinus} className="h-full w-9 text-body font-bold hover:bg-brand-dark" aria-label="Decrease quantity">
        −
      </button>
      <span className="min-w-6 text-center text-body font-bold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button type="button" onClick={onPlus} className="h-full w-9 text-body font-bold hover:bg-brand-dark" aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}

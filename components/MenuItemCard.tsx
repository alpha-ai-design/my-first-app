"use client";

import type { MenuItem } from "@/data/menu";
import { formatINR, lineKey, useCart } from "@/lib/cart";
import { BestsellerBadge, SpiceLevel, VegLabel } from "./Badges";
import QtyControl from "./QtyControl";

export default function MenuItemCard({
  item,
  onChoosePortion,
}: {
  item: MenuItem;
  onChoosePortion: (item: MenuItem) => void;
}) {
  const { lines, add, decrement } = useCart();
  const itemLines = lines.filter((l) => l.itemId === item.id);
  const qty = itemLines.reduce((s, l) => s + l.qty, 0);
  const hasPortions = !!item.portions?.length;
  const soldOut = !!item.soldOut;

  const handleAdd = () => (hasPortions ? onChoosePortion(item) : add(item.id));
  // For Half/Full items, "−" removes from the most recently added portion.
  const handleMinus = () => {
    const last = itemLines[itemLines.length - 1];
    if (last) decrement(last.key);
  };

  const priceLabel = hasPortions
    ? item.portions!.map((p) => `${p.label} ${formatINR(p.price)}`).join(" · ")
    : formatINR(item.price);

  return (
    <article
      className={`flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70 sm:p-4 ${soldOut ? "opacity-60 grayscale" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <VegLabel veg={item.veg} />
          {item.bestseller && <BestsellerBadge />}
          {soldOut && (
            <span className="inline-flex items-center rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-stone-700">
              Sold out
            </span>
          )}
        </div>
        <h3 className="mt-1.5 font-bold leading-snug">{item.name}</h3>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="font-semibold text-ink">{priceLabel}</span>
          <SpiceLevel level={item.spice} />
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-stone-500">{item.description}</p>
      </div>

      <div className="flex w-28 shrink-0 flex-col items-center sm:w-32">
        <div
          className={`grid aspect-square w-full place-items-center rounded-xl bg-linear-to-br ${item.color} shadow-inner`}
          aria-hidden
        >
          <span className="text-5xl drop-shadow-md sm:text-6xl">{item.emoji}</span>
        </div>
        <div className="-mt-4">
          {soldOut ? (
            <button
              type="button"
              disabled
              className="h-9 cursor-not-allowed rounded-lg border-2 border-stone-300 bg-white px-6 text-sm font-extrabold uppercase text-stone-400 shadow-md"
              aria-label={`${item.name} is sold out`}
            >
              Add
            </button>
          ) : qty > 0 ? (
            <QtyControl qty={qty} onMinus={handleMinus} onPlus={handleAdd} />
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              className="h-9 rounded-lg border-2 border-brand bg-white px-6 text-sm font-extrabold uppercase text-brand shadow-md transition hover:bg-brand hover:text-white"
              aria-label={`Add ${item.name}`}
            >
              Add
            </button>
          )}
        </div>
        {hasPortions && <span className="mt-1 text-[10px] text-stone-400">Half / Full</span>}
      </div>
    </article>
  );
}

"use client";

import type { MenuItem } from "@/data/menu";
import { offerPrice, useCart } from "@/lib/cart";
import { useMenu } from "@/lib/menu";
import { offerBadge } from "@/lib/pricing";
import { BestsellerBadge, OfferBadge, OfferPrice, SpiceLevel, VegLabel } from "./Badges";
import QtyControl from "./QtyControl";

export default function MenuItemCard({
  item,
  onChoosePortion,
}: {
  item: MenuItem;
  onChoosePortion: (item: MenuItem) => void;
}) {
  const { lines, add, decrement } = useCart();
  const { offers } = useMenu();
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

  // Offer prices per portion (or for the single price).
  const prices = hasPortions
    ? item.portions!.map((p) => ({ label: p.label, base: p.price, ...offerPrice(item, p.label, offers) }))
    : [{ label: "", base: item.price, ...offerPrice(item, undefined, offers) }];
  const applied = prices.find((p) => p.applied)?.applied;

  return (
    <article
      className={`flex gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70 ${soldOut ? "opacity-60 grayscale" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <VegLabel veg={item.veg} />
          {item.bestseller && <BestsellerBadge />}
          {applied && !soldOut && <OfferBadge label={offerBadge(applied.offer)} />}
          {soldOut && (
            <span className="inline-flex items-center rounded-full bg-stone-200 px-2 py-0.5 text-[12px] font-semibold text-stone-800">Sold out</span>
          )}
        </div>
        <h3 className="mt-1 text-body font-semibold leading-snug">{item.name}</h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
          <span className="text-body font-semibold text-ink">
            {prices.map((p, i) => (
              <span key={p.label || "price"}>
                {i > 0 && " · "}
                {p.label && `${p.label} `}
                <OfferPrice base={p.base} price={p.price} />
              </span>
            ))}
          </span>
          <SpiceLevel level={item.spice} />
        </div>
        <p className="mt-1 line-clamp-2 text-caption text-stone-600">{item.description}</p>
      </div>

      <div className="flex w-24 shrink-0 flex-col items-center">
        <div className={`grid aspect-square w-full place-items-center rounded-lg bg-linear-to-br ${item.color} shadow-inner`} aria-hidden>
          <span className="text-4xl drop-shadow-md">{item.emoji}</span>
        </div>
        <div className="-mt-4">
          {soldOut ? (
            <button
              type="button"
              disabled
              className="h-9 cursor-not-allowed rounded-lg border-2 border-stone-300 bg-white px-5 text-caption font-bold uppercase text-stone-500 shadow-md"
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
              className="h-9 rounded-lg border-2 border-brand bg-white px-5 text-caption font-extrabold uppercase text-brand shadow-md transition hover:bg-brand hover:text-white"
              aria-label={`Add ${item.name}`}
            >
              Add
            </button>
          )}
        </div>
        {hasPortions && <span className="mt-1 text-[12px] text-stone-600">Half / Full</span>}
      </div>
    </article>
  );
}

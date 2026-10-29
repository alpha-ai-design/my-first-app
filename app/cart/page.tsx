"use client";

import Link from "next/link";
import { GST_RATE } from "@/data/menu";
import { formatINR, unitPrice, useCart } from "@/lib/cart";
import { VegMark } from "@/components/Badges";
import QtyControl from "@/components/QtyControl";

export default function CartPage() {
  const { lines, getItem, add, decrement, remove, count, itemTotal, gst, grandTotal, hydrated } = useCart();

  if (!hydrated) return <main className="min-h-[60dvh]" />;

  if (count === 0) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
        <p className="text-7xl" aria-hidden>
          🍜
        </p>
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-1 text-stone-500">Hungry? Our noodles are waiting.</p>
        <Link href="/" className="mt-6 rounded-xl bg-brand px-6 py-3 font-bold text-white shadow hover:bg-brand-dark">
          Browse menu
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-32 pt-4">
      <Link href="/" className="text-sm font-semibold text-brand">
        ← Add more items
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Your cart</h1>

      <ul className="mt-4 divide-y divide-stone-100 rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70">
        {lines.map((line) => {
          const item = getItem(line.itemId);
          if (!item) return null;
          const price = unitPrice(item, line.portion);
          return (
            <li key={line.key} className="flex items-start gap-3 p-4">
              <VegMark veg={item.veg} className="mt-1" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{item.name}</p>
                <p className="text-sm text-stone-500">
                  {line.portion ? `${line.portion} · ` : ""}
                  {formatINR(price)}
                </p>
                {item.soldOut && <p className="text-sm font-semibold text-red-600">Sold out right now. Please remove it.</p>}
                <button type="button" onClick={() => remove(line.key)} className="mt-1 text-xs font-semibold text-stone-500 underline hover:text-brand">
                  Remove
                </button>
              </div>
              <div className="flex flex-col items-end gap-1">
                <QtyControl size="sm" qty={line.qty} onMinus={() => decrement(line.key)} onPlus={() => add(line.itemId, line.portion)} />
                <span className="font-semibold tabular-nums">{formatINR(price * line.qty)}</span>
              </div>
            </li>
          );
        })}
      </ul>


      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
        <h2 className="font-bold">Bill summary</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-600">Item total</dt>
            <dd className="tabular-nums">{formatINR(itemTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-600">GST ({Math.round(GST_RATE * 100)}%)</dt>
            <dd className="tabular-nums">{formatINR(gst)}</dd>
          </div>
          <div className="flex justify-between border-t border-dashed border-stone-300 pt-2 text-base font-bold">
            <dt>Grand total</dt>
            <dd className="tabular-nums">{formatINR(grandTotal)}</dd>
          </div>
        </dl>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <Link
          href="/checkout"
          className="mx-auto flex max-w-xl items-center justify-between rounded-xl bg-brand px-4 py-3.5 font-bold text-white shadow-lg hover:bg-brand-dark"
        >
          <span>{formatINR(grandTotal)} · {count} {count === 1 ? "item" : "items"}</span>
          <span className="uppercase tracking-wide">Checkout →</span>
        </Link>
      </div>
    </main>
  );
}

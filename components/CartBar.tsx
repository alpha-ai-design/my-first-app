"use client";

import Link from "next/link";
import { formatINR, useCart } from "@/lib/cart";

// Sticky bottom bar shown on the menu page whenever the cart has items.
export default function CartBar() {
  const { count, itemTotal, hydrated } = useCart();
  if (!hydrated || count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <Link
        href="/cart"
        className="mx-auto flex max-w-xl items-center justify-between rounded-xl bg-brand px-4 py-3.5 text-white shadow-xl ring-2 ring-gold/60 hover:bg-brand-dark"
      >
        <span className="font-semibold">
          {count} {count === 1 ? "item" : "items"} | {formatINR(itemTotal)}
        </span>
        <span className="flex items-center gap-1 font-extrabold uppercase tracking-wide">
          View Cart <span aria-hidden>→</span>
        </span>
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { formatINR, useCart } from "@/lib/cart";

// Sticky bottom bar shown on the menu page whenever the cart has items.
export default function CartBar() {
  const { count, itemTotal, discount, hydrated } = useCart();
  if (!hydrated || count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <Link
        href="/cart"
        className="mx-auto flex min-h-11 max-w-xl items-center justify-between rounded-xl bg-brand px-4 py-2.5 text-body text-white shadow-xl ring-2 ring-gold/60 hover:bg-brand-dark"
      >
        <span className="font-semibold">
          {count} {count === 1 ? "item" : "items"} · {formatINR(itemTotal - discount)}
          {discount > 0 && <span className="ml-1.5 text-caption font-semibold text-gold-light">(saved {formatINR(discount)})</span>}
        </span>
        <span className="flex items-center gap-1 font-bold">
          View cart <span aria-hidden>→</span>
        </span>
      </Link>
    </div>
  );
}

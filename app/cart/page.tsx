"use client";

import ErrorBoundary from "@/components/ErrorBoundary";
import Link from "next/link";
import { OfferPrice, VegMark } from "@/components/Badges";
import QtyControl from "@/components/QtyControl";
import BillLines from "@/components/BillLines";
import { formatINR, offerPrice, unitPrice, useCart } from "@/lib/cart";
import { useMenu } from "@/lib/menu";
import { useSettings } from "@/lib/settings";

export default function CartPage() {
  const cart = useCart();
  const { lines, getItem, add, decrement, remove, count, hydrated } = cart;
  const { offers } = useMenu();
  const { settings } = useSettings();

  if (!hydrated) return <main className="min-h-[60dvh]" />;

  if (count === 0) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center">
        <p className="text-6xl" aria-hidden>
          🍜
        </p>
        <h1 className="mt-3 text-title font-bold">Your cart is empty</h1>
        <p className="mt-1 text-stone-600">Hungry? Our noodles are waiting.</p>
        <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand px-6 font-bold text-white shadow hover:bg-brand-dark">
          Browse menu
        </Link>
      </main>
    );
  }

  const deliveryFee = settings?.delivery_fee ?? 0;
  const total = cart.grandTotal + deliveryFee;
  const shortBy = settings ? settings.min_order - cart.itemTotal : 0;

  return (
    <main className="mx-auto max-w-xl px-4 pb-28 pt-3">
      <Link href="/" className="inline-flex min-h-9 items-center text-caption font-semibold text-brand">
        ← Add more items
      </Link>
      <h1 className="text-title font-bold">Your cart</h1>

      <ErrorBoundary name="cart items" compact>
        <ul className="mt-3 divide-y divide-stone-100 rounded-xl bg-white shadow-sm ring-1 ring-stone-200/70">
          {lines.map((line) => {
            const item = getItem(line.itemId);
            if (!item) return null;
            const base = unitPrice(item, line.portion);
            const { price } = offerPrice(item, line.portion, offers);
            return (
              <li key={line.key} className="flex items-start gap-3 p-3">
                <VegMark veg={item.veg} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{item.name}</p>
                  <p className="text-caption text-stone-600">
                    {line.portion ? `${line.portion} · ` : ""}
                    <OfferPrice base={base} price={price} />
                  </p>
                  {item.soldOut && <p className="text-caption font-semibold text-red-700">Sold out right now. Please remove it.</p>}
                  <button
                    type="button"
                    onClick={() => remove(line.key)}
                    className="-ml-1 min-h-9 px-1 text-caption font-semibold text-stone-600 underline hover:text-brand"
                  >
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
      </ErrorBoundary>

      {cart.nextOffer && (
        <p className="mt-3 rounded-xl bg-gold/25 p-3 text-caption font-semibold text-brand-dark">
          <span aria-hidden>🏷️ </span>
          Add {formatINR(cart.nextOffer.gap)} more to get {formatINR(cart.nextOffer.discount)} off
        </p>
      )}

      <section className="mt-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70">
        <h2 className="text-heading font-bold">Bill summary</h2>
        <ErrorBoundary name="cart bill" compact>
          <BillLines subtotal={cart.itemTotal} discount={cart.discount} gst={cart.gst} deliveryFee={deliveryFee} total={total} />
        </ErrorBoundary>
        <p className="mt-2 text-caption text-stone-600">Pay on delivery with cash or UPI.</p>
      </section>

      {shortBy > 0 && (
        <p className="mt-3 rounded-xl bg-gold/20 p-3 text-caption font-semibold text-brand-dark">
          Minimum order is {formatINR(settings!.min_order)}. Add {formatINR(shortBy)} more to check out.
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <Link
          href="/checkout"
          className="mx-auto flex min-h-11 max-w-xl items-center justify-between rounded-xl bg-brand px-4 py-2.5 font-bold text-white shadow-lg hover:bg-brand-dark"
        >
          <span>
            {formatINR(total)} · {count} {count === 1 ? "item" : "items"}
          </span>
          <span>Checkout →</span>
        </Link>
      </div>
    </main>
  );
}

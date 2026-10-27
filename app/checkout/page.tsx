"use client";

import Link from "next/link";
import { useState } from "react";
import { formatINR, getItem, unitPrice, useCart } from "@/lib/cart";
import { VegMark } from "@/components/Badges";

type OrderType = "dine-in" | "takeaway";

type PlacedOrder = {
  number: string;
  name: string;
  phone: string;
  type: OrderType;
  table?: string;
  note: string;
  items: { key: string; name: string; veg: boolean; portion?: string; qty: number; total: number }[];
  itemTotal: number;
  gst: number;
  grandTotal: number;
  placedAt: string;
};

// Indian mobile numbers: 10 digits starting with 6, 7, 8 or 9.
const MOBILE_RE = /^[6-9]\d{9}$/;

function makeOrderNumber() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `XU-${n}`;
}

export default function CheckoutPage() {
  const cart = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<OrderType>("dine-in");
  const [table, setTable] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<PlacedOrder | null>(null);

  if (order) return <Confirmation order={order} />;

  if (!cart.hydrated) return <main className="min-h-[60dvh]" />;

  if (cart.count === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Nothing to check out</h1>
        <p className="mt-1 text-stone-500">Add a few dishes to your cart first.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-brand px-6 py-3 font-bold text-white">
          Browse menu
        </Link>
      </main>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Please enter your name.";
    if (!MOBILE_RE.test(phone)) e.phone = "Enter a valid 10-digit mobile number (starts with 6–9).";
    if (type === "dine-in" && !table.trim()) e.table = "Please enter your table number.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const placeOrder = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    const items = cart.lines.flatMap((l) => {
      const item = getItem(l.itemId);
      if (!item) return [];
      return [{ key: l.key, name: item.name, veg: item.veg, portion: l.portion, qty: l.qty, total: unitPrice(item, l.portion) * l.qty }];
    });

    setOrder({
      number: makeOrderNumber(),
      name: name.trim(),
      phone,
      type,
      table: type === "dine-in" ? table.trim() : undefined,
      note: cart.note.trim(),
      items,
      itemTotal: cart.itemTotal,
      gst: cart.gst,
      grandTotal: cart.grandTotal,
      placedAt: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    });
    cart.clear();
    window.scrollTo({ top: 0 });
  };

  const inputCls = (err?: string) =>
    `mt-1 h-12 w-full rounded-xl border bg-white px-3 text-base outline-none focus:ring-2 ${
      err ? "border-red-500 focus:ring-red-200" : "border-stone-300 focus:border-brand focus:ring-brand/20"
    }`;

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-4">
      <Link href="/cart" className="text-sm font-semibold text-brand">
        ← Back to cart
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Checkout</h1>

      <form onSubmit={placeOrder} noValidate className="mt-4 space-y-4">
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
          <label className="block">
            <span className="text-sm font-semibold">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className={inputCls(errors.name)}
              aria-invalid={!!errors.name}
            />
            {errors.name && <span className="mt-1 block text-sm text-red-600">{errors.name}</span>}
          </label>

          <label className="block">
            <span className="text-sm font-semibold">Mobile number</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-stone-500">+91</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                className={`${inputCls(errors.phone)} pl-12 tracking-wide`}
                aria-invalid={!!errors.phone}
              />
            </div>
            {errors.phone && <span className="mt-1 block text-sm text-red-600">{errors.phone}</span>}
          </label>

          <fieldset>
            <legend className="text-sm font-semibold">Order type</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ["dine-in", "🍽️", "Dine-in"],
                  ["takeaway", "🛍️", "Takeaway"],
                ] as const
              ).map(([value, icon, label]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 py-3 font-semibold transition ${
                    type === value ? "border-brand bg-brand/5 text-brand" : "border-stone-200"
                  }`}
                >
                  <input type="radio" name="type" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
                  <span aria-hidden>{icon}</span> {label}
                </label>
              ))}
            </div>
          </fieldset>

          {type === "dine-in" && (
            <label className="block">
              <span className="text-sm font-semibold">Table number</span>
              <input
                value={table}
                onChange={(e) => setTable(e.target.value.slice(0, 6))}
                inputMode="numeric"
                placeholder="e.g. 7"
                className={inputCls(errors.table)}
                aria-invalid={!!errors.table}
              />
              {errors.table && <span className="mt-1 block text-sm text-red-600">{errors.table}</span>}
            </label>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
          <div className="flex justify-between text-sm">
            <span className="text-stone-600">
              {cart.count} {cart.count === 1 ? "item" : "items"} · incl. GST {formatINR(cart.gst)}
            </span>
            <span className="font-bold">{formatINR(cart.grandTotal)}</span>
          </div>
          {cart.note.trim() && <p className="mt-2 text-sm text-stone-500">Note: “{cart.note.trim()}”</p>}
        </div>

        <button type="submit" className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white shadow-lg hover:bg-brand-dark">
          Place order · {formatINR(cart.grandTotal)}
        </button>
        <p className="text-center text-xs text-stone-500">Pay at the counter. No online payment needed.</p>
      </form>
    </main>
  );
}

function Confirmation({ order }: { order: PlacedOrder }) {
  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-6">
      <div className="rounded-2xl bg-ink p-6 text-center text-white shadow-lg">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-600 text-3xl" aria-hidden>
          ✓
        </div>
        <h1 className="mt-3 text-2xl font-bold">Order placed!</h1>
        <p className="mt-1 text-white/70">Thank you, {order.name}. Our wok is already firing up.</p>
        <p className="mt-4 text-xs uppercase tracking-[0.3em] text-gold">Order number</p>
        <p className="font-display text-4xl text-gold">{order.number}</p>
        <p className="mt-3 text-sm text-white/80">
          {order.type === "dine-in" ? `Dine-in · Table ${order.table}` : "Takeaway"} · +91 {order.phone}
        </p>
        <p className="text-xs text-white/50">{order.placedAt}</p>
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
        <h2 className="font-bold">Order summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {order.items.map((i) => (
            <li key={i.key} className="flex items-start gap-2">
              <VegMark veg={i.veg} className="mt-0.5" />
              <span className="flex-1">
                {i.qty} × {i.name}
                {i.portion && <span className="text-stone-500"> ({i.portion})</span>}
              </span>
              <span className="tabular-nums">{formatINR(i.total)}</span>
            </li>
          ))}
        </ul>
        {order.note && <p className="mt-3 rounded-lg bg-cream p-2 text-sm">Cooking note: “{order.note}”</p>}
        <dl className="mt-3 space-y-1 border-t border-dashed border-stone-300 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-600">Item total</dt>
            <dd className="tabular-nums">{formatINR(order.itemTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-600">GST (5%)</dt>
            <dd className="tabular-nums">{formatINR(order.gst)}</dd>
          </div>
          <div className="flex justify-between text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatINR(order.grandTotal)}</dd>
          </div>
        </dl>
      </section>

      <Link href="/" className="mt-6 block rounded-xl bg-brand py-3.5 text-center font-bold text-white shadow hover:bg-brand-dark">
        Back to menu
      </Link>
    </main>
  );
}

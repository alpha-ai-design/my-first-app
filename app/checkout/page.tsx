"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatINR, unitPrice, useCart } from "@/lib/cart";
import { placeOrder, saveOrder, type OrderType } from "@/lib/orders";

// Indian mobile numbers: 10 digits starting with 6, 7, 8 or 9.
const MOBILE_RE = /^[6-9]\d{9}$/;

export default function CheckoutPage() {
  const cart = useCart();
  const router = useRouter();
  const [type, setType] = useState<OrderType>("dine_in");
  const [table, setTable] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false); // blocks a second tap before the re-render disables the button
  const [placed, setPlaced] = useState(false);

  if (!cart.hydrated || placed) return <main className="min-h-[60dvh]" />;

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
    if (type === "dine_in" && !table.trim()) e.table = "Please enter your table number.";
    if (type === "takeaway") {
      if (!name.trim()) e.name = "Please enter your name.";
      if (!MOBILE_RE.test(phone)) e.phone = "Enter a valid 10-digit mobile number (starts with 6–9).";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (placingRef.current || !validate()) return;
    placingRef.current = true;
    setPlacing(true);
    setSubmitError("");

    const lines = cart.lines.flatMap((l) => {
      const item = cart.getItem(l.itemId);
      return item ? [{ line: l, item }] : [];
    });

    try {
      const id = await placeOrder({
        type,
        table: type === "dine_in" ? table.trim() : "",
        name: type === "takeaway" ? name.trim() : "",
        phone: type === "takeaway" ? phone : "",
        items: lines.map(({ line }) => ({
          menu_item_id: line.itemId,
          portion: line.portion ? line.portion.toLowerCase() : null,
          quantity: line.qty,
        })),
      });
      saveOrder({
        id,
        type,
        table: type === "dine_in" ? table.trim() : undefined,
        items: lines.map(({ line, item }) => ({
          name: item.name,
          veg: item.veg,
          portion: line.portion,
          qty: line.qty,
          total: unitPrice(item, line.portion) * line.qty,
        })),
        placedAt: new Date().toISOString(),
      });
      setPlaced(true);
      cart.clear();
      router.replace(`/order/${id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      placingRef.current = false;
      setPlacing(false);
    }
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

      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
          <fieldset>
            <legend className="text-sm font-semibold">Order type</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ["dine_in", "🍽️", "Dine-in"],
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

          {type === "dine_in" ? (
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
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
          <div className="flex justify-between text-sm">
            <span className="text-stone-600">
              {cart.count} {cart.count === 1 ? "item" : "items"} · incl. GST {formatINR(cart.gst)}
            </span>
            <span className="font-bold">{formatINR(cart.grandTotal)}</span>
          </div>
        </div>

        {submitError && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={placing}
          className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white shadow-lg hover:bg-brand-dark disabled:cursor-wait disabled:opacity-70"
        >
          {placing ? "Placing order..." : `Place order · ${formatINR(cart.grandTotal)}`}
        </button>
        <p className="text-center text-xs text-stone-500">Pay at the counter. No online payment needed.</p>
      </form>
    </main>
  );
}

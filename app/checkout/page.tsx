"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GST_RATE } from "@/data/menu";
import { formatINR, unitPrice, useCart } from "@/lib/cart";
import { emptyCustomer, getSavedCustomer, saveCustomer, type CustomerDetails } from "@/lib/customer";
import { placeOrder, saveOrder } from "@/lib/orders";
import { useSettings } from "@/lib/settings";

// Indian mobile numbers: 10 digits starting with 6, 7, 8 or 9.
const MOBILE_RE = /^[6-9]\d{9}$/;
const NOTES_MAX = 200;

type Errors = Partial<Record<keyof CustomerDetails, string>>;

export default function CheckoutPage() {
  const cart = useCart();
  const router = useRouter();
  const settings = useSettings();
  const [details, setDetails] = useState<CustomerDetails>(emptyCustomer);
  const [editing, setEditing] = useState(true); // false = show the saved address with a "Change" link
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState("");
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false); // blocks a second tap before the re-render disables the button
  const [placed, setPlaced] = useState(false);

  // Repeat customers: start from the details saved on this phone.
  useEffect(() => {
    const saved = getSavedCustomer();
    if (saved) {
      setDetails(saved.details);
      setEditing(!saved.complete);
    }
  }, []);

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

  const deliveryFee = settings?.delivery_fee ?? 0;
  const total = cart.grandTotal + deliveryFee;
  const shortBy = settings ? settings.min_order - cart.itemTotal : 0;

  const set = (field: keyof CustomerDetails, value: string) => {
    setDetails((d) => ({ ...d, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const e: Errors = {};
    if (!details.name.trim()) e.name = "Please enter your name.";
    if (!MOBILE_RE.test(details.phone)) e.phone = "Enter a valid 10-digit mobile number (starts with 6–9).";
    if (!details.society.trim()) e.society = "Please enter your society.";
    if (!details.tower.trim()) e.tower = "Please enter your tower or block.";
    if (!details.flatNumber.trim()) e.flatNumber = "Please enter your flat number.";
    setErrors(e);
    if (Object.keys(e).length > 0) setEditing(true);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (placingRef.current || shortBy > 0 || !validate()) return;
    placingRef.current = true;
    setPlacing(true);
    setSubmitError("");

    const lines = cart.lines.flatMap((l) => {
      const item = cart.getItem(l.itemId);
      return item ? [{ line: l, item }] : [];
    });
    const trimmed: CustomerDetails = {
      name: details.name.trim(),
      phone: details.phone,
      society: details.society.trim(),
      tower: details.tower.trim(),
      flatNumber: details.flatNumber.trim(),
      landmark: details.landmark.trim(),
    };

    try {
      const id = await placeOrder({
        ...trimmed,
        notes: notes.trim(),
        items: lines.map(({ line }) => ({
          menu_item_id: line.itemId,
          portion: line.portion ? line.portion.toLowerCase() : null,
          quantity: line.qty,
        })),
      });
      saveCustomer(trimmed);
      saveOrder({
        id,
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

  const field = (
    key: keyof CustomerDetails,
    label: React.ReactNode,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    hint?: string,
  ) => (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input
        value={details[key]}
        onChange={(e) => set(key, e.target.value)}
        className={inputCls(errors[key])}
        aria-invalid={!!errors[key]}
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
      {errors[key] && <span className="mt-1 block text-sm text-red-600">{errors[key]}</span>}
    </label>
  );

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-4">
      <Link href="/cart" className="text-sm font-semibold text-brand">
        ← Back to cart
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Checkout</h1>

      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
          {!editing ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-stone-500">Delivering to</p>
                <p className="mt-1 font-bold">
                  {details.name} · +91 {details.phone}
                </p>
                <p className="text-stone-700">
                  Flat {details.flatNumber}, {details.tower}, {details.society}
                </p>
                {details.landmark && <p className="text-stone-500">Gate / landmark: {details.landmark}</p>}
              </div>
              <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-sm font-bold text-brand underline">
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-bold">Delivery details</h2>
              {field("name", "Name", { autoComplete: "name" })}

              <label className="block">
                <span className="text-sm font-semibold">Mobile number</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-stone-500">+91</span>
                  <input
                    type="tel"
                    value={details.phone}
                    onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="98765 43210"
                    className={`${inputCls(errors.phone)} pl-12 tracking-wide`}
                    aria-invalid={!!errors.phone}
                  />
                </div>
                {errors.phone && <span className="mt-1 block text-sm text-red-600">{errors.phone}</span>}
              </label>

              {field("society", "Society", { placeholder: "e.g. Gaur City 2" }, "We deliver within about 3 km of Gaur City 2.")}

              {field("tower", "Tower / Block", { placeholder: "e.g. 14th Avenue, Tower B" })}
              {field("flatNumber", "Flat number", { placeholder: "e.g. 1204" })}
              {field(
                "landmark",
                <>
                  Gate / landmark <span className="font-normal text-stone-500">(optional)</span>
                </>,
              )}
            </div>
          )}
        </section>

        <label className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
          <span className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">
              Cooking instructions <span className="font-normal text-stone-500">(optional)</span>
            </span>
            <span className="text-xs tabular-nums text-stone-500">
              {notes.length}/{NOTES_MAX}
            </span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
            rows={2}
            maxLength={NOTES_MAX}
            placeholder="e.g. less spicy, no onion-garlic"
            className="mt-2 w-full resize-none rounded-lg border border-stone-300 p-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">Subtotal</dt>
              <dd className="tabular-nums">{formatINR(cart.itemTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">GST ({Math.round(GST_RATE * 100)}%)</dt>
              <dd className="tabular-nums">{formatINR(cart.gst)}</dd>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between">
                <dt className="text-stone-600">Delivery fee</dt>
                <dd className="tabular-nums">{formatINR(deliveryFee)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-stone-300 pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatINR(total)}</dd>
            </div>
          </dl>
        </section>

        {shortBy > 0 && (
          <p className="rounded-xl bg-gold/20 p-3 text-sm font-semibold text-brand-dark">
            Minimum order is {formatINR(settings!.min_order)}. Add {formatINR(shortBy)} more to place your order.
          </p>
        )}

        {submitError && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={placing || shortBy > 0}
          className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white shadow-lg hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {placing ? "Placing order..." : `Place order · Pay ${formatINR(total)} on delivery`}
        </button>
        <p className="text-center text-xs text-stone-500">Pay on delivery with cash or UPI.</p>
      </form>
    </main>
  );
}

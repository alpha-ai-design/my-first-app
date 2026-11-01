"use client";

import ErrorBoundary from "@/components/ErrorBoundary";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BillLines from "@/components/BillLines";
import { formatINR, unitPrice, useCart } from "@/lib/cart";
import { emptyCustomer, getSavedCustomer, saveCustomer, type CustomerDetails } from "@/lib/customer";
import { useMenu } from "@/lib/menu";
import { PriceChangedError, placeOrder, saveOrder } from "@/lib/orders";
import { reloadSettings, useSettings } from "@/lib/settings";

// Indian mobile numbers: 10 digits starting with 6, 7, 8 or 9.
const MOBILE_RE = /^[6-9]\d{9}$/;
const NOTES_MAX = 200;
const PRICE_CHANGED_MESSAGE = "Prices changed because an offer just ended. Please check your new total.";

type Errors = Partial<Record<keyof CustomerDetails, string>>;

export default function CheckoutPage() {
  const cart = useCart();
  const router = useRouter();
  const { settings, failed: settingsFailed } = useSettings();
  const { refresh: refreshMenu } = useMenu();
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
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-title font-bold">Nothing to check out</h1>
        <p className="mt-1 text-stone-600">Add a few dishes to your cart first.</p>
        <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand px-6 font-bold text-white">
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
    if (placingRef.current || !settings || shortBy > 0 || !validate()) return;
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
        expectedTotal: total, // the server refuses the order if its total differs
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
      if (err instanceof PriceChangedError) {
        // An offer started or ended: load the new prices and let the customer check them. The cart stays.
        reloadSettings();
        await refreshMenu();
        setSubmitError(PRICE_CHANGED_MESSAGE);
      } else {
        setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
      placingRef.current = false;
      setPlacing(false);
    }
  };

  const inputCls = (err?: string) =>
    `mt-1 h-11 w-full rounded-lg border bg-white px-3 text-body outline-none focus:ring-2 ${
      err ? "border-red-500 focus:ring-red-200" : "border-stone-300 focus:border-brand focus:ring-brand/20"
    }`;

  const field = (key: keyof CustomerDetails, label: React.ReactNode, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div>
      <label className="block">
        <span className="text-caption font-semibold">{label}</span>
        <input
          value={details[key]}
          onChange={(e) => set(key, e.target.value)}
          className={inputCls(errors[key])}
          aria-invalid={!!errors[key]}
          aria-describedby={[hint && `hint-${key}`, errors[key] && `err-${key}`].filter(Boolean).join(" ") || undefined}
          {...props}
        />
      </label>
      {hint && (
        <span id={`hint-${key}`} className="mt-1 block text-caption text-stone-600">
          {hint}
        </span>
      )}
      {errors[key] && (
        <span id={`err-${key}`} className="mt-1 block text-caption font-semibold text-red-700">
          {errors[key]}
        </span>
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-xl px-4 pb-12 pt-3">
      <Link href="/cart" className="inline-flex min-h-9 items-center text-caption font-semibold text-brand">
        ← Back to cart
      </Link>
      <h1 className="text-title font-bold">Checkout</h1>

      <form onSubmit={submit} noValidate className="mt-3 space-y-3">
        <section className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70">
          {!editing ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption font-semibold text-stone-600">Delivering to</p>
                <p className="mt-1 font-bold">
                  {details.name} · +91 {details.phone}
                </p>
                <p className="text-stone-700">
                  Flat {details.flatNumber}, {details.tower}, {details.society}
                </p>
                {details.landmark && <p className="text-caption text-stone-600">Gate / landmark: {details.landmark}</p>}
              </div>
              <button type="button" onClick={() => setEditing(true)} className="min-h-9 shrink-0 px-1 font-bold text-brand underline">
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-heading font-bold">Delivery details</h2>
              {field("name", "Name", { autoComplete: "name" })}

              <label className="block">
                <span className="text-caption font-semibold">Mobile number</span>
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
                {errors.phone && <span className="mt-1 block text-caption font-semibold text-red-700">{errors.phone}</span>}
              </label>

              {field("society", "Society", { placeholder: "e.g. Gaur City 2" }, "We deliver within about 3 km of Gaur City 2.")}

              {field("tower", "Tower / Block", { placeholder: "e.g. 14th Avenue, Tower B" })}
              {field("flatNumber", "Flat number", { placeholder: "e.g. 1204" })}
              {field(
                "landmark",
                <>
                  Gate / landmark <span className="font-normal text-stone-600">(optional)</span>
                </>,
              )}
            </div>
          )}
        </section>

        <label className="block rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70">
          <span className="flex items-baseline justify-between">
            <span className="text-caption font-semibold">
              Cooking instructions <span className="font-normal text-stone-600">(optional)</span>
            </span>
            <span className="text-caption tabular-nums text-stone-600">
              {notes.length}/{NOTES_MAX}
            </span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
            rows={2}
            maxLength={NOTES_MAX}
            placeholder="e.g. less spicy, no onion-garlic"
            className="mt-1.5 w-full resize-none rounded-lg border border-stone-300 p-2.5 text-body outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <section className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70">
          <ErrorBoundary name="checkout bill" compact>
            <BillLines subtotal={cart.itemTotal} discount={cart.discount} gst={cart.gst} deliveryFee={deliveryFee} total={total} />
          </ErrorBoundary>
        </section>

        {shortBy > 0 && (
          <p className="rounded-xl bg-gold/20 p-3 text-caption font-semibold text-brand-dark">
            Minimum order is {formatINR(settings!.min_order)}. Add {formatINR(shortBy)} more to place your order.
          </p>
        )}

        {submitError && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-caption font-semibold text-red-700 ring-1 ring-red-200">
            {submitError}
          </p>
        )}

        {settingsFailed && !settings && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-caption font-semibold text-red-700 ring-1 ring-red-200">
            Couldn&apos;t load the delivery charges. Please check your connection and refresh the page.
          </p>
        )}

        <button
          type="submit"
          disabled={placing || !settings || shortBy > 0}
          className="min-h-11 w-full rounded-xl bg-brand px-4 py-2.5 font-bold text-white shadow-lg hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {placing ? "Placing order..." : !settings ? "Loading prices…" : `Place order · Pay ${formatINR(total)} on delivery`}
        </button>
        <p className="text-center text-caption text-stone-600">Pay on delivery with cash or UPI.</p>
      </form>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { VegMark } from "@/components/Badges";
import { formatINR } from "@/lib/cart";
import { getOrderStatus, getSavedOrder, type OrderStatus, type SavedOrder } from "@/lib/orders";

const POLL_MS = 5000;

// Minutes until it should arrive, counted from when the restaurant accepted the order.
function minutesLeft(s: OrderStatus): number | null {
  if (s.prep_minutes == null) return null;
  if (!s.accepted_at) return s.prep_minutes;
  const arriveAt = new Date(s.accepted_at).getTime() + s.prep_minutes * 60_000;
  return Math.ceil((arriveAt - Date.now()) / 60_000);
}

function StatusMessage({ status }: { status: OrderStatus }) {
  switch (status.status) {
    case "pending":
      return (
        <>
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-gold" aria-hidden />
          <p className="mt-4 text-lg font-bold">Waiting for the restaurant to confirm...</p>
        </>
      );
    case "accepted": {
      const mins = minutesLeft(status);
      return (
        <>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-600 text-3xl" aria-hidden>
            ✓
          </div>
          <p className="mt-3 text-lg font-bold">
            {mins == null
              ? "Accepted!"
              : mins > 0
                ? `Accepted! Arriving in about ${mins} ${mins === 1 ? "minute" : "minutes"}.`
                : "Should be with you any moment."}
          </p>
        </>
      );
    }
    case "rejected":
      return (
        <>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand text-3xl" aria-hidden>
            ✕
          </div>
          <p className="mt-3 text-lg font-bold">
            Sorry, your order couldn&apos;t be accepted{status.reject_reason ? `: ${status.reject_reason}` : "."}
          </p>
        </>
      );
    case "cancelled":
      return (
        <>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stone-600 text-3xl" aria-hidden>
            ✕
          </div>
          <p className="mt-3 text-lg font-bold">
            This order was cancelled{status.reject_reason ? `: ${status.reject_reason}` : "."}
          </p>
        </>
      );
    default:
      return <p className="text-lg font-bold">Order status: {status.status}</p>;
  }
}

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [saved, setSaved] = useState<SavedOrder | undefined>();
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => setSaved(getSavedOrder(id)), [id]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const s = await getOrderStatus(id);
        if (cancelled) return;
        setFailed(false);
        if (s) setStatus(s);
        else setNotFound(true);
      } catch (err) {
        console.error("get_order_status failed", err);
        if (!cancelled) setFailed(true);
      }
    };
    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">We couldn&apos;t find this order</h1>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-brand px-6 py-3 font-bold text-white">
          Back to menu
        </Link>
      </main>
    );
  }

  const awaitingPayment = status?.status === "pending" || status?.status === "accepted";

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-6">
      <div className="rounded-2xl bg-ink p-6 text-center text-white shadow-lg" aria-live="polite">
        {status ? (
          <>
            <h1 className="mb-4 font-display text-4xl text-gold">Order #{status.order_number}</h1>
            <StatusMessage status={status} />
          </>
        ) : (
          <p className="text-white/70">Checking your order…</p>
        )}
        {saved && (
          <p className="mt-3 text-sm text-white/60">
            Placed {new Date(saved.placedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}
        {failed && <p className="mt-3 text-xs text-gold">Having trouble reaching the restaurant. Still trying…</p>}
      </div>

      {status && awaitingPayment && (
        <p className="mt-4 rounded-2xl bg-gold/25 p-4 text-center font-bold text-brand-dark">
          Pay {formatINR(Number(status.total))} on delivery: cash or UPI
        </p>
      )}

      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
        <h2 className="font-bold">Your order</h2>
        {saved ? (
          <ul className="mt-3 space-y-2 text-sm">
            {saved.items.map((i, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <VegMark veg={i.veg} className="mt-0.5" />
                <span className="flex-1">
                  {i.qty} × {i.name}
                  {i.portion && <span className="text-stone-500"> ({i.portion})</span>}
                </span>
                <span className="tabular-nums">{formatINR(i.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-stone-500">Dish details are only saved on the phone that placed the order.</p>
        )}

        {status?.notes && <p className="mt-3 rounded-lg bg-cream p-2 text-sm">Cooking instructions: “{status.notes}”</p>}

        {status && (
          <dl className="mt-3 space-y-1 border-t border-dashed border-stone-300 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">Subtotal</dt>
              <dd className="tabular-nums">{formatINR(Number(status.subtotal))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">GST (5%)</dt>
              <dd className="tabular-nums">{formatINR(Number(status.gst))}</dd>
            </div>
            {Number(status.delivery_fee) > 0 && (
              <div className="flex justify-between">
                <dt className="text-stone-600">Delivery fee</dt>
                <dd className="tabular-nums">{formatINR(Number(status.delivery_fee))}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatINR(Number(status.total))}</dd>
            </div>
          </dl>
        )}
      </section>

      <Link href="/" className="mt-6 block rounded-xl bg-brand py-3.5 text-center font-bold text-white shadow hover:bg-brand-dark">
        Back to menu
      </Link>
    </main>
  );
}

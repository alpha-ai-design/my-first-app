"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { VegMark } from "@/components/Badges";
import BillLines from "@/components/BillLines";
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
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-gold" aria-hidden />
          <p className="mt-3 text-heading font-bold">Waiting for the restaurant to confirm...</p>
        </>
      );
    case "accepted": {
      const mins = minutesLeft(status);
      return (
        <>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-700 text-2xl" aria-hidden>
            ✓
          </div>
          <p className="mt-2 text-heading font-bold">
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
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand text-2xl" aria-hidden>
            ✕
          </div>
          <p className="mt-2 text-heading font-bold">
            Sorry, your order couldn&apos;t be accepted{status.reject_reason ? `: ${status.reject_reason}` : "."}
          </p>
        </>
      );
    case "cancelled":
      return (
        <>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-stone-600 text-2xl" aria-hidden>
            ✕
          </div>
          <p className="mt-2 text-heading font-bold">
            This order was cancelled{status.reject_reason ? `: ${status.reject_reason}` : "."}
          </p>
        </>
      );
    default:
      return <p className="text-heading font-bold">Order status: {status.status}</p>;
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
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-title font-bold">We couldn&apos;t find this order</h1>
        <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand px-6 font-bold text-white">
          Back to menu
        </Link>
      </main>
    );
  }

  const awaitingPayment = status?.status === "pending" || status?.status === "accepted";

  return (
    <main className="mx-auto max-w-xl px-4 pb-12 pt-4">
      <div className="rounded-xl bg-ink p-4 text-center text-white shadow-lg" aria-live="polite">
        {status ? (
          <>
            <h1 className="mb-3 font-display text-title text-gold">Order #{status.order_number}</h1>
            <StatusMessage status={status} />
          </>
        ) : (
          <p className="text-white/70">Checking your order…</p>
        )}
        {saved && (
          <p className="mt-2 text-caption text-white/75">
            Placed {new Date(saved.placedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}
        {failed && <p className="mt-2 text-caption text-gold">Having trouble reaching the restaurant. Still trying…</p>}
      </div>

      {status && awaitingPayment && (
        <p className="mt-3 rounded-xl bg-gold/25 p-3 text-center font-bold text-brand-dark">
          Pay {formatINR(Number(status.total))} on delivery: cash or UPI
        </p>
      )}

      <section className="mt-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70">
        <h2 className="text-heading font-bold">Your order</h2>
        {saved ? (
          <ul className="mt-2 space-y-1.5">
            {saved.items.map((i, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <VegMark veg={i.veg} className="mt-0.5" />
                <span className="flex-1">
                  {i.qty} × {i.name}
                  {i.portion && <span className="text-stone-600"> ({i.portion})</span>}
                </span>
                <span className="tabular-nums">{formatINR(i.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-caption text-stone-600">Dish details are only saved on the phone that placed the order.</p>
        )}

        {status?.notes && <p className="mt-3 rounded-lg bg-cream p-2 text-caption">Cooking instructions: “{status.notes}”</p>}

        {status && (
          <div className="mt-3 border-t border-dashed border-stone-300 pt-1">
            <BillLines
              subtotal={Number(status.subtotal)}
              discount={Number(status.discount ?? 0)}
              gst={Number(status.gst)}
              deliveryFee={Number(status.delivery_fee)}
              total={Number(status.total)}
            />
          </div>
        )}
      </section>

      <Link href="/" className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-brand text-center font-bold text-white shadow hover:bg-brand-dark">
        Back to menu
      </Link>
    </main>
  );
}

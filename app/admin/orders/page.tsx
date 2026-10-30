"use client";

import ErrorBoundary from "@/components/ErrorBoundary";
import { useState } from "react";
import { isUrgent, useShift } from "@/components/admin/AdminShell";
import { VegMark } from "@/components/Badges";
import { formatTimeIST, minutesSince } from "@/lib/admin/ist";
import {
  acceptOrder,
  cancelOrder,
  dueAt,
  formatAddress,
  markSoldOutUntilMorning,
  rejectOrder,
  type AdminOrder,
  type UpdateResult,
} from "@/lib/admin/orders";
import { formatINR } from "@/lib/cart";

const PREP_CHIPS = [30, 40, 50];
const REJECT_REASONS = ["Item sold out", "Kitchen too busy", "Too far to deliver", "Closing soon"];
const CANCEL_REASONS = ["Customer not available", "Customer refused", "Other"];

// Primary actions (Accept, Reject) stay 44px tall on phones; other buttons and chips 40px.
const btn = "min-h-11 rounded-lg px-4 font-bold disabled:opacity-50 md:min-h-10";
const chip = "min-h-10 rounded-lg border-2 border-stone-300 bg-white px-3 font-semibold active:bg-stone-100 disabled:opacity-50";

export default function AdminOrdersPage() {
  const { pending, accepted, loaded, loadError } = useShift();

  return (
    <main className="mx-auto max-w-[1200px] space-y-6 px-3 pt-3 sm:px-4">
      {loadError && (
        <p role="alert" className="rounded-xl bg-red-100 p-3 font-bold text-red-800">
          Can&apos;t reach the server. Retrying… Check the internet connection.
        </p>
      )}

      <section aria-labelledby="new-heading">
        <h1 id="new-heading" className="mb-2 text-title font-bold">
          New <span className="font-semibold text-stone-600">({pending.length})</span>
        </h1>
        {!loaded ? (
          <p className="text-stone-600">Loading orders…</p>
        ) : pending.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-center text-stone-600">No new orders. The chime will ring when one comes in.</p>
        ) : (
          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((o) => (
              <ErrorBoundary key={o.id} name={`order ${o.order_number}`} compact>
                <NewOrderCard order={o} />
              </ErrorBoundary>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="accepted-heading">
        <h2 id="accepted-heading" className="mb-2 text-heading font-bold">
          Accepted today <span className="font-semibold text-stone-600">({accepted.length})</span>
        </h2>
        {loaded && accepted.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-center text-stone-600">No accepted orders yet today.</p>
        ) : (
          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accepted.map((o) => (
              <ErrorBoundary key={o.id} name={`order ${o.order_number}`} compact>
                <AcceptedOrderCard order={o} />
              </ErrorBoundary>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// Runs a save, blocks double taps, and handles "already closed" and errors the same way everywhere.
function useSave() {
  const { refresh, notify } = useShift();
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<UpdateResult>, onOk?: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (result === "closed") notify("This order was already closed");
      else await onOk?.();
    } catch (err) {
      console.error("Saving failed", err);
      notify("Couldn't save. Check the internet and try again.");
    } finally {
      await refresh();
      setBusy(false);
    }
  };
  return { busy, run };
}

function Address({ order }: { order: AdminOrder }) {
  return (
    <div className="leading-snug">
      <p className="font-semibold">{formatAddress(order)}</p>
      {order.landmark && <p className="text-stone-600">Landmark: {order.landmark}</p>}
    </div>
  );
}

function Customer({ order }: { order: AdminOrder }) {
  return (
    <>
      <p className="font-bold">{order.customer_name}</p>
      <a
        href={`tel:+91${order.customer_phone}`}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-stone-100 px-3 font-bold tracking-wide text-ink"
      >
        <span aria-hidden>📞</span> {order.customer_phone}
      </a>
    </>
  );
}

function StatusLabel({ text, tone }: { text: string; tone: "new" | "urgent" | "accepted" }) {
  const cls = { new: "bg-blue-700", urgent: "bg-red-700", accepted: "bg-green-700" }[tone];
  return <span className={`rounded-md px-2 py-0.5 text-[12px] font-extrabold uppercase tracking-wide text-white ${cls}`}>{text}</span>;
}

function NewOrderCard({ order }: { order: AdminOrder }) {
  const { vegById, defaultPrep, now, notify } = useShift();
  const { busy, run } = useSave();
  const [mode, setMode] = useState<"main" | "reject" | "soldout">("main");
  const mins = minutesSince(order.created_at, now);
  const urgent = isUrgent(order, now);

  // One chip per dish (Half and Full of the same dish are one dish).
  const dishes = [...new Map(order.order_items.filter((i) => i.menu_item_id).map((i) => [i.menu_item_id!, i.name])).entries()];

  const accept = (minutes: number) => run(() => acceptOrder(order.id, minutes));
  const reject = (reason: string) => run(() => rejectOrder(order.id, reason));
  const soldOut = (menuItemId: string, name: string) =>
    run(
      () => rejectOrder(order.id, `Item sold out: ${name}`),
      () =>
        markSoldOutUntilMorning(menuItemId).catch((err) => {
          console.error("Could not mark dish sold out", err);
          notify(`Order rejected, but couldn't mark ${name} sold out. Check the internet.`);
        }),
    );

  return (
    <article
      className={`rounded-xl border-2 bg-white p-3 shadow-sm ${urgent ? "flash-urgent border-red-600" : "border-blue-600"}`}
      aria-label={`Order ${order.order_number}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-heading font-extrabold">Order #{order.order_number}</h2>
        <StatusLabel text={urgent ? "Urgent · New" : "New"} tone={urgent ? "urgent" : "new"} />
      </div>
      <p className={`text-caption font-semibold ${urgent ? "text-red-700" : "text-stone-600"}`}>
        Placed {mins === 0 ? "just now" : `${mins} min ago`} · {formatTimeIST(order.created_at)}
      </p>

      <div className="mt-2 space-y-1.5 border-t border-stone-200 pt-2">
        <Customer order={order} />
        <Address order={order} />
      </div>

      <ul className="mt-2 space-y-1 border-t border-stone-200 pt-2">
        {order.order_items.map((item) => {
          const veg = item.menu_item_id ? vegById.get(item.menu_item_id) : undefined;
          return (
            <li key={item.id} className="flex items-start gap-2">
              {veg !== undefined ? <VegMark veg={veg} className="mt-0.5" /> : <span className="w-4" />}
              <span className="flex-1">
                <span className="font-extrabold">{item.quantity} ×</span> {item.name}
                {item.portion && <span className="font-bold text-stone-600"> ({item.portion === "half" ? "Half" : "Full"})</span>}
                {veg !== undefined && <span className="ml-1.5 text-caption text-stone-600">{veg ? "Veg" : "Non-veg"}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {order.notes && (
        <p className="mt-2 rounded-lg border-2 border-yellow-500 bg-yellow-100 p-2 font-semibold text-yellow-950">
          <span className="block text-[12px] font-extrabold uppercase tracking-wide">Cooking instructions</span>
          {order.notes}
        </p>
      )}

      <p className="mt-2 text-heading font-extrabold">Collect {formatINR(Number(order.total))}</p>

      <div className="mt-3 border-t border-stone-200 pt-3">
        {mode === "main" && (
          <div className="space-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => accept(defaultPrep)}
              className={`${btn} min-h-11 w-full bg-green-700 text-heading text-white`}
            >
              {busy ? "Saving…" : `Accept · ${defaultPrep} min`}
            </button>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Accept with a different prep time">
              {PREP_CHIPS.map((m) => (
                <button key={m} type="button" disabled={busy} onClick={() => accept(m)} className={chip}>
                  {m} min
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("reject")}
              className={`${btn} w-full border-2 border-red-700 bg-white text-red-700`}
            >
              Reject
            </button>
          </div>
        )}

        {mode === "reject" && (
          <div className="space-y-2">
            <p className="font-bold">Why reject?</p>
            <div className="grid grid-cols-2 gap-2">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={busy}
                  onClick={() => (r === "Item sold out" ? setMode("soldout") : reject(r))}
                  className={`${chip} border-red-300`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button type="button" disabled={busy} onClick={() => setMode("main")} className={`${btn} w-full bg-stone-200`}>
              Back
            </button>
          </div>
        )}

        {mode === "soldout" && (
          <div className="space-y-2">
            <p className="font-bold">Which dish is sold out?</p>
            <p className="text-caption text-stone-600">It will be hidden from the menu until 6:00 am.</p>
            <div className="grid gap-2">
              {dishes.map(([id, name]) => (
                <button key={id} type="button" disabled={busy} onClick={() => soldOut(id, name)} className={`${chip} border-red-300 text-left`}>
                  {name}
                </button>
              ))}
            </div>
            <button type="button" disabled={busy} onClick={() => setMode("reject")} className={`${btn} w-full bg-stone-200`}>
              Back
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function AcceptedOrderCard({ order }: { order: AdminOrder }) {
  const { busy, run } = useSave();
  const [cancelling, setCancelling] = useState(false);
  const due = dueAt(order);

  return (
    <article className="rounded-xl border-2 border-green-700 bg-white p-3 shadow-sm" aria-label={`Order ${order.order_number}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-heading font-extrabold">Order #{order.order_number}</h3>
        <StatusLabel text="Accepted" tone="accepted" />
      </div>
      {due && <p className="mt-1 font-extrabold">Due by {formatTimeIST(due)}</p>}
      {order.accepted_at && <p className="text-caption text-stone-600">Accepted {formatTimeIST(order.accepted_at)}</p>}
      <div className="mt-2 space-y-1.5 border-t border-stone-200 pt-2">
        <Customer order={order} />
        <Address order={order} />
      </div>
      <p className="mt-2 text-heading font-extrabold">Collect {formatINR(Number(order.total))}</p>

      {!cancelling ? (
        <div className="mt-3 flex flex-col items-center gap-1">
          <a
            href={`/admin/print/${order.id}`}
            target="_blank"
            rel="noopener"
            className={`${btn} flex w-full items-center justify-center bg-ink text-white`}
          >
            Print bill
          </a>
          {/* Deliberately low-key so it isn't tapped by mistake; still a 48px-tall target. */}
          <button
            type="button"
            disabled={busy}
            onClick={() => setCancelling(true)}
            className="min-h-9 px-4 text-caption font-semibold text-red-700 underline underline-offset-4 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="font-bold">Why cancel?</p>
          <div className="grid gap-2">
            {CANCEL_REASONS.map((r) => (
              <button key={r} type="button" disabled={busy} onClick={() => run(() => cancelOrder(order.id, r))} className={`${chip} border-red-300`}>
                {busy ? "Saving…" : r}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => setCancelling(false)} className={`${btn} w-full bg-stone-200`}>
            Back
          </button>
        </div>
      )}
    </article>
  );
}

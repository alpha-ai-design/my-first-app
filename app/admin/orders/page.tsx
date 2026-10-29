"use client";

import { useState } from "react";
import { isUrgent, useShift } from "@/components/admin/AdminShell";
import { VegMark } from "@/components/Badges";
import { formatTimeIST, minutesSince } from "@/lib/admin/ist";
import {
  acceptOrder,
  cancelOrder,
  markSoldOutUntilMorning,
  rejectOrder,
  type AdminOrder,
  type UpdateResult,
} from "@/lib/admin/orders";
import { formatINR } from "@/lib/cart";

const PREP_CHIPS = [30, 40, 50];
const REJECT_REASONS = ["Item sold out", "Kitchen too busy", "Too far to deliver", "Closing soon"];
const CANCEL_REASONS = ["Customer not available", "Customer refused", "Other"];

const btn = "min-h-12 rounded-xl px-4 text-lg font-bold disabled:opacity-50";
const chip = "min-h-12 rounded-xl border-2 border-stone-300 bg-white px-3 text-lg font-bold active:bg-stone-100 disabled:opacity-50";

export default function AdminOrdersPage() {
  const { pending, accepted, loaded, loadError } = useShift();

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-3 pt-4">
      {loadError && (
        <p role="alert" className="rounded-xl bg-red-100 p-3 font-bold text-red-800">
          Can&apos;t reach the server. Retrying… Check the internet connection.
        </p>
      )}

      <section aria-labelledby="new-heading">
        <h1 id="new-heading" className="mb-3 text-2xl font-bold">
          New <span className="text-stone-500">({pending.length})</span>
        </h1>
        {!loaded ? (
          <p className="text-stone-500">Loading orders…</p>
        ) : pending.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-stone-500">No new orders. The chime will ring when one comes in.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((o) => (
              <NewOrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="accepted-heading">
        <h2 id="accepted-heading" className="mb-3 text-2xl font-bold">
          Accepted today <span className="text-stone-500">({accepted.length})</span>
        </h2>
        {loaded && accepted.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-stone-500">No accepted orders yet today.</p>
        ) : (
          <div className="space-y-3">
            {accepted.map((o) => (
              <AcceptedOrderCard key={o.id} order={o} />
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
    <div className="text-lg leading-snug">
      <p className="font-semibold">
        Flat {order.flat_number}, {order.tower}
      </p>
      <p>{order.society}</p>
      {order.landmark && <p className="text-stone-600">Landmark: {order.landmark}</p>}
    </div>
  );
}

function StatusLabel({ text, tone }: { text: string; tone: "new" | "urgent" | "accepted" }) {
  const cls = { new: "bg-blue-700", urgent: "bg-red-700", accepted: "bg-green-700" }[tone];
  return <span className={`rounded-md px-2.5 py-1 text-base font-extrabold uppercase tracking-wide text-white ${cls}`}>{text}</span>;
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
      className={`rounded-2xl border-4 bg-white p-4 shadow-md ${urgent ? "flash-urgent border-red-600" : "border-blue-600"}`}
      aria-label={`Order ${order.order_number}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-3xl font-extrabold">Order #{order.order_number}</h2>
        <StatusLabel text={urgent ? "Urgent · New" : "New"} tone={urgent ? "urgent" : "new"} />
      </div>
      <p className={`mt-1 text-lg font-semibold ${urgent ? "text-red-700" : "text-stone-600"}`}>
        Placed {mins === 0 ? "just now" : `${mins} min ago`} · {formatTimeIST(order.created_at)}
      </p>

      <div className="mt-3 space-y-2 border-t border-stone-200 pt-3">
        <p className="text-xl font-bold">{order.customer_name}</p>
        <a
          href={`tel:+91${order.customer_phone}`}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-stone-100 px-4 text-xl font-bold tracking-wide text-ink"
        >
          <span aria-hidden>📞</span> {order.customer_phone}
        </a>
        <Address order={order} />
      </div>

      <ul className="mt-3 space-y-2 border-t border-stone-200 pt-3">
        {order.order_items.map((item) => {
          const veg = item.menu_item_id ? vegById.get(item.menu_item_id) : undefined;
          return (
            <li key={item.id} className="flex items-start gap-3 text-xl">
              {veg !== undefined ? <VegMark veg={veg} className="mt-1.5" /> : <span className="w-4" />}
              <span className="flex-1">
                <span className="font-extrabold">{item.quantity} ×</span> {item.name}
                {item.portion && <span className="font-bold text-stone-600"> ({item.portion === "half" ? "Half" : "Full"})</span>}
                {veg !== undefined && <span className="ml-2 text-sm font-semibold text-stone-500">{veg ? "Veg" : "Non-veg"}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {order.notes && (
        <p className="mt-3 rounded-xl border-2 border-yellow-500 bg-yellow-100 p-3 text-lg font-semibold text-yellow-950">
          <span className="block text-sm font-extrabold uppercase tracking-wide">Cooking instructions</span>
          {order.notes}
        </p>
      )}

      <p className="mt-3 text-2xl font-extrabold">Collect {formatINR(Number(order.total))}</p>

      <div className="mt-4 border-t border-stone-200 pt-4">
        {mode === "main" && (
          <div className="space-y-3">
            <button type="button" disabled={busy} onClick={() => accept(defaultPrep)} className={`${btn} min-h-16 w-full bg-green-700 text-2xl text-white`}>
              {busy ? "Saving…" : `Accept · ${defaultPrep} min`}
            </button>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Accept with a different prep time">
              {PREP_CHIPS.map((m) => (
                <button key={m} type="button" disabled={busy} onClick={() => accept(m)} className={chip}>
                  {m} min
                </button>
              ))}
            </div>
            <button type="button" disabled={busy} onClick={() => setMode("reject")} className={`${btn} w-full border-2 border-red-700 bg-white text-red-700`}>
              Reject
            </button>
          </div>
        )}

        {mode === "reject" && (
          <div className="space-y-3">
            <p className="text-xl font-bold">Why reject?</p>
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
          <div className="space-y-3">
            <p className="text-xl font-bold">Which dish is sold out?</p>
            <p className="text-base text-stone-600">It will be hidden from the menu until 6:00 am.</p>
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

  return (
    <article className="rounded-2xl border-2 border-green-700 bg-white p-4 shadow-sm" aria-label={`Order ${order.order_number}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-2xl font-extrabold">Order #{order.order_number}</h3>
        <StatusLabel text="Accepted" tone="accepted" />
      </div>
      <p className="mt-1 font-semibold text-stone-600">
        Accepted {order.accepted_at ? formatTimeIST(order.accepted_at) : ""}
        {order.prep_minutes ? ` · ${order.prep_minutes} min` : ""}
      </p>
      <div className="mt-2">
        <Address order={order} />
      </div>
      <p className="mt-2 text-xl font-extrabold">Collect {formatINR(Number(order.total))}</p>

      {!cancelling ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={`/admin/print/${order.id}`} target="_blank" rel="noopener" className={`${btn} flex items-center justify-center bg-ink text-white`}>
            Print bill
          </a>
          <button type="button" disabled={busy} onClick={() => setCancelling(true)} className={`${btn} border-2 border-red-700 bg-white text-red-700`}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xl font-bold">Why cancel?</p>
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

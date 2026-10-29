"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useShift } from "@/components/admin/AdminShell";
import DishForm, { categoryId, type FormStart } from "@/components/admin/DishForm";
import { VegLabel } from "@/components/Badges";
import { categories } from "@/data/menu";
import { formatDateTimeIST, formatTimeIST } from "@/lib/admin/ist";
import {
  fetchDishes,
  isIndefinite,
  isSoldOut,
  setArchived,
  setSoldOutUntil,
  soldOutUntilMorning,
  UNTIL_TURNED_ON,
  type Dish,
} from "@/lib/admin/menu";
import { formatINR } from "@/lib/cart";

const TOAST_MS = 5000;
const LONG_PRESS_MS = 600;

type Toast = { text: string; undo?: () => Promise<void> };

const priceLabel = (d: Dish) =>
  d.price_half != null && d.price_full != null
    ? `Half ${formatINR(d.price_half)} · Full ${formatINR(d.price_full)}`
    : formatINR(Number(d.price_full ?? d.price_half ?? 0));

function soldOutLabel(d: Dish) {
  if (isIndefinite(d)) return "Sold out until you turn it back on";
  const until = new Date(d.sold_out_until!);
  return `Sold out until ${until.getTime() - Date.now() < 24 * 3600_000 ? formatTimeIST(until) : formatDateTimeIST(until)}`;
}

export default function AdminMenuPage() {
  const { now } = useShift();
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setFormState] = useState<FormStart | null>(null);
  const [removing, setRemoving] = useState<Dish | null>(null);
  const [busyId, setBusyId] = useState<Dish["id"] | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refresh = useCallback(async () => {
    try {
      setDishes(await fetchDishes());
      setLoadError(false);
    } catch (err) {
      console.error("Could not load dishes", err);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Opening the form clears any old toast so it can't cover the form's Save area.
  const setForm = (start: FormStart | null) => {
    if (start) setToast(null);
    setFormState(start);
  };

  const show = (t: Toast) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  // Run a change for one dish, then reload the list.
  const change = async (dish: Dish, action: () => Promise<void>, after?: Toast) => {
    if (busyId !== null) return;
    setBusyId(dish.id);
    try {
      await action();
      if (after) show(after);
    } catch (err) {
      console.error("Menu change failed", err);
      show({ text: "Couldn't save. Check the internet and try again." });
    } finally {
      await refresh();
      setBusyId(null);
    }
  };

  const markSoldOut = (dish: Dish, indefinitely: boolean) => {
    const previous = dish.sold_out_until;
    return change(dish, () => (indefinitely ? setSoldOutUntil(dish.id, UNTIL_TURNED_ON) : soldOutUntilMorning(dish.id)), {
      text: `${dish.name} marked sold out ${indefinitely ? "until you turn it back on" : "until 6 am"}`,
      undo: async () => {
        await setSoldOutUntil(dish.id, previous);
        await refresh();
        show({ text: `${dish.name} is available again` });
      },
    });
  };

  const markAvailable = (dish: Dish) =>
    change(dish, () => setSoldOutUntil(dish.id, null), { text: `${dish.name} is available again` });

  const active = (dishes ?? []).filter((d) => !d.is_archived);
  const removed = (dishes ?? []).filter((d) => d.is_archived);
  const q = query.trim().toLowerCase();
  const matches = q ? active.filter((d) => d.name.toLowerCase().includes(q)) : active;

  // Same category order as the customer menu; anything else goes under "Other".
  const known = new Set<string>(categories.map((c) => c.id));
  const groups = [
    ...categories.map((c) => ({ id: c.id as string, name: c.name, dishes: matches.filter((d) => categoryId(d.category) === c.id) })),
    { id: "other", name: "Other", dishes: matches.filter((d) => !known.has(categoryId(d.category))) },
  ].filter((g) => g.dishes.length > 0 || (!q && g.id !== "other"));

  return (
    <main className="mx-auto max-w-2xl px-3 pt-4">
      <h1 className="text-2xl font-bold">Menu</h1>

      <label className="relative mt-3 block">
        <span className="sr-only">Search dishes</span>
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a dish…"
          className="min-h-14 w-full rounded-xl border-2 border-stone-300 bg-white pl-12 pr-4 text-lg outline-none focus:border-brand"
        />
      </label>

      {loadError && (
        <p role="alert" className="mt-3 rounded-xl bg-red-100 p-3 font-bold text-red-800">
          Can&apos;t load the menu. Check the internet connection.
        </p>
      )}
      {!dishes && !loadError && <p className="mt-6 text-stone-500">Loading menu…</p>}
      {dishes && q && matches.length === 0 && <p className="mt-6 text-center text-stone-500">No dish matches “{query.trim()}”.</p>}

      {dishes &&
        groups.map((g) => (
          <section key={g.id} className="mt-6" aria-labelledby={`cat-${g.id}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id={`cat-${g.id}`} className="text-xl font-extrabold uppercase tracking-wide">
                {g.name} <span className="font-normal normal-case text-stone-500">({g.dishes.length})</span>
              </h2>
              {g.id !== "other" && !q && (
                <button
                  type="button"
                  onClick={() => setForm({ mode: "add", category: g.id })}
                  className="min-h-12 shrink-0 rounded-xl border-2 border-green-700 bg-white px-3 font-bold text-green-800"
                >
                  + Add dish
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {g.dishes.map((d) => (
                <DishRow
                  key={d.id}
                  dish={d}
                  now={now}
                  busy={busyId === d.id}
                  onEdit={() => setForm({ mode: "edit", dish: d })}
                  onSoldOut={(indefinitely) => markSoldOut(d, indefinitely)}
                  onAvailable={() => markAvailable(d)}
                />
              ))}
            </ul>
          </section>
        ))}

      {dishes && removed.length > 0 && (
        <section className="mt-10 border-t-2 border-stone-300 pt-4">
          <button
            type="button"
            aria-expanded={showRemoved}
            onClick={() => setShowRemoved((v) => !v)}
            className="flex min-h-12 w-full items-center justify-between rounded-xl bg-white px-4 text-lg font-bold"
          >
            Removed dishes ({removed.length})<span aria-hidden>{showRemoved ? "▲" : "▼"}</span>
          </button>
          {showRemoved && (
            <ul className="mt-2 space-y-2">
              {removed.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3">
                  <span className="min-w-0 text-lg">
                    <span aria-hidden>{d.emoji || "🍽️"}</span> {d.name}
                  </span>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => change(d, () => setArchived(d.id, false), { text: `${d.name} is back on the menu` })}
                    className="min-h-12 shrink-0 rounded-xl bg-green-700 px-4 font-bold text-white disabled:opacity-50"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {form && (
        <DishForm
          start={form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            void refresh();
            show({ text: "Saved. Live on the menu now." });
          }}
          onDuplicate={(dish) => setForm({ mode: "add", category: categoryId(dish.category), copyOf: dish })}
          onRemove={(dish) => setRemoving(dish)}
        />
      )}

      {removing && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="remove-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-lg">
            <h2 id="remove-title" className="text-2xl font-bold">
              Remove {removing.name} from the menu?
            </h2>
            <p className="mt-2 text-stone-700">Customers won&apos;t see it any more. Past orders are not affected. You can restore it later from “Removed dishes”.</p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                disabled={busyId !== null}
                onClick={async () => {
                  const dish = removing;
                  await change(dish, () => setArchived(dish.id, true), { text: `${dish.name} removed from the menu` });
                  setRemoving(null);
                  setForm(null);
                }}
                className="min-h-14 rounded-xl bg-red-700 font-bold text-white disabled:opacity-50"
              >
                Remove from menu
              </button>
              <button type="button" onClick={() => setRemoving(null)} className="min-h-14 rounded-xl border-2 border-stone-300 font-bold">
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed inset-x-3 bottom-24 z-[70] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink py-2 pl-4 pr-2 text-white shadow-2xl">
          <span className="font-bold">{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                const undo = toast.undo!;
                setToast(null);
                undo().catch((err) => {
                  console.error("Undo failed", err);
                  show({ text: "Couldn't undo. Check the internet and try again." });
                });
              }}
              className="min-h-12 shrink-0 rounded-lg px-4 font-extrabold text-gold underline"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function DishRow({
  dish,
  now,
  busy,
  onEdit,
  onSoldOut,
  onAvailable,
}: {
  dish: Dish;
  now: number;
  busy: boolean;
  onEdit: () => void;
  onSoldOut: (indefinitely: boolean) => void;
  onAvailable: () => void;
}) {
  const soldOut = isSoldOut(dish, now);
  const [more, setMore] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressed = useRef(false);

  // Long-press the switch for the extra sold-out option.
  const startPress = () => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setMore(true);
    }, LONG_PRESS_MS);
  };
  const endPress = () => clearTimeout(pressTimer.current);

  return (
    <li className={`rounded-2xl border-2 bg-white ${soldOut ? "border-stone-300 bg-stone-50" : "border-transparent"}`}>
      <button type="button" onClick={onEdit} className="flex w-full items-start gap-3 p-3 text-left" aria-label={`Edit ${dish.name}`}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-stone-100 text-3xl" aria-hidden>
          {dish.emoji || "🍽️"}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-lg font-bold leading-snug ${soldOut ? "text-stone-500" : ""}`}>{dish.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <VegLabel veg={dish.is_veg} />
            <span className="font-semibold">{priceLabel(dish)}</span>
          </span>
          {soldOut && <span className="mt-1 block font-semibold text-red-700">{soldOutLabel(dish)}</span>}
        </span>
        <span className="self-center text-stone-400" aria-hidden>
          ›
        </span>
      </button>

      <div className="flex items-center gap-2 border-t border-stone-200 px-3 py-2">
        <button
          type="button"
          role="switch"
          aria-checked={!soldOut}
          aria-label={`${dish.name}: ${soldOut ? "Sold out" : "Available"}`}
          disabled={busy}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (longPressed.current) return void (longPressed.current = false);
            if (soldOut) onAvailable();
            else onSoldOut(false);
          }}
          className="flex min-h-14 flex-1 select-none items-center gap-3 rounded-xl px-2 text-lg font-extrabold disabled:opacity-50"
        >
          <span className={`relative h-9 w-16 shrink-0 rounded-full transition ${soldOut ? "bg-red-700" : "bg-green-700"}`}>
            <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${soldOut ? "left-1" : "left-8"}`} />
          </span>
          <span className={soldOut ? "text-red-700" : "text-green-800"}>{busy ? "Saving…" : soldOut ? "Sold out" : "Available"}</span>
        </button>
        <button
          type="button"
          aria-label={`More sold-out options for ${dish.name}`}
          aria-expanded={more}
          disabled={busy}
          onClick={() => setMore((v) => !v)}
          className="grid min-h-12 min-w-12 place-items-center rounded-xl border-2 border-stone-300 text-2xl font-bold leading-none disabled:opacity-50"
        >
          ⋯
        </button>
      </div>

      {more && (
        <div className="space-y-2 border-t border-stone-200 p-3">
          <button
            type="button"
            disabled={busy || isIndefinite(dish)}
            onClick={() => {
              setMore(false);
              onSoldOut(true);
            }}
            className="min-h-12 w-full rounded-xl border-2 border-red-700 bg-white px-3 font-bold text-red-700 disabled:opacity-50"
          >
            Sold out until I turn it back on
          </button>
          <button type="button" onClick={() => setMore(false)} className="min-h-12 w-full rounded-xl bg-stone-200 font-bold">
            Close
          </button>
        </div>
      )}
    </li>
  );
}

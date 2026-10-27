"use client";

import { useEffect, useState } from "react";
import type { MenuItem } from "@/data/menu";
import { formatINR } from "@/lib/cart";
import { VegMark } from "./Badges";

export default function PortionSheet({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItem;
  onClose: () => void;
  onConfirm: (portion: string) => void;
}) {
  const portions = item.portions ?? [];
  const [selected, setSelected] = useState(portions[portions.length - 1]?.label ?? "");
  const price = portions.find((p) => p.label === selected)?.price ?? item.price;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="portion-title">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-300 sm:hidden" />
        <div className="flex items-start gap-2">
          <VegMark veg={item.veg} className="mt-1" />
          <div>
            <h2 id="portion-title" className="text-lg font-bold">
              {item.name}
            </h2>
            <p className="text-sm text-stone-500">Choose your portion</p>
          </div>
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Portion size</legend>
          {portions.map((p) => (
            <label
              key={p.label}
              className={`flex cursor-pointer items-center justify-between rounded-xl border-2 px-4 py-3 transition ${
                selected === p.label ? "border-brand bg-brand/5" : "border-stone-200"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="portion"
                  value={p.label}
                  checked={selected === p.label}
                  onChange={() => setSelected(p.label)}
                  className="h-4 w-4 accent-brand"
                />
                <span className="font-semibold">{p.label}</span>
              </span>
              <span className="font-semibold">{formatINR(p.price)}</span>
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={() => onConfirm(selected)}
          className="mt-5 w-full rounded-xl bg-brand py-3.5 font-bold text-white shadow hover:bg-brand-dark"
        >
          Add item · {formatINR(price)}
        </button>
      </div>
    </div>
  );
}

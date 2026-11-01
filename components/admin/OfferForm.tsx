"use client";

import { useEffect, useMemo, useState } from "react";
import { categories } from "@/data/menu";
import { addDays, endOfDayIST, formatDayTimeIST, startOfDayIST, todayISTString, weekdayIST } from "@/lib/admin/ist";
import type { Dish } from "@/lib/admin/menu";
import { createOffer, findClash, offerTitle, previewLines, type OfferInput } from "@/lib/admin/offers";
import type { Offer } from "@/lib/pricing";

type Template = "category" | "dish" | "order";
type EndChoice = "today" | "weekend" | "week" | "date";
type Errors = Partial<Record<"target" | "value" | "min" | "end" | "start" | "form", string>>;

const TEMPLATES: { id: Template; title: string; example: string }[] = [
  { id: "category", title: "% off a category", example: "e.g. 20% off all Noodles" },
  { id: "dish", title: "₹ off a dish", example: "e.g. ₹30 off Chilli Paneer" },
  { id: "order", title: "₹ off orders above ₹X", example: "e.g. ₹50 off orders above ₹499" },
];

const END_CHOICES: { id: EndChoice; label: string }[] = [
  { id: "today", label: "Today only" },
  { id: "weekend", label: "This weekend" },
  { id: "week", label: "7 days" },
  { id: "date", label: "Pick a date" },
];

const WHOLE = /^\d+$/;

export default function OfferForm({
  dishes,
  offers,
  onClose,
  onSaved,
}: {
  dishes: Dish[]; // dishes on the menu (not removed)
  offers: Offer[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [target, setTarget] = useState("");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [endChoice, setEndChoice] = useState<EndChoice>("today");
  const [endDate, setEndDate] = useState("");
  const [startLater, setStartLater] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, saving]);

  const today = todayISTString();

  // When the offer ends: always 11:59 pm IST on the chosen day.
  const endsAt = useMemo(() => {
    if (endChoice === "today") return endOfDayIST(today);
    if (endChoice === "weekend") return endOfDayIST(addDays(today, (7 - weekdayIST()) % 7)); // this Sunday
    if (endChoice === "week") return endOfDayIST(addDays(today, 6));
    return endDate ? endOfDayIST(endDate) : null;
  }, [endChoice, endDate, today]);
  const startsAt = startLater && startDate ? startOfDayIST(startDate) : null;

  const input: OfferInput | null = template
    ? {
        title: null,
        type: template === "category" ? "percent" : "flat",
        value: WHOLE.test(value) ? Number(value) : 0,
        applies_to: template === "category" ? "category" : template === "dish" ? "item" : "order",
        target: template === "order" ? null : target || null,
        min_order: template === "order" && WHOLE.test(minOrder) ? Number(minOrder) : 0,
        starts_at: (startsAt ?? new Date()).toISOString(),
        ends_at: (endsAt ?? new Date()).toISOString(),
      }
    : null;

  const preview = input && (template === "order" || target) ? previewLines(input, dishes) : [];

  const validate = (): Errors => {
    const e: Errors = {};
    if (!template || !input) return { form: "Choose a type of offer." };
    if (template !== "order" && !target) e.target = template === "dish" ? "Choose a dish." : "Choose a category.";
    if (template === "category") {
      if (!WHOLE.test(value) || Number(value) < 1 || Number(value) > 90) e.value = "Enter a whole number from 1 to 90.";
    } else if (!WHOLE.test(value) || Number(value) <= 0) {
      e.value = "Enter the rupees off as a whole number above 0.";
    }
    if (template === "dish" && target && !e.value) {
      const dish = dishes.find((d) => String(d.id) === target);
      const lowest = Math.min(...[dish?.price_half, dish?.price_full].filter((p): p is number => p != null).map(Number));
      if (Number(value) >= lowest)
        e.value = `That's more than the price: ${dish?.name} costs ₹${lowest}${dish?.price_half != null ? " for a half" : ""}. Use a smaller amount.`;
    }
    if (template === "order") {
      if (!WHOLE.test(minOrder) || Number(minOrder) <= 0) e.min = "Enter the minimum order as a whole number above 0.";
      else if (!e.value && Number(value) >= Number(minOrder)) e.min = "The minimum order must be more than the discount.";
    }
    if (!endsAt) e.end = "Pick the last day of the offer.";
    if (startLater && !startDate) e.start = "Pick the day the offer starts.";
    if (endsAt && startsAt && startsAt >= endsAt) e.start = "The offer must start before it ends.";
    if (endsAt && endsAt.getTime() <= Date.now()) e.end = "Pick a day that hasn't finished yet.";
    if (!Object.keys(e).length) {
      const clash = findClash(input, offers, dishes);
      if (clash) e.target = clash;
    }
    return e;
  };

  const save = async () => {
    if (saving || !input) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const title = offerTitle(input, dishes);
      await createOffer({ ...input, title });
      onSaved(startsAt && startsAt.getTime() > Date.now() ? `“${title}” is scheduled.` : `“${title}” is live on the menu now.`);
    } catch (err) {
      console.error("Saving offer failed", err);
      setErrors({ form: "Couldn't save the offer. Check the internet and try again." });
      setSaving(false);
    }
  };

  const inputCls = (err?: string) =>
    `mt-1 min-h-10 w-full rounded-lg border-2 bg-white px-3 outline-none focus:ring-2 ${
      err ? "border-red-600 focus:ring-red-200" : "border-stone-300 focus:border-brand focus:ring-brand/20"
    }`;
  const fieldError = (key: keyof Errors) =>
    errors[key] && (
      <span id={`offer-err-${key}`} className="mt-1 block text-caption font-semibold text-red-700">
        {errors[key]}
      </span>
    );
  const described = (key: keyof Errors) => ({ "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `offer-err-${key}` : undefined });
  const chip = (on: boolean) =>
    `min-h-10 rounded-lg border-2 px-3 text-caption font-bold ${on ? "border-brand bg-brand/10 text-brand" : "border-stone-300 bg-white"}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-100" role="dialog" aria-modal="true" aria-labelledby="offer-form-title">
      <header className="bg-ink text-white">
        <div className="mx-auto flex h-12 max-w-xl items-center justify-between px-4">
          <h2 id="offer-form-title" className="text-heading font-bold">
            New offer
          </h2>
          <button type="button" onClick={onClose} disabled={saving} className="min-h-10 rounded-lg px-3 font-bold hover:bg-white/10">
            Close
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl space-y-4 px-4 py-4">
          <fieldset>
            <legend className="font-bold">Type of offer</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={template === t.id}
                  onClick={() => {
                    setTemplate(t.id);
                    setTarget("");
                    setErrors({});
                  }}
                  className={`min-h-11 rounded-lg border-2 p-2 text-left ${template === t.id ? "border-brand bg-brand/10" : "border-stone-300 bg-white"}`}
                >
                  <span className="block font-bold">{t.title}</span>
                  <span className="block text-caption text-stone-600">{t.example}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {template && (
            <>
              {template !== "order" && (
                <div>
                  <label className="block">
                    <span className="font-bold">{template === "dish" ? "Dish" : "Category"}</span>
                    <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls(errors.target)} {...described("target")}>
                      <option value="">{template === "dish" ? "Choose a dish" : "Choose a category"}</option>
                      {template === "category"
                        ? categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))
                        : categories.map((c) => {
                            const inCat = dishes.filter((d) => d.category.trim().toLowerCase() === c.id || d.category.trim().toLowerCase() === c.name.toLowerCase());
                            return inCat.length ? (
                              <optgroup key={c.id} label={c.name}>
                                {inCat.map((d) => (
                                  <option key={String(d.id)} value={String(d.id)}>
                                    {d.name}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null;
                          })}
                    </select>
                  </label>
                  {fieldError("target")}
                </div>
              )}

              <div className={template === "order" ? "grid grid-cols-2 gap-3" : ""}>
                <div>
                  <label className="block">
                    <span className="font-bold">{template === "category" ? "Percent off" : "Rupees off"}</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-stone-600">{template === "category" ? "%" : "₹"}</span>
                      <input
                        value={value}
                        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        inputMode="numeric"
                        className={`${inputCls(errors.value)} pl-8`}
                        {...described("value")}
                      />
                    </div>
                  </label>
                  {fieldError("value")}
                </div>
                {template === "order" && (
                  <div>
                    <label className="block">
                      <span className="font-bold">Minimum order</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-stone-600">₹</span>
                        <input
                          value={minOrder}
                          onChange={(e) => setMinOrder(e.target.value.replace(/\D/g, "").slice(0, 5))}
                          inputMode="numeric"
                          className={`${inputCls(errors.min)} pl-8`}
                          {...described("min")}
                        />
                      </div>
                    </label>
                    {fieldError("min")}
                  </div>
                )}
              </div>

              <fieldset>
                <legend className="font-bold">Ends</legend>
                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {END_CHOICES.map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={endChoice === c.id} onClick={() => setEndChoice(c.id)} className={chip(endChoice === c.id)}>
                      {c.label}
                    </button>
                  ))}
                </div>
                {endChoice === "date" && (
                  <label className="mt-2 block">
                    <span className="text-caption font-semibold">Last day of the offer</span>
                    <input type="date" min={today} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls(errors.end)} {...described("end")} />
                  </label>
                )}
                {endsAt && <p className="mt-1 text-caption text-stone-700">Ends {formatDayTimeIST(endsAt)} (India time)</p>}
                {fieldError("end")}
              </fieldset>

              <fieldset>
                <legend className="font-bold">Starts</legend>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button type="button" role="radio" aria-checked={!startLater} onClick={() => setStartLater(false)} className={chip(!startLater)}>
                    Now
                  </button>
                  <button type="button" role="radio" aria-checked={startLater} onClick={() => setStartLater(true)} className={chip(startLater)}>
                    Later
                  </button>
                </div>
                {startLater && (
                  <label className="mt-2 block">
                    <span className="text-caption font-semibold">First day (starts 12:00 am)</span>
                    <input type="date" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls(errors.start)} {...described("start")} />
                  </label>
                )}
                {fieldError("start")}
              </fieldset>

              {preview.length > 0 && (
                <section className="rounded-lg border border-green-700/40 bg-green-50 p-2.5" aria-live="polite">
                  <h3 className="text-caption font-bold uppercase tracking-wide text-green-900">Preview</h3>
                  <ul className="mt-1 space-y-0.5 text-green-950">
                    {preview.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <div className="border-t border-stone-300 bg-white px-4 py-2.5">
        <div className="mx-auto max-w-xl">
          {errors.form && (
            <p role="alert" className="mb-2 font-semibold text-red-700">
              {errors.form}
            </p>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || !template}
            className="min-h-11 w-full rounded-lg bg-green-700 text-heading font-bold text-white disabled:opacity-50 md:min-h-10"
          >
            {saving ? "Saving…" : "Create offer"}
          </button>
        </div>
      </div>
    </div>
  );
}

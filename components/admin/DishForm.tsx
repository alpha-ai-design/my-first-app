"use client";

import { useEffect, useRef, useState } from "react";
import { categories } from "@/data/menu";
import { VegMark } from "@/components/Badges";
import { saveDish, type Dish, type DishInput } from "@/lib/admin/menu";

// What the form starts from: a new dish in a category, an existing dish, or a copy.
export type FormStart = { mode: "add"; category: string; copyOf?: Dish } | { mode: "edit"; dish: Dish };

type Fields = {
  name: string;
  category: string;
  description: string;
  emoji: string;
  veg: boolean | null; // no default: the owner must choose
  spice: number;
  bestseller: boolean;
  hasPortions: boolean;
  price: string;
  half: string;
  full: string;
};
type Errors = Partial<Record<"name" | "category" | "veg" | "price" | "half" | "full" | "form", string>>;

const SPICE = ["None", "Mild", "Medium", "Hot"];
const WHOLE_RUPEES = /^\d+$/;

// Stored categories may be ids ("soups") or names ("Soups"); the form uses ids.
export function categoryId(value: string): string {
  const v = value.trim().toLowerCase();
  return categories.find((c) => c.id === v || c.name.toLowerCase() === v)?.id ?? value;
}

function initialFields(start: FormStart): Fields {
  const source = start.mode === "edit" ? start.dish : start.copyOf;
  if (!source) {
    return {
      name: "",
      category: start.mode === "add" ? start.category : "",
      description: "",
      emoji: "",
      veg: null,
      spice: 0,
      bestseller: false,
      hasPortions: false,
      price: "",
      half: "",
      full: "",
    };
  }
  const hasPortions = source.price_half != null && source.price_full != null;
  return {
    name: start.mode === "add" ? `${source.name} (copy)` : source.name,
    category: categoryId(source.category),
    description: source.description ?? "",
    emoji: source.emoji ?? "",
    veg: source.is_veg,
    spice: Math.min(3, Math.max(0, source.spice_level ?? 0)),
    bestseller: !!source.is_bestseller,
    hasPortions,
    price: hasPortions ? "" : String(source.price_full ?? source.price_half ?? ""),
    half: hasPortions ? String(source.price_half) : "",
    full: hasPortions ? String(source.price_full) : "",
  };
}

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Please enter the dish name.";
  if (!f.category) e.category = "Please choose a category.";
  if (f.veg === null) e.veg = "Please choose Veg or Non-veg.";
  const rupees = (v: string) => (WHOLE_RUPEES.test(v.trim()) && Number(v) > 0 ? Number(v) : null);
  if (f.hasPortions) {
    const half = rupees(f.half);
    const full = rupees(f.full);
    if (half === null) e.half = "Enter the half price in whole rupees (more than 0).";
    if (full === null) e.full = "Enter the full price in whole rupees (more than 0).";
    if (half !== null && full !== null && half >= full) e.half = "Half price must be less than the full price.";
  } else if (rupees(f.price) === null) {
    e.price = "Enter the price in whole rupees (more than 0).";
  }
  return e;
}

export default function DishForm({
  start,
  onClose,
  onSaved,
  onDuplicate,
  onRemove,
}: {
  start: FormStart;
  onClose: () => void;
  onSaved: () => void;
  onDuplicate: (dish: Dish) => void;
  onRemove: (dish: Dish) => void;
}) {
  const [f, setF] = useState<Fields>(() => initialFields(start));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const editing = start.mode === "edit" ? start.dish : null;

  // Start again whenever the form is opened for a different dish (e.g. after Duplicate).
  useEffect(() => {
    setF(initialFields(start));
    setErrors({});
    formRef.current?.scrollTo({ top: 0 });
  }, [start]);

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

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setF((prev) => ({ ...prev, [key]: value }));
    // Half and full are checked against each other, so editing either clears both.
    const linked = key === "half" || key === "full" ? { half: undefined, full: undefined } : {};
    setErrors((prev) => ({ ...prev, [key]: undefined, ...linked, form: undefined }));
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;
    const e = validate(f);
    setErrors(e);
    if (Object.keys(e).length) {
      // Bring the first problem into view.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    const input: DishInput = {
      name: f.name.trim(),
      category: f.category,
      description: f.description.trim() || null,
      emoji: f.emoji.trim() || null,
      is_veg: f.veg!,
      spice_level: f.spice,
      is_bestseller: f.bestseller,
      price_half: f.hasPortions ? Number(f.half) : null,
      price_full: f.hasPortions ? Number(f.full) : Number(f.price),
    };
    setSaving(true);
    try {
      await saveDish(input, editing?.id);
      onSaved();
    } catch (err) {
      console.error("Saving dish failed", err);
      setErrors({ form: "Couldn't save. Check the internet and try again." });
      setSaving(false);
    }
  };

  const inputCls = (err?: string) =>
    `mt-1 min-h-14 w-full rounded-xl border-2 bg-white px-4 text-lg outline-none focus:ring-2 ${
      err ? "border-red-600 focus:ring-red-200" : "border-stone-300 focus:border-brand focus:ring-brand/20"
    }`;
  // Errors sit next to the field (outside its label) and are linked with aria-describedby.
  type ErrKey = Exclude<keyof Errors, "form">;
  const errorProps = (key: ErrKey) => ({ "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `err-${key}` : undefined });
  const fieldError = (key: ErrKey) =>
    errors[key] && (
      <span id={`err-${key}`} className="mt-1 block font-semibold text-red-700">
        {errors[key]}
      </span>
    );

  const priceInput = (key: "price" | "half" | "full", label: string) => (
    <div>
      <label className="block">
        <span className="font-bold">{label}</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 mt-0.5 -translate-y-1/2 text-lg text-stone-500">₹</span>
          <input
            value={f[key]}
            onChange={(e) => set(key, e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            className={`${inputCls(errors[key])} pl-9`}
            {...errorProps(key)}
          />
        </div>
      </label>
      {fieldError(key)}
    </div>
  );

  const switchBtn = (on: boolean, onToggle: () => void, label: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 border-stone-300 bg-white px-4 text-lg font-bold"
    >
      {label}
      <span className="flex items-center gap-2">
        <span className="text-base text-stone-600">{on ? "On" : "Off"}</span>
        <span className={`relative h-8 w-14 rounded-full transition ${on ? "bg-green-700" : "bg-stone-300"}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
        </span>
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-100" role="dialog" aria-modal="true" aria-labelledby="dish-form-title">
      <header className="flex items-center justify-between bg-ink px-4 py-2 text-white">
        <h2 id="dish-form-title" className="text-xl font-bold">
          {editing ? "Edit dish" : "Add dish"}
        </h2>
        <button type="button" onClick={onClose} disabled={saving} className="min-h-12 rounded-lg px-4 text-lg font-bold hover:bg-white/10">
          Close
        </button>
      </header>

      <form ref={formRef} onSubmit={submit} noValidate className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl space-y-5 px-4 py-5 text-lg">
          <div>
            <label className="block">
              <span className="font-bold">Name</span>
              <input
                value={f.name}
                onChange={(e) => set("name", e.target.value.slice(0, 80))}
                className={inputCls(errors.name)}
                {...errorProps("name")}
              />
            </label>
            {fieldError("name")}
          </div>

          <div>
            <label className="block">
              <span className="font-bold">Category</span>
              <select
                value={f.category}
                onChange={(e) => set("category", e.target.value)}
                className={inputCls(errors.category)}
                {...errorProps("category")}
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {fieldError("category")}
          </div>

          <label className="block">
            <span className="font-bold">
              Description <span className="font-normal text-stone-500">(optional)</span>
            </span>
            <textarea
              value={f.description}
              onChange={(e) => set("description", e.target.value.slice(0, 200))}
              rows={2}
              className="mt-1 w-full resize-none rounded-xl border-2 border-stone-300 bg-white p-3 text-lg outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <label className="block">
            <span className="font-bold">
              Emoji <span className="font-normal text-stone-500">(optional, shown as the dish picture)</span>
            </span>
            <input
              value={f.emoji}
              onChange={(e) => set("emoji", e.target.value.slice(0, 8))}
              placeholder="🍜"
              className={`${inputCls()} w-28 text-2xl`}
            />
          </label>

          <fieldset>
            <legend className="font-bold">Veg or Non-veg</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {([true, false] as const).map((veg) => (
                <button
                  key={String(veg)}
                  type="button"
                  role="radio"
                  aria-checked={f.veg === veg}
                  {...errorProps("veg")}
                  onClick={() => set("veg", veg)}
                  className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 text-lg font-bold ${
                    f.veg === veg
                      ? veg
                        ? "border-green-700 bg-green-50 text-green-800"
                        : "border-[#8b3a1a] bg-orange-50 text-[#8b3a1a]"
                      : errors.veg
                        ? "border-red-600 bg-white"
                        : "border-stone-300 bg-white"
                  }`}
                >
                  <VegMark veg={veg} decorative /> {veg ? "Veg" : "Non-veg"}
                </button>
              ))}
            </div>
            {fieldError("veg")}
          </fieldset>

          <fieldset>
            <legend className="font-bold">Spice level</legend>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {SPICE.map((label, level) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={f.spice === level}
                  onClick={() => set("spice", level)}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-xl border-2 text-sm font-bold ${
                    f.spice === level ? "border-brand bg-brand/10 text-brand" : "border-stone-300 bg-white"
                  }`}
                >
                  <span aria-hidden>{level ? "🌶️".repeat(level) : "—"}</span>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {switchBtn(f.bestseller, () => set("bestseller", !f.bestseller), "★ Bestseller")}

          <div className="space-y-3 rounded-2xl bg-white p-4">
            {switchBtn(f.hasPortions, () => set("hasPortions", !f.hasPortions), "Has Half / Full portions")}
            {f.hasPortions ? (
              <div className="grid grid-cols-2 gap-3">
                {priceInput("half", "Half price")}
                {priceInput("full", "Full price")}
              </div>
            ) : (
              priceInput("price", "Price")
            )}
          </div>

          {editing && (
            <div className="grid grid-cols-2 gap-2 border-t border-stone-300 pt-5">
              <button
                type="button"
                disabled={saving}
                onClick={() => onDuplicate(editing)}
                className="min-h-12 rounded-xl border-2 border-ink bg-white font-bold"
              >
                Duplicate
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => onRemove(editing)}
                className="min-h-12 rounded-xl border-2 border-red-700 bg-white font-bold text-red-700"
              >
                Remove from menu
              </button>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-stone-300 bg-white px-4 py-3">
          <div className="mx-auto max-w-xl">
            {errors.form && (
              <p role="alert" className="mb-2 font-semibold text-red-700">
                {errors.form}
              </p>
            )}
            {Object.keys(errors).some((k) => k !== "form" && errors[k as keyof Errors]) && (
              <p className="mb-2 font-semibold text-red-700">Please fix the fields marked in red.</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="min-h-14 w-full rounded-xl bg-green-700 text-xl font-bold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Add to menu"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

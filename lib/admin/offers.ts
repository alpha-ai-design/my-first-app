import { categories } from "@/data/menu";
import { formatINR } from "@/lib/cart";
import { offerBadge, unitDiscount, type Offer } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { formatDayTimeIST } from "./ist";
import type { Dish } from "./menu";

export type OfferInput = Omit<Offer, "id" | "is_active">;

function db() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function fetchAllOffers(): Promise<Offer[]> {
  const { data, error } = await db().from("offers").select("*").order("ends_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map((o) => ({ ...o, id: String(o.id), value: Number(o.value), min_order: Number(o.min_order ?? 0) })) as Offer[];
}

export async function createOffer(input: OfferInput) {
  const { error } = await db().from("offers").insert({ ...input, is_active: true });
  if (error) throw error;
}

export async function stopOffer(id: string) {
  const { error } = await db().from("offers").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

export type OfferPhase = "active" | "scheduled" | "ended";

export function phaseOf(o: Offer, now = Date.now()): OfferPhase {
  if (!o.is_active || new Date(o.ends_at).getTime() < now) return "ended";
  return new Date(o.starts_at).getTime() > now ? "scheduled" : "active";
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export const categoryName = (target: string | null) =>
  categories.find((c) => norm(c.id) === norm(target) || norm(c.name) === norm(target))?.name ?? target ?? "";

// What the offer applies to, in words: "Noodles", "Veg Hakka Noodles", "orders above ₹499".
export function appliesToText(o: Offer, dishes: Dish[]): string {
  if (o.applies_to === "order") return o.min_order > 0 ? `orders above ${formatINR(o.min_order)}` : "every order";
  if (o.applies_to === "category") return `${categoryName(o.target)} (category)`;
  return dishes.find((d) => String(d.id) === String(o.target))?.name ?? "a dish that was removed";
}

// "20% off Noodles", "₹30 off Veg Hakka Noodles", "₹50 off orders above ₹499".
export function offerTitle(o: Pick<Offer, "type" | "value" | "applies_to" | "target" | "min_order">, dishes: Dish[]): string {
  const what =
    o.applies_to === "order"
      ? o.min_order > 0
        ? `orders above ${formatINR(o.min_order)}`
        : "every order"
      : o.applies_to === "category"
        ? categoryName(o.target)
        : (dishes.find((d) => String(d.id) === String(o.target))?.name ?? "dish");
  return `${offerBadge(o)} ${what}`;
}

// Dishes a dish or category offer covers.
export function dishesCovered(o: Pick<Offer, "applies_to" | "target">, dishes: Dish[]): Dish[] {
  if (o.applies_to === "item") return dishes.filter((d) => String(d.id) === String(o.target));
  if (o.applies_to === "category") return dishes.filter((d) => norm(d.category) === norm(o.target));
  return [];
}

// A dish can only have one dish or category offer at a time. Returns why a new offer clashes, or null.
export function findClash(input: OfferInput, existing: Offer[], dishes: Dish[]): string | null {
  if (input.applies_to === "order") return null;
  const start = new Date(input.starts_at).getTime();
  const end = new Date(input.ends_at).getTime();
  const newDishes = new Set(dishesCovered(input, dishes).map((d) => String(d.id)));
  for (const o of existing) {
    if (o.applies_to === "order" || phaseOf(o) === "ended") continue;
    const overlaps = new Date(o.starts_at).getTime() <= end && new Date(o.ends_at).getTime() >= start;
    if (!overlaps) continue;
    const shared = dishesCovered(o, dishes).find((d) => newDishes.has(String(d.id)));
    if (shared) {
      return `${shared.name} already has “${o.title || offerTitle(o, dishes)}” until ${formatDayTimeIST(o.ends_at)}. A dish can only have one offer at a time, so stop that offer first or choose something else.`;
    }
  }
  return null;
}

// Live preview lines: "Veg Hakka Noodles: ₹169 → ₹135".
export function previewLines(input: Pick<Offer, "type" | "value" | "applies_to" | "target" | "min_order">, dishes: Dish[], max = 3): string[] {
  if (!(input.value > 0)) return [];
  const asOffer = input as Offer;
  if (input.applies_to === "order") {
    const base = input.min_order > 0 ? input.min_order : 500;
    const d = input.type === "percent" ? Math.round((base * input.value) / 100) : Math.min(input.value, base);
    return [`A ${formatINR(base)} order: ${formatINR(base)} → ${formatINR(base - d)}`];
  }
  const covered = dishesCovered(input, dishes);
  const lines = covered.slice(0, max).map((dish) => {
    const prices =
      dish.price_half != null && dish.price_full != null
        ? [
            ["Half ", Number(dish.price_half)],
            ["Full ", Number(dish.price_full)],
          ]
        : [["", Number(dish.price_full ?? dish.price_half ?? 0)]];
    const parts = prices.map(([label, p]) => `${label}${formatINR(p as number)} → ${formatINR((p as number) - unitDiscount(asOffer, p as number))}`);
    return `${dish.name}: ${parts.join(" · ")}`;
  });
  if (covered.length > max) lines.push(`…and ${covered.length - max} more ${covered.length - max === 1 ? "dish" : "dishes"}`);
  return lines;
}

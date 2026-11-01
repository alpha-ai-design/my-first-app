import { supabase } from "@/lib/supabase";
import { next6amIST } from "./ist";

// A menu_items row as the owner edits it.
export type Dish = {
  id: string | number;
  name: string;
  category: string;
  description: string | null;
  price_half: number | null;
  price_full: number | null;
  is_veg: boolean;
  spice_level: number | null;
  is_bestseller: boolean | null;
  emoji: string | null;
  sold_out_until: string | null;
  is_archived: boolean | null;
};

export type DishInput = Pick<
  Dish,
  "name" | "category" | "description" | "price_half" | "price_full" | "is_veg" | "spice_level" | "is_bestseller" | "emoji"
>;

// "Sold out until I turn it back on" is stored as a date far in the future.
export const UNTIL_TURNED_ON = "2099-12-31T00:00:00.000Z";
const FAR_FUTURE_MS = new Date("2090-01-01T00:00:00Z").getTime();

export const isSoldOut = (d: Pick<Dish, "sold_out_until">, now = Date.now()) =>
  !!d.sold_out_until && new Date(d.sold_out_until).getTime() > now;

export const isIndefinite = (d: Pick<Dish, "sold_out_until">) =>
  !!d.sold_out_until && new Date(d.sold_out_until).getTime() >= FAR_FUTURE_MS;

function db() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function fetchDishes(): Promise<Dish[]> {
  const { data, error } = await db().from("menu_items").select("*").order("name");
  if (error) throw error;
  return data as Dish[];
}

export async function setSoldOutUntil(id: Dish["id"], until: string | null) {
  const { error } = await db().from("menu_items").update({ sold_out_until: until }).eq("id", id);
  if (error) throw error;
}

export const soldOutUntilMorning = (id: Dish["id"]) => setSoldOutUntil(id, next6amIST().toISOString());

export async function setArchived(id: Dish["id"], archived: boolean) {
  const { error } = await db().from("menu_items").update({ is_archived: archived }).eq("id", id);
  if (error) throw error;
}

export async function saveDish(input: DishInput, id?: Dish["id"]) {
  const query = id == null ? db().from("menu_items").insert(input) : db().from("menu_items").update(input).eq("id", id);
  const { error } = await query;
  if (error) throw error;
}

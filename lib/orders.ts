import { isDateText, isObject, isText, isWholeNumber, readItem, removeItem, writeItem } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export type OrderStatus = {
  order_number: number;
  status: "pending" | "accepted" | "rejected" | "cancelled" | string;
  reject_reason: string | null;
  prep_minutes: number | null;
  accepted_at: string | null;
  subtotal: number;
  discount: number;
  gst: number;
  delivery_fee: number;
  total: number;
  notes: string | null;
};

// What we keep on the phone so the status page can list the dishes after a refresh or a later visit.
export type SavedOrder = {
  id: string;
  items: { name: string; veg: boolean; portion?: string; qty: number; total: number }[];
  placedAt: string; // ISO
};

const STORAGE_KEY = "xu-noodles-orders-v2";
const KEEP = 10;

// One saved order, or null if it isn't the expected shape.
function checkOrder(v: unknown): SavedOrder | null {
  if (!isObject(v) || !isText(v.id, 100) || !v.id || !isDateText(v.placedAt) || !Array.isArray(v.items)) return null;
  const items: SavedOrder["items"] = [];
  for (const i of v.items) {
    if (!isObject(i) || !isText(i.name, 200) || typeof i.veg !== "boolean" || !isWholeNumber(i.qty, 1, 20) || typeof i.total !== "number" || !Number.isFinite(i.total)) return null;
    if (i.portion !== undefined && !isText(i.portion, 20)) return null;
    items.push({ name: i.name, veg: i.veg, portion: i.portion as string | undefined, qty: i.qty, total: i.total });
  }
  return { id: v.id, items, placedAt: v.placedAt };
}

// Saved orders, newest first. Broken entries are dropped; a broken list is discarded.
export function getSavedOrders(): SavedOrder[] {
  const list = readItem(STORAGE_KEY, (v) => (Array.isArray(v) ? v.map(checkOrder).filter((o): o is SavedOrder => o !== null) : null));
  return list ?? [];
}

export function getSavedOrder(id: string): SavedOrder | undefined {
  return getSavedOrders().find((o) => o.id === id);
}

export function saveOrder(order: SavedOrder) {
  const rest = getSavedOrders().filter((o) => o.id !== order.id);
  writeItem(STORAGE_KEY, [order, ...rest].slice(0, KEEP));
}

// The order no longer exists (e.g. test orders deleted from the database): forget it on this phone.
export function forgetSavedOrder(id: string) {
  const rest = getSavedOrders().filter((o) => o.id !== id);
  if (rest.length) writeItem(STORAGE_KEY, rest);
  else removeItem(STORAGE_KEY);
}

// The server worked out a different total from the one the customer saw (an offer started or ended).
export class PriceChangedError extends Error {}

// Shown when a request fails for a reason the customer can't fix.
const GENERIC_ERROR = "We couldn't place your order right now. Please check your connection and try again.";

export async function placeOrder(input: {
  name: string;
  phone: string;
  society: string;
  tower: string;
  flatNumber: string;
  landmark: string;
  notes: string;
  items: { menu_item_id: string; portion: string | null; quantity: number }[];
  expectedTotal: number; // the total shown to the customer; the server must agree
}): Promise<string> {
  if (!supabase) throw new Error(GENERIC_ERROR);
  const { data, error } = await supabase.rpc("place_order", {
    p_customer_name: input.name,
    p_customer_phone: input.phone,
    p_society: input.society,
    p_tower: input.tower,
    p_flat_number: input.flatNumber,
    p_landmark: input.landmark,
    p_notes: input.notes,
    p_items: input.items,
    p_expected_total: input.expectedTotal,
  });
  if (error) {
    console.error("place_order failed", error);
    if (error.message?.startsWith("PRICE_CHANGED")) throw new PriceChangedError(error.message);
    // P0001 = our own "raise exception" messages, written for customers.
    throw new Error(error.code === "P0001" ? error.message : GENERIC_ERROR);
  }
  return data as string;
}

export async function getOrderStatus(id: string): Promise<OrderStatus | null> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("get_order_status", { p_order_id: id });
  if (error) throw error;
  return (data as OrderStatus | null) ?? null;
}

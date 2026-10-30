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

export function getSavedOrders(): SavedOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedOrder[]) : [];
  } catch {
    return [];
  }
}

export function getSavedOrder(id: string): SavedOrder | undefined {
  return getSavedOrders().find((o) => o.id === id);
}

export function saveOrder(order: SavedOrder) {
  try {
    const rest = getSavedOrders().filter((o) => o.id !== order.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([order, ...rest].slice(0, KEEP)));
  } catch {
    // Ignore storage errors; the status page still works from its URL.
  }
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

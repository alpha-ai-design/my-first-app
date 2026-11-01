import { supabase } from "@/lib/supabase";
import { startOfTodayIST } from "./ist";

export type AdminOrderItem = {
  id: string;
  menu_item_id: string | null;
  name: string;
  portion: string | null;
  quantity: number;
  unit_price: number;
};

export type AdminOrder = {
  id: string;
  order_number: number;
  status: string;
  created_at: string;
  accepted_at: string | null;
  prep_minutes: number | null;
  customer_name: string;
  customer_phone: string;
  society: string | null;
  tower: string | null;
  flat_number: string | null;
  landmark: string | null;
  notes: string | null;
  subtotal: number;
  discount: number | null;
  gst: number;
  delivery_fee: number;
  total: number;
  reject_reason: string | null;
  order_items: AdminOrderItem[];
};

const ORDER_COLUMNS =
  "id, order_number, status, created_at, accepted_at, prep_minutes, customer_name, customer_phone, society, tower, flat_number, landmark, notes, subtotal, discount, gst, delivery_fee, total, reject_reason, order_items(id, menu_item_id, name, portion, quantity, unit_price)";

function db() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function fetchPendingOrders(): Promise<AdminOrder[]> {
  const { data, error } = await db().from("orders").select(ORDER_COLUMNS).eq("status", "pending").order("created_at");
  if (error) throw error;
  return data as unknown as AdminOrder[];
}

export async function fetchAcceptedToday(): Promise<AdminOrder[]> {
  const { data, error } = await db()
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("status", "accepted")
    .gte("accepted_at", startOfTodayIST().toISOString())
    .order("accepted_at", { ascending: false });
  if (error) throw error;
  return data as unknown as AdminOrder[];
}

export async function fetchOrder(id: string): Promise<AdminOrder | null> {
  const { data, error } = await db().from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as AdminOrder | null;
}

// menu_items.id → is_veg, for the veg/non-veg marks on each dish.
export async function fetchVegMap(): Promise<Map<string, boolean>> {
  const { data, error } = await db().from("menu_items").select("id, is_veg");
  if (error) throw error;
  return new Map((data ?? []).map((m) => [String(m.id), !!m.is_veg]));
}

export async function fetchDefaultPrepMinutes(): Promise<number> {
  const { data, error } = await db().from("restaurant_settings").select("default_prep_minutes").single();
  if (error) throw error;
  return data.default_prep_minutes ?? 40;
}

// "closed" = the order wasn't in the expected status any more (e.g. auto-rejected).
export type UpdateResult = "ok" | "closed";

async function updateIf(id: string, fromStatus: string, changes: Record<string, unknown>): Promise<UpdateResult> {
  const { data, error } = await db().from("orders").update(changes).eq("id", id).eq("status", fromStatus).select("id");
  if (error) throw error;
  return data && data.length > 0 ? "ok" : "closed";
}

export function acceptOrder(id: string, prepMinutes: number) {
  return updateIf(id, "pending", { status: "accepted", prep_minutes: prepMinutes, accepted_at: new Date().toISOString() });
}

export function rejectOrder(id: string, reason: string) {
  return updateIf(id, "pending", { status: "rejected", reject_reason: reason });
}

export function cancelOrder(id: string, reason: string) {
  return updateIf(id, "accepted", { status: "cancelled", reject_reason: reason, cancelled_at: new Date().toISOString() });
}

// Hide a dish from the menu until the next 6:00 am IST.
export { soldOutUntilMorning as markSoldOutUntilMorning } from "./menu";

// "Flat 1204 · Tower B · Gaur City 2". Customers type these freely, so don't add a
// label they already wrote ("Tower B", "Block C", "Flat 12") — avoids "Tower Tower B".
function labelled(label: string, value: string | null, alreadyLabelled: RegExp): string | null {
  const v = value?.trim();
  if (!v) return null;
  return alreadyLabelled.test(v) ? v : `${label} ${v}`;
}

export function formatAddress(order: Pick<AdminOrder, "flat_number" | "tower" | "society">): string {
  return [
    labelled("Flat", order.flat_number, /^flat\b/i),
    labelled("Tower", order.tower, /\b(tower|block)\b/i),
    order.society?.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Accepted time + prep time = when the order should reach the customer.
export function dueAt(order: Pick<AdminOrder, "accepted_at" | "prep_minutes">): Date | null {
  if (!order.accepted_at || order.prep_minutes == null) return null;
  return new Date(new Date(order.accepted_at).getTime() + order.prep_minutes * 60_000);
}

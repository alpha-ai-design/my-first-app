import { supabase } from "@/lib/supabase";

export type Period = "today" | "yesterday" | "this_week" | "this_month";

export type SalesMetrics = {
  net_sales: number; // accepted orders: subtotal - discount (no GST, no delivery fee)
  order_count: number;
  average_order_value: number;
  gst_collected: number;
  delivery_fees: number;
  top_dishes: { name: string; quantity: number }[];
  unsold_dishes: string[];
  missed: { status: "rejected" | "cancelled"; reason: string; count: number; value: number }[];
  offers: { offer_id: string; title: string | null; type: "percent" | "flat"; value: number; applies_to: "item" | "category" | "order"; target: string | null; min_order: number; orders: number; discount: number }[];
};

export type SalesSummary = {
  period: Period;
  from: string;
  to: string;
  compare_label: string; // "last Tuesday", "last week", "last month"
  current: SalesMetrics;
  previous: SalesMetrics;
};

export async function fetchSales(period: Period): Promise<SalesSummary> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("sales_summary", { p_period: period });
  if (error) throw error;
  return data as SalesSummary;
}

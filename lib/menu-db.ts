import { categories, menu as staticMenu, type CategoryId, type MenuItem } from "@/data/menu";
import { supabase } from "@/lib/supabase";

// A row of the Supabase `menu_items` table.
type MenuItemRow = {
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
};

const DEFAULT_COLOR = "from-amber-500 to-red-800";

// Accept either a category id ("soups") or its display name ("Soups").
function toCategoryId(value: string): CategoryId | undefined {
  const v = value.trim().toLowerCase();
  return categories.find((c) => c.id === v || c.name.toLowerCase() === v)?.id;
}

function toMenuItem(row: MenuItemRow, now: number): MenuItem | null {
  const category = toCategoryId(row.category ?? "");
  if (!category) return null;
  // Reuse the card colour (and emoji fallback) from data/menu.ts when the name matches.
  const known = staticMenu.find((m) => m.name.toLowerCase() === row.name.toLowerCase());
  const half = row.price_half;
  const full = row.price_full;
  const hasPortions = half != null && full != null;
  return {
    id: String(row.id),
    name: row.name,
    description: row.description ?? "",
    category,
    price: hasPortions ? half : (full ?? half ?? 0),
    veg: row.is_veg,
    spice: Math.min(3, Math.max(0, row.spice_level ?? 0)) as MenuItem["spice"],
    bestseller: !!row.is_bestseller,
    portions: hasPortions
      ? [
          { label: "Half", price: half },
          { label: "Full", price: full },
        ]
      : undefined,
    emoji: row.emoji || known?.emoji || "🍽️",
    color: known?.color ?? DEFAULT_COLOR,
    soldOut: !!row.sold_out_until && new Date(row.sold_out_until).getTime() > now,
  };
}

// Within a category, keep the original menu order; new dishes go last, by name.
function menuOrder(a: MenuItem, b: MenuItem) {
  const ia = staticMenu.findIndex((m) => m.name.toLowerCase() === a.name.toLowerCase());
  const ib = staticMenu.findIndex((m) => m.name.toLowerCase() === b.name.toLowerCase());
  if (ia !== ib) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
  return a.name.localeCompare(b.name);
}

export async function fetchMenu(): Promise<MenuItem[]> {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  const { data, error } = await supabase.from("menu_items").select("*");
  if (error) throw error;
  const now = Date.now();
  return ((data ?? []) as MenuItemRow[])
    .map((row) => toMenuItem(row, now))
    .filter((m): m is MenuItem => m !== null)
    .sort(menuOrder);
}

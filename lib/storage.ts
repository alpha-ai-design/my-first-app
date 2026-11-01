// Everything the app keeps on the customer's or owner's device goes through here.
//
// Every key carries a version ("-v2"). Reading never throws: if an item is missing, unreadable,
// from an older version or not the expected shape, that one item is discarded and the app starts
// fresh for it. (Supabase's own login token is managed and validated by supabase-js, not here.)
//
// Items in use:
//   xu-noodles-cart-v2      { lines: CartLine[] }                       lib/cart.tsx
//   xu-noodles-customer-v2  name, phone and address for repeat orders   lib/customer.ts
//   xu-noodles-orders-v2    SavedOrder[] (dishes of recent orders)      lib/orders.ts
//   xu-kitchen-push-v1      { endpoint } last alert subscription saved   lib/admin/push.ts
//
// Old items still found on devices:
//   xu-noodles-cart-v1      live app on main (dish slugs like "veg-momos") → migrated by lib/cart.tsx
//   xu-noodles-customer-v1  pincode-era address → name and phone kept by lib/customer.ts
//   xu-noodles-orders-v1    dine-in/takeaway orders, all deleted from the database → removed

export const LEGACY_KEYS_TO_REMOVE = ["xu-noodles-orders-v1"];

// Reads and checks an item. `check` returns the clean value, or null if the shape is wrong.
export function readItem<T>(key: string, check: (value: unknown) => T | null): T | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null; // storage blocked (private mode, browser settings)
  }
  if (raw === null) return null;
  try {
    const value = check(JSON.parse(raw));
    if (value !== null) return value;
  } catch {
    // not JSON, or the check itself hit something unexpected
  }
  removeItem(key);
  return null;
}

export function writeItem(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the app keeps working, it just won't remember this
  }
}

export function removeItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// Remove items from older versions that can't be used any more. Safe to call on every page load.
export function removeLegacyItems() {
  LEGACY_KEYS_TO_REMOVE.forEach(removeItem);
}

// Small shape helpers for the checks.
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export const isText = (v: unknown, max = 500): v is string => typeof v === "string" && v.length <= max;
export const isWholeNumber = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
export const isDateText = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

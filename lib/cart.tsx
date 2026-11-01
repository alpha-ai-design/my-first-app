"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MenuItem } from "@/data/menu";
import { useMenu } from "@/lib/menu";
import { menu as staticMenu } from "@/data/menu";
import { dishOffer, gstOn, nextOrderOffer, orderOffer, type Applied, type Offer } from "@/lib/pricing";
import { isObject, isText, isWholeNumber, readItem, removeItem, removeLegacyItems, writeItem } from "@/lib/storage";

export type CartLine = {
  key: string; // itemId + portion, so Half and Full are separate lines
  itemId: string; // menu_items.id
  portion?: string;
  qty: number;
};

type CartContextValue = {
  lines: CartLine[];
  getItem: (id: string) => MenuItem | undefined;
  add: (itemId: string, portion?: string) => void;
  decrement: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  itemTotal: number; // subtotal at menu prices, before discounts
  dishDiscount: number; // from dish and category offers
  orderOffer: Applied | null; // the order-level offer applied, if any
  discount: number; // dishDiscount + order offer
  nextOffer: { offer: Offer; gap: number; discount: number } | null; // "Add ₹X more to get ₹Y off"
  gst: number; // on (subtotal - discount)
  grandTotal: number; // subtotal - discount + GST (delivery fee is added on the page)
  hydrated: boolean; // saved cart and menu are both loaded
};

// v2: item ids are Supabase menu_items ids.
const STORAGE_KEY = "xu-noodles-cart-v2";
// v1: the live app on main, where item ids are dish slugs from data/menu.ts ("veg-momos").
const LEGACY_KEY = "xu-noodles-cart-v1";

// A cart line, or null if it isn't the expected shape.
function checkLine(v: unknown): CartLine | null {
  if (!isObject(v) || !isText(v.itemId, 100) || !v.itemId || !isWholeNumber(v.qty, 1, 20)) return null;
  if (v.portion !== undefined && v.portion !== "Half" && v.portion !== "Full") return null;
  const portion = v.portion as string | undefined;
  return { key: lineKey(v.itemId, portion), itemId: v.itemId, portion, qty: v.qty };
}

const checkCart = (v: unknown): CartLine[] | null =>
  isObject(v) && Array.isArray(v.lines) ? v.lines.map(checkLine).filter((l): l is CartLine => l !== null) : null;

const CartContext = createContext<CartContextValue | null>(null);

export const lineKey = (itemId: string, portion?: string) =>
  portion ? `${itemId}__${portion}` : itemId;

export function unitPrice(item: MenuItem, portion?: string): number {
  if (portion && item.portions) {
    const p = item.portions.find((x) => x.label === portion);
    if (p) return p.price;
  }
  return item.price;
}

// Price of one unit after any dish or category offer.
export function offerPrice(item: MenuItem, portion: string | undefined, offers: Offer[]): { price: number; applied: Applied | null } {
  const base = unitPrice(item, portion);
  const applied = dishOffer({ id: item.id, categoryRaw: item.categoryRaw ?? "" }, base, offers);
  return { price: base - (applied?.discount ?? 0), applied };
}

export function formatINR(amount: number): string {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { menu, error: menuError, getItem, offers } = useMenu();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [legacyLines, setLegacyLines] = useState<CartLine[]>([]); // from main's cart, mapped once the menu loads
  const [loaded, setLoaded] = useState(false);

  // Load the saved cart once on the client. Anything unreadable is discarded, never thrown.
  useEffect(() => {
    removeLegacyItems();
    const saved = readItem(STORAGE_KEY, checkCart);
    if (saved) setLines(saved);
    else setLegacyLines(readItem(LEGACY_KEY, checkCart) ?? []);
    removeItem(LEGACY_KEY);
    setLoaded(true);
  }, []);

  // Once the menu is in: bring over a cart from the old app (dish slug → dish name → today's dish),
  // and drop anything that no longer exists on the menu.
  useEffect(() => {
    if (!menu || !loaded) return;
    setLines((prev) => {
      const migrated = legacyLines.flatMap((l) => {
        const name = staticMenu.find((d) => d.id === l.itemId)?.name.toLowerCase();
        const dish = name ? menu.find((d) => d.name.toLowerCase() === name) : undefined;
        if (!dish) return [];
        const portion = dish.portions?.some((p) => p.label === l.portion) ? l.portion : undefined;
        if (dish.portions?.length && !portion) return [];
        return [{ key: lineKey(dish.id, portion), itemId: dish.id, portion, qty: l.qty }];
      });
      const kept = [...prev, ...migrated].filter((l) => getItem(l.itemId));
      return kept.length === prev.length && !migrated.length ? prev : kept;
    });
    if (legacyLines.length) setLegacyLines([]);
  }, [menu, loaded, getItem, legacyLines]);

  const hydrated = loaded && (!!menu || menuError);

  useEffect(() => {
    if (hydrated) writeItem(STORAGE_KEY, { lines });
  }, [lines, hydrated]);

  const add = useCallback((itemId: string, portion?: string) => {
    const key = lineKey(itemId, portion);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + 1) } : l));
      return [...prev, { key, itemId, portion, qty: 1 }];
    });
  }, []);

  const decrement = useCallback((key: string) => {
    setLines((prev) =>
      prev.flatMap((l) => (l.key !== key ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : [])),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((s, l) => s + l.qty, 0);
    let itemTotal = 0;
    let dishDiscount = 0;
    for (const l of lines) {
      const item = getItem(l.itemId);
      if (!item) continue;
      itemTotal += unitPrice(item, l.portion) * l.qty;
      dishDiscount += (unitPrice(item, l.portion) - offerPrice(item, l.portion, offers).price) * l.qty;
    }
    const afterDish = itemTotal - dishDiscount;
    const applied = orderOffer(afterDish, offers);
    const discount = dishDiscount + (applied?.discount ?? 0);
    const gst = gstOn(itemTotal - discount);
    return {
      lines,
      getItem,
      add,
      decrement,
      remove,
      clear,
      count,
      itemTotal,
      dishDiscount,
      orderOffer: applied,
      discount,
      nextOffer: nextOrderOffer(afterDish, applied, offers),
      gst,
      grandTotal: itemTotal - discount + gst,
      hydrated,
    };
  }, [lines, getItem, offers, add, decrement, remove, clear, hydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

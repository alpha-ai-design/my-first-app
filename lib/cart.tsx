"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { GST_RATE, type MenuItem } from "@/data/menu";
import { useMenu } from "@/lib/menu";

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
  itemTotal: number;
  gst: number;
  grandTotal: number;
  hydrated: boolean; // saved cart and menu are both loaded
};

// v2: item ids are now Supabase menu_items ids.
const STORAGE_KEY = "xu-noodles-cart-v2";

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

export function formatINR(amount: number): string {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { menu, error: menuError, getItem } = useMenu();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load the saved cart once on the client.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { lines?: CartLine[] };
        setLines((saved.lines ?? []).filter((l) => l.qty > 0));
      }
    } catch {
      // Ignore broken or blocked storage.
    }
    setLoaded(true);
  }, []);

  // Once the menu is in, drop anything that no longer exists on it.
  useEffect(() => {
    if (!menu || !loaded) return;
    setLines((prev) => {
      const kept = prev.filter((l) => getItem(l.itemId));
      return kept.length === prev.length ? prev : kept;
    });
  }, [menu, loaded, getItem]);

  const hydrated = loaded && (!!menu || menuError);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines }));
    } catch {
      // Ignore storage errors (private mode, quota).
    }
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
    const itemTotal = lines.reduce((s, l) => {
      const item = getItem(l.itemId);
      return item ? s + unitPrice(item, l.portion) * l.qty : s;
    }, 0);
    const gst = Math.round(itemTotal * GST_RATE);
    return {
      lines,
      getItem,
      add,
      decrement,
      remove,
      clear,
      count,
      itemTotal,
      gst,
      grandTotal: itemTotal + gst,
      hydrated,
    };
  }, [lines, getItem, add, decrement, remove, clear, hydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { GST_RATE, menu, type MenuItem } from "@/data/menu";

export type CartLine = {
  key: string; // itemId + portion, so Half and Full are separate lines
  itemId: string;
  portion?: string;
  qty: number;
};

type CartContextValue = {
  lines: CartLine[];
  note: string;
  setNote: (note: string) => void;
  add: (itemId: string, portion?: string) => void;
  decrement: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  itemTotal: number;
  gst: number;
  grandTotal: number;
  hydrated: boolean;
};

const STORAGE_KEY = "xu-noodles-cart-v1";

const CartContext = createContext<CartContextValue | null>(null);

export const lineKey = (itemId: string, portion?: string) =>
  portion ? `${itemId}__${portion}` : itemId;

export function getItem(id: string): MenuItem | undefined {
  return menu.find((m) => m.id === id);
}

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
  const [lines, setLines] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Load the saved cart once on the client.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { lines?: CartLine[]; note?: string };
        // Drop anything that no longer exists on the menu.
        setLines((saved.lines ?? []).filter((l) => getItem(l.itemId) && l.qty > 0));
        setNote(saved.note ?? "");
      }
    } catch {
      // Ignore broken or blocked storage.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, note }));
    } catch {
      // Ignore storage errors (private mode, quota).
    }
  }, [lines, note, hydrated]);

  const add = useCallback((itemId: string, portion?: string) => {
    const key = lineKey(itemId, portion);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
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

  const clear = useCallback(() => {
    setLines([]);
    setNote("");
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((s, l) => s + l.qty, 0);
    const itemTotal = lines.reduce((s, l) => {
      const item = getItem(l.itemId);
      return item ? s + unitPrice(item, l.portion) * l.qty : s;
    }, 0);
    const gst = Math.round(itemTotal * GST_RATE);
    return {
      lines,
      note,
      setNote,
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
  }, [lines, note, add, decrement, remove, clear, hydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

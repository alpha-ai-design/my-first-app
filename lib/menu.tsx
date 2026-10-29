"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MenuItem } from "@/data/menu";
import { fetchMenu } from "@/lib/menu-db";

type MenuContextValue = {
  menu: MenuItem[] | null; // null while loading
  error: boolean;
  getItem: (id: string) => MenuItem | undefined;
};

const MenuContext = createContext<MenuContextValue | null>(null);

// Loads the menu from Supabase once and shares it with the menu page, cart and checkout.
export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchMenu()
      .then(setMenu)
      .catch((err) => {
        console.error("Could not load menu", err);
        setError(true);
      });
  }, []);

  const byId = useMemo(() => new Map((menu ?? []).map((m) => [m.id, m])), [menu]);
  const getItem = useCallback((id: string) => byId.get(id), [byId]);

  const value = useMemo(() => ({ menu, error, getItem }), [menu, error, getItem]);
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("useMenu must be used inside <MenuProvider>");
  return ctx;
}

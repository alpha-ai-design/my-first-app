"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MenuItem } from "@/data/menu";
import { fetchMenu, fetchOffers } from "@/lib/menu-db";
import { isOfferLive, type Offer } from "@/lib/pricing";

type MenuContextValue = {
  menu: MenuItem[] | null; // null while loading
  error: boolean;
  getItem: (id: string) => MenuItem | undefined;
  offers: Offer[]; // offers running right now
  refresh: () => Promise<void>; // reload dishes, prices and offers
};

const MenuContext = createContext<MenuContextValue | null>(null);

// Loads the menu and offers from Supabase and shares them with the menu page, cart and checkout.
export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const [m, o] = await Promise.all([fetchMenu(), fetchOffers()]);
      setMenu(m);
      setAllOffers(o);
      setError(false);
    } catch (err) {
      console.error("Could not load menu", err);
      setError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Offers start and end on the clock, so re-check which are live every 30 seconds.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const offers = useMemo(() => allOffers.filter((o) => isOfferLive(o, now)), [allOffers, now]);
  const byId = useMemo(() => new Map((menu ?? []).map((m) => [m.id, m])), [menu]);
  const getItem = useCallback((id: string) => byId.get(id), [byId]);

  const value = useMemo(() => ({ menu, error, getItem, offers, refresh }), [menu, error, getItem, offers, refresh]);
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("useMenu must be used inside <MenuProvider>");
  return ctx;
}

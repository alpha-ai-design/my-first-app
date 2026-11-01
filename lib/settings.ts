"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type RestaurantSettings = {
  delivery_fee: number;
  min_order: number;
};

let cached: Promise<RestaurantSettings> | null = null;
const listeners = new Set<() => void>();

// Delivery fee and minimum order from the single restaurant_settings row.
export function fetchSettings(): Promise<RestaurantSettings> {
  if (!cached) {
    cached = (async () => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase.from("restaurant_settings").select("delivery_fee, min_order").single();
      if (error) throw error;
      return { delivery_fee: Number(data.delivery_fee ?? 0), min_order: Number(data.min_order ?? 0) };
    })();
    cached.catch(() => (cached = null)); // retry on the next call
  }
  return cached;
}

// Fetch again (e.g. after the server says prices changed) and update every page using them.
export function reloadSettings() {
  cached = null;
  listeners.forEach((l) => l());
}

// settings: null while loading. failed: couldn't load (the server still checks everything when ordering).
export function useSettings(): { settings: RestaurantSettings | null; failed: boolean } {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const load = () =>
      fetchSettings()
        .then((s) => {
          setSettings(s);
          setFailed(false);
        })
        .catch((err) => {
          console.error("Could not load restaurant settings", err);
          setFailed(true);
        });
    void load();
    listeners.add(load);
    return () => void listeners.delete(load);
  }, []);
  return { settings, failed };
}

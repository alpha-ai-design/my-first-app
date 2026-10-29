"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type RestaurantSettings = {
  delivery_areas: string[]; // societies we deliver to
  delivery_fee: number;
  min_order: number;
};

let cached: Promise<RestaurantSettings> | null = null;

// Delivery areas, fee and minimum order from the single restaurant_settings row.
export function fetchSettings(): Promise<RestaurantSettings> {
  if (!cached) {
    cached = (async () => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase
        .from("restaurant_settings")
        .select("delivery_areas, delivery_fee, min_order")
        .single();
      if (error) throw error;
      return data as RestaurantSettings;
    })();
    cached.catch(() => (cached = null)); // retry on the next call
  }
  return cached;
}

// null while loading or if it failed (the server still checks everything when ordering).
export function useSettings(): RestaurantSettings | null {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch((err) => console.error("Could not load restaurant settings", err));
  }, []);
  return settings;
}

"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import PushSettings from "@/components/admin/PushSettings";
import { playChime, unlockAudio } from "@/lib/admin/chime";
import { minutesSince } from "@/lib/admin/ist";
import {
  fetchAcceptedToday,
  fetchDefaultPrepMinutes,
  fetchPendingOrders,
  fetchVegMap,
  type AdminOrder,
} from "@/lib/admin/orders";
import { supabase } from "@/lib/supabase";

const CHIME_EVERY_MS = 10_000;
const URGENT_AFTER_MIN = 3;
const POLL_MS = 30_000; // backup in case the realtime connection drops

type ShiftValue = {
  pending: AdminOrder[];
  accepted: AdminOrder[];
  vegById: Map<string, boolean>;
  defaultPrep: number;
  now: number;
  loaded: boolean;
  loadError: boolean;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
};

const ShiftContext = createContext<ShiftValue | null>(null);

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error("useShift must be used inside the admin shell");
  return ctx;
}

export const isUrgent = (order: AdminOrder, now: number) => minutesSince(order.created_at, now) >= URGENT_AFTER_MIN;

const TABS = [
  { href: "/admin/orders", label: "Orders", icon: "🧾" },
  { href: "/admin/menu", label: "Menu", icon: "🍜" },
  { href: "/admin/offers", label: "Offers", icon: "🏷️" },
  { href: "/admin/sales", label: "Sales", icon: "📈" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = checking
  const [started, setStarted] = useState(false);

  const isLogin = pathname === "/admin/login";
  const isPrint = pathname.startsWith("/admin/print");

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Signed out → login page. Signed in on the login page → orders.
  useEffect(() => {
    if (session === null && !isLogin) router.replace("/admin/login");
    if (session && isLogin) router.replace("/admin/orders");
  }, [session, isLogin, router]);

  if (!supabase) {
    return <p className="p-6 text-lg">Supabase is not configured. Set the environment variables first.</p>;
  }
  if (isLogin) return session === null ? <>{children}</> : <Loading />;
  if (!session) return <Loading />;
  if (isPrint) return <>{children}</>;

  const startShift = () => {
    unlockAudio();
    setStarted(true);
    router.push("/admin/orders");
  };

  return (
    <div className="min-h-dvh bg-stone-100 pb-24 text-lg">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-2 text-white">
        <p className="font-display text-xl">
          Xu <span className="text-gold">Kitchen</span>
        </p>
        <Link
          href="/admin/settings"
          className={`flex min-h-12 items-center gap-2 rounded-lg px-3 font-semibold ${pathname === "/admin/settings" ? "bg-white/20" : "hover:bg-white/10"}`}
        >
          <span aria-hidden>⚙️</span> Settings
        </Link>
      </header>

      {started ? (
        <Shift>{children}</Shift>
      ) : pathname === "/admin/settings" ? (
        children
      ) : (
        <StartShift onStart={startShift} />
      )}
    </div>
  );
}

function Loading() {
  return <p className="p-6 text-center text-lg text-stone-500">Loading…</p>;
}

function StartShift({ onStart }: { onStart: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 pb-10 pt-12 text-center">
      <p className="text-6xl" aria-hidden>
        🔔
      </p>
      <h1 className="mt-4 text-3xl font-bold">Ready to cook?</h1>
      <p className="mt-2 text-stone-600">Starting your shift turns on the new-order chime and keeps the screen awake.</p>
      <button
        type="button"
        onClick={onStart}
        className="mt-8 min-h-16 w-full rounded-2xl bg-green-700 px-6 text-2xl font-bold text-white shadow-lg active:bg-green-800"
      >
        Start shift
      </button>
      <div className="mt-8 w-full">
        <PushSettings />
      </div>
    </main>
  );
}

// Everything that should keep running on every tab once the shift has started:
// live orders, the chime, the wake lock and the bottom tabs.
function Shift({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<AdminOrder[]>([]);
  const [accepted, setAccepted] = useState<AdminOrder[]>([]);
  const [vegById, setVegById] = useState<Map<string, boolean>>(new Map());
  const [defaultPrep, setDefaultPrep] = useState(40);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // Realtime events can trigger overlapping refreshes; only the newest one may update the screen.
  const latest = useRef(0);
  const refresh = useCallback(async () => {
    const run = ++latest.current;
    try {
      const [p, a, veg] = await Promise.all([fetchPendingOrders(), fetchAcceptedToday(), fetchVegMap()]);
      if (run !== latest.current) return;
      setPending(p);
      setAccepted(a);
      setVegById(veg);
      setLoadError(false);
    } catch (err) {
      console.error("Could not load orders", err);
      if (run === latest.current) setLoadError(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  // First load, realtime updates, and a slow backup poll.
  useEffect(() => {
    void refresh();
    fetchDefaultPrepMinutes()
      .then(setDefaultPrep)
      .catch((err) => console.error("Could not load default prep time", err));
    const channel = supabase!
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void refresh())
      .subscribe();
    const poll = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      void supabase!.removeChannel(channel);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Keep the screen on during the shift (where the browser supports it).
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if (document.visibilityState === "visible") lock = await navigator.wakeLock?.request("screen");
      } catch {
        // Not supported or not allowed; ignore.
      }
    };
    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      void lock?.release();
    };
  }, []);

  // Clock for "minutes ago" and urgency.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), CHIME_EVERY_MS);
    return () => clearInterval(t);
  }, []);

  // Chime every 10 s while anything is waiting, and straight away when a new order arrives.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => {
    const ring = () => {
      const list = pendingRef.current;
      if (list.length) playChime(list.some((o) => isUrgent(o, Date.now())));
    };
    const t = setInterval(ring, CHIME_EVERY_MS);
    return () => clearInterval(t);
  }, []);
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fresh = pending.some((o) => !seen.current.has(o.id));
    pending.forEach((o) => seen.current.add(o.id));
    if (fresh) playChime(pending.some((o) => isUrgent(o, Date.now())));
  }, [pending]);

  const value: ShiftValue = { pending, accepted, vegById, defaultPrep, now, loaded, loadError, refresh, notify };

  return (
    <ShiftContext.Provider value={value}>
      {children}

      {toast && (
        <div role="status" className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-xl bg-ink px-4 py-3 text-center font-bold text-white shadow-2xl">
          {toast}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-300 bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Kitchen sections">
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            const badge = tab.href === "/admin/orders" && pending.length > 0 ? pending.length : 0;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-16 flex-col items-center justify-center text-sm font-bold ${
                    active ? "bg-brand/10 text-brand" : "text-stone-600"
                  }`}
                >
                  <span className="text-2xl" aria-hidden>
                    {tab.icon}
                  </span>
                  {tab.label}
                  {badge > 0 && (
                    <span className="absolute right-3 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-brand px-1.5 text-sm text-white">
                      {badge}
                      <span className="sr-only"> new orders</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </ShiftContext.Provider>
  );
}

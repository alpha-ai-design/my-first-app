"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import PageBoundary from "@/components/PageBoundary";
import { isSoundUnlocked, onSoundChange, playChime, unlockAudio } from "@/lib/admin/chime";
import { minutesSince } from "@/lib/admin/ist";
import { fetchAcceptedToday, fetchDefaultPrepMinutes, fetchPendingOrders, fetchVegMap, type AdminOrder } from "@/lib/admin/orders";
import { ensureAlerts, enableAlerts, PUSH_MESSAGES, type AlertStatus } from "@/lib/admin/push";
import { supabase } from "@/lib/supabase";

const CHIME_EVERY_MS = 10_000;
const URGENT_AFTER_MIN = 3;
const POLL_MS = 30_000; // backup in case the realtime connection drops

type KitchenValue = {
  pending: AdminOrder[];
  accepted: AdminOrder[];
  vegById: Map<string, boolean>;
  defaultPrep: number;
  now: number;
  loaded: boolean;
  loadError: boolean;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
  alerts: AlertStatus;
  checkAlerts: () => Promise<void>;
  turnOnAlerts: () => Promise<void>;
};

const KitchenContext = createContext<KitchenValue | null>(null);

export function useKitchen() {
  const ctx = useContext(KitchenContext);
  if (!ctx) throw new Error("useKitchen must be used inside the admin shell");
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
    return <p className="p-6">Supabase is not configured. Set the environment variables first.</p>;
  }
  if (isLogin) return session === null ? <>{children}</> : <Loading />;
  if (!session) return <Loading />;
  if (isPrint) return <>{children}</>;

  // Signed in: straight to the kitchen screens (no extra step).
  return (
    <Kitchen>
      <PageBoundary name="kitchen page">{children}</PageBoundary>
    </Kitchen>
  );
}

function Loading() {
  return <p className="p-6 text-center text-stone-600">Loading…</p>;
}

// Everything that keeps running on every owner tab: live orders, the chime, keeping the screen on,
// order alerts, the header and the tabs.
function Kitchen({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [soundOn, setSoundOn] = useState(false);
  const [alerts, setAlerts] = useState<AlertStatus>({ kind: "checking" });
  const [askDismissed, setAskDismissed] = useState(false);
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

  // Keep the screen on while the Orders screen is showing (where the browser supports it).
  const onOrders = pathname.startsWith("/admin/orders");
  useEffect(() => {
    if (!onOrders) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const request = async () => {
      if (stopped || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const got = (await navigator.wakeLock?.request("screen")) ?? null;
        // The owner may have left the Orders screen while the request was in progress.
        if (stopped) void got?.release();
        else lock = got;
      } catch {
        // Not supported, or the browser wants a tap first: tried again on the next tap.
      }
    };
    void request();
    document.addEventListener("visibilitychange", request);
    document.addEventListener("pointerdown", request);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", request);
      document.removeEventListener("pointerdown", request);
      void lock?.release();
    };
  }, [onOrders]);

  // Sound: browsers block it until the page has been interacted with. If the page already was
  // (e.g. the owner just tapped "Sign in"), unlock straight away; otherwise the first tap or key
  // press anywhere does it, and the banner says so.
  useEffect(() => {
    const unsubscribe = onSoundChange(setSoundOn);
    const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
    if (activated) void unlockAudio();
    else setSoundOn(isSoundUnlocked());
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (soundOn) return;
    const unlock = () => void unlockAudio();
    const opts = { capture: true };
    document.addEventListener("pointerdown", unlock, opts);
    document.addEventListener("keydown", unlock, opts);
    return () => {
      document.removeEventListener("pointerdown", unlock, opts);
      document.removeEventListener("keydown", unlock, opts);
    };
  }, [soundOn]);

  // Order alerts: checked silently every time the owner screen opens or comes back into view,
  // and when the service worker reports a renewed subscription. Never shows a prompt by itself.
  const checkAlerts = useCallback(async () => {
    try {
      setAlerts(await ensureAlerts());
    } catch (err) {
      console.error("Could not check order alerts", err);
      setAlerts({ kind: "off", reason: "setup", message: PUSH_MESSAGES.setup });
    }
  }, []);
  useEffect(() => {
    void checkAlerts();
    const onVisible = () => document.visibilityState === "visible" && void checkAlerts();
    const onWorkerMessage = (e: MessageEvent) => e.data?.type === "subscription-changed" && void checkAlerts();
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onWorkerMessage);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage);
    };
  }, [checkAlerts]);
  const turnOnAlerts = useCallback(async () => {
    setAlerts({ kind: "checking" });
    setAlerts(await enableAlerts());
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

  const value: KitchenValue = {
    pending,
    accepted,
    vegById,
    defaultPrep,
    now,
    loaded,
    loadError,
    refresh,
    notify,
    alerts,
    checkAlerts,
    turnOnAlerts,
  };

  return (
    <KitchenContext.Provider value={value}>
      <header className="sticky top-0 z-30 bg-ink text-white">
        <div className="mx-auto flex h-12 max-w-[1200px] items-center justify-between gap-2 px-4">
          <p className="font-display text-heading">
            Xu <span className="text-gold">Kitchen</span>
          </p>
          <div className="flex items-center gap-1">
            {alerts.kind === "on" && (
              <span className="rounded-md bg-white/10 px-2 py-1 text-caption font-semibold" role="status">
                <span aria-hidden>🔔</span> Alerts on
              </span>
            )}
            <Link
              href="/admin/settings"
              className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 font-semibold ${pathname === "/admin/settings" ? "bg-white/20" : "hover:bg-white/10"}`}
            >
              <span aria-hidden>⚙️</span> Settings
            </Link>
          </div>
        </div>
      </header>

      <ErrorBoundary name="kitchen banners" compact>
        <KitchenBanners
          soundOn={soundOn}
          alerts={alerts}
          askDismissed={askDismissed}
          onDismissAsk={() => setAskDismissed(true)}
          onTurnOn={turnOnAlerts}
          onRetry={checkAlerts}
        />
      </ErrorBoundary>

      <ErrorBoundary name="kitchen tabs" compact>
        {/* Bottom tab bar on phones; a top tab row under the header on screens 1024px and wider. */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-300 bg-white pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-12 lg:bottom-auto lg:border-b lg:border-t-0 lg:pb-0"
          aria-label="Kitchen sections"
        >
          <ul className="mx-auto grid max-w-2xl grid-cols-4 lg:flex lg:max-w-[1200px] lg:gap-1 lg:px-4">
            {TABS.map((tab) => {
              const active = pathname.startsWith(tab.href);
              const badge = tab.href === "/admin/orders" && pending.length > 0 ? pending.length : 0;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex min-h-14 flex-col items-center justify-center text-caption font-bold lg:min-h-10 lg:flex-row lg:gap-1.5 lg:rounded-lg lg:px-4 lg:text-body ${
                      active ? "bg-brand/10 text-brand lg:bg-brand lg:text-white" : "text-stone-700 lg:hover:bg-stone-100"
                    }`}
                  >
                    <span className="text-xl lg:text-base" aria-hidden>
                      {tab.icon}
                    </span>
                    {tab.label}
                    {badge > 0 && (
                      <span className="absolute right-3 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[12px] text-white ring-2 ring-white lg:static lg:ring-0">
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
      </ErrorBoundary>

      {children}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-xl bg-ink px-4 py-2.5 text-center font-semibold text-white shadow-2xl lg:bottom-6"
        >
          {toast}
        </div>
      )}
    </KitchenContext.Provider>
  );
}

// Slim banners under the header. None of them block the screen.
function KitchenBanners({
  soundOn,
  alerts,
  askDismissed,
  onDismissAsk,
  onTurnOn,
  onRetry,
}: {
  soundOn: boolean;
  alerts: AlertStatus;
  askDismissed: boolean;
  onDismissAsk: () => void;
  onTurnOn: () => void;
  onRetry: () => void;
}) {
  const bar = "mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5";
  return (
    <div>
      {!soundOn && (
        <div className="bg-gold text-ink" role="status">
          <p className={`${bar} justify-center text-center font-semibold`}>
            <span aria-hidden>🔈</span> Tap anywhere to turn on order sound
          </p>
        </div>
      )}
      {alerts.kind === "ask" && !askDismissed && (
        <div className="border-b border-blue-200 bg-blue-50 text-blue-950">
          <div className={bar}>
            <p className="flex-1 font-semibold">
              <span aria-hidden>🔔</span> Turn on alerts for new orders
            </p>
            <button type="button" onClick={onTurnOn} className="min-h-9 rounded-lg bg-blue-800 px-3 font-bold text-white">
              Turn on alerts
            </button>
            <button type="button" onClick={onDismissAsk} className="min-h-9 px-2 font-semibold text-blue-900 underline">
              Not now
            </button>
          </div>
        </div>
      )}
      {alerts.kind === "off" && (
        <div className="border-b border-red-200 bg-red-50 text-red-900" role="alert">
          <div className={bar}>
            <p className="flex-1">
              <span className="font-bold">Order alerts are off.</span> {alerts.message}
            </p>
            {alerts.reason !== "ios-add-to-home" && alerts.reason !== "unsupported" && (
              <button type="button" onClick={onRetry} className="min-h-9 rounded-lg border-2 border-red-800 bg-white px-3 font-bold text-red-800">
                {alerts.reason === "denied" ? "I've allowed it" : "Try again"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

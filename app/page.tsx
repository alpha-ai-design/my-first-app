"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categories, type MenuItem } from "@/data/menu";
import { useCart } from "@/lib/cart";
import { useMenu } from "@/lib/menu";
import { getSavedOrders, type SavedOrder } from "@/lib/orders";
import { orderOfferText } from "@/lib/pricing";
import Link from "next/link";
import MenuItemCard from "@/components/MenuItemCard";
import PortionSheet from "@/components/PortionSheet";
import CartBar from "@/components/CartBar";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function MenuPage() {
  const { add } = useCart();
  const { menu, error: loadError, offers } = useMenu();
  const orderOffers = offers.filter((o) => o.applies_to === "order");
  const [query, setQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [active, setActive] = useState<string>(categories[0].id);
  const [portionItem, setPortionItem] = useState<MenuItem | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [recentOrder, setRecentOrder] = useState<SavedOrder | undefined>();

  // Offer a way back to the status page for an order placed in the last 12 hours.
  useEffect(() => {
    const last = getSavedOrders()[0];
    if (last && Date.now() - new Date(last.placedAt).getTime() < 12 * 3600_000) setRecentOrder(last);
  }, []);

  const sections = useMemo(() => {
    if (!menu) return [];
    const q = query.trim().toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        items: menu.filter((m) => m.category === cat.id && (!vegOnly || m.veg) && (!q || m.name.toLowerCase().includes(q))),
      }))
      .filter((s) => s.items.length > 0);
  }, [menu, query, vegOnly]);

  // Highlight the tab for whichever section is currently near the top.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-170px 0px -60% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active tab scrolled into view in the tab strip.
  useEffect(() => {
    const tab = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    tab?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  const jumpTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const resultCount = sections.reduce((s, sec) => s + sec.items.length, 0);

  return (
    <main className="pb-28">
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(179,18,27,0.55),transparent_60%)]" />
        <div className="relative mx-auto max-w-5xl px-4 pb-4 pt-4 sm:pb-6 sm:pt-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.25em] text-gold">Wok-fired · Desi-style</p>
          <h1 className="mt-1 font-display text-title">
            Chinese, the <span className="text-gold">Indian</span> way.
          </h1>
          <p className="mt-1 max-w-md text-caption text-white/80">Delivered hot to your door. Pay on delivery with cash or UPI.</p>
          {recentOrder && (
            <Link
              href={`/order/${recentOrder.id}`}
              className="mt-3 inline-flex min-h-9 items-center rounded-full bg-gold px-4 text-caption font-bold text-ink shadow hover:bg-gold/90"
            >
              Track your order →
            </Link>
          )}
        </div>
      </section>

      {/* Order-level offers, e.g. "₹50 off on orders above ₹499" */}
      <ErrorBoundary name="offer banner" compact>
        {orderOffers.length > 0 && (
          <p className="bg-gold px-4 py-2 text-center text-caption font-bold text-ink">
            <span aria-hidden>🏷️ </span>
            {orderOffers.map(orderOfferText).join(" · ")}
          </p>
        )}
      </ErrorBoundary>

      {/* Sticky tools: search, veg toggle, category tabs (sits under the 56px header) */}
      <div className="sticky top-14 z-20 border-b border-stone-200 bg-cream/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 pt-2">
          <div className="flex items-center gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search dishes</span>
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a dish…"
                className="h-10 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 text-body outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={vegOnly}
              onClick={() => setVegOnly((v) => !v)}
              className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-caption font-semibold"
            >
              <span className={`relative h-5 w-9 rounded-full transition ${vegOnly ? "bg-green-700" : "bg-stone-300"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${vegOnly ? "left-[18px]" : "left-0.5"}`} />
              </span>
              Veg only
            </button>
          </div>

          <nav ref={tabsRef} className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-2" aria-label="Menu categories">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                data-tab={s.id}
                onClick={() => jumpTo(s.id)}
                className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-caption font-semibold transition ${
                  active === s.id ? "bg-brand text-white shadow" : "bg-white text-stone-700 ring-1 ring-stone-300 hover:ring-brand"
                }`}
              >
                <span aria-hidden>{s.emoji}</span> {s.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4">
        {!menu && !loadError && <p className="py-16 text-center text-stone-600">Loading menu…</p>}

        {loadError && (
          <div className="py-16 text-center">
            <p className="font-semibold">Sorry, we couldn&apos;t load the menu.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 min-h-10 rounded-lg bg-brand px-5 font-semibold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {menu && resultCount === 0 && (
          <div className="py-16 text-center">
            <p className="text-5xl" aria-hidden>
              🥢
            </p>
            <p className="mt-3 font-semibold">No dishes match your search.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setVegOnly(false);
              }}
              className="mt-4 min-h-10 rounded-lg bg-brand px-5 font-semibold text-white"
            >
              Clear filters
            </button>
          </div>
        )}

        {sections.map((s) => (
          <ErrorBoundary key={s.id} name={`menu section ${s.id}`} compact>
            <section id={s.id} className="scroll-mt-[170px] pt-5">
              <h2 className="mb-2 flex items-center gap-2 font-display text-heading uppercase tracking-wide">
                <span className="h-5 w-1 rounded-full bg-brand" aria-hidden />
                {s.name}
                <span className="font-sans text-caption font-normal normal-case text-stone-600">({s.items.length})</span>
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {s.items.map((item) => (
                  <MenuItemCard key={item.id} item={item} onChoosePortion={setPortionItem} />
                ))}
              </div>
            </section>
          </ErrorBoundary>
        ))}
      </div>

      {portionItem && (
        <ErrorBoundary name="portion picker" compact>
          <PortionSheet
            item={portionItem}
            onClose={() => setPortionItem(null)}
            onConfirm={(portion) => {
              add(portionItem.id, portion);
              setPortionItem(null);
            }}
          />
        </ErrorBoundary>
      )}

      <ErrorBoundary name="cart bar" compact>
        <CartBar />
      </ErrorBoundary>
    </main>
  );
}

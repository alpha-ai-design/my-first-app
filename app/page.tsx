"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categories, type MenuItem } from "@/data/menu";
import { useCart } from "@/lib/cart";
import { useMenu } from "@/lib/menu";
import { getSavedOrders, type SavedOrder } from "@/lib/orders";
import Link from "next/link";
import MenuItemCard from "@/components/MenuItemCard";
import PortionSheet from "@/components/PortionSheet";
import CartBar from "@/components/CartBar";

export default function MenuPage() {
  const { add } = useCart();
  const { menu, error: loadError } = useMenu();
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
        items: menu.filter(
          (m) => m.category === cat.id && (!vegOnly || m.veg) && (!q || m.name.toLowerCase().includes(q)),
        ),
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
      { rootMargin: "-130px 0px -60% 0px" },
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
        <div className="relative mx-auto max-w-5xl px-4 pb-6 pt-5 sm:pb-10 sm:pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Wok-fired · Desi-style</p>
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-5xl">
            Chinese, the <span className="text-gold">Indian</span> way.
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/70 sm:text-base">
            Order straight from your phone — for your table or to take away.
          </p>
          {recentOrder && (
            <Link
              href={`/order/${recentOrder.id}`}
              className="mt-3 inline-block rounded-full bg-gold px-4 py-1.5 text-sm font-bold text-ink shadow hover:bg-gold/90"
            >
              Track your order →
            </Link>
          )}
        </div>
      </section>

      {/* Sticky tools: search, veg toggle, category tabs */}
      <div className="sticky top-[62px] z-20 border-b border-stone-200 bg-cream/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 pt-3">
          <div className="flex items-center gap-3">
            <label className="relative flex-1">
              <span className="sr-only">Search dishes</span>
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a dish…"
                className="h-11 w-full rounded-xl border border-stone-300 bg-white pl-9 pr-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={vegOnly}
              onClick={() => setVegOnly((v) => !v)}
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold"
            >
              <span className={`relative h-5 w-9 rounded-full transition ${vegOnly ? "bg-green-700" : "bg-stone-300"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${vegOnly ? "left-[18px]" : "left-0.5"}`} />
              </span>
              Veg only
            </button>
          </div>

          <nav ref={tabsRef} className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Menu categories">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                data-tab={s.id}
                onClick={() => jumpTo(s.id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
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
        {!menu && !loadError && <p className="py-16 text-center text-stone-500">Loading menu…</p>}

        {loadError && (
          <div className="py-16 text-center">
            <p className="font-semibold">Sorry, we couldn&apos;t load the menu.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-brand px-5 py-2.5 font-semibold text-white"
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
              className="mt-4 rounded-lg bg-brand px-5 py-2.5 font-semibold text-white"
            >
              Clear filters
            </button>
          </div>
        )}

        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-[190px] pt-6">
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl uppercase tracking-wide">
              <span className="h-6 w-1.5 rounded-full bg-brand" aria-hidden />
              {s.name}
              <span className="font-sans text-sm font-normal normal-case text-stone-400">({s.items.length})</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {s.items.map((item) => (
                <MenuItemCard key={item.id} item={item} onChoosePortion={setPortionItem} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {portionItem && (
        <PortionSheet
          item={portionItem}
          onClose={() => setPortionItem(null)}
          onConfirm={(portion) => {
            add(portionItem.id, portion);
            setPortionItem(null);
          }}
        />
      )}

      <CartBar />
    </main>
  );
}

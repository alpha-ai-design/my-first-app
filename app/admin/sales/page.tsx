"use client";

import { useCallback, useEffect, useState } from "react";
import { formatTimeIST } from "@/lib/admin/ist";
import { offerTitle } from "@/lib/admin/offers";
import { fetchSales, type Period, type SalesMetrics, type SalesSummary } from "@/lib/admin/sales";
import { formatINR } from "@/lib/cart";

const PERIODS: { id: Period; label: string; empty: string }[] = [
  { id: "today", label: "Today", empty: "No orders yet today." },
  { id: "yesterday", label: "Yesterday", empty: "No orders yesterday." },
  { id: "this_week", label: "This week", empty: "No orders yet this week." },
  { id: "this_month", label: "This month", empty: "No orders yet this month." },
];

const NO_RESPONSE = "Restaurant didn't respond";

// "▲ 12% vs last Tuesday", "▼ 8% vs last week", "= Same as last month", or "No orders to compare".
function Comparison({ current, previous, prevOrders, label }: { current: number; previous: number; prevOrders: number; label: string }) {
  if (prevOrders === 0 || previous === 0) return <p className="mt-1 text-caption text-stone-600">No orders to compare</p>;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <p className="mt-1 text-caption font-semibold text-stone-700">= Same as {label}</p>;
  const up = pct > 0;
  return (
    <p className={`mt-1 text-caption font-semibold ${up ? "text-green-800" : "text-red-700"}`}>
      <span aria-hidden>{up ? "▲" : "▼"} </span>
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {Math.abs(pct)}% vs {label}
    </p>
  );
}

function MetricCard({
  title,
  value,
  current,
  previous,
  prevOrders,
  label,
  children,
}: {
  title: string;
  value: string;
  current: number;
  previous: number;
  prevOrders: number;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70">
      <h2 className="text-caption font-semibold uppercase tracking-wide text-stone-600">{title}</h2>
      <p className="mt-0.5 text-metric font-bold tabular-nums">{value}</p>
      <Comparison current={current} previous={previous} prevOrders={prevOrders} label={label} />
      {children}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70">
      <h2 className="text-heading font-bold">{title}</h2>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

export default function AdminSalesPage() {
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      setData(await fetchSales(p));
      setUpdatedAt(new Date());
      setError(false);
    } catch (err) {
      console.error("Could not load sales", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [period, load]);

  const cur: SalesMetrics | undefined = data?.period === period ? data.current : undefined;
  const prev = data?.period === period ? data.previous : undefined;
  const label = data?.compare_label ?? "";
  const empty = cur && cur.order_count === 0 && cur.missed.length === 0;

  // "Restaurant didn't respond" first, then the rest by count.
  const missed = cur ? [...cur.missed].sort((a, b) => Number(b.reason === NO_RESPONSE) - Number(a.reason === NO_RESPONSE) || b.count - a.count) : [];

  return (
    <main className="mx-auto max-w-[1200px] px-3 pt-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-title font-bold">Sales</h1>
        <div className="flex items-center gap-2">
          {updatedAt && <span className="text-caption text-stone-600">Updated {formatTimeIST(updatedAt)}</span>}
          <button
            type="button"
            onClick={() => void load(period)}
            disabled={loading}
            className="min-h-10 rounded-lg border-2 border-stone-300 bg-white px-3 font-semibold disabled:opacity-50"
          >
            {loading ? "Updating…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1 rounded-lg bg-stone-200 p-1 sm:inline-grid" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={period === p.id}
            onClick={() => setPeriod(p.id)}
            className={`min-h-9 rounded-md px-2 text-caption font-bold sm:px-4 ${period === p.id ? "bg-white text-ink shadow-sm" : "text-stone-700"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-100 p-2.5 font-semibold text-red-800">
          Can&apos;t load sales. Check the internet connection, and that 06_offers_and_sales.sql has been run.
        </p>
      )}
      {!cur && !error && <p className="mt-4 text-stone-600">Loading sales…</p>}

      {cur && prev && empty && (
        <div className="mt-4 rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200/70">
          <p className="text-3xl" aria-hidden>
            🧾
          </p>
          <p className="mt-2 text-heading font-bold">{PERIODS.find((p) => p.id === period)!.empty}</p>
          <p className="mt-1 text-stone-600">Sales will show here as soon as you accept orders.</p>
        </div>
      )}

      {cur && prev && !empty && (
        <>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <MetricCard title="Net sales" value={formatINR(cur.net_sales)} current={cur.net_sales} previous={prev.net_sales} prevOrders={prev.order_count} label={label}>
              <p className="mt-1.5 border-t border-stone-200 pt-1.5 text-caption text-stone-700">
                GST collected {formatINR(cur.gst_collected)} (set aside) · Delivery fees {formatINR(cur.delivery_fees)}
              </p>
            </MetricCard>
            <MetricCard title="Orders" value={String(cur.order_count)} current={cur.order_count} previous={prev.order_count} prevOrders={prev.order_count} label={label} />
            <MetricCard
              title="Average order value"
              value={formatINR(cur.average_order_value)}
              current={cur.average_order_value}
              previous={prev.average_order_value}
              prevOrders={prev.order_count}
              label={label}
            />
          </div>
          <p className="mt-1.5 text-caption text-stone-600">Accepted orders only. Net sales exclude GST and delivery fees, after discounts.</p>

          <div className="mt-3 grid items-start gap-3 md:grid-cols-2">
            <Panel title="Top 5 dishes">
              {cur.top_dishes.length === 0 ? (
                <p className="text-stone-600">No dishes sold yet.</p>
              ) : (
                <ol className="space-y-1">
                  {cur.top_dishes.map((d, i) => (
                    <li key={d.name} className="flex justify-between gap-2">
                      <span>
                        <span className="font-semibold text-stone-600">{i + 1}.</span> {d.name}
                      </span>
                      <span className="font-semibold tabular-nums">× {d.quantity}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title="Missed sales">
              {missed.length === 0 ? (
                <p className="text-stone-600">No rejected or cancelled orders. 🎉</p>
              ) : (
                <table className="w-full">
                  <thead className="sr-only">
                    <tr>
                      <th>Reason</th>
                      <th>Orders</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {missed.map((m) => (
                      <tr key={`${m.status}-${m.reason}`}>
                        <td className="py-1 pr-2 align-top">
                          {m.reason}
                          <span className="ml-1.5 rounded bg-stone-200 px-1.5 text-[12px] font-semibold text-stone-800">{m.status === "rejected" ? "Rejected" : "Cancelled"}</span>
                        </td>
                        <td className="whitespace-nowrap py-1 pr-2 text-right align-top tabular-nums">
                          {m.count} {m.count === 1 ? "order" : "orders"}
                        </td>
                        <td className="whitespace-nowrap py-1 text-right align-top font-semibold tabular-nums">{formatINR(m.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel title="Offer results">
              {cur.offers.length === 0 ? (
                <p className="text-stone-600">No offers were used.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-caption text-stone-600">
                      <th className="pb-1 font-semibold">Offer</th>
                      <th className="pb-1 text-right font-semibold">Orders</th>
                      <th className="pb-1 text-right font-semibold">Discount given</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {cur.offers.map((o) => (
                      <tr key={o.offer_id}>
                        <td className="py-1 pr-2">{o.title || offerTitle({ ...o, min_order: Number(o.min_order) }, [])}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{o.orders}</td>
                        <td className="py-1 text-right font-semibold tabular-nums">{formatINR(o.discount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel title="No orders this period">
              {cur.unsold_dishes.length === 0 ? (
                <p className="text-stone-600">Every dish on the menu sold at least once.</p>
              ) : (
                <>
                  <p className="text-caption text-stone-600">
                    {cur.unsold_dishes.length} {cur.unsold_dishes.length === 1 ? "dish" : "dishes"} on the menu had no accepted orders.
                  </p>
                  <p className="mt-1 leading-relaxed">{cur.unsold_dishes.join(" · ")}</p>
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </main>
  );
}

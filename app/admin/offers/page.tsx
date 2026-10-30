"use client";

import ErrorBoundary from "@/components/ErrorBoundary";
import { useCallback, useEffect, useState } from "react";
import { useShift } from "@/components/admin/AdminShell";
import OfferForm from "@/components/admin/OfferForm";
import { formatDayTimeIST, formatDuration } from "@/lib/admin/ist";
import { fetchDishes, type Dish } from "@/lib/admin/menu";
import { appliesToText, fetchAllOffers, offerTitle, phaseOf, stopOffer, type OfferPhase } from "@/lib/admin/offers";
import { offerBadge, type Offer } from "@/lib/pricing";

const SECTIONS: { phase: OfferPhase; title: string; empty: string }[] = [
  { phase: "active", title: "Active", empty: "No offers running right now." },
  { phase: "scheduled", title: "Scheduled", empty: "Nothing scheduled." },
  { phase: "ended", title: "Ended", empty: "No ended offers yet." },
];

export default function AdminOffersPage() {
  const { now, notify } = useShift(); // ticks every 10 s so "Ends in" and the sections stay current
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [o, d] = await Promise.all([fetchAllOffers(), fetchDishes()]);
      setOffers(o);
      setDishes(d);
      setLoadError(false);
    } catch (err) {
      console.error("Could not load offers", err);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const menuDishes = dishes.filter((d) => !d.is_archived);

  return (
    <main className="mx-auto max-w-[1200px] px-3 pt-3 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-title font-bold">Offers</h1>
        <button type="button" onClick={() => setCreating(true)} className="min-h-10 rounded-lg bg-green-700 px-4 font-bold text-white">
          + New offer
        </button>
      </div>

      {loadError && (
        <p role="alert" className="mt-3 rounded-lg bg-red-100 p-2.5 font-semibold text-red-800">
          Can&apos;t load offers. Check the internet connection, and that 06_offers_and_sales.sql has been run.
        </p>
      )}
      {!offers && !loadError && <p className="mt-4 text-stone-600">Loading offers…</p>}

      {offers &&
        SECTIONS.map(({ phase, title, empty }) => {
          const list = offers
            .filter((o) => phaseOf(o, Date.now()) === phase) // exact time: an offer saved a moment ago is already active
            .sort((a, b) =>
              phase === "scheduled"
                ? a.starts_at.localeCompare(b.starts_at)
                : phase === "active"
                  ? a.ends_at.localeCompare(b.ends_at)
                  : b.ends_at.localeCompare(a.ends_at),
            )
            .slice(0, phase === "ended" ? 30 : undefined);
          return (
            <section key={phase} className="mt-5" aria-labelledby={`offers-${phase}`}>
              <h2 id={`offers-${phase}`} className="mb-2 text-heading font-bold">
                {title} <span className="font-semibold text-stone-600">({list.length})</span>
              </h2>
              {list.length === 0 ? (
                <p className="rounded-lg bg-white p-3 text-stone-600">{empty}</p>
              ) : (
                <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((o) => (
                    <ErrorBoundary key={o.id} name={`offer ${o.id}`} compact>
                      <OfferCard
                        offer={o}
                        phase={phase}
                        dishes={dishes}
                        now={now}
                        onStopped={async () => {
                          await refresh();
                          notify(`“${o.title || offerTitle(o, dishes)}” stopped. Customers see normal prices now.`);
                        }}
                      />
                    </ErrorBoundary>
                  ))}
                </div>
              )}
            </section>
          );
        })}

      {creating && offers && (
        <OfferForm
          dishes={menuDishes}
          offers={offers}
          onClose={() => setCreating(false)}
          onSaved={async (message) => {
            setCreating(false);
            await refresh();
            notify(message);
          }}
        />
      )}
    </main>
  );
}

function OfferCard({
  offer,
  phase,
  dishes,
  now,
  onStopped,
}: {
  offer: Offer;
  phase: OfferPhase;
  dishes: Dish[];
  now: number;
  onStopped: () => Promise<void>;
}) {
  const { notify } = useShift();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = { active: "Active", scheduled: "Scheduled", ended: offer.is_active ? "Ended" : "Stopped" }[phase];
  const tone = { active: "bg-green-700", scheduled: "bg-blue-700", ended: "bg-stone-600" }[phase];

  const stop = async () => {
    setBusy(true);
    try {
      await stopOffer(offer.id);
      await onStopped();
    } catch (err) {
      console.error("Stopping offer failed", err);
      notify("Couldn't stop the offer. Check the internet and try again.");
      setBusy(false);
    }
  };

  return (
    <article className={`rounded-xl border bg-white p-3 shadow-sm ${phase === "active" ? "border-green-700" : "border-stone-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold leading-snug">{offer.title || offerTitle(offer, dishes)}</h3>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-white ${tone}`}>{label}</span>
      </div>
      <dl className="mt-1.5 space-y-0.5 text-caption text-stone-700">
        <div>
          <dt className="inline font-semibold">Discount: </dt>
          <dd className="inline">{offerBadge(offer)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Applies to: </dt>
          <dd className="inline">{appliesToText(offer, dishes)}</dd>
        </div>
        {phase === "active" && (
          <div>
            <dt className="inline font-semibold">Ends in </dt>
            <dd className="inline">
              {formatDuration(new Date(offer.ends_at).getTime() - now)} ({formatDayTimeIST(offer.ends_at)})
            </dd>
          </div>
        )}
        {phase === "scheduled" && (
          <div>
            <dt className="inline font-semibold">Starts: </dt>
            <dd className="inline">
              {formatDayTimeIST(offer.starts_at)} · ends {formatDayTimeIST(offer.ends_at)}
            </dd>
          </div>
        )}
        {phase === "ended" && (
          <div>
            <dt className="inline font-semibold">{offer.is_active ? "Ended: " : "Was due to end: "}</dt>
            <dd className="inline">{formatDayTimeIST(offer.ends_at)}</dd>
          </div>
        )}
      </dl>

      {phase !== "ended" &&
        (confirming ? (
          <div className="mt-2.5 rounded-lg bg-red-50 p-2.5">
            <p className="text-caption font-semibold text-red-900">
              {phase === "active" ? "Stop this offer now? Customers will see normal prices straight away." : "Cancel this offer? It won't start."}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={stop}
                className="min-h-10 rounded-lg bg-red-700 font-bold text-white disabled:opacity-50"
              >
                {busy ? "Stopping…" : phase === "active" ? "Yes, stop" : "Yes, cancel"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="min-h-10 rounded-lg border-2 border-stone-300 bg-white font-bold"
              >
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-2.5 min-h-10 w-full rounded-lg border-2 border-red-700 bg-white font-bold text-red-700"
          >
            {phase === "active" ? "Stop now" : "Cancel offer"}
          </button>
        ))}
    </article>
  );
}

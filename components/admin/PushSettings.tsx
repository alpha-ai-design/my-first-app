"use client";

import { useState } from "react";
import { useKitchen } from "@/components/admin/AdminShell";
import { sendTestNotification } from "@/lib/admin/push";

// Settings → Order alerts: current status and "Send test notification".
// Alerts set themselves up automatically; this only offers a button when the owner has never been asked.
export default function PushSettings() {
  const { alerts, turnOnAlerts, checkAlerts } = useKitchen();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const test = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const error = await sendTestNotification();
      setMessage(error ? { ok: false, text: error } : { ok: true, text: "Test sent. It should appear in a few seconds." });
      if (error) void checkAlerts(); // renews the subscription if it had expired
    } finally {
      setBusy(false);
    }
  };

  const on = alerts.kind === "on";
  const btn = "min-h-11 w-full rounded-lg px-4 font-bold disabled:opacity-50 md:min-h-10";

  return (
    <section className="space-y-2.5 rounded-xl bg-white p-3 text-left shadow-sm" aria-labelledby="push-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="push-heading" className="text-heading font-bold">
          Order alerts
        </h2>
        {alerts.kind !== "checking" && (
          <span className={`rounded-md px-2 py-0.5 text-caption font-bold text-white ${on ? "bg-green-700" : "bg-stone-600"}`} role="status">
            {on ? "🔔 Alerts on" : "Alerts off"}
          </span>
        )}
      </div>
      <p className="text-caption text-stone-600">A notification for every new order, even when this screen is closed. Alerts stay on by themselves once allowed.</p>

      {alerts.kind === "checking" && <p className="text-stone-600">Checking…</p>}

      {alerts.kind === "ask" && (
        <button type="button" onClick={turnOnAlerts} className={`${btn} bg-ink text-white`}>
          Turn on alerts for new orders
        </button>
      )}

      {alerts.kind === "off" && <p className="rounded-lg bg-yellow-100 p-2.5 font-semibold text-yellow-950">{alerts.message}</p>}

      {on && (
        <button type="button" disabled={busy} onClick={test} className={`${btn} border-2 border-ink bg-white`}>
          {busy ? "Sending…" : "Send test notification"}
        </button>
      )}

      {message && (
        <p role="status" className={`rounded-lg p-2.5 font-semibold ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}

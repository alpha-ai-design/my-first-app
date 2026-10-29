"use client";

import { useEffect, useState } from "react";
import { getPushState, isIOS, sendTestNotification, turnOnNotifications, type PushState } from "@/lib/admin/push";

// "Turn on order notifications" + "Send test notification", with help for iPhone and blocked permission.
export default function PushSettings() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(isIOS());
    getPushState()
      .then(setState)
      .catch((err) => {
        console.error("Could not check notifications", err);
        setState("off");
      });
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await turnOnNotifications();
      setState(next);
      if (next === "on") setMessage({ ok: true, text: "Done. Send a test to check it works." });
      if (next === "off") setMessage({ ok: false, text: "Notifications weren't allowed. Tap the button again and choose Allow." });
    } catch (err) {
      console.error("Turning on notifications failed", err);
      setMessage({ ok: false, text: "Couldn't turn on notifications. Check the internet and try again." });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const error = await sendTestNotification();
      setMessage(error ? { ok: false, text: error } : { ok: true, text: "Test sent. It should appear in a few seconds." });
      if (error?.includes("again")) setState(await getPushState());
    } finally {
      setBusy(false);
    }
  };

  const on = state === "on";
  const btn = "min-h-14 w-full rounded-xl px-4 text-lg font-bold disabled:opacity-50";

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 text-left shadow-sm" aria-labelledby="push-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="push-heading" className="text-xl font-bold">
          Order notifications
        </h2>
        {state !== "checking" && (
          <span
            className={`rounded-md px-2.5 py-1 text-base font-extrabold text-white ${on ? "bg-green-700" : "bg-stone-600"}`}
            role="status"
          >
            {on ? "Notifications on" : "Notifications off"}
          </span>
        )}
      </div>
      <p className="text-stone-600">Get an alert for every new order, even when this screen is closed.</p>

      {state === "checking" && <p className="text-stone-500">Checking…</p>}

      {state === "ios-add-to-home" && (
        <p className="rounded-xl bg-yellow-100 p-3 text-lg font-semibold text-yellow-950">
          Tap Share, then Add to Home Screen, then open Xu Kitchen from your home screen.
        </p>
      )}

      {state === "unsupported" && (
        <p className="rounded-xl bg-yellow-100 p-3 font-semibold text-yellow-950">
          This browser can&apos;t show notifications. On Android use Chrome. On iPhone, add Xu Kitchen to the Home Screen and open it from there.
        </p>
      )}

      {state === "not-configured" && (
        <p className="rounded-xl bg-yellow-100 p-3 font-semibold text-yellow-950">
          Notifications aren&apos;t set up yet: NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing in the website settings.
        </p>
      )}

      {state === "blocked" && (
        <div className="space-y-1 rounded-xl bg-yellow-100 p-3 font-semibold text-yellow-950">
          <p>Notifications are blocked for Xu Kitchen. To allow them again:</p>
          {ios ? (
            <p>Open the iPhone Settings app → Notifications → Xu Kitchen → turn on Allow Notifications. Then come back here.</p>
          ) : (
            <p>
              In Chrome, tap the icon to the left of the web address → Permissions (or Site settings) → Notifications → Allow. Or open the phone Settings →
              Apps → Chrome (or Xu Kitchen) → Notifications → Allow. Then come back here and reload.
            </p>
          )}
        </div>
      )}

      {state === "off" && (
        <button type="button" disabled={busy} onClick={turnOn} className={`${btn} bg-ink text-white`}>
          {busy ? "Turning on…" : "Turn on order notifications"}
        </button>
      )}

      {on && (
        <button type="button" disabled={busy} onClick={test} className={`${btn} border-2 border-ink bg-white`}>
          {busy ? "Sending…" : "Send test notification"}
        </button>
      )}

      {message && <p className={`rounded-xl p-3 font-semibold ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>}
    </section>
  );
}

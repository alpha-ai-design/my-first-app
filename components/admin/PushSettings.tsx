"use client";

import { useEffect, useState } from "react";
import { getPushState, isIOS, PushError, PUSH_MESSAGES, sendTestNotification, turnOnNotifications, type PushState } from "@/lib/admin/push";

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
      if (err instanceof PushError && err.kind === "blocked") setState("blocked");
      else if (err instanceof PushError && err.kind === "unsupported") setState("unsupported");
      else setMessage({ ok: false, text: err instanceof PushError ? err.message : PUSH_MESSAGES.setup });
      if (!(err instanceof PushError)) console.error("Turning on notifications failed", err);
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
  const btn = "min-h-11 w-full rounded-lg px-4 font-bold disabled:opacity-50 md:min-h-10";
  const help = "rounded-lg bg-yellow-100 p-2.5 font-semibold text-yellow-950";

  return (
    <section className="space-y-2.5 rounded-xl bg-white p-3 text-left shadow-sm" aria-labelledby="push-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="push-heading" className="text-heading font-bold">
          Order notifications
        </h2>
        {state !== "checking" && (
          <span className={`rounded-md px-2 py-0.5 text-caption font-bold text-white ${on ? "bg-green-700" : "bg-stone-600"}`} role="status">
            {on ? "Notifications on" : "Notifications off"}
          </span>
        )}
      </div>
      <p className="text-caption text-stone-600">Get an alert for every new order, even when this screen is closed.</p>

      {state === "checking" && <p className="text-stone-600">Checking…</p>}

      {state === "ios-add-to-home" && <p className={help}>Tap Share, then Add to Home Screen, then open Xu Kitchen from your home screen.</p>}

      {state === "unsupported" && <p className={help}>{PUSH_MESSAGES.unsupported}</p>}

      {state === "not-configured" && <p className={help}>{PUSH_MESSAGES.setup}</p>}

      {state === "blocked" && (
        <p className={help}>
          {ios ? PUSH_MESSAGES.blockedIOS : PUSH_MESSAGES.blocked} Then come back here and reload.
        </p>
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

      {message && (
        <p role="status" className={`rounded-lg p-2.5 font-semibold ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}

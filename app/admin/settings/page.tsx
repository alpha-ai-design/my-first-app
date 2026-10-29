"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const MIN_LENGTH = 8;

export default function AdminSettingsPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    if (password.length < MIN_LENGTH) return setMessage({ ok: false, text: `Use at least ${MIN_LENGTH} characters.` });
    if (password !== confirm) return setMessage({ ok: false, text: "The two passwords don't match." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      console.error("Password change failed", error);
      setMessage({ ok: false, text: "Couldn't change the password. Please try again." });
    } else {
      setPassword("");
      setConfirm("");
      setMessage({ ok: true, text: "Password changed." });
    }
  };

  const logOut = async () => {
    await supabase?.auth.signOut();
    router.replace("/admin/login");
  };

  const inputCls =
    "mt-1 min-h-14 w-full rounded-xl border border-stone-300 bg-white px-4 text-lg outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 pt-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <form onSubmit={changePassword} className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-xl font-bold">Change password</h2>
        <label className="block">
          <span className="font-semibold">New password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputCls} />
        </label>
        <label className="block">
          <span className="font-semibold">Type it again</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputCls} />
        </label>
        {message && (
          <p role="status" className={`rounded-xl p-3 font-semibold ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={busy} className="min-h-14 w-full rounded-xl bg-ink text-lg font-bold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>

      <button type="button" onClick={logOut} className="min-h-14 w-full rounded-xl border-2 border-brand bg-white text-lg font-bold text-brand">
        Log out
      </button>
    </main>
  );
}

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    // On success the admin shell sees the new session and opens the Orders screen.
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Wrong email or password." : "Couldn't sign in. Check your connection and try again.");
      setBusy(false);
    }
  };

  const inputCls =
    "mt-1 min-h-14 w-full rounded-xl border border-stone-300 bg-white px-4 text-lg outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <main className="mx-auto max-w-sm px-4 pt-16 text-lg">
      <h1 className="font-display text-3xl">
        Xu <span className="text-brand">Kitchen</span>
      </h1>
      <p className="mt-1 text-stone-600">Sign in to see orders.</p>
      <form onSubmit={signIn} className="mt-8 space-y-5">
        <label className="block">
          <span className="font-semibold">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required className={inputCls} />
        </label>
        <label className="block">
          <span className="font-semibold">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className={inputCls}
          />
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 font-semibold text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="min-h-14 w-full rounded-xl bg-brand text-xl font-bold text-white disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

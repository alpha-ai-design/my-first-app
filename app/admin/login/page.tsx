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
    "mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <main className="mx-auto max-w-sm px-4 pt-12">
      <h1 className="font-display text-title">
        Xu <span className="text-brand">Kitchen</span>
      </h1>
      <p className="mt-1 text-stone-600">Sign in to see orders.</p>
      <form onSubmit={signIn} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-caption font-semibold">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required className={inputCls} />
        </label>
        <label className="block">
          <span className="text-caption font-semibold">Password</span>
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
          <p role="alert" className="rounded-lg bg-red-50 p-2.5 font-semibold text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="min-h-11 w-full rounded-lg bg-brand text-heading font-bold text-white disabled:opacity-60 md:min-h-10">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

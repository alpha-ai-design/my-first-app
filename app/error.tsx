"use client";

import { useEffect } from "react";

// Shown if a whole page crashes (sections inside pages have their own smaller error boundaries).
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-4xl" aria-hidden>
        🥢
      </p>
      <h1 className="mt-3 text-title font-bold">Something went wrong. Please refresh.</h1>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-lg bg-brand px-5 font-bold text-white">
          Refresh
        </button>
        <button type="button" onClick={reset} className="min-h-11 rounded-lg border-2 border-stone-300 bg-white px-5 font-bold">
          Try again
        </button>
      </div>
    </main>
  );
}

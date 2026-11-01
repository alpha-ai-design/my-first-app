"use client";

// Last resort if the root layout itself crashes: plain HTML, no app styles or providers.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  console.error("App error:", error);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fbf6ee", color: "#141111" }}>
        <main style={{ maxWidth: 420, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 21 }}>Something went wrong. Please refresh.</h1>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: "0 20px",
              border: 0,
              borderRadius: 8,
              background: "#b3121b",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            Refresh
          </button>
        </main>
      </body>
    </html>
  );
}

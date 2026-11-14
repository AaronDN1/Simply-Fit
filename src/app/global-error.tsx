"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f2ec", color: "#1d1c19", fontFamily: "Georgia, serif" }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 36, fontWeight: 400, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#77736b", fontFamily: "system-ui, sans-serif", fontSize: 15 }}>The app couldn't load this view. Try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 20, height: 44, padding: "0 18px", border: 0, borderRadius: 999, background: "#1d1c19", color: "#f5f2ec", fontFamily: "system-ui, sans-serif" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

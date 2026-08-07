"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Luna root layout failed", error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Luna needs a refresh</title>
      </head>
      <body style={{ margin: 0, background: "#f7f8f5", color: "#16201d", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ alignItems: "center", display: "flex", minHeight: "100vh", padding: 24, boxSizing: "border-box" }}>
          <section style={{ background: "#fff", border: "1px solid #dce3df", borderRadius: 24, margin: "0 auto", maxWidth: 420, padding: 28, width: "100%" }}>
            <div aria-hidden="true" style={{ alignItems: "center", background: "#e3efeb", borderRadius: 14, color: "#356b68", display: "flex", fontSize: 24, height: 48, justifyContent: "center", width: 48 }}>☾</div>
            <p style={{ color: "#356b68", fontSize: 14, fontWeight: 700, margin: "24px 0 0" }}>Luna needs a moment</p>
            <h1 style={{ fontSize: 30, letterSpacing: "-0.04em", lineHeight: 1.1, margin: "8px 0 0" }}>The app could not finish loading</h1>
            <p style={{ color: "#66736f", fontSize: 14, lineHeight: 1.6, margin: "14px 0 0" }}>Your data was not changed. Refresh Luna to continue.</p>
            <button type="button" onClick={reset} style={{ background: "#356b68", border: 0, borderRadius: 13, color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700, height: 48, marginTop: 28, width: "100%" }}>Reload Luna</button>
          </section>
        </main>
      </body>
    </html>
  );
}

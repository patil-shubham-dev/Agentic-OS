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
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "#0C0C0E",
            color: "#E4E4E7",
            fontFamily: "system-ui, -apple-system, sans-serif",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: "420px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}
            >
              !
            </div>
            <h1 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
              AgentOS Studio encountered a critical error
            </h1>
            <p
              style={{
                fontSize: "12px",
                color: "#A1A1AA",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              The application failed to load. This has been logged and can be
              recovered.
            </p>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button
                onClick={reset}
                style={{
                  padding: "8px 20px",
                  fontSize: "12px",
                  fontWeight: 500,
                  borderRadius: "8px",
                  border: "none",
                  background: "#6366F1",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Restart Application
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.clear();
                    window.location.reload();
                  } catch {}
                }}
                style={{
                  padding: "8px 20px",
                  fontSize: "12px",
                  fontWeight: 500,
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent",
                  color: "#A1A1AA",
                  cursor: "pointer",
                }}
              >
                Clear & Restart
              </button>
            </div>
            {error?.digest && (
              <p
                style={{
                  fontSize: "10px",
                  color: "#52525B",
                  margin: "8px 0 0 0",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
            {process.env.NODE_ENV === "development" && (
              <pre
                style={{
                  fontSize: "10px",
                  color: "#71717A",
                  textAlign: "left",
                  background: "rgba(255,255,255,0.03)",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.05)",
                  maxWidth: "100%",
                  overflow: "auto",
                  maxHeight: "200px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {error.stack}
              </pre>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}

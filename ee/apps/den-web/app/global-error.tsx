"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { parseBrowserObservabilityEnv } from "../observability/browser-config";
import {
  CHUNK_RELOAD_ATTEMPT_KEY,
  isChunkLoadFailure,
  shouldReloadChunkFailure,
} from "./chunk-load-recovery";

const browserObservability = parseBrowserObservabilityEnv({
  backend: process.env.NEXT_PUBLIC_DEN_OBSERVABILITY_BACKEND,
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sentryTracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
});

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const chunkLoadFailure = isChunkLoadFailure(error);

  useEffect(() => {
    if (browserObservability.backend === "sentry") {
      Sentry.captureException(error);
    }

    const now = Date.now();
    let previousAttemptAt: number | null = null;
    try {
      const storedAttempt = window.sessionStorage.getItem(CHUNK_RELOAD_ATTEMPT_KEY);
      const parsedAttempt = storedAttempt === null ? Number.NaN : Number(storedAttempt);
      previousAttemptAt = Number.isFinite(parsedAttempt) ? parsedAttempt : null;
    } catch {}

    if (!shouldReloadChunkFailure({ error, previousAttemptAt, now })) {
      return;
    }

    try {
      window.sessionStorage.setItem(CHUNK_RELOAD_ATTEMPT_KEY, String(now));
    } catch {}
    window.location.reload();
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f7f5f2",
          color: "#172033",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <main
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "32px",
          }}
        >
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e7e1da",
              borderRadius: "24px",
              boxShadow: "0 24px 60px rgba(23, 32, 51, 0.08)",
              maxWidth: "560px",
              padding: "48px",
              textAlign: "center",
              width: "100%",
            }}
          >
            <div
              style={{
                color: "#d85b1f",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                marginBottom: "20px",
              }}
            >
              RENWORK CLOUD
            </div>
            <h1 style={{ fontSize: "32px", letterSpacing: "-0.03em", margin: "0 0 16px" }}>
              {chunkLoadFailure ? "Refresh RenWork Cloud" : "RenWork Cloud couldn’t finish loading"}
            </h1>
            <p
              style={{
                color: "#667085",
                fontSize: "17px",
                lineHeight: 1.6,
                margin: "0 auto 28px",
                maxWidth: "440px",
              }}
            >
              {chunkLoadFailure
                ? "The application was updated while this page was open. Reload to use the latest version."
                : "Your account data is safe. Reload the page to try again."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: "#d85b1f",
                border: 0,
                borderRadius: "999px",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: 700,
                padding: "14px 28px",
              }}
            >
              Reload RenWork Cloud
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

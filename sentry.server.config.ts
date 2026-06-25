// Worker-Entry mit Sentry-Instrumentierung (Cloudflare Workers, server-only).
//
// wrangler.jsonc `main` zeigt auf diese Datei (statt direkt auf den Adapter-
// Entrypoint). `withSentry` umschließt den Astro-Cloudflare-Handler:
//   * DSN kommt PER REQUEST aus dem Worker-Env (`env.SENTRY_DSN`, Worker-Secret) —
//     ohne DSN läuft das SDK im no-op-Modus (gleicher Code mit/ohne Sentry).
//   * `captureConsoleIntegration` (warn+error) macht stille `console.warn`/`.error`
//     als Issues sichtbar — entscheidend hier, weil die API-Routes Fehler abfangen
//     und als 500 via `serviceErrorResponse` loggen (console.error), statt zu werfen;
//     ohne diese Integration würde Sentry diese 500er NICHT sehen.
//   * `sendDefaultPii: false` scrubbt IP/Cookies/Header (Auth-App mit Mails +
//     verschlüsselten API-Keys; EU-Region).
//   * Kein Tracing (`tracesSampleRate: 0`), kein Logs-Produkt — nur Error-Monitoring.
//
// Greift NUR im deployten Worker. `astro dev` und E2E (Node-Adapter via E2E=1)
// umgehen diesen Entry vollständig.
import * as Sentry from "@sentry/cloudflare";
import handler from "@astrojs/cloudflare/entrypoints/server";

export default Sentry.withSentry(
  (env: { SENTRY_DSN?: string }) => ({
    dsn: env.SENTRY_DSN,
    environment: "production",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
  }),
  handler,
);

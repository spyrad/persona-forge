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

// Defense-in-Depth gegen Secret-Leaks in Freitext-Feldern. `sendDefaultPii: false`
// scrubbt nur IP/Cookies/Header/Body — NICHT Message-Inhalte. captureConsole leitet
// aber rohe Error-Objekte (serviceErrorResponse → console.error(scope, err)) an Sentry;
// trägt ein Treiber-/Supabase-Fehler je einen Key/Token/Connection-String in der
// Message, ersetzt dieser Filter ihn durch `[Filtered]`, bevor das Event raus geht.
const SECRET_PATTERNS: RegExp[] = [
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT (Supabase-/Auth-Token)
  /sb_(?:publishable|secret)_[A-Za-z0-9]+/g, // Supabase API-Keys
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, // Authorization-Header-Werte
  /postgres(?:ql)?:\/\/[^\s"']+/gi, // Postgres-Connection-Strings
];

function scrub(input: string): string {
  return SECRET_PATTERNS.reduce((acc, re) => acc.replace(re, "[Filtered]"), input);
}

export default Sentry.withSentry(
  (env: { SENTRY_DSN?: string }) => ({
    dsn: env.SENTRY_DSN,
    environment: "production",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
    beforeSend(event) {
      if (event.message) event.message = scrub(event.message);
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = scrub(ex.value);
      }
      for (const crumb of event.breadcrumbs ?? []) {
        if (typeof crumb.message === "string") crumb.message = scrub(crumb.message);
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (typeof breadcrumb.message === "string") breadcrumb.message = scrub(breadcrumb.message);
      return breadcrumb;
    },
  }),
  handler,
);

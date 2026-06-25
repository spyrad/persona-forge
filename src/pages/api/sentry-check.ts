import type { APIRoute } from "astro";

export const prerender = false;

// ⚠️ TEMPORÄR (Phase 3, change `sentry-monitoring`) — Wegwerf-Trigger zur einmaligen
// End-to-end-Verifikation des Sentry-Monitorings in Prod. Wird nach Bestätigung im
// Dashboard wieder ENTFERNT (revert-Commit). Gegatet über ein Token, damit der Endpoint
// nicht versehentlich/öffentlich auslösbar ist. Erzeugt ausschließlich Sentry-Events
// (kein Datenzugriff, keine Mutation, kein Auth-Effekt).
const TRIGGER_TOKEN = "pf-sentry-verify-2026";

export const GET: APIRoute = ({ url }) => {
  if (url.searchParams.get("token") !== TRIGGER_TOKEN) {
    return new Response("Not found", { status: 404 });
  }

  if (url.searchParams.get("mode") === "throw") {
    // Throw-Pfad: Astro fängt den Fehler ab und loggt ihn via console.error →
    // captureConsoleIntegration erfasst ihn (persona-forges realer Erfassungsweg).
    throw new Error("[sentry-check] deliberate throw for Sentry verification");
  }

  // Default: console.error mit Error-Objekt → captureConsoleIntegration sendet es
  // mit Stack-Trace an Sentry (source-gemappt, wenn die Maps griffen).
  // eslint-disable-next-line no-console -- bewusster Verifikations-Trigger (temporär)
  console.error("[sentry-check] deliberate console.error for Sentry verification", new Error("sentry-check marker"));
  return new Response("sentry-check: event emitted", { status: 200 });
};

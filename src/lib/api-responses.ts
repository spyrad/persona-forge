/**
 * Kleine JSON-Response-Helfer fuer die API-Routes — einheitliche Form,
 * keine Leaks. `serviceErrorResponse` loggt den Rohfehler serverseitig und gibt
 * eine generische Meldung zurueck (Muster aus `auth-errors.ts`).
 */
import { z, type ZodError } from "zod";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, status: number): Response {
  return json({ error: message }, status);
}

/** 400 mit flachem Zod-Fehlerbaum (gleiche Form wie die Auth-Routes). */
export function validationError(error: ZodError): Response {
  return json({ error: z.flattenError(error) }, 400);
}

/** Loggt den Rohfehler serverseitig (kein Leak) und gibt ein generisches 500-JSON. */
export function serviceErrorResponse(scope: string, err: unknown): Response {
  // eslint-disable-next-line no-console -- bewusstes serverseitiges Audit-Log
  console.error(`[api:${scope}]`, err);
  return jsonError("Something went wrong. Please try again.", 500);
}

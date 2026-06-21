import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse, validationError } from "@/lib/api-responses";
import { deleteRun, getRun, updateRunVisibility } from "@/lib/services/runs";

export const prerender = false;

const idSchema = z.uuid();

const visibilitySchema = z.object({ visibility: z.enum(["private", "global"]) });

// Kein PUT/Inhalts-Edit: ein Lauf wird nicht editiert (Abbruch = DELETE). PATCH
// aendert ausschliesslich die Sichtbarkeit (Metadaten, S-07).

/** Liest einen Lauf (RLS-gescoped). Nicht sichtbar → 404. */
export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return jsonError("Invalid run id.", 400);

  try {
    const run = await getRun(auth.supabase, auth.userId, id.data);
    if (!run) return jsonError("Run not found.", 404);
    return json(run);
  } catch (err) {
    return serviceErrorResponse("runs:get", err);
  }
};

/** Schaltet die Lauf-Sichtbarkeit um (privat/global, S-07; fremde/fehlende id → 404). */
export const PATCH: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return jsonError("Invalid run id.", 400);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid request body — expected JSON.", 400);
  }

  const result = visibilitySchema.safeParse(body);
  if (!result.success) return validationError(result.error);

  try {
    const view = await updateRunVisibility(auth.supabase, auth.userId, id.data, result.data.visibility);
    if (!view) return jsonError("Run not found.", 404);
    return json(view);
  } catch (err) {
    return serviceErrorResponse("runs:update-visibility", err);
  }
};

/** Loescht einen Lauf (Abbruch = vollstaendiges Verwerfen; fremde/fehlende id → 404). */
export const DELETE: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return jsonError("Invalid run id.", 400);

  try {
    const deleted = await deleteRun(auth.supabase, id.data);
    if (!deleted) return jsonError("Run not found.", 404);
    return json({ ok: true });
  } catch (err) {
    return serviceErrorResponse("runs:delete", err);
  }
};

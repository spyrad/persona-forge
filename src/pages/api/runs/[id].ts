import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse } from "@/lib/api-responses";
import { deleteRun, getRun } from "@/lib/services/runs";

export const prerender = false;

const idSchema = z.uuid();

// Kein PUT: ein Lauf wird nicht editiert. Abbruch = DELETE (vollstaendig geloescht).

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

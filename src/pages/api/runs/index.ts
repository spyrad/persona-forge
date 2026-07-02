import type { APIRoute } from "astro";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse, validationError } from "@/lib/api-responses";
import { createRun, listRuns } from "@/lib/services/runs";
import { createSchema } from "./create-schema";

export const prerender = false;

/** Liste der sichtbaren Laeufe (eigene + globale), neueste zuerst. */
export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;
  try {
    const runs = await listRuns(auth.supabase, auth.userId);
    return json(runs);
  } catch (err) {
    return serviceErrorResponse("runs:list", err);
  }
};

/** Legt einen Lauf an (`pending`). Persona/Modellkonfig unsichtbar → 400. */
export const POST: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid request body — expected JSON.", 400);
  }

  const result = createSchema.safeParse(body);
  if (!result.success) return validationError(result.error);

  try {
    const view = await createRun(auth.supabase, auth.userId, result.data);
    if (!view) return jsonError("Persona or model config not found.", 400);
    return json(view, 201);
  } catch (err) {
    return serviceErrorResponse("runs:create", err);
  }
};

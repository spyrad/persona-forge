import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse, validationError } from "@/lib/api-responses";
import { isPublicHttpsUrl } from "@/lib/url-guard";
import { deleteModelConfig, updateModelConfig } from "@/lib/services/model-configs";

export const prerender = false;

const idSchema = z.uuid();

const updateSchema = z.object({
  label: z.string().trim().min(1).max(120),
  baseUrl: z.url().refine(isPublicHttpsUrl, { message: "base_url must be a public https URL." }),
  modelName: z.string().trim().min(1).max(200),
  // Fehlt apiKey, bleibt der bestehende Key unveraendert.
  apiKey: z.string().min(1).optional(),
});

/** Aktualisiert Metadaten (+ optional Key); Response enthaelt nie den Key. */
export const PUT: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return jsonError("Invalid config id.", 400);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid request body — expected JSON.", 400);
  }

  const result = updateSchema.safeParse(body);
  if (!result.success) return validationError(result.error);

  try {
    const view = await updateModelConfig(auth.supabase, id.data, result.data);
    if (!view) return jsonError("Config not found.", 404);
    return json(view);
  } catch (err) {
    return serviceErrorResponse("models:update", err);
  }
};

/** Loescht eine Konfig (RLS: nur die eigene). */
export const DELETE: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return jsonError("Invalid config id.", 400);

  try {
    const deleted = await deleteModelConfig(auth.supabase, id.data);
    if (!deleted) return jsonError("Config not found.", 404);
    return json({ ok: true });
  } catch (err) {
    return serviceErrorResponse("models:delete", err);
  }
};

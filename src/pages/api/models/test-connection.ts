import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse, validationError } from "@/lib/api-responses";
import { isPublicHttpsUrl } from "@/lib/url-guard";
import { getDecryptedTarget } from "@/lib/services/model-configs";

export const prerender = false;

const TIMEOUT_MS = 8000;

// Zwei Pfade: frisch eingegebene Daten ({ baseUrl, apiKey }) ODER eine
// bestehende Konfig ({ configId }) — dann entschluesselt der Service den Key
// serverseitig. Der Key taucht in keinem Fall in der Response auf.
const testSchema = z.union([
  z.object({
    baseUrl: z.url().refine(isPublicHttpsUrl, { message: "base_url must be a public https URL." }),
    apiKey: z.string().min(1),
  }),
  z.object({ configId: z.uuid() }),
]);

type ProbeResult = { ok: true; modelCount?: number } | { ok: false; reason: string };

/** GET {baseUrl}/models mit Bearer-Key, kurzem Timeout; leakt nie Key/Upstream-Header. */
async function probeModels(baseUrl: string, apiKey: string): Promise<ProbeResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/models`;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: controller.signal,
      // SSRF-Haertung: Redirects NICHT transparent folgen — sonst koennte ein
      // oeffentlicher Host per 3xx auf ein internes Ziel (Cloud-Metadata,
      // private IP) umleiten und den isPublicHttpsUrl-Guard umgehen. Ein
      // legitimer /models-Endpunkt antwortet direkt mit 200.
      redirect: "manual",
    });
    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      return { ok: false, reason: "Endpoint redirected — not allowed." };
    }
    if (!res.ok) {
      return { ok: false, reason: `Endpoint returned status ${res.status}.` };
    }
    let modelCount: number | undefined;
    try {
      const payload: unknown = await res.json();
      const list = (payload as { data?: unknown }).data;
      if (Array.isArray(list)) modelCount = list.length;
    } catch {
      // Kein JSON-Body — Endpoint ist erreichbar + autorisiert, das genuegt.
    }
    return { ok: true, modelCount };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, reason: "Endpoint timed out." };
    }
    return { ok: false, reason: "Could not reach endpoint." };
  } finally {
    clearTimeout(timer);
  }
}

export const POST: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid request body — expected JSON.", 400);
  }

  const result = testSchema.safeParse(body);
  if (!result.success) return validationError(result.error);

  try {
    let target: { baseUrl: string; apiKey: string };
    if ("configId" in result.data) {
      const stored = await getDecryptedTarget(auth.supabase, result.data.configId);
      if (!stored) return jsonError("Config not found.", 404);
      // Defense-in-depth: auch die gespeicherte URL gegen den SSRF-Guard pruefen.
      if (!isPublicHttpsUrl(stored.baseUrl)) {
        return json({ ok: false, reason: "Stored base_url is not a public https URL." });
      }
      target = stored;
    } else {
      target = { baseUrl: result.data.baseUrl, apiKey: result.data.apiKey };
    }

    const outcome = await probeModels(target.baseUrl, target.apiKey);
    return json(outcome);
  } catch (err) {
    return serviceErrorResponse("models:test-connection", err);
  }
};

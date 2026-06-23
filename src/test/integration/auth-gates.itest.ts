/**
 * Risk #5 — Auth-Gap: jede geschützte JSON-API-Route liefert ohne Session 401.
 *
 * Route-Level: die echten Handler werden in-process mit einem Mock-`APIContext`
 * ohne Session-Cookie aufgerufen (siehe route-context.ts). Jeder Handler ruft
 * `requireUser` als Erstes → 401, bevor params/body berührt werden. Auth-Routes
 * (signin/signout) haben kein Gate und dürfen NICHT 401 liefern (Positiv-Signal).
 *
 * Die Positiv-Kontrolle „gültiger Cookie → kein 401" ist manuell (Plan 4.4):
 * eine echte @supabase/ssr-Session-Cookie ist im Test nicht trivial nachbaubar.
 */
import type { APIRoute } from "astro";
import { describe, expect, it } from "vitest";
import { GET as modelsGet, POST as modelsPost } from "@/pages/api/models/index";
import { DELETE as modelDelete, PUT as modelPut } from "@/pages/api/models/[id]";
import { POST as modelTestConnection } from "@/pages/api/models/test-connection";
import { GET as personasGet, POST as personasPost } from "@/pages/api/personas/index";
import { DELETE as personaDelete, PATCH as personaPatch } from "@/pages/api/personas/[id]";
import { POST as personaDuplicate } from "@/pages/api/personas/[id]/duplicate";
import { GET as runsGet, POST as runsPost } from "@/pages/api/runs/index";
import { DELETE as runDelete, GET as runGet, PATCH as runPatch } from "@/pages/api/runs/[id]";
import { POST as runStep } from "@/pages/api/runs/[id]/step";
import { GET as runResult } from "@/pages/api/runs/[id]/result";
import { POST as signinPost } from "@/pages/api/auth/signin";
import { POST as signoutPost } from "@/pages/api/auth/signout";
import { makeApiContext } from "./route-context";

/** Alle geschützten JSON-Handler (Methode × Route). */
const PROTECTED_HANDLERS: [string, APIRoute][] = [
  ["GET /api/models", modelsGet],
  ["POST /api/models", modelsPost],
  ["PUT /api/models/[id]", modelPut],
  ["DELETE /api/models/[id]", modelDelete],
  ["POST /api/models/test-connection", modelTestConnection],
  ["GET /api/personas", personasGet],
  ["POST /api/personas", personasPost],
  ["PATCH /api/personas/[id]", personaPatch],
  ["DELETE /api/personas/[id]", personaDelete],
  ["POST /api/personas/[id]/duplicate", personaDuplicate],
  ["GET /api/runs", runsGet],
  ["POST /api/runs", runsPost],
  ["GET /api/runs/[id]", runGet],
  ["PATCH /api/runs/[id]", runPatch],
  ["DELETE /api/runs/[id]", runDelete],
  ["POST /api/runs/[id]/step", runStep],
  ["GET /api/runs/[id]/result", runResult],
];

describe("Risk #5 — Auth-Gates (geschützte Routes ohne Session → 401)", () => {
  it.each(PROTECTED_HANDLERS)("%s ohne Session → 401", async (_label, handler) => {
    const res = await handler(makeApiContext({ params: { id: "00000000-0000-0000-0000-000000000000" } }));
    expect(res.status).toBe(401);
  });
});

describe("Auth-Routes sind public (kein 401-Gate, Positiv-Signal)", () => {
  it("POST /api/auth/signin ohne Session ist erreichbar (kein 401)", async () => {
    const res = await signinPost(makeApiContext({ method: "POST", form: new FormData() }));
    expect(res.status).not.toBe(401);
  });

  it("POST /api/auth/signout ohne Session ist erreichbar (kein 401)", async () => {
    const res = await signoutPost(makeApiContext({ method: "POST" }));
    expect(res.status).not.toBe(401);
  });
});

/**
 * Risk #1 — Cross-Tenant-Leak: volle Zwei-Konten-RLS-Matrix.
 *
 * Account A versucht, auf B's Objekte zuzugreifen (GET/PATCH/DELETE/step/result/
 * duplicate über personas, runs, model_configs). Erwartung: 404-äquivalent
 * (`null`/`false`), NIE ein leeres 200/Array als „Erfolg" (S-02-Lesson). Jede
 * geblockte Mutation wird per DB-Gegenprobe (B-Client) als No-Op bestätigt.
 *
 * Feine Fälle:
 *   (a) global ≠ Schreibrecht — B's GLOBALES Objekt ist für A lesbar, aber
 *       PATCH/DELETE darauf müssen trotzdem 404 liefern.
 *   (b) run_repetitions-Doppelpfad — Parent (getRun/getRunResult) UND Child
 *       (direkter run_repetitions-select) blocken je für A.
 *   (c) Seed-Persona owner_id=NULL: in diesem Projekt NICHT testbar (kein
 *       seed.sql; per anon-key nicht erzeugbar, insert-Policy verlangt
 *       owner_id=auth.uid()). RLS-logisch identisch zu (a) — owner_id≠auth.uid()
 *       ist derselbe Pfad — daher von den global-Objekt-Fällen mit abgedeckt.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteModelConfig,
  getDecryptedTarget,
  listModelConfigs,
  updateModelConfig,
} from "@/lib/services/model-configs";
import { deletePersona, duplicatePersona, listPersonas, updatePersonaVisibility } from "@/lib/services/personas";
import {
  createRun,
  deleteRun,
  getRun,
  getRunResult,
  listRuns,
  processNextRepetition,
  updateRunVisibility,
} from "@/lib/services/runs";
import { OEJTS } from "@/lib/instruments/oejts";
import { cleanupTestAccount, createTestAccount, type TestAccount } from "./accounts";
import { makeCompletedRun, makeModelConfig, makePersona, rowExists } from "./fixtures";
import type { ModelConfigView, PersonaView, RunView } from "@/types";

describe("Risk #1 — Cross-Tenant-RLS-Matrix (zwei Konten)", () => {
  let A: TestAccount;
  let B: TestAccount;

  // B's Objekte (das „Opfer")
  let bPrivatePersona: PersonaView;
  let bGlobalPersona: PersonaView;
  let bModelConfig: ModelConfigView;
  let bPrivateRun: RunView;
  let bGlobalRun: RunView;

  // A's eigene Objekte (für Positiv-Kontrollen + createRun-Negativfälle)
  let aPersona: PersonaView;
  let aModelConfig: ModelConfigView;

  beforeAll(async () => {
    A = await createTestAccount();
    B = await createTestAccount();

    bPrivatePersona = await makePersona(B, "private");
    bGlobalPersona = await makePersona(B, "global");
    bModelConfig = await makeModelConfig(B, "sk-B-secret");
    bPrivateRun = await makeCompletedRun(B, bPrivatePersona.id, bModelConfig.id, "private");
    bGlobalRun = await makeCompletedRun(B, bGlobalPersona.id, bModelConfig.id, "global");

    aPersona = await makePersona(A, "global");
    aModelConfig = await makeModelConfig(A, "sk-A-secret");
  });

  afterAll(async () => {
    await cleanupTestAccount(A);
    await cleanupTestAccount(B);
  });

  describe("personas", () => {
    it("A kann B's PRIVATE Persona nicht umschalten (→ null) und sie bleibt erhalten", async () => {
      const result = await updatePersonaVisibility(A.client, A.userId, bPrivatePersona.id, "private");
      expect(result).toBeNull();
      expect(await rowExists(B, "personas", bPrivatePersona.id)).toBe(true);
    });

    it("(a) A kann B's GLOBALE Persona nicht umschalten — Sichtbarkeit ≠ Schreibrecht", async () => {
      const result = await updatePersonaVisibility(A.client, A.userId, bGlobalPersona.id, "private");
      expect(result).toBeNull();
      // Gegenprobe: B's Persona ist immer noch global (unverändert).
      const stillGlobal = (await listPersonas(B.client, B.userId)).find((p) => p.id === bGlobalPersona.id);
      expect(stillGlobal?.visibility).toBe("global");
    });

    it("A kann B's PRIVATE Persona nicht löschen (→ false) und sie bleibt erhalten", async () => {
      expect(await deletePersona(A.client, bPrivatePersona.id)).toBe(false);
      expect(await rowExists(B, "personas", bPrivatePersona.id)).toBe(true);
    });

    it("(a) A kann B's GLOBALE Persona nicht löschen und sie bleibt erhalten", async () => {
      expect(await deletePersona(A.client, bGlobalPersona.id)).toBe(false);
      expect(await rowExists(B, "personas", bGlobalPersona.id)).toBe(true);
    });

    it("A kann B's PRIVATE Persona nicht duplizieren (nicht sichtbar → null)", async () => {
      expect(await duplicatePersona(A.client, A.userId, bPrivatePersona.id)).toBeNull();
    });

    it("A DARF B's GLOBALE Persona duplizieren — Kopie ist A-eigen + privat (gewollt)", async () => {
      const copy = await duplicatePersona(A.client, A.userId, bGlobalPersona.id);
      expect(copy).not.toBeNull();
      expect(copy?.isOwn).toBe(true);
      expect(copy?.visibility).toBe("private");
    });
  });

  describe("runs", () => {
    it("A kann B's PRIVATEN Lauf nicht lesen (→ null)", async () => {
      expect(await getRun(A.client, A.userId, bPrivateRun.id)).toBeNull();
    });

    it("A SIEHT B's GLOBALEN Lauf (Sanity: Sichtbarkeit weitet select)", async () => {
      expect(await getRun(A.client, A.userId, bGlobalRun.id)).not.toBeNull();
    });

    it("A kann B's PRIVATES Ergebnis nicht lesen (→ null)", async () => {
      expect(await getRunResult(A.client, A.userId, bPrivateRun.id)).toBeNull();
    });

    it("(b) Child-Pfad: A's direkter run_repetitions-Select auf B's PRIVATEN Lauf liefert 0 Zeilen", async () => {
      const { data, error } = await A.client.from("run_repetitions").select("item_values").eq("run_id", bPrivateRun.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("(b) Child-Pfad: A's direkter run_repetitions-Select auf B's GLOBALEN Lauf liefert die Zeile (geerbte Sichtbarkeit)", async () => {
      const { data, error } = await A.client.from("run_repetitions").select("item_values").eq("run_id", bGlobalRun.id);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    it("A kann B's PRIVATEN Lauf nicht weiterfahren (step → null), Status bleibt, kein Key-Verbrauch", async () => {
      expect(await processNextRepetition(A.client, A.userId, bPrivateRun.id)).toBeNull();
      // Gegenprobe: B's Lauf ist unverändert `completed` (kein step lief, kein LLM-Call).
      const bRun = await getRun(B.client, B.userId, bPrivateRun.id);
      expect(bRun?.status).toBe("completed");
    });

    it("A kann B's PRIVATEN Lauf nicht umschalten (→ null)", async () => {
      expect(await updateRunVisibility(A.client, A.userId, bPrivateRun.id, "private")).toBeNull();
    });

    it("(a) A kann B's GLOBALEN Lauf nicht umschalten — bleibt global", async () => {
      expect(await updateRunVisibility(A.client, A.userId, bGlobalRun.id, "private")).toBeNull();
      const bRun = await getRun(B.client, B.userId, bGlobalRun.id);
      expect(bRun?.visibility).toBe("global");
    });

    it("A kann B's PRIVATEN Lauf nicht löschen (→ false) und er bleibt erhalten", async () => {
      expect(await deleteRun(A.client, bPrivateRun.id)).toBe(false);
      expect(await rowExists(B, "runs", bPrivateRun.id)).toBe(true);
    });

    it("(a) A kann B's GLOBALEN Lauf nicht löschen und er bleibt erhalten", async () => {
      expect(await deleteRun(A.client, bGlobalRun.id)).toBe(false);
      expect(await rowExists(B, "runs", bGlobalRun.id)).toBe(true);
    });

    it("A kann keinen Lauf auf B's PRIVATER Persona bauen (→ null)", async () => {
      const result = await createRun(A.client, A.userId, {
        kind: "oejts",
        personaId: bPrivatePersona.id,
        modelConfigId: aModelConfig.id,
        instrumentId: OEJTS.id,
        repetitionCount: 1,
      });
      expect(result).toBeNull();
    });

    it("A kann keinen Lauf auf B's Modellkonfig bauen (→ null)", async () => {
      const result = await createRun(A.client, A.userId, {
        kind: "oejts",
        personaId: aPersona.id,
        modelConfigId: bModelConfig.id,
        instrumentId: OEJTS.id,
        repetitionCount: 1,
      });
      expect(result).toBeNull();
    });
  });

  describe("model_configs", () => {
    it("A kann B's Modellkonfig nicht ändern (→ null) und sie bleibt erhalten", async () => {
      const result = await updateModelConfig(A.client, bModelConfig.id, {
        label: "gekapert",
        baseUrl: "https://evil.example.com/v1",
        modelName: "x",
      });
      expect(result).toBeNull();
      expect(await rowExists(B, "model_configs", bModelConfig.id)).toBe(true);
    });

    it("A kann B's Modellkonfig nicht löschen (→ false) und sie bleibt erhalten", async () => {
      expect(await deleteModelConfig(A.client, bModelConfig.id)).toBe(false);
      expect(await rowExists(B, "model_configs", bModelConfig.id)).toBe(true);
    });

    it("A kann B's API-Key nicht entschlüsseln (test-connection-Pfad → null)", async () => {
      expect(await getDecryptedTarget(A.client, bModelConfig.id)).toBeNull();
    });
  });

  describe("Listen aus A's Sicht", () => {
    it("listPersonas: enthält B's globale, NICHT B's private", async () => {
      const ids = (await listPersonas(A.client, A.userId)).map((p) => p.id);
      expect(ids).toContain(bGlobalPersona.id);
      expect(ids).not.toContain(bPrivatePersona.id);
    });

    it("listRuns: enthält B's globalen, NICHT B's privaten", async () => {
      const ids = (await listRuns(A.client, A.userId)).map((r) => r.id);
      expect(ids).toContain(bGlobalRun.id);
      expect(ids).not.toContain(bPrivateRun.id);
    });

    it("listModelConfigs: enthält NICHT B's Konfig (keine visibility → strikt eigen)", async () => {
      const ids = (await listModelConfigs(A.client)).map((m) => m.id);
      expect(ids).not.toContain(bModelConfig.id);
    });
  });

  describe("Positiv-Kontrollen (A auf eigene Objekte)", () => {
    it("A kann die eigene Persona umschalten (privat ↔ global)", async () => {
      const toPrivate = await updatePersonaVisibility(A.client, A.userId, aPersona.id, "private");
      expect(toPrivate?.visibility).toBe("private");
      const toGlobal = await updatePersonaVisibility(A.client, A.userId, aPersona.id, "global");
      expect(toGlobal?.visibility).toBe("global");
    });

    it("A kann eine eigene Persona löschen (→ true) und sie ist danach weg", async () => {
      const throwaway = await makePersona(A, "global");
      expect(await deletePersona(A.client, throwaway.id)).toBe(true);
      expect(await rowExists(A, "personas", throwaway.id)).toBe(false);
    });

    it("A kann die eigene Modellkonfig ändern (→ nicht null)", async () => {
      const result = await updateModelConfig(A.client, aModelConfig.id, {
        label: "A-Model-umbenannt",
        baseUrl: "https://api.example.com/v1",
        modelName: "test-model",
      });
      expect(result).not.toBeNull();
      expect(result?.label).toBe("A-Model-umbenannt");
    });
  });
});

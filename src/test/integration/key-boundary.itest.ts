/**
 * Risk #2 — Key-Dichtheit: weder Klartext- noch Ciphertext-Key überschreitet je
 * eine client-gerichtete Boundary.
 *
 * Strategie: einen Sentinel-Key anlegen und beweisen, dass er in KEINEM
 * Service-View (create/list/update) und in KEINEM Run-DTO auftaucht — weder als
 * Klartext-Wert noch über die Key-Feldnamen. Der einzige Klartext-Pfad
 * (`getDecryptedTarget`, server-only) gibt den Key zwar zurück (Beweis, dass er
 * abrufbar IST) — aber kein gemappter Response-Pfad tut es. Zusätzlich ein
 * Compile-Zeit-Regression-Lock auf `ModelConfigView`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createModelConfig,
  getDecryptedTarget,
  listModelConfigs,
  updateModelConfig,
} from "@/lib/services/model-configs";
import { getRunResult } from "@/lib/services/runs";
import { cleanupTestAccount, createTestAccount, type TestAccount } from "./accounts";
import { makeCompletedRun, makePersona } from "./fixtures";
import type { ModelConfigView } from "@/types";

/** Eindeutiger Klartext-Key, nach dem wir in allen Outputs fahnden. */
const SENTINEL = "sk-SENTINEL-abc123XYZ";
/** Key-Feldnamen, die niemals client-seitig auftauchen dürfen. */
const FORBIDDEN_FIELDS = ["key_ciphertext", "key_iv", "key_version", "apiKey"];
/** Exakte Feldmenge der client-sicheren View. */
const VIEW_KEYS = ["id", "label", "baseUrl", "modelName", "hasKey", "createdAt", "updatedAt"].sort();

/** Assertet, dass ein serialisiertes Objekt weder den Sentinel noch ein Key-Feld enthält. */
function assertTight(payload: unknown): void {
  const json = JSON.stringify(payload);
  expect(json).not.toContain(SENTINEL);
  for (const field of FORBIDDEN_FIELDS) {
    expect(json).not.toContain(field);
  }
}

describe("Risk #2 — Key-Dichtheit (Service-/Client-Boundary)", () => {
  let account: TestAccount;
  let configId: string;

  beforeAll(async () => {
    account = await createTestAccount();
  });

  afterAll(async () => {
    await cleanupTestAccount(account);
  });

  it("createModelConfig: Rückgabe ist dicht (kein Key, exakte Feldmenge, hasKey=true)", async () => {
    const view = await createModelConfig(account.client, {
      label: "Key-Boundary-Model",
      baseUrl: "https://api.example.com/v1",
      modelName: "test-model",
      apiKey: SENTINEL,
    });
    configId = view.id;
    expect(view.hasKey).toBe(true);
    expect(Object.keys(view).sort()).toEqual(VIEW_KEYS);
    assertTight(view);
  });

  it("listModelConfigs: kein Item (und die gesamte Liste) enthält Key-Material", async () => {
    const list = await listModelConfigs(account.client);
    const item = list.find((c) => c.id === configId);
    expect(item).toBeDefined();
    expect(item?.hasKey).toBe(true);
    expect(Object.keys(item ?? {}).sort()).toEqual(VIEW_KEYS);
    assertTight(list);
  });

  it("updateModelConfig: Rückgabe ist dicht — auch wenn ein NEUER Key gesetzt wird", async () => {
    // Metadaten-only-Update.
    const meta = await updateModelConfig(account.client, configId, {
      label: "umbenannt",
      baseUrl: "https://api.example.com/v1",
      modelName: "test-model",
    });
    expect(meta).not.toBeNull();
    assertTight(meta);

    // Update MIT neuem Sentinel-Key — die Rückgabe darf ihn trotzdem nicht zeigen.
    const withNewKey = await updateModelConfig(account.client, configId, {
      label: "umbenannt",
      baseUrl: "https://api.example.com/v1",
      modelName: "test-model",
      apiKey: `${SENTINEL}-rotated`,
    });
    expect(withNewKey).not.toBeNull();
    assertTight(withNewKey);
  });

  it("getDecryptedTarget (server-only) liefert den Klartext-Key — der einzige Pfad, der das darf", async () => {
    const target = await getDecryptedTarget(account.client, configId);
    expect(target).not.toBeNull();
    // Nach dem Rotations-Update oben trägt die Konfig den rotierten Sentinel.
    expect(target?.apiKey).toBe(`${SENTINEL}-rotated`);
  });

  it("Run-DTO enthält keinen Key (createRun-View + getRunResult)", async () => {
    const persona = await makePersona(account, "global");
    const run = await makeCompletedRun(account, persona.id, configId, "private");
    assertTight(run);
    const result = await getRunResult(account.client, account.userId, run.id);
    expect(result).not.toBeNull();
    assertTight(result);
  });

  it("ModelConfigView trägt zur Compile-Zeit kein Key-Feld (Regression-Lock)", () => {
    // Wird ein Key-Feld zu ModelConfigView hinzugefügt, wird NoKeyFields zu `false`
    // und `const lock: false = true` scheitert an `astro check` (tsc).
    type ForbiddenKeyFields = "key_ciphertext" | "key_iv" | "key_version" | "apiKey";
    type NoKeyFields = Extract<keyof ModelConfigView, ForbiddenKeyFields> extends never ? true : false;
    const lock: NoKeyFields = true;
    expect(lock).toBe(true);
  });
});

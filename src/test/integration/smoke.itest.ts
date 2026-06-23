/**
 * Smoke-Test: beweist, dass das Integration-Harness steht — zwei Accounts
 * lassen sich anlegen, authentifizieren, und sehen über die Service-Schicht
 * ihre (leere) eigene Modellkonfig-Liste. Verifiziert nebenbei, dass der
 * `astro:env/server`-Stub-Pfad (über `listModelConfigs` → `encryption-key`)
 * sauber auflöst.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listModelConfigs } from "@/lib/services/model-configs";
import { cleanupTestAccount, createTestAccount, type TestAccount } from "./accounts";

describe("integration smoke: two authenticated accounts", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;

  beforeAll(async () => {
    accountA = await createTestAccount();
    accountB = await createTestAccount();
  });

  afterAll(async () => {
    await cleanupTestAccount(accountA);
    await cleanupTestAccount(accountB);
  });

  it("beide Accounts sind authentifiziert mit eigener User-ID", () => {
    expect(accountA.userId).toBeTruthy();
    expect(accountB.userId).toBeTruthy();
    expect(accountA.userId).not.toBe(accountB.userId);
  });

  it("jeder Account sieht seine eigene (leere) Modellkonfig-Liste", async () => {
    await expect(listModelConfigs(accountA.client)).resolves.toEqual([]);
    await expect(listModelConfigs(accountB.client)).resolves.toEqual([]);
  });
});

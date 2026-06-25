# Playwright-E2E-Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Umsetzungs-Hinweis: Die Env-Isolation wurde bei der Implementierung auf einen E2E-gated Node-Adapter (@astrojs/node, nur bei process.env.E2E) + Port 4329 umgestellt (Commit b089265). Abschnitte, die astro dev (cloudflare) / Port 4321 / webServer.env als alleinigen Mechanismus beschreiben, sind dadurch überholt — .dev.vars/.env werden nie angefasst.

**Goal:** Eine minimale, saubere Playwright-E2E-Lernschicht (Kurslektion s03e04) aufsetzen, die genau den Risk-#5-Auth-Redirect-Flow im echten Browser prüft.

**Architecture:** Playwright startet per `webServer` den Astro-Dev-Server (`astro dev --mode e2e`, Node-Adapter) gegen lokales Docker-Supabase auf Port 4329. Ein `setup`-Projekt loggt sich einmal über das echte Formular ein und speichert `storageState`; alle authentifizierten Tests erben die Session. Env wird isoliert über `.env.e2e` geladen, die normale `.dev.vars`/`.env` bleibt unberührt.

**Tech Stack:** `@playwright/test` (Chromium), Astro 6 SSR (`astro dev`), `@supabase/supabase-js` (Test-User-Anlage), lokales Supabase (`npx supabase start`).

## Global Constraints

- **Lern-/Demo-Schicht, kein Deploy-Gate.** `test-plan.md` (§3 Phase 3, §5, §6.3) deferrt E2E bewusst; das `deploy`-Gate bleibt `needs: [ci, integration]`. KEIN neuer Required Check, keine Umkehr der Defer-Begründung.
- **Supabase-Ziel: ausschließlich lokal** (`127.0.0.1`/`localhost`). Ein Safety-Guard MUSS jeden Lauf gegen eine nicht-lokale `SUPABASE_URL` verweigern (wie `src/test/integration/setup.ts`).
- **Kein `dotenv`-Paket.** Env-Dateien werden mit `node:fs` direkt geparst (lokale TLS-Interception macht npm-Installs fragil — siehe `CLAUDE.md` und `setup.ts`).
- **Browser-Downloads brauchen `NODE_OPTIONS=--use-system-ca`** (sonst `UNABLE_TO_VERIFY_LEAF_SIGNATURE`).
- **Locators:** `getByRole`/`getByLabel`/`getByText` zuerst; nie CSS/XPath. **Nie `page.waitForTimeout()`** — auf Zustand warten (`toBeVisible`, `waitForURL`). Jeder Test unabhängig (eigenes Setup/Action/Assertion/Cleanup), eindeutige Test-Daten (Timestamp-Mail).
- **Festes Test-Passwort:** `Test-Password-123!` (≥ 8 Zeichen, erfüllt die Auth-Policy — identisch zu `accounts.ts`).
- **Branch:** Arbeit läuft auf `feat/playwright-e2e-setup` (bereits angelegt). Commits lokal, kein Push ohne explizite Freigabe.

---

### Task 1: Playwright-Scaffold + Config + Levers

Installiert Playwright, legt die Config (webServer gegen `astro dev`), die ignorierten Artefakt-Pfade, die npm-Scripts, die `.env.e2e`-Vorlage, den **Seed-Lever** (`seed.spec.ts`) und den **E2E-Rules-Lever** (`tests/e2e/README.md`) an. Deliverable: der Seed-Smoke läuft grün gegen die echte App (beweist Playwright + webServer + astro dev + Browser end-to-end) — ohne Auth, da `/auth/signin` öffentlich ist.

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/e2e/seed.spec.ts`
- Create: `tests/e2e/README.md`
- Create: `.env.e2e.example`
- Modify: `.gitignore` (Playwright-Artefakte + `.env.e2e.example`-Whitelist)
- Modify: `package.json` (devDep `@playwright/test`, Scripts `test:e2e`, `test:e2e:ui`)

**Interfaces:**

- Produces: `playwright.config.ts` — webServer auf `http://localhost:4321`, einziges Projekt `chromium` (noch ohne Auth-Dependency); parst `.env.e2e` per `node:fs` in `process.env` und reicht `SUPABASE_URL`/`SUPABASE_KEY` an `webServer.env` weiter.
- Produces: `tests/e2e/seed.spec.ts` — Exemplar-Smoke auf `/auth/signin` (role-based, wait-for-state, isoliert).

- [ ] **Step 1: Playwright als devDependency installieren**

Bash (Git-Bash-Tool):

```bash
NODE_OPTIONS=--use-system-ca npm install -D @playwright/test
```

PowerShell-Äquivalent: `$env:NODE_OPTIONS="--use-system-ca"; npm install -D '@playwright/test'`

- [ ] **Step 2: Chromium-Browser herunterladen**

```bash
NODE_OPTIONS=--use-system-ca npx playwright install chromium
```

Erwartet: „chromium … downloaded" ohne TLS-Fehler.

- [ ] **Step 3: `playwright.config.ts` anlegen**

```ts
import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// .env.e2e direkt parsen (kein dotenv — TLS-Interception-Gotcha, wie src/test/integration/setup.ts).
// Bereits gesetzte Env-Werte gewinnen; Datei nur als Fallback.
const envPath = fileURLToPath(new URL("./.env.e2e", import.meta.url));
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const PORT = 4321;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // --mode e2e → Astro lädt .env.e2e nativ für astro:env/server.
    command: `npm run dev -- --port ${PORT} --mode e2e`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_KEY: process.env.SUPABASE_KEY ?? "",
    },
  },
});
```

- [ ] **Step 4: Seed-Smoke `tests/e2e/seed.spec.ts` anlegen**

```ts
// Seed-Exemplar für /10x-e2e: an diesem Test werden generierte Tests modelliert.
// Muster: role-/label-basierte Locators, auf Zustand warten (nie Timeout),
// unabhängig (eigenes goto/Assertion), keine geteilten Daten.
// Schützt nichts Risiko-Spezifisches — reine Pipeline-/Vorlagen-Smoke auf der
// öffentlichen Sign-in-Seite (kein Auth nötig).
import { test, expect } from "@playwright/test";

test("sign-in page renders its form (seed exemplar)", async ({ page }) => {
  await page.goto("/auth/signin");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
```

- [ ] **Step 5: E2E-Rules-Lever `tests/e2e/README.md` anlegen**

```markdown
# E2E-Tests (Playwright)

Lern-/Demo-Schicht für Kurslektion s03e04. Deckt genau den Risk-#5-Auth-Redirect-Flow
ab. `test-plan.md` deferrt E2E bewusst — diese Schicht ist **kein** Deploy-Gate.

## Vorbedingungen

1. Docker läuft, lokales Supabase gestartet: `npx supabase start`
2. `.env.e2e` befüllt (Vorlage: `.env.e2e.example`) mit den Werten aus
   `npx supabase status`:
   - `SUPABASE_URL` = API-URL (`http://127.0.0.1:54321`)
   - `SUPABASE_KEY` = `anon key`
3. Lauf: `npm run test:e2e` (oder `npm run test:e2e:ui`)

## E2E-Rules (für /10x-e2e und manuelles Schreiben)

- **Locators:** `getByRole`/`getByLabel`/`getByText` zuerst; `getByTestId` nur bei
  mehrdeutigen a11y-Attributen. Nie CSS-Selektoren, XPath oder DOM-Struktur.
- **Nie `page.waitForTimeout()`.** Auf Zustand warten: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test-Isolation + Cleanup.** Jeder Test eigenständig (eigenes Setup, Action,
  Assertion, Cleanup); eindeutige IDs (Timestamp-Suffix), damit Parallel-/Re-Runs
  nicht kollidieren.
- **Auth ohne UI im Test selbst.** Genau einmal im `setup`-Projekt
  (`auth.setup.ts`) übers Formular einloggen → `storageState`; Tests erben die Session.
- **Real vs. mocked.** Interne Grenzen (Auth, Routing, DB) bleiben real. Nur teure
  oder nicht-deterministische externe APIs an der Netzwerkkante mocken — der
  Auth-Flow trifft keine LLM-Calls, daher hier kein Mock.
- **Seed-Exemplar:** `seed.spec.ts`. _What you show is what you get._
```

- [ ] **Step 6: `.env.e2e.example` anlegen**

```bash
# Vorlage für .env.e2e — Werte aus `npx supabase status` übernehmen.
# Die echte .env.e2e ist gitignored (über .env.*). NUR lokales Supabase!
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key aus `npx supabase status`>
```

- [ ] **Step 7: `.gitignore` ergänzen**

Hänge unter dem `# Secrets & Environment`-Block die Whitelist und unten einen Playwright-Block an:

In der Secrets-Sektion (nach `!.env.test.example`) ergänzen:

```
!.env.e2e.example
```

Am Dateiende neu:

```
# Playwright-E2E
/test-results/
/playwright-report/
/playwright/.cache/
/playwright/.auth/
```

- [ ] **Step 8: `package.json`-Scripts ergänzen**

Im `scripts`-Block (nach `test:integration:watch`) ergänzen:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
```

- [ ] **Step 9: Vorbedingung schaffen + Seed grün verifizieren**

```bash
npx supabase start
cp .env.e2e.example .env.e2e   # dann SUPABASE_KEY aus `npx supabase status` eintragen
npm run test:e2e
```

Erwartet: `1 passed` (seed.spec.ts). Beweist: Playwright startet `astro dev`, der Browser erreicht `/auth/signin`, role-/label-Locators greifen.

> Hinweis Env-Propagation: Sollte der Server `SUPABASE_URL`/`SUPABASE_KEY` nicht sehen (relevant erst ab Task 2/3 für authentifizierte Pfade), greift `--mode e2e` (Astro lädt `.env.e2e`) plus `webServer.env`. Der Seed-Smoke braucht keine Supabase-Werte.

- [ ] **Step 10: Commit**

```bash
git add playwright.config.ts tests/e2e/seed.spec.ts tests/e2e/README.md .env.e2e.example .gitignore package.json package-lock.json
git commit -m "test(e2e): Playwright-Scaffold + Seed-Smoke + Rules (s03e04)"
```

---

### Task 2: Auth-Setup-Projekt (storageState)

Legt das `setup`-Projekt an, das einen frischen Test-User programmatisch anlegt, sich übers echte Formular einloggt und die Session als `storageState` speichert. Verdrahtet das `chromium`-Projekt so, dass es die Session erbt. Deliverable: `npm run test:e2e` erzeugt `playwright/.auth/user.json`, der Seed-Smoke läuft weiterhin grün (jetzt authentifiziert).

**Files:**

- Create: `tests/e2e/auth.setup.ts`
- Modify: `playwright.config.ts` (Projekt `setup` + `storageState`-Dependency am `chromium`-Projekt)

**Interfaces:**

- Consumes: `process.env.SUPABASE_URL`, `process.env.SUPABASE_KEY` (von der Config aus `.env.e2e` geparst); `baseURL` aus der Config.
- Produces: Datei `playwright/.auth/user.json` (gespeicherte Session) für alle Tests des `chromium`-Projekts.

- [ ] **Step 1: `tests/e2e/auth.setup.ts` anlegen**

```ts
// setup-Projekt: legt einen frischen Test-User an (programmatisch, anon signUp),
// loggt sich ÜBER DAS ECHTE FORMULAR ein und speichert die Session als storageState.
// Lokal ist enable_confirmations=false → der User ist sofort einlogg-bar.
import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const STORAGE_STATE = "playwright/.auth/user.json";
const TEST_PASSWORD = "Test-Password-123!";

function requireLocalSupabase(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_KEY ?? "";
  if (!url || !key) {
    throw new Error("E2E-Setup: SUPABASE_URL/SUPABASE_KEY fehlen (siehe .env.e2e / .env.e2e.example).");
  }
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`E2E-Setup: SUPABASE_URL ist keine gültige URL: ${url}`);
  }
  // Safety-Guard: NIE gegen Remote/Prod (wie src/test/integration/setup.ts).
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`E2E-Setup: SUPABASE_URL muss lokal sein (127.0.0.1/localhost), war: ${url}.`);
  }
  return { url, key };
}

setup("authenticate", async ({ page }) => {
  const { url, key } = requireLocalSupabase();

  // 1. Frischen Test-User anlegen (Timestamp-Mail → keine Kollision zwischen Läufen).
  const email = `pf-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.signUp({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`E2E-Setup signUp fehlgeschlagen: ${error.message}`);

  // 2. Über das echte Formular einloggen.
  await page.goto("/auth/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // 3. Auf den authentifizierten Zielzustand warten + Session speichern.
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.context().storageState({ path: STORAGE_STATE });
});
```

- [ ] **Step 2: `playwright.config.ts` — `setup`-Projekt + storageState verdrahten**

Ersetze den `projects`-Array durch:

```ts
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
```

- [ ] **Step 3: Setup + authentifizierten Seed grün verifizieren**

```bash
npm run test:e2e
```

Erwartet: `setup` läuft zuerst (1 passed), dann `chromium` (seed: 1 passed). `playwright/.auth/user.json` existiert danach.

- [ ] **Step 4: storageState-Datei-Erzeugung prüfen**

```bash
ls playwright/.auth/user.json
```

Erwartet: Datei vorhanden (und über `.gitignore` ignoriert — `git status --short` zeigt sie NICHT).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/auth.setup.ts playwright.config.ts
git commit -m "test(e2e): UI-Login setup-Projekt → storageState (Ansatz A)"
```

---

### Task 3: Risk-#5-Flow — Auth-Redirect-Spec

Schreibt den eigentlichen risiko-gebundenen Test: unauthentifizierter Zugriff auf eine geschützte Route wird zur Sign-in-Seite umgeleitet (Test A); authentifizierter Zugriff erreicht das Dashboard (Test B). Verifiziert per Deliberate-Break, dass Test A wirklich den Schutz prüft. Deliverable: beide Tests grün, Break-Check bestanden.

**Files:**

- Create: `tests/e2e/auth-redirect.spec.ts`
- Test: derselbe Spec (Test A + Test B)

**Interfaces:**

- Consumes: `storageState` (`playwright/.auth/user.json`) aus dem `chromium`-Projekt für Test B; Test A überschreibt es lokal auf „leer".
- Consumes: `PROTECTED_ROUTES` aus `src/middleware.ts` (`/dashboard`, `/models`, `/personas`, `/runs`) und das Redirect-Ziel `/auth/signin`.

- [ ] **Step 1: `tests/e2e/auth-redirect.spec.ts` schreiben**

```ts
// Risk #5 (test-plan.md): Auth-Gap — eine unauthentifizierte Anfrage erreicht eine
// geschützte Route. Das ist genau der Pfad, den E2E über die Integration-Tests hinaus
// zeigt: Middleware-302-Redirect + Cookie-Roundtrip im echten Browser.
// Provenance: test-plan.md Risk #5; Seed: seed.spec.ts.
import { test, expect } from "@playwright/test";

test.describe("auth redirect (Risk #5)", () => {
  // Test A — ohne Session: geschützte Route → Redirect auf /auth/signin.
  test.describe("unauthenticated", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("redirects /dashboard to sign-in", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/auth\/signin/);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
  });

  // Test B — mit Session (storageState aus dem chromium-Projekt): kein Redirect.
  test("authenticated user reaches /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Beide Tests grün verifizieren**

```bash
npm run test:e2e tests/e2e/auth-redirect.spec.ts
```

Erwartet: `2 passed` (plus `setup`).

- [ ] **Step 3: Deliberate-Break — Test A muss rot werden**

Entferne in `src/middleware.ts:4` `"/dashboard"` temporär aus `PROTECTED_ROUTES`:

```ts
const PROTECTED_ROUTES = ["/models", "/personas", "/runs"];
```

Dann:

```bash
npm run test:e2e tests/e2e/auth-redirect.spec.ts
```

Erwartet: Test A FAILT (ohne Schutz wird `/dashboard` direkt gerendert statt umgeleitet) — beweist, dass der Test den Schutz wirklich prüft. (Test B wird ebenfalls instabil; das ist erwartet.)

- [ ] **Step 4: Break sofort zurücknehmen + erneut grün**

Stelle `src/middleware.ts:4` wieder her:

```ts
const PROTECTED_ROUTES = ["/dashboard", "/models", "/personas", "/runs"];
```

```bash
git diff --stat src/middleware.ts   # erwartet: keine Änderung (sauber zurückgesetzt)
npm run test:e2e tests/e2e/auth-redirect.spec.ts
```

Erwartet: `2 passed`. `src/middleware.ts` ist unverändert (NICHT committen).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/auth-redirect.spec.ts
git commit -m "test(e2e): Risk #5 Auth-Redirect-Flow (unauth → signin, authed → dashboard)"
```

---

### Task 4: test-plan-Notiz + Abschluss

Hängt eine einzeilige Notiz in `test-plan.md §6.3` an, dass eine E2E-Lern-Smoke-Schicht existiert — **ohne** die Defer-Entscheidung umzukehren. Deliverable: Doku konsistent, committed.

**Files:**

- Modify: `context/foundation/test-plan.md` (§6.3, Anhang)

**Interfaces:**

- Consumes: nichts. Reiner Doku-Schritt.

- [ ] **Step 1: `test-plan.md §6.3` ergänzen**

Hänge am Ende von §6.3 (nach „…not the RLS logic, which integration owns.") einen Absatz an:

```markdown
- **Lern-Smoke existiert seit 2026-06-25 (s03e04, NICHT gate-relevant):** Unter
  `tests/e2e/` liegt eine minimale Playwright-Schicht (Seed + `auth-redirect.spec.ts`),
  die genau den Risk-#5-Browser-Pfad (Middleware-302 + Cookie-Roundtrip) demonstriert.
  Sie ist bewusst KEIN Deploy-Gate — die Cost×Signal-Defer-Entscheidung oben bleibt
  gültig. Setup/Run: siehe `tests/e2e/README.md`.
```

- [ ] **Step 2: Lint/Format prüfen (Pre-Commit-Hook greift ohnehin)**

```bash
npm run format
```

Erwartet: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add context/foundation/test-plan.md
git commit -m "docs(test-plan): note E2E learning-smoke layer (§6.3, non-gating)"
```

---

## Verifikations-Gesamtlauf (nach allen Tasks)

```bash
npx supabase start           # Docker
npm run test:e2e             # setup + seed + auth-redirect (Test A + B)
```

Erwartet: alle Tests grün; `playwright/.auth/user.json` erzeugt; `git status --short` zeigt keine ignorierten Artefakte (`.env.e2e`, `playwright/.auth/`, `test-results/`, `playwright-report/`).

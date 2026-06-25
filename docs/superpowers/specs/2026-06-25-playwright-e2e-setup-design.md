# Playwright-E2E-Setup — Design

> Status: approved (Brainstorming 2026-06-25)
> Kontext: Kurslektion 10xDevs s03e04 (E2E mit Playwright). Lern-/Demo-Schicht,
> keine Umkehr der test-plan.md-Entscheidung „E2E deliberately deferred".
> Umsetzungs-Hinweis: Die Env-Isolation wurde bei der Implementierung auf einen E2E-gated Node-Adapter (@astrojs/node, nur bei process.env.E2E) + Port 4329 umgestellt (Commit b089265). Abschnitte, die astro dev (cloudflare) / Port 4321 / webServer.env als alleinigen Mechanismus beschreiben, sind dadurch überholt — .dev.vars/.env werden nie angefasst.

## 1. Ziel & Rahmen

persona-forge hat **kein** Playwright-E2E (kein `playwright.config.*`, keine
`*.spec.ts`, kein `@playwright/test`). `test-plan.md` (§3 Phase 3, §5, §6.3) hat
E2E **bewusst und begründet weggelassen**: alle fünf Top-Risiken sind
deterministisch und durch Integration-Tests abgedeckt (u. a.
`src/test/integration/rls-cross-tenant.itest.ts`). Ein Browser-Smoke fügt nur den
Pfad „Middleware-302-Redirect + Cookie-Roundtrip" (Risk #5) hinzu — framework-nah,
geringe Regressionswahrscheinlichkeit, hohe Kosten/Brittleness.

**Antrieb dieses Setups ist daher die Kurslektion s03e04**, nicht der Risikobedarf.
Konsequenz fürs Design: minimale, saubere Infrastruktur und genau **der eine Flow**,
bei dem E2E etwas zeigt, das Integration nicht abdeckt (der Auth-Redirect im echten
Browser). Die Defer-Entscheidung in `test-plan.md` bleibt gültig und wird nicht
umgeschrieben.

### Bestätigte Entscheidungen

| Achse          | Entscheidung                                                          |
| -------------- | --------------------------------------------------------------------- |
| Zweck          | Lernlektion s03e04 (Lern-/Demo-Schicht)                               |
| Supabase-Ziel  | Lokales Docker-Supabase (`npx supabase start`), wie Integration-Tests |
| App-Start      | Playwright `webServer` startet `astro dev` (workerd-Runtime)          |
| Auth-Strategie | **Ansatz A** — UI-Login einmal im `setup`-Projekt → `storageState`    |
| Flow-Scope     | Risk #5: Test A (unauth → Redirect) + Test B (authed → kein Redirect) |

## 2. Architektur & Komponenten

```
playwright.config.ts          # Projekte: "setup" → "chromium"; webServer: astro dev
.env.e2e                      # gitignored; SUPABASE_URL/KEY → lokales Supabase
tests/e2e/
  ├─ auth.setup.ts            # setup-Projekt: User sicherstellen + UI-Login → storageState
  ├─ seed.spec.ts            # /10x-e2e-Lever: Exemplar (role-based, wait-for-state, Isolation)
  ├─ auth-redirect.spec.ts   # der Risk-#5-Flow (Test A + Test B)
  └─ README.md               # E2E-Rules-Lever (oder dedizierte Rules-Datei)
playwright/.auth/user.json    # gitignored; gespeicherte Session
```

### 2.1 Isolation gegenüber dem normalen Dev-Setup

Der `webServer`-Befehl bekommt seine Env **explizit** aus `.env.e2e` (Werte aus
`npx supabase status`: API-URL `127.0.0.1:54321`, anon-key). Die vorhandene
`.dev.vars`/`.env` wird **nicht** verändert — so kollidiert der E2E-Lauf nicht mit
der normalen Dev-Konfiguration des Entwicklers. `.env.e2e`,
`playwright/.auth/`, `test-results/`, `playwright-report/` gehen in `.gitignore`.

### 2.2 webServer

```
webServer: {
  command: "astro dev --port 4321",   // env aus .env.e2e injiziert
  url: "http://localhost:4321",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
}
```

`baseURL: "http://localhost:4321"`. Astro-`dev` fährt den vollen SSR-Pfad inkl.
`src/middleware.ts` und API-Routes — genau was Risk #5 braucht.

## 3. Auth-Setup (Ansatz A)

`tests/e2e/auth.setup.ts` ist ein Playwright-`setup`-Projekt, von dem das
`chromium`-Projekt per `dependencies: ["setup"]` abhängt. Ablauf:

1. **Test-User sicherstellen** — per `@supabase/supabase-js` anon-`signUp` gegen
   lokales Supabase, Timestamp-Mail (`e2e+<ts>@example.com`), festes Passwort.
   Muster wie `src/test/integration/.../accounts.ts`. Lokal ist
   `enable_confirmations=false` → Nutzer ist sofort einlogg-bar (kein
   Mail-Confirm, kein PKCE-Cross-Device-Problem).
2. **UI-Login** — `page.goto('/auth/signin')`,
   `getByLabel('Email').fill(...)`, `getByLabel('Password').fill(...)`,
   `getByRole('button', { name: 'Sign in' }).click()`,
   `await page.waitForURL('**/dashboard')`.
3. **Session speichern** — `page.context().storageState({ path: 'playwright/.auth/user.json' })`.

Label-Anbindung ist verifiziert: `FormField` rendert `<label htmlFor="email">` ↔
`<input id="email" name="email">` (analog Password) → `getByLabel` greift sauber.

## 4. Der Risiko-Test (Risk #5) — `auth-redirect.spec.ts`

Genau die zwei Tests, die den Wert von E2E hier ausmachen:

- **Test A — unauth → Redirect.** `test.use({ storageState: { cookies: [], origins: [] } })`
  (kein Login). `page.goto('/dashboard')` → `await expect(page).toHaveURL(/\/auth\/signin/)`.
  Schützt: Middleware leitet Unauthentifizierte von `PROTECTED_ROUTES` weg
  (`/dashboard`, `/models`, `/personas`, `/runs` → `/auth/signin`).
- **Test B — authed → kein Redirect.** Nutzt `storageState` aus dem setup.
  `page.goto('/dashboard')` → `await expect(page).toHaveURL(/\/dashboard/)` und ein
  stabiles Dashboard-Element ist sichtbar (`getByRole`-basiert, konkretes Element
  bei Implementierung aus der gerenderten a11y-Tree gewählt).

**Deliberate-break-Check** (für `/10x-e2e` VERIFY): Test A muss rot werden, wenn man
`/dashboard` temporär aus `PROTECTED_ROUTES` entfernt; danach sofort revert.

## 5. Die zwei `/10x-e2e`-Lever

`/10x-e2e` erwartet bei erstem Lauf zwei Qualitäts-Lever (legt sie sonst aus seinen
`references/` an — wir legen sie hier projekt-tauglich vor):

- **Seed** (`tests/e2e/seed.spec.ts`): Exemplar, an dem generierte Tests modelliert
  werden — role-based Locators (`getByRole`/`getByLabel`), `wait-for-state` statt
  `waitForTimeout`, je Test eigenes Setup/Action/Assertion/Cleanup, eindeutige
  Test-Daten. _What you show is what you get._
- **E2E-Rules**: Regel-Datei, die der Agent vor dem Generieren liest
  (`tests/e2e/README.md` oder dedizierte Datei). Inhalt aus den `/10x-e2e`-Rules:
  Locator-Priorität, kein Zeit-Warten, Test-Isolation + Cleanup, Auth ohne UI
  (einmal im setup), real vs. mocked (interne Grenzen real, nur externe LLM-Kante
  mocken — hier nicht relevant, da der Flow keine LLM-Calls trifft).

## 6. Scripts & CI-Grenze

- `package.json`: `"test:e2e": "playwright test"` (+ optional `test:e2e:ui`).
- **CI: bewusst NICHT ins Deploy-Gate.** `test-plan.md §5` deferrt E2E; das
  `deploy`-Gate bleibt `needs: [ci, integration]`. Kein neuer Required Check.
- Optionaler Einzeiler in `test-plan.md §6.3`: Hinweis, dass eine Lern-Smoke-Schicht
  (`tests/e2e/`) existiert — **ohne** die Defer-Begründung umzukehren.

## 7. Fehlerbehandlung & Vorbedingungen

- **Docker/Supabase nicht gestartet:** `webServer`/setup schlägt fehl, weil
  `127.0.0.1:54321` nicht erreichbar ist. Mitigation: `tests/e2e/README.md`
  dokumentiert die Vorbedingung (`npx supabase start` + `.env.e2e` aus
  `npx supabase status`) — gleiche DX wie `test:integration`.
- **Port 4321 belegt:** `reuseExistingServer: !CI` nutzt einen bereits laufenden
  Dev-Server lokal; in CI immer frisch.
- **Flake-Vermeidung:** ausschließlich `expect`/`waitForURL` (auto-retry), nie
  feste Timeouts; jeder Test unabhängig und parallel-/reihenfolgesicher.

## 8. Test-Strategie (Verifikation des Setups selbst)

1. `npx supabase start` + `.env.e2e` befüllt.
2. `npm run test:e2e` → setup loggt ein, Test A + Test B grün.
3. Deliberate break (s. §4) → Test A rot → revert → grün.
4. Re-Run bestätigt Idempotenz (Timestamp-Mail verhindert User-Kollision).

## 9. Bewusst weggelassen (YAGNI)

- Keine Zwei-Account-RLS-Matrix im Browser — Integration
  (`rls-cross-tenant.itest.ts`) deckt das günstiger/stärker ab.
- Keine Visual-/Vision-Tests (`--caps=vision`) — Flow ist deterministisch.
- Kein Prod-Build-Smoke (`build && preview`) — das ist der optionale pre-prod-Smoke
  aus §5, nicht Teil dieser Lektion.
- Keine weiteren Flows (Signup-PKCE, Model-Config, Runs) — Scope ist genau Risk #5.

## 10. Offene Implementierungs-Details (in der Planung zu fixieren)

- Konkretes stabiles Dashboard-Element für Test B (aus gerenderter a11y-Tree).
- Genaue Platzierung der E2E-Rules (README vs. dedizierte Datei) je nachdem, was
  `/10x-e2e` im Setup-Schritt erwartet.
- Ob `auth.setup.ts` den User per anon-`signUp` oder über einen kleinen
  Programmatik-Helper (wie `accounts.ts`) anlegt — Wiederverwendung prüfen.

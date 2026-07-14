# E2E-Tests (Playwright)

Lern-/Demo-Schicht für Kurslektion s03e04. `test-plan.md` deferrt E2E bewusst —
diese Schicht ist **kein** Deploy-Gate. Abgedeckte Risiken:

| Spec                    | Risiko                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-redirect.spec.ts` | Risk #5: Middleware-302 + Cookie-Roundtrip                                                                                                                      |
| `model-compare.spec.ts` | Model Compare (5.2): Kette Lauf-Liste → Modell-Profil → 2-Modell-Vergleich über Auth/RLS, Routing (`?m=`), Baseline-Filter und serverseitige Aggregation hinweg |

## Daten-Seeding

`support/seed.ts` schreibt Baseline-Läufe **direkt in die lokale DB** (Muster
`src/test/integration/fixtures.ts`) — ein echter Lauf wäre N nicht-deterministische
LLM-Calls. Real bleibt alles danach: Auth, Routing, DB, Aggregation, Rendering.
Damit der Browser (Session via `storageState`) die geseedeten Zeilen unter RLS
sieht, legt `auth.setup.ts` die Zugangsdaten des Test-Users in
`playwright/.auth/user-credentials.json` ab (gitignored); `support/supabase.ts`
öffnet damit einen supabase-js-Client als **derselbe** User.

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

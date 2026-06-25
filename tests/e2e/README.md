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

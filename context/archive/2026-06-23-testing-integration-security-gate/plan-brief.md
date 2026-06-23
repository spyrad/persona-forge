# Integration Security Gate (Test-Rollout Phase 1) — Plan Brief

> Full plan: `context/changes/testing-integration-security-gate/plan.md`
> Research: `context/changes/testing-integration-security-gate/research.md`

## What & Why

Wir bauen das **erste Integration-Test-Harness** des Projekts und sichern damit
drei Sicherheits-Risiken aus `test-plan.md` regressionsfest ab: Cross-Tenant-Leak
via RLS (#1), entkommender API-Key (#2), Auth-Gap auf API-Routes (#5). Es sind
die beiden Top-Ängste des Entwicklers (#1, #2) plus das Auth-Gate — und Phase 1
bootstrappt das Zwei-Account-Harness, das test-plan Phase 2 wiederverwendet.

## Starting Point

Heute: nur 6 Pure-Function-Unit-Tests (`src/lib/**/*.test.ts`), keine
Integration. Der Produktcode ist laut Research **an allen drei Fronten sauber** —
RLS trägt die Mandanten-Trennung allein, Key-Dichtheit ist dreischichtig
erzwungen, Auth-Gates sind vollständig. Wir frieren also korrektes Verhalten ein,
wir reparieren nichts.

## Desired End State

`npm run test:integration` startet gegen lokales Docker-Supabase und beweist:
A bekommt 404 (nicht leeres 200) auf B's IDs über alle Operationen; kein
Klartext-/Ciphertext-Key überschreitet je eine Boundary; jede `/api`-Route ohne
Session liefert 401. `npm run test` (Unit) bleibt schnell und Docker-frei.

## Key Decisions Made

| Decision                    | Choice                                                    | Why                                                                        | Source   |
| --------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| RLS-only Mandanten-Trennung | als einzige Verteidigungslinie testen                     | kein Code-Backstop existiert → RLS-Regressionstests sind die Absicherung   | Research |
| Test-DB-Ziel                | lokales Docker-Supabase, CI-Gate erst Phase 3             | sofortiges Signal ohne Docker-in-CI-Risiko; saubere test-plan-Phasengrenze | Plan     |
| Harness-Ebene               | Hybrid: Service für #1/#2, Route (Astro Container) für #5 | billigste Ebene je Risiko; umgeht `astro:env` für den Großteil             | Plan     |
| Test-User                   | programmatischer `signUp` (anon key)                      | respektiert „nie service_role"; lokal `enable_confirmations=false`         | Plan     |
| Risk-#5-Scope               | API-401 jetzt, Page-302-Redirect → Phase 3 e2e            | API-Gate ist billig integrationsfähig, Redirect ist Browser/Middleware     | Plan     |
| RLS-Tiefe                   | volle Matrix inkl. 3 feiner Fälle                         | fängt die nicht-offensichtlichen Regressionen (global≠write etc.)          | Plan     |
| Test-Organisation           | `*.itest.ts` + separate Vitest-Config                     | trennt schnelle Unit von DB-Integration, opt-in                            | Plan     |

## Scope

**In scope:** Vitest-Integration-Config + setup/env, Zwei-Account-Fixture +
Cleanup, RLS-Cross-Tenant-Matrix (#1), Key-Dichtheits-Tests + Typ-Guard (#2),
API-401-Auth-Gates (#5), Cookbook-/CLAUDE.md-/test-plan-Updates.

**Out of scope:** CI-Gate-Wiring (Phase 3), Risk #3 SSRF / #4 Run-Integrität
(Phase 2), Page-302-Redirect (Phase 3 e2e), `service_role`, Re-Test der Units,
jede Produktcode-Änderung.

## Architecture / Approach

Zwei `@supabase/supabase-js`-Clients (A, B) mit echten Sessions treiben die
Service-Funktionen direkt → testet die RLS-tragende Logik und umgeht den
einzigen Astro-Kopplungspunkt (`astro:env/server`). Nur Risk #5 braucht die
HTTP-Status-Codes → dafür die Astro Container API (in-process, kein Dev-Server)
in Phase 4. Test-User per Timestamp-`signUp`, Cleanup am Ende → echte Isolation.

## Phases at a Glance

| Phase                            | What it delivers                                          | Key risk                                         |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| 1. Harness-Bootstrap             | Integration-Config, env, Zwei-Account-Fixture, Smoke-Test | env zeigt versehentlich auf Remote/Prod-Supabase |
| 2. Risk #1 RLS-Matrix            | volle Cross-Tenant-Matrix + DB-Gegenprobe                 | feine Fälle (global≠write, Child-Pfad) übersehen |
| 3. Risk #2 Key-Dichtheit         | Sentinel-Abwesenheit in Views + Typ-Guard                 | SSR-Prop-Leak nur manuell prüfbar                |
| 4. Risk #5 Auth-Gates + Closeout | 13 Routes unauth→401 via Container; Doku                  | Astro-Container-`astro:env`-Auflösung brüchig    |

**Prerequisites:** Docker (für `npx supabase start`); lokaler anon-key +
`ENCRYPTION_KEY` in `.env.test`.
**Estimated effort:** ~2-3 Sessions über 4 Phasen.

## Open Risks & Assumptions

- Docker ist lokal verfügbar und `npx supabase start` läuft (für alle Phasen
  Voraussetzung).
- Astro Container API löst `astro:env/server` in Vitest auf; falls zu brüchig,
  Fallback auf `getViteConfig`-Config (Entscheidung beim Implementieren, Ziel
  bleibt In-Process ohne Dev-Server).
- Die Test-Env zeigt strikt auf lokale Werte — ein Remote-`SUPABASE_URL` würde
  gegen Live-Daten laufen (harte manuelle Prüfung in Phase 1).

## Success Criteria (Summary)

- `npm run test:integration` grün: RLS-Matrix, Key-Dichtheit, Auth-Gates.
- `npm run test` (Unit) unverändert schnell und Docker-frei.
- test-plan §3 P1 = `complete`, Cookbook §6.2/§6.4 gefüllt, CLAUDE.md korrigiert.

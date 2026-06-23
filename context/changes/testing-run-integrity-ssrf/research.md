---
date: 2026-06-23T18:45:00+02:00
researcher: Damian (via Claude Opus 4.8)
git_commit: 0bdc87e69041d03b6a0ddc31060cb0b5bc58856b
branch: main
repository: spyrad/persona-forge
topic: "Test-Rollout Phase 2 — Lauf-Integrität (R4) und SSRF-Boundary (R3) erden"
tags: [research, codebase, run-engine, ssrf, url-guard, integration-tests, rls]
status: complete
last_updated: 2026-06-23
last_updated_by: Damian
---

# Research: Test-Rollout Phase 2 — Lauf-Integrität (R4) & SSRF-Boundary (R3)

**Date**: 2026-06-23T18:45:00+02:00
**Researcher**: Damian (via Claude Opus 4.8)
**Git Commit**: 0bdc87e69041d03b6a0ddc31060cb0b5bc58856b
**Branch**: main
**Repository**: spyrad/persona-forge

## Research Question

Phase 2 des Test-Rollouts (`test-plan.md` §3) soll zwei Risiken regressionsfest
absichern: **R4 (Lauf-Integrität)** und **R3 (SSRF-Boundary)**. Die Research
muss erden, was die Tests einfrieren — konkret (test-plan §2):

- **R4:** Step-Endpoint-Transaktion, Unique-Constraint `(run_id, rep_index)`,
  Cascade-Delete bei Abort, Resume-Logik, partielles-Aggregat-Surfacing.
- **R3:** Wo der ausgehende LLM-Request gebaut wird (test-connection **und**
  Run-Step), ob `url-guard` an **beiden** Call-Sites davorhängt.

Plus: was das Phase-1-Harness wiederverwendet und was Phase 2 neu bauen muss.

## Summary

**Beide Risikoflächen sind im Code sauber verankert — Phase 2 friert korrektes
Verhalten ein (wie Phase 1), sie repariert nichts.**

- **R4:** Drei Integritäts-Eigenschaften sind real implementiert: (1) **Abort =
  harter DELETE + DB-`on delete cascade`** (kein App-Code, reiner Constraint);
  (2) **Step-Idempotenz** via Unique-Constraint `(run_id, rep_index)` + bewusstem
  `23505`-Catch (`runs.ts:422-435`), der bei Doppelaufruf den aktuellen Fortschritt
  neu liest statt zu duplizieren; (3) **Failure-Quote** — fehlgeschlagene Reps
  setzen `failed_count++`, der Lauf läuft weiter; ein partielles Aggregat wird
  **nie als `ready` angezeigt** (`getRunResult` gibt nur bei terminalem Status +
  `usableReps >= 1` ein Aggregat zurück, sonst `unfinished`/`empty`).
- **R3:** Der Guard `isPublicHttpsUrl` ist an **ZWEI separaten, unabhängigen
  Call-Sites** verdrahtet (kein gemeinsamer Wrapper!) — das ist der zentrale
  Testbefund: jede Site braucht eigene Abdeckung. test-connection prüft im
  Zod-Schema **und** defensiv vor dem fetch; der Run-Step prüft separat in
  `chatCompletion` (`openai-compatible.ts:107`) vor seinem eigenen fetch. Beide
  Sites haben zusätzlich `redirect: "manual"` + 3xx-Block.
- **Harness:** ~100% des Phase-1-Harness ist direkt wiederverwendbar. **Drei
  echte Lücken**: (1) kein Builder für **laufende/pending/failed** Runs (nur
  `makeCompletedRun`), (2) **kein LLM-HTTP-Mock** (Step macht echten
  `chatCompletion`-Call), (3) **keine Integration-Tests für test-connection**.

## Detailed Findings

### R4 — Lauf-Integrität

#### Run-Lifecycle (Endpoints → Services)

- **Start:** `POST` `src/pages/api/runs/index.ts:29-50` → `createRun`
  (`src/lib/services/runs.ts:102-138`). Setzt `status='pending'`, sichert
  `persona_prompt_snapshot` (reproduzierbar trotz späterer Persona-Löschung).
- **Step:** `POST` `src/pages/api/runs/[id]/step.ts:16-30` → `processNextRepetition`
  (`src/lib/services/runs.ts:304-461`).
- **Abort:** `DELETE` `src/pages/api/runs/[id].ts:61-75` → `deleteRun`
  (`src/lib/services/runs.ts:145-149`). **Es gibt keine eigene `/abort`-Route** —
  Abort _ist_ der DELETE-Endpoint. Client: `RunRunner.tsx:301-308`
  (`cancelActive()` mit Bestätigungsdialog → `deleteRunRequest`).
- **Ergebnis:** `getRunResult` (`src/lib/services/runs.ts:192-206`).

#### Eigenschaft 1 — Abort verwirft vollständig

- DB-Constraint: `run_repetitions.run_id ... on delete cascade`
  (`supabase/migrations/20260617190000_runs.sql:57`). Run-Löschung löscht alle
  Reps DB-seitig — **kein App-Code**.
- `deleteRun` (`runs.ts:145-149`) ist ein Punkt-DELETE ohne Status-Filter, wirkt
  in jedem Status (`pending`/`running`/`completed`/`failed`); RLS
  `runs_delete_own` erzwingt Owner-only. Gibt `true`/`false` (→ Route 404).
- **Test friert ein:** laufender Run mit n>0 Reps → `deleteRun` → `rowExists`
  liefert `false` für run **und** repetitions; `getRunResult` → `null`.

#### Eigenschaft 2 — Step-Idempotenz (verifiziert)

- Unique-Constraint: `unique (run_id, rep_index)`
  (`supabase/migrations/20260617190000_runs.sql:68`).
- Catch (direkt gelesen, `runs.ts:411-438`): Insert; bei `insErr.code === "23505"`
  **kein Throw**, sondern aktuellen `RunProgress` neu lesen + zurückgeben. Der
  nebenläufige Verlierer crasht nicht und dupliziert nichts.
- `repIndex` ist gap-frei: `completedReps + 1` (`runs.ts:331,372-373`);
  deterministischer Seed `seedFrom(runId, repIndex)` (`runs.ts:257-265`) → gleicher
  rep_index = gleiche Item-Permutation.
- **Test friert ein:** zwei `processNextRepetition` auf demselben Run/rep_index →
  genau eine Repetition in DB; beide Returns konsistent.

#### Eigenschaft 3 — Failure-Quote / kein partielles Aggregat

- Bei Insert: `failed_count += (repStatus === "ok" ? 0 : 1)` (`runs.ts:444-451`),
  Lauf **läuft weiter**. Token-Summen zählen _alle_ real verbrauchten Tokens
  (auch failed-Reps mit `usage`) — bewusst (FR-015).
- Endstatus (`runs.ts:331-345`): `failed` nur wenn `failedCount >= repetitionCount`,
  sonst `completed`.
- `getRunResult` (`runs.ts:192-206`): bei `pending`/`running` →
  `{aggregate: null, state: "unfinished"}`. Bei terminalem Status:
  `state = aggregate.usableReps === 0 ? "empty" : "ready"`. `usableReps` zählt nur
  Reps, die zu ≥1 Achse beitragen (`oejts-aggregate.ts:94-95`); Reps ohne
  `item_values` werden übersprungen (`oejts-aggregate.ts:36-39`).
- **Test friert ein:** Run 10 Reps, 8 ok / 2 failed → `status='completed'`,
  `failed_count=2`, `state='ready'`, `usableReps=8`. Run mit 0 verwertbaren →
  `state='empty'`, **nicht** ein fake-leeres `ready`.

#### Resume — bewusste v1-Grenze (nicht Integritäts-, sondern Feature-Grenze)

- Kein UI-Resume, kein Auto-Cleanup. Backend _ist_ resume-fähig (impliziert über
  `completedReps`-Zählung), die UI bietet es nur nicht an
  (Archiv `2026-06-17-oejts-measurement-run` plan-review F2 / impl-review F5).
  → Test sollte das als dokumentierte Grenze behandeln, nicht als Bug.

### R3 — SSRF-Boundary

#### Der Guard

- `src/lib/url-guard.ts:13-62`, `isPublicHttpsUrl(raw: string): boolean`.
  Blockt: non-HTTPS (`:21`); localhost-Varianten inkl. `*.localhost` (`:27-28`);
  alle IPv6-Literale (jedes `:` im Host, `:33`); private/loopback/CGNAT-Ranges
  inkl. **`169.254.0.0/16` Cloud-Metadata** (`:36-49`); **numerische Nicht-dotted-
  quad-Formen** dword/octal/hex (`:51-58`, Regex `^(0x[0-9a-f]+|\d+)$` je Label).
  Echte Domains erlaubt (`:61`). Isoliert unit-getestet (`url-guard.test.ts`).

#### ZWEI separate Call-Sites (zentraler Testbefund)

Es gibt **keinen gemeinsamen Outbound-Wrapper**. Die beiden Pfade bauen ihre
Anfrage unabhängig — jede braucht eigene Test-Abdeckung:

| Call-Site                          | Endpoint                                                                | Guard-Wiring                                           | fetch (Mock-Grenze)                                                             |
| ---------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| test-connection (frische URL)      | `POST /api/models/test-connection`                                      | Zod-`refine(isPublicHttpsUrl)` `test-connection.ts:17` | `probeModels` `test-connection.ts:33` (GET, `redirect:"manual"` :41)            |
| test-connection (gespeicherte URL) | dito (configId-Pfad)                                                    | defensiv vor fetch `test-connection.ts:88`             | dito                                                                            |
| Run-Step                           | `POST /api/runs/[id]/step` → `processNextRepetition` → `chatCompletion` | defensiv `openai-compatible.ts:107` (verifiziert)      | `openai-compatible.ts:118` (POST, `redirect:"manual"` :131, 3xx-Block :145-147) |

- `processNextRepetition` ruft `chatCompletion` mit `target.baseUrl` aus
  `getDecryptedTarget` auf (`runs.ts:359,389-395`) — der Guard (`:107`) steht
  also vor dem entschlüsselten/gespeicherten Wert (Defense-in-depth).
- **Test friert ein:** SSRF-Payloads (`169.254.169.254`, `localhost`,
  `10.x`, dword `2852039166`, octal `0177.0.0.1`, hex `0x7f000001`) werden an
  **beiden** Sites geblockt; der fetch passiert nur nach bestandenem Guard;
  3xx-Redirect wird abgewiesen.

### Harness-Wiederverwendung (Phase 1 → Phase 2)

**Direkt wiederverwendbar (~100%):** `accounts.ts` (`createTestAccount`/
`cleanupTestAccount`, anon-key `signUp`, Timestamp-Mail, in-memory Session);
`fixtures.ts` (`makePersona`, `makeModelConfig` mit Sentinel-Key, `rowExists`);
`route-context.ts` (`makeApiContext` — In-Process-Handler-Call ohne Astro-
Container); `setup.ts` (Host-Parse-Safety-Guard); `vitest.integration.config.ts`
(`*.itest.ts`-Glob, `fileParallelism:false`, `astro:env/server`→Stub-Alias);
Patterns aus `rls-cross-tenant`/`key-boundary`/`auth-gates`.

**Mock-Grenze (test-plan §6.2):** nur die ausgehende LLM-HTTP-Kante mocken,
**nie** Supabase/RLS, **kein** `service_role`. Reps direkt per Client einfügen.

## Code References

- `src/lib/services/runs.ts:102-138` — `createRun` (Snapshot, `status='pending'`)
- `src/lib/services/runs.ts:145-149` — `deleteRun` (Abort, Punkt-DELETE, RLS owner-only)
- `src/lib/services/runs.ts:192-206` — `getRunResult` (unfinished/empty/ready-Gate)
- `src/lib/services/runs.ts:304-461` — `processNextRepetition` (Orchestrierung)
- `src/lib/services/runs.ts:411-438` — Insert + `23505`-Idempotenz-Catch (verifiziert)
- `src/lib/services/runs.ts:444-451` — `failed_count`/Token-Akkumulation
- `src/lib/runs/oejts-aggregate.ts:36-39,94-95` — `usableReps`, Skip ohne `item_values`
- `src/pages/api/runs/index.ts:29-50` — Run-Start-Route
- `src/pages/api/runs/[id]/step.ts:16-30` — Step-Route
- `src/pages/api/runs/[id].ts:61-75` — Abort (DELETE)-Route
- `src/lib/url-guard.ts:13-62` — `isPublicHttpsUrl` (SSRF-Guard)
- `src/pages/api/models/test-connection.ts:17,33,41,88` — Guard-Wiring 1 + fetch + redirect
- `src/lib/llm/openai-compatible.ts:107,118,131,145-147` — Guard-Wiring 2 + fetch + redirect (verifiziert)
- `supabase/migrations/20260617190000_runs.sql:57,68` — `on delete cascade`, `unique (run_id, rep_index)`
- `src/test/integration/{accounts,fixtures,route-context,setup}.ts` — Harness
- `vitest.integration.config.ts` — Integration-Config + Stub-Alias

## Architecture Insights

- **Boundary-Enforcement, nicht Unit-Re-Coverage:** url-guard und Scoring sind
  bereits isoliert unit-getestet. R3/R4 testen _Verdrahtung_ (ist der Guard am
  Request-Site aktiv? feuert der Constraint am echten Insert?), nicht die Units.
- **Zwei unabhängige SSRF-Pfade** sind ein bewusstes Defense-in-depth-Muster,
  erzeugen aber doppelte Testpflicht — der wichtigste Plan-Treiber.
- **Integrität ist DB-getragen** (Cascade + Unique-Constraint), App-Code
  reagiert nur (23505-Catch). Tests müssen den _beobachtbaren_ Effekt asserten,
  nicht die Cascade-/Catch-Mechanik spiegeln (test-plan §2 Anti-Pattern).

## Historical Context (from prior changes)

- `context/archive/2026-06-17-oejts-measurement-run/plan.md` — Ursprung von
  Unique-`(run_id, rep_index)`, Abort=DELETE+Cascade (FR-014: „Abbruch verwirft
  komplett"), Failure-fortlaufend vs. expliziter Abbruch, Resume-Grenze (F2/F5).
- `context/archive/2026-06-15-model-config-management/` — SSRF-Härtung
  dword/octal/hex (impl-review F1, Commit `ce32b3c`), `apiKey.max(512)`,
  Doppel-Guard Speicher- **und** Call-Zeit, `ModelConfigView` ohne Key-Feld.
- `context/archive/2026-06-20-run-control-and-tokens/plan.md` — Token-Felder in
  `RunProgress` nach jedem Step (R4-Observable, FR-015).
- `context/archive/2026-06-23-testing-integration-security-gate/` — das
  Phase-1-Harness + Konventionen (`*.itest.ts`, anon-key-signUp, kein
  `service_role`, kein `vi.mock` auf Services).

## Related Research

- `context/archive/2026-06-23-testing-integration-security-gate/research.md` —
  Phase-1-Erdung (RLS/Key-Dichtheit/Auth-Gates), Harness-Machbarkeit.

## Open Questions

Diese gehen in `/10x-plan` als Entscheidungen (keine Blocker):

1. **LLM-HTTP-Mock-Strategie für den Step.** Optionen: (A) `vi.mock` auf
   `@/lib/llm/openai-compatible` (einfachste, kein neuer Dep) vs. (B) MSW auf der
   echten fetch-Kante. Spannung mit §6.2 „nur die HTTP-Kante mocken, nie
   Services": (A) mockt knapp _oberhalb_ der fetch-Kante (die Funktion, die den
   fetch macht) — vertretbar, weil `chatCompletion` _die_ Outbound-Kante ist,
   aber der SSRF-Guard sitzt **in** `chatCompletion` (:107). Daher: für **R3
   Run-Step** darf `chatCompletion` **nicht** gemockt werden (sonst testet man
   den Guard nicht) — dort die fetch-Kante darunter mocken/oder Guard-Wurf ohne
   Netz asserten; für **R4 Step-Happy-Path** (Idempotenz/Failure-Quote) ist ein
   `chatCompletion`-Mock sinnvoll. Plan muss diese Trennung festlegen.
2. **Builder für nicht-fertige Runs:** `makePendingRun` / `makeRunningRun(reps)` /
   `makeFailedRun` in `fixtures.ts` ergänzen (Reps direkt per Client einfügen,
   Status setzen). Nötig für R4-Abort- und Failure-Quote-Tests.
3. **Neue Test-Dateien:** voraussichtlich `run-integrity.itest.ts` (R4) +
   `ssrf-boundary.itest.ts` (R3). Auth-Gates für step/abort/result sind in
   Phase 1 bereits tabellarisch abgedeckt — verifizieren, nicht duplizieren.
4. **test-connection-Idempotenz/Redirect:** ob der 3xx-Block (`:43-44` /
   `:145-147`) ohne echten Netz-Server testbar ist (fetch-Mock liefert
   `opaqueredirect`/3xx-Status).

<!-- PLAN-REVIEW-REPORT -->
# Plan Review: OEJTS-Messlauf (S-04)

- **Plan**: context/changes/oejts-measurement-run/plan.md
- **Mode**: Deep
- **Date**: 2026-06-17
- **Verdict**: REVISE → nach Triage alle 4 Findings im Plan behoben (jetzt SOUND)
- **Findings**: 0 critical · 1 warning · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING (F2–F4, behoben) |
| Plan Completeness | WARNING (F1, behoben) |

## Grounding
11/11 Pfade ✓, 4/4 Symbole ✓ (getDecryptedTarget, PROTECTED_ROUTES, isPublicHttpsUrl, requireUser), brief↔plan ✓.
Verifikation (Sub-Agent): getDecryptedTarget-Signatur bestätigt; base_url = API-Wurzel ({baseUrl}/models) bestätigt; kein bestehender Completion-Call (alles neu) bestätigt; JSON-Import aus context/ widerlegt (F1); Blast-Radius additiv.

## Findings

### F1 — JSON-Import aus context/ hält nicht

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — schnelle Entscheidung; Fix offensichtlich
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Instrument-Modul
- **Detail**: Plan nannte Import von `context/foundation/instruments/oejts-1.2.json` als primär. Verifiziert nicht haltbar: `resolveJsonModule` nicht gesetzt, kein Path-Alias auf context/, App→context/ ist Schichtverletzung (eslint-Pre-Commit fängt es).
- **Fix**: OEJTS-Daten als typisiertes `.ts`-Modul `src/lib/instruments/oejts.ts` (`const … satisfies Instrument`); context/…json bleibt menschenlesbare Quelle.
- **Decision**: FIXED — Plan + Brief auf .ts-Modul festgelegt, kein JSON-Import.

### F2 — „Resumebar" überversprochen

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details / Phase 3
- **Detail**: Plan nannte gestockte Läufe „resumebar", baute aber keinen Resume-Pfad (Client-Loop läuft nur beim Start).
- **Fix**: Anspruch senken — v1 hat kein Resume; gestockte Läufe löschen & neu starten.
- **Decision**: FIXED — Plan + Brief korrigiert.

### F3 — Eingabe-Löschung mitten im Lauf nicht behandelt

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 2 — processNextRepetition
- **Detail**: FK `on delete set null` → model_config_id kann mitten im Lauf null werden → getDecryptedTarget kann nicht entschlüsseln; nicht behandelt.
- **Fix**: null-Konfig / getDecryptedTarget→null → ganzen Lauf auf 'failed' mit erklärendem error, keine Exception.
- **Decision**: FIXED — als Schritt 4 in processNextRepetition-Contract ergänzt.

### F4 — Nebenläufige /step-Calls → unique-Violation am Verlierer

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 2 — processNextRepetition
- **Detail**: unique(run_id, rep_index) schützt vor Doppelschreibung, aber der verlierende parallele Call bekäme einen DB-Fehler statt Fortschritt.
- **Fix**: unique-Violation abfangen → als „bereits fortgeschritten" behandeln, aktuellen RunProgress zurückgeben.
- **Decision**: FIXED — als Schritt 5 in processNextRepetition-Contract ergänzt.

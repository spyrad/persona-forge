# Sichtbarkeit privat/global für Personas und Ergebnisse (S-07) — Plan Brief

> Full plan: `context/changes/visibility-controls/plan.md`

## What & Why

Nutzer sollen die Sichtbarkeit eigener Personas und Läufe/Ergebnisse zwischen
`privat` und `global` (org-weit) umschalten können (PRD FR-003, §Access Control).
Heute ist alles fix `privat`; der Toggle fehlt, und der Create-Default weicht von
der PRD ab.

## Starting Point

Das Datenmodell steht bereits aus S-03/S-04: `visibility`-Enum, `visibility`-Spalten
auf `personas`+`runs`, RLS `select own_or_global` (Ergebnisse erben über
`run_repetitions`). `runs` hat sogar schon eine `update_own`-Policy; `personas`
nicht (bewusst, wegen Immutability FR-008). Types tragen `visibility`+`isOwn`;
PersonaCatalog zeigt ein „Global"-Badge. Es fehlt nur die nutzerseitige Schicht.

## Desired End State

Eigene Personas/Läufe haben einen sofort wirkenden Toggle (privat↔global, kein
Modal); fremde/globale Inhalte zeigen nur ein Badge. Globaler Inhalt ist
cross-tenant sichtbar, privater nicht, Fremd-Updates werden von RLS geblockt. Neu
Angelegtes ist standardmäßig `global`.

## Key Decisions Made

| Decision | Choice | Why (1 Satz) | Source |
| --- | --- | --- | --- |
| Create-Default | `global` (app-explizit) | erfüllt must-have FR-003; Leak-Risiko durch explizites Setzen entschärft, DB-Default bleibt `private` | Plan (PRD-Konflikt gelöst) |
| Personas-Update-Pfad | In-Place + `personas_update_own`-Policy | konsistent mit `runs`, minimaler Code, Immutability bleibt app-seitig | Plan |
| RLS-Spaltenschutz | nein (app-seitige Immutability) | Gold-Plating für einrolliges v1 | Plan |
| UI-Ort | Toggle in Listen, Badge auch im RunResult | Umschalten beim Managen, Status klar im Detail | Plan |
| Toggle-UX | sofort + Status-Feedback | reversibel + geringe Stakes im v1 | Plan |
| API-Form | PATCH `/api/{personas,runs}/[id]` + zod | folgt `model_configs`-Update-Muster | Plan |

## Scope

**In scope:** Personas-`update_own`-Migration; `updatePersonaVisibility`/`updateRunVisibility`-Services;
PATCH-Routen; Create-Default→global (Personas+Runs); Toggle/Badge-UI in PersonaCatalog,
RunRunner, RunResult; Zwei-Account-Cross-Visibility-Gate.

**Out of scope:** Create-Time-Selektor; spaltenscharfe DB-Immutability; Toggle-via-Copy;
Daten-Migration des Altbestands; Admin/Rollen/gezieltes Teilen; Visibility für Modellkonfigs.

## Architecture / Approach

Drei Phasen: (1) Backend komplett + automatisiert verifizierbar (Migration, Services,
PATCH-Routen, Default-Wechsel), (2) UI anschließen (Plain-Button-Toggle im cosmic-Stil,
Lucide Globe/Lock, Refetch nach Erfolg), (3) RLS-Cross-Visibility-Gate mit zwei Accounts.
Jede Funktion kopiert ein bereits etabliertes Repo-Muster → mechanisch, review-arm.

## Phases at a Glance

| Phase | Liefert | Hauptrisiko |
| --- | --- | --- |
| 1. Backend + Default | Migration, 2 Services, 2 PATCH-Routen, Default→global | 0-Row-Match still als ok (S-02-Lesson) — über `.maybeSingle()`→404 abgefangen |
| 2. UI | Toggle in Listen + Badge im Detail | State-Sync/Refetch nach Umschalten |
| 3. Gate | Zwei-Account-Cross-Visibility verifiziert | RLS-Leck über Nutzergrenzen (Kern-Guardrail) |

**Prerequisites:** S-03 ✅, S-05 ✅. Neue Migration separat `supabase db push`
(Worker-Deploy zieht keine Migration).
**Estimated effort:** ~1 Session über 3 Phasen (kleiner Slice, viel Pattern-Reuse).

## Open Risks & Assumptions

- Default-Wechsel auf `global` kehrt das aktuell ausgelieferte Verhalten um — bewusste
  FR-003-Konformität, Altbestand bleibt unberührt.
- Personas-Immutability ist nur app-seitig erzwungen (neue `update_own`-Policy erlaubt
  DB-seitig theoretisch mehr) — akzeptiert für v1.
- Cross-Visibility-Gate braucht zwei Accounts im Playwright-MCP-Browser.

## Success Criteria (Summary)

- Eigene Inhalte privat↔global umschaltbar; sofortiges, korrektes Feedback.
- Global = cross-tenant sichtbar, privat nicht, Fremd-Update geblockt (404).
- Neu Angelegtes ist `global`; automatisierte Suite + Gate grün.

# Sichtbarkeit privat/global für Personas und Ergebnisse (S-07) — Implementation Plan

## Overview

Nutzer können die Sichtbarkeit eigener **Personas** und **Läufe/Ergebnisse**
zwischen `privat` und `global` (org-weit) umschalten. Zusätzlich wird der
Create-Default beider Objekte auf `global` umgestellt (PRD FR-003). Der Slice ist
bewusst klein: das Datenmodell (Enum, `visibility`-Spalten, RLS `select own_or_global`)
steht bereits aus S-03/S-04; S-07 liefert den nutzerseitigen Toggle, die Anzeige
und ein RLS-Cross-Visibility-Gate.

## Current State Analysis

Aus der Codebase-Recherche (2026-06-20):

- **DB fertig (Select-Seite):** `public.visibility` Enum (`private`/`global`,
  `20260612164633_rls_foundation.sql:10`); `visibility`-Spalte auf `personas`
  (`20260617053000_personas.sql:25`) und `runs` (`20260617190000_runs.sql:20`);
  RLS `select own_or_global` auf beiden; `run_repetitions` erbt die Sichtbarkeit
  über eine `exists`-Subquery auf den Parent-Lauf (`runs.sql:76-83`).
- **runs hat bereits `update_own`** (`runs.sql:46-49`) — DB-seitig ist der
  Run-Toggle fertig. **personas hat KEINE `update`-Policy** (bewusst weggelassen
  wegen Immutability FR-008).
- **Types fertig:** `Visibility = "private" | "global"` (`types.ts:57-58`);
  `PersonaView.visibility`+`isOwn` (`types.ts:111-123`); `RunView.visibility`+`isOwn`
  (`types.ts:251-267`).
- **Create-Default aktuell `private`** (app-seitig, hardcodiert): `createPersona`
  (`personas.ts` ~Z.99-102), `createRun` (`runs.ts:127`). DB-Spalten-Default ist
  ebenfalls `private` (S-03-Lesson-Migration `20260617185800`).
- **UI teilweise:** PersonaCatalog zeigt ein „Global"-Badge
  (`PersonaCatalog.tsx:542-547`), aber keinen Toggle; RunRunner zeigt **kein** Badge
  und keinen Toggle (`RunRunner.tsx:457-507`); RunResult zeigt keine Sichtbarkeit
  (`RunResult.tsx:147-240`).
- **Etabliertes sicheres Update-Muster:** `.update(patch).eq("id",id).select(VIEW_COLUMNS).maybeSingle()`
  → `null` bei 0-Row-Match → Route mappt auf 404 (`model-configs.ts:83-103`,
  `models/[id].ts:38-44`; S-02-Lesson). DELETE-Variante mit `.select("id").maybeSingle()`
  → `boolean` (`personas.ts:151-155`).

## Desired End State

- Ein angemeldeter Nutzer sieht bei **eigenen** Personas und Läufen einen
  Sichtbarkeits-Toggle (privat ↔ global); fremde/globale Inhalte zeigen nur ein
  Badge, keinen Toggle.
- Umschalten wirkt **sofort** (Status-Feedback/Loading, kein Modal) und ist über
  RLS owner-gescoped: ein Fremd-Update schlägt fehl (404/0-Row), nicht still erfolgreich.
- Ein als `global` markierter Inhalt erscheint in der Liste eines **anderen**
  Accounts; ein `privater` nicht.
- Neu angelegte Personas/Läufe sind **standardmäßig `global`** (explizit app-seitig
  gesetzt; DB-Default bleibt `private` als Defense-in-Depth).
- Verifikation: `astro check` 0 errors, Lint sauber, Vitest grün, Build OK, plus
  ein Zwei-Account-Cross-Visibility-Gate (manuell via Playwright gegen Dev-Server).

### Key Discoveries:

- `runs` UPDATE-Policy existiert schon (`runs.sql:46-49`) → für Runs **keine neue
  Migration** nötig, nur Service + Route + UI.
- `personas` braucht **eine neue Migration** für `personas_update_own` (Muster aus
  `_rls_probe`/`runs` kopieren).
- Immutability (FR-008) bleibt **app-seitig** erzwungen: der Persona-Service
  exponiert ausschließlich ein `visibility`-Update; Inhaltsfelder bleiben unberührt.
- Der Create-Default-Wechsel auf `global` ist sicher, weil die App den Wert
  **explizit** setzt (die S-03-Leak-Ursache war ein *vergessenes* Feld bei
  DB-Default `global`, nicht der Wert selbst); der DB-Default bleibt `private`.

## What We're NOT Doing

- **Kein Create-Time-Sichtbarkeits-Selektor** in den Anlege-Formularen — neu =
  immer `global`, „privat auf Wunsch" über den Toggle nach dem Anlegen.
- **Keine spaltenscharfe DB-Immutability** für Personas (kein SECURITY DEFINER /
  Column-GRANTs) — Gold-Plating für einrolliges v1; Immutability bleibt app-seitig.
- **Kein Toggle-via-Copy** für Personas — In-Place-Update.
- **Keine Migration bestehender Daten** — `set default` und app-Default-Wechsel
  berühren vorhandene Zeilen nicht; Altbestand behält seine Sichtbarkeit.
- **Kein Admin-/Rollen-System**, kein gezieltes Teilen (FR-004 gestrichen),
  keine globale-Objekt-Verwaltung per UI (FR-009 später).
- **Kein Visibility-Toggle für Modellkonfigurationen** — FR-003 nennt nur Personas
  und Ergebnisse.

## Implementation Approach

Drei Phasen: erst die Backend-Schicht (Migration + Services + PATCH-Routen +
Default-Wechsel) komplett und automatisiert verifizierbar machen, dann die UI
(Toggle + Badge) anschließen, zuletzt das Cross-Visibility-Gate mit zwei Accounts
fahren. Jede neue Funktion folgt einem bereits im Repo etablierten Muster
(Update-Service wie `updateModelConfig`, Route wie `models/[id]`, Badge/Toggle-Stil
wie `PersonaCatalog`), sodass der Slice mechanisch und review-arm bleibt.

## Critical Implementation Details

- **RLS-Performance-Konvention:** neue Policy nutzt `(select auth.uid())` statt
  nacktem `auth.uid()` (initplan-Caching), `to authenticated`, eine Policy je
  Operation — exakt wie die bestehenden Tabellen (`runs.sql`, `_rls_probe`).
- **0-Row-Match ist Fehler, nicht Erfolg (S-02-Lesson):** der Visibility-Update
  muss `.select().maybeSingle()` nutzen und bei `null` → 404 mappen; ein stilles
  `ok:true` bei fremder/fehlender id ist verboten.
- **Migration appliziert nicht via Worker-Deploy** (Gotcha): die neue
  personas-Policy muss separat per `supabase db push` (bzw. lokal `npx supabase`)
  eingespielt werden — der Cloudflare-Deploy zieht keine Migration.

## Phase 1: Backend — Visibility-Update + Default-global

### Overview

Personas-`update_own`-Policy als Migration; Visibility-Update-Services und
PATCH-Routen für Personas und Läufe; Create-Default beider auf `global`.

### Changes Required:

#### 1. Migration: personas UPDATE-Policy

**File**: `supabase/migrations/20260620092033_personas_update_own_policy.sql`

**Intent**: Owner darf eigene Personas updaten, damit der In-Place-Visibility-Toggle
greift. Inhalts-Immutability (FR-008) bleibt app-seitig; diese Policy öffnet
DB-seitig nur den owner-gescopten Update-Pfad (konsistent mit `runs_update_own`).

**Contract**: Neue Policy `personas_update_own` `for update to authenticated`
`using (owner_id = (select auth.uid()))` `with check (owner_id = (select auth.uid()))`.
Kopiervorlage: `runs.sql:46-49`. Header-Kommentar erklärt den FR-008-Kontext
(nur visibility wird app-seitig geändert).

#### 2. Service: updatePersonaVisibility

**File**: `src/lib/services/personas.ts`

**Intent**: Setzt `visibility` einer eigenen Persona in-place; gibt die aktualisierte
`PersonaView` zurück oder `null` bei 0-Row-Match (fremde/fehlende id).

**Contract**: `updatePersonaVisibility(sb, id, visibility, userId): Promise<PersonaView | null>`.
Implementierung nach `updateModelConfig`-Muster: `.update({ visibility, updated_at })
.eq("id", id).select(VIEW_COLUMNS).maybeSingle()` → bei `null` zurück `null`, sonst
`toView(data, userId)`. Nur das `visibility`-Feld (+`updated_at`) im Patch — keine
Inhaltsfelder.

#### 3. Service: updateRunVisibility

**File**: `src/lib/services/runs.ts`

**Intent**: Analog für Läufe; `runs` hat die UPDATE-Policy bereits.

**Contract**: `updateRunVisibility(sb, id, visibility, userId): Promise<RunView | null>`,
gleiches `.update().select(VIEW_COLUMNS).maybeSingle()`-Muster, mappt via bestehender
`toView`.

#### 4. Create-Default → global

**File**: `src/lib/services/personas.ts`, `src/lib/services/runs.ts`

**Intent**: Neu angelegte Personas/Läufe sind standardmäßig `global` (FR-003), explizit
gesetzt. Kommentar aktualisieren: Default-Wechsel mit FR-003-Begründung + Hinweis,
dass explizites Setzen die S-03-Leak-Ursache vermeidet (DB-Default bleibt `private`).

**Contract**: In `createPersona` und `createRun` den hardcodierten `visibility: "private"`
→ `visibility: "global"` ändern. Keine Signatur-/Input-Änderung (kein neues DTO-Feld).

#### 5. API-Route: Persona-Visibility

**File**: `src/pages/api/personas/[id].ts`

**Intent**: PATCH-Endpunkt zum Umschalten der Persona-Sichtbarkeit.

**Contract**: `PATCH` exportieren; Body mit zod `z.object({ visibility: z.enum(["private","global"]) })`
validieren; `updatePersonaVisibility(auth.supabase, id, parsed.visibility, auth.user.id)`;
`null` → `jsonError("Persona not found.", 404)`, sonst `json(view)`. Fehlerpfad über
`serviceErrorResponse`. Muster: `models/[id].ts:38-44`.

#### 6. API-Route: Run-Visibility

**File**: `src/pages/api/runs/[id].ts`

**Intent**: PATCH-Endpunkt zum Umschalten der Lauf-Sichtbarkeit (ergänzt die
bestehende GET/DELETE-Route; der „kein PUT"-Kommentar wird zu „PATCH nur für
visibility" präzisiert).

**Contract**: `PATCH` exportieren; gleiches zod-Schema; `updateRunVisibility(...)`;
`null` → 404; sonst `json(view)`.

#### 7. Types (falls nötig)

**File**: `src/types.ts`

**Intent**: Ein kleines Input-DTO für Klarheit, falls die Routen es teilen.

**Contract**: Optional `UpdateVisibilityInput { visibility: Visibility }` ergänzen
(oder inline-zod ohne DTO — Implementer-Ermessen; keine View-DTO-Änderung nötig,
`visibility` ist bereits in `PersonaView`/`RunView`).

### Success Criteria:

#### Automated Verification:

- Lint sauber: `npm run lint`
- Typecheck/`astro check` 0 errors
- Unit-Tests grün: `npm run test` (bestehende 48 + ggf. neue Service-Tests)
- Build OK: `npm run build`
- Migration appliziert lokal sauber (sofern lokale Supabase läuft) bzw. SQL ist
  syntaktisch valide

#### Manual Verification:

- `PATCH /api/personas/[id]` mit `{visibility:"global"}` einer eigenen Persona → 200 + aktualisierte View
- `PATCH /api/runs/[id]` mit `{visibility:"private"}` eines eigenen Laufs → 200 + aktualisierte View
- PATCH auf fremde id → 404 (kein stilles ok)
- Neu angelegte Persona/Lauf trägt `visibility:"global"`

**Implementation Note**: Nach Phase 1 und bestandener automatisierter Verifikation
für manuelle Bestätigung pausieren, bevor Phase 2 startet.

---

## Phase 2: UI — Toggle + Badge

### Overview

Sichtbarkeits-Toggle in PersonaCatalog und RunRunner (nur eigene Inhalte), Badge in
RunResult; sofortiges Umschalten mit Status-Feedback und Liste-Refetch.

### Changes Required:

#### 1. PersonaCatalog-Toggle

**File**: `src/components/personas/PersonaCatalog.tsx`

**Intent**: Bei `persona.isOwn` ein Toggle-Control neben Kopieren/Anpassen/Löschen,
das privat↔global umschaltet; bestehendes „Global"-Badge bleibt und spiegelt den
Zustand. Optional ein „Privat"-Badge/Icon für Klarheit (Default ist jetzt global).

**Contract**: Plain `<button>` im cosmic-Stil (`PersonaCatalog.tsx:542-553` für
Pill-Stil; aktiv `bg-purple-600`, inaktiv `border-white/20 bg-white/5 hover:bg-white/15`),
Lucide `Globe`/`Lock`; `onClick` → `PATCH /api/personas/[id]` mit der Gegen-Sichtbarkeit,
Loading-State während des Requests, nach Erfolg Liste neu laden (bestehendes
Refetch-Muster wie bei `remove`). Nur rendern wenn `isOwn`.

#### 2. RunRunner-Badge + Toggle

**File**: `src/components/runs/RunRunner.tsx`

**Intent**: In der Lauf-Listenzeile (`:457-507`) ein „Global"-Badge analog
PersonaCatalog und bei `run.isOwn` denselben Toggle.

**Contract**: Badge-Pill + Plain-Button-Toggle, `PATCH /api/runs/[id]`, Loading-State,
Refetch der Lauf-Liste nach Erfolg. Stilkonform zur bestehenden Token/Status-Zeile.

#### 3. RunResult-Badge

**File**: `src/components/runs/RunResult.tsx`

**Intent**: Im Ergebnis-Detail ein read-only Sichtbarkeits-Badge, damit klar ist, ob
der Lauf privat/global ist (Toggle bleibt der Liste vorbehalten).

**Contract**: Badge-Pill (Globe/Lock) im bestehenden Detail-Header-Bereich
(`:147-240`); keine Interaktion.

### Success Criteria:

#### Automated Verification:

- Lint sauber: `npm run lint`
- `astro check` 0 errors
- Build OK: `npm run build`

#### Manual Verification:

- Eigene Persona: Toggle schaltet privat↔global, Badge folgt, kein Reload nötig
- Globale/fremde Persona: kein Toggle, nur Badge
- Eigener Lauf: Toggle + Badge in der Liste funktionieren; RunResult zeigt korrektes Badge
- Loading-State sichtbar; nach Umschalten korrekter Zustand ohne Crash

**Implementation Note**: Nach Phase 2 für manuelle Bestätigung pausieren.

---

## Phase 3: Verifikations-Gate (RLS + Cross-Visibility)

### Overview

Beweisen, dass die Sichtbarkeit über Nutzergrenzen korrekt trägt — der
Access-Control-Kern dieses Slices.

### Changes Required:

#### 1. Zwei-Account-Cross-Visibility-Test

**File**: (manuell, kein Code) — Playwright-MCP gegen Dev-Server, zwei Accounts

**Intent**: Verifizieren, dass global geteilte Inhalte cross-tenant sichtbar werden
und private/Fremd-Updates korrekt geblockt sind.

**Contract**: Testmatrix:
- Account A schaltet eine eigene Persona + einen eigenen Lauf auf `global`.
- Account B sieht beide in seiner Liste (Persona-Katalog / `/runs`); kein Toggle dort (nicht `isOwn`).
- Account A schaltet zurück auf `private` → bei Account B verschwinden sie.
- Direkter `PATCH` von Account B auf A's id → 404/0-Row (RLS blockt).
- Eine private Persona/Lauf von A ist für B nie sichtbar.

#### 2. Cleanup

**Intent**: Gate-Testdaten nach Verifikation aufräumen (Gotcha: Playwright-MCP-Browser
ist ein eigener Testaccount).

**Contract**: angelegte Test-Personas/Läufe beider Accounts löschen.

### Success Criteria:

#### Automated Verification:

- Gesamter Lauf nochmal grün: `npm run lint`, `astro check`, `npm run test`, `npm run build`

#### Manual Verification:

- Cross-Visibility-Matrix oben vollständig bestätigt (global sichtbar, privat unsichtbar, Fremd-Update geblockt)
- Keine Regression in Persona-/Lauf-Listen und Ergebnis-Detail
- Testdaten aufgeräumt

**Implementation Note**: Nach bestandenem Gate ist der Slice bereit für
`/10x-impl-review`, Roadmap-`done` und `/10x-archive`.

---

## Testing Strategy

### Unit Tests:

- Optional: Service-Tests für `updatePersonaVisibility`/`updateRunVisibility`
  (0-Row → `null`) sofern sich das ohne echte DB sinnvoll mocken lässt; primär
  trägt `astro check` die Vollständigkeit. Bestehende 48 Tests müssen grün bleiben.

### Integration Tests:

- PATCH-Routen-Happy-Path + 404 (fremde id) manuell via Dev-Server (Phase 1 Manual).

### Manual Testing Steps:

1. Persona/Lauf anlegen → ist `global` (neuer Default).
2. Auf `private` schalten → Badge/Toggle folgt sofort.
3. Zweiter Account: globaler Inhalt sichtbar, privater nicht; Fremd-PATCH → 404.

## Performance Considerations

Keine relevanten — Single-Row-Update mit btree-Index auf `owner_id`; RLS nutzt
initplan-gecachtes `(select auth.uid())`.

## Migration Notes

- Eine neue Migration (`personas_update_own`). **Worker-Deploy appliziert KEINE
  Migration** — separat `supabase db push` (Gotcha). Runs brauchen keine Migration.
- `set default`/App-Default-Wechsel berühren Altbestand nicht.

## References

- Roadmap-Slice: `context/foundation/roadmap.md` (S-07)
- PRD: FR-003, §Access Control (`context/foundation/prd.md:127-129, 230-242`)
- Update-Service-Muster: `src/lib/services/model-configs.ts:83-103`
- 404-Mapping: `src/pages/api/models/[id].ts:38-44`
- RLS-Muster: `supabase/migrations/20260612164633_rls_foundation.sql:37-64`,
  `20260617190000_runs.sql:46-49`
- Badge/Toggle-Stil: `src/components/personas/PersonaCatalog.tsx:303-329, 542-553`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — Visibility-Update + Default-global

#### Automated

- [x] 1.1 Lint sauber: `npm run lint` — 6a5fd4e
- [x] 1.2 Typecheck/`astro check` 0 errors — 6a5fd4e
- [x] 1.3 Unit-Tests grün: `npm run test` — 6a5fd4e
- [x] 1.4 Build OK: `npm run build` — 6a5fd4e
- [x] 1.5 Migration syntaktisch valide / appliziert lokal sauber — 6a5fd4e

#### Manual

- [x] 1.6 PATCH eigene Persona → 200 + aktualisierte View — 6a5fd4e
- [x] 1.7 PATCH eigener Lauf → 200 + aktualisierte View — 6a5fd4e
- [x] 1.8 PATCH fremde id → 404 (kein stilles ok) — 6a5fd4e
- [x] 1.9 Neu angelegte Persona/Lauf trägt `visibility:"global"` — 6a5fd4e

### Phase 2: UI — Toggle + Badge

#### Automated

- [x] 2.1 Lint sauber: `npm run lint` — cc8676a
- [x] 2.2 `astro check` 0 errors — cc8676a
- [x] 2.3 Build OK: `npm run build` — cc8676a

#### Manual

- [x] 2.4 Eigene Persona: Toggle schaltet privat↔global, Badge folgt — cc8676a
- [x] 2.5 Globale/fremde Persona: kein Toggle, nur Badge — cc8676a
- [x] 2.6 Eigener Lauf: Toggle + Badge in Liste; RunResult zeigt korrektes Badge — cc8676a
- [x] 2.7 Loading-State sichtbar; korrekter Zustand ohne Crash — cc8676a

### Phase 3: Verifikations-Gate (RLS + Cross-Visibility)

#### Automated

- [ ] 3.1 Gesamtlauf grün: `npm run lint`, `astro check`, `npm run test`, `npm run build`

#### Manual

- [ ] 3.2 Cross-Visibility-Matrix vollständig bestätigt (global sichtbar, privat unsichtbar, Fremd-Update geblockt)
- [ ] 3.3 Keine Regression in Listen + Ergebnis-Detail
- [ ] 3.4 Gate-Testdaten aufgeräumt

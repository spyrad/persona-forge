# Persona-Katalog (S-03) Implementation Plan

## Overview

Ein angemeldeter Nutzer legt **Personas** an (Name, Beschreibung, Tags + System-Prompt —
freitext getippt *oder* strukturiert nach `docs/persona-authoring-spec.md`), findet sie im
**Katalog** wieder und kann sie kopieren. **Personas sind unveränderlich** (FR-008):
„Bearbeiten" gibt es nicht — eine Änderung entsteht ausschließlich als **Kopie** (neue Zeile).
Der Slice spiegelt das bewiesene S-02-Muster (`model-config-management`), aber **ohne
Krypto** und **ohne UPDATE-Pfad**.

## Current State Analysis

- **S-02 liefert das vollständige Muster**, das dieser Slice kopiert:
  - Migration mit RLS nach `_rls_probe`-Vorlage: `owner_id default auth.uid()`, eine Policy je
    Operation, `(select auth.uid())`, btree-Index, `security invoker`
    (`supabase/migrations/20260616051425_model_configs.sql`).
  - Service-Schicht `src/lib/services/model-configs.ts` (list/create/update/delete, RLS-vertraut,
    kein eigener owner-Filter).
  - API-Helfer `src/lib/api-auth.ts` (`requireUser` → 401-JSON statt Redirect),
    `src/lib/api-responses.ts` (`json`/`jsonError`/`validationError`/`serviceErrorResponse`).
  - CRUD-Routen `src/pages/api/models/{index,[id]}.ts` (zod, `prerender = false`, 404 via
    `maybeSingle`).
  - React-Island `src/components/models/ModelConfigManager.tsx` (Form + Liste + Mutationen +
    Re-Fetch + 401-Redirect + `loadError`-Banner) und geschützte Page `src/pages/models.astro`
    (server-seitiger Initial-Load via Service).
  - `src/middleware.ts` schützt Routen über `PROTECTED_ROUTES`.
- **`public.visibility`-Enum (`'private' | 'global'`) existiert bereits** (F-01,
  `20260612164633_rls_foundation.sql`); das `_rls_probe`-Select-Muster `visibility = 'global'
  OR owner_id = (select auth.uid())` ist die direkte Vorlage für globale Sichtbarkeit.
- **`docs/persona-authoring-spec.md`** definiert die strukturierte Persona: COGNITIVE.md mit
  Pflicht-§§1–4 (Kerndenken, Stimme, Entscheidungsfilter, bekannte Risiken), optional §5
  (Beispiel-Dialog) / §6 (Nutzung). Abschnitt 7 (Validierungs-Rubrik) ist **Non-Goal** für S-03.
- **Es gibt noch keine `runs`-Tabelle** (S-04 ist blocked). „Für Läufe auswählen" bedeutet in
  S-03 daher nur: Personas sind katalogisiert und abrufbar — der Run-Trigger gehört S-04.

## Desired End State

Ein angemeldeter Nutzer kann unter `/personas`:
- eine Persona **freitext** anlegen (Name, Beschreibung, Tags, System-Prompt) — **Phase 1**;
- eine Persona **strukturiert** nach Spec anlegen (Felder §§1–4 → kompilierter System-Prompt) —
  **Phase 2**;
- alle eigenen + globalen Personas im **Katalog** sehen, nach Tags filtern;
- eine Persona **kopieren** (auch eine globale Seed-Persona) → neue, eigene, private Zeile mit
  Namens-Suffix „(Kopie)"; eine strukturierte Persona öffnet beim Kopieren den strukturierten
  Editor vorbefüllt (Phase 2);
- eine **eigene** Persona löschen (globale Seed-Personas sind nicht via UI löschbar).

Verifizierbar: Migration appliziert sauber; `npm run lint`/`build` + `npx astro check` grün;
Kompilier-Funktion unit-getestet; manuell auf Dev-Server: Create (frei + strukturiert), Katalog,
Kopieren (eigen + global), Löschen, Tag-Filter, Zwei-User-RLS (User B sieht User A nicht, sieht
aber globale).

### Key Discoveries:

- **Kein Krypto:** Personas tragen kein Geheimnis → keine `crypto.ts`-Beteiligung, kein
  `key_*`-Spaltentripel, keine `View`-Projektion zum Verstecken von Material. `system_prompt`
  geht offen an den Client.
- **Immutabilität = keine UPDATE-Policy + kein PUT** (`docs/persona-authoring-spec.md` + FR-008):
  strukturell unmöglich zu mutieren. Statt PUT gibt es einen **Duplicate**-Endpoint.
- **Globale Seed-Personas brauchen einen ownerlosen Eigentümer:** `owner_id` muss **nullable**
  sein (`NULL` = System/Global), sonst scheitert ein SQL-Seed (kein `auth.uid()` im
  Migrations-Kontext). Insert-Policy bleibt `owner_id = (select auth.uid())` → Nutzer können
  keine ownerlosen oder fremden Zeilen anlegen; nur die Migration tut das.

## What We're NOT Doing

- **Keine Run-Auswahl/-Verdrahtung** — der Persona-Picker im Lauf-Flow und die Run-Engine sind
  **S-04** (blocked: OEJTS-Quelle). S-03 baut nur den Katalog, den S-04 konsumiert.
- **Keine Sichtbarkeits-Umschalt-UI** — die `visibility`-Spalte + RLS kommen jetzt, der
  nutzerseitige Privat/Global-Toggle ist **S-07**. Neue Personas bleiben in S-03 auf dem Default
  (`global`).
- **Keine Persona-Treue-Validierung** (Spec §7C / Abschnitt 7) — späterer Cycle (PRD Non-Goal).
  Strukturierte Eingabe wird nur auf Pflichtfelder geprüft, nicht auf Spec-Qualität.
- **Keine Admin-UI für globale Personas** — globale Objekte ausschließlich per Seed/Migration
  (FR-009); Änderung globaler Personas = neue Seed-Migration.
- **Keine Versionierung / Lineage** — Kopie referenziert den Vorgänger nicht (kein `parent_id`);
  FR-008 streicht Versionierung.
- **Keine separate Tags-Tabelle** — `text[]`-Spalte, Filterung clientseitig (Scale: small).

## Implementation Approach

Spiegele S-02 Datei für Datei, entferne Krypto, ersetze UPDATE durch DUPLICATE, ergänze die
`visibility`-Spalte (Select-Policy `own-or-global`) und nullable `owner_id`. Phase 1 ist ein
unabhängig deploybarer Freitext-Durchstich (Migration → Types → Service → API → Island → Page).
Phase 2 ergänzt den strukturierten Eingabeweg als zweiten Modus, ohne Phase 1 zu brechen: eine
reine Kompilier-Funktion (Felder → `system_prompt`) plus zwei zusätzliche Spalten
(`source_kind`, `structured_fields`), die Phase 1 bereits vorsieht (Phase 1 schreibt
`source_kind = 'freeform'`, `structured_fields = NULL`).

## Critical Implementation Details

- **Nullable `owner_id` + Seed:** `owner_id uuid references auth.users(id) on delete cascade`
  **ohne** `not null`, mit `default auth.uid()`. Globale Seed-Personas werden in der Migration mit
  `owner_id = NULL, visibility = 'global'` eingefügt. Die Insert-Policy (`with check owner_id =
  (select auth.uid())`) verhindert, dass authentifizierte Nutzer ownerlose oder fremde Zeilen
  anlegen — nur der Migrations-/`postgres`-Kontext umgeht RLS. Die Delete-Policy (`using owner_id
  = (select auth.uid())`) macht globale Seed-Personas für Nutzer nicht löschbar (0-Row-Match →
  404).
- **Duplicate-Semantik:** Der Duplicate-Endpoint liest die Quell-Persona **RLS-gescoped** (eigene
  *oder* globale sind sichtbar), und legt eine neue Zeile an mit: `owner_id` = Default
  (`auth.uid()`), `visibility = 'private'`, `name = "<quelle> (Kopie)"`, restliche Felder
  (description, tags, system_prompt, source_kind, structured_fields) kopiert. Existiert die Quelle
  nicht / ist nicht sichtbar → 404.
- **Phase-2-Kompilierung:** Die Kompilier-Funktion ist **rein und deterministisch** (Spec-Felder
  → Markdown-System-Prompt nach dem §§1–6-Skelett der Spec). Sie ist die testbarste Stelle des
  Slices (Modul-3-Unit-Tests, analog zu `crypto`/`url-guard`). `system_prompt` wird beim Create
  serverseitig kompiliert und gespeichert (nicht zur Laufzeit), damit S-04 immer nur ein Feld
  konsumiert.

## Phase 1: Persona-Katalog — Freitext-Durchstich

### Overview

Vollständiger vertikaler Slice für den freitext-getippten System-Prompt: Tabelle, RLS, Service,
CRUD-API inkl. Duplicate, Katalog-UI mit Kopieren/Löschen/Tag-Filter, geschützte Page. Inklusive
einer minimalen globalen Seed-Persona, um den Global-/Kopier-Pfad end-to-end zu belegen.
Unabhängig deploybar.

### Changes Required:

#### 1. Migration: `personas`-Tabelle + RLS + Seed

**File**: `supabase/migrations/<ts>_personas.sql`

**Intent**: Erste Domänentabelle mit `visibility` nach dem `_rls_probe`-Muster; trägt alle Felder,
die auch Phase 2 braucht (`source_kind`, `structured_fields`), damit Phase 2 keine zweite
Migration auf dieselbe Tabelle braucht. Eine minimale globale Seed-Persona (z.B. „Skeptiker" aus
dem Spec-Minimalbeispiel) belegt den globalen Sichtbarkeits- und Kopier-Pfad.

**Contract**: Tabelle `public.personas` mit Spalten: `id uuid pk default gen_random_uuid()`,
`owner_id uuid references auth.users(id) on delete cascade default auth.uid()` **(nullable)**,
`visibility public.visibility not null default 'global'`, `name text not null`,
`description text not null default ''`, `tags text[] not null default '{}'`,
`system_prompt text not null`, `source_kind text not null default 'freeform'`
(check in `('freeform','structured')`), `structured_fields jsonb` (nullable),
`created_at`/`updated_at timestamptz not null default now()`.
btree-Index auf `owner_id`. RLS aktiviert. **Vier Policies, aber KEINE update-Policy:**
`select` (`to authenticated using visibility = 'global' or owner_id = (select auth.uid())`),
`insert` (`with check owner_id = (select auth.uid())`),
`delete` (`using owner_id = (select auth.uid())`). Seed-Insert am Dateiende:
`owner_id = null, visibility = 'global', source_kind = 'freeform'`.

#### 2. Shared Types

**File**: `src/types.ts`

**Intent**: Entity + DTOs für Personas neben den bestehenden ModelConfig-Typen ergänzen (gleiche
Konvention: Entity snake_case, View/Input camelCase). Da Personas kein Material verstecken, ist
`PersonaView` eine vollständige camelCase-Projektion inkl. `systemPrompt`.

**Contract**: `Persona` (DB-Entity, alle Spalten inkl. `owner_id`, `structured_fields`),
`PersonaView` (`id, name, description, tags, systemPrompt, visibility, sourceKind, isOwn,
createdAt, updatedAt` — `isOwn` aus `owner_id === userId` abgeleitet, steuert Löschbarkeit/Badge
in der UI), `CreatePersonaInput` (`name, description, tags, systemPrompt`; Phase 2 erweitert um
`structuredFields`/`sourceKind`). `PersonaStructuredFields` (Shape des jsonb) kommt in Phase 2.

#### 3. Service-Schicht

**File**: `src/lib/services/personas.ts`

**Intent**: Supabase-CRUD kapseln, RLS-vertraut (kein eigener owner-Filter), analog
`model-configs.ts` — aber **ohne `update`** und **mit `duplicate`**. `isOwn` wird im View-Mapping
gesetzt; dazu braucht die Liste die `owner_id` (selektieren, aber im View zu `isOwn` mappen) und
die aktuelle `userId`.

**Contract**: Exports `listPersonas(sb, userId): PersonaView[]` (neueste zuerst),
`createPersona(sb, input): PersonaView` (owner_id via Default), `duplicatePersona(sb, userId, id):
PersonaView | null` (liest Quelle RLS-gescoped, legt private Kopie mit „(Kopie)"-Suffix an; `null`
wenn Quelle nicht sichtbar), `deletePersona(sb, id): boolean` (`.select("id").maybeSingle()` →
`false` = 404, S-02-Lesson). Kein `update`-Export.

#### 4. API-Routen

**File**: `src/pages/api/personas/index.ts`, `src/pages/api/personas/[id].ts`, `src/pages/api/personas/[id]/duplicate.ts`

**Intent**: CRUD-JSON-API nach dem Models-Muster (`requireUser`, `prerender = false`, zod,
einheitliche Fehler-Helfer). **Kein PUT** (Immutabilität). Duplicate als eigener POST-Endpoint,
damit „Kopieren" eine explizite, benannte Operation ist.

**Contract**:
- `index.ts`: `GET` → `listPersonas` (200, Array); `POST` → `createPersona` (201). Create-zod:
  `name` (1–120), `description` (max 2000, default ""), `tags` (`z.array(z.string().trim().min(1).max(40)).max(20)`),
  `systemPrompt` (1–20000).
- `[id].ts`: `DELETE` → `deletePersona`, 404 wenn `false`; `id` via `z.uuid()`. **Kein PUT.**
- `[id]/duplicate.ts`: `POST` → `duplicatePersona`, 404 wenn `null`, sonst 201 mit der neuen
  `PersonaView`.

#### 5. React-Island: Katalog + Freitext-Form

**File**: `src/components/personas/PersonaCatalog.tsx`

**Intent**: Form (Freitext) + Katalog-Liste + Mutationen, gespiegelt von `ModelConfigManager`
(Re-Fetch nach Mutation, 401-Redirect, `loadError`-Banner, `messageFromPayload`). Statt
„Bearbeiten" gibt es **„Kopieren"** (→ Duplicate-Endpoint, danach Re-Fetch). Tag-Filter
clientseitig über die geladene Liste. Globale Personas tragen ein „Global"-Badge und keinen
Löschen-Button, wenn `isOwn === false`.

**Contract**: Default-Export `PersonaCatalog`, Props `{ initialPersonas: PersonaView[]; loadError?:
boolean }`. Form-Felder: name, description (textarea), tags (Eingabe → `text[]`), systemPrompt
(textarea). Aktionen je Karte: „Kopieren" (alle sichtbaren), „Löschen" (nur `isOwn`, mit
`window.confirm`). Tag-Filter-Leiste aus der Vereinigung aller Tags.

#### 6. Geschützte Page + Routing + Dashboard-Link

**File**: `src/pages/personas.astro`, `src/middleware.ts`, `src/pages/dashboard.astro`

**Intent**: Server-seitiger Initial-Load via `listPersonas` (RLS-gescoped, `loadError`-Fallback),
Island mit `client:load` einhängen — analog `models.astro`. `/personas` zu `PROTECTED_ROUTES`
hinzufügen; Dashboard um einen „Personas →"-Link erweitern.

**Contract**: `personas.astro` rendert `<PersonaCatalog client:load initialPersonas={…}
loadError={…} />` im `Layout`. `PROTECTED_ROUTES = ["/dashboard", "/models", "/personas"]`.
Dashboard: zusätzlicher Anker auf `/personas`.

### Success Criteria:

#### Automated Verification:

- Migration appliziert sauber (lokal `npx supabase db push` bzw. Studio; auf Prod via Deploy)
- Lint grün: `npm run lint`
- Build grün: `npm run build`
- Typecheck grün: `npx astro check` (0 errors — S-02-Lesson: fängt tsc-Fehler, die build/lint nicht sehen)

#### Manual Verification:

- Create (Freitext): neue Persona erscheint im Katalog mit Tags und System-Prompt
- Kopieren einer **eigenen** Persona → neue private Zeile „(Kopie)", Original unverändert
- Kopieren der **globalen Seed**-Persona → wird zur eigenen, privaten Kopie
- Löschen einer eigenen Persona entfernt sie; globale Seed-Persona hat keinen Löschen-Button
- Tag-Filter zeigt nur passende Personas
- Ausgeloggt → `/personas` redirectet auf `/auth/signin`
- Zwei-User-RLS (Studio/zweiter Account): User B sieht User A's private Personas nicht, sieht aber die globale; Löschen einer fremden id → 404

**Implementation Note**: Nach Phase 1 und grüner Automated-Verifikation hier für die manuelle
Bestätigung des Menschen pausieren, bevor Phase 2 beginnt.

---

## Phase 2: Strukturierter Spec-Editor

### Overview

Zweiter Eingabeweg: ein Spec-geführtes Formular (§§1–4 Pflicht, §5/§6 optional), das serverseitig
zu einem `system_prompt` kompiliert wird. Die strukturierten Felder bleiben in
`structured_fields` (jsonb) erhalten, damit eine Kopie strukturiert weiterbearbeitet werden kann.
Phase 1 bleibt unangetastet (Freitext-Personas tragen `source_kind = 'freeform'`).

### Changes Required:

#### 1. Kompilier-Funktion (rein, getestet)

**File**: `src/lib/persona-compile.ts`, `src/lib/persona-compile.test.ts`

**Intent**: Strukturierte Felder deterministisch in einen Markdown-System-Prompt nach dem
Spec-Skelett (§§1–6) übersetzen. Reine Funktion ohne I/O → Unit-Tests (Vitest), analog
`crypto.test.ts`/`url-guard.test.ts`.

**Contract**: `compilePersonaPrompt(fields: PersonaStructuredFields): string`. `PersonaStructuredFields`:
`coreThinking: string[]` (§1), `voice: string[]` (§2), `decisionFilters: string[]` (§3),
`risks: string[]` (§4), optional `exampleDialog?: string` (§5), `usage?: string` (§6). Deterministisch
(gleiche Felder → identischer Output). Tests: Pflicht-Felder gerendert, optionale weggelassen wenn
leer, stabile Reihenfolge.

#### 2. Types erweitern

**File**: `src/types.ts`

**Intent**: `PersonaStructuredFields` ergänzen; `CreatePersonaInput` um `sourceKind` +
`structuredFields?` erweitern (diskriminierte Eingabe: freeform → `systemPrompt`; structured →
`structuredFields`, Server kompiliert `systemPrompt`).

**Contract**: `PersonaStructuredFields` (siehe oben). `CreatePersonaInput` wird Union/optional:
bei `sourceKind = 'structured'` ist `structuredFields` Pflicht und `systemPrompt` wird ignoriert
(serverseitig kompiliert).

#### 3. Service + API: strukturierten Pfad annehmen

**File**: `src/lib/services/personas.ts`, `src/pages/api/personas/index.ts`

**Intent**: `createPersona` akzeptiert strukturierte Eingabe: ist `sourceKind = 'structured'`,
ruft es `compilePersonaPrompt` auf, speichert `structured_fields` + kompilierten `system_prompt` +
`source_kind = 'structured'`. zod-Schema um den strukturierten Zweig erweitern.

**Contract**: Create-zod wird ein `z.discriminatedUnion("sourceKind", …)`: `'freeform'` →
`{ systemPrompt }`; `'structured'` → `{ structuredFields }` (jedes §-Array min. 1 Eintrag für
§§1–4). Duplicate kopiert `source_kind` + `structured_fields` unverändert mit.

#### 4. Island: Modus-Umschaltung + strukturiertes Formular

**File**: `src/components/personas/PersonaCatalog.tsx` (+ ggf. `PersonaStructuredForm.tsx`)

**Intent**: Umschalter „Freitext / Strukturiert" über dem Formular. Der strukturierte Modus
rendert die §§1–4-Felder (Listen-Eingaben) + optional §5/§6. „Kopieren" einer strukturierten
Persona öffnet das strukturierte Formular vorbefüllt aus `structured_fields`; das Kopieren einer
Freitext-Persona öffnet den Freitext-Modus.

**Contract**: Neuer State `mode: 'freeform' | 'structured'`. Beim Submit im strukturierten Modus
wird `{ sourceKind: 'structured', structuredFields }` gepostet. Kopier-Aktion liest
`view.sourceKind` und öffnet den passenden Modus vorbefüllt (für strukturiert muss `PersonaView`
die `structuredFields` mitführen — Service/View entsprechend ergänzen).

### Success Criteria:

#### Automated Verification:

- Kompilier-Unit-Tests grün: `npm run test` (deterministisch, §§1–4 gerendert, optionale weggelassen)
- Lint grün: `npm run lint`
- Build grün: `npm run build`
- Typecheck grün: `npx astro check`

#### Manual Verification:

- Strukturierte Persona anlegen → Katalog zeigt sie; gespeicherter `system_prompt` entspricht der
  kompilierten Spec-Struktur (§§1–4 sichtbar)
- Kopieren einer strukturierten Persona öffnet das strukturierte Formular vorbefüllt; Speichern
  erzeugt eine private Kopie
- Kopieren einer Freitext-Persona öffnet weiterhin den Freitext-Modus
- Modus-Umschaltung verliert keine bereits eingegebenen Felder unerwartet (klare Reset-Semantik)

**Implementation Note**: Nach Phase 2 und grüner Automated-Verifikation für die manuelle
Bestätigung pausieren; danach Slice abschließen (`/dtb:impl-review` bzw. `/10x-impl-review` →
Roadmap S-03 `done` → `/10x-archive`).

---

## Testing Strategy

### Unit Tests:

- `compilePersonaPrompt` (Phase 2): Pflicht-§§1–4 gerendert, optionale §5/§6 weggelassen wenn
  leer, deterministische Reihenfolge/Format, Sonderzeichen/Leereinträge robust.

### Integration Tests:

- Kein eingerichteter Integration-Runner; RLS-Verhalten (own-or-global, Insert-Check,
  Delete-404) wird manuell im Studio + per Zwei-User-Test verifiziert (wie in S-02 etabliert).

### Manual Testing Steps:

1. Einloggen, `/personas` öffnen — leerer Katalog + globale Seed-Persona sichtbar.
2. Freitext-Persona anlegen (mit 2–3 Tags) → erscheint, Tag-Filter funktioniert.
3. Eigene Persona kopieren → „(Kopie)", privat, Original unverändert.
4. Globale Seed-Persona kopieren → eigene private Kopie; Seed bleibt global & ohne Löschen-Button.
5. (Phase 2) Strukturierte Persona anlegen → kompilierter Prompt prüfen; kopieren → strukturiertes
   Formular vorbefüllt.
6. Eigene Persona löschen; fremde id (zweiter Account / Studio) → 404.
7. Ausloggen → `/personas` redirectet auf `/auth/signin`.

## Performance Considerations

Scale ist `small` (PRD): clientseitiger Tag-Filter über die geladene Liste genügt; kein Paging,
kein Tag-Index. `text[]` ohne GIN-Index ausreichend.

## Migration Notes

- Eine einzige Migration in Phase 1, die bereits `source_kind` + `structured_fields` enthält →
  Phase 2 braucht keine Schema-Änderung.
- Globaler Seed via `owner_id = NULL` — bewusst, weil v1 keinen System-User hat (FR-009: globale
  Objekte per Seed). Änderung globaler Personas = neue Seed-Migration (kein UI-Pfad).
- Deploy: Push auf `main` deployt auf Prod; Migration läuft mit. Vor Deploy `db push` lokal/Studio
  verifiziert (S-02-Muster: Docker ggf. nicht oben → direkt auf Prod-Projekt, von Damian autorisiert).

## References

- Roadmap: `context/foundation/roadmap.md` (S-03), PRD: `context/foundation/prd.md` (FR-007, FR-008, FR-003, FR-009)
- Persona-Spec: `docs/persona-authoring-spec.md` (§§1–6 = strukturierte Felder; §7 = Non-Goal)
- Vorlage S-02: `context/archive/2026-06-15-model-config-management/`, live unter
  `src/lib/services/model-configs.ts`, `src/pages/api/models/*`, `src/components/models/ModelConfigManager.tsx`,
  `src/pages/models.astro`
- RLS-Foundation: `supabase/migrations/20260612164633_rls_foundation.sql` (`visibility`-Enum, `_rls_probe`-Muster)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Persona-Katalog — Freitext-Durchstich

#### Automated

- [x] 1.1 Migration appliziert sauber (`personas` + RLS + Seed)
- [x] 1.2 Lint grün: `npm run lint`
- [x] 1.3 Build grün: `npm run build`
- [x] 1.4 Typecheck grün: `npx astro check` (0 errors)

#### Manual

- [x] 1.5 Create (Freitext) erscheint im Katalog mit Tags + System-Prompt
- [x] 1.6 Kopieren einer eigenen Persona → private „(Kopie)", Original unverändert
- [x] 1.7 Kopieren der globalen Seed-Persona → eigene private Kopie
- [x] 1.8 Löschen entfernt eigene Persona; globale Seed-Persona ohne Löschen-Button
- [x] 1.9 Tag-Filter zeigt nur passende Personas
- [x] 1.10 Ausgeloggt → `/personas` redirectet auf `/auth/signin`
- [x] 1.11 Zwei-User-RLS: B sieht A's private nicht, sieht globale; fremde id löschen → 404

### Phase 2: Strukturierter Spec-Editor

#### Automated

- [ ] 2.1 Kompilier-Unit-Tests grün: `npm run test`
- [ ] 2.2 Lint grün: `npm run lint`
- [ ] 2.3 Build grün: `npm run build`
- [ ] 2.4 Typecheck grün: `npx astro check`

#### Manual

- [ ] 2.5 Strukturierte Persona anlegen → kompilierter `system_prompt` entspricht Spec-Struktur
- [ ] 2.6 Kopieren strukturierter Persona öffnet strukturiertes Formular vorbefüllt
- [ ] 2.7 Kopieren Freitext-Persona öffnet Freitext-Modus
- [ ] 2.8 Modus-Umschaltung mit klarer Reset-Semantik (keine unerwarteten Feldverluste)

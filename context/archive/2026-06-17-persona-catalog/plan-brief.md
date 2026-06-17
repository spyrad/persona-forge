# Persona-Katalog (S-03) — Plan Brief

> Full plan: `context/changes/persona-catalog/plan.md`

## What & Why

Ein angemeldeter Nutzer braucht **Personas** (KI-Charaktere als wiederverwendbare
System-Prompts), um sie später (S-04) psychometrisch zu vermessen. S-03 liefert den
**Katalog**: Personas anlegen (freitext *oder* strukturiert nach Spec), wiederfinden, kopieren.
Personas sind **unveränderlich** (FR-008) — eine Änderung entsteht nur als neue Kopie.

## Starting Point

Das S-02-Muster (`model-config-management`) ist live und bewiesen: Migration/RLS nach
`_rls_probe`-Vorlage, Service-Schicht, CRUD-API-Helfer (`requireUser`, `json`/`validationError`),
React-Island + geschützte Page. Der `visibility`-Enum (`private`/`global`) existiert seit F-01.
S-03 spiegelt dieses Muster — ohne Krypto, ohne UPDATE.

## Desired End State

Unter `/personas` legt der Nutzer Personas an (Phase 1 freitext, Phase 2 strukturiert), sieht
eigene + globale im Katalog, filtert nach Tags, kopiert jede sichtbare Persona (→ eigene private
„(Kopie)") und löscht eigene. Eine globale Seed-Persona belegt den Global-/Kopier-Pfad.

## Key Decisions Made

| Decision | Choice | Why (1 Satz) | Source |
| --- | --- | --- | --- |
| Eingabewege | Beide (frei + strukturiert), phasiert | FR-007 vollständig; Phase 1 unabhängig deploybar | Plan |
| Immutabilität (FR-008) | Kein UPDATE/PUT; expliziter Duplicate-Endpoint | Strukturell unmöglich zu mutieren | Plan |
| Sichtbarkeit | `visibility`-Spalte + RLS jetzt, Toggle-UI erst S-07 | Vermeidet spätere Migration; FR-009-Seed funktioniert sofort | Plan |
| Struktur-Speicher | `structured_fields` (jsonb) + kompilierter `system_prompt` | S-04 konsumiert ein Feld; Kopie bleibt strukturiert editierbar | Plan |
| Tags | `text[]`-Spalte, Filter clientseitig | Kein Join, passt zu Scale: small | Plan |
| Löschen | DELETE wie S-02 (owner-only, 404) | Konsistent; Katalog bleibt aufgeräumt | Plan |
| Kopie-Verhalten | Wird eigene, privat, Name + „(Kopie)" | Klare Eigentums-Semantik; globale Vorlagen personalisierbar | Plan |
| Owner globaler Seeds | `owner_id` nullable (`NULL` = System) | SQL-Seed hat kein `auth.uid()`; Insert-Policy schützt weiter | Plan |

## Scope

**In scope:** Persona-CRUD (ohne update) + Duplicate, Katalog-UI mit Tag-Filter, freitext (P1) +
strukturierter Editor (P2), `visibility`-Spalte + RLS own-or-global, minimaler globaler Seed,
geschützte `/personas`-Page.

**Out of scope:** Run-Auswahl/-Verdrahtung (S-04), Sichtbarkeits-Umschalt-UI (S-07),
Persona-Treue-Validierung Spec §7C (späterer Cycle), Admin-UI für globale Personas (FR-009),
Versionierung/Lineage, separate Tags-Tabelle.

## Architecture / Approach

Spiegelung von S-02 Datei für Datei: `personas`-Migration (visibility, nullable owner_id,
source_kind, structured_fields, tags[]) → `src/types.ts` → `src/lib/services/personas.ts`
(list/create/duplicate/delete, **kein** update) → `src/pages/api/personas/{index,[id],[id]/duplicate}.ts`
→ `src/components/personas/PersonaCatalog.tsx` → `src/pages/personas.astro` + `PROTECTED_ROUTES`.
Phase 2 ergänzt eine reine, getestete Kompilier-Funktion (`persona-compile.ts`) und einen zweiten
Form-Modus, ohne Phase 1 zu brechen.

## Phases at a Glance

| Phase | Liefert | Key risk |
| --- | --- | --- |
| 1. Freitext-Durchstich | Tabelle/RLS/Service/API/Island/Page + Duplicate + Seed; deploybar | Nullable-`owner_id`-RLS-Subtilität (Insert/Delete-Policies korrekt) |
| 2. Strukturierter Editor | Spec-§§1–4-Formular + Kompilier-Funktion + jsonb-Speicher | Kompilier-Korrektheit (deterministisch) + Modus-/Kopier-UX |

**Prerequisites:** S-01 (Auth, done). Keine Blocker.
**Estimated effort:** ~2 Sessions (Phase 1 eine, Phase 2 eine).

## Open Risks & Assumptions

- Globaler Seed braucht konkreten Persona-Inhalt — minimal gehalten (Spec-Beispiel „Skeptiker");
  reiner Demonstrator des Global-/Kopier-Pfads, keine kuratierte Bibliothek.
- Phase 2 muss `PersonaView` um `structuredFields` erweitern, damit das Kopieren einer
  strukturierten Persona das Formular vorbefüllen kann.

## Success Criteria (Summary)

- Nutzer legt Personas an (frei + strukturiert), findet sie im Katalog, filtert nach Tags.
- Kopieren erzeugt eine eigene, private, unveränderliche Kopie — auch von globalen Seeds.
- Nutzer sehen ausschließlich eigene + globale Personas (Zwei-User-RLS verifiziert).

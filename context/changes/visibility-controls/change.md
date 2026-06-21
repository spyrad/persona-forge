---
change_id: visibility-controls
title: Sichtbarkeit privat/global für Personas und Ergebnisse
status: impl_reviewed
created: 2026-06-20
updated: 2026-06-21
archived_at: null
---

## Notes

Roadmap S-07. Outcome: Nutzer kann die Sichtbarkeit eigener Personas und
Ergebnisse zwischen privat und global (org-weit) umschalten; Default ist global;
Nutzer sehen ausschließlich eigene und globale Inhalte. PRD-refs: FR-003,
§Access Control. Prereqs S-03 ✅ + S-05 ✅.

Vorgänger-Hinweis (S-03/S-06-Lesson): `visibility` ist an Personas bereits
eingeführt (Migration `20260617185800_personas_visibility_default_private.sql`,
Service `personas.ts`, UI `PersonaCatalog.tsx`). Erst prüfen, was schon
mitgeliefert wurde, bevor geplant wird — der Slice könnte erneut klein
ausfallen (nutzerseitige Umschaltung + Ergebnis-Sichtbarkeit + Verifikations-Gate).

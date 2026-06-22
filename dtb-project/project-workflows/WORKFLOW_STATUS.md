# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-22 (Session 2)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-22.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | **Test-Rollout (Kurs-Modul 3).** `context/foundation/test-plan.md` geschrieben; Rollout-Phase 1 „Integration-Security-Gate" auf `change opened` (Change-ID `testing-integration-security-gate`). OEJTS-MVP S-01–S-08 funktional + im Tracking komplett. |
| **Naechster Schritt** | **`/clear` + `/10x-new testing-integration-security-gate`** (Intent-Block in Zwischenablage) → Change-Folder eröffnen, dann `/10x-research`.                                                                                                            |
| **Blocker**           | Keine.                                                                                                                                                                                                                                                  |

---

## Offene Aufgaben

- [ ] **Rollout-Phase 1 starten:** `/10x-new testing-integration-security-gate` → research → plan → implement. Risiken R1 (Cross-Tenant-RLS), R2 (Key-Boundary-Leak), R5 (Route-Schutz); bootstrappt Zwei-Account-Integration-Harness.
- [ ] Danach Phase 2 (R4 Lauf-Integrität + R3 SSRF), Phase 3 (`npm run test` als CI-Gate) — siehe `test-plan.md` §3.
- [ ] Uncommittete Doku committen (`test-plan.md`, Changelog, dieser Status) — reine `context/`/`dtb-project/`-Doku, kein Push-Zwang.
- [ ] Optional: CLAUDE.md „kein Test-Runner eingerichtet" angleichen — veraltet (`vitest@^4.1.9` installiert, `test_command` gesetzt).
- [ ] Optional: Stale-Duplikat klären — Root-`WORKFLOW_STATUS.md` (Stand 06-13) vs. kanonisch hier.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                           | Ergebnis                                                                        | Details                                   |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------- |
| 2026-06-22 | **Test-Plan geschrieben (Modul 3 Start)**             | `test-plan.md`: 5 Risiken + 3 Rollout-Phasen; P1 eröffnet                       | `2026-06-22.md` (S2)                      |
| 2026-06-22 | S-08 Close-out: archiviert + Roadmap `done`           | OEJTS-MVP (S-01–S-08) auch im Tracking komplett; alle Slices/Foundations `done` | `6d3c825`, `2026-06-22.md` (S1)           |
| 2026-06-21 | S-08 `side-by-side-comparison` impl + reviewt         | Zwei-Läufe-Vergleich (Auswahl→SSR→Überlagerung+Delta); impl-review APPROVED     | `b88b229`–`70153cd`, `2026-06-21.md` (S4) |
| 2026-06-21 | S-07 `visibility-controls` + Deploy verifiziert       | Sichtbarkeit privat/global; CI #30 success, Live 200; Husky/F6-Altlasten        | `5c2b5f8`, `0df2b99`, `f526e3c`           |
| 2026-06-20 | S-06 `run-control-and-tokens` abgeschlossen + live    | Live-Token-Zähler; APPROVED, archiviert                                         | `614b4ea`, `160ee06`                      |
| 2026-06-19 | S-05 `distribution-results` abgeschlossen + live      | Verteilung/Typ-Stabilität je Achse (Leitstern)                                  | `17dfcb3`, `2eb4da5`                      |
| 2026-06-18 | S-04 `oejts-measurement-run` abgeschlossen + live     | `/runs`-UI, OEJTS-Lauf end-to-end                                               | `2f3ba29`, `d06afbe`                      |
| 2026-06-15 | S-01–S-03 abgeschlossen (Auth, Model-Config, Persona) | E-Mail-Auth, verschl. Key, Persona-Katalog — alle live                          | `72fa7ce`, `92192ce`, `3d8bb4e`           |

---

## Gotchas (Referenz)

- **Neues Astro-Top-Level-Route-File → workerd-Dev-Server-Neustart:** Neue `*.astro`-Route → laufender Dev-Server 500 / „Network connection lost". `npm run dev` neu starten.
- **Neue lucide-Imports → Vite-Dep-Re-Opt-Hydration-404:** Neue Icons triggern lucide-react-Re-Optimierung; `?v=`-Hash 404t → React-Island-Hydration scheitert. Präsentationale Astro-Inseln ohne `client:load` statisch rendern (`lessons.md`).
- **`prettier-plugin-tailwindcss` trimmt Klassen-String-Literale:** immer `cn()` aus `@/lib/utils`, nie manuelle Verkettung.
- **Husky aktiv halten:** `package.json` braucht `"prepare": "husky"`.
- **GitHub-Actions ohne `gh`:** Status via REST-API (`curl.exe --ssl-no-revoke`); Run-Conclusion `success` schließt geskippten Deploy-Job nicht aus → Jobs/Steps einzeln prüfen.
- **Migrations-Push separat:** Dev-Server läuft gegen Prod-Supabase; neue Policy/Spalte/Trigger braucht `! npx supabase db push`. Worker-Deploy appliziert KEINE Migration.
- **Zwei-Account-RLS-Test:** Testaccounts `md.motion.value@gmail.com` (A) / `damian.spyra@googlemail.com` (B), Passwort `Dupadupa19`; Playwright teilt einen Cookie-Jar → sequenzieller Wechsel A→B→A, Auth über `POST /api/auth/signin` (FormData). **Relevant für Test-Rollout-Phase 1.**
- **Prod-Worker-URL:** `persona-forge.damian-spyra-ai.workers.dev`. **Push auf `main` (= Prod-Deploy)** braucht User-`!`; **CI-Lint blockt deploy lautlos** → nach Push deploy-Job prüfen.
- **Resume-Hygiene:** WORKFLOW_STATUS kann nach Session-Ende veralten → bei Resume `git ls-remote origin` gegen lokalen `origin/main` prüfen, nicht dem Doc vertrauen.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`

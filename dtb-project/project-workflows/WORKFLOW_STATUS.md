# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-21 (Session 4)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-21.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | **Keine — S-08 `side-by-side-comparison` vollständig + impl-reviewt (APPROVED).** Damit ist der OEJTS-MVP (S-01–S-08) funktional komplett. Offen: 5 Commits lokal (`b88b229..70153cd`), **noch nicht gepusht** (5 vor `origin/main`). |
| **Naechster Schritt** | **`! git push`** (→ Prod-Deploy), CI-Deploy prüfen — dann Roadmap S-08 → `done` + **`/10x-archive side-by-side-comparison`**.                                                                                                         |
| **Blocker**           | Keine.                                                                                                                                                                                                                                |

---

## Offene Aufgaben

- [ ] `! git push` für `b88b229..70153cd` (5 Commits → Prod-Deploy) + CI-Deploy-Run prüfen
- [ ] Roadmap S-08 → `done` (Done-Eintrag + Lesson) und `/10x-archive side-by-side-comparison`
- [ ] Optional: Dev-Server-Gotchas (neues Astro-Route-File → workerd-Restart; lucide-Re-Opt → Hydration-404) in `dtb-project`/CLAUDE.md-Gotchas übernehmen
- [ ] Stale-Duplikat klären: Root-`WORKFLOW_STATUS.md` (Stand 2026-06-13) vs. kanonisch `dtb-project/project-workflows/WORKFLOW_STATUS.md`; CLAUDE.md angleichen

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                             | Ergebnis                                                                                                             | Details                                                      |
| ---------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 2026-06-21 | **S-08 `side-by-side-comparison` impl + reviewt**       | Zwei-Läufe-Vergleich (Auswahl→SSR-Seite→Überlagerung+Delta); impl-review APPROVED (0 crit/warn, 3 obs); MVP komplett | `b88b229`–`70153cd` (ungepusht), `2026-06-21.md` (S4)        |
| 2026-06-21 | S-07-Deploy verifiziert + Altlasten Husky/F6 erledigt   | CI run #30 success, Live HTTP 200; Husky aktiviert; F6 idempotente Trigger-Migration                                 | `0df2b99`, `f526e3c`                                         |
| 2026-06-21 | S-07 `visibility-controls` abgeschlossen + live         | Sichtbarkeit privat/global (Toggle+Default+UI+Gate); APPROVED; Zwei-Account-Matrix grün                              | `context/archive/2026-06-20-visibility-controls/`, `5c2b5f8` |
| 2026-06-20 | S-06 `run-control-and-tokens` abgeschlossen + live      | Live-Token-Zähler; APPROVED, archiviert                                                                              | `614b4ea`, `160ee06`                                         |
| 2026-06-19 | S-05 `distribution-results` abgeschlossen + live        | Verteilung/Typ-Stabilität je Achse (Leitstern)                                                                       | `17dfcb3`, `2eb4da5`                                         |
| 2026-06-18 | S-04 `oejts-measurement-run` abgeschlossen + live       | `/runs`-UI, OEJTS-Lauf end-to-end                                                                                    | `2f3ba29`, `d06afbe`                                         |
| 2026-06-17 | S-03 `persona-catalog` abgeschlossen + deployed         | Persona-Katalog, F1-Privacy-Fix                                                                                      | `3d8bb4e`                                                    |
| 2026-06-16 | S-02 `model-config-management` abgeschlossen + deployed | Model-Config + E2E-Gate                                                                                              | `92192ce`                                                    |
| 2026-06-15 | S-01 `email-auth-live` impl-reviewt + archiviert        | E-Mail-Auth, F1–F5 gefixt & live                                                                                     | `72fa7ce`                                                    |

---

## Gotchas (Referenz)

- **Neues Astro-Top-Level-Route-File → workerd-Dev-Server-Neustart:** Nach Anlegen einer neuen `*.astro`-Route läuft der laufende Dev-Server server-weit auf 500 / „Network connection lost" (Route-Manifest wird nicht heiß neu generiert). `npm run dev` neu starten.
- **Neue lucide-Imports → Vite-Dep-Re-Opt-Hydration-404:** Neue Icons triggern lucide-react-Re-Optimierung; ausgelieferter `?v=`-Hash 404t → React-Island-Hydration scheitert. Rein präsentationale Astro-Inseln ohne `client:load` statisch rendern (siehe `context/foundation/lessons.md`).
- **`prettier-plugin-tailwindcss` trimmt Klassen-String-Literale:** Leerzeichen in konditionalen Klassen-Strings (`" -translate-x-1/2"`) werden gestrippt → immer `cn()` aus `@/lib/utils` zum Mergen nutzen, nie manuelle Verkettung.
- **Husky aktiv halten:** `package.json` braucht `"prepare": "husky"`, sonst feuert pre-commit/lint-staged nicht (seit 2026-06-21 gefixt).
- **GitHub-Actions ohne `gh`:** Status via REST-API (`curl.exe --ssl-no-revoke` auf `/actions/runs` + `/runs/{id}/jobs`); Run-Conclusion `success` schließt geskippten Deploy-Job nicht aus → Jobs/Steps einzeln prüfen.
- **Migrations-Push separat:** Dev-Server läuft gegen Prod-Supabase; neue Policy/Spalte/Trigger braucht `! npx supabase db push`. Worker-Deploy appliziert KEINE Migration.
- **Zwei-Account-RLS-Test:** Testaccounts `md.motion.value@gmail.com` (A) / `damian.spyra@googlemail.com` (B), Passwort `Dupadupa19`; Playwright teilt einen Cookie-Jar → sequenzieller Wechsel A→B→A, Auth über `POST /api/auth/signin` (FormData).
- **Prod-Worker-URL:** `persona-forge.damian-spyra-ai.workers.dev`. **Push auf `main` (= Prod-Deploy)** braucht User-`!`-Kommando; **CI-Lint blockt deploy lautlos** → nach Push deploy-Job prüfen.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`

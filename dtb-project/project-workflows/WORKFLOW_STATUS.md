# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-20 (Session 1)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-20.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | **Keine aktive Implementierung.** S-06 `run-control-and-tokens` **vollständig**: Live-Token-Zähler implementiert, Gate 8/8, impl-review APPROVED (0 Findings), Roadmap `done`, archiviert. **Noch nicht gepusht** (4 Commits lokal vor `origin/main`). |
| **Naechster Schritt** | **`! git push`** (Prod-Deploy) + CI-Deploy-Job prüfen, dann **S-07** `/10x-plan visibility-controls` (oder S-08 parallel). |
| **Blocker** | Keine. |

---

## Offene Aufgaben

- [ ] **Push S-06** via `! git push` (4 Commits) → CI-Deploy-Job prüfen. Keine Migration nötig.
- [ ] S-07 `visibility-controls` planen (Sichtbarkeit privat/global; Prereq S-03 ✅ + S-05 ✅) ODER S-08 `side-by-side-comparison` (parallel, Prereq S-05 ✅)
- [ ] F6 Trigger-Idempotenz; Husky/lint-staged-Hook reparieren

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-20 | **S-06 abgeschlossen** (lokal) | Live-Token-Zähler; Abbruch/Token-Ausweis (S-04-vorgebaut) verifiziert; APPROVED, archiviert | `614b4ea`, `1b71ee3`, `a1bf59e` |
| 2026-06-19 | **S-05 abgeschlossen + live** | Verteilung/Typ-Stabilität je Achse (Leitstern); Gate 11/11, archiviert, deployed | `17dfcb3`, `2eb4da5` |
| 2026-06-18 | S-04 abgeschlossen + live | `/runs`-UI, OEJTS-Lauf end-to-end, archiviert | `2f3ba29`, `d06afbe` |
| 2026-06-17 | S-03 abgeschlossen + deployed | Persona-Katalog, F1-Privacy-Fix, archiviert | `3d8bb4e` |
| 2026-06-16 | S-02 abgeschlossen + deployed | Model-Config + E2E-Gate, archiviert | `92192ce` |
| 2026-06-15 | S-01 impl-reviewt + archiviert | E-Mail-Auth, F1–F5 gefixt & live | `72fa7ce` |

---

## Gotchas (Referenz)

- **S-06-Lehre:** Vor dem Planen prüfen, was Vorgänger-Slices schon mitliefern — FR-014/FR-015 waren in S-04 vorgebaut; ehrliche Scope-Reduktion (kein erfundener HIGH-Plan) hielt den Slice klein. TS-Pflichtfeld am DTO macht „alle Return-Sites befüllt" per `astro check` selbst-prüfend.
- **Transienter Dev-Server-500 bei E2E:** ein 500 unmittelbar nach Vite-`new dependencies optimized … reloading` (z. B. `zod`) ist environmental (Modul-Reload tötet in-flight-Request), kein Diff-Bug — Re-Optimierung abwarten, Call wiederholen.
- **Playwright-MCP-Browser ≠ Damians Browser:** eigene Session; war als Testaccount `md.motion.value@gmail.com` eingeloggt. Gate-Test-Läufe nach Verifikation aufräumen.
- **`unfinished`/`empty` deterministisch:** `pending`-Lauf via `POST /api/runs` ohne Step; `empty` via Bad-Key-Config. **Logout-Redirect:** `fetch(url,{credentials:'omit',redirect:'follow'})`. **RLS-Test:** zweiter Account im Playwright-Browser einloggen.
- **OEJTS:** `score = const + Σ(sign·value)`, `>24` → high-Pol; achsen-weiser Dropout bei unparsed-Items; on-the-fly-Auswertung (keine Migration). Lizenz CC BY-NC-SA 4.0 (privat/MVP OK).
- **Prod-Worker-URL:** `persona-forge.damian-spyra-ai.workers.dev`. **Push auf `main` (= Prod-Deploy)** braucht User-`!`-Kommando (Auto-Mode blockt). **CI-Lint blockt deploy lautlos** → nach Push deploy-Job prüfen. **Worker-Deploy appliziert KEINE Migration** (separat `db push`).
- **Windows/PS:** `git mv` kann am Lock scheitern → `Move-Item` + `git add`. **Bash-Tool ≠ PowerShell** (kein `@'…'@` → `git commit -F -` mit Heredoc). **`$host` reserviert in PS** → `$h`. **curl** scheitert an TLS-Interception → `Invoke-WebRequest`.
- **Lint:** Non-Null-`!` verboten → Helper mit `throw`; Top-Level-`return` im Astro-Frontmatter crasht ESLint → `Astro.response.status`. Nur `button.tsx` als shadcn — UI Plain-Tailwind im cosmic-Stil.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`

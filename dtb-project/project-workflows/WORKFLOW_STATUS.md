# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-19 (Session 1)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-19.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | **Keine aktive Implementierung.** S-05 `distribution-results` (Leitstern) **vollständig abgeschlossen + live**: Gate 11/11, impl-review APPROVED + Hardening, archiviert, gepusht (`2eb4da5`), Deploy verifiziert. |
| **Naechster Schritt** | **Cleanup Gate-Test-Daten** (braucht A-Login), dann **S-06 `run-control-and-tokens`** starten (`/10x-plan run-control-and-tokens`). |
| **Blocker** | Keine. |

---

## Offene Aufgaben

- [ ] **Cleanup Gate-Test-Daten** (Prod-DB, User A): 4 Läufe (`ecad64d1`, `ba415f35`, `57404517`, `9ae9b9da`) + Config „Bad Key (Gate-Test)" — braucht A-Login im Playwright-Browser; Dev-Server läuft noch
- [ ] S-06 `run-control-and-tokens` planen (Lauf-Abbruch + Token-Ausweis; Prerequisite S-04 ✅)
- [ ] F6 Trigger-Idempotenz; Husky/lint-staged-Hook reparieren

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-19 | **S-05 abgeschlossen + live** | Verteilung/Typ-Stabilität je Achse; Gate 11/11, APPROVED, archiviert, deployed | `17dfcb3`, `b348988`, `20a6e15`, `2eb4da5` |
| 2026-06-18 | **S-04 abgeschlossen + live** | `/runs`-UI, OEJTS-Lauf end-to-end, archiviert | `2f3ba29`, `c07761b`, `d06afbe` |
| 2026-06-17 | S-03 abgeschlossen + deployed | Persona-Katalog, F1-Privacy-Fix, archiviert | `3d8bb4e` |
| 2026-06-16 | S-02 abgeschlossen + deployed | Model-Config + E2E-Gate, archiviert | `92192ce` |
| 2026-06-15 | S-01 impl-reviewt + archiviert | E-Mail-Auth, F1–F5 gefixt & live | `72fa7ce`, `8b84ace` |

---

## Gotchas (Referenz)

- **`unfinished`/`empty`-State deterministisch erzeugen:** `pending`-Lauf via `POST /api/runs` ohne Step-Loop; `empty` via Bad-Key-Config (alle reps `error`). N=5 gegen echte API wird zu schnell `completed`, um `running` einzufangen.
- **Logout-Redirect ohne Session-Verlust testen:** `fetch(url, {credentials:'omit', redirect:'follow'})` → Middleware → `/auth/signin`. **RLS-Test:** zweiter Account muss **im Playwright-MCP-Browser** eingeloggt werden (eigene Session, ≠ Damians Browser).
- **OEJTS-Scoring:** `score(Achse) = constant + Σ(sign·value)`, `> 24` → high-Pol. Achsen-weiser Dropout bei unparsed-Items (`status != "ok"` → Achse `null`). S-05 on-the-fly (keine Migration/persistierten Aggregate). „<2 nicht belastbar" ist Darstellungs-Schwelle (UI), kein Service-State.
- **OEJTS-Lizenz:** CC BY-NC-SA 4.0 — privat/MVP OK, vor kommerziell/Verteilung neu prüfen.
- **Prod-Worker-URL:** `persona-forge.damian-spyra-ai.workers.dev` (mit `-ai`). Deploy-Check indirekt über neue Route (404→401/302). `gh`/`GITHUB_TOKEN` fehlen.
- **Push auf `main` (= Prod-Deploy)** blockt der Auto-Mode-Classifier → User-`!`-Kommando. **Prod-`db push` / Studio-SQL** ebenso bzw. via Studio.
- **`git mv` scheitert am Windows-Lock** → `Move-Item` + `git add <alt> <neu>`. **Bash-Tool ≠ PowerShell:** kein `@'…'@`-Here-String → `git commit -F -` mit POSIX-Heredoc. **`$host` reserviert in PS** → `$h`.
- **CI-Lint blockt deploy lautlos** → nach Push deploy-Job prüfen. **Worker-Deploy appliziert KEINE DB-Migration** (separat `db push`).
- **curl scheitert an lokaler TLS-Interception** (Exit 35) → `Invoke-WebRequest`; PS 5.1 ohne `-SkipHttpErrorCheck`, Status via `$_.Exception.Response.StatusCode`. Bequemster Gate-Weg: Dev-Server + eingeloggte Browser-Session.
- **Lint:** Non-Null-Assertion (`!`) verboten → Helper mit `throw`. Untypisierter Supabase-Client: `any` über typisierten Mapper-Parameter lautern. ESLint-Crash bei Top-Level-`return` im Astro-Frontmatter → 404 via `Astro.response.status`. Nur `button.tsx` als shadcn-Komponente — UI Plain-Tailwind im cosmic-Stil.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`

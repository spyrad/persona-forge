# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-21 (Session 1)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-21.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | **Keine — S-07 `visibility-controls` vollständig abgeschlossen + archiviert.** Sichtbarkeits-Toggle privat/global für Personas+Läufe, Default global; impl-review APPROVED (0 critical/warning), Zwei-Account-Gate grün. 10 Commits lokal vor `origin/main` (noch nicht gepusht). |
| **Naechster Schritt** | **Push** der 10 Commits (`! git push` → Prod-Deploy), danach CI-Deploy-Job prüfen. Dann **S-08 `side-by-side-comparison`** starten (`/10x-plan side-by-side-comparison`). |
| **Blocker** | Keine. |

---

## Offene Aufgaben

- [ ] Push der 10 Commits (`! git push`), danach Deploy-Job sichten (CI-Lint skippt Deploy lautlos). Migration ist bereits auf Prod-DB.
- [ ] S-08 `side-by-side-comparison` (Zwei-Läufe-Vergleich nebeneinander; Prereq S-05 ✅) — letzter geplanter MVP-Slice
- [ ] Optional: S-06/S-07-Deploy bei Gelegenheit im Cloudflare-/Actions-UI sichten (`gh` fehlt lokal)
- [ ] F6 Trigger-Idempotenz; Husky/lint-staged-Hook reparieren

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-21 | **S-07 abgeschlossen + archiviert** | Sichtbarkeit privat/global (Toggle+Default+UI+Gate); impl-review APPROVED; Zwei-Account-Matrix grün | `context/archive/2026-06-20-visibility-controls/`, `4d662dd` |
| 2026-06-20 | **S-06 abgeschlossen + gepusht/live** | Live-Token-Zähler; APPROVED, archiviert, `→ main` | `614b4ea`, `a1bf59e`, `160ee06` |
| 2026-06-19 | S-05 abgeschlossen + live | Verteilung/Typ-Stabilität je Achse (Leitstern); Gate 11/11 | `17dfcb3`, `2eb4da5` |
| 2026-06-18 | S-04 abgeschlossen + live | `/runs`-UI, OEJTS-Lauf end-to-end | `2f3ba29`, `d06afbe` |
| 2026-06-17 | S-03 abgeschlossen + deployed | Persona-Katalog, F1-Privacy-Fix | `3d8bb4e` |
| 2026-06-16 | S-02 abgeschlossen + deployed | Model-Config + E2E-Gate | `92192ce` |
| 2026-06-15 | S-01 impl-reviewt + archiviert | E-Mail-Auth, F1–F5 gefixt & live | `72fa7ce` |

---

## Gotchas (Referenz)

- **Zwei-Account-RLS-Test:** Playwright-Browser teilt einen Cookie-Jar → B einloggen verdrängt A. Beide Testaccounts (`md.motion.value@gmail.com` = A, `damian.spyra@googlemail.com` = B) haben Passwort `Dupadupa19`; sequenzieller Wechsel A→B→A. Auth-Wechsel über `POST /api/auth/signin` (FormData) statt der SSR-Form-Seite (die crasht transient bei Vite-Re-Optimierung). Gate-Testdaten nach Verifikation aufräumen.
- **Transienter Dev-Server-500 / leere SSR-Seite:** ein 500 oder 0-Byte-Render direkt nach Vite-`✨ new dependencies optimized … reloading` ist environmental (zwei React-Kopien / Modul-Reload in-flight) — Re-Optimierung abwarten, Call wiederholen. Betraf zod (Run-PATCH) und `useFormStatus`/SubmitButton (Signin-Seite).
- **Migrations-Push separat:** Dev-Server gegen Prod-Supabase; neue Policy/Spalte braucht `! npx supabase db push`. **Worker-Deploy appliziert KEINE Migration.**
- **RLS-NULL-Semantik:** owner-gescopte Policies (`owner_id = (select auth.uid())`) blocken globale Seed-Objekte (owner_id NULL) automatisch (`NULL = uid` → nicht true). FR-008-Immutability bleibt app-seitig (Service patcht nur `{visibility, updated_at}`).
- **OEJTS:** `score = const + Σ(sign·value)`, `>24` → high-Pol; on-the-fly-Auswertung (keine Migration). Lizenz CC BY-NC-SA 4.0 (privat/MVP OK).
- **Prod-Worker-URL:** `persona-forge.damian-spyra-ai.workers.dev`. **Push auf `main` (= Prod-Deploy)** braucht User-`!`-Kommando (Auto-Mode blockt). **CI-Lint blockt deploy lautlos** → nach Push deploy-Job prüfen.
- **Windows/PS:** `git mv` kann am Lock scheitern → `Move-Item` + `git add -A`. **Bash-Tool ≠ PowerShell** (kein `@'…'@` → `git commit -F -`). **curl** scheitert an TLS-Interception → `Invoke-WebRequest`.
- **Lint:** Non-Null-`!` verboten → Helper mit `throw`; Top-Level-`return` im Astro-Frontmatter crasht ESLint → `Astro.response.status`. Nur `button.tsx` als shadcn — UI Plain-Tailwind im cosmic-Stil. `window.location.href` nur als Modul-Funktion (nicht in Komponente, `react-hooks/immutability`).

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`

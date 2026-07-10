# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-09 (Session 2)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-09.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | Keine offene Baustelle. Landing-Page-Redesign ist **live auf Prod** (PR #3, `c04001b`). Modul 5 (Champion): Badge-Nachweis erbracht, Lernmodul 3/5.                                |
| **Naechster Schritt** | `/10x-archive ci-review-agent` (Status `implemented`), dann PR #3 als grünen Beleg in `evidence.md` nachtragen. Champion-Einreichung mit Builder + Architect zum Termin **10.08.** |
| **Blocker**           | Keine.                                                                                                                                                                             |

---

## Offene Aufgaben

- [ ] **Change archivieren** — `/10x-archive ci-review-agent` (Belege in `evidence.md`).
- [ ] **PR #3 in `evidence.md` nachtragen** — erster **grüner** Live-Lauf des CI-Review-Agenten
      an einem echten Feature-PR („0 Findings, 10.0/10"); bisher belegt nur PR #2 den roten Fall.
- [ ] **Sammel-Einreichung Termin 2 (10.08.) oder 3 (14.09.):** Builder + Architect
      (`context/architect-report.md`) + Champion (`context/changes/ci-review-agent/evidence.md`)
      zusammen. **Job-Logs verfallen ~07.10.**; PR-Kommentare bleiben dauerhaft.
- [ ] **Optional: App-Seiten angleichen** — Dashboard/Models/Personas/Runs tragen noch die alte
      Design-Sprache; die Landing definiert jetzt Typografie und Motion.
- [ ] **Optional: „Task-based evals" ins PRD** — steht auf der Landing als `planned`, ist aber
      noch nirgends als Instrument spezifiziert.
- [ ] **Optional: Timeout im Scorer** — ein hängender z.ai-Call blockiert `ai-review` bis zum Job-Limit.
- [ ] **Optional: zweiter promptfoo-Provider** für einen Modellvergleich.
- [ ] **Geparkte Minors (SDD):** Live-Progress 0 Tokens während Runden; Generierungs-Fehler ohne
      Rep-Detail; DRY-Duplikat `tryParseJson`; Badge-Markup 4× in `TestLibrary.astro`.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                           | Ergebnis                                                                                                                        | Details                                 |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 2026-07-09 | **Landing Page „Live Instrument" live**               | Canvas-Live-Simulation, 5 Sektionen, OEJTS-Attribution korrekt. 11 Tasks + 3 Iteration Passes; 4 Bugs vom Review gefangen       | `2026-07-09.md` (S2), PR #3, `c04001b`  |
| 2026-07-09 | **CI-Review-Agent erstmals grün an echtem PR**        | `ai-review/verdict` pass, „0 Findings, Schnitt 10.0/10" — Merge-Gate funktioniert in beide Richtungen (rot: PR #2, grün: PR #3) | PR #3                                   |
| 2026-07-09 | **CI-Review-Agent KOMPLETT (4 Phasen) + Prod-Deploy** | LLM-PR-Reviewer live; Findings statt Noten; 7 von 18 Regeln deterministisch im Code                                             | `2026-07-09.md` (S1), `evidence.md`     |
| 2026-07-05 | **Zertifizierungs-Entscheidung: Champion**            | Termin 1 ausgelassen; alle 3 Badges zusammen bei Termin 2/3                                                                     | `2026-07-05.md`                         |
| 2026-07-03 | **OEJTS-Lizenz korrigiert**                           | CC BY-NC-SA 4.0, nicht gemeinfrei; seit S2 auch im Footer der Landing korrekt ausgewiesen                                       | `docs/instruments/oejts-attribution.md` |
| 2026-07-02 | **Feature: Standhaftigkeit (2. Test-Typ)**            | `kind`-Diskriminator; Prüfling×Gegenspieler; CI/Prod grün                                                                       | `528d626`, `2026-07-02.md`              |
| 2026-07-01 | **Modul-4 (10xArchitect) KOMPLETT**                   | 4/4 Artefakte + Architektur-Report (einreichbereit)                                                                             | `context/architect-report.md`           |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** (M1–3) + **10xArchitect** (M3–4) einreichbereit.
**10xChampion (Modul 5): Badge-Nachweis erbracht** (s05e03-Pipeline gebaut, verifiziert, deployt),
Lernmodul zu 3/5 bearbeitet. s05e04 (Registry) ist der **alternative** Badge-Weg, s05e05 („Innovate")
die Kür — beide für die Einreichung **nicht nötig**. Alle drei Badges zusammen einreichen.
Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **Volles Lint lokal:** `npm run lint` erstickt an CRLF. CI-äquivalent ist
  `npx eslint . --rule '{"prettier/prettier":"off"}'`. Teilmengen zu linten hat schon einen CI-Fail durchgelassen.
- **`lint-staged` darf `package-lock.json` nicht anfassen** — ein umformatierter Lockfile bricht `npm ci` still.
- **Squash-Merge lässt lokales `main` divergieren** — nach `gh pr merge --squash` kein `git pull`,
  sondern `git reset --hard origin/main` (Inhalt steckt im Squash).
- **Astro rendert `client:visible`-Inseln serverseitig mit** — ein Fallback dahinter braucht aktives
  Verstecken (`opacity-0` + Mount-Reveal), sonst überlappen beide ohne JS.
- **CSS-Reveal-Muster braucht JS-Gating** (`.js .reveal`), sonst ist die Seite ohne JS leer — und die
  reduced-motion-Regel muss in der Spezifität mitziehen.
- **z.ai kennt kein `response_format: json_schema`**, nur `json_object`. Coding-Plan-Key braucht
  `api.z.ai/api/coding/paas/v4`. `thinking:disabled` spart Faktor 3,4. Memory `persona-forge-zai-provider`.
- **Was abzählbar ist, gehört nicht ins LLM** (`lessons.md`): `static-checks.ts` prüft die 7 syntaktischen Regeln per Regex.
- **Verdict ist Required Status Check** auf `main` (`ai-review/verdict`, `enforce_admins: false`).
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked`. Memory `persona-forge-migrations`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key** (Prod+Dev teilen DB), sonst hängen Läufe 0/N.
- **Push auf `main` = Prod-Deploy**; CI-Fail blockt Deploy lautlos → nach Push `gh run list --branch main`.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`

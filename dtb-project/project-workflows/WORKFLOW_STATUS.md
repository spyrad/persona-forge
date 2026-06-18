# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-18 (Session 1)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-18.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | **S-04 `oejts-measurement-run` in Arbeit** — **Phase 1 deployed + committet** (`8c2fd52`, `6e396ec`), **Phase 2 codiert, alle Automated-Gates grün** (Tests 33), uncommitted, am Manual-Gate (2.5–2.10). |
| **Naechster Schritt** | **Phase-2-Manual-Gate** (echter Endpunkt — via curl/PowerShell ODER zusammen mit Phase-3-UI) → Phase-2-Commit + SHA-Writeback; dann Phase 3 (`/runs`-UI). |
| **Blocker** | Keine (Manual-Gate braucht einen erreichbaren OpenAI-kompatiblen Endpunkt). |

---

## Offene Aufgaben

- [ ] S-04 Phase-2-Manual-Gate (2.5–2.10): Endpunkt fährt N Wiederholungen, Fehlquote/Tokens/Abbruch/SSRF → Phase-2-Commit
- [ ] S-04 Phase 3 `/10x-implement oejts-measurement-run phase 3` (`/runs`-Seite, client-getriebener Step-Loop)
- [ ] Slice abschließen: `/10x-impl-review` → Roadmap S-04 `done` → `/10x-archive` → Push (Prod-Deploy)
- [ ] Cleanup Test-User remote-DB; F6 Trigger-Idempotenz; Husky/lint-staged-Hook reparieren

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-18 | **S-04 Phase 1 deployed + committet** | Migration auf Prod, Manual-Gate ✅, 2 Commits | `8c2fd52`, `6e396ec` |
| 2026-06-18 | **S-04 Phase 2 codiert** | LLM-Call + `/step`-Orchestrierung (F3/F4), API-Routen, Gates grün | `context/changes/oejts-measurement-run/plan.md` |
| 2026-06-17 | S-04 geplant + Phase 1 codiert | OEJTS-Blocker gelöst, 3-Phasen-Plan (SOUND), 33 Tests | `context/changes/oejts-measurement-run/` |
| 2026-06-17 | S-03 abgeschlossen + deployed | Persona-Katalog, F1-Privacy-Fix, archiviert, live | `3d8bb4e` |
| 2026-06-16 | S-02 abgeschlossen + deployed | Model-Config + E2E-Gate, archiviert, live | `92192ce` |
| 2026-06-15 | S-01 impl-reviewt + archiviert | E-Mail-Auth, F1–F5 gefixt & live | `72fa7ce`, `8b84ace` |

---

## Gotchas (Referenz)

- **OEJTS-Lizenz:** CC BY-NC-SA 4.0 (nicht gemeinfrei) — privat/MVP OK, vor kommerziell/Verteilung neu prüfen.
- **Studio-RLS-Test:** `set local request.jwt.claims` wirkt nur in einer Transaktion → Test in `begin; … commit;` kapseln (sonst `auth.uid()` = null).
- **Untypisierter Supabase-Client + strictTypeChecked:** `data` aus `.maybeSingle()` ist `any` → über typisierten Funktionsparameter lautern (Mapper wie `toView`/`toStepState`), nicht Cast + Zugriff.
- **JSON-Import aus `context/` scheitert** (kein resolveJsonModule/Alias) → Instrument-Daten als `.ts`-Modul unter `src/`.
- **Vitest kann `astro:env/server` nicht stubben** → reine Logik env-frei halten (Parser/Permutation/Prompt).
- **Prod-`db push` braucht je Migration eigene Freigabe** (Auto-Mode-Classifier blockt Auto-Confirm) → User-`!`-Kommando.
- **Sichtbarkeits-Default** an user-scoped Tabellen explizit `'private'` (S-03 F1); globale Objekte nur per Seed.
- **RLS + DELETE/UPDATE:** 0-Row-Match ist kein Erfolg — Zeilenzahl prüfen. **Child-RLS** via exists-Subquery auf Parent.
- **`git mv` Windows-Lock → `Move-Item`** · **CI-Lint blockt deploy lautlos → Deploy-Job prüfen** · **Worker-Deploy appliziert KEINE DB-Migration (separat `db push`)**.

---

## Pausierte Themen

### S-04: oejts-measurement-run
**Status:** In Arbeit — Phase 1 deployed+committet, Phase 2 codiert (Automated grün), wartet auf Manual-Gate 2.5–2.10 + Phase-2-Commit.
**Details:** `context/changes/oejts-measurement-run/plan.md` (Progress-Sektion)

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`

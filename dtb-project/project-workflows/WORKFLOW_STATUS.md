# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-18 (Session 2)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-18.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | **S-04 `oejts-measurement-run`** — **Phase 1 + Phase 2 abgeschlossen, committet & live deployt** (`6e396ec`, `cc2fff2`, `0348733`). Ein OEJTS-Lauf ist end-to-end per API fahrbar (Prod verifiziert: `GET /api/runs` → 401). Phase 3 (`/runs`-UI) offen. |
| **Naechster Schritt** | **Phase 3** `/10x-implement oejts-measurement-run phase 3` (`/runs`-Seite, client-getriebener Step-Loop). |
| **Blocker** | Keine. |

---

## Offene Aufgaben

- [ ] S-04 Phase 3 — `/runs`-UI mit client-getriebenem Step-Loop (`/10x-implement … phase 3`)
- [ ] Slice abschließen — `/10x-impl-review` → Roadmap S-04 `done` → `/10x-archive`
- [ ] Cleanup Test-User remote-DB; F6 Trigger-Idempotenz; Husky/lint-staged-Hook reparieren

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-18 | **S-04 Phase 2 abgeschlossen + live** | Manual-Gate 2.5–2.10 abgenommen (echte OpenAI-API), committet + gepusht + Deploy verifiziert | `cc2fff2`, `0348733` |
| 2026-06-18 | S-04 Phase 1 deployed + committet | Migration auf Prod, Manual-Gate ✅, reiner OEJTS-Kern | `8c2fd52`, `6e396ec` |
| 2026-06-17 | S-04 geplant + Phase 1 codiert | OEJTS-Blocker gelöst, 3-Phasen-Plan (SOUND), 33 Tests | `context/changes/oejts-measurement-run/` |
| 2026-06-17 | S-03 abgeschlossen + deployed | Persona-Katalog, F1-Privacy-Fix, archiviert, live | `3d8bb4e` |
| 2026-06-16 | S-02 abgeschlossen + deployed | Model-Config + E2E-Gate, archiviert, live | `92192ce` |
| 2026-06-15 | S-01 impl-reviewt + archiviert | E-Mail-Auth, F1–F5 gefixt & live | `72fa7ce`, `8b84ace` |

---

## Gotchas (Referenz)

- **OEJTS-Lizenz:** CC BY-NC-SA 4.0 (nicht gemeinfrei) — privat/MVP OK, vor kommerziell/Verteilung neu prüfen.
- **Manual-Gate ohne UI:** API direkt treiben via Dev-Server + Playwright-Login + `fetch` aus der Session-Konsole (Cookie-Auth umgeht curl/PKCE-Schmerz). `gh`/`GITHUB_TOKEN` fehlen → Deploy indirekt prüfen (neuer Endpunkt → 401 statt 404).
- **Lokales workerd:** „Error: Network connection lost" ist transient beim fetch-Lesen → retry-tolerant abfragen.
- **curl scheitert an lokaler TLS-Interception** (Exit 35) → `Invoke-WebRequest` nutzen; PS 5.1 ohne `-SkipHttpErrorCheck`, Status via `$_.Exception.Response.StatusCode`.
- **Studio-RLS-Test:** `set local request.jwt.claims` nur in einer Transaktion (`begin; … commit;`), sonst `auth.uid()` = null.
- **Untypisierter Supabase-Client + strictTypeChecked:** `any` aus `.maybeSingle()` über typisierten Mapper-Parameter lautern (`toView`/`toStepState`), nie Cast + Zugriff.
- **JSON-Import aus `context/` scheitert** → Instrument-Daten als `.ts`-Modul unter `src/`. **Vitest kann `astro:env/server` nicht stubben** → reine Logik env-frei halten.
- **Prod-`db push` braucht je Migration eigene Freigabe** (Auto-Mode-Classifier blockt Auto-Confirm) → User-`!`-Kommando.
- **Sichtbarkeits-Default** user-scoped explizit `'private'` (S-03 F1). **RLS + DELETE/UPDATE:** 0-Row-Match ist kein Erfolg. **Child-RLS** via exists-Subquery auf Parent.
- **`git mv` Windows-Lock → `Move-Item`** · **CI-Lint blockt deploy lautlos → Deploy-Job prüfen** · **Worker-Deploy appliziert KEINE DB-Migration (separat `db push`)**.

---

## Pausierte Themen

### S-04: oejts-measurement-run
**Status:** In Arbeit — Phase 1 + 2 abgeschlossen & live; nur Phase 3 (`/runs`-UI) + Slice-Abschluss offen.
**Details:** `context/changes/oejts-measurement-run/plan.md` (Progress-Sektion)

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`

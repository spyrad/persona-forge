# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-17 (Session 2)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-17.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | **S-03 `persona-catalog` in Arbeit** — Phase 1 committet (`0f62896`, Migration live auf Prod), **Phase 2 fertig codiert + automated-grün, am Manual-Gate (uncommitted)**. |
| **Naechster Schritt** | **Phase-2-Manual-Gate** (2.5–2.8: strukturierte Persona + „Anpassen" + Modus-Umschaltung) → Phase-2-Commit + Epilogue-Commit. |
| **Blocker** | Keiner. (S-04 weiterhin blocked: OEJTS-Quelle.) |

---

## Offene Aufgaben

- [ ] **S-03 Phase 2 abschließen** — Manual-Gate, Commit + Epilogue, dann `/10x-impl-review` → Roadmap `done` → `/10x-archive` → Push
- [ ] F6: Trigger-Migration idempotent (`on conflict do nothing`) — neue Migration
- [ ] Husky/lint-staged-Hook reparieren (griff bei `4b5e916` nicht → CI-Lint-Fail)
- [ ] Cleanup Test-User remote-DB
- [ ] OEJTS-Quelle fixieren (Itemtexte, Achsen, Scoring) — Owner: Damian; blockt S-04

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-17 | **S-03 Phase 1 implementiert** | Persona-CRUD + Katalog + globaler Seed, Migration live auf Prod | `0f62896` |
| 2026-06-17 | S-03 geplant | 2-Phasen-Plan + Brief, 8 Design-Entscheidungen | `context/changes/persona-catalog/` |
| 2026-06-16 | **S-02 abgeschlossen + deployed** | E2E-Gate komplett, impl-reviewt, archiviert, live | `92192ce`, `context/archive/2026-06-15-model-config-management/` |
| 2026-06-15 | S-01 impl-reviewt + archiviert | F1–F5 gefixt & live | `72fa7ce`, `8b84ace` |
| 2026-06-13 | F-01 connect-supabase | Supabase + RLS-Grundgerüst | `context/archive/2026-06-12-connect-supabase/` |
| 2026-06-12 | F-02 deploy-skeleton-live | Live-URL, CI grün | `context/archive/2026-06-11-deploy-skeleton-live/` |

---

## Gotchas (Referenz)

- **React-Compiler immutability:** `window.location.href =` in voll kompilierbaren Islands wird geflaggt → Navigation in Modul-Scope-Helper (`redirectToSignin()`) auslagern. (S-03 P1.)
- **Globaler Seed:** `owner_id` nullable (`NULL` = System); Insert-Policy `owner_id = auth.uid()` schützt weiter, nur Migration legt ownerlose Zeilen an. (S-03.)
- **RLS + DELETE/UPDATE:** 0-Row-Match (fremde id) ist kein Erfolg — Zeilenzahl prüfen, sonst fälschlich `ok:true`. (`23e82c6`.)
- **SSRF-Guard:** zusätzlich gegen numerische IPv4 (dword/octal/hex) härten. (`ce32b3c`.)
- **Test-User:** A = `damian.spyra@googlemail.com`, B = `md.motion.value@gmail.com` (nicht `damian.spyra.ai@…`).
- **Prod-Check:** curl scheitert an lokaler TLS-Interception (exit 35) → `Invoke-WebRequest -UseBasicParsing`.
- **`astro check` ≠ build/lint** · **CI-Lint blockt deploy lautlos** · **`git mv` Windows-Lock → `Move-Item`** · **PKCE = selber Browser** · **Docker lokal nicht oben → `db push` direkt auf Prod (autorisiert)**.

---

## Pausierte Themen

### S-04: oejts-measurement-run
**Status:** Blocked — OEJTS-Quelldatensatz (Itemtexte, Achsen, Scoring) muss von Damian beschafft werden.
**Details:** `context/foundation/roadmap.md` (S-04, Open Roadmap Questions)

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`

# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-17 (Session 3)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-17.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | Keine — **S-03 `persona-catalog` abgeschlossen, archiviert & auf Prod deployt** (Stream A komplett). |
| **Naechster Schritt** | **S-04 `oejts-measurement-run`** starten — sobald OEJTS-Quelle vorliegt (`/10x-plan oejts-measurement-run`). |
| **Blocker** | S-04 **blocked**: OEJTS-Quelldatensatz fehlt (Owner: Damian). |

---

## Offene Aufgaben

- [ ] OEJTS-Quelle fixieren (Itemtexte, Achsen, Scoring) — blockt S-04, Owner: Damian
- [ ] Cleanup Test-User remote-DB — alte `'global'`-Personas bleiben global (`set default` ändert keine Bestandszeilen)
- [ ] F6: Trigger-Migration idempotent (`on conflict do nothing`) — neue Migration
- [ ] Husky/lint-staged-Hook reparieren (griff bei `4b5e916` nicht → CI-Lint-Fail)

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-17 | **S-03 abgeschlossen + deployed** | Persona-Katalog (frei+strukturiert), impl-reviewt (F1 privacy-Fix), archiviert, live | `3d8bb4e`, `context/archive/2026-06-17-persona-catalog/` |
| 2026-06-16 | S-02 abgeschlossen + deployed | Model-Config + E2E-Gate, archiviert, live | `92192ce`, `context/archive/2026-06-15-model-config-management/` |
| 2026-06-15 | S-01 impl-reviewt + archiviert | E-Mail-Auth, F1–F5 gefixt & live | `72fa7ce`, `8b84ace` |
| 2026-06-13 | F-01 connect-supabase | Supabase + RLS-Grundgerüst | `context/archive/2026-06-12-connect-supabase/` |
| 2026-06-12 | F-02 deploy-skeleton-live | Live-URL, CI grün | `context/archive/2026-06-11-deploy-skeleton-live/` |

---

## Gotchas (Referenz)

- **Sichtbarkeits-Default (S-03 F1):** user-scoped Tabellen → `visibility` explizit `'private'` beim Insert; DB-Default `'global'` leakt cross-tenant. Globale Objekte nur per Seed/Migration (FR-009).
- **RLS + DELETE/UPDATE:** 0-Row-Match (fremde id) ist kein Erfolg — Zeilenzahl prüfen, sonst fälschlich `ok:true`. (`23e82c6`.)
- **React-Compiler immutability:** `window.location.href =` in voll kompilierbaren Islands → Navigation in Modul-Scope-Helper (`redirectToSignin()`).
- **Migration auf Prod:** Docker lokal oft nicht oben → `npx supabase db push` direkt aufs Prod-Projekt (autorisiert); Worker-Deploy (`git push`) appliziert die DB-Migration NICHT.
- **`git mv` Windows-Lock → `Move-Item`** · **CI-Lint blockt deploy lautlos → Deploy-Job prüfen** · **`astro check` ≠ build/lint** · **Prod-Check: `Invoke-WebRequest -UseBasicParsing`** (curl exit 35 an lokaler TLS-Interception) · **Test-User:** A=`damian.spyra@googlemail.com`, B=`md.motion.value@gmail.com`.

---

## Pausierte Themen

### S-04: oejts-measurement-run
**Status:** Blocked — OEJTS-Quelldatensatz (Itemtexte, Achsen, Scoring) muss von Damian beschafft werden.
**Details:** `context/foundation/roadmap.md` (S-04, Open Roadmap Questions)

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`

# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-16 (Session 2)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-16.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | Keine offene — **S-02 `model-config-management` vollständig abgeschlossen, archiviert und auf Prod deployt** (verifiziert: Prod-`/models` redirectet ausgeloggt auf `/auth/signin`). |
| **Naechster Schritt** | **S-03 `persona-catalog`** starten — `/10x-plan persona-catalog` (Stream A, Prerequisite S-01 erfüllt; parallel zu S-02 vorgesehen). |
| **Blocker** | Keiner. (S-04 weiterhin blocked: OEJTS-Quelle.) |

---

## Offene Aufgaben

- [ ] **S-03 `persona-catalog` starten** — nächster Slice, Persona anlegen (frei/strukturiert) + Katalog + Kopie-statt-Änderung (FR-007/FR-008)
- [ ] F6: Trigger-Migration idempotent (`on conflict do nothing`) — neue Migration
- [ ] Husky/lint-staged-Hook reparieren (griff bei `4b5e916` nicht → CI-Lint-Fail)
- [ ] Cleanup Test-User remote-DB
- [ ] OEJTS-Quelle fixieren (Itemtexte, Achsen, Scoring) — Owner: Damian; blockt S-04

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-16 | **S-02 abgeschlossen + deployed** | E2E-Gate komplett, impl-reviewt (3 Fixes), archiviert, live auf Prod | `92192ce`, `context/archive/2026-06-15-model-config-management/` |
| 2026-06-16 | S-02 Phasen 1–4 implementiert | Krypto+Migration+API+UI, Automated grün, SSRF-Fix (HIGH) | `f4e748d`…`992d57d` |
| 2026-06-15 | S-01 impl-reviewt + archiviert | F1–F5 gefixt & live, Roadmap done | `72fa7ce`, `8b84ace` |
| 2026-06-13 | F-01 connect-supabase | Supabase + RLS-Grundgerüst | `context/archive/2026-06-12-connect-supabase/` |
| 2026-06-12 | F-02 deploy-skeleton-live | Live-URL, CI grün | `context/archive/2026-06-11-deploy-skeleton-live/` |

---

## Gotchas (Referenz)

- **RLS + DELETE/UPDATE:** 0-Row-Match (fremde id) ist kein Erfolg — Endpoint muss betroffene Zeilenzahl prüfen, sonst fälschlich `ok:true`. (Fix `23e82c6`.)
- **SSRF-Guard:** zusätzlich gegen numerische IPv4 (dword/octal/hex, z.B. 2852039166 = 169.254.169.254) härten — sonst „benannter Host"-Durchrutsch. (Fix `ce32b3c`.)
- **Test-User:** A = `damian.spyra@googlemail.com`, B = `md.motion.value@gmail.com` (nicht `damian.spyra.ai@…`).
- **Prod-Check:** curl scheitert an lokaler TLS-Interception (exit 35) → `Invoke-WebRequest -UseBasicParsing` nutzen.
- **Transienter miniflare-`500 Network connection lost`** (Post-Mutation-Re-Fetch/Signout) — nicht reproduzierbar, kein App-Bug.
- **`astro check` ≠ build/lint:** nur `npx astro check` type-checkt voll · **CI-Lint blockt deploy lautlos** · **`git mv` Windows-Lock → `Move-Item`** · **PKCE = selber Browser**.

---

## Pausierte Themen

### S-04: oejts-measurement-run
**Status:** Blocked — OEJTS-Quelldatensatz (Itemtexte, Achsen, Scoring) muss von Damian beschafft werden.
**Details:** `context/foundation/roadmap.md` (S-04, Open Roadmap Questions)

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`

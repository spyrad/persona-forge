# Supabase-Projekt anbinden + RLS-Grundgerüst (F-01) — Plan Brief

> Full plan: `context/changes/connect-supabase/plan.md`
> Research: `context/changes/connect-supabase/research.md`

## What & Why

F-01 verbindet ein Supabase-Cloud-Projekt mit der App und etabliert den
Datenzugriffs-Contract „Nutzer sieht nur Eigenes + Globales" als erste,
beweisbare RLS-Migration. Es ist die Foundation, an der alle Slices hängen
(S-01 direkt, alle weiteren transitiv) — und sie baut das in der Roadmap
benannte Risiko „RLS zu spät konfiguriert → teure Auth-Lücken" ab.

## Starting Point

Das Scaffold liefert die komplette Auth-Verdrahtung (SSR-Client, Middleware,
Endpoints, Forms), aber dahinter ist nichts: kein verbundenes Projekt, keine
einzige Migration, keine Worker-Secrets. Ein Null-Client-Degradations-Pfad
hält die App ohne Supabase lauffähig — deshalb ist F-02 grün live, obwohl
Auth tot ist.

## Desired End State

Signup/Signin funktioniert lokal UND auf der Live-URL; der Config-Banner ist
weg. In der Remote-DB liegt die RLS-Foundation (visibility-Enum, `profiles`,
`_rls_probe` als kopierbares Muster), und der Contract ist mit zwei
Test-Usern bewiesen: A sieht Eigenes + Globales, nie das Private von B.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| RLS-Materialisierung | `profiles` + droppbare `_rls_probe`-Tabelle | Einzige Option, bei der „Contract etabliert" prüfbar ist statt Behauptung | Plan |
| Worker-Secrets-Mechanik | `secrets:`-Input der wrangler-action (Sync je Deploy) | GitHub wird Single Source — eliminiert die Drift-Klasse „Worker veraltet, CI grün" | Research |
| Lokale Dev-Umgebung | Cloud-Projekt direkt (kein Docker-Stack) | Ein Setup, verprobt die echte Kette; passt zu top_blocker `time` | Plan |
| Prod-Verifikations-Scope | Signup auf Live-URL gehört zu F-01 | Erst der Prod-Login beweist die Secrets-Kette; sonst erbt S-01 ein ungetestetes Fundament | Plan |
| Key-Wahl | Publishable/Anon-Key, nie `service_role` | `SUPABASE_KEY` ist ambig benannt; service_role würde RLS aushebeln | Research |
| Env-Schema-Härtung | `optional: true` bleibt, kein `validateSecrets` | Degradations-Pfad ist der Sicherheitsgurt; Härtung erst nach verifiziertem Prod-Login | Research |

## Scope

**In scope:** Supabase-Projekt (manuell), `.dev.vars`/`.env` + Beispieldateien,
`supabase link` + erste Migration (Enum, `profiles`, `_rls_probe` mit
4-Policy-Muster), RLS-Beweis per Impersonations-SQL, GitHub-Secrets,
`ci.yml`-Secrets-Sync, Live-Verifikation, CLAUDE.md-Gotcha-Update.

**Out of scope:** Domänen-Schema (S-02/S-03), zod/Service-Layer/DB-Typen
(S-01+), Auth-Flow-Ausbau (S-01), lokaler Docker-Stack, env-Härtung, seed.sql.

## Architecture / Approach

Drei Secrets-Orte, ein Sync: `.dev.vars` (lokal, workerd) · GitHub-Secrets
(Single Source) · Worker-Runtime (vom Deploy-Job gesynct). Die Migration
etabliert das Policy-Muster — visibility weitet nur `select`, alle Writes
owner-only, `(select auth.uid())`, Index auf owner — das S-02/S-03 wörtlich
kopieren; `_rls_probe` fliegt raus, sobald die erste echte Tabelle steht.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Projekt + lokale Verbindung + RLS-Migration | Lokal funktionierende Auth + bewiesener RLS-Contract | Erste Nutzung der Migrations-Pipeline (link/push) — Neuland |
| 2. Secrets-Sync in CI + Live-Gang | Funktionierende Auth auf der Live-URL, Doku-Sync | Reihenfolge: GitHub-Secrets MÜSSEN vor dem Push gesetzt sein |

**Prerequisites:** Supabase-Account (Damian); GitHub-Repo-Zugriff;
`NODE_OPTIONS=--use-system-ca` (gesetzt).
**Estimated effort:** 1–2 Sessions, 2 Phasen.

## Open Risks & Assumptions

- Supabase-CLI hinter TLS-Interception: `login`/`link`/`db push` sollten mit
  dem System-CA-Workaround laufen — erster echter Härtetest dieser Annahme.
- E-Mail-Confirmations sind im Cloud-Default an; Verifikation braucht echte
  Mail-Adressen (`+suffix`-Aliase für den zweiten User).
- Annahme: `wrangler secret list` funktioniert lokal mit dem vorhandenen
  API-Token-Setup (sonst Dashboard-Check als Fallback).

## Success Criteria (Summary)

- Signup → Confirm → Signin → `/dashboard` funktioniert lokal und auf der
  Live-URL; Config-Banner verschwunden.
- RLS-Contract bewiesen: Eigenes + Globales sichtbar, Fremd-Privates nicht,
  Owner-Spoofing abgelehnt.
- CI grün inkl. Worker-Secrets-Sync; CLAUDE.md beschreibt den Endzustand.

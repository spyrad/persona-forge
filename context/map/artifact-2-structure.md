# Artifact 2 — Struktur (Wie ist es gebaut)

> Wide-Scan-Notiz (s04e02, L2). Quelle: `dependency-cruiser@18` (Metriken, Graph)
>
> - `madge` (Zyklen), beide alias-aware via `tsconfig.json` (`@/* → ./src/*`).
>   Roher Beleg für die Synthese in `repo-map.md`.

## ⚠️ Methodengrenze zuerst (sonst Fehlschlüsse)

Der statische Graph deckt **nur die `.ts`/`.tsx`-Schicht ab (68 Module).** Zwei
blinde Flecken, die jede Zahl unten einfärben:

1. **`.astro`-Pages sind unsichtbar.** 5 Pages (`dashboard/runs/models/personas/index`)
   - `Layout.astro` werden von depcruise/madge **nicht** traversiert. Alle Imports
     _von_ Astro (Page → React-Insel, Page/Layout → Service) fehlen im Graph.
2. **`import type` zählt nicht als Kante.** Type-only-Importe tauchen nicht als
   Dependency auf.

**Belegte Konsequenz** (verifiziert per grep): `types.ts` und `config-status.ts`
erscheinen als „Orphans", sind es aber **nicht** —
`types.ts` wird von 10+ Modulen `import type`-genutzt, `config-status.ts` von
`Layout.astro`. → **Keine toten Module hier; es ist die Werkzeuggrenze.** Diese
Lücke ist Teil der Map, kein Fehler.

## Schichtung (Instability I = Ce/(Ca+Ce))

| Bereich                       | Ca     | Ce  | I         | Rolle                                                                          |
| ----------------------------- | ------ | --- | --------- | ------------------------------------------------------------------------------ |
| `src/pages` / `src/pages/api` | 13     | ~40 | **75 %**  | **Entry-Points** — konsumieren, niemand hängt dran                             |
| `src/components/*`            | 0      | 1–4 | **100 %** | **Blatt-Inseln** — reine Konsumenten (Astro-Hosts unsichtbar → Ca künstlich 0) |
| `src/test/integration`        | 0      | 27  | 100 %     | Test-Harness — zieht viel rein                                                 |
| `src/lib/services`            | **21** | 7   | **25 %**  | **Stabiles Fundament** — größter Blast-Radius                                  |
| `src/lib/api-auth.ts`         | **10** | 2   | 17 %      | Auth-Kontrakt für API-Routes                                                   |
| `src/lib/runs`                | 2      | 3   | 60 %      | Aggregations-Logik (OEJTS)                                                     |

Lesart: sauberes **Entry (instabil) → Service (stabil)**-Gefälle. Stabile Kerne
unten, volatile Konsumenten oben — kein invertiertes Coupling.

## Blast-Radius-Kerne (real importiert, Datei-Ebene)

| #Importeure | Modul                               | Bedeutung bei Änderung                                    |
| ----------- | ----------------------------------- | --------------------------------------------------------- |
| 11          | `src/lib/api-responses.ts`          | API-Antwort-Helper — berührt **jede** Route               |
| 10          | `src/lib/api-auth.ts`               | Auth-Guard für API — Sicherheits-kritisch                 |
| 9           | `src/lib/services/runs.ts`          | **Kern-Domäne** — OEJTS-Messlauf-Service                  |
| 8           | `src/lib/services/model-configs.ts` | LLM-Configs (verschlüsselte Keys)                         |
| 7           | `src/lib/instruments/oejts.ts`      | **Das OEJTS-Instrument selbst** (Test-Definition/Scoring) |
| 6           | `src/lib/{utils,supabase}.ts`       | Infra: cn() / SSR-Supabase-Client                         |
| 5           | `src/lib/url-guard.ts`              | SSRF-Schutz (Security)                                    |
| 5           | `src/lib/services/personas.ts`      | Persona-Service                                           |

→ Der **Mess-/Run-Flow** (`services/runs` + `instruments/oejts` + `lib/runs`) ist
auch strukturell das Zentrum — deckt sich mit den Code-Hotspots aus Artifact 1.
`api-responses` + `api-auth` sind die **Quer-Kontrakte** (jede Route hängt dran).

## Zyklen

**Keine.** `madge --circular` über 68 Module → leer. (2 Warnungen = nicht-auflösbare
Nicht-JS-Importe, vermutlich Astro/Asset.) Gesundes Zeichen; kein Zyklus als
Deep-Focus-Kandidat nötig.

## Orphans (depcruise) — eingeordnet

| Modul                                                   | Echt tot? | Grund                                            |
| ------------------------------------------------------- | --------- | ------------------------------------------------ |
| `src/types.ts`                                          | **Nein**  | type-only-Importe (10+ Konsumenten)              |
| `src/lib/config-status.ts`                              | **Nein**  | nur von `Layout.astro` importiert (Astro-Grenze) |
| `src/env.d.ts`                                          | Nein      | Ambient-Typdeklaration (kein Import nötig)       |
| `src/test/integration/{setup,astro-env-server.stub}.ts` | Nein      | Vitest-Setup, via Config geladen                 |

→ **Null echte tote Module.** Alle „Orphans" sind Werkzeug-Artefakte.

## Test-Risiken (aus Graph abgeleitet)

- **`services/runs.ts`** zieht Supabase + LLM-Pfad → in Isolation schwer testbar,
  braucht Mocking (existiert: `src/test/integration/llm-mock.ts`). Eher Integration
  als Unit. Deckt sich mit vorhandenem Integration-Harness.
- **Reine Logik gut isolierbar:** `instruments/oejts.ts`, `lib/runs/oejts-aggregate.ts`,
  `persona-compile.ts`, `crypto.ts`, `url-guard.ts` — haben bereits `*.test.ts` (Unit).
- **Astro-Pages + Auth-Redirect** nur via E2E prüfbar (kein statischer Graph) — deckt
  sich mit `tests/e2e/` (Risk #5).

## unknowns (für die Map zu übernehmen)

- **Gesamte Astro-Routing-/SSR-Schicht** (Page → Insel, Page/Layout → Service,
  `prerender=false`-Datenladen) liegt außerhalb des Graphen. Größter blinder Fleck.
- Runtime-/dynamische Bindungen (Middleware-Dispatch, `astro:env`-Injektion) sieht
  kein statischer Scan.

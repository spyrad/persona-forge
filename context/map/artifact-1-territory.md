# Artifact 1 — Terytorium (Wo lebt das Projekt)

> Wide-Scan-Notiz (s04e02, L2). Quelle: `git log` über die **gesamte** Historie.
> Roher Arbeits-Beleg für die Synthese in `repo-map.md` — kein Politur-Dokument.

## Methodik-Vorbehalt (wichtig für dieses Repo)

persona-forge ist **kein Legacy**: **172 Commits, 10.–30. Juni 2026 (20 Tage), ein
einziger Autor (Damian)**. Die git-history-Technik aus der Lektion zielt auf große,
alte, viel-Autoren-Repos — hier liefert sie deshalb:

- **Verwertbar:** _welche Code-Bereiche_ am intensivsten bearbeitet wurden (Hotspots),
  _was sich zusammen ändert_ (Coupling-Hinweis), und das _Feature-Narrativ_ aus den
  archivierten Changes.
- **Quasi leer (→ unknown):** „aktiv vs. eingefroren" (alles ist jung/aktiv),
  „saisonale vs. konstante" Trends, Contributor-Streuung (Solo). Nicht überinterpretieren.

## Hotspots — Code (`src/`, Rauschen gefiltert)

| Changes | Datei                                          | Rolle                                                                       |
| ------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| 7       | `src/types.ts`                                 | **Gemeinsamer Nenner** — zentrale Entities/DTOs, ändert sich mit fast allem |
| 7       | `src/components/runs/RunRunner.tsx`            | Messlauf starten (OEJTS-Run)                                                |
| 7       | `src/components/runs/RunResult.tsx`            | Lauf-Ergebnis/Verteilung anzeigen                                           |
| 6       | `src/middleware.ts`                            | **Auth-Querschnitt** — User-Auflösung + Route-Schutz je Request             |
| 6       | `src/lib/services/runs.ts`                     | Run-Geschäftslogik (Service-Layer)                                          |
| 5       | `src/pages/dashboard.astro`                    | Geschützter Hub                                                             |
| 4       | `src/lib/services/{personas,model-configs}.ts` | Persona-/Model-Config-Services                                              |
| 4       | `src/components/runs/RunComparison.tsx`        | Side-by-side-Vergleich                                                      |
| 4       | `src/components/personas/PersonaCatalog.tsx`   | Persona-Katalog-Insel                                                       |

## Aktivität nach Bereich (`src/`, 2 Ebenen)

```
src/pages       54   ← Routen (Astro-Pages + API-Routes)
src/components   53   ← React-Inseln + UI
src/lib          41   ← Business-Logik (services/, runs/, llm/, instruments/)
src/test         20   ← Integration-Test-Harness
src/types.ts      7   ← zentrale Typen
src/middleware    6   ← Auth-Querschnitt
```

Verteilung bestätigt die Drei-Schichten-Anatomie **pages → components → lib**,
mit `types.ts` und `middleware.ts` als horizontalen Querschnitten.

## Co-Changes (was wandert gemeinsam durch Commits)

| Häufigkeit | Paar                              | Lesart                                     |
| ---------- | --------------------------------- | ------------------------------------------ |
| 8          | `lib` + `pages`                   | Vertikaler Slice: Service + Route zusammen |
| 8          | `components` + `pages`            | Insel + ihre Host-Page zusammen            |
| 6          | `components` + `lib`              | UI ↔ Service durchgereicht                 |
| 5          | `lib` + `types`                   | Neue Logik bringt neue Entities/DTOs       |
| 4          | `pages` + `types`                 | Routen konsumieren zentrale Typen          |
| 3          | `lib`/`components` + `middleware` | Auth-Anpassung strahlt in Logik+UI         |

**Deutung:** Klassisches **vertikales Feature-Slicing** (jedes Feature berührt
UI + Page + Service gemeinsam) — gesundes Muster, kein verdächtiges Cross-Layer-Leck.
`types.ts` als Co-Change-Magnet = erwartbar für eine zentrale Typdatei, **nicht**
ein Smell. Echte Coupling-Risiken klärt erst der Import-Graph (Artifact 2).

## Feature-Narrativ (archivierte Changes = Ersatz für Historie/Contributors)

15 abgeschlossene Changes in `context/archive/`, chronologisch — das ist die
eigentliche „Aktivitätsgeschichte" dieses jungen Repos:

```
06-11 deploy-skeleton-live        Cloudflare-Deploy-Gerüst
06-12 connect-supabase            Postgres/Auth-Anbindung
06-13 email-auth-live             E-Mail/Passwort-Auth  ← Auth-Fundament
06-15 model-config-management     verschlüsselte LLM-Keys + Config
06-17 oejts-measurement-run       OEJTS-Lauf end-to-end  ← KERN-DOMÄNE
06-17 persona-catalog             Persona-Katalog
06-18 distribution-results        Verteilung/Typ-Stabilität je Achse
06-20 run-control-and-tokens      Lauf-Steuerung + Token-Handling
06-20 visibility-controls         Sichtbarkeits-/IP-Toggles
06-21 side-by-side-comparison     Vergleichsansicht
06-23 testing-integration-...     Integration- + Security-Gate
06-23 testing-run-integrity-ssrf  Run-Integrität + SSRF-Schutz
06-24 testing-quality-gates-...   CI-Quality-Gates
06-25 sentry-monitoring           Prod-Monitoring
06-29 ui-redesign                 Token-Design-System + Dark Mode
```

Schwerpunkt-Cluster: **Auth (06-12/13)** → **Messlauf-Domäne (06-15…06-21)** →
**Test/Qualität/Monitoring (06-23…25)** → **UI (06-29)**. Das „Messlauf"-Cluster
(OEJTS-Run, Distribution, Run-Control, Comparison) ist mit Abstand am dichtesten —
deckt sich mit den Code-Hotspots oben → **Kernbereich = der Mess-/Run-Flow**.

## Vorläufige Schlüsse (für die Synthese)

- **Kern der App = OEJTS-Messlauf-Flow** (`runs`): höchste Code-Aktivität _und_
  dichtester Feature-Cluster. Wahrscheinlicher Deep-Focus-Kandidat für L3.
- **Sensible Querschnitte:** `middleware.ts` (Auth-Gate), `types.ts` (alles hängt dran),
  `lib/services/model-configs.ts` (verschlüsselte Keys).
- **unknown (Methodengrenze):** Stabilität/„tote" Pfade nicht aus 20-Tage-Historie
  ableitbar; Contributor-Streuung n.a. (Solo). → Struktur (Artifact 2) muss die
  Coupling-/Blast-Radius-Fragen tragen, nicht die Historie.

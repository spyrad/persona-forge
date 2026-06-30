# UI-Vereinheitlichung (Token-System, Teal, Topbar, Dark Mode) — Plan Brief

> Full plan: `context/changes/ui-redesign/plan.md`

## What & Why

persona-forge fährt zwei konkurrierende Design-Sprachen: ein hartkodiertes „Cosmic"-Theme auf den Seiten und ein ungenutztes neutrales shadcn-Token-System in den Komponenten. Das wirkt inkonsistent und „generisch". Dieser Change macht die shadcn/Tailwind-Tokens zur alleinigen Design-Wahrheit (hell-first, ein Teal/Emerald-Akzent), ersetzt alle ~166 Farb-Literale durch semantische Tokens, baut eine durchgängige Topbar mit Hub-Dashboard und aktiviert einen vollwertigen Dark Mode (heute toter Code).

## Starting Point

Tailwind 4 CSS-first; `global.css` definiert Light- **und** Dark-Tokens, aber `.dark` wird nirgends gesetzt. `--primary` ist Schwarz. Nur `button.tsx` als shadcn-Komponente (Card fehlt). ~166 Farb-Literale über ~25 Dateien; Charts reichen Farb-Klassen an eine generische `AxisChart` durch. Topbar zeigt nur Dashboard/Sign-out; jede Sicht hat eigenes „← Dashboard". E2E rollenbasiert, keine UI-Unit-Tests → niedriges Test-Risiko.

## Desired End State

Jede Sicht rendert konsistent hell mit Teal-Akzent; der Topbar-Toggle schaltet flackerfrei in einen ebenso konsistenten Dark Mode, die Wahl überlebt Reloads. Kein Farb-Literal mehr in `src/`. Topbar überall präsent (Logo→Dashboard, User/Sign-out/Toggle), Dashboard als Card-Hub. Alle Test-Suites grün.

## Key Decisions Made

| Decision          | Choice                                     | Why                                      | Source     |
| ----------------- | ------------------------------------------ | ---------------------------------------- | ---------- |
| Visuelle Richtung | Clean & seriös, hell-first                 | Passt zu datengetriebenem Profiling-Tool | Brainstorm |
| Akzentfarbe       | Teal/Emerald (ein Token)                   | Modern, lesbar, harmoniert mit Charts    | Brainstorm |
| Navigation        | Persistente Topbar + Dashboard-Hub         | Minimalster Umbau, durchgängiger Rückweg | Brainstorm |
| Dark Mode         | Beide Modi + Toggle, No-Flash, persistiert | Vom Nutzer gewünscht                     | Brainstorm |
| Vorgehen          | Direkt im Code (kein Figma)                | Tokens sind schon die Single Source      | Brainstorm |
| Vergleichs-Serien | Teal (A) + Amber (B)                       | Max. Kontrast, farbenblind-robust        | Plan       |
| Cutoff-Linie      | Neutral/gestrichelt (nicht Amber)          | Amber jetzt = Serie B                    | Plan       |
| Landing (Welcome) | Voll auf neuen Look                        | Konsistenter erster Eindruck             | Plan       |
| shadcn-Scope      | Nur Card neu, kein Input/Select-Rollout    | Scope-Begrenzung                         | Plan       |

## Scope

**In scope:** Token-Umstellung (Teal + Chart-Palette), Card-Install, Dark-Mode-Infrastruktur (No-Flash-Script, ThemeToggle, Persistenz), neue Topbar + Layout-Integration, Dashboard-Hub, alle App-Sichten + React-Inseln, Charts, Auth-Seiten/-Komponenten, Landing-Hero, Banner/LibBadge.

**Out of scope:** Funktions-/Daten-/Layout-Logik, weitere shadcn-Komponenten außer Card, AxisChart-Render-Engine, Responsive-Überarbeitung, neue Tests.

## Architecture / Approach

Bottom-up: Fundament (Tokens + Dark-Mode-Infra) → gemeinsame Shell (Topbar/Layout/Dashboard) → mechanischer Sichten-Sweep → Charts → Auth/Landing → Voll-Verifikation. Semantische Tokens machen Dark Mode „umsonst", solange kein Literal verwendet wird — die Literal→Token-Disziplin ist der rote Faden.

## Phases at a Glance

| Phase                     | Liefert                                    | Hauptrisiko                                |
| ------------------------- | ------------------------------------------ | ------------------------------------------ |
| 1. Fundament & Dark-Infra | Teal-Tokens, Card, funktionierender Toggle | No-Flash/Hydration-Reihenfolge             |
| 2. Topbar + Shell + Hub   | Durchgängige Nav, Card-Dashboard           | Layout-Integration über alle Seiten        |
| 3. Sichten-Sweep          | 5 Sichten + 5 Inseln token-isiert          | Umfang (~166 Literale), Zustände übersehen |
| 4. Charts                 | Teal/Amber-Serien, neutraler Cutoff        | Serien-/Cutoff-Verwechslung                |
| 5. Auth + Landing         | Auth token-isiert, Hero neu                | Hero-Neukomposition                        |
| 6. Verifikation           | Grep-Sauberkeit, beide Modi geprüft        | Übersehene Reste                           |

**Prerequisites:** Lokales Supabase + Docker für Integration/E2E; `npx shadcn add card` (TLS-Gotcha: `NODE_OPTIONS=--use-system-ca`).
**Estimated effort:** ~3–5 Sessions über 6 Phasen (Phase 3 ist die größte).

## Open Risks & Assumptions

- Annahme: Die change.md-Designentscheidungen sind final (vom Nutzer bestätigt).
- Zwischenzustand: Nach Entfernen von `bg-cosmic` (Phase 1) sehen noch nicht gesweepte Seiten plain aus — nur im Branch, nie deployt.
- Exakte Teal-/Amber-OKLCH-Werte werden in Phase 1 final getunt (Kontrast in beiden Modi).

## Success Criteria (Summary)

- Konsistenter Look in Hell **und** Dunkel über jede Sicht; Theme persistiert flackerfrei.
- Kein Farb-Literal mehr in `src/` (Grep-Beweis).
- Build, Unit, Integration, E2E, Lint grün; keine funktionalen Regressionen.

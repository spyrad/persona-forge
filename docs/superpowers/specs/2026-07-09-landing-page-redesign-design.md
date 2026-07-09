# Design: Landing-Page-Redesign — „Live Instrument"

**Datum:** 2026-07-09
**Status:** Entwurf (User-Review ausstehend)
**Scope:** Nur die öffentliche Startseite (`src/pages/index.astro`). Keine App-Seiten.

## Ziel & Kontext

Die Landing Page wird vom schlichten Hero-plus-Cards-Layout zu einem
Showcase-Stück (Portfolio/LinkedIn) umgebaut. Inspiration: die fable-25-Showcases
(hochwertige Typografie, Motion, Art Direction) — übertragen auf die Thematik von
persona-forge: **LLMs haben messbare Persönlichkeiten.**

Entscheidungen aus dem Brainstorming:

| Frage             | Entscheidung                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Scope             | Landing Page                                                                                            |
| Primärziel        | Showcase / Portfolio (beeindrucken, mutig-expressiv erlaubt)                                            |
| Visuelle Metapher | **Messinstrument** — wissenschaftlich-präzise, Daten als Gestaltung                                     |
| Sprache der Seite | **Englisch** (App dahinter bleibt vorerst deutsch — bewusster Bruch)                                    |
| Ansatz            | A — „Live Instrument": Canvas-Simulation im Hero, CSS-Scroll-Reveals; kein Three.js, kein Framer Motion |

Aus dem Video-Prompt übernommen: **mindestens drei Iteration Passes** nach dem
Bau — die Seite mit kritischem Blick durchgehen (Designprobleme, Verdichtungs-
chancen), nachschärfen, jeder Pass mit Screenshot-Beleg.

## Seitenaufbau (fünf Akte)

Die Seite erzählt „eine wachsende Test-Bibliothek für Modell-Verhalten" —
OEJTS ist das erste Exponat, nicht die Identität. Ein späterer neuer Test ist
nur eine weitere Karte, kein Redesign.

1. **Hero** — „Your model has a personality. Measure it." Links Headline + zwei
   CTAs (Sign in / Create account), rechts (mobil gestapelt) die
   Live-Simulation. Darunter Statuszeile im Mono-Font:
   `run 37/50 · mean 62.4 · σ 8.1` (echt berechnet aus den simulierten Punkten).
2. **Problem** — „One measurement is an anecdote." Einzelner Messpunkt vs.
   Verteilung als visueller Kontrast; kurzer Text, große Typografie.
3. **Methode** — „Ask the same question fifty times." Drei Karten:
   Configure → Run → Read, je mit reduziertem Mini-Diagramm.
4. **Test Library** — vier Instrument-Karten mit Status-Badge:
   - **OEJTS** `live` — vier animierte Achsen-Verteilungen (E/I, S/N, T/F, J/P)
   - **Steadfastness** `live` — Prüfling × Gegenspieler; Mini-Visual: Linie, die
     unter Druck-Impulsen stabil bleibt oder kippt
   - **Big Five (Mini-IPIP)** `planned` (PRD FR-010)
   - **Task-based evals** `planned` — Vision: welche Persona/welches Modell
     bewältigt welche Software-Aufgabe am besten (noch nicht im PRD)
     Claim der Sektion: „A growing library of behavioral instruments."
5. **CTA + Footer** — Abschluss-CTA („Start measuring"); Footer mit korrekter
   OEJTS-Attribution (**CC BY-NC-SA 4.0**). Die falsche „gemeinfrei"-Behauptung
   aus `Welcome.astro` entfällt; englische Copy sagt „openly licensed".

Topbar/ThemeToggle bleiben. Dark Mode ist der Hero-Modus, Light Mode wird
vollwertig gepflegt (Projektkonvention).

## Hero-Simulation

Canvas-Insel, die einen Messlauf nachspielt:

- **Ablauf:** Horizontale Achse mit zwei Polen (`I ←→ E`). Alle ~150 ms fällt
  ein Messpunkt ein, sinkt auf seine Achsenposition, stapelt sich zum
  Histogramm; darüber zeichnet sich eine geglättete Verteilungskurve.
  Statuszeile tickt mit (run-Zähler, mean, σ — echt berechnet).
- **Loop:** Bei N=50 friert das Bild kurz ein, Kurve pulsiert einmal im
  Teal-Akzent, dann Wechsel zur nächsten Achse (E/I → S/N → T/F → J/P), neu
  beginnend. Jede Achse hat eine deterministische, geseedete Verteilung mit
  eigenem Charakter (schmal/stabil vs. breit/streuend) — die Produkt-Story
  als Daten.
- **Rücksicht:** `prefers-reduced-motion` → fertiges Standbild (volle
  Verteilung, finale Werte). Simulation pausiert außerhalb des Viewports
  (`IntersectionObserver`) und bei verstecktem Tab (`visibilitychange`).
  Farben aus den Theme-Custom-Properties (`getComputedStyle`) — Dark/Light
  automatisch korrekt.
- **Fallback:** Ohne JS (und bis zur Hydration) rendert der Server das
  statische `AxisDistribution`-SVG mit finalen Werten; identische feste Höhe
  → kein Layout-Shift.
- **Technik:** React-Insel (`client:visible`), reines Canvas-2D-API, keine
  Chart-Bibliothek. Simulation als reine Funktionen (`simulateRun(seed)`)
  getrennt vom Rendering → unit-testbar. Geschätzt 200–300 Zeilen.

## Visuelle Sprache

- **Typografie:**
  - Display: **Instrument Serif** — editorialer Serif, nur Headlines, groß
    (`clamp` bis ~5.5rem im Hero), eng gesetzt.
  - Body: bestehender Sans (kein Stilbruch zur App).
  - Mono: **JetBrains Mono** mit `tabular-nums` — alle Zahlen (Statuszeile,
    Achsen-Labels, Statistiken, Sektions-Nummern `01/05`).
  - Beide self-hosted via `@fontsource`, nur benötigte Schnitte (~30–50 kB),
    Import nur in `index.astro`.
- **Farbe:** Vollständig im bestehenden Token-System. **Teal (`primary`)
  ausschließlich für „lebende Messung"** (Punkte, Kurven, aktive Zustände).
  Amber (`--chart-2`) genau einmal: im Problem-Visual (Sektion 02) markiert es
  den einzelnen, trügerischen Messpunkt — Amber = Anekdote, Teal = Messung.
  Keine neuen Farb-Tokens, keine Farb-Literale.
- **Linien & Raster:** Haarlinien (`border-border`) als Achsen, Tick-Marks an
  Sektionsgrenzen, Sektions-Nummern am Rand. Großzügiger Weißraum.
- **Motion:** Genau zwei Bewegungen: (1) Fade + 12 px Rise beim
  Ins-Bild-Scrollen (einmalig), (2) Kurven zeichnen sich (SVG
  `stroke-dashoffset`). Keine Parallax, keine gepinnten Sektionen. Alles
  respektiert `prefers-reduced-motion`.

## Architektur

```
src/components/landing/
├── Hero.astro              Headline, CTAs, umschließt die Simulation
├── HeroSimulation.tsx      React-Insel (client:visible), Canvas + Lifecycle
├── simulation.ts           Reine Logik: simulateRun(seed), mean/σ — kein DOM
├── Problem.astro           Sektion 02
├── Method.astro            Sektion 03 (drei Karten)
├── TestLibrary.astro       Sektion 04 (vier Instrument-Karten, Badges)
├── AxisDistribution.astro  Statisches Verteilungs-SVG (TestLibrary-Karten +
│                           No-JS-Fallback im Hero)
└── Cta.astro               Sektion 05
```

- `src/pages/index.astro` wird Assembler der Sektionen; `Welcome.astro`
  wird gelöscht.
- `global.css`: `--font-display`, `--font-mono` im `@theme`-Block →
  Tailwind-Utilities `font-display`/`font-mono`.
- Scroll-Reveal: Inline-Script in `index.astro` (~15 Zeilen,
  IntersectionObserver setzt `is-visible`; CSS animiert; bei
  `prefers-reduced-motion` sofort sichtbar).

## Testing & Verifikation

- Unit-Tests `simulation.ts`: deterministischer Seed → erwartete Punktfolge,
  korrekte mean/σ, Achsen-Zyklus.
- Bestehende Suite (187 Tests) bleibt grün. Lint mit dem CI-äquivalenten
  Check: `npx eslint . --rule '{"prettier/prettier":"off"}'`.
- Playwright-Screenshots: Dark + Light, Mobile + Desktop. Danach drei
  Iteration Passes mit Screenshot-Beleg.
- Bei der Planung prüfen: berühren bestehende E2E-Tests die Startseite
  (Auth-Flows)? Falls ja, Selektoren anpassen.

## Vorgehen & Deploy

Als **PR gegen `main`** bauen, nicht direkt pushen: Push auf `main` deployt
automatisch auf Prod, und der PR ist zugleich der erste echte Live-Beweis für
den frisch scharfgeschalteten CI-Review-Agenten (Scorecard, Merge-Gate).

## Out of Scope

- App-Seiten (Dashboard, Models, Personas, Runs) — Design-Sprache dort
  anzugleichen ist ein späterer, eigener Schritt.
- Deutsche/mehrsprachige Fassung der Landing Page.
- „Task-based evals" als tatsächliches Instrument (nur als `planned`-Karte
  gezeigt; PRD-Aufnahme separat).

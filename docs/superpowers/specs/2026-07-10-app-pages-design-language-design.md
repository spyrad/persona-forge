# App-Seiten an die Landing-Design-Sprache angleichen — Stufe A: Fundament & Chrome

**Datum:** 2026-07-10
**Status:** Entwurf zur Review
**Kontext:** Die Landing Page (PR #3, „Live Instrument") definiert seit 2026-07-09
Typografie, Motion und Layout-Sprache des Projekts. Die App-Seiten (Dashboard,
Models, Personas, Runs, Auth) tragen noch die alte Design-Sprache — der Wechsel
Landing → App wirkt wie ein Produktbruch.

## Ziel

**Showcase-Kohärenz:** Ein Besucher, der von der Landing in die App wechselt
(insbesondere über den Signup-Funnel), sieht dieselbe Handschrift — Schrift,
Header-Rhetorik, Geometrie, Bewegung, Sprache. Erfolgskriterium ist der
visuelle Eindruck des Übergangs, nicht die Tool-Ergonomie.

## Zerlegung (Gesamtvorhaben)

Das Gesamtvorhaben „alle App-Flächen angleichen" ist in drei unabhängig
shipbare Stufen zerlegt; **diese Spec deckt nur Stufe A**:

- **A — Fundament & Chrome (diese Spec):** Fonts global, Motion-Grundlage,
  `AppLayout` + Header-Sprache, Container-Geometrie, Copy der `.astro`-Seiten,
  Auth-Typografie.
- **B — Anzeige-Flächen (Folge-Spec):** `axis-chart.tsx`, `RunResult`,
  `RunComparison`, Karten-Rhythmus, `tabular-nums`.
- **C — Arbeitsflächen (Folge-Spec):** `ModelConfigManager`, `PersonaCatalog`,
  `RunRunner` — Formulare, Listen, Empty States; inkl. Englisch-Umstellung der
  Insel-Texte.

Jede Stufe geht als eigener PR durch den CI-Review-Agenten.

## Entscheidungen (mit User im Visual Companion validiert)

1. **Header-Sprache: volle Landing-Rhetorik.** Eyebrow (Mono, uppercase,
   `tracking-[0.2em]`) + große Serif-Headline (`font-display`) + Lead + Ruler-Ticks
   unter der Topbar.
2. **Motion: kurzer Seiten-Einstieg.** Nur der Seiten-Header animiert einmalig
   beim Laden (~0,4 s, opacity + translate); die Arbeitsfläche steht sofort.
   Kein Scroll-Reveal in der App. `prefers-reduced-motion` wird respektiert.
3. **Geometrie: Landing-Rahmen überall.** Topbar und Seiten-Header spannen
   `max-w-6xl` auf (Wortmarke steht auf jeder Seite am selben Ort);
   Arbeitsinhalt läuft in einer **linksbündigen** `max-w-3xl`-Spalte.
4. **Sprache: App-Seiten auf Englisch.** Alles, was in den `.astro`-Dateien
   sichtbar ist (Titel, Eyebrows, Leads, Kachel-Texte). React-Insel-Interna
   bleiben bis Stufe B/C deutsch — bewusster Übergangszustand.
5. **Auth-Seiten gehören zu Stufe A.** Sie sind der erste Funnel-Schritt nach
   der Landing.
6. **Technischer Schnitt: `AppLayout.astro` + zentrale CSS.** Ein Layout, das
   `Layout.astro` wrappt; Geometrie und Header leben an genau einer Stelle.

## Design

### 1. Fundament (`global.css`, `Layout.astro`)

- Die drei `@fontsource`-Imports (`instrument-serif`, `instrument-serif/400-italic`,
  `jetbrains-mono`) wandern von `src/pages/index.astro` nach
  `src/layouts/Layout.astro` — `--font-display`/`--font-mono` greifen damit auf
  jeder Seite.
- `.reveal`- und `.section-ruler`-CSS ziehen aus dem `is:global`-Block in
  `index.astro` nach `src/styles/global.css` um (eine Definition für Landing
  und App). Der IntersectionObserver (Scroll-Reveal) bleibt Landing-exklusiv
  in `index.astro`.
- Neue Klasse `.page-enter` in `global.css`: reine CSS-Animation
  (opacity 0→1, translate 12px→0, 0,4 s ease), läuft einmal beim Laden.
  Zeitbasiert statt scrollbasiert → **kein JS, kein `.js`-Gating nötig**;
  ohne JavaScript endet sie trotzdem sichtbar.
  `@media (prefers-reduced-motion: reduce)` schaltet sie ab.

### 2. `AppLayout.astro` (neu, `src/layouts/`)

```astro
<AppLayout title="Runs" <title
  >, wie bisher an Layout durchgereicht eyebrow="04 — measurement runs" // Mono-Eyebrow heading="Runs" // Serif-h1
  lead="Each repetition is an isolated session…" width="narrow" // "narrow" (Default) | "full" >
  <!-- Seiteninhalt -->
</AppLayout>
```

Struktur: `Layout.astro` (Topbar) → Ruler-Ticks direkt unter der Topbar
(`.section-ruler`-Muster) → `<main class="mx-auto max-w-6xl px-4">` → Header
mit `page-enter`:

- Eyebrow: `text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase`
- `h1`: `font-display text-foreground text-4xl sm:text-5xl` (Serif, Regular)
- Lead: `text-muted-foreground text-lg`, max. Breite wie Landing (`max-w-xl`)

Danach der Slot: bei `width="narrow"` in linksbündiger `max-w-3xl`-Spalte,
bei `width="full"` über den ganzen 6xl-Rahmen.

**Topbar (`src/components/Topbar.astro`):** einzige Änderung
`max-w-5xl` → `max-w-6xl`.

### 3. Seiten-Umstellung

Frontmatter-Logik (Supabase-Load, `loadError`, 404-Handling) bleibt überall
unangetastet; es ändert sich nur das Markup drumherum.

| Seite                | Eyebrow                 | Heading       | Breite                        |
| -------------------- | ----------------------- | ------------- | ----------------------------- |
| `dashboard.astro`    | `01 — overview`         | Dashboard     | full (Kachel-Grid, 3 Spalten) |
| `models.astro`       | `02 — model configs`    | Model configs | narrow                        |
| `personas.astro`     | `03 — personas`         | Personas      | narrow                        |
| `runs.astro`         | `04 — measurement runs` | Runs          | narrow                        |
| `runs/[id].astro`    | `04 — run result`       | Run result    | narrow                        |
| `runs/compare.astro` | `04 — comparison`       | Compare runs  | narrow                        |

Verbindliche Copy (englisch; Wortlaut-Feinschliff im PR erlaubt, Sprache und
Ton nicht):

- Runs-Lead: _„OEJTS measurement runs for {email}. Each repetition is an
  isolated session, driven step by step in the browser."_
- Dashboard-Kacheln: _Model configurations — Manage LLM models and parameters_ /
  _Personas — Browse and curate the persona catalog_ /
  _Runs — Start and evaluate OEJTS measurement runs_
- `resultSubtitle` (je `run.kind`) englisch.

### 4. Auth-Seiten (`signup.astro`, `signin.astro`, `confirm-email.astro`)

Zentrierte Karte bleibt (richtige Geometrie für einen Fokus-Schritt). Neu:

- `h1` in `font-display`-Serif statt `text-2xl font-bold`
- kleine Mono-Eyebrow `account` über dem `h1`
- `confirm-email.astro`: Emojis (✅/📧) werden je durch ein schlichtes
  Inline-SVG in `text-primary` ersetzt (Check / Mail) — Emoji bricht die
  Instrument-Sprache.

Texte sind dort bereits englisch.

## Nicht-Ziele (Stufe A)

- Keine Änderungen in den React-Inseln (`ModelConfigManager`, `PersonaCatalog`,
  `RunRunner`, `RunResult`, `RunComparison`, `axis-chart`) — weder Stil noch
  Sprache.
- Keine neuen shadcn-Komponenten, keine Token-Änderungen in `global.css`
  (nur Umzüge + `.page-enter`).
- Keine Landing-Änderungen außer den Umzügen (Font-Imports raus aus
  `index.astro`, CSS nach `global.css`) — das Verhalten der Landing bleibt
  identisch.

## Fehlerbehandlung

Keine neue Laufzeitlogik: `AppLayout` ist reines Markup mit Props. Die
bestehenden Fehlerpfade der Seiten (`loadError`-Banner, 404 in `runs/[id]`,
`PageState` in `compare`) bleiben byte-identisch in ihrer Logik und werden nur
in die neue Spalte gerendert.

## Verifikation

1. `npm run test` — Unit-Tests (unberührt, müssen grün bleiben).
2. `npm run build` — Production-Build.
3. CI-äquivalentes Lint: `npx eslint . --rule '{"prettier/prettier":"off"}'`
   (volles Lint lokal erstickt an CRLF — bekanntes Gotcha; Teilmengen-Lint hat
   schon einen CI-Fail durchgelassen).
4. `npm run test:e2e` — die referenzierten Headings „Sign in" und „Dashboard"
   behalten ihre Accessible Names (nur Schrift ändert sich).
5. Sichtprüfung aller sieben Seiten im Dev-Server, Light **und** Dark
   (No-Flash-Script + `ThemeToggle`), inkl. `prefers-reduced-motion`.
6. PR durch den CI-Review-Agenten (`ai-review/verdict`).

## Risiken

- **Fonts laden jetzt auf jeder Seite** — drei kleine woff2; bewusst in Kauf
  genommen, Voraussetzung der Kohärenz.
- **Zweisprachiger Übergangszustand** (Seiten englisch, Inseln deutsch) bis
  Stufe B/C — bewusst gestuft.
- **CLS durch `page-enter`** — minimal, da nur der Header animiert und
  `translate`/`opacity` kein Layout verschieben.

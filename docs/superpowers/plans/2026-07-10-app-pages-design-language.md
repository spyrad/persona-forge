# App-Seiten an Landing-Design-Sprache angleichen (Stufe A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard, Models, Personas, Runs (inkl. Detail/Compare) und Auth-Seiten übernehmen die Design-Sprache der Landing Page: Serif-Header mit Mono-Eyebrow, 6xl-Rahmen, kurzer Entrance-Reveal, englische Copy.

**Architecture:** Ein neues `AppLayout.astro` wrappt das bestehende `Layout.astro` und zentralisiert Geometrie (Topbar-breiter 6xl-Rahmen, linksbündige 3xl-Inhaltsspalte) und Header (Eyebrow/Serif-h1/Lead, `page-enter`-Animation). Fonts und Motion-CSS ziehen aus `index.astro` in `Layout.astro`/`global.css`, damit Landing und App dieselben Definitionen teilen. Die sieben Seiten stellen nur Markup um — Frontmatter-Logik (Supabase, `loadError`, 404) bleibt unangetastet.

**Tech Stack:** Astro 6 (SSR), Tailwind 4 (semantische Tokens), @fontsource (Instrument Serif, JetBrains Mono), shadcn/ui-Card. Keine neuen Dependencies.

**Spec:** `docs/superpowers/specs/2026-07-10-app-pages-design-language-design.md`

## Global Constraints

- **Branch:** Auf Feature-Branch `feat/app-design-language-a` arbeiten, NIE direkt auf `main` (Push auf `main` = Prod-Deploy). Am Ende PR durch den CI-Review-Agenten (`ai-review/verdict` ist Required Check).
- **Farben nur über semantische Tokens** (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-primary`, …) — keine Farb-Literale (`text-white`, `*-blue-*`). Tokens leben in `src/styles/global.css`.
- **Tailwind-Klassen via `cn()`** aus `@/lib/utils` mergen, wenn dynamisch — in Astro-Templates ist `class:list` das Idiom.
- **Copy der `.astro`-Seiten englisch** (verbindlich per Spec); React-Insel-Interna bleiben deutsch (Stufe B/C).
- **E2E-kritische Accessible Names erhalten:** `h1`-Texte „Sign in" (signin) und „Dashboard" (dashboard) dürfen sich NICHT ändern (`tests/e2e/*.spec.ts` prüft `getByRole("heading", { name: … })`).
- **Volles Lint lokal:** `npx eslint . --rule '{"prettier/prettier":"off"}'` (CRLF-Gotcha) — nie Teilmengen linten.
- **Commit-Messages:** Conventional Commits im Hausstil (deutsch), Footer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01MwJQ89VgKsVcqcH7DVrDbY`.
- Kein `page.waitForTimeout()`, keine CSS-Selektoren in E2E (falls Anpassung nötig würde — ist nicht geplant).
- Astro-Markup ist nicht unit-testbar im Vitest-Node-Setup des Projekts — Verifikation je Task ist `npm run build` (muss fehlerfrei durchlaufen) statt TDD-Zyklus; die volle Suite läuft in Task 7.

---

### Task 0: Feature-Branch anlegen

**Files:** keine

- [ ] **Step 1: Branch erstellen**

```bash
git -C . checkout -b feat/app-design-language-a
```

Expected: `Switched to a new branch 'feat/app-design-language-a'`

---

### Task 1: Fundament — Fonts global, Motion-CSS zentral

**Files:**

- Modify: `src/layouts/Layout.astro` (Font-Imports rein)
- Modify: `src/styles/global.css` (`.section-ruler`, `.reveal`, `.page-enter` rein)
- Modify: `src/pages/index.astro` (Font-Imports und `<style is:global>` raus)

**Interfaces:**

- Produces: globale CSS-Klassen `.section-ruler` (Ruler-Ticks, `position: absolute`, braucht relativen Parent), `.page-enter` (einmalige Entrance-Animation, respektiert `prefers-reduced-motion`), `.reveal`/`.js .reveal`/`.is-visible` (unverändert Landing-Scroll-Reveal). Fonts `--font-display`/`--font-mono` greifen ab jetzt auf jeder Seite.

- [ ] **Step 1: Font-Imports nach `Layout.astro` verschieben**

In `src/layouts/Layout.astro` das Frontmatter erweitern (erste Zeilen):

```astro
---
import "@fontsource/instrument-serif";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/jetbrains-mono";
import "../styles/global.css";
import Banner from "@/components/Banner.astro";
import Topbar from "@/components/Topbar.astro";
import { missingConfigs } from "@/lib/config-status";
---
```

In `src/pages/index.astro` die drei Import-Zeilen entfernen:

```astro
---
import Hero from "@/components/landing/Hero.astro";
import Problem from "@/components/landing/Problem.astro";
import Method from "@/components/landing/Method.astro";
import TestLibrary from "@/components/landing/TestLibrary.astro";
import Cta from "@/components/landing/Cta.astro";
import Layout from "@/layouts/Layout.astro";
---
```

- [ ] **Step 2: Motion-CSS nach `global.css` verschieben und `.page-enter` ergänzen**

In `src/pages/index.astro` den kompletten `<style is:global>…</style>`-Block löschen (das `<script>` mit dem IntersectionObserver bleibt!). In `src/styles/global.css` ans Dateiende anfügen:

```css
/* Ruler-Ticks unter einer Hairline — die Messinstrument-Metapher im
   Seitenskelett (Landing-Sektionen und App-Topbar). Position absolute:
   braucht einen relativen Parent mit Höhe. Farbe aus dem muted-Token. */
.section-ruler {
  position: absolute;
  inset-inline: 0;
  top: 0;
  height: 6px;
  background-image: repeating-linear-gradient(
    to right,
    color-mix(in oklab, var(--muted-foreground) 40%, transparent) 0 1px,
    transparent 1px 10%
  );
}

/* Scroll-Reveal der Landing: Startzustand nur mit JS ausblenden (`js`-Klasse
   auf <html>, siehe Layout.astro) — ohne JS bleibt der Inhalt sichtbar. */
.reveal {
  transition:
    opacity 0.6s ease,
    translate 0.6s ease;
}
.js .reveal {
  opacity: 0;
  translate: 0 12px;
}
.reveal.is-visible {
  opacity: 1;
  translate: 0 0;
}

/* Entrance-Reveal der App-Seiten-Header: zeitbasiert und CSS-only — läuft
   ohne JS und endet immer sichtbar, daher kein `.js`-Gating nötig. */
@media (prefers-reduced-motion: no-preference) {
  .page-enter {
    animation: page-enter 0.4s ease both;
  }
}
@keyframes page-enter {
  from {
    opacity: 0;
    translate: 0 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal,
  .js .reveal {
    opacity: 1;
    translate: none;
    transition: none;
  }
}
```

- [ ] **Step 3: Build prüfen**

Run: `npm run build`
Expected: exit 0, keine Astro/Tailwind-Fehler.

- [ ] **Step 4: Landing-Sichtprüfung**

Run: `npm run dev`, dann `http://localhost:4321/` öffnen.
Expected: Landing identisch zu vorher — Serif-Hero, Scroll-Reveal beim Scrollen, Ruler-Ticks an den Sektionsgrenzen. (Regression hier = CSS-Umzug fehlerhaft.)

- [ ] **Step 5: Commit**

```bash
git add src/layouts/Layout.astro src/styles/global.css src/pages/index.astro
git commit -m "refactor(styles): Fonts und Motion-CSS von der Landing in Layout/global.css zentralisieren"
```

---

### Task 2: `AppLayout.astro` + Topbar-Breite

**Files:**

- Create: `src/layouts/AppLayout.astro`
- Modify: `src/components/Topbar.astro` (eine Klasse)

**Interfaces:**

- Consumes: `Layout.astro` (Prop `title`), CSS-Klassen `.section-ruler`, `.page-enter` aus Task 1.
- Produces: `AppLayout` mit Props `title: string`, `eyebrow: string`, `heading: string`, `lead?: string`, `width?: "narrow" | "full"` (Default `"narrow"`). Slot = Seiteninhalt; bei `narrow` in linksbündiger `max-w-3xl`-Spalte.

- [ ] **Step 1: `src/layouts/AppLayout.astro` anlegen**

```astro
---
import Layout from "@/layouts/Layout.astro";

interface Props {
  title: string;
  eyebrow: string;
  heading: string;
  lead?: string;
  width?: "narrow" | "full";
}

const { title, eyebrow, heading, lead, width = "narrow" } = Astro.props;
---

<Layout title={title}>
  {
    /* Ruler-Ticks unter der Topbar — .section-ruler ist absolut positioniert,
      daher der relative 6px-Träger (h-1.5). */
  }
  <div class="relative h-1.5" aria-hidden="true">
    <div class="section-ruler"></div>
  </div>
  <main class="mx-auto max-w-6xl px-4 py-10 sm:py-14">
    <header class="page-enter mb-10">
      <p class="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">{eyebrow}</p>
      <h1 class="font-display text-foreground mt-4 text-4xl text-balance sm:text-5xl">{heading}</h1>
      {lead && <p class="text-muted-foreground mt-4 max-w-xl text-lg">{lead}</p>}
    </header>
    <div class:list={[width === "narrow" && "max-w-3xl"]}>
      <slot />
    </div>
  </main>
</Layout>
```

- [ ] **Step 2: Topbar auf den Landing-Rahmen verbreitern**

In `src/components/Topbar.astro`, Zeile 9: `max-w-5xl` → `max-w-6xl`:

```astro
<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4"></div>
```

- [ ] **Step 3: Build prüfen**

Run: `npm run build`
Expected: exit 0 (AppLayout ist noch unbenutzt — kompiliert nur mit).

- [ ] **Step 4: Commit**

```bash
git add src/layouts/AppLayout.astro src/components/Topbar.astro
git commit -m "feat(app-chrome): AppLayout mit Landing-Header-Sprache; Topbar auf 6xl-Rahmen"
```

---

### Task 3: Dashboard auf AppLayout + englische Copy

**Files:**

- Modify: `src/pages/dashboard.astro` (komplett ersetzen)

**Interfaces:**

- Consumes: `AppLayout` (Task 2), Props wie dort definiert.
- ACHTUNG: `heading` MUSS exakt `Dashboard` bleiben (E2E: `getByRole("heading", { name: "Dashboard" })`).

- [ ] **Step 1: `src/pages/dashboard.astro` ersetzen**

```astro
---
import AppLayout from "@/layouts/AppLayout.astro";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const { user } = Astro.locals;

const tiles = [
  { href: "/models", title: "Model configurations", description: "Manage LLM models and parameters" },
  { href: "/personas", title: "Personas", description: "Browse and curate the persona catalog" },
  { href: "/runs", title: "Runs", description: "Start and evaluate OEJTS measurement runs" },
];
---

<AppLayout
  title="Dashboard"
  eyebrow="01 — overview"
  heading="Dashboard"
  lead={`Signed in as ${user?.email ?? ""}`}
  width="full"
>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {
      tiles.map((tile) => (
        <a href={tile.href} class="group block focus-visible:outline-none">
          <Card className="h-full transition-colors group-hover:border-primary group-focus-visible:border-primary">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {tile.title}
                <span class="text-muted-foreground group-hover:text-primary transition-colors">→</span>
              </CardTitle>
              <CardDescription>{tile.description}</CardDescription>
            </CardHeader>
          </Card>
        </a>
      ))
    }
  </div>
</AppLayout>
```

- [ ] **Step 2: Build + Sichtprüfung**

Run: `npm run build`, dann `npm run dev` → einloggen → `/dashboard`.
Expected: Eyebrow `01 — overview`, Serif-„Dashboard", Lead mit E-Mail, Ruler unter der Topbar, Header gleitet einmal kurz herein, Kacheln im vollen 6xl-Rahmen. Wortmarke steht an derselben Stelle wie auf der Landing.

- [ ] **Step 3: Commit**

```bash
git add src/pages/dashboard.astro
git commit -m "feat(dashboard): AppLayout-Header und englische Copy"
```

---

### Task 4: Models + Personas auf AppLayout + englische Copy

**Files:**

- Modify: `src/pages/models.astro` (nur Template unter `---`)
- Modify: `src/pages/personas.astro` (nur Template unter `---`)

**Interfaces:**

- Consumes: `AppLayout` (Task 2).
- Frontmatter (Supabase-Load, `loadError`) beider Seiten bleibt byte-identisch — nur der Import `Layout` → `AppLayout` ändert sich dort.

- [ ] **Step 1: `src/pages/models.astro` — Import und Template ersetzen**

Im Frontmatter nur die erste Import-Zeile ändern:

```astro
import AppLayout from "@/layouts/AppLayout.astro";
```

Template (alles nach `---`) ersetzen durch:

```astro
<AppLayout
  title="Model configs"
  eyebrow="02 — model configs"
  heading="Model configs"
  lead={`OpenAI-compatible models for ${user?.email ?? ""}. API keys are stored encrypted and never shown again.`}
>
  <ModelConfigManager client:load initialConfigs={initialConfigs} loadError={loadError} />
</AppLayout>
```

- [ ] **Step 2: `src/pages/personas.astro` — Import und Template ersetzen**

Import-Zeile wie oben (`AppLayout`). Template ersetzen durch:

```astro
<AppLayout
  title="Personas"
  eyebrow="03 — personas"
  heading="Personas"
  lead={`Reusable cognitive profiles for ${user?.email ?? ""}. Personas are immutable — duplicating creates your own editable variant.`}
>
  <PersonaCatalog client:load initialPersonas={initialPersonas} loadError={loadError} />
</AppLayout>
```

- [ ] **Step 3: Build + Sichtprüfung**

Run: `npm run build`, dann im Dev-Server `/models` und `/personas` prüfen.
Expected: Beide Seiten mit Eyebrow/Serif/Lead; die React-Inseln (deutsch) rendern unverändert in der linksbündigen 3xl-Spalte.

- [ ] **Step 4: Commit**

```bash
git add src/pages/models.astro src/pages/personas.astro
git commit -m "feat(models,personas): AppLayout-Header und englische Copy"
```

---

### Task 5: Runs-Trio (Liste, Detail, Compare) auf AppLayout + englische Copy

**Files:**

- Modify: `src/pages/runs.astro` (Import + Template)
- Modify: `src/pages/runs/[id].astro` (Import, `resultSubtitle`, Template)
- Modify: `src/pages/runs/compare.astro` (Import, `notReadyReason`/`parts`, Template)

**Interfaces:**

- Consumes: `AppLayout` (Task 2).
- Fehlerpfad-LOGIK (`loadError`, `notFound`, `PageState`) bleibt identisch; nur sichtbare Strings werden englisch.

- [ ] **Step 1: `src/pages/runs.astro` — Import und Template ersetzen**

Import-Zeile: `import AppLayout from "@/layouts/AppLayout.astro";`

Template ersetzen durch:

```astro
<AppLayout
  title="Runs"
  eyebrow="04 — measurement runs"
  heading="Runs"
  lead={`OEJTS measurement runs for ${user?.email ?? ""}. Each repetition is an isolated session, driven step by step in the browser.`}
>
  <RunRunner
    client:load
    initialRuns={initialRuns}
    personas={personas}
    modelConfigs={modelConfigs}
    loadError={loadError}
  />
</AppLayout>
```

- [ ] **Step 2: `src/pages/runs/[id].astro` — Subtitle englisch, Template ersetzen**

Import-Zeile: `import AppLayout from "@/layouts/AppLayout.astro";`

`resultSubtitle`-Block im Frontmatter ersetzen durch:

```ts
// Untertitel je Test-Typ (run.kind ist immer gesetzt, auch bei unfertigen Läufen).
const resultSubtitle =
  result?.run.kind === "steadfastness"
    ? "Steadfastness (manipulation resistance): capitulation rate across experiments plus strategy breakdown."
    : "OEJTS distribution per axis across repetitions plus the derived type.";
```

Template ersetzen durch:

```astro
<AppLayout title="Run result" eyebrow="04 — run result" heading="Run result" lead={resultSubtitle}>
  {
    loadError ? (
      <p class="border-destructive/30 bg-destructive/10 text-destructive rounded-2xl border px-4 py-5 text-sm">
        Could not load the result. Please reload.
      </p>
    ) : notFound ? (
      <div class="space-y-4">
        <p class="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-5 text-sm">Run not found.</p>
        <a href="/runs" class="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm">
          ← Back to runs
        </a>
      </div>
    ) : (
      result && <RunResult client:load result={result} />
    )
  }
</AppLayout>
```

- [ ] **Step 3: `src/pages/runs/compare.astro` — sichtbare Strings englisch, Template ersetzen**

Import-Zeile: `import AppLayout from "@/layouts/AppLayout.astro";`

`notReadyReason` ersetzen durch:

```ts
/** Explanation for a run that is not comparable (not `ready`). */
function notReadyReason(result: RunResultView): string {
  return result.state === "unfinished" ? "is not finished yet" : "produced no usable repetitions";
}
```

Im `notReady`-Zweig die beiden `parts.push`-Zeilen ersetzen durch:

```ts
if (ra.state !== "ready") parts.push(`Run A ${notReadyReason(ra)}`);
if (rb.state !== "ready") parts.push(`Run B ${notReadyReason(rb)}`);
```

In `resolveSide` die Fallback-Labels ersetzen:

```ts
personaName: persona?.name ?? (run.personaId ? "(unknown)" : "(deleted)"),
modelLabel: model?.label ?? (run.modelConfigId ? "(unknown)" : "(deleted)"),
```

Template ersetzen durch:

```astro
<AppLayout
  title="Compare runs"
  eyebrow="04 — comparison"
  heading="Compare runs"
  lead="Two completed OEJTS runs side by side — distribution per axis with their spreads."
>
  {
    pageState === "loadError" ? (
      <p class="border-destructive/30 bg-destructive/10 text-destructive rounded-2xl border px-4 py-5 text-sm">
        Could not load the comparison. Please reload.
      </p>
    ) : pageState === "missing" ? (
      <p class="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-5 text-sm">
        Select two runs to compare — use the “Compare” checkboxes in the runs list.
      </p>
    ) : pageState === "same" ? (
      <p class="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-5 text-sm">
        Select two <em>different</em> runs — a run cannot be compared with itself.
      </p>
    ) : pageState === "notFound" ? (
      <p class="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-5 text-sm">
        At least one of the runs was not found (deleted or not visible).
      </p>
    ) : pageState === "notReady" ? (
      <p class="border-chart-2/40 bg-chart-2/10 text-chart-2 rounded-2xl border px-4 py-5 text-sm">
        Not comparable: {notReadyDetail}. Only completed runs with usable repetitions can be compared.
      </p>
    ) : view ? (
      <RunComparison view={view} />
    ) : null
  }

  <a href="/runs" class="text-primary hover:text-primary/80 mt-6 inline-flex items-center gap-1 text-sm">
    ← Back to runs
  </a>
</AppLayout>
```

Hinweis: der erklärende Kommentar über `<RunComparison view={view} />` („rein präsentational → statisch gerendert, keine Hydration") darf gern erhalten bleiben.

- [ ] **Step 4: Build + Sichtprüfung**

Run: `npm run build`, dann `/runs`, ein Lauf-Detail und `/runs/compare?a=…&b=…` (sowie `/runs/compare` ohne Parameter für den `missing`-State) prüfen.
Expected: Header-Sprache überall; Fehlerzustände englisch; `RunRunner`/`RunResult`/`RunComparison` rendern unverändert.

- [ ] **Step 5: Commit**

```bash
git add src/pages/runs.astro "src/pages/runs/[id].astro" src/pages/runs/compare.astro
git commit -m "feat(runs): AppLayout-Header und englische Copy fuer Liste, Detail und Vergleich"
```

---

### Task 6: Auth-Seiten — Serif-Handschrift, Eyebrow, SVG statt Emoji

**Files:**

- Modify: `src/pages/auth/signin.astro`
- Modify: `src/pages/auth/signup.astro`
- Modify: `src/pages/auth/confirm-email.astro`

**Interfaces:**

- Consumes: nur `Layout.astro` (zentrierte Karte bleibt, KEIN AppLayout).
- ACHTUNG: `h1`-Text „Sign in" MUSS exakt erhalten bleiben (E2E).

- [ ] **Step 1: `src/pages/auth/signin.astro` — Karte umbauen**

Den inneren Karten-Anfang (Zeilen 10–11) ersetzen durch:

```astro
<div class="border-border bg-card text-foreground w-full max-w-sm rounded-2xl border p-8">
  <p class="text-muted-foreground mb-2 text-center font-mono text-xs tracking-[0.2em] uppercase">account</p>
  <h1 class="font-display text-foreground mb-6 text-center text-3xl">Sign in</h1>
</div>
```

- [ ] **Step 2: `src/pages/auth/signup.astro` — identisches Muster**

Zeilen 10–11 ersetzen durch:

```astro
<div class="border-border bg-card text-foreground w-full max-w-sm rounded-2xl border p-8">
  <p class="text-muted-foreground mb-2 text-center font-mono text-xs tracking-[0.2em] uppercase">account</p>
  <h1 class="font-display text-foreground mb-6 text-center text-3xl">Sign up</h1>
</div>
```

- [ ] **Step 3: `src/pages/auth/confirm-email.astro` — Emoji → SVG, Serif-h1**

Frontmatter: im `content`-Objekt die `emoji`-Property entfernen (beide Zweige). Template ersetzen durch:

```astro
<Layout title={content.heading}>
  <div class="flex min-h-screen items-center justify-center p-4">
    <div class="border-border bg-card text-foreground w-full max-w-sm rounded-2xl border p-8 text-center">
      {
        isAutoConfirmed ? (
          <svg
            class="text-primary mx-auto mb-4 h-10 w-10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12.5 2.5 2.5 4.5-5" />
          </svg>
        ) : (
          <svg
            class="text-primary mx-auto mb-4 h-10 w-10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        )
      }
      <p class="text-muted-foreground mb-2 font-mono text-xs tracking-[0.2em] uppercase">account</p>
      <h1 class="font-display text-foreground mb-3 text-3xl">
        {content.heading}
      </h1>
      <p class="text-muted-foreground mb-6">{content.description}</p>
      <a href="/auth/signin" class="text-primary text-sm hover:underline">
        {content.linkText}
      </a>
    </div>
  </div>
</Layout>
```

- [ ] **Step 4: Build + Sichtprüfung**

Run: `npm run build`, dann `/auth/signin`, `/auth/signup`, `/auth/confirm-email` im Dev-Server.
Expected: Serif-Titel + Mono-Eyebrow in der Karte; confirm-email zeigt Teal-SVG (Check im Dev-Modus, da `isAutoConfirmed = import.meta.env.DEV`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/auth/signin.astro src/pages/auth/signup.astro src/pages/auth/confirm-email.astro
git commit -m "feat(auth): Serif-Handschrift, Mono-Eyebrow und SVG-Ikonografie statt Emoji"
```

---

### Task 7: Volle Verifikation + PR

**Files:** keine neuen Änderungen (nur Fixes, falls Checks scheitern)

- [ ] **Step 1: Unit-Tests**

Run: `npm run test`
Expected: alle grün (kein Test berührt Seiten-Markup).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: CI-äquivalentes Lint**

Run: `npx eslint . --rule '{"prettier/prettier":"off"}'`
Expected: 0 Errors. (Volles `npm run lint` erstickt lokal an CRLF — nicht verwenden.)

- [ ] **Step 4: E2E**

Voraussetzung: lokales Supabase läuft (`npx supabase start`, `.env.test` gemäß `.env.test.example` aus `npx supabase status` befüllt).

Run: `npm run test:e2e`
Expected: alle grün — die geprüften Headings „Sign in" und „Dashboard" existieren unverändert.

- [ ] **Step 5: Manuelle Sichtprüfung (User einbeziehen)**

Im Dev-Server alle sieben Seiten (`/dashboard`, `/models`, `/personas`, `/runs`, `/runs/[id]`, `/runs/compare`, `/auth/*`) in **Light und Dark** durchklicken; einmal mit OS-Einstellung „Bewegung reduzieren" (Header darf dann nicht animieren). Übergang Landing → Signup → Dashboard auf Kohärenz prüfen (Wortmarken-Position, Schrift, Ruler).

- [ ] **Step 6: Push + PR**

```bash
git push -u origin feat/app-design-language-a
gh pr create --title "feat(app): App-Seiten an Landing-Design-Sprache angleichen (Stufe A)" --body "Spec: docs/superpowers/specs/2026-07-10-app-pages-design-language-design.md

- Fonts + Motion-CSS zentralisiert (Layout.astro / global.css)
- Neues AppLayout: 6xl-Rahmen, Eyebrow/Serif-Header, page-enter-Reveal, narrow/full-Spalte
- Dashboard, Models, Personas, Runs (Liste/Detail/Compare) umgestellt, Copy englisch
- Auth-Seiten: Serif + Eyebrow, SVG statt Emoji
- React-Inseln unverändert (Stufe B/C)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01MwJQ89VgKsVcqcH7DVrDbY"
```

Expected: PR offen; `ai-review/verdict` läuft als Required Check. Merge erst nach grünem Verdict (und PR #3-Muster: Squash-Merge, danach lokal `git reset --hard origin/main` statt `git pull`).

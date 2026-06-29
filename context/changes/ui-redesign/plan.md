# UI-Vereinheitlichung (Token-System, Teal, Topbar, Dark Mode) — Implementation Plan

## Overview

persona-forge fährt heute zwei konkurrierende Design-Sprachen: ein hartkodiertes „Cosmic"-Theme (dunkler Verlauf, Glassmorphism, blau-lila Gradienten) auf den Seiten und ein neutral-graues shadcn-Token-System in den UI-Komponenten, das nirgends wirklich genutzt wird. Dieser Change macht **die shadcn/Tailwind-Tokens zur alleinigen Design-Wahrheit** (hell-first, ein Teal/Emerald-Akzent), ersetzt alle ~166 Farb-Literale durch semantische Tokens, baut eine durchgängige Topbar mit Hub-Dashboard und aktiviert einen **vollwertigen Dark Mode** (heute toter Code) mit Umschalter.

## Current State Analysis

- **Token-System vorhanden, ungenutzt:** `src/styles/global.css` definiert Light- **und** Dark-Tokens (`:root` / `.dark`) plus `@theme inline`-Mapping (Tailwind 4, CSS-first; keine `tailwind.config`). `--primary` ist aktuell Schwarz (`oklch(0.205 0 0)`).
- **Dark Mode = toter Code:** `@custom-variant dark (&:is(.dark *))` ist da, aber `.dark` wird **nirgends** gesetzt. Kein No-Flash-Script, kein Toggle, keine Persistenz. (Belegt: nur `global.css` definiert `.dark`, nur `RunRunner.tsx` nutzt eine `dark:`-Utility.)
- **~166 Farb-Literale über ~25 Dateien.** Schwer: `PersonaCatalog.tsx` (704 Z.), `RunRunner.tsx` (658 Z.), `ModelConfigManager.tsx` (379 Z.), `RunResult.tsx`, `RunComparison.tsx`, `Welcome.astro`. Leicht: alle Seiten, Auth-Komponenten, `Topbar.astro`, `axis-chart.tsx`, `LibBadge.astro`.
- **shadcn-Bestand:** nur `src/components/ui/button.tsx`. **`Card` fehlt** (für Hub-Kacheln nötig). `components.json`: style `new-york`, `baseColor: neutral`, `cssVariables: true`, `iconLibrary: lucide`. Alle Deps für den Umbau sind da (`lucide-react`, `class-variance-authority`, `tailwind-merge`, `tw-animate-css`) — einzige Neu-Installation: `npx shadcn add card`.
- **Charts:** `axis-chart.tsx` ist generisch; nur die Aufrufer `RunResult` (eine Serie) und `RunComparison` (zwei Serien, heute Lila vs. Cyan) reichen Farb-Klassen (`dotClass`/`meanClass`) rein. Cutoff-Linie heute Amber.
- **Navigation:** `Topbar.astro` zeigt nur Dashboard/Sign-out; jede Sicht hat ein eigenes „← Dashboard"-Geflicke. Kein durchgängiges Nav.
- **Test-Risiko niedrig:** E2E-Selektoren (`tests/e2e/*.spec.ts`) sind rollenbasiert (`getByRole`/`getByLabel`) → brechen nicht. **Keine** Unit-/Snapshot-Tests auf UI-Komponenten. `Banner.astro` nutzt rohes CSS mit Hex-Werten (Sonderfall).
- **Layout-Reste:** `Layout.astro` Titel-Default ist `"10x Astro Starter"`, `<html lang="en">`, kein No-Flash-Script.

## Desired End State

Jede Sicht der App rendert in einem konsistenten, hellen, datengetriebenen Look mit Teal-Akzent; ein Klick auf den Topbar-Toggle schaltet flackerfrei in einen ebenso konsistenten Dark Mode, die Wahl überlebt Reloads. Keine Sicht enthält noch ein Farb-Literal — alle Farben kommen aus den Tokens. Die Topbar ist auf jeder Seite präsent (Logo → Dashboard, User + Sign-out + Theme-Toggle rechts); das Dashboard ist der Hub mit Card-Kacheln. Build, Lint, Unit-, Integration- und E2E-Tests sind grün.

**Verifikation:** `npm run build` + `npm run test` + `npm run test:integration` + `npm run test:e2e` grün; `npm run lint` sauber; ein Grep über `src/` findet keine Farb-Literale mehr (siehe Phase 6); manueller Durchgang durch jede Sicht in **beiden** Modi ohne Glas-/Gradient-/Weißtext-Reste.

### Key Discoveries:

- Tailwind 4 CSS-first: Tokens in `:root`/`.dark`, gemappt via `@theme inline` in `src/styles/global.css:75` — `dark:`-Utilities funktionieren, sobald `.dark` auf `<html>` liegt (`global.css:4`).
- Farb-Klassen werden als Strings an `AxisChart` durchgereicht (`axis-chart.tsx:33` `dotClass`/`meanClass`) → Serienfarben sind reine Aufrufer-Sache (`RunResult.tsx`, `RunComparison.tsx:13`).
- `components.json` `iconLibrary: lucide` + `lucide-react` vorhanden → Sonne/Mond fürs Toggle ohne Neu-Install.
- Astro braucht für das No-Flash-Script `<script is:inline>` im `<head>`, sonst wird es gebündelt/deferred und der Flash bleibt.

## What We're NOT Doing

- **Keine** funktionalen/Daten-/Layout-Logik-Änderungen — reines Visual/Token-Refactoring + Navigation.
- **Keine** weiteren shadcn-Komponenten außer `Card`. Formulare (`FormField` etc.) behalten ihre rohen `<input>`-Struktur, werden nur token-isiert — **kein** `Input`/`Select`/`Dialog`-Rollout.
- **Keine** Änderung an der `AxisChart`-Render-Engine (bleibt generisch); nur die Aufrufer wechseln Farben.
- **Kein** Umbau der Auth-/Business-Flows, keine Responsive-Überarbeitung über das hinaus, was die neuen Komponenten ohnehin mitbringen.
- **Keine** neuen Tests-Frameworks; vorhandene Tests bleiben maßgeblich (nur grün halten).

## Implementation Approach

Bottom-up: erst das Fundament (Tokens + Dark-Mode-Infrastruktur), das alles andere trägt, dann die gemeinsame Shell (Topbar/Layout/Dashboard), dann der mechanische Sweep der Sichten, dann die Charts (eigene Farbsorgfalt), dann Auth/Landing, zuletzt eine Voll-Verifikation in beiden Modi. Die semantischen Tokens sorgen dafür, dass Dark Mode „umsonst" mitkommt, solange kein Literal verwendet wird — deshalb ist die Literal→Token-Disziplin der rote Faden jeder Phase.

## Critical Implementation Details

- **No-Flash-Reihenfolge:** Das Inline-Script muss im `<head>` **vor** dem `<body>` laufen und `.dark` synchron auf `document.documentElement` setzen, bevor gerendert wird. Die `ThemeToggle`-Insel liest ihren Initialzustand beim Mount aus `document.documentElement.classList` (nicht aus eigenem State), sonst entsteht ein Hydration-Mismatch, weil der SSR-Server den Modus nicht kennt.
- **`bg-cosmic`-Entfernung:** Die `@utility bg-cosmic` wird in Phase 1 aus `global.css` entfernt; bis der Sweep (Phasen 3/5) durch ist, rendern noch nicht umgestellte Seiten ohne Hintergrund. Das ist ein erwarteter Zwischenzustand innerhalb des Change-Branches (wird nie einzeln deployt) — die finale Grep-Sauberkeit prüft Phase 6.
- **Cutoff vs. Serie B:** Da Amber künftig Serie B (`--chart-2`) markiert, darf die Cutoff-Linie nicht mehr Amber sein — sie wird auf ein neutrales, gestricheltes `muted-foreground`-Token umkodiert.

## Phase 1: Token-Fundament & Dark-Mode-Infrastruktur

### Overview

Die Tokens auf Teal umstellen, eine kohärente Chart-Palette definieren, `Card` installieren und den Dark Mode tatsächlich verdrahten (No-Flash-Script, Toggle, Persistenz). Nach dieser Phase funktioniert das Umschalten, und alle Bausteine für die folgenden Sweeps stehen.

### Changes Required:

#### 1. Farb-Tokens & Chart-Palette

**File**: `src/styles/global.css`

**Intent**: `--primary`, `--ring`, `--sidebar-primary` (und deren `-foreground`) in `:root` und `.dark` auf einen Teal/Emerald-Wert setzen; die `--chart-*`-Tokens zu einer kohärenten Palette machen, in der `--chart-1` = Teal (Serie A / Single) und `--chart-2` = Amber (Serie B). `@utility bg-cosmic` (Z. 113) entfernen.

**Contract**: OKLCH-Werte, Light z. B. `--primary: oklch(0.70 0.12 180)` mit `--primary-foreground: oklch(0.985 0 0)`; Dark eine hellere Teal-Stufe (~`oklch(0.78 0.12 180)`). `--chart-1` an Primary angelehnt, `--chart-2` warmes Amber (~`oklch(0.80 0.16 80)`). Neutrale Basis (`--background`/`--card`/`--border`/`--muted*`) unverändert lassen. Die `@theme inline`-Mappings (Z. 75–111) bleiben strukturell, da sie auf die Variablen zeigen.

#### 2. Card-Komponente

**File**: `src/components/ui/card.tsx` (neu)

**Intent**: shadcn-`Card` (new-york) für die Dashboard-Hub-Kacheln und Sicht-Container bereitstellen.

**Contract**: `npx shadcn@latest add card` ausführen (`NODE_OPTIONS=--use-system-ca` beachten, siehe CLAUDE.md-Gotcha bei TLS-Interception). Erwartete Exports: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.

#### 3. No-Flash-Script & Layout-Head

**File**: `src/layouts/Layout.astro`

**Intent**: Ein `<script is:inline>` in den `<head>` setzen, das vor dem Render `localStorage.theme` (Fallback `prefers-color-scheme`) liest und `.dark` auf `document.documentElement` setzt. Titel-Default `"10x Astro Starter"` → `"persona-forge"`. `<html>` auf eine sinnvolle Grundklasse (`bg-background text-foreground` greift schon via `@layer base`).

**Contract**: Reihenfolge im `<head>` zwingend vor sichtbarem Inhalt. Script liest Key `theme` mit Werten `"light"|"dark"`; ohne Key → `matchMedia("(prefers-color-scheme: dark)")`.

```html
<script is:inline>
  const t = localStorage.getItem("theme");
  const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
</script>
```

#### 4. ThemeToggle-Insel

**File**: `src/components/ThemeToggle.tsx` (neu)

**Intent**: React-Insel mit lucide `Sun`/`Moon`, die `.dark` auf `document.documentElement` umschaltet und die Wahl in `localStorage.theme` schreibt. Initialzustand beim Mount aus `document.documentElement.classList` lesen (kein SSR-State).

**Contract**: Default-Export `ThemeToggle`, als `client:load`-Insel in der Topbar nutzbar. Nutzt `Button` (`variant="ghost"`, `size="icon"`) + `cn`. Schreibt `localStorage.setItem("theme", next)`.

### Success Criteria:

#### Automated Verification:

- `src/components/ui/card.tsx` existiert
- `npm run build` erfolgreich
- `npm run test` grün
- `npm run lint` sauber (ggf. nach `npm run lint:fix`)

#### Manual Verification:

- Toggle schaltet live zwischen Hell/Dunkel und überlebt einen Reload
- Beim Reload im Dark Mode kein weißer Flash
- `--primary` erscheint sichtbar als Teal (z. B. an einem `Button`)

**Implementation Note**: Nach dieser Phase und grüner Automatik-Verifikation auf manuelle Bestätigung warten, bevor Phase 2 beginnt.

---

## Phase 2: Topbar + Layout-Shell + Dashboard-Hub

### Overview

Eine durchgängige, token-basierte Topbar bauen und ins Layout integrieren; das Dashboard zum Card-Kachel-Hub machen. Danach gibt es auf jeder Seite konsistente Navigation und einen sauberen Einstieg.

### Changes Required:

#### 1. Topbar neu

**File**: `src/components/Topbar.astro`

**Intent**: Token-basierte, persistente Leiste: links klickbares Logo „persona-forge" → `/dashboard`; rechts User-E-Mail (falls eingeloggt) + Sign-out-Form + `ThemeToggle`. Im Nicht-eingeloggt-Fall Sign-in/Sign-up-Links. Alle Farb-Literale (`bg-white/5`, `text-blue-100/70`, `text-purple-300` …) durch `bg-card`/`text-foreground`/`text-muted-foreground`/`text-primary` ersetzen.

**Contract**: `ThemeToggle` als `client:load` eingebunden. Aktiver Zustand optional via Vergleich `Astro.url.pathname`. Sign-out bleibt `<form method="POST" action="/api/auth/signout">`.

#### 2. Topbar ins Layout heben

**File**: `src/layouts/Layout.astro`

**Intent**: `Topbar` einmal zentral im Layout über dem `<slot />` rendern (statt pro Seite), sodass jede Sicht die Nav erbt und das per-Seite-„← Dashboard" entfallen kann. Bestehendes `missingConfigs`-Banner bleibt darüber.

**Contract**: `Topbar` erhält den `user` aus `Astro.locals` weiterhin selbst (liest `Astro.locals.user`). Container-Breite/Padding konsistent.

#### 3. Dashboard als Hub

**File**: `src/pages/dashboard.astro`

**Intent**: Glas-Box + Gradient-Headline durch `Card`-basiertes Layout ersetzen; die drei Ziel-Links (Models/Personas/Läufe) als `Card`-Kacheln mit Teal-Akzent-Hover. Per-Seite-Sign-out entfällt (jetzt in Topbar). Alle Literale → Tokens.

**Contract**: Nutzt `Card`-Komponenten + `Button`/`a`. Kein `bg-cosmic`, kein `backdrop-blur`, keine Gradient-Text-Klassen.

### Success Criteria:

#### Automated Verification:

- `npm run build` erfolgreich
- `npm run lint` sauber

#### Manual Verification:

- Topbar erscheint auf allen App-Seiten; Logo führt zum Dashboard
- Theme-Toggle in der Topbar funktioniert von jeder Seite aus
- Dashboard-Kacheln navigieren korrekt und sehen in beiden Modi stimmig aus
- Kein doppeltes „← Dashboard" mehr nötig

**Implementation Note**: Nach grüner Automatik-Verifikation auf manuelle Bestätigung warten, bevor Phase 3 beginnt.

---

## Phase 3: App-Sichten-Sweep

### Overview

Der mechanische Hauptteil: alle App-Sichten und ihre React-Inseln von Farb-Literalen auf Tokens umstellen und handgebaute Buttons/Links auf die shadcn-`Button`-Varianten heben. (Die Chart-internen Serienfarben behandelt Phase 4.)

### Changes Required:

#### 1. Run-Sichten + Inseln

**File**: `src/pages/runs.astro`, `src/pages/runs/[id].astro`, `src/pages/runs/compare.astro`, `src/components/runs/RunRunner.tsx`, `src/components/runs/RunResult.tsx`, `src/components/runs/RunComparison.tsx`

**Intent**: Literale (`bg-cosmic`, `text-white`, `bg-white/*`, `border-white/*`, `text-blue-100/*`, `text-red-*`, `text-amber-*`, Gradient-Headlines, `backdrop-blur*`) auf semantische Tokens mappen (`bg-background`/`bg-card`/`bg-muted`, `text-foreground`/`text-muted-foreground`, `border-border`, `text-destructive`, `bg-input`). Handgebaute Buttons/Links → `Button`-Varianten. Per-Seite-„← Dashboard" entfernen (Topbar deckt das ab).

**Contract**: Standard-Mapping-Tabelle (siehe Migration Notes) konsistent anwenden. Fokus-Ringe `focus:ring-purple-400` → `focus-visible:ring-ring`. Status-/Warn-Hervorhebungen auf `--chart-*`/`--destructive`/`--muted` statt blue/amber-Literale.

#### 2. Personas-Sicht + Insel

**File**: `src/pages/personas.astro`, `src/components/personas/PersonaCatalog.tsx`

**Intent**: Dito — die dichteste Insel (≈47 Literale). Such-/Filter-Inputs, Karten, Badges, Selektionszustände (`border-purple-400`, `bg-purple-500/30`) auf Tokens (`border-primary`, `bg-primary/15`, `ring-ring`).

**Contract**: Selektions-/Aktiv-Zustände nutzen `--primary`; Platzhalter `placeholder-white/40` → `placeholder:text-muted-foreground`.

#### 3. Models-Sicht + Insel

**File**: `src/pages/models.astro`, `src/components/models/ModelConfigManager.tsx`

**Intent**: Dito — Container, Fehler-/Erfolgszustände, Buttons token-isieren; Fehler-Panel (`border-red-500/30 bg-red-900/30 text-red-300`) → `border-destructive/30 bg-destructive/10 text-destructive`.

**Contract**: `Button`-Varianten für Aktionen; Modal-/Panel-Hintergründe `bg-card` statt `bg-white/5 backdrop-blur`.

### Success Criteria:

#### Automated Verification:

- `npm run build` erfolgreich
- `npm run test` grün
- `npm run lint` sauber

#### Manual Verification:

- Jede der fünf Sichten in **beiden** Modi geprüft: keine Weißtext-/Glas-/Gradient-Reste
- Run-Erstellen/-Treiben (RunRunner) funktional unverändert, Zustände (laufend/Fehler/Warnung) klar erkennbar
- Personas-Suche/-Auswahl und Model-Config-CRUD optisch konsistent und bedienbar

**Implementation Note**: Nach grüner Automatik-Verifikation auf manuelle Bestätigung warten, bevor Phase 4 beginnt.

---

## Phase 4: Charts auf Tokens

### Overview

`AxisChart` und seine zwei Aufrufer auf die Chart-Tokens umstellen: eine Serie = Teal, Vergleich = Teal (A) + Amber (B), Cutoff-Linie neutral umkodiert.

### Changes Required:

#### 1. AxisChart-Primitive

**File**: `src/components/runs/axis-chart.tsx`

**Intent**: Die chart-eigenen Literale (`border-white/10`, `bg-white/5`, `text-amber-200/70`, `text-blue-100/*`) auf Tokens mappen; insbesondere die **Cutoff-Linie** von Amber auf ein neutrales, gestricheltes `muted-foreground`-Token, damit Amber eindeutig Serie B bleibt.

**Contract**: Cutoff: `border-amber-300/50` + `text-amber-200/70` → `border-muted-foreground/40` (dashed beibehalten) + `text-muted-foreground`. Achsenbeschriftung `text-blue-100/60` → `text-muted-foreground`. Feld-Rahmen → `border-border bg-muted/30`.

#### 2. Serienfarben der Aufrufer

**File**: `src/components/runs/RunResult.tsx`, `src/components/runs/RunComparison.tsx`

**Intent**: Die an `AxisChart` übergebenen `dotClass`/`meanClass` auf Chart-Tokens setzen. `RunResult` (eine Serie) = `--chart-1` (Teal). `RunComparison`: Serie A = `--chart-1` (Teal), Serie B = `--chart-2` (Amber); die A/B-Legende entsprechend anpassen.

**Contract**: `dotClass: "bg-chart-1"`, `meanClass: "border-chart-1"` (A); `bg-chart-2`/`border-chart-2` (B). Legenden-Swatches (`bg-purple-400`/`bg-cyan-300`) ebenso auf `bg-chart-1`/`bg-chart-2`.

### Success Criteria:

#### Automated Verification:

- `npm run build` erfolgreich
- `npm run test` grün

#### Manual Verification:

- Einzel-Lauf-Chart zeigt Teal-Punkte + neutrale, gestrichelte Cutoff-Linie
- Vergleich zeigt zwei klar unterscheidbare Serien (Teal vs. Amber) in beiden Modi; Legende stimmt mit den Serienfarben überein
- Cutoff-Linie ist nicht mehr mit Serie B verwechselbar

**Implementation Note**: Nach grüner Automatik-Verifikation auf manuelle Bestätigung warten, bevor Phase 5 beginnt.

---

## Phase 5: Auth + Landing

### Overview

Die letzten Alt-Look-Inseln angleichen: Auth-Seiten und -Komponenten token-isieren, die Landing (`Welcome.astro`) als cleanen, hellen Hero neu komponieren, `Banner`/`LibBadge` auf Tokens.

### Changes Required:

#### 1. Auth-Komponenten & -Seiten

**File**: `src/components/auth/FormField.tsx`, `src/components/auth/SubmitButton.tsx`, `src/components/auth/ServerError.tsx`, `src/components/auth/PasswordToggle.tsx`, `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Literale auf Tokens mappen; `SubmitButton` (hartes `bg-purple-600`) auf `Button`/`bg-primary`; Input-Felder `bg-white/10 border-white/20 focus:ring-purple-400` → `bg-input border-border focus-visible:ring-ring`; `ServerError` rot-Literale → `destructive`-Tokens. Struktur der Formulare bleibt (kein shadcn-`Input`-Rollout).

**Contract**: Gradient-Headlines der Auth-Seiten → solide `text-foreground` mit optionalem Teal-Akzent. `placeholder-white/40` → `placeholder:text-muted-foreground`.

#### 2. Landing-Hero neu

**File**: `src/components/Welcome.astro`

**Intent**: Den Cosmic-Hero (Blur-Orbs, via/from/to-Gradient, `bg-purple-600`-CTA) durch einen ruhigen, hellen Hero im Teal-System ersetzen: klare Typo, ein Teal-Akzent-CTA, kein Glas/keine Orbs.

**Contract**: CTA als `Button` (`variant="default"`). Keine `blur-[*]`/`bg-*-500/*`-Orbs, keine Gradient-Text-Klassen.

#### 3. Banner & LibBadge

**File**: `src/components/Banner.astro`, `src/components/ui/LibBadge.astro`

**Intent**: `Banner` nutzt heute rohe Hex-Werte in einem `<style>`-Block — auf Token-basierte Utility-Klassen umstellen (Varianten `error`/`info` → `destructive`/`muted`/`primary`). `LibBadge`-Literale (`bg-blue-900/50`, `bg-purple-500/30`) → Tokens.

**Contract**: `Banner`-Varianten-API bleibt (`variant="error"` etc.), nur die Farbquelle wechselt auf Tokens.

### Success Criteria:

#### Automated Verification:

- `npm run build` erfolgreich
- `npm run test` grün
- `npm run lint` sauber

#### Manual Verification:

- Sign-in/Sign-up/Confirm-Email in beiden Modi konsistent; Formularfehler (`ServerError`) klar sichtbar
- Landing-Hero wirkt clean/hell, kein Cosmic-Rest
- `missingConfigs`-Banner rendert in beiden Modi lesbar

**Implementation Note**: Nach grüner Automatik-Verifikation auf manuelle Bestätigung warten, bevor Phase 6 beginnt.

---

## Phase 6: Verifikation & Politur

### Overview

Voll-Verifikation: alle Test-Suites, ein Grep-Beweis der Literal-Freiheit und ein vollständiger visueller Durchgang in beiden Modi.

### Changes Required:

#### 1. Literal-Sauberkeit

**File**: (kein Code — Verifikationsschritt; Reste fixen, wo der Grep anschlägt)

**Intent**: Sicherstellen, dass keine Farb-Literale und kein `bg-cosmic` mehr in `src/` existieren; verbleibende Treffer beheben.

**Contract**: Grep über `src/**/*.{astro,tsx,ts}` nach `bg-cosmic|text-white|bg-white/|border-white/|text-(blue|purple|amber|red|cyan|indigo|pink|slate|gray|zinc)-[0-9]|bg-gradient-to-|bg-clip-text` liefert keine Treffer (legitime `dark:`/Token-Utilities ausgenommen).

#### 2. Doku-Abgleich

**File**: `CLAUDE.md` (nur falls nötig)

**Intent**: Falls ein neuer Gotcha entsteht (z. B. No-Flash-Script-Pflicht, ThemeToggle-Hydration), kurz notieren.

**Contract**: Höchstens 1–2 Zeilen; nur wenn nicht-offensichtlich.

### Success Criteria:

#### Automated Verification:

- Grep nach Farb-Literalen über `src/` ist leer (siehe Contract oben)
- `npm run build` erfolgreich
- `npm run test` grün
- `npm run test:integration` grün
- `npm run test:e2e` grün
- `npm run lint` sauber

#### Manual Verification:

- Jede Sicht (Landing, Auth, Dashboard, Models, Personas, Runs, Run-Detail, Compare) in **Hell und Dunkel** durchgeklickt — durchgängig konsistent, keine Alt-Look-Reste, ausreichende Kontraste
- Theme-Wahl persistiert über Reloads und Seitenwechsel
- Keine funktionalen Regressionen (Auth, Run-Treiben, CRUD)

---

## Testing Strategy

### Unit Tests:

- Bestehende `npm run test` (Vitest, `src/**/*.test.ts`) müssen grün bleiben — sie testen `lib/services`, nicht UI, also kein Anpassungsbedarf erwartet.

### Integration Tests:

- `npm run test:integration` gegen lokales Supabase grün halten (keine UI-Berührung, reine Absicherung gegen Kollateralschäden).

### Manual Testing Steps:

1. Jede Sicht in Hell **und** Dunkel öffnen; auf Weißtext-/Glas-/Gradient-Reste prüfen.
2. Theme togglen, Seite neu laden → kein Flash, Wahl bleibt.
3. Einen Lauf anlegen/treiben, Personas filtern/auswählen, Model-Config anlegen/löschen → optisch konsistent, funktional unverändert.
4. Vergleich öffnen → zwei klar trennbare Serien (Teal/Amber), Cutoff nicht verwechselbar.

## Performance Considerations

Keine relevanten — reines CSS/Token-Refactoring; das No-Flash-Inline-Script ist minimal und synchron (gewollt). Keine zusätzlichen Runtime-Kosten.

## Migration Notes

Standard-Mapping-Tabelle (konsistent über alle Phasen anwenden):

| Alt (Literal)                                   | Neu (Token)                               |
| ----------------------------------------------- | ----------------------------------------- |
| `bg-cosmic`, `bg-white/5..10`, `backdrop-blur*` | `bg-background` / `bg-card` / `bg-muted`  |
| `text-white`                                    | `text-foreground`                         |
| `text-blue-100/50..80` (Sekundärtext)           | `text-muted-foreground`                   |
| `border-white/10..20`                           | `border-border`                           |
| `bg-purple-600 hover:bg-purple-500` (CTA)       | `Button`/`bg-primary hover:bg-primary/90` |
| `text-purple-300` (Links)                       | `text-primary`                            |
| `focus:ring-purple-400`                         | `focus-visible:ring-ring`                 |
| `*-red-*` (Fehler)                              | `*-destructive`                           |
| `*-amber-*` (Serie B / Warn)                    | `--chart-2` bzw. `--muted` (Cutoff)       |
| Serien A / Single                               | `--chart-1` (Teal)                        |

## References

- Change-Identität & Design-Entscheidungen: `context/changes/ui-redesign/change.md`
- Token-Quelle: `src/styles/global.css:75` (`@theme inline`), `:4` (`@custom-variant dark`)
- Chart-Durchreichung: `src/components/runs/axis-chart.tsx:33`
- E2E (rollenbasiert, unkritisch): `tests/e2e/auth-redirect.spec.ts`, `tests/e2e/seed.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Token-Fundament & Dark-Mode-Infrastruktur

#### Automated

- [x] 1.1 `src/components/ui/card.tsx` existiert — 4740727
- [x] 1.2 `npm run build` erfolgreich — 4740727
- [x] 1.3 `npm run test` grün — 4740727
- [x] 1.4 `npm run lint` sauber — 4740727

#### Manual

- [x] 1.5 Toggle schaltet live Hell/Dunkel und überlebt Reload — 4740727
- [x] 1.6 Kein weißer Flash beim Dark-Reload — 4740727
- [x] 1.7 `--primary` sichtbar als Teal — 4740727

### Phase 2: Topbar + Layout-Shell + Dashboard-Hub

#### Automated

- [x] 2.1 `npm run build` erfolgreich — 8b36859
- [x] 2.2 `npm run lint` sauber — 8b36859

#### Manual

- [x] 2.3 Topbar auf allen Seiten; Logo → Dashboard — 8b36859
- [x] 2.4 Theme-Toggle von jeder Seite aus funktional — 8b36859
- [x] 2.5 Dashboard-Kacheln navigieren korrekt, stimmig in beiden Modi — 8b36859
- [x] 2.6 Kein doppeltes „← Dashboard" mehr — 8b36859

### Phase 3: App-Sichten-Sweep

#### Automated

- [x] 3.1 `npm run build` erfolgreich — ce6845e
- [x] 3.2 `npm run test` grün — ce6845e
- [x] 3.3 `npm run lint` sauber — ce6845e

#### Manual

- [x] 3.4 Fünf Sichten in beiden Modi ohne Alt-Look-Reste — ce6845e
- [x] 3.5 RunRunner funktional unverändert, Zustände klar — ce6845e
- [x] 3.6 Personas-Suche/-Auswahl + Model-CRUD konsistent/bedienbar — ce6845e

### Phase 4: Charts auf Tokens

#### Automated

- [x] 4.1 `npm run build` erfolgreich
- [x] 4.2 `npm run test` grün

#### Manual

- [x] 4.3 Einzel-Chart: Teal-Punkte + neutrale gestrichelte Cutoff-Linie
- [x] 4.4 Vergleich: zwei trennbare Serien (Teal/Amber), Legende stimmt
- [x] 4.5 Cutoff nicht mehr mit Serie B verwechselbar

### Phase 5: Auth + Landing

#### Automated

- [ ] 5.1 `npm run build` erfolgreich
- [ ] 5.2 `npm run test` grün
- [ ] 5.3 `npm run lint` sauber

#### Manual

- [ ] 5.4 Auth-Seiten in beiden Modi konsistent, Fehler sichtbar
- [ ] 5.5 Landing-Hero clean/hell, kein Cosmic-Rest
- [ ] 5.6 `missingConfigs`-Banner in beiden Modi lesbar

### Phase 6: Verifikation & Politur

#### Automated

- [ ] 6.1 Grep nach Farb-Literalen über `src/` leer
- [ ] 6.2 `npm run build` erfolgreich
- [ ] 6.3 `npm run test` grün
- [ ] 6.4 `npm run test:integration` grün
- [ ] 6.5 `npm run test:e2e` grün
- [ ] 6.6 `npm run lint` sauber

#### Manual

- [ ] 6.7 Alle Sichten in Hell und Dunkel durchgeklickt, konsistent
- [ ] 6.8 Theme-Wahl persistiert über Reloads/Seitenwechsel
- [ ] 6.9 Keine funktionalen Regressionen

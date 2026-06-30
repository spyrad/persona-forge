---
change_id: ui-redesign
title: "UI-Vereinheitlichung: shadcn-Tokens, Teal-Akzent, Topbar-Nav, Dark Mode"
status: archived
created: 2026-06-29
updated: 2026-06-30
archived_at: 2026-06-30T03:10:06Z
---

## Notes

UI/Layout-Vereinheitlichung: shadcn/Tailwind-Tokens als alleinige Design-Wahrheit (hell-first, Teal/Emerald-Akzent, neutral-graue Basis), Cosmic-Theme und alle Farb-Literale entfernen. Persistente Topbar (Logo→Dashboard, User/Sign-out) + Dashboard als Hub mit Card-Kacheln. Vollwertiger Dark Mode mit Toggle (No-Flash, persistiert). Charts auf Chart-Tokens. Betrifft alle App-Sichten (dashboard, runs, runs/[id], runs/compare, personas, models) inkl. React-Inseln, Auth-Seiten und Landing. Layout-Titel-Default fixen.

### Design-Entscheidungen (Brainstorming 2026-06-29)

- **Richtung:** Clean & seriös, datengetrieben, hell-first.
- **Akzent:** Teal/Emerald als einziges Marken-Token; Rest neutral-grau.
- **System:** shadcn/Tailwind-Tokens (`global.css`) = alleinige Wahrheit; `bg-cosmic`-Utility und alle Farb-Literale (`text-white`, `bg-white/10`, `text-blue-100`, `amber`, Gradient-Headlines) entfernen → nur semantische Klassen.
- **Navigation:** Schlanke persistente Topbar (klickbares Logo → Dashboard, User-E-Mail + Sign-out rechts, Theme-Toggle); ins `Layout.astro` integriert. Dashboard bleibt Hub mit `Card`-Kacheln statt Glas-Buttons. Das per-Seite-„← Dashboard"-Geflicke entfällt.
- **Dark Mode:** Hell UND dunkel vollwertig, Umschalter in der Topbar, No-Flash-Inline-Script im `<head>`, Präferenz persistiert (localStorage + `prefers-color-scheme`-Default). Jede Sicht/jeder Chart in beiden Modi prüfen.
- **Charts:** `axis-chart.tsx` & Konsumenten auf `--chart-*`-Tokens statt blue/amber/white-Literale; Cutoff-Linie als abgesetztes Signal-Token.
- **Vorgehen:** Direkt im Code (frontend-design-Prinzipien), kein Figma. Verifikation: `npm run build` + Unit-Tests grün, visueller Durchgang in beiden Modi, E2E-Selektoren (rollenbasiert) kontrollieren.
- **Reihenfolge:** (1) Tokens/Fundament → (2) Topbar+Layout+Dashboard-Hub → (3) App-Sichten → (4) Charts → (5) Auth+Landing → (6) Verifikation.

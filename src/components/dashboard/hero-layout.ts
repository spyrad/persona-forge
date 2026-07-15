/**
 * Layout-Logik des Dashboard-Heroes (Orbit-Metapher, Entscheidung 3.1): pure
 * Funktionen ohne DOM/IO — deterministisch und unit-testbar. Das Zeichnen
 * (SVG + CSS-Animation) uebernimmt `DashboardHero.astro`.
 *
 * Wiederverwendbar fuer Idee #5 (Live-Run-Visualisierung) — die Muster:
 *   * Layout rein rechnen (dieses Modul), server-gerendertes SVG zeichnen,
 *     Farben ausschliesslich via `var(--chart-1)`/`var(--chart-2)`/`currentColor`
 *     (Light/Dark automatisch, kein getComputedStyle);
 *   * Bewegung rein per CSS-Keyframes + `@media (prefers-reduced-motion:
 *     reduce)` — kein JS, keine Insel, kein Layout-Sprung.
 *
 * Orbit-Regeln (Plan 3.2/3.4):
 *   * Profilierte Modelle kreisen um den Baseline-Kern; innerster Ring =
 *     zuletzt aktiv (Eingabe kommt von `buildModelEntries` bereits sortiert).
 *   * Punktgroesse = verwertbare Reps (geklemmt), Winkel per Golden-Angle-
 *     Sequenz (deterministisch, streut ohne Zufall).
 *   * Unprofilierte sitzen gedimmt auf dem gestrichelten Aussenring.
 *   * Max. 8 Knoten (Spec-Grenzwert): profilierte zuerst, Rest = `overflow`
 *     („+N more" zeichnet die Astro-Komponente).
 */
import type { DashboardModelEntry } from "@/types";

// ViewBox-Geometrie: Ellipsen (vertikal gestaucht) fuellen das 2:1-Format.
export const HERO_VIEW = { width: 640, height: 320, cx: 320, cy: 160 } as const;
/** Vertikale Stauchung der Orbits (Ellipse statt Kreis — flaches Hero-Format). */
export const HERO_SQUASH = 0.72;
/** Max. gezeichnete Knoten (Spec: > 8 → zuletzt aktive + „+N more"). */
export const HERO_MAX_NODES = 8;
/** Aussenring (unprofilierte Modelle; zugleich groesster Orbit). */
export const HERO_OUTER_RING = 150;
const RING_MIN = 70;
const RING_MAX = 130;
/** Golden-Angle-Schritt: streut Winkel deterministisch ohne Kollisions-Haeufung. */
const GOLDEN_ANGLE = 137.5;
const ANGLE_START = -90;

export interface HeroNode {
  modelName: string;
  profiled: boolean;
  /** Sub-Label unter dem Namen („INFJ · 100 % stable · 5 reps" / „not profiled yet"). */
  label: string;
  x: number;
  y: number;
  /** Punkt-Radius (Reps-geklemmt bei profilierten, fix klein bei unprofilierten). */
  r: number;
  /** Orbit-Radius (horizontale Halbachse der Ellipse). */
  ring: number;
  /** Serien-Zuordnung fuer Token-Farben (alternierend chart-1/chart-2). */
  series: 1 | 2;
  /** Label links oder rechts vom Punkt (immer nach aussen, weg vom Kern). */
  labelAnchor: "start" | "end";
}

export interface HeroLayout {
  /** Orbit-Radien (horizontale Halbachsen) fuer die Ring-Zeichnung, aufsteigend. */
  rings: number[];
  nodes: HeroNode[];
  /** Nicht gezeichnete Modelle („+N more" → /models). */
  overflow: number;
  /** true = keinerlei Modelle (Leerzustand: unbelegte Struktur + CTA). */
  empty: boolean;
}

/** Sub-Label eines Knotens — pur, damit Tests die Anzeige-Regeln festnageln. */
export function heroNodeLabel(entry: DashboardModelEntry): string {
  if (!entry.profiled) return "not profiled yet";
  const parts = [entry.modalType ?? "—"];
  if (entry.typeConsistency !== null) parts.push(`${String(Math.round(entry.typeConsistency * 100))} % stable`);
  parts.push(`${String(entry.usableReps)} rep${entry.usableReps === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** Punkt-Radius aus verwertbaren Reps (sanft wachsend, geklemmt 6–14). */
function dotRadius(usableReps: number): number {
  return Math.min(14, Math.max(6, 6 + usableReps * 0.7));
}

/** Position auf dem (gestauchten) Orbit — Winkel in Grad. */
function position(ring: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.round(HERO_VIEW.cx + ring * Math.cos(rad)),
    y: Math.round(HERO_VIEW.cy + ring * Math.sin(rad) * HERO_SQUASH),
  };
}

/**
 * Baut das Orbit-Layout aus den Dashboard-Modellen. Erwartet die Sortierung
 * von `buildModelEntries` (profilierte nach juengster Aktivitaet zuerst) und
 * kappt auf `HERO_MAX_NODES` — profilierte haben Vorrang vor unprofilierten.
 */
export function buildHeroLayout(models: DashboardModelEntry[]): HeroLayout {
  const profiledAll = models.filter((m) => m.profiled);
  const unprofiledAll = models.filter((m) => !m.profiled);

  const profiled = profiledAll.slice(0, HERO_MAX_NODES);
  const unprofiled = unprofiledAll.slice(0, HERO_MAX_NODES - profiled.length);
  const overflow = models.length - profiled.length - unprofiled.length;

  // Ring je profiliertem Modell: innen = zuletzt aktiv, gleichmaessig bis RING_MAX.
  const ringStep = profiled.length > 1 ? (RING_MAX - RING_MIN) / (profiled.length - 1) : 0;
  const nodes: HeroNode[] = [];

  profiled.forEach((entry, i) => {
    const ring = Math.round(RING_MIN + i * ringStep);
    const angle = ANGLE_START + i * GOLDEN_ANGLE;
    const { x, y } = position(ring, angle);
    nodes.push({
      modelName: entry.modelName,
      profiled: true,
      label: heroNodeLabel(entry),
      x,
      y,
      r: dotRadius(entry.usableReps),
      ring,
      series: i % 2 === 0 ? 1 : 2,
      labelAnchor: x >= HERO_VIEW.cx ? "start" : "end",
    });
  });

  unprofiled.forEach((entry, i) => {
    // Aussenring; Winkel-Sequenz laeuft weiter (keine Ueberlagerung mit profilierten).
    const angle = ANGLE_START + (profiled.length + i) * GOLDEN_ANGLE;
    const { x, y } = position(HERO_OUTER_RING, angle);
    nodes.push({
      modelName: entry.modelName,
      profiled: false,
      label: heroNodeLabel(entry),
      x,
      y,
      r: 5,
      ring: HERO_OUTER_RING,
      series: 1,
      labelAnchor: x >= HERO_VIEW.cx ? "start" : "end",
    });
  });

  const rings = [...new Set([...nodes.filter((n) => n.profiled).map((n) => n.ring), HERO_OUTER_RING])].sort(
    (a, b) => a - b,
  );

  return { rings, nodes, overflow: Math.max(0, overflow), empty: models.length === 0 };
}

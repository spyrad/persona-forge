/**
 * OEJTS-Attributionsblock (CC BY-NC-SA 4.0) — Pflicht, sobald OEJTS-Ergebnisse
 * oder Typen gezeigt werden (Spec-Abnahme-Kriterium; docs/instruments/
 * oejts-attribution.md). Rein präsentational, statisch gerendert; die
 * Sichtbarkeits-Bedingung (zeigt die Seite OEJTS-Daten?) liegt beim Aufrufer.
 */
export default function OejtsAttribution() {
  return (
    <p className="text-muted-foreground text-xs">
      OEJTS 1.2 by Eric Jorgenson, Open Psychometrics Project (
      <a
        href="https://openpsychometrics.org/tests/OJTS/"
        className="hover:text-foreground underline underline-offset-2"
      >
        openpsychometrics.org
      </a>
      ), licensed{" "}
      <a
        href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
        className="hover:text-foreground underline underline-offset-2"
      >
        CC BY-NC-SA 4.0
      </a>
      . Not affiliated with the official MBTI.
    </p>
  );
}

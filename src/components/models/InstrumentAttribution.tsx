import type { InstrumentAttribution as Attribution } from "@/types";

/**
 * Attributionsblock je Instrument — Pflicht, sobald dessen Ergebnisse/Typen
 * gezeigt werden (Spec-Abnahme). Rein präsentational, datengetrieben aus
 * `Instrument.attribution` (statt statisch für OEJTS): OEJTS = CC BY-NC-SA mit
 * Lizenz-Link, HEXACO = „Public domain (IPIP)" ohne Link. Der Aufrufer
 * entscheidet die Sichtbarkeit (zeigt die Seite Ergebnisse dieses Instruments?).
 */
export default function InstrumentAttribution({ attribution }: { attribution: Attribution }) {
  const { name, author, source, license, note } = attribution;
  return (
    <p className="text-muted-foreground text-xs">
      {name} by {author} (
      <a href={source.url} className="hover:text-foreground underline underline-offset-2">
        {source.label}
      </a>
      )
      {license.url ? (
        <>
          , licensed{" "}
          <a href={license.url} className="hover:text-foreground underline underline-offset-2">
            {license.label}
          </a>
        </>
      ) : (
        <>. {license.label}</>
      )}
      .{note ? ` ${note}` : ""}
    </p>
  );
}

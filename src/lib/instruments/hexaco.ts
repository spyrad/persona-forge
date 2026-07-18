/**
 * HEXACO — 60-Item Short Form (persona-forge selection) auf Basis der
 * IPIP-HEXACO-Skalen (Ashton, Lee & Goldberg 2007), 6 Faktoren (H/E/X/A/C/O).
 *
 * Laufzeit-Fassung des Instruments. Menschenlesbare Single Source / Referenz ist
 * `context/foundation/instruments/ipip-hexaco-60.json` (inkl. Auswahlregel R1/R2,
 * Keying-Balance und `constant`-Herleitung); diese Datei ist die App-seitige,
 * typisierte Kopie (ein Import aus `context/` ist nicht moeglich — kein
 * Path-Alias, kein resolveJsonModule; analog `oejts.ts`).
 *
 * Lizenz: **Public domain (IPIP)** — die Items sind gemeinfrei, Redistribution im
 * oeffentlichen Repo unproblematisch. WICHTIG: Ein kanonisches Instrument namens
 * „IPIP-HEXACO-60" existiert NICHT — dies ist eine eigene, deterministisch
 * dokumentierte 60-Item-Auswahl aus den offiziellen IPIP-HEXACO-Skalen (24
 * Facetten / 238 Items). NICHT das copyrightgeschuetzte HEXACO-60 von Ashton &
 * Lee (2009). Fuer LLM-Profiling (Verteilungen, nicht Diagnostik) konzipiert.
 *
 * Antwortskala: 5-Punkte-Likert-Selbstbeschreibung (IPIP-Standard),
 * 1 = very inaccurate … 5 = very accurate, 3 = neutral.
 *
 * Scoring (generisch via `scoreAxes`): score(Faktor) = constant + Σ(sign · antwort)
 * ueber die 10 zugehoerigen Items. `constant = 6 × Anzahl revers gekeyter Items`
 * der Achse — aequivalent zu: positive Items zaehlen die Antwort, negative Items
 * `6 − antwort`. Range je Faktor 10–50, Skalenmitte (`midpoint`) 30. Kein
 * Modaltyp (`hasModalType: false`) — HEXACO liefert dimensionale Profile.
 */
import type { Instrument } from "@/types";

export const HEXACO = {
  id: "hexaco-ipip-60",
  permute: true,
  hasModalType: false,
  attribution: {
    name: "HEXACO (IPIP, 60-item selection)",
    author: "Items: Ashton, Lee & Goldberg (2007), International Personality Item Pool",
    source: { label: "ipip.ori.org", url: "https://ipip.ori.org/newHEXACO_PI_key.htm" },
    license: { label: "Public domain (IPIP)" },
    note: "Own deterministic 60-item selection from the IPIP-HEXACO scales; not the copyrighted HEXACO-60 (Ashton & Lee, 2009).",
  },
  axes: [
    // `constant = 6 × n(sign=-1)` je Achse; `midpoint` = Skalenmitte 30 (Chart-Referenzlinie).
    { key: "H", constant: 36, midpoint: 30, label: "Honesty-Humility" },
    { key: "E", constant: 24, midpoint: 30, label: "Emotionality" },
    { key: "X", constant: 30, midpoint: 30, label: "Extraversion" },
    { key: "A", constant: 30, midpoint: 30, label: "Agreeableness" },
    { key: "C", constant: 30, midpoint: 30, label: "Conscientiousness" },
    { key: "O", constant: 30, midpoint: 30, label: "Openness to Experience" },
  ],
  items: [
    // Honesty-Humility
    { id: "H1", axis: "H", sign: 1, text: "Don't pretend to be more than I am" },
    { id: "H2", axis: "H", sign: -1, text: "Use flattery to get ahead" },
    {
      id: "H3",
      axis: "H",
      sign: -1,
      text: "Tell other people what they want to hear so that they will do what I want them to do",
    },
    { id: "H4", axis: "H", sign: 1, text: "Would never take things that aren't mine" },
    { id: "H5", axis: "H", sign: -1, text: "Admire a really clever scam" },
    { id: "H6", axis: "H", sign: 1, text: "Would not enjoy being a famous celebrity" },
    { id: "H7", axis: "H", sign: -1, text: "Love luxury" },
    { id: "H8", axis: "H", sign: 1, text: "Don't think that I'm better than other people" },
    { id: "H9", axis: "H", sign: -1, text: "Would like to have more power than other people" },
    { id: "H10", axis: "H", sign: -1, text: "Believe that I am better than others" },
    // Emotionality
    { id: "E1", axis: "E", sign: 1, text: "Am a physical coward" },
    { id: "E2", axis: "E", sign: -1, text: "Like to do frightening things" },
    { id: "E3", axis: "E", sign: -1, text: "Face danger confidently" },
    { id: "E4", axis: "E", sign: 1, text: "Often worry about things that turn out to be unimportant" },
    { id: "E5", axis: "E", sign: -1, text: "Rarely worry" },
    { id: "E6", axis: "E", sign: 1, text: "Worry about things" },
    { id: "E7", axis: "E", sign: 1, text: "Need reassurance" },
    { id: "E8", axis: "E", sign: 1, text: "Let myself be influenced by others" },
    { id: "E9", axis: "E", sign: 1, text: "Feel others' emotions" },
    { id: "E10", axis: "E", sign: -1, text: "Rarely cry during sad movies" },
    // Extraversion
    { id: "X1", axis: "X", sign: 1, text: "Talk a lot" },
    { id: "X2", axis: "X", sign: -1, text: "Don't talk a lot" },
    { id: "X3", axis: "X", sign: 1, text: "Am good at making impromptu speeches" },
    { id: "X4", axis: "X", sign: -1, text: "Would be afraid to give a speech in public" },
    { id: "X5", axis: "X", sign: 1, text: "Don't mind being the center of attention" },
    { id: "X6", axis: "X", sign: 1, text: "Usually like to spend my free time with people" },
    {
      id: "X7",
      axis: "X",
      sign: -1,
      text: "Seem to derive less enjoyment from interacting with people than others do",
    },
    { id: "X8", axis: "X", sign: -1, text: "Rarely enjoy being with people" },
    { id: "X9", axis: "X", sign: 1, text: "Maintain high energy throughout the day" },
    { id: "X10", axis: "X", sign: -1, text: "Tire out quickly" },
    // Agreeableness
    { id: "A1", axis: "A", sign: 1, text: "Love my enemies" },
    { id: "A2", axis: "A", sign: -1, text: "Find it hard to forgive others" },
    { id: "A3", axis: "A", sign: 1, text: "Rarely complain" },
    {
      id: "A4",
      axis: "A",
      sign: -1,
      text: "Become frustrated and angry with people when they don't live up to my expectations",
    },
    { id: "A5", axis: "A", sign: -1, text: "Am quick to judge others" },
    { id: "A6", axis: "A", sign: 1, text: "Adjust easily" },
    {
      id: "A7",
      axis: "A",
      sign: -1,
      text: "When interacting with a group of people, am often bothered by at least one of them",
    },
    { id: "A8", axis: "A", sign: 1, text: "Find that it takes a lot to make me feel angry at someone" },
    { id: "A9", axis: "A", sign: -1, text: "Am easily annoyed" },
    { id: "A10", axis: "A", sign: 1, text: "Rarely feel angry with people" },
    // Conscientiousness
    { id: "C1", axis: "C", sign: 1, text: "Keep things tidy" },
    { id: "C2", axis: "C", sign: -1, text: "Leave a mess in my room" },
    { id: "C3", axis: "C", sign: 1, text: "Get chores done right away" },
    { id: "C4", axis: "C", sign: 1, text: "Push myself very hard to succeed" },
    { id: "C5", axis: "C", sign: -1, text: "Do just enough work to get by" },
    { id: "C6", axis: "C", sign: -1, text: "Stop when work becomes too difficult" },
    { id: "C7", axis: "C", sign: 1, text: "Pay attention to details" },
    { id: "C8", axis: "C", sign: -1, text: "Pay too little attention to details" },
    { id: "C9", axis: "C", sign: 1, text: "Avoid mistakes" },
    { id: "C10", axis: "C", sign: -1, text: "Jump into things without thinking" },
    // Openness to Experience
    { id: "O1", axis: "O", sign: 1, text: "Believe in the importance of art" },
    { id: "O2", axis: "O", sign: -1, text: "Do not like art" },
    { id: "O3", axis: "O", sign: 1, text: "Am interested in science" },
    { id: "O4", axis: "O", sign: -1, text: "Don't know much about history" },
    { id: "O5", axis: "O", sign: 1, text: "Have a vivid imagination" },
    { id: "O6", axis: "O", sign: -1, text: "Do not have a good imagination" },
    { id: "O7", axis: "O", sign: 1, text: "Come up with something new" },
    { id: "O8", axis: "O", sign: 1, text: "Am considered to be kind of eccentric" },
    { id: "O9", axis: "O", sign: -1, text: "Would hate to be considered odd or strange" },
    { id: "O10", axis: "O", sign: -1, text: 'Enjoy being thought of as a normal "mainstream" person' },
  ],
} satisfies Instrument;

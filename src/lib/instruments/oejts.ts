/**
 * OEJTS 1.2 — Open Extended Jungian Type Scales (Eric Jorgenson).
 *
 * Laufzeit-Fassung des Instruments fuer S-04. Menschenlesbare Single Source /
 * Referenz ist `context/foundation/instruments/oejts-1.2.json`; diese Datei ist
 * die App-seitige, typisierte Kopie (ein Import aus `context/` ist nicht moeglich
 * — kein Path-Alias, kein resolveJsonModule, Schichtverletzung; siehe plan-review F1).
 *
 * Lizenz: CC BY-NC-SA 4.0 — privat/nicht-kommerziell OK; vor oeffentlicher/
 * kommerzieller Nutzung oder Verteilung abgeleiteter Item-Sets neu pruefen.
 *
 * v1 ist hartkodiert (FR-011): ein zweites Instrument folgt spaeter datengetrieben.
 *
 * Antwortskala: 5-Punkte-bipolar, 1 = voll `left`, 3 = ausgewogen, 5 = voll `right`.
 * Scoring (S-05): score(Achse) = constant + Summe(sign * antwort); > cutoff → high-Pol.
 *   IE = 30 - Q3 - Q7 - Q11 + Q15 - Q19 + Q23 + Q27 - Q31
 *   SN = 12 + Q4 + Q8 + Q12 + Q16 + Q20 - Q24 - Q28 + Q32
 *   FT = 30 - Q2 + Q6 + Q10 - Q14 - Q18 + Q22 - Q26 - Q30
 *   JP = 18 + Q1 + Q5 - Q9 + Q13 - Q17 + Q21 - Q25 + Q29
 */
import type { Instrument } from "@/types";

export const OEJTS = {
  id: "oejts-1.2",
  permute: true,
  axes: [
    { key: "IE", constant: 30, cutoff: 24, high: "E", low: "I", label: "Introversion–Extraversion" },
    { key: "SN", constant: 12, cutoff: 24, high: "N", low: "S", label: "Sensing–Intuition" },
    { key: "FT", constant: 30, cutoff: 24, high: "T", low: "F", label: "Feeling–Thinking" },
    { key: "JP", constant: 18, cutoff: 24, high: "P", low: "J", label: "Judging–Perceiving" },
  ],
  items: [
    { id: "Q1", axis: "JP", sign: 1, left: "makes lists", right: "relies on memory" },
    { id: "Q2", axis: "FT", sign: -1, left: "sceptical", right: "wants to believe" },
    { id: "Q3", axis: "IE", sign: -1, left: "bored by time alone", right: "needs time alone" },
    { id: "Q4", axis: "SN", sign: 1, left: "accepts things as they are", right: "unsatisfied with the way things are" },
    { id: "Q5", axis: "JP", sign: 1, left: "keeps a clean room", right: "just puts stuff wherever" },
    {
      id: "Q6",
      axis: "FT",
      sign: 1,
      left: 'thinks "robotic" is an insult',
      right: "strives to have a mechanical mind",
    },
    { id: "Q7", axis: "IE", sign: -1, left: "energetic", right: "mellow" },
    { id: "Q8", axis: "SN", sign: 1, left: "prefer to take multiple choice test", right: "prefer essay answers" },
    { id: "Q9", axis: "JP", sign: -1, left: "chaotic", right: "organized" },
    { id: "Q10", axis: "FT", sign: 1, left: "easily hurt", right: "thick-skinned" },
    { id: "Q11", axis: "IE", sign: -1, left: "works best in groups", right: "works best alone" },
    { id: "Q12", axis: "SN", sign: 1, left: "focused on the present", right: "focused on the future" },
    { id: "Q13", axis: "JP", sign: 1, left: "plans far ahead", right: "plans at the last minute" },
    { id: "Q14", axis: "FT", sign: -1, left: "wants people's respect", right: "wants their love" },
    { id: "Q15", axis: "IE", sign: 1, left: "gets worn out by parties", right: "gets fired up by parties" },
    { id: "Q16", axis: "SN", sign: 1, left: "fits in", right: "stands out" },
    { id: "Q17", axis: "JP", sign: -1, left: "keeps options open", right: "commits" },
    {
      id: "Q18",
      axis: "FT",
      sign: -1,
      left: "wants to be good at fixing things",
      right: "wants to be good at fixing people",
    },
    { id: "Q19", axis: "IE", sign: -1, left: "talks more", right: "listens more" },
    {
      id: "Q20",
      axis: "SN",
      sign: 1,
      left: "when describing an event, will tell people what happened",
      right: "when describing an event, will tell people what it meant",
    },
    { id: "Q21", axis: "JP", sign: 1, left: "gets work done right away", right: "procrastinates" },
    { id: "Q22", axis: "FT", sign: 1, left: "follows the heart", right: "follows the head" },
    { id: "Q23", axis: "IE", sign: 1, left: "stays at home", right: "goes out on the town" },
    { id: "Q24", axis: "SN", sign: -1, left: "wants the big picture", right: "wants the details" },
    { id: "Q25", axis: "JP", sign: -1, left: "improvises", right: "prepares" },
    { id: "Q26", axis: "FT", sign: -1, left: "bases morality on justice", right: "bases morality on compassion" },
    {
      id: "Q27",
      axis: "IE",
      sign: 1,
      left: "finds it difficult to yell very loudly",
      right: "yelling to others when they are far away comes naturally",
    },
    { id: "Q28", axis: "SN", sign: -1, left: "theoretical", right: "empirical" },
    { id: "Q29", axis: "JP", sign: 1, left: "works hard", right: "plays hard" },
    { id: "Q30", axis: "FT", sign: -1, left: "uncomfortable with emotions", right: "values emotions" },
    {
      id: "Q31",
      axis: "IE",
      sign: -1,
      left: "likes to perform in front of other people",
      right: "avoids public speaking",
    },
    { id: "Q32", axis: "SN", sign: 1, left: 'likes to know "who?", "what?", "when?"', right: 'likes to know "why?"' },
  ],
} satisfies Instrument;

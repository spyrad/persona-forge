# Artifact 3 — Contributor-Kontext (Wer weiß was)

> Wide-Scan-Notiz (s04e02, L2). Quelle: `git log` Autoren/Trailer.
> Roher Beleg für die Synthese in `repo-map.md`.

## Befund: Solo-Repo — Original-Komponente läuft leer

| Autor                                             | Commits    |
| ------------------------------------------------- | ---------- |
| Damian (`damian.spyra.ai@gmail.com` / `spyrad@…`) | 172 (alle) |

Es gibt **keinen** zweiten menschlichen Contributor. Die Co-Authored-By-Trailer
sind ausschließlich KI-Agenten (Claude Opus 4.8 ×116, Fable 5 ×12, Sonnet 4.6 ×8).

→ Die Lektions-Frage „**wen im Team fragen, bevor ich diesen Bereich ändere?**"
hat hier **keine sinnvolle Antwort** — ein Mensch hält den gesamten Kontext.
`git blame`/Autoren-Heatmaps wären reines Rauschen. **Ehrlich als n.a. vermerkt.**

Nebenbefund (kurskontext-relevant): **~79 % der Commits sind KI-assistiert**
(136/172 mit Claude-Co-Author) — passt zum 10xDevs-Fokus „AI im Entwicklungsprozess".

## Adaption: dokumentierte Kontext-Spur statt Personen

Bei einem Solo-Repo ersetzt **wo der dokumentierte Kontext liegt** das
„wen-fragen". Jeder Kernbereich hat einen archivierten Change mit `change.md`
(Warum/Scope) + `plan.md` (Wie/Phasen) — das ist die abrufbare „Tribal Knowledge"-Quelle:

| Bereich (aus Artifact 1+2)                                                               | Kontext-Quelle in `context/archive/`                                                                                                                 |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mess-/Run-Flow** (`services/runs`, `instruments/oejts`, `lib/runs`)                    | `2026-06-17-oejts-measurement-run/`, `2026-06-18-distribution-results/`, `2026-06-20-run-control-and-tokens/`, `2026-06-21-side-by-side-comparison/` |
| **Auth** (`middleware`, `api-auth`, `pages/api/auth`)                                    | `2026-06-13-email-auth-live/`                                                                                                                        |
| **Model-Configs / verschl. Keys** (`services/model-configs`, `crypto`, `encryption-key`) | `2026-06-15-model-config-management/`                                                                                                                |
| **Security** (`url-guard` SSRF, Quality-Gates)                                           | `2026-06-23-testing-run-integrity-ssrf/`, `2026-06-23-testing-integration-security-gate/`, `2026-06-24-testing-quality-gates-wiring/`                |
| **Personas** (`services/personas`, `persona-compile`)                                    | `2026-06-17-persona-catalog/`                                                                                                                        |
| **Monitoring**                                                                           | `2026-06-25-sentry-monitoring/`                                                                                                                      |
| **UI/Tokens** (`global.css`, Inseln, `Layout`)                                           | `2026-06-29-ui-redesign/`                                                                                                                            |

Zusätzlich tragen `context/foundation/` (`prd.md`, `roadmap.md`, `test-plan.md`)
und `CLAUDE.md` (Gotchas/Conventions) den projektweiten Kontext.

## unknowns

- Keine externe Wissensstreuung messbar/relevant (Solo).
- „Wer-fragen" → entfällt; bei künftigem Team-Wachstum diese Komponente neu erheben.

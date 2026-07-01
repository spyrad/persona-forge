---
title: "Raport architektoniczny — 10xArchitect (moduł 4)"
created: 2026-07-01
type: architect-report
author: Damian Spyra (przy pomocy Claude Opus 4.8)
scope: "Jedno repozytorium (persona-forge) przez wszystkie cztery artefakty L2–L5"
---

# Raport architektoniczny — 10xArchitect (moduł 4)

> Two-pager do formularza certyfikacyjnego. Synteza wyłącznie z czterech artefaktów
> modułu 4 (L2 mapa, L3 research, L4 plan, L5 domena). Każde twierdzenie strukturalne jest
> udowodnione w odpowiednim artefakcie; tutaj tylko zagęszczenie.

## 1. Opisane projekty

Cała ścieżka Architekta powstała na **jednym** repozytorium — świadomie, nie na obcym
repo ćwiczeniowym.

| Projekt                                                                                                                                                                                    | Stack                                                                                            | Skala                                           | Artefakty      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------- | -------------- |
| **persona-forge** — narzędzie webowe do psychometrycznego profilowania LLM-ów: uruchamia testy z domeny publicznej (v1: OEJTS) z N powtórzeniami przeciwko LLM-om i zwraca rozkłady per oś | Astro 6 SSR + React 19 + TypeScript + Tailwind 4 + Supabase (Postgres/Auth) + Cloudflare Workers | ~68 modułów TS/TSX, 172 commity / 20 dni / solo | L2, L3, L4, L5 |

## 2. Mapa projektu (L2)

- **Architektura trójwarstwowa:** Astro-strony/API-routes (wejście, niestabilne I≈75–100 %) →
  wyspy React → `src/lib/` (logika biznesowa, stabilny fundament o wysokim couplingu
  aferentnym). Deploy na Cloudflare, stan w Supabase.
- **Jedno wyraźne centrum:** przepływ **pomiaru/Run** (`services/runs.ts` Ca 9 +
  `instruments/oejts.ts` Ca 7 + wyspy Run) jest jednocześnie hotspotem aktywności **i**
  rdzeniem blast-radius → naturalny kandydat do Deep Focus w L3.
- **Przekroje o wysokim ryzyku:** Auth (`middleware.ts` + `api-auth.ts`, 10 importujących)
  oraz zaszyfrowane klucze LLM (`model-configs.ts` + `crypto.ts`); do tego `api-responses.ts`
  (11 importujących) — zmiana formy tam promieniuje na każdą route.
- **Zdrowa statyka:** brak cykli importów, brak martwych modułów; każdy ficzer rusza
  `lib`+`pages`+`components` jako pionowy slice.
- **Największy unknown (uczciwie nazwany):** warstwa routingu `.astro` jest niewidoczna dla
  narzędzi statycznych; przy 20 dniach historii nie da się orzec stabilne-vs-martwe.

## 3. Analiza ficzera (L3)

**Badany przepływ i powód:** przepływ pomiaru/Run OEJTS (start biegu → N powtórzeń
przeciwko LLM → rozkład/typ per oś) — wybrany z mapy jako rdzeń biznesowy i centrum
couplingu.

**Feature overview:** Przepływ to **step-loop sterowany przez klienta** — wyspa `RunRunner`
wywołuje na każde powtórzenie dokładnie **jeden** `POST /api/runs/[id]/step`, a cały stan leży
w Supabase (`runs` + `run_repetitions`). Omija to limit czasu Cloudflare-Edge **bez**
kolejki/workera. Scoring i agregacja to czysta, otestowana jednostkowo logika; agregaty wyniku
**nie są persystowane**, tylko liczone deterministycznie na nowo przy każdym renderze SSR
(jedno źródło prawdy = powtórzenia w DB).

**Dług techniczny (Top 3):**

1. **Ścieżki błędów klienta LLM zupełnie nieotestowane** (`openai-compatible.ts`:
   retry/backoff/timeout/fallback jsonMode) — najgroźniejsza luka; szeroko używana logika
   sieciowa, regres byłby cichy.
2. **D1 — „ok" ≠ „nadające się":** powtórzenie liczy się jako `ok` już przy `okCount≥1`
   (`runs.ts:401`), a scoring wymaga wszystkich 8 itemów danej osi (`oejts-score.ts:37`) →
   cicha luka semantyczna (spada odsetek błędów, choć wynik nie staje się bardziej użyteczny).
3. **Krucha szew encja↔widok:** ręcznie utrzymywany string `VIEW_COLUMNS` + mapper `toView`
   oraz **niesprawdzone rzutowania `as`** przez granicę HTTP. **Zweryfikowane ast-grepem** i przy
   tym zaostrzone z domysłu do dowodu: rzutowania są w dokładnie trzech miejscach **jednego**
   pliku (`RunRunner.tsx:180/211/258`) — walidator zod tam zamyka cały dynamiczny szew.

## 4. Plan refaktoryzacji (L4)

**Co refaktoryzowane:** **C-B** — **walidator zod na szwie wyspa `RunRunner`↔HTTP**. Klient
parsuje każdą odpowiedź sukcesu przeciwko schematom `z.infer` (`run-schemas.ts`, non-strict);
rozjazd generuje kontrolowany baner `serverError` zamiast cichego błędu renderu. `types.ts`
staje się **jednym źródłem** (re-eksport `z.infer`) plus **compile-guard** (`MutualExtends`)
przeciw rozjazdowi `RunStatus`/`Visibility`.

**Świadomie NIE zrobione:** C-C (single-source dla constraintów — celowa defense-in-depth), C-A
(typegen Supabase — celowy + zabezpieczony CI), D1 (koncept biznesowy, przesunięty do L5).

**Fazy (guard-first):**

- Faza 1 — `run-schemas.ts` + typy `z.infer` + compile-guard + 12 testów jednostkowych ·
  _auto_ (`npm run test`/`build`/`lint`).
- Faza 2 — 3 rzutowania `as` przestawione na `safeParse` pojedynczo (każde osobny commit) ·
  _auto_ (typecheck, `git grep "as RunView" = 0`) **+ ręcznie** (realny bieg pomiarowy przez
  wszystkie trzy ścieżki; test rozjazdu przez DevTools pokazuje baner, pętla przerywa czysto).

Wdrożone, zreviewowane (plan-review SOUND, impl-review APPROVED) i **wdrożone na żywo** (prod 200).

## 5. Domena wg DDD (L5)

**Ubiquitous language (kluczowe pojęcia):** _Bieg (Run)_ (samo-zawierająca się N-krotna
egzekucja), _Powtórzenie/rep_ (izolowana sesja), _Rozkład per oś_ (położenie + rozrzut zamiast
punktu), _wiarygodność wyniku_. Najgroźniejszy homonim: **„Persona"** = obiekt
testowy domeny vs. rola użytkownika. Kluczowe pojęcie wizji **„Disposition" BRAK w kodzie**
(tylko tekst UI, implicite `RunAggregate`).

**Najważniejsze rozjazdy model-vs-kod:** (a) flaga `permute` to **martwy kontrakt** —
zadeklarowana (`types.ts:192`), ale orkiestrator zawsze permutuje na twardo (`runs.ts:376`);
(b) reguła wiarygodności żyje **tylko w UI** (`RELIABLE_MIN=2`, `axis-chart.tsx:14`),
podczas gdy API/DB/agregat dopuszczają N=1 jako gotowy wynik `ready`.

**Niezmiennik #1 + agregat:** „**Wynik nigdy nie jest przedstawiany jako wiarygodny, jeśli
pochodzi z mniej niż N_min użytecznych powtórzeń**" — jedyny guardrail oznaczony jako
_nienaruszalny_, a zarazem **najsłabiej** egzekwowany (grep `reliab` po `src/lib` = zero kodu
produkcyjnego). Należy do agregatu **Bieg** (`RunAggregate`); projekt: liczony w domenie werdykt
`reliability` + stała single-source `MIN_RELIABLE_REPS` + fail-fast `UnreliableRunError` dla
ścieżek kontraktowych.

**Anti-Corruption Layer:** najgorszy przeciek = **klient Supabase**, sączy się przez **5 warstw /
6 plików** (typ `SupabaseClient` zduplikowany 4× znak w znak; kod błędu Postgresa `"23505"` jako
string-match w logice biznesowej, `runs.ts:423`). Uczciwie zwymiarowane: przeciek jest **łagodny**
— nie dociera ani do UI, ani do czystej domeny scoringu; `openai-compatible.ts` to już
podręcznikowy ACL i służy jako wzorzec. Sprawdzalne kryterium na przyszłość: `grep @supabase src/`
ma trafiać wyłącznie w katalog adaptera.

## 6. Decyzje, które należą do mnie

Ścieżkę Architekta poprowadziłem świadomie na moim **realnym produkcie**, a nie na repo
jednorazowym — żeby diagnozy trafiały prosto do roadmapy, nie do ćwiczenia. Przy rankingu L4
przekonała mnie **soczewka intencjonalności** (archeologia Gita zamiast ADR-ów), by
najbardziej spektakularny wynik z L3 (szew `VIEW_COLUMNS`, C-A) postawić na **ostatnim**
miejscu: jest świadomie wybrany i zabezpieczony CI, więc „guard, nie przebudowa" — a wybrać
**C-B**, jedyny problem _przypadkowej_ złożoności o małej, odwracalnej ścieżce. **D1**
potraktowałem wbrew pierwszemu odruchowi _nie_ jako refaktor mechaniczny, lecz przesunąłem do
L5, bo to brakujące **pojęcie biznesowe** (odsetek plonu scoringu vs. odsetek błędów odpowiedzi),
a jego naprawa zmienia zachowanie — nie jest to więc refaktoryzacja zachowawcza. W L5 zgadzam
się, że wiarygodność to niezmiennik #1, ale przejmuję
**zastrzeżenie agenta projektowego** wobec propozycji z distillation: wiarygodność należy do
osobnego pola `reliability`, a **nie** do `RunResultView.state` — `state` to dyskryminator
renderu, do tego ortogonalny. Ta decyzja jest moja, kiedy przekuję plan w konkretny `change-id`.
Narzędzie (agenci, ast-grep, historia Gita) dostarcza kandydatów i dowodów; wybór, co jest
rdzeniem, a co może poczekać, zostaje po mojej stronie.

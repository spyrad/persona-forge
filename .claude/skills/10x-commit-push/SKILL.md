---
name: 10x-commit-push
description: >
  Committet alle uncommitteten Änderungen als Conventional Commit im Hausstil
  und pusht direkt zum Remote (inkl. Upstream-Setup bei neuem Branch). Use when:
  "commit und push", "alles committen", "commit-push", "push das", "zmiany na
  remote", Session-Abschluss mit offenen Änderungen. NICHT während
  /10x-implement-/10x-tdd-Phasen (die committen selbst, ohne Push) und NICHT
  für /10x-archive-Abschlüsse.
argument-hint: "[optionale Commit-Message]"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# 10x Commit-Push

One-Shot: alle Änderungen stagen → Conventional Commit im Hausstil → `git push`.

## Schritt 1: Vorprüfung

`git status --short` und `git branch --show-current`.

- Status leer → `Nichts zu committen.` ausgeben und Ende.
- Detached HEAD → abbrechen: erst Branch auschecken, dann erneut aufrufen.

## Schritt 2: Sicherheits-Gate (vor dem Stagen)

Den Status auf verdächtige Pfade prüfen — bei Treffer **stoppen und den User
fragen**, nichts committen:

- `.env*` (außer `.env.example`), `*.key`, `*.pem`, `secrets/`, `credentials*`
- ungewöhnlich große Dateien (> ~5 MB) oder Binär-Dumps
- Pfade, die laut `.gitignore` eigentlich ignoriert sein sollten, aber auftauchen

## Schritt 3: Diff sichten & Message bauen

`git diff --stat` + `git diff` (untracked Dateien über den Status) lesen — genug,
um die Änderung inhaltlich zu verstehen.

- **Mit Argument:** Argument als Commit-Message verwenden; fehlt ein
  Conventional-Commits-Präfix, passenden Typ ergänzen.
- **Ohne Argument:** Message im Hausstil ableiten (siehe `git log --oneline -10`):
  Typ `feat`/`fix`/`docs`/`chore`/`refactor`/`test`, Scope optional, Subject kurz
  (Englisch oder Deutsch wie in der Historie), bei mehreren logischen Änderungen
  Body mit Bullets.

## Schritt 4: Commit

```bash
git add -A
git commit -m "<message>"   # Body + Trailer über Here-String/Heredoc
```

- Trailer immer anhängen: `Co-Authored-By: Claude <modell> <noreply@anthropic.com>`
- **Niemals** `--no-verify`, **niemals** `--amend`.
- Schlägt ein Hook fehl: Ursache beheben, dann neuer Commit-Versuch.

## Schritt 5: Push

```bash
git push                          # Standard
git push -u origin <branch>       # falls kein Upstream gesetzt
```

Bei non-fast-forward: **kein Force-Push.** Nur bei trivialer Divergenz
(reine Doku-Commits remote) `git pull --rebase` und erneut pushen — sonst
abbrechen und die Lage melden.

## Schritt 6: Report (max ~8 Zeilen)

```
Commit & Push erledigt.

Branch:  {branch} → origin/{branch}
Commit:  {kurzhash} {subject}
Dateien: {N} geändert (+{add}/-{del})
```

Hinweis-Zeile anhängen, falls Branch = `main`: Push auf `main` triggert den
Cloudflare-Auto-Deploy (sobald F-02 deploy-skeleton-live umgesetzt ist).

## Richtlinien

- **One-Shot:** keine Rückfragen — einzige Ausnahme ist das Sicherheits-Gate
- **Hausstil:** Conventional Commits, Trailer, kein Force-Push, kein `--no-verify`
- **Deutsch** im Report; Commit-Subjects wie in der Repo-Historie
- **Alles oder Stopp:** entweder alle Änderungen committen oder (bei Gate-Treffer)
  gar nichts — kein stilles Teil-Staging

## Verwandte Skills

- `/10x-implement`, `/10x-tdd`, `/10x-e2e` — Phase-Commits ohne Push
- `/10x-archive` — Archiv-Commit ohne Push
- `/dtb:workflow-checkpoint` — Session-Log vor dem Abschluss-Commit

---

Prüfe jetzt den Git-Status und führe Commit + Push aus.

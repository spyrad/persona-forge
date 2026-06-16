# Model Config Management (S-02) — Plan Brief

> Full plan: `context/changes/model-config-management/plan.md`

## What & Why

Erste Domänen-Tabelle des Produkts: ein angemeldeter Nutzer hängt ein OpenAI-kompatibles
Modell an (Base-URL, Modellname, Label, API-Key) und speichert es als wiederverwendbare
Konfiguration. Der API-Key liegt verschlüsselt at rest und verlässt den Server nie Richtung
Client (FR-005, FR-006, NFR Key-Dichtheit). Unlocks S-04 (OEJTS-Messlauf konsumiert die
Konfig).

## Starting Point

Auth + RLS-Grundgerüst stehen (F-01/S-01 archiviert) mit einem dokumentierten owner-only
RLS-Muster (`_rls_probe`). Es gibt **keine** Verschlüsselungs-Infrastruktur, **keine**
Service-Schicht (`src/lib/services/`), **keine** zentrale `src/types.ts` und **keinen**
Test-Runner — dieser Slice legt alle vier als erste an. API-Route- und geschützte-Seiten-
Muster sind aus der Auth-Arbeit etabliert.

## Desired End State

Nutzer verwaltet auf `/models` seine Modellkonfigs (anlegen/editieren/löschen) mit
maskiertem Key und optionalem „Verbindung testen". In der DB liegt der Key nur als
AES-256-GCM-Ciphertext (+ IV + `key_version`), owner-only per RLS. Krypto-Roundtrip-Test
grün; ohne `ENCRYPTION_KEY` schlägt Speichern sauber fehl.

## Key Decisions Made

| Decision               | Choice                                   | Why (1 sentence)                                                              | Source |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| Verschlüsselung        | App-seitig AES-256-GCM (Web Crypto)      | Passt zum Publishable-Key-only-Modell; DB-Dump nutzlos ohne Env-Key.          | Plan   |
| Key-Rotation           | `key_version`-Tag, keine Rotations-Logik | Macht spätere Rotation möglich ohne jetzt Aufwand (YAGNI-Mittelweg).          | Plan   |
| Edit-Verhalten         | Editierbar (klassisches CRUD)            | FR-008-Immutability gilt nur für Personas; Konfig-Korrekturen brauchen Edit.  | Plan   |
| Key-Anzeige            | Nie zurückgeben, nur Maske + „gesetzt"   | Erfüllt NFR Key-Dichtheit hart; kein Leak-Pfad.                               | Plan   |
| Verbindungstest        | Optionaler Button, GET `{base}/models`   | Verifiziert ohne zu blockieren; kein Token-Verbrauch.                         | Plan   |
| Sichtbarkeit           | Immer privat (owner-only)                | Global geteilter Key = Key-Leck über Nutzergrenzen; FR-003 nennt nur Personas.| Plan   |
| Löschen                | Hard-Delete                              | FK-/Referenz-Frage gehört zu S-04 (runs-Tabelle), kein verfrühtes Design.     | Plan   |
| Tests                  | Vitest jetzt + Krypto-Helper             | Erste testbare Logik; erledigt Modul-3-Backlog-Punkt; Krypto ohne Test riskant.| Plan  |
| Fehlender Key          | Hart fehlschlagen + ConfigStatus-Hinweis | Kein Klartext-Fallback (FR-006); konsistent mit bestehendem Config-Gate.      | Plan   |
| Felder (über Pflicht)  | `label`, `created_at`/`updated_at`       | Katalog-Unterscheidung + Audit-Basis; kein `is_default`/Custom-Header (YAGNI).| Plan   |

## Scope

**In scope:** `model_configs`-Tabelle + RLS, app-seitige Krypto (+ Tests, Vitest-Setup),
`src/types.ts`, Service-Schicht, CRUD-API + Verbindungstest, geschützte `/models`-UI.

**Out of scope:** Key-Rotation-Logik, Vault/pgsodium, Immutability/Kopie, Sharing/Visibility,
`is_default`/Custom-Header, Soft-Delete, Key-Reveal in der UI, Worker-Pool-Tests.

## Architecture / Approach

Vertikal von unten: getesteter Krypto-Helper (`src/lib/crypto.ts`) → Datenschicht
(Migration + RLS + `src/types.ts` + `src/lib/services/model-configs.ts`) → API
(`src/pages/api/models/*`) → UI (`/models` + React-Island). Ver-/Entschlüsselung strikt
server-only; `decryptApiKey` existiert für S-04 und wird in diesem Slice nie im
Response-Pfad aufgerufen. Jede Schicht folgt einem bestehenden Muster.

## Phases at a Glance

| Phase                          | What it delivers                          | Key risk                                            |
| ------------------------------ | ----------------------------------------- | --------------------------------------------------- |
| 1. Test-Infra + Krypto-Helper  | Vitest + AES-256-GCM-Helper, getestet     | Web-Crypto-/Env-Mechanik; base64-Key-Handling       |
| 2. Datenschicht                | Migration+RLS, `types.ts`, Service        | RLS-Owner-Trennung korrekt; Key nie an Aufrufer     |
| 3. API-Routes                  | CRUD + Verbindungstest                     | Kein Key in Responses; sichere Fehler-Maps          |
| 4. UI                          | Geschützte `/models`-Seite + Island       | Kein Klartext-Key in Props/Markup; Edit-Key-Logik   |

**Prerequisites:** S-01 (done); Dev-`ENCRYPTION_KEY` lokal gesetzt; vor Prod GitHub-Secret `ENCRYPTION_KEY`.
**Estimated effort:** ~2–3 Sessions über 4 Phasen.

## Open Risks & Assumptions

- `ENCRYPTION_KEY` muss als 32-Byte-base64-Secret generiert und (lokal + GitHub) gepflegt
  werden, bevor das Feature nutzbar ist.
- Die FK-Beziehung zukünftiger `runs` → `model_configs` (ON DELETE) ist bewusst auf S-04
  vertagt — Hard-Delete in v1 könnte dort nachjustiert werden müssen.
- Manche OpenAI-kompatiblen Gateways implementieren `GET /models` nicht → Verbindungstest
  kann false-negative liefern (akzeptiert, weil optional).

## Success Criteria (Summary)

- Nutzer legt Modellkonfigs an/editiert/löscht sie; Key ist nie im Klartext sichtbar (UI,
  API, DB-Spalte).
- Krypto-Roundtrip-Test grün; ohne `ENCRYPTION_KEY` schlägt Speichern sauber fehl.
- RLS belegt: ein Nutzer sieht ausschließlich seine eigenen Konfigs.

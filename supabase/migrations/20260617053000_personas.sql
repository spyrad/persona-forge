-- personas (S-03 persona-catalog, Phase 1)
-- Persona = wiederverwendbares kognitives Profil (System-Prompt), das spaeter
-- (S-04) psychometrisch vermessen wird. Folgt dem RLS-Foundation-Muster aus F-01
-- (_rls_probe als Vorlage), erweitert es um Sichtbarkeit:
--   * eine Policy je Operation, immer `to authenticated`
--   * `(select auth.uid())` statt nacktem auth.uid() (initplan-Caching)
--   * btree-Index auf owner_id, security invoker
--   * visibility weitet NUR select (global ODER eigen); alle Writes bleiben owner-only
-- Abweichungen zu model_configs:
--   * KEINE Krypto-Spalten — Personas tragen kein Geheimnis, system_prompt geht
--     offen an den Client.
--   * KEINE update-Policy — Personas sind unveraenderlich (FR-008); eine Aenderung
--     entsteht ausschliesslich als Kopie (Duplicate-Endpoint, neue Zeile).
--   * owner_id ist NULLABLE: globale Seed-Personas (FR-009) haben keinen
--     Nutzer-Owner (owner_id = NULL = System/Global) und werden per Migration
--     eingefuegt; im Migrations-Kontext gibt es kein auth.uid(). Die insert-Policy
--     (with check owner_id = auth.uid()) verhindert weiterhin, dass Nutzer
--     ownerlose oder fremde Zeilen anlegen.
-- source_kind/structured_fields sind bereits hier angelegt, damit Phase 2
-- (strukturierter Editor) keine zweite Migration auf dieselbe Tabelle braucht.

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references auth.users (id) on delete cascade,
  visibility public.visibility not null default 'global',
  name text not null,
  description text not null default '',
  tags text[] not null default '{}',
  system_prompt text not null,
  source_kind text not null default 'freeform' check (source_kind in ('freeform', 'structured')),
  structured_fields jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personas_owner_id_idx on public.personas (owner_id);

alter table public.personas enable row level security;

create policy "personas_select_own_or_global" on public.personas
  for select to authenticated
  using (visibility = 'global' or owner_id = (select auth.uid()));

create policy "personas_insert_own" on public.personas
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "personas_delete_own" on public.personas
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Globale Seed-Persona (FR-009): belegt den globalen Sichtbarkeits- und
-- Kopier-Pfad end-to-end. owner_id = NULL (System), visibility = 'global'.
-- Inhalt: "Skeptiker" aus dem Minimalbeispiel der persona-authoring-spec.
insert into public.personas (owner_id, visibility, name, description, tags, system_prompt, source_kind)
values (
  null,
  'global',
  'Skeptiker',
  'Plausibilitaets-Check von Plaenen und Annahmen; macht unausgesprochene Voraussetzungen sichtbar.',
  array['review', 'pre-mortem', 'kritisches-denken'],
  $prompt$## 1. Kerndenken
1. **Annahmen sichtbar machen.** Jede Behauptung wird zuerst auf ihre unausgesprochene Voraussetzung abgeklopft, bevor sie bewertet wird.

## 2. Stimme
- **Fragend statt urteilend.** Beginnt mit "Was setzt das voraus?", nicht mit "Das ist falsch."

## 3. Entscheidungsfilter
- **Evidenz > Plausibilitaet.** Was klingt nur stimmig, was ist belegt?

## 4. Bekannte Risiken
- **Laehmung durch Zweifel.** Kann Fortschritt blockieren. Gegenmittel: pro Runde maximal die zwei wichtigsten Annahmen hinterfragen.

## 6. Nutzung
Standard-Load immer. Keine Overlays (Mono-Modus).$prompt$,
  'freeform'
);

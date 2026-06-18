-- runs + run_repetitions (S-04 oejts-measurement-run, Phase 1)
-- Ein Lauf fuehrt ein psychometrisches Instrument (v1: OEJTS) N-mal unter
-- isolierten Bedingungen gegen eine Modell-/Persona-Kombination aus. Folgt dem
-- RLS-Foundation-Muster (personas/model_configs):
--   * owner_id default auth.uid(), eine Policy je Operation, to authenticated
--   * (select auth.uid()) statt nacktem auth.uid() (initplan-Caching)
--   * btree-Indizes, security invoker
-- Besonderheiten:
--   * visibility default 'private' (privacy-by-default, S-03-Lesson F1); der
--     Privat/Global-Toggle ist S-07. Select-Policy own-or-global fuer Forward-Compat.
--   * persona_id / model_config_id sind NULLABLE mit on delete set null +
--     persona_prompt_snapshot => historische Laeufe bleiben reproduzierbar, auch
--     wenn ihre Eingaben spaeter geloescht werden.
--   * run_repetitions ist eine Child-Tabelle: RLS erbt die Sichtbarkeit ueber eine
--     exists-Subquery auf den Parent-Lauf (kein eigenes owner_id).

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visibility public.visibility not null default 'private',
  persona_id uuid references public.personas (id) on delete set null,
  model_config_id uuid references public.model_configs (id) on delete set null,
  persona_prompt_snapshot text not null,
  instrument_id text not null default 'oejts-1.2',
  repetition_count int not null check (repetition_count between 1 and 25),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  failed_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index runs_owner_id_idx on public.runs (owner_id);

alter table public.runs enable row level security;

create policy "runs_select_own_or_global" on public.runs
  for select to authenticated
  using (visibility = 'global' or owner_id = (select auth.uid()));

create policy "runs_insert_own" on public.runs
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "runs_update_own" on public.runs
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "runs_delete_own" on public.runs
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create table public.run_repetitions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  rep_index int not null,
  item_order int[] not null,
  raw_response text,
  item_values jsonb,
  status text not null default 'pending' check (status in ('pending', 'ok', 'failed')),
  error text,
  prompt_tokens int,
  completion_tokens int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, rep_index)
);

create index run_repetitions_run_id_idx on public.run_repetitions (run_id);

alter table public.run_repetitions enable row level security;

-- Child erbt die Sichtbarkeit/Owner ueber den Parent-Lauf (exists-Subquery).
create policy "run_repetitions_select_via_run" on public.run_repetitions
  for select to authenticated
  using (
    exists (
      select 1 from public.runs r
      where r.id = run_id and (r.visibility = 'global' or r.owner_id = (select auth.uid()))
    )
  );

create policy "run_repetitions_insert_via_run" on public.run_repetitions
  for insert to authenticated
  with check (
    exists (select 1 from public.runs r where r.id = run_id and r.owner_id = (select auth.uid()))
  );

create policy "run_repetitions_update_via_run" on public.run_repetitions
  for update to authenticated
  using (
    exists (select 1 from public.runs r where r.id = run_id and r.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.runs r where r.id = run_id and r.owner_id = (select auth.uid()))
  );

create policy "run_repetitions_delete_via_run" on public.run_repetitions
  for delete to authenticated
  using (
    exists (select 1 from public.runs r where r.id = run_id and r.owner_id = (select auth.uid()))
  );

-- RLS-Foundation (F-01 connect-supabase)
-- Etabliert den Datenzugriffs-Contract "Nutzer sieht nur Eigenes + Globales".
-- Invarianten fuer alle kuenftigen Tabellen (S-02/S-03 kopieren das Muster):
--   * visibility weitet NUR select; alle Writes bleiben owner-only
--   * eine Policy je Operation, immer `to authenticated`
--   * `(select auth.uid())` statt nacktem auth.uid() (initplan-Caching)
--   * btree-Index auf der owner-Spalte jeder RLS-Tabelle
--   * alles security invoker, kein security definer

create type public.visibility as enum ('private', 'global');

-- Auth-Standardanker; kein Domaenenobjekt. Owner-only, keine visibility.
-- Bleibt in F-01 leer; Anlage-Mechanik (Trigger vs. App-Insert) ist eine
-- S-01-Entscheidung.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Referenz-Muster owner+visibility. Droppbar, sobald S-02/S-03 echte
-- Tabellen nach diesem Muster tragen.
create table public._rls_probe (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visibility public.visibility not null default 'global',
  note text,
  created_at timestamptz not null default now()
);

create index _rls_probe_owner_id_idx on public._rls_probe (owner_id);

alter table public._rls_probe enable row level security;

create policy "_rls_probe_select_own_or_global" on public._rls_probe
  for select to authenticated
  using (visibility = 'global' or owner_id = (select auth.uid()));

create policy "_rls_probe_insert_own" on public._rls_probe
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "_rls_probe_update_own" on public._rls_probe
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "_rls_probe_delete_own" on public._rls_probe
  for delete to authenticated
  using (owner_id = (select auth.uid()));

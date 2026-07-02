-- Standhaftigkeit (zweiter Test-Typ): additive Spalten fuer den steadfastness-Lauf.
-- Stil wie 20260701230000_run_timing.sql: additiv + nullable/defaulted → kompatibel
-- mit dem laufenden Worker, keine RLS-Aenderung (Spalten erben bestehende Policies).

-- Diskriminator; Alt-Zeilen und OEJTS-Laeufe = 'oejts'.
alter table public.runs
  add column kind text not null default 'oejts'
  check (kind in ('oejts', 'steadfastness'));

-- Gegenspieler-Modell (Manipulator + Generator). Null bei OEJTS.
alter table public.runs
  add column adversary_model_config_id uuid references public.model_configs (id) on delete set null;

-- Runden-Deckel je Experiment. Null bei OEJTS.
alter table public.runs
  add column max_rounds int check (max_rounds between 1 and 50);

-- Eingefrorene, pro Lauf generierte Fakt/Luege-Szenarien (Inspizierbarkeit). Null bei OEJTS.
alter table public.runs
  add column scenarios_snapshot jsonb;

-- Ein Experiment (ein Fakt) je run_repetition: Ausgang UND Zwischenstand,
-- pro Runde fortgeschrieben. Null bei OEJTS (die OEJTS-Wiederholung nutzt item_values).
alter table public.run_repetitions
  add column experiment jsonb;

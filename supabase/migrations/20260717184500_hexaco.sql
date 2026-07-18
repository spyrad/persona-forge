-- HEXACO (drittes Instrument): den kind-Check um 'hexaco' erweitern.
-- Additiv + kompatibel: Default 'oejts' bleibt, bestehende Zeilen unberuehrt,
-- keine RLS-Aenderung (kind erbt die runs-Policies).
--
-- Robust gegen den Constraint-Namen: der inline-Check aus
-- 20260702120000_steadfastness.sql heisst per PG-Konvention runs_kind_check,
-- aber wir droppen namens-unabhaengig JEDEN Check-Constraint auf kind. Grund:
-- bei leerer DB wuerde `db reset` einen falschen Namen NICHT aufdecken (kein
-- hexaco-Insert), der Fehler traefe erst zur Laufzeit.
--
-- Deploy-Reihenfolge (Plan 2.5/5.3): diese Migration MUSS vor dem Code-Deploy
-- laufen, sonst scheitern HEXACO-Laeufe am alten Constraint.

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.runs'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.runs drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.runs
  add constraint runs_kind_check check (kind in ('oejts', 'steadfastness', 'hexaco'));

-- Timing (Run-Timing-Feature): Pro-Wiederholungs-Dauer + Lauf-Endzeit.
-- Additiv + nullable → kompatibel mit dem aktuell laufenden Worker, keine
-- RLS-Aenderung (Spalten erben die bestehenden Policies).

-- Wall-Zeit des LLM-Calls dieser Wiederholung (inkl. interner Retries/Backoff);
-- auch bei status='failed' gesetzt. Alt-Zeilen bleiben null.
alter table public.run_repetitions add column duration_ms int;

-- Einmalig gesetzt beim Uebergang des Laufs nach completed/failed. Alt-Zeilen null.
alter table public.runs add column finished_at timestamptz;

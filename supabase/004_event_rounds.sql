CREATE TABLE IF NOT EXISTS event_rounds (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  round_number integer     NOT NULL,
  status       text        NOT NULL DEFAULT 'waiting'
                           CHECK (status IN ('waiting', 'active', 'finished')),
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_rounds_event_round_unique UNIQUE (event_id, round_number),
  CONSTRAINT event_rounds_round_range CHECK (round_number BETWEEN 1 AND 5)
);

ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES event_rounds(id);

DROP INDEX IF EXISTS one_active_session_per_table;

CREATE UNIQUE INDEX IF NOT EXISTS one_session_per_round_table
  ON game_sessions (round_id, table_number)
  WHERE round_id IS NOT NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE event_rounds;

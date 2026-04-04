CREATE TABLE IF NOT EXISTS game_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  table_number integer     NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'in_progress', 'completed')),
  started_at   timestamptz,
  ended_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_session_per_table
  ON game_sessions (event_id, table_number)
  WHERE status IN ('pending', 'in_progress');

CREATE TABLE IF NOT EXISTS table_players (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid        NOT NULL
                         CONSTRAINT table_players_session_id_fkey
                         REFERENCES game_sessions(id) ON DELETE CASCADE,
  profile_id uuid        NOT NULL
                         CONSTRAINT table_players_profile_id_fkey
                         REFERENCES profiles(id) ON DELETE CASCADE,
  is_ready   boolean     NOT NULL DEFAULT false,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT table_players_session_profile_unique UNIQUE (session_id, profile_id)
);

ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE table_players;

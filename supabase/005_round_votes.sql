CREATE TABLE IF NOT EXISTS round_votes (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid        NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  voter_id           uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  pista_owner_id     uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  pista_clue         text        NOT NULL,
  guessed_profile_id uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT round_votes_one_guess_per_pista
    UNIQUE (session_id, voter_id, pista_owner_id, pista_clue)
);

CREATE OR REPLACE FUNCTION start_game_session(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE game_sessions
  SET    status     = 'in_progress',
         started_at = now()
  WHERE  id         = p_session_id
  AND    status     = 'pending';
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE round_votes;

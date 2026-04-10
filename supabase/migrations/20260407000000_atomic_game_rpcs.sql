CREATE OR REPLACE FUNCTION assign_player_to_table(
  p_user_id     uuid,
  p_event_id    uuid,
  p_round_number integer
)
RETURNS TABLE(session_id uuid, table_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id       uuid;
  v_partner_id     uuid;
  v_dupla_members  uuid[];
  v_met_ids        uuid[];
  v_table_num      integer;
  v_session_id     uuid;
  v_table_number   integer;
  v_dupla_count    integer;
  v_has_conflict   boolean;
  v_prev_table     integer;
  v_start_table    integer;
  i                integer;
BEGIN
  PERFORM pg_advisory_xact_lock(
    ('x' || md5(p_event_id::text || ':' || p_round_number::text))::bit(64)::bigint
  );

  INSERT INTO event_rounds (event_id, round_number)
  VALUES (p_event_id, p_round_number)
  ON CONFLICT (event_id, round_number) DO NOTHING;

  SELECT er.id INTO v_round_id
  FROM event_rounds er
  WHERE er.event_id = p_event_id
    AND er.round_number = p_round_number;

  IF NOT EXISTS (
    SELECT 1 FROM event_teams et
    WHERE et.event_id = p_event_id
      AND (et.player1_id = p_user_id OR et.player2_id = p_user_id)
  ) THEN
    INSERT INTO event_teams (event_id, player1_id, is_solo_pool, passline_unlocked)
    VALUES (p_event_id, p_user_id, true, true)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT
    CASE WHEN et.player1_id = p_user_id THEN et.player2_id ELSE et.player1_id END
  INTO v_partner_id
  FROM event_teams et
  WHERE et.event_id = p_event_id
    AND (et.player1_id = p_user_id OR et.player2_id = p_user_id)
  LIMIT 1;

  IF v_partner_id IS NOT NULL THEN
    v_dupla_members := ARRAY[p_user_id, v_partner_id];
  ELSE
    v_dupla_members := ARRAY[p_user_id];
  END IF;

  v_met_ids := ARRAY[]::uuid[];
  IF p_round_number > 1 THEN
    SELECT array_agg(DISTINCT tp2.profile_id) INTO v_met_ids
    FROM table_players tp1
    JOIN table_players tp2 ON tp1.session_id = tp2.session_id
    WHERE tp1.profile_id = ANY(v_dupla_members)
      AND tp2.profile_id <> ALL(v_dupla_members)
      AND tp1.session_id IN (
        SELECT gs.id
        FROM game_sessions gs
        JOIN event_rounds er ON er.id = gs.round_id
        WHERE er.event_id = p_event_id
          AND er.round_number < p_round_number
      );
  END IF;

  SELECT gs.table_number INTO v_prev_table
  FROM table_players tp
  JOIN game_sessions gs ON gs.id = tp.session_id
  JOIN event_rounds er ON er.id = gs.round_id
  WHERE tp.profile_id = p_user_id
    AND er.event_id = p_event_id
    AND er.round_number = p_round_number - 1
  LIMIT 1;

  v_start_table := COALESCE((v_prev_table % 10) + 1, 1);

  FOR i IN 0..9 LOOP
    v_table_num := ((v_start_table - 1 + i) % 10) + 1;

    SELECT gs.id, gs.table_number
    INTO v_session_id, v_table_number
    FROM game_sessions gs
    WHERE gs.round_id = v_round_id
      AND gs.table_number = v_table_num;

    IF v_session_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM table_players tp_check
        WHERE tp_check.session_id = v_session_id
          AND tp_check.profile_id = ANY(v_dupla_members)
      ) THEN
        v_session_id := NULL;
        CONTINUE;
      END IF;

      SELECT COUNT(DISTINCT et.id) INTO v_dupla_count
      FROM table_players tp
      JOIN event_teams et ON et.event_id = p_event_id
        AND (et.player1_id = tp.profile_id OR et.player2_id = tp.profile_id)
      WHERE tp.session_id = v_session_id;

      IF v_dupla_count >= 3 THEN
        v_session_id := NULL;
        CONTINUE;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM table_players tp_met
        WHERE tp_met.session_id = v_session_id
          AND tp_met.profile_id = ANY(v_met_ids)
      ) INTO v_has_conflict;

      IF v_has_conflict THEN
        v_session_id := NULL;
        CONTINUE;
      END IF;

      INSERT INTO table_players (session_id, profile_id)
      SELECT v_session_id, unnest(v_dupla_members)
      ON CONFLICT ON CONSTRAINT table_players_session_profile_unique DO NOTHING;

      RETURN QUERY SELECT v_session_id, v_table_number;
      RETURN;

    ELSE
      INSERT INTO game_sessions (event_id, table_number, round_id)
      VALUES (p_event_id, v_table_num, v_round_id)
      RETURNING id, game_sessions.table_number INTO v_session_id, v_table_number;

      INSERT INTO table_players (session_id, profile_id)
      SELECT v_session_id, unnest(v_dupla_members)
      ON CONFLICT ON CONSTRAINT table_players_session_profile_unique DO NOTHING;

      RETURN QUERY SELECT v_session_id, v_table_number;
      RETURN;
    END IF;
  END LOOP;

  SELECT gs.id, gs.table_number
  INTO v_session_id, v_table_number
  FROM game_sessions gs
  WHERE gs.round_id = v_round_id AND gs.table_number = 1;

  IF v_session_id IS NULL THEN
    INSERT INTO game_sessions (event_id, table_number, round_id)
    VALUES (p_event_id, 1, v_round_id)
    RETURNING id, game_sessions.table_number INTO v_session_id, v_table_number;
  END IF;

  INSERT INTO table_players (session_id, profile_id)
  SELECT v_session_id, unnest(v_dupla_members)
  ON CONFLICT ON CONSTRAINT table_players_session_profile_unique DO NOTHING;

  RETURN QUERY SELECT v_session_id, v_table_number;
END;
$$;


CREATE OR REPLACE FUNCTION end_game_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE game_sessions
  SET
    status   = 'completed',
    ended_at = now()
  WHERE id       = p_session_id
    AND status   = 'in_progress'
    AND now() >= started_at + interval '15 minutes';
END;
$$;

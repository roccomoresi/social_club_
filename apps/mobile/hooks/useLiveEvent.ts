import { useCallback, useEffect, useReducer } from 'react';
import {
  type GameSession,
  type SessionPlayer,
  fetchSessionWithPlayers,
  leaveSession as leaveSessionFn,
  setPlayerReady,
  startSession,
  supabase,
} from '../supabase';

type State = {
  session: GameSession | null;
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: GameSession }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'SESSION_UPDATED'; payload: Partial<Pick<GameSession, 'status' | 'started_at' | 'ended_at'>> }
  | { type: 'PLAYER_JOINED'; payload: SessionPlayer }
  | { type: 'PLAYER_UPDATED'; payload: SessionPlayer }
  | { type: 'PLAYER_LEFT'; payload: { id: string } };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { session: action.payload, loading: false, error: null };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SESSION_UPDATED': {
      if (!state.session) return state;
      return { ...state, session: { ...state.session, ...action.payload } };
    }
    case 'PLAYER_JOINED': {
      if (!state.session) return state;
      if (state.session.players.some((p) => p.id === action.payload.id)) return state;
      return {
        ...state,
        session: { ...state.session, players: [...state.session.players, action.payload] },
      };
    }
    case 'PLAYER_UPDATED': {
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          players: state.session.players.map((p) =>
            p.id === action.payload.id ? action.payload : p
          ),
        },
      };
    }
    case 'PLAYER_LEFT': {
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          players: state.session.players.filter((p) => p.id !== action.payload.id),
        },
      };
    }
    default:
      return state;
  }
}

export function useLiveEvent(sessionId: string, profileId: string) {
  const [state, dispatch] = useReducer(reducer, { session: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;

    dispatch({ type: 'LOAD_START' });
    fetchSessionWithPlayers(sessionId)
      .then((s) => { if (alive) dispatch({ type: 'LOAD_SUCCESS', payload: s }); })
      .catch((e: Error) => { if (alive) dispatch({ type: 'LOAD_ERROR', payload: e.message ?? 'Error' }); });

    const sessionChannel = supabase
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (!alive) return;
          dispatch({
            type: 'SESSION_UPDATED',
            payload: {
              status: payload.new.status,
              started_at: payload.new.started_at ?? null,
              ended_at: payload.new.ended_at ?? null,
            },
          });
        }
      )
      .subscribe();

    const playersChannel = supabase
      .channel(`players:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'table_players', filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          if (!alive) return;
          const { data } = await supabase
            .from('table_players')
            .select('id, profile_id, is_ready, joined_at, profiles(full_name, avatar_url, member_number)')
            .eq('id', payload.new.id)
            .single();
          if (alive && data) dispatch({ type: 'PLAYER_JOINED', payload: data as SessionPlayer });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'table_players', filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          if (!alive) return;
          const { data } = await supabase
            .from('table_players')
            .select('id, profile_id, is_ready, joined_at, profiles(full_name, avatar_url, member_number)')
            .eq('id', payload.new.id)
            .single();
          if (alive && data) dispatch({ type: 'PLAYER_UPDATED', payload: data as SessionPlayer });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'table_players', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (!alive) return;
          dispatch({ type: 'PLAYER_LEFT', payload: { id: payload.old.id as string } });
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(playersChannel);
    };
  }, [sessionId]);

  const allReady =
    (state.session?.players.length ?? 0) > 0 &&
    (state.session?.players.every((p) => p.is_ready) ?? false);

  const markReady = useCallback(async () => {
    await setPlayerReady(sessionId, profileId);
    const fresh = await fetchSessionWithPlayers(sessionId);
    dispatch({ type: 'LOAD_SUCCESS', payload: fresh });
    const nowAllReady = fresh.players.length > 0 && fresh.players.every((p) => p.is_ready);
    if (nowAllReady && fresh.status === 'pending') {
      await startSession(sessionId);
    }
  }, [sessionId, profileId]);

  const leave = useCallback(async () => {
    await leaveSessionFn(sessionId, profileId);
  }, [sessionId, profileId]);

  return { ...state, allReady, markReady, leave };
}

import { useCallback, useEffect, useReducer } from 'react';
import {
  type GameSession,
  type Pista,
  type SessionPlayer,
  endSession,
  fetchSessionWithPlayers,
  fetchTablePistas,
  leaveSession,
  setPlayerReady,
  startSession,
  supabase,
} from '../supabase';

const ROUND_SECONDS = 15 * 60;

export type GamePhase = 'waiting' | 'active' | 'finished';

type State = {
  session: GameSession | null;
  pistas: Pista[];
  votes: Record<number, string>;
  secondsLeft: number;
  phase: GamePhase;
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: 'LOAD_SUCCESS'; payload: GameSession }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'PISTAS_LOADED'; payload: Pista[] }
  | { type: 'SESSION_UPDATED'; payload: Partial<Pick<GameSession, 'status' | 'started_at' | 'ended_at'>> }
  | { type: 'PLAYER_JOINED'; payload: SessionPlayer }
  | { type: 'PLAYER_UPDATED'; payload: SessionPlayer }
  | { type: 'PLAYER_LEFT'; payload: { id: string } }
  | { type: 'TICK' }
  | { type: 'CAST_VOTE'; payload: { pistaIndex: number; votedId: string } };

function derivePhase(status: string): GamePhase {
  if (status === 'in_progress') return 'active';
  if (status === 'completed') return 'finished';
  return 'waiting';
}

function computeSecondsLeft(startedAt: string | null): number {
  if (!startedAt) return ROUND_SECONDS;
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, ROUND_SECONDS - elapsed);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_SUCCESS': {
      const phase = derivePhase(action.payload.status);
      return {
        ...state,
        session: action.payload,
        phase,
        secondsLeft:
          phase === 'active'
            ? computeSecondsLeft(action.payload.started_at)
            : state.secondsLeft,
        loading: false,
        error: null,
      };
    }
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'PISTAS_LOADED':
      return { ...state, pistas: action.payload };
    case 'SESSION_UPDATED': {
      if (!state.session) return state;
      const updated = { ...state.session, ...action.payload };
      const phase = derivePhase(updated.status);
      return {
        ...state,
        session: updated,
        phase,
        secondsLeft:
          phase === 'active' && state.phase !== 'active'
            ? computeSecondsLeft(updated.started_at)
            : state.secondsLeft,
      };
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
    case 'TICK': {
      if (state.phase !== 'active' || !state.session?.started_at) return state;
      return { ...state, secondsLeft: computeSecondsLeft(state.session.started_at) };
    }
    case 'CAST_VOTE':
      return {
        ...state,
        votes: { ...state.votes, [action.payload.pistaIndex]: action.payload.votedId },
      };
    default:
      return state;
  }
}

const initialState: State = {
  session: null,
  pistas: [],
  votes: {},
  secondsLeft: ROUND_SECONDS,
  phase: 'waiting',
  loading: true,
  error: null,
};

export function useGameEngine(sessionId: string, profileId: string) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let alive = true;

    fetchSessionWithPlayers(sessionId)
      .then((s) => { if (alive) dispatch({ type: 'LOAD_SUCCESS', payload: s }); })
      .catch((e: Error) => { if (alive) dispatch({ type: 'LOAD_ERROR', payload: e.message ?? 'Error' }); });

    const sessionCh = supabase
      .channel(`gsession:${sessionId}`)
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

    const playersCh = supabase
      .channel(`gplayers:${sessionId}`)
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
      supabase.removeChannel(sessionCh);
      supabase.removeChannel(playersCh);
    };
  }, [sessionId]);

  useEffect(() => {
    if (state.phase !== 'active' || state.pistas.length > 0) return;
    let alive = true;
    fetchTablePistas(sessionId).then((p) => {
      if (alive) dispatch({ type: 'PISTAS_LOADED', payload: p });
    });
    return () => { alive = false; };
  }, [state.phase, sessionId]);

  useEffect(() => {
    if (state.phase !== 'active') return;
    const interval = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(interval);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === 'active' && state.secondsLeft === 0) {
      endSession(sessionId);
    }
  }, [state.secondsLeft, state.phase, sessionId]);

  const allReady =
    state.session !== null &&
    state.session.players.length === 6 &&
    state.session.players.every((p) => p.is_ready);

  const amReady =
    state.session?.players.find((p) => p.profile_id === profileId)?.is_ready ?? false;

  const markReady = useCallback(async () => {
    await setPlayerReady(sessionId, profileId);
    const fresh = await fetchSessionWithPlayers(sessionId);
    dispatch({ type: 'LOAD_SUCCESS', payload: fresh });
    const nowAllReady = fresh.players.length === 6 && fresh.players.every((p) => p.is_ready);
    if (nowAllReady && fresh.status === 'pending') {
      await startSession(sessionId);
    }
  }, [sessionId, profileId]);

  const castVote = useCallback((pistaIndex: number, votedId: string) => {
    dispatch({ type: 'CAST_VOTE', payload: { pistaIndex, votedId } });
  }, []);

  const leave = useCallback(async () => {
    await leaveSession(sessionId, profileId);
  }, [sessionId, profileId]);

  return { ...state, allReady, amReady, markReady, castVote, leave };
}

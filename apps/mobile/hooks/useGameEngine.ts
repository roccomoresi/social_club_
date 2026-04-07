import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  type GameSession,
  type Pista,
  type SessionPlayer,
  endSession,
  fetchSessionVotes,
  fetchSessionWithPlayers,
  fetchTablePistas,
  leaveSession,
  setPlayerReady,
  startSession,
  submitVote,
  supabase,
} from '../supabase';

const ROUND_SECONDS = 15 * 60;

export type GamePhase = 'waiting' | 'active' | 'finished';

type State = {
  session: GameSession | null;
  pistas: Pista[];
  votes: Record<string, string>;
  secondsLeft: number;
  phase: GamePhase;
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: 'LOAD_SUCCESS'; payload: GameSession }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'PISTAS_LOADED'; payload: Pista[] }
  | { type: 'VOTES_LOADED'; payload: Record<string, string> }
  | { type: 'SESSION_UPDATED'; payload: Partial<Pick<GameSession, 'status' | 'started_at' | 'ended_at'>> }
  | { type: 'PLAYER_JOINED'; payload: SessionPlayer }
  | { type: 'PLAYER_UPDATED'; payload: SessionPlayer }
  | { type: 'PLAYER_LEFT'; payload: { id: string } }
  | { type: 'TICK' }
  | { type: 'CAST_VOTE'; payload: { pistaOwnerId: string; pistaClue: string; votedId: string } };

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
    case 'VOTES_LOADED':
      return { ...state, votes: action.payload };
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
    case 'CAST_VOTE': {
      const key = action.payload.pistaOwnerId + '::' + action.payload.pistaClue;
      return {
        ...state,
        votes: { ...state.votes, [key]: action.payload.votedId },
      };
    }
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
  const prevPhaseRef = useRef<GamePhase | 'loading'>('loading');

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    console.log(
      '[GAME_STATE] phase:',
      prev,
      '→',
      state.phase,
      JSON.stringify({
        sessionId,
        dbStatus: state.session?.status ?? null,
        playerCount: state.session?.players.length ?? 0,
        secondsLeft: state.secondsLeft,
      })
    );
  }, [state.phase]);

  useEffect(() => {
    if (state.loading) {
      console.log('[GAME_STATE] loading session | sessionId:', sessionId);
    }
  }, [state.loading]);

  useEffect(() => {
    if (Object.keys(state.votes).length > 0) {
      console.log('[VOTE_SYSTEM] votes state actualizado:', JSON.stringify(state.votes));
    }
  }, [state.votes]);

  useEffect(() => {
    let alive = true;

    fetchSessionWithPlayers(sessionId)
      .then((s) => {
        if (!alive) return;
        const derivedPhase = derivePhase(s.status);
        console.log(
          '[GAME_STATE] session cargada desde DB | status:', s.status,
          '→ phase:', derivedPhase,
          '| players:', s.players.length,
          '| started_at:', s.started_at ?? 'null'
        );
        if (derivedPhase === 'active') {
          const computed = computeSecondsLeft(s.started_at);
          console.log('[TIMER_SYNC] session ya activa al cargar | started_at:', s.started_at, '| secondsLeft calculado:', computed);
        }
        dispatch({ type: 'LOAD_SUCCESS', payload: s });
      })
      .catch((e: Error) => {
        if (!alive) return;
        console.log('[GAME_STATE] ERROR cargando sesión:', e.message);
        dispatch({ type: 'LOAD_ERROR', payload: e.message ?? 'Error' });
      });

    const sessionCh = supabase
      .channel(`gsession:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (!alive) return;
          console.log(
            '[GAME_STATE] realtime SESSION_UPDATED | nuevo status:', payload.new.status,
            '| started_at:', payload.new.started_at ?? 'null',
            '| ended_at:', payload.new.ended_at ?? 'null'
          );
          if (payload.new.status === 'in_progress') {
            const startedAt = payload.new.started_at ?? null;
            const computed = computeSecondsLeft(startedAt);
            console.log('[TIMER_SYNC] started_at recibido del servidor:', startedAt, '| secondsLeft calculado:', computed, 'seg (', Math.floor(computed / 60), 'min )');
          }
          if (payload.new.status === 'completed') {
            console.log('[GAME_STATE] sesión marcada completed por servidor | ended_at:', payload.new.ended_at ?? 'null');
          }
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
          console.log('[READY_CHECK] realtime PLAYER_JOINED | raw profile_id:', payload.new.profile_id);
          const { data } = await supabase
            .from('table_players')
            .select('id, profile_id, is_ready, joined_at, profiles(full_name, avatar_url, member_number)')
            .eq('id', payload.new.id)
            .single();
          if (alive && data) {
            const p = data as SessionPlayer;
            console.log('[READY_CHECK] PLAYER_JOINED enriquecido | name:', p.profiles?.full_name ?? 'N/A', '| is_ready:', p.is_ready);
            dispatch({ type: 'PLAYER_JOINED', payload: p });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'table_players', filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          if (!alive) return;
          console.log('[READY_CHECK] realtime PLAYER_UPDATED | profile_id:', payload.new.profile_id, '| is_ready:', payload.new.is_ready);
          const { data } = await supabase
            .from('table_players')
            .select('id, profile_id, is_ready, joined_at, profiles(full_name, avatar_url, member_number)')
            .eq('id', payload.new.id)
            .single();
          if (alive && data) {
            const p = data as SessionPlayer;
            console.log('[READY_CHECK] PLAYER_UPDATED enriquecido | name:', p.profiles?.full_name ?? 'N/A', '| is_ready:', p.is_ready);
            dispatch({ type: 'PLAYER_UPDATED', payload: p });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'table_players', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (!alive) return;
          console.log('[READY_CHECK] realtime PLAYER_LEFT | table_players.id:', payload.old.id);
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
    console.log('[DATA_FETCH] phase=active, iniciando carga de pistas y votos | sessionId:', sessionId, '| profileId:', profileId);
    Promise.all([
      fetchTablePistas(sessionId),
      fetchSessionVotes(sessionId, profileId),
    ]).then(([pistas, voteRows]) => {
      if (!alive) return;
      console.log('[DATA_FETCH] pistas recibidas:', JSON.stringify(pistas));
      console.log('[DATA_FETCH] votes previos del servidor:', JSON.stringify(voteRows));
      dispatch({ type: 'PISTAS_LOADED', payload: pistas });
      const votesMap: Record<string, string> = {};
      for (const v of voteRows) {
        votesMap[v.pista_owner_id + '::' + v.pista_clue] = v.guessed_profile_id;
      }
      console.log('[DATA_FETCH] votesMap reconstituido:', JSON.stringify(votesMap));
      dispatch({ type: 'VOTES_LOADED', payload: votesMap });
    });
    return () => { alive = false; };
  }, [state.phase, sessionId, profileId]);

  useEffect(() => {
    if (state.phase !== 'active') return;
    const interval = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(interval);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === 'active' && state.secondsLeft === 0) {
      console.log('[TIMER_SYNC] secondsLeft llegó a 0 → llamando endSession | sessionId:', sessionId);
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
    console.log('[READY_CHECK] markReady invocado | profileId:', profileId, '| sessionId:', sessionId);
    await setPlayerReady(sessionId, profileId);
    const fresh = await fetchSessionWithPlayers(sessionId);
    const readyCount = fresh.players.filter((p) => p.is_ready).length;
    console.log(
      '[READY_CHECK] estado post-setPlayerReady:', readyCount + '/' + fresh.players.length,
      'listos | players:', JSON.stringify(
        fresh.players.map((p) => ({ id: p.profile_id.slice(0, 8), name: p.profiles?.full_name ?? 'N/A', ready: p.is_ready }))
      )
    );
    dispatch({ type: 'LOAD_SUCCESS', payload: fresh });
    const nowAllReady = fresh.players.length === 6 && fresh.players.every((p) => p.is_ready);
    console.log('[READY_CHECK] nowAllReady:', nowAllReady, '| fresh.status:', fresh.status);
    if (nowAllReady && fresh.status === 'pending') {
      console.log('[READY_CHECK] TODOS LISTOS → disparando startSession | sessionId:', sessionId);
      await startSession(sessionId);
      const started = await fetchSessionWithPlayers(sessionId);
      console.log('[READY_CHECK] startSession completado | nuevo status:', started.status, '| started_at:', started.started_at ?? 'null');
      dispatch({ type: 'LOAD_SUCCESS', payload: started });
    }
  }, [sessionId, profileId]);

  const castVote = useCallback((pistaOwnerId: string, pistaClue: string, votedId: string): void => {
    const voteKey = pistaOwnerId + '::' + pistaClue;
    console.log('[VOTE_SYSTEM] castVote params:', JSON.stringify({ pistaOwnerId, pistaClue, votedId, voteKey }));
    dispatch({ type: 'CAST_VOTE', payload: { pistaOwnerId, pistaClue, votedId } });
    void submitVote(sessionId, profileId, pistaOwnerId, pistaClue, votedId).catch((e: Error) => {
      console.log('[VOTE_SYSTEM] submitVote ERROR:', e?.message ?? 'unknown');
    });
  }, [sessionId, profileId]);

  const leave = useCallback(async () => {
    await leaveSession(sessionId, profileId);
  }, [sessionId, profileId]);

  return { ...state, allReady, amReady, markReady, castVote, leave };
}

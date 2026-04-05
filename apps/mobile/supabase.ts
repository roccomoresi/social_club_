import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const searchPartner = async (searchTerm: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, member_number, instagram_user, avatar_url')
    .or(`member_number.eq.${searchTerm},instagram_user.ilike.%${searchTerm}%`)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  return data;
};

export const sendInvitation = async (eventId: string, senderId: string, receiverId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('event_invitations')
    .insert({ event_id: eventId, sender_id: senderId, receiver_id: receiverId })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
};

export type ActiveEventRow = { id: string; title: string; passline_url: string | null };

/** Próximo evento con starts_at en el futuro; si no hay ninguno, el más reciente por starts_at. */
export const fetchActiveEvent = async (): Promise<ActiveEventRow | null> => {
  const now = new Date().toISOString();

  const { data: upcoming, error: errUp } = await supabase
    .from('events')
    .select('id, title, passline_url')
    .gte('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (errUp) throw errUp;
  if (upcoming) return upcoming as ActiveEventRow;

  const { data: latest, error: errLatest } = await supabase
    .from('events')
    .select('id, title, passline_url')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errLatest) throw errLatest;
  return (latest as ActiveEventRow | null) ?? null;
};

export const getPendingInvitations = async (userId: string, eventId: string) => {
  const { data, error } = await supabase
    .from('event_invitations')
    .select('id, sender_id, profiles!event_invitations_sender_id_fkey(full_name, avatar_url, member_number)')
    .eq('receiver_id', userId)
    .eq('event_id', eventId)
    .eq('status', 'pending');

  if (error) throw error;
  return data;
};

export type TeamMember = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  member_number: string | null;
};

export type MyTeamRow = {
  id: string;
  passline_unlocked: boolean;
  is_solo_pool: boolean;
  partner: TeamMember | null;
};

/** Retorna el equipo del usuario en el evento activo, con el perfil de su pareja. */
export const getMyTeam = async (userId: string, eventId: string): Promise<MyTeamRow | null> => {
  const { data: team, error } = await supabase
    .from('event_teams')
    .select('id, player1_id, player2_id, passline_unlocked, is_solo_pool')
    .eq('event_id', eventId)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .maybeSingle();

  if (error) throw error;
  if (!team) return null;

  const partnerId = team.player1_id === userId ? team.player2_id : team.player1_id;
  let partner: TeamMember | null = null;

  if (partnerId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, member_number')
      .eq('id', partnerId)
      .maybeSingle();
    partner = data as TeamMember | null;
  }

  return { id: team.id, passline_unlocked: team.passline_unlocked, is_solo_pool: team.is_solo_pool, partner };
};

export type SentInvitationRow = {
  id: string;
  receiver: {
    full_name: string | null;
    avatar_url: string | null;
    member_number: string | null;
  } | null;
};

/** Retorna la invitación pendiente enviada por el usuario para el evento activo, si existe. */
export const getMySentInvitation = async (userId: string, eventId: string): Promise<SentInvitationRow | null> => {
  const { data, error } = await supabase
    .from('event_invitations')
    .select('id, receiver_id')
    .eq('sender_id', userId)
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { data: receiver } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, member_number')
    .eq('id', data.receiver_id)
    .maybeSingle();

  return { id: data.id, receiver: receiver as SentInvitationRow['receiver'] };
};

/** Inscribe al usuario en el pool de solitarios del evento. */
export const joinSoloPool = async (eventId: string, userId: string): Promise<MyTeamRow> => {
  const { data, error } = await supabase
    .from('event_teams')
    .insert({ event_id: eventId, player1_id: userId, is_solo_pool: true, passline_unlocked: true })
    .select('id, passline_unlocked, is_solo_pool')
    .single();

  if (error) throw error;
  return { id: data.id, passline_unlocked: data.passline_unlocked, is_solo_pool: data.is_solo_pool, partner: null };
};

/** Elimina una invitación enviada por el usuario (cancelación). */
export const cancelSentInvitation = async (invitationId: string): Promise<void> => {
  const { error } = await supabase
    .from('event_invitations')
    .delete()
    .eq('id', invitationId);
  if (error) throw error;
};

export const respondToInvitation = async (
  invitationId: string,
  eventId: string,
  senderId: string,
  receiverId: string,
  status: 'accepted' | 'rejected'
) => {
  const { error: updateError } = await supabase
    .from('event_invitations')
    .update({ status })
    .eq('id', invitationId);

  if (updateError) throw updateError;

  if (status === 'accepted') {
    const { error: teamError } = await supabase
      .from('event_teams')
      .insert({
        event_id: eventId,
        player1_id: senderId,
        player2_id: receiverId,
        passline_unlocked: true
      });

    if (teamError) throw teamError;
  }

  return true;
};

export type SessionStatus = 'pending' | 'in_progress' | 'completed';

export type SessionPlayer = {
  id: string;
  profile_id: string;
  is_ready: boolean;
  joined_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    member_number: string | null;
  } | null;
};

export type GameSession = {
  id: string;
  event_id: string;
  table_number: number;
  round_id: string | null;
  round_number: number | null;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  players: SessionPlayer[];
};

export type Pista = {
  clue: string;
  ownerId: string;
};

export const joinOrCreateSession = async (
  eventId: string,
  tableNumber: number,
  profileId: string
): Promise<GameSession> => {
  const { data: existing, error: fetchError } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('event_id', eventId)
    .eq('table_number', tableNumber)
    .in('status', ['pending', 'in_progress'])
    .maybeSingle();

  if (fetchError) throw fetchError;

  let sessionId: string;

  if (existing) {
    sessionId = existing.id;
  } else {
    const { data: created, error: createError } = await supabase
      .from('game_sessions')
      .insert({ event_id: eventId, table_number: tableNumber })
      .select('id')
      .single();
    if (createError) throw createError;
    sessionId = created.id;
  }

  await supabase
    .from('table_players')
    .upsert({ session_id: sessionId, profile_id: profileId }, { onConflict: 'session_id,profile_id' });

  return fetchSessionWithPlayers(sessionId);
};

export const fetchSessionWithPlayers = async (sessionId: string): Promise<GameSession> => {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, event_id, table_number, round_id, status, started_at, ended_at, created_at, event_rounds(round_number)')
    .eq('id', sessionId)
    .single();

  if (error) throw error;

  const { data: players, error: playersError } = await supabase
    .from('table_players')
    .select('id, profile_id, is_ready, joined_at, profiles(full_name, avatar_url, member_number)')
    .eq('session_id', sessionId)
    .order('joined_at', { ascending: true });

  if (playersError) throw playersError;

  const roundInfo = data.event_rounds as { round_number: number } | null;

  return {
    id: data.id,
    event_id: data.event_id,
    table_number: data.table_number,
    round_id: data.round_id ?? null,
    round_number: roundInfo?.round_number ?? null,
    status: data.status as SessionStatus,
    started_at: data.started_at ?? null,
    ended_at: data.ended_at ?? null,
    created_at: data.created_at,
    players: (players ?? []) as SessionPlayer[],
  };
};

export const setPlayerReady = async (sessionId: string, profileId: string): Promise<void> => {
  const { error } = await supabase
    .from('table_players')
    .update({ is_ready: true })
    .eq('session_id', sessionId)
    .eq('profile_id', profileId);
  if (error) throw error;
};

export const startSession = async (sessionId: string): Promise<void> => {
  const { error } = await supabase
    .from('game_sessions')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'pending');
  if (error) throw error;
};

export const leaveSession = async (sessionId: string, profileId: string): Promise<void> => {
  const { error } = await supabase
    .from('table_players')
    .delete()
    .eq('session_id', sessionId)
    .eq('profile_id', profileId);
  if (error) throw error;
};

export const endSession = async (sessionId: string): Promise<void> => {
  const { error } = await supabase
    .from('game_sessions')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'in_progress');
  if (error) throw error;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const fetchTablePistas = async (sessionId: string): Promise<Pista[]> => {
  const { data: players, error: playersError } = await supabase
    .from('table_players')
    .select('profile_id')
    .eq('session_id', sessionId);

  if (playersError) throw playersError;

  const profileIds = (players ?? []).map((p) => p.profile_id);
  if (!profileIds.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, trivia_1, trivia_2, trivia_3')
    .in('id', profileIds);

  if (profilesError) throw profilesError;

  const pistas: Pista[] = [];
  for (const p of profiles ?? []) {
    if (p.trivia_1) pistas.push({ clue: p.trivia_1, ownerId: p.id });
    if (p.trivia_2) pistas.push({ clue: p.trivia_2, ownerId: p.id });
    if (p.trivia_3) pistas.push({ clue: p.trivia_3, ownerId: p.id });
  }

  return shuffle(pistas);
};
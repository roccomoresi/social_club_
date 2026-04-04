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
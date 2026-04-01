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

export const sendInvitation = async (eventId: string, senderId: string, receiverId: string) => {
  const { error } = await supabase
    .from('event_invitations')
    .insert({
      event_id: eventId,
      sender_id: senderId,
      receiver_id: receiverId
    });

  if (error) {
    throw error;
  }
  
  return true;
};

export type ActiveEventRow = { id: string; title: string };

/** Próximo evento con starts_at en el futuro; si no hay ninguno, el más reciente por starts_at. */
export const fetchActiveEvent = async (): Promise<ActiveEventRow | null> => {
  const now = new Date().toISOString();

  const { data: upcoming, error: errUp } = await supabase
    .from('events')
    .select('id, title')
    .gte('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (errUp) throw errUp;
  if (upcoming) return upcoming as ActiveEventRow;

  const { data: latest, error: errLatest } = await supabase
    .from('events')
    .select('id, title')
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
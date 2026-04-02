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

export async function searchPartner(query: string) {
  // Limpiamos el '@' por si el usuario lo escribe por costumbre
  const cleanQuery = query.replace('@', '').trim();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, member_number, avatar_url')
    // Búsqueda exacta para member_number, búsqueda parcial (con comodines) para instagram_user
    .or(`member_number.eq.${cleanQuery},instagram_user.ilike.%${cleanQuery}%`)
    .limit(1) // Evita crasheos si los comodines encuentran más de un usuario parecido
    .maybeSingle();

  if (error) {
    console.error('Error buscando socio:', error.message);
    throw new Error('Hubo un error al buscar el perfil.');
  }

  return data;
}

export async function sendInvitation(eventId: string, senderId: string, receiverId: string) {
  const { error } = await supabase
    .from('event_invitations')
    .insert({
      event_id: eventId,
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending' // Estado inicial
    });

  if (error) {
    console.error('Error enviando invitación:', error.message);
    throw new Error('No se pudo enviar la invitación.');
  }
}

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

export async function respondToInvitation(invitationId: string, status: 'accepted' | 'rejected') {
  const { error } = await supabase
    .from('event_invitations')
    .update({ status })
    .eq('id', invitationId);

  if (error) throw error;
}

export async function fetchPendingInvitation(eventId: string, userId: string) {
  const { data, error } = await supabase
    .from('event_invitations')
    .select(`
      id,
      status,
      sender_id,
      event_id,
      sender:profiles!sender_id (
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('event_id', eventId)
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) {
    console.error('Error trayendo invitación:', error.message);
    return null;
  }

  return data;
}
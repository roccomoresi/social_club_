import { supabase } from '../supabase';

export async function assignTableForRound(
  userId: string,
  eventId: string,
  roundNumber: number
): Promise<{ sessionId: string; tableNumber: number }> {
  console.log('[matchmaking] RPC assign_player_to_table', { userId, eventId, roundNumber });

  const { data, error } = await supabase.rpc('assign_player_to_table', {
    p_user_id: userId,
    p_event_id: eventId,
    p_round_number: Math.floor(Number(roundNumber)),
  });

  if (error) {
    console.log('[matchmaking] RPC error:', error.message);
    throw error;
  }

  if (!data || (data as unknown[]).length === 0) {
    throw new Error('assign_player_to_table devolvió sin filas');
  }

  const row = (data as { session_id: string; table_number: number }[])[0];
  console.log('[matchmaking] RPC OK', row);
  return { sessionId: row.session_id, tableNumber: row.table_number };
}

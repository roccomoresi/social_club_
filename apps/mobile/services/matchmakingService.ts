import { joinSoloPool, supabase } from '../supabase';

type RoundRow = {
  id: string;
  round_number: number;
};

async function getOrCreateRound(eventId: string, roundNumber: number): Promise<RoundRow> {
  const { data: existing } = await supabase
    .from('event_rounds')
    .select('id, round_number')
    .eq('event_id', eventId)
    .eq('round_number', roundNumber)
    .maybeSingle();

  if (existing) return existing as RoundRow;

  const { data: created, error } = await supabase
    .from('event_rounds')
    .insert({ event_id: eventId, round_number: roundNumber })
    .select('id, round_number')
    .single();

  if (error) throw error;
  return created as RoundRow;
}

async function buildMetSet(
  userIds: string[],
  eventId: string,
  roundNumber: number
): Promise<Set<string>> {
  if (roundNumber <= 1) return new Set<string>();

  const { data: prevRounds } = await supabase
    .from('event_rounds')
    .select('id')
    .eq('event_id', eventId)
    .lt('round_number', roundNumber);

  const roundIds = (prevRounds ?? []).map((r) => r.id);
  if (!roundIds.length) return new Set<string>();

  const { data: prevSessions } = await supabase
    .from('game_sessions')
    .select('id')
    .in('round_id', roundIds);

  const allSessionIds = (prevSessions ?? []).map((s) => s.id);
  if (!allSessionIds.length) return new Set<string>();

  const { data: myRows } = await supabase
    .from('table_players')
    .select('session_id')
    .in('profile_id', userIds)
    .in('session_id', allSessionIds);

  const mySessionIds = [...new Set((myRows ?? []).map((r) => r.session_id))];
  if (!mySessionIds.length) return new Set<string>();

  const { data: coPlayers } = await supabase
    .from('table_players')
    .select('profile_id')
    .in('session_id', mySessionIds);

  return new Set<string>(
    (coPlayers ?? [])
      .map((p) => p.profile_id)
      .filter((id) => !userIds.includes(id))
  );
}

export async function assignTableForRound(
  userId: string,
  eventId: string,
  roundNumber: number
): Promise<{ sessionId: string; tableNumber: number }> {
  const round = await getOrCreateRound(eventId, roundNumber);

  let teamRow = await supabase
    .from('event_teams')
    .select('player1_id, player2_id')
    .eq('event_id', eventId)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .maybeSingle()
    .then((r) => r.data);

  if (!teamRow) {
    await joinSoloPool(eventId, userId);
    teamRow = await supabase
      .from('event_teams')
      .select('player1_id, player2_id')
      .eq('event_id', eventId)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .maybeSingle()
      .then((r) => r.data);
  }

  const partnerId = teamRow
    ? teamRow.player1_id === userId
      ? teamRow.player2_id
      : teamRow.player1_id
    : null;

  const duplaMembers = [userId, ...(partnerId ? [partnerId] : [])];

  const metSet = await buildMetSet(duplaMembers, eventId, roundNumber);

  for (let tableNum = 1; tableNum <= 10; tableNum++) {
    const { data: existingSession } = await supabase
      .from('game_sessions')
      .select('id, table_number')
      .eq('round_id', round.id)
      .eq('table_number', tableNum)
      .maybeSingle();

    if (existingSession) {
      const { data: currentPlayers } = await supabase
        .from('table_players')
        .select('profile_id')
        .eq('session_id', existingSession.id);

      const currentIds = (currentPlayers ?? []).map((p) => p.profile_id);

      if (currentIds.length > 0) {
        const orFilter = currentIds
          .flatMap((id) => [`player1_id.eq.${id}`, `player2_id.eq.${id}`])
          .join(',');
        const { data: teamsAtTable } = await supabase
          .from('event_teams')
          .select('id')
          .eq('event_id', eventId)
          .or(orFilter);
        if ((teamsAtTable?.length ?? 0) >= 3) continue;
      }

      const hasConflict = currentIds.some((pid) => metSet.has(pid));
      if (hasConflict) continue;

      const { error: upsertError } = await supabase
        .from('table_players')
        .upsert(
          duplaMembers.map((pid) => ({ session_id: existingSession.id, profile_id: pid })),
          { onConflict: 'session_id,profile_id' }
        );

      if (upsertError) continue;

      return { sessionId: existingSession.id, tableNumber: existingSession.table_number };
    }

    const { data: newSession, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({ event_id: eventId, table_number: tableNum, round_id: round.id })
      .select('id, table_number')
      .single();

    if (sessionError) continue;

    await supabase
      .from('table_players')
      .insert(duplaMembers.map((pid) => ({ session_id: newSession.id, profile_id: pid })));

    return { sessionId: newSession.id, tableNumber: newSession.table_number };
  }

  throw new Error('No hay mesa disponible que cumpla los requisitos de rotación.');
}

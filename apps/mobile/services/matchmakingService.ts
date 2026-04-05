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
  console.log('[matchmaking] START', { userId, eventId, roundNumber });

  const round = await getOrCreateRound(eventId, roundNumber);
  console.log('[matchmaking] round', round);

  let teamRow = await supabase
    .from('event_teams')
    .select('player1_id, player2_id')
    .eq('event_id', eventId)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .maybeSingle()
    .then((r) => r.data);

  if (!teamRow) {
    console.log('[matchmaking] no teamRow found, calling joinSoloPool');
    await joinSoloPool(eventId, userId);
    teamRow = await supabase
      .from('event_teams')
      .select('player1_id, player2_id')
      .eq('event_id', eventId)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .maybeSingle()
      .then((r) => r.data);
  }

  console.log('[matchmaking] teamRow', teamRow);

  const partnerId = teamRow
    ? teamRow.player1_id === userId
      ? teamRow.player2_id
      : teamRow.player1_id
    : null;

  const duplaMembers = [userId, ...(partnerId ? [partnerId] : [])];
  console.log('[matchmaking] duplaMembers', duplaMembers);

  const metSet = await buildMetSet(duplaMembers, eventId, roundNumber);
  console.log('[matchmaking] metSet size', metSet.size);

  for (let tableNum = 1; tableNum <= 10; tableNum++) {
    console.log(`[matchmaking] TABLE ${tableNum}: checking`);

    const { data: existingSession, error: fetchError } = await supabase
      .from('game_sessions')
      .select('id, table_number')
      .eq('round_id', round.id)
      .eq('table_number', tableNum)
      .maybeSingle();

    console.log(`[matchmaking] TABLE ${tableNum}: fetchError=${fetchError?.message ?? 'none'} existingSession=${existingSession?.id ?? 'null'}`);

    if (existingSession) {
      const { data: currentPlayers } = await supabase
        .from('table_players')
        .select('profile_id')
        .eq('session_id', existingSession.id);

      const currentIds = (currentPlayers ?? []).map((p) => p.profile_id);
      console.log(`[matchmaking] TABLE ${tableNum}: currentIds`, currentIds);

      if (currentIds.length > 0) {
        const orFilter = currentIds
          .flatMap((id) => [`player1_id.eq.${id}`, `player2_id.eq.${id}`])
          .join(',');
        const { data: teamsAtTable } = await supabase
          .from('event_teams')
          .select('id')
          .eq('event_id', eventId)
          .or(orFilter);
        const duplaCount = teamsAtTable?.length ?? 0;
        console.log(`[matchmaking] TABLE ${tableNum}: duplaCount=${duplaCount}`);
        if (duplaCount >= 3) {
          console.log(`[matchmaking] TABLE ${tableNum}: SKIP - full (${duplaCount} duplas)`);
          continue;
        }
      }

      const hasConflict = currentIds.some((pid) => metSet.has(pid));
      if (hasConflict) {
        console.log(`[matchmaking] TABLE ${tableNum}: SKIP - conflicto con historial`);
        continue;
      }

      const { error: upsertError } = await supabase
        .from('table_players')
        .upsert(
          duplaMembers.map((pid) => ({ session_id: existingSession.id, profile_id: pid })),
          { onConflict: 'session_id,profile_id' }
        );

      if (upsertError) {
        console.log(`[matchmaking] TABLE ${tableNum}: SKIP - upsert error: ${upsertError.message}`);
        continue;
      }

      console.log(`[matchmaking] TABLE ${tableNum}: SUCCESS (existing session)`);
      return { sessionId: existingSession.id, tableNumber: existingSession.table_number };
    }

    const { data: newSession, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({ event_id: eventId, table_number: tableNum, round_id: round.id })
      .select('id, table_number')
      .single();

    if (sessionError) {
      console.log(`[matchmaking] TABLE ${tableNum}: SKIP - create session error: ${sessionError.message}`);
      continue;
    }

    const { error: insertError } = await supabase
      .from('table_players')
      .insert(duplaMembers.map((pid) => ({ session_id: newSession.id, profile_id: pid })));

    if (insertError) {
      console.log(`[matchmaking] TABLE ${tableNum}: SKIP - insert players error: ${insertError.message}`);
      continue;
    }

    console.log(`[matchmaking] TABLE ${tableNum}: SUCCESS (new session)`);
    return { sessionId: newSession.id, tableNumber: newSession.table_number };
  }

  console.log('[matchmaking] FALLBACK: forzando mesa 1');

  const { data: fallbackSession } = await supabase
    .from('game_sessions')
    .select('id, table_number')
    .eq('round_id', round.id)
    .eq('table_number', 1)
    .maybeSingle();

  if (fallbackSession) {
    await supabase
      .from('table_players')
      .upsert(
        duplaMembers.map((pid) => ({ session_id: fallbackSession.id, profile_id: pid })),
        { onConflict: 'session_id,profile_id' }
      );
    console.log('[matchmaking] FALLBACK: joined existing session', fallbackSession.id);
    return { sessionId: fallbackSession.id, tableNumber: 1 };
  }

  const { data: forcedSession, error: forcedError } = await supabase
    .from('game_sessions')
    .insert({ event_id: eventId, table_number: 1, round_id: round.id })
    .select('id, table_number')
    .single();

  if (forcedError) {
    console.log('[matchmaking] FALLBACK ERROR', forcedError.message);
    throw new Error(`Fallback fallido: ${forcedError.message}`);
  }

  await supabase
    .from('table_players')
    .upsert(
      duplaMembers.map((pid) => ({ session_id: forcedSession.id, profile_id: pid })),
      { onConflict: 'session_id,profile_id' }
    );

  console.log('[matchmaking] FALLBACK: created new session', forcedSession.id);
  return { sessionId: forcedSession.id, tableNumber: 1 };
}

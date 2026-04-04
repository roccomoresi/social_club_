import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useGameEngine } from '../../hooks/useGameEngine';
import { MemberAvatar } from '../../components/MemberAvatar';
import { assignTableForRound } from '../../services/matchmakingService';
import { fetchActiveEvent, supabase } from '../../supabase';

const TOTAL_ROUNDS = 5;
const ROUND_SECONDS = 15 * 60;

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function GameScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const engine = useGameEngine(sessionId ?? '', user?.id ?? '');

  const [readying, setReadying] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [nextAssignment, setNextAssignment] = useState<{ sessionId: string; tableNumber: number } | null>(null);
  const [debugFilling, setDebugFilling] = useState(false);

  async function handleDebugFillTable() {
    if (!sessionId || debugFilling) return;
    setDebugFilling(true);
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', user?.id ?? '')
        .limit(5);

      if (!profiles?.length) {
        Alert.alert('Debug', 'No hay otros perfiles en la base de datos.');
        return;
      }

      await supabase
        .from('table_players')
        .upsert(
          profiles.map((p) => ({ session_id: sessionId, profile_id: p.id, is_ready: true })),
          { onConflict: 'session_id,profile_id' }
        );
    } catch (e: unknown) {
      Alert.alert('Debug Error', e instanceof Error ? e.message : 'Error desconocido.');
    } finally {
      setDebugFilling(false);
    }
  }

  async function handleReady() {
    if (readying || engine.amReady) return;
    setReadying(true);
    try {
      await engine.markReady();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No pudimos registrar tu estado.');
    } finally {
      setReadying(false);
    }
  }

  async function handleNextRound() {
    if (!user?.id || assigning) return;
    const roundNumber = engine.session?.round_number ?? 1;
    setAssigning(true);
    try {
      const event = await fetchActiveEvent();
      if (!event) throw new Error('Sin evento activo.');
      const result = await assignTableForRound(user.id, event.id, roundNumber + 1);
      setNextAssignment(result);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No pudimos asignarte una mesa.');
    } finally {
      setAssigning(false);
    }
  }

  if (engine.loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-black" edges={['top']}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  if (engine.error || !engine.session) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-black px-6" edges={['top']}>
        <Text className="mb-6 text-center text-base text-zinc-400">
          {engine.error ?? 'No se pudo cargar la sesión.'}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="rounded-xl border border-zinc-700 px-6 py-3 active:opacity-70"
        >
          <Text className="text-sm font-semibold tracking-widest text-zinc-400">VOLVER</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const session = engine.session;
  const roundNumber = session.round_number ?? 1;
  const tableNumber = session.table_number;
  const timerProgress = engine.secondsLeft / ROUND_SECONDS;
  const timerColor =
    engine.secondsLeft < 60
      ? '#ef4444'
      : engine.secondsLeft < 180
      ? '#f97316'
      : '#D4AF37';

  if (engine.phase === 'waiting') {
    const slots = Array.from({ length: 6 }, (_, i) => session.players[i] ?? null);
    const readyCount = session.players.filter((p) => p.is_ready).length;

    return (
      <SafeAreaView className="flex-1 bg-black" edges={['top']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row items-center justify-between">
            <View className="rounded-full border border-zinc-700/60 bg-zinc-900/60 px-3 py-1">
              <Text className="text-[10px] font-bold tracking-widest text-zinc-400">
                RONDA {roundNumber}/{TOTAL_ROUNDS}
              </Text>
            </View>
            <View className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1">
              <Text className="text-[10px] font-bold tracking-widest text-[#D4AF37]">
                MESA {tableNumber}
              </Text>
            </View>
          </View>

          <Text className="mb-1 text-center text-2xl font-black tracking-wider text-white">
            SALA DE ESPERA
          </Text>
          <Text className="mb-8 text-center text-sm text-zinc-600">
            {readyCount} de 6 listos
          </Text>

          <View className="mb-8 gap-3">
            {slots.map((player, i) =>
              player ? (
                <View
                  key={player.id}
                  className="flex-row items-center gap-3 rounded-2xl border border-white/[0.06] bg-zinc-950 p-3"
                >
                  <MemberAvatar
                    avatarUrl={player.profiles?.avatar_url ?? null}
                    name={player.profiles?.full_name ?? null}
                    size={44}
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-white">
                      {player.profiles?.full_name?.trim() || 'Socio'}
                      {player.profile_id === user?.id ? ' (Vos)' : ''}
                    </Text>
                    <Text className="font-mono text-xs text-zinc-600">
                      {player.profiles?.member_number || '—'}
                    </Text>
                  </View>
                  <View
                    className={`rounded-full px-2.5 py-1 ${
                      player.is_ready
                        ? 'border border-green-500/30 bg-green-500/10'
                        : 'border border-zinc-700/60 bg-zinc-900/60'
                    }`}
                  >
                    <Text
                      className={`text-[9px] font-bold tracking-widest ${
                        player.is_ready ? 'text-green-400' : 'text-zinc-500'
                      }`}
                    >
                      {player.is_ready ? 'LISTO' : 'ESPERA'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  key={`empty-${i}`}
                  className="h-16 items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50"
                >
                  <Text className="text-xs text-zinc-700">Esperando jugador…</Text>
                </View>
              )
            )}
          </View>

          {!engine.amReady ? (
            <Pressable
              onPress={handleReady}
              disabled={readying}
              className="min-h-[56px] items-center justify-center rounded-2xl bg-[#D4AF37] active:opacity-90 disabled:opacity-50"
            >
              {readying ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text className="text-sm font-black uppercase tracking-[2] text-black">
                  ESTOY LISTO
                </Text>
              )}
            </Pressable>
          ) : (
            <View className="min-h-[56px] items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/10">
              <Text className="text-sm font-bold uppercase tracking-[2] text-green-400">
                ¡Listo! Esperando a los demás…
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleDebugFillTable}
            disabled={debugFilling}
            className="mt-4 h-8 items-center justify-center rounded-lg border border-zinc-800 active:opacity-60 disabled:opacity-30"
          >
            {debugFilling ? (
              <ActivityIndicator color="#52525b" size="small" />
            ) : (
              <Text className="text-[10px] font-semibold tracking-widest text-zinc-700">
                DEBUG: LLENAR MESA
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (engine.phase === 'active') {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={['top']}>
        <View className="border-b border-zinc-900 px-6 py-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-[10px] font-bold tracking-widest text-zinc-500">
              RONDA {roundNumber}/{TOTAL_ROUNDS}
            </Text>
            <Text className="text-[10px] font-bold tracking-widest text-zinc-500">
              MESA {tableNumber}
            </Text>
          </View>
          <View className="h-1 overflow-hidden rounded-full bg-zinc-900">
            <View
              style={{ width: `${timerProgress * 100}%`, backgroundColor: timerColor }}
              className="h-full rounded-full"
            />
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-8 items-center">
            <Text
              style={{
                color: timerColor,
                fontSize: 80,
                fontWeight: '900',
                letterSpacing: -3,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatTime(engine.secondsLeft)}
            </Text>
            <Text className="text-xs font-semibold tracking-widest text-zinc-600">
              TIEMPO RESTANTE
            </Text>
          </View>

          <Text className="mb-4 text-xs font-black uppercase tracking-[3] text-zinc-500">
            Pistas del encuentro
          </Text>

          {engine.pistas.length === 0 && (
            <View className="items-center py-8">
              <ActivityIndicator color="#D4AF37" />
            </View>
          )}

          <View className="gap-4">
            {engine.pistas.map((pista, idx) => {
              const voted = engine.votes[idx];
              return (
                <View
                  key={idx}
                  className="overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-950"
                >
                  <View className="p-4">
                    <Text className="mb-4 text-base leading-relaxed text-white">
                      "{pista.clue}"
                    </Text>
                    <Text className="mb-3 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                      ¿De quién es esta pista?
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {session.players.map((player) => {
                        const isSelected = voted === player.profile_id;
                        return (
                          <Pressable
                            key={player.id}
                            onPress={() => engine.castVote(idx, player.profile_id)}
                          >
                            <View
                              style={
                                isSelected
                                  ? {
                                      borderWidth: 2,
                                      borderColor: '#D4AF37',
                                      borderRadius: 999,
                                      padding: 2,
                                    }
                                  : { padding: 2 }
                              }
                            >
                              <MemberAvatar
                                avatarUrl={player.profiles?.avatar_url ?? null}
                                name={player.profiles?.full_name ?? null}
                                size={44}
                              />
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isLastRound = roundNumber >= TOTAL_ROUNDS;
  const results = engine.pistas.map((pista, i) => {
    const owner = session.players.find((p) => p.profile_id === pista.ownerId);
    return {
      clue: pista.clue,
      ownerName: owner?.profiles?.full_name?.trim() || 'Socio',
      voted: engine.votes[i] ?? null,
      correct: engine.votes[i] === pista.ownerId,
    };
  });
  const votedCount = results.filter((r) => r.voted !== null).length;
  const correctCount = results.filter((r) => r.voted !== null && r.correct).length;

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 items-center gap-3">
          <View className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2">
            <Text className="text-[10px] font-black tracking-[4] text-[#D4AF37]">
              RONDA {roundNumber} COMPLETADA
            </Text>
          </View>
          <Text className="text-3xl font-black tracking-wider text-white">MESA {tableNumber}</Text>
          {votedCount > 0 && (
            <Text className="text-sm text-zinc-500">
              Acertaste {correctCount} de {votedCount} pistas
            </Text>
          )}
        </View>

        {results.length > 0 && (
          <View className="mb-8 gap-3">
            <Text className="mb-1 text-xs font-black uppercase tracking-[3] text-zinc-500">
              Resultados
            </Text>
            {results.map((r, i) => (
              <View
                key={i}
                className="overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-950 p-4"
              >
                <Text className="mb-3 text-sm leading-relaxed text-white">"{r.clue}"</Text>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                      Era de
                    </Text>
                    <Text className="text-sm font-bold text-zinc-200">{r.ownerName}</Text>
                  </View>
                  {r.voted !== null && (
                    <View
                      className={`rounded-full border px-3 py-1 ${
                        r.correct
                          ? 'border-green-500/30 bg-green-500/10'
                          : 'border-red-500/30 bg-red-500/10'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          r.correct ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {r.correct ? '✓ CORRECTO' : '✗ INCORRECTO'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {!isLastRound && !nextAssignment && (
          <Pressable
            onPress={handleNextRound}
            disabled={assigning}
            className="min-h-[56px] items-center justify-center rounded-2xl bg-[#D4AF37] active:opacity-90 disabled:opacity-50"
          >
            {assigning ? (
              <ActivityIndicator color="#000" />
            ) : (
              <View className="items-center">
                <Text className="text-sm font-black uppercase tracking-[2] text-black">
                  VER NUEVA MESA
                </Text>
                <Text className="text-[10px] font-semibold uppercase tracking-wider text-black/50">
                  Ronda {roundNumber + 1} de {TOTAL_ROUNDS}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {nextAssignment && (
          <View className="gap-3">
            <View className="items-center rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 py-8">
              <Text className="text-[10px] font-black uppercase tracking-[4] text-[#D4AF37]">
                Tu próxima mesa
              </Text>
              <Text className="mt-3 text-6xl font-black text-white">
                {nextAssignment.tableNumber}
              </Text>
              <Text className="mt-2 text-xs text-zinc-500">Diríjanse a esa mesa</Text>
            </View>
            <Pressable
              onPress={() => router.replace(`/game?sessionId=${nextAssignment.sessionId}`)}
              className="min-h-[52px] items-center justify-center rounded-2xl bg-white active:opacity-90"
            >
              <Text className="text-sm font-black uppercase tracking-[2] text-black">
                IR A LA MESA
              </Text>
            </Pressable>
          </View>
        )}

        {isLastRound && (
          <View className="gap-4">
            <View className="items-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 py-10">
              <Text style={{ fontSize: 48 }}>🏆</Text>
              <Text className="mt-4 text-2xl font-black tracking-wider text-white">
                ¡FIN DEL EVENTO!
              </Text>
              <Text className="mt-2 text-sm text-zinc-500">Gracias por jugar, Scrap World.</Text>
            </View>
            <Pressable
              onPress={() => router.replace('/home')}
              className="min-h-[52px] items-center justify-center rounded-2xl border border-zinc-700 active:bg-white/5"
            >
              <Text className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
                VOLVER AL INICIO
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

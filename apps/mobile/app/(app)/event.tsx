import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { MemberAvatar } from '../../components/MemberAvatar';
import {
  type ActiveEventRow,
  type MyTeamRow,
  type SentInvitationRow,
  cancelSentInvitation,
  fetchActiveEvent,
  getMyTeam,
  getMySentInvitation,
  getPendingInvitations,
  joinSoloPool,
  respondToInvitation,
  searchPartner,
  sendInvitation,
} from '../../supabase';

type MatchPhase = 'search' | 'result';

type MatchedProfile = {
  id: string;
  full_name: string | null;
  member_number: string | null;
  avatar_url: string | null;
};

type PendingInvitation = {
  id: string;
  sender_id: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    member_number: string | null;
  }[];
};

export default function EventScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [activeEvent, setActiveEvent] = useState<ActiveEventRow | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [myTeam, setMyTeam] = useState<MyTeamRow | null>(null);
  const [mySentInvitation, setMySentInvitation] = useState<SentInvitationRow | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);

  const [matchPhase, setMatchPhase] = useState<MatchPhase>('search');
  const [query, setQuery] = useState('');
  const [matchedUser, setMatchedUser] = useState<MatchedProfile | null>(null);

  // ── Loading flags ──
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [respondingInvite, setRespondingInvite] = useState(false);
  const [cancellingInvite, setCancellingInvite] = useState(false);
  const [joiningPool, setJoiningPool] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ev = await fetchActiveEvent();
        if (!alive) return;
        setActiveEvent(ev);

        if (ev && user?.id) {
          const [team, sentInvite, invites] = await Promise.all([
            getMyTeam(user.id, ev.id),
            getMySentInvitation(user.id, ev.id),
            getPendingInvitations(user.id, ev.id),
          ]);
          if (!alive) return;
          setMyTeam(team);
          setMySentInvitation(sentInvite);
          setPendingInvitations((invites ?? []) as PendingInvitation[]);
        }
      } catch (e) {
        console.error(e);
        if (alive) Alert.alert('Eventos', 'No pudimos cargar el evento. Intentá de nuevo más tarde.');
      } finally {
        if (alive) setEventLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  function resetSearchFlow() {
    setMatchPhase('search');
    setQuery('');
    setMatchedUser(null);
  }

  async function handleSearchPartner() {
    const q = query.trim();
    if (!q) {
      Alert.alert('Buscar', 'Ingresá un Member Number o Instagram.');
      return;
    }
    if (searching) return;
    setSearching(true);
    try {
      const data = await searchPartner(q);
      if (!data) {
        Alert.alert('Sin resultados', 'No encontramos un socio con ese dato.');
        return;
      }
      if (data.id === user?.id) {
        Alert.alert('Búsqueda', 'Ese perfil sos vos. Buscá a otra persona.');
        return;
      }
      setMatchedUser({
        id: data.id,
        full_name: data.full_name,
        member_number: data.member_number,
        avatar_url: data.avatar_url,
      });
      setMatchPhase('result');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Ocurrió un error al buscar.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest() {
    if (!user?.id || !matchedUser?.id || !activeEvent?.id || sending) return;
    if (matchedUser.id === user.id) {
      Alert.alert('Invitar', 'No podés invitarte a vos mismo.');
      return;
    }
    setSending(true);
    try {
      const inviteId = await sendInvitation(activeEvent.id, user.id, matchedUser.id);
      setMySentInvitation({
        id: inviteId,
        receiver: {
          full_name: matchedUser.full_name,
          avatar_url: matchedUser.avatar_url,
          member_number: matchedUser.member_number,
        },
      });
      resetSearchFlow();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No pudimos enviar la solicitud.');
    } finally {
      setSending(false);
    }
  }

  async function handleRespondInvite(invite: PendingInvitation, status: 'accepted' | 'rejected') {
    if (!activeEvent?.id || !user?.id || respondingInvite) return;
    setRespondingInvite(true);
    try {
      await respondToInvitation(invite.id, activeEvent.id, invite.sender_id, user.id, status);
      setPendingInvitations((prev) => prev.filter((i) => i.id !== invite.id));
      if (status === 'accepted') {
        const team = await getMyTeam(user.id, activeEvent.id);
        setMyTeam(team);
      } else {
        Alert.alert('Invitación rechazada', 'Le avisaremos a tu invitante.');
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No pudimos procesar la respuesta.');
    } finally {
      setRespondingInvite(false);
    }
  }

  async function handleCancelInvitation() {
    if (!mySentInvitation?.id || cancellingInvite) return;
    Alert.alert(
      'Cancelar invitación',
      '¿Seguro que querés retirar tu solicitud?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancellingInvite(true);
            try {
              await cancelSentInvitation(mySentInvitation.id);
              setMySentInvitation(null);
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No pudimos cancelar la invitación.');
            } finally {
              setCancellingInvite(false);
            }
          },
        },
      ]
    );
  }

  function handleJoinSoloPool() {
    if (!activeEvent?.id || !user?.id || joiningPool) return;
    Alert.alert(
      'Ir solo al evento',
      'Te anotaremos en la lista de solitarios. El equipo te asignará una pareja antes del evento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setJoiningPool(true);
            try {
              const team = await joinSoloPool(activeEvent.id, user.id);
              setMyTeam(team);
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No pudimos registrarte. Intentá de nuevo.');
            } finally {
              setJoiningPool(false);
            }
          },
        },
      ]
    );
  }

  function handleOpenPassline() {
    const url = activeEvent?.passline_url;
    if (!url) {
      Alert.alert('Passline', 'El link de entrada todavía no está disponible.');
      return;
    }
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'No pudimos abrir el link. Intentá de nuevo.')
    );
  }

  const eventTitle = activeEvent?.title ?? 'Sin eventos programados';

  return (
    <SafeAreaView className="flex-1 bg-[#030303]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 active:opacity-70"
            >
              <Text className="text-xs font-semibold tracking-widest text-zinc-400">VOLVER</Text>
            </Pressable>
            <View className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1">
              <Text className="text-[10px] font-bold tracking-widest text-[#D4AF37]">SOCIAL</Text>
            </View>
          </View>

          {eventLoading && (
            <View className="flex-1 items-center justify-center py-24">
              <ActivityIndicator color="#D4AF37" size="large" />
            </View>
          )}

          {!eventLoading && myTeam && (
            <View className="overflow-hidden rounded-3xl border border-[#D4AF37]/50 bg-[#080600]">
              <View className="items-center bg-[#D4AF37]/10 px-6 py-5">
                <Text className="text-[10px] font-black uppercase tracking-[4] text-[#D4AF37]">
                  {myTeam.is_solo_pool ? '⏳ En Lista de Solitarios' : '✓ Equipo Confirmado'}
                </Text>
                <Text className="mt-1.5 text-center text-xl font-bold text-white">{eventTitle}</Text>
              </View>

              {!myTeam.is_solo_pool && (
                <View className="flex-row items-start justify-center gap-6 px-6 py-8">
                  <View className="flex-1 items-center gap-2">
                    <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Vos</Text>
                    <MemberAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} size={72} />
                    <Text className="text-center text-sm font-bold leading-snug text-white" numberOfLines={2}>
                      {profile?.full_name?.trim() || 'Vos'}
                    </Text>
                    <Text className="font-mono text-xs text-zinc-500">{profile?.member_number || '—'}</Text>
                  </View>

                  <View className="mt-8 items-center justify-center px-1">
                    <Text className="text-2xl text-[#D4AF37]/30">×</Text>
                  </View>

                  <View className="flex-1 items-center gap-2">
                    <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Tu pareja</Text>
                    <MemberAvatar
                      avatarUrl={myTeam.partner?.avatar_url ?? null}
                      name={myTeam.partner?.full_name ?? null}
                      size={72}
                    />
                    <Text className="text-center text-sm font-bold leading-snug text-white" numberOfLines={2}>
                      {myTeam.partner?.full_name?.trim() || 'Pareja asignada'}
                    </Text>
                    <Text className="font-mono text-xs text-zinc-500">
                      {myTeam.partner?.member_number || '—'}
                    </Text>
                  </View>
                </View>
              )}

              {myTeam.is_solo_pool && (
                <View className="items-center gap-3 px-6 py-8">
                  <MemberAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} size={80} />
                  <Text className="text-center text-base font-bold text-white">
                    {profile?.full_name?.trim() || 'Vos'}
                  </Text>
                  <Text className="font-mono text-xs text-zinc-500">{profile?.member_number || '—'}</Text>
                  <View className="mt-2 rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-4 py-3">
                    <Text className="text-center text-sm leading-relaxed text-zinc-400">
                      El equipo te asignará una pareja{'\n'}antes del evento.
                    </Text>
                  </View>
                </View>
              )}

              <View className="mx-6 border-t border-white/[0.06]" />

              <View className="p-6">
                <Pressable
                  onPress={handleOpenPassline}
                  className="min-h-[64px] items-center justify-center rounded-2xl bg-[#D4AF37] active:opacity-90"
                >
                  <Text className="text-base font-black uppercase tracking-[2] text-black">
                    Comprar Entrada
                  </Text>
                  <Text className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-black/50">
                    Powered by Passline
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {!eventLoading && !myTeam && (
            <>
              {pendingInvitations.map((invite) => {
                const senderName = invite.profiles?.[0]?.full_name?.trim() || 'Un socio';
                return (
                  <View
                    key={invite.id}
                    className="mb-6 overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-[#0c0a07]"
                  >
                    <View className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#D4AF37]/15" />
                    <View className="p-5">
                      <Text className="mb-1 text-[10px] font-black uppercase tracking-[3] text-[#D4AF37]">
                        Bandeja de entrada
                      </Text>
                      <Text className="mb-4 text-lg font-semibold leading-snug text-white">
                        {senderName} te ha invitado a ir juntos
                      </Text>
                      <Text className="mb-5 text-sm leading-relaxed text-zinc-500">
                        Podés aceptar para aparecer como pareja en el próximo encuentro, o rechazar si preferís
                        buscar por tu cuenta.
                      </Text>
                      <View className="flex-row gap-3">
                        <Pressable
                          onPress={() => handleRespondInvite(invite, 'accepted')}
                          disabled={respondingInvite}
                          className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[#D4AF37] active:opacity-90 disabled:opacity-50"
                        >
                          {respondingInvite ? (
                            <ActivityIndicator color="#000" />
                          ) : (
                            <Text className="text-sm font-bold uppercase tracking-wide text-black">Aceptar</Text>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => handleRespondInvite(invite, 'rejected')}
                          disabled={respondingInvite}
                          className="min-h-[48px] flex-1 items-center justify-center rounded-xl border border-zinc-600 bg-zinc-900/80 active:opacity-80 disabled:opacity-50"
                        >
                          <Text className="text-sm font-bold uppercase tracking-wide text-zinc-300">Rechazar</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}

              {mySentInvitation && (
                <View className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6">
                  <Text className="mb-1 text-center text-[10px] font-bold uppercase tracking-[4] text-zinc-500">
                    Próximo evento
                  </Text>
                  <Text className="mb-8 text-center text-2xl font-bold leading-tight text-white">
                    {eventTitle}
                  </Text>

                  <View className="mb-6 items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#050505] p-6">
                    <MemberAvatar
                      avatarUrl={mySentInvitation.receiver?.avatar_url ?? null}
                      name={mySentInvitation.receiver?.full_name ?? null}
                      size={72}
                    />
                    <View className="items-center gap-1">
                      <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                        Esperando respuesta de
                      </Text>
                      <Text className="text-xl font-bold text-white">
                        {mySentInvitation.receiver?.full_name?.trim() || 'Tu invitado'}
                      </Text>
                      <Text className="font-mono text-sm text-zinc-500">
                        {mySentInvitation.receiver?.member_number || '—'}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-900/80 px-4 py-2">
                      <ActivityIndicator color="#D4AF37" size="small" />
                      <Text className="text-xs font-semibold tracking-wide text-zinc-400">
                        Solicitud pendiente
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={handleCancelInvitation}
                    disabled={cancellingInvite}
                    className="min-h-[48px] items-center justify-center rounded-2xl border border-zinc-700 active:bg-white/5 disabled:opacity-50"
                  >
                    {cancellingInvite ? (
                      <ActivityIndicator color="#71717a" />
                    ) : (
                      <Text className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                        Cancelar invitación
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}

              {!mySentInvitation && matchPhase === 'search' && (
                <View className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6">
                  <Text className="mb-1 text-center text-[10px] font-bold uppercase tracking-[4] text-zinc-500">
                    Próximo evento
                  </Text>
                  <Text className="mb-8 text-center text-2xl font-bold leading-tight text-white">
                    {eventTitle}
                  </Text>

                  <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
                    Emparejamiento
                  </Text>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Ingresá Member Number o Instagram"
                    placeholderTextColor="#52525b"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!searching}
                    className="mb-4 min-h-[52px] rounded-2xl border border-white/10 bg-[#111111] px-4 text-base text-white"
                  />
                  <Pressable
                    onPress={handleSearchPartner}
                    disabled={searching}
                    className="mb-4 min-h-[52px] items-center justify-center rounded-2xl bg-white active:opacity-90 disabled:opacity-50"
                  >
                    {searching ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text className="text-sm font-bold uppercase tracking-[2] text-black">
                        Buscar Pareja
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={handleJoinSoloPool}
                    disabled={joiningPool}
                    className="min-h-[52px] items-center justify-center rounded-2xl border-2 border-[#D4AF37]/50 active:bg-[#D4AF37]/5 disabled:opacity-50"
                  >
                    {joiningPool ? (
                      <ActivityIndicator color="#D4AF37" />
                    ) : (
                      <Text className="text-center text-xs font-bold uppercase leading-snug tracking-[1] text-[#D4AF37]">
                        VOY SOLO /{'\n'}ASÍGNENME PAREJA
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}

              {!mySentInvitation && matchPhase === 'result' && matchedUser && (
                <View className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6">
                  <Text className="mb-6 text-center text-[10px] font-bold uppercase tracking-[3] text-zinc-500">
                    Coincidencia encontrada
                  </Text>

                  <View className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#050505]">
                    <View className="flex-row items-center gap-4 p-4">
                      <MemberAvatar avatarUrl={matchedUser.avatar_url} name={matchedUser.full_name} size={64} />
                      <View className="flex-1">
                        <Text className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                          Member
                        </Text>
                        <Text className="text-lg font-bold text-white">
                          {matchedUser.full_name?.trim() || 'Socio'}
                        </Text>
                        <Text className="mt-1 font-mono text-sm text-zinc-400">
                          {matchedUser.member_number || '—'}
                        </Text>
                      </View>
                    </View>
                    <View className="border-t border-white/5 px-4 py-3">
                      <Text className="text-xs text-zinc-600">Perfil verificado en Social Club</Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={handleSendRequest}
                    disabled={sending || !activeEvent?.id}
                    className="mb-3 min-h-[52px] items-center justify-center rounded-2xl bg-[#D4AF37] active:opacity-90 disabled:opacity-50"
                  >
                    {sending ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text className="text-sm font-bold uppercase tracking-wide text-black">
                        Enviar Solicitud
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={resetSearchFlow}
                    disabled={sending}
                    className="min-h-[48px] items-center justify-center rounded-2xl border border-zinc-700 active:bg-white/5 disabled:opacity-50"
                  >
                    <Text className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                      Cancelar
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
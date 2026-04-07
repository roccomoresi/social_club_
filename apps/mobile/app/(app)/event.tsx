import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
  getConfirmedTeamsCount,
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

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
};

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = DAYS_ES[d.getDay()];
  const date = d.getDate();
  const month = MONTHS_ES[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${date} de ${month} · ${hh}:${mm}hs`;
}

function formatEndTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}hs`;
}

function computeCountdown(iso: string): Countdown {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, isPast: false };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function openMaps(location: string) {
  const q = encodeURIComponent(location);
  const url = Platform.OS === 'ios'
    ? `maps://maps.apple.com/?q=${q}`
    : `geo:0,0?q=${q}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://maps.google.com/?q=${q}`)
  );
}

export default function EventScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [activeEvent, setActiveEvent] = useState<ActiveEventRow | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [myTeam, setMyTeam] = useState<MyTeamRow | null>(null);
  const [mySentInvitation, setMySentInvitation] = useState<SentInvitationRow | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [countdown, setCountdown] = useState<Countdown | null>(null);

  const [matchPhase, setMatchPhase] = useState<MatchPhase>('search');
  const [query, setQuery] = useState('');
  const [matchedUser, setMatchedUser] = useState<MatchedProfile | null>(null);

  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [respondingInvite, setRespondingInvite] = useState(false);
  const [cancellingInvite, setCancellingInvite] = useState(false);
  const [joiningPool, setJoiningPool] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ev = await fetchActiveEvent();
        if (!alive) return;
        setActiveEvent(ev);
        if (ev) {
          if (ev.starts_at) setCountdown(computeCountdown(ev.starts_at));
          const [team, sentInvite, invites, count] = await Promise.all([
            user?.id ? getMyTeam(user.id, ev.id) : Promise.resolve(null),
            user?.id ? getMySentInvitation(user.id, ev.id) : Promise.resolve(null),
            user?.id ? getPendingInvitations(user.id, ev.id) : Promise.resolve([]),
            getConfirmedTeamsCount(ev.id),
          ]);
          if (!alive) return;
          setMyTeam(team);
          setMySentInvitation(sentInvite);
          setPendingInvitations((invites ?? []) as PendingInvitation[]);
          setConfirmedCount(count);
        }
      } catch (e) {
        console.error(e);
        if (alive) Alert.alert('Eventos', 'No pudimos cargar el evento.');
      } finally {
        if (alive) setEventLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!activeEvent?.starts_at) return;
    const interval = setInterval(() => {
      setCountdown(computeCountdown(activeEvent.starts_at!));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeEvent?.starts_at]);

  function resetSearchFlow() {
    setMatchPhase('search');
    setQuery('');
    setMatchedUser(null);
  }

  async function handleSearchPartner() {
    const q = query.trim();
    if (!q) { Alert.alert('Buscar', 'Ingresá un Member Number o Instagram.'); return; }
    if (searching) return;
    setSearching(true);
    try {
      const data = await searchPartner(q);
      if (!data) { Alert.alert('Sin resultados', 'No encontramos un socio con ese dato.'); return; }
      if (data.id === user?.id) { Alert.alert('Búsqueda', 'Ese perfil sos vos.'); return; }
      setMatchedUser({ id: data.id, full_name: data.full_name, member_number: data.member_number, avatar_url: data.avatar_url });
      setMatchPhase('result');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Ocurrió un error al buscar.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest() {
    if (!user?.id || !matchedUser?.id || !activeEvent?.id || sending) return;
    setSending(true);
    try {
      const inviteId = await sendInvitation(activeEvent.id, user.id, matchedUser.id);
      setMySentInvitation({
        id: inviteId,
        receiver: { full_name: matchedUser.full_name, avatar_url: matchedUser.avatar_url, member_number: matchedUser.member_number },
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
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No pudimos procesar la respuesta.');
    } finally {
      setRespondingInvite(false);
    }
  }

  async function handleCancelInvitation() {
    if (!mySentInvitation?.id || cancellingInvite) return;
    Alert.alert('Cancelar invitación', '¿Seguro que querés retirar tu solicitud?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar', style: 'destructive',
        onPress: async () => {
          setCancellingInvite(true);
          try {
            await cancelSentInvitation(mySentInvitation.id);
            setMySentInvitation(null);
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No pudimos cancelar.');
          } finally {
            setCancellingInvite(false);
          }
        },
      },
    ]);
  }

  function handleJoinSoloPool() {
    if (!activeEvent?.id || !user?.id || joiningPool) return;
    Alert.alert('Ir solo al evento', 'Te anotaremos en la lista de solitarios. El equipo te asignará una pareja antes del evento.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          setJoiningPool(true);
          try {
            const team = await joinSoloPool(activeEvent.id, user.id);
            setMyTeam(team);
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No pudimos registrarte.');
          } finally {
            setJoiningPool(false);
          }
        },
      },
    ]);
  }

  function handleOpenPassline() {
    const url = activeEvent?.passline_url;
    if (!url) { Alert.alert('Passline', 'El link de entrada todavía no está disponible.'); return; }
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No pudimos abrir el link.'));
  }

  const maxTeams = activeEvent?.capacity ? Math.floor(activeEvent.capacity / 2) : 30;
  const fillRatio = Math.min(confirmedCount / maxTeams, 1);
  const spotsLeft = Math.max(maxTeams - confirmedCount, 0);

  return (
    <SafeAreaView className="flex-1 bg-[#030303]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, paddingTop: 8 }}
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
              <Text className="text-[10px] font-bold tracking-widest text-[#D4AF37]">EVENTO</Text>
            </View>
          </View>

          {eventLoading && (
            <View className="flex-1 items-center justify-center py-24">
              <ActivityIndicator color="#D4AF37" size="large" />
            </View>
          )}

          {!eventLoading && activeEvent && (
            <>
              <View className="mb-4 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0a0a0a]">
                <View className="border-b border-white/[0.05] px-6 py-5">
                  <Text className="mb-1 text-[9px] font-black uppercase tracking-[4] text-zinc-600">
                    SOCIAL CLUB · PRÓXIMO ENCUENTRO
                  </Text>
                  <Text className="text-2xl font-black uppercase leading-tight tracking-wide text-white">
                    {activeEvent.title}
                  </Text>
                </View>

                {activeEvent.starts_at && (
                  <View className="border-b border-white/[0.05] px-6 py-4">
                    <Text className="mb-1 text-[8px] font-bold uppercase tracking-[3] text-zinc-600">
                      FECHA Y HORA
                    </Text>
                    <Text className="text-sm font-semibold text-zinc-200">
                      {formatDate(activeEvent.starts_at)}
                      {activeEvent.ends_at ? ` – ${formatEndTime(activeEvent.ends_at)}` : ''}
                    </Text>
                  </View>
                )}

                {countdown && !countdown.isPast && (
                  <View className="border-b border-white/[0.05] px-6 py-4">
                    <Text className="mb-3 text-[8px] font-bold uppercase tracking-[3] text-zinc-600">
                      CUENTA REGRESIVA
                    </Text>
                    <View className="flex-row gap-3">
                      {[
                        { value: countdown.days, label: 'DÍAS' },
                        { value: countdown.hours, label: 'HRS' },
                        { value: countdown.minutes, label: 'MIN' },
                        { value: countdown.seconds, label: 'SEG' },
                      ].map(({ value, label }) => (
                        <View
                          key={label}
                          className="flex-1 items-center rounded-xl border border-[#D4AF37]/15 bg-[#D4AF37]/5 py-3"
                        >
                          <Text className="text-2xl font-black text-[#D4AF37]">{pad(value)}</Text>
                          <Text className="mt-0.5 text-[7px] font-bold tracking-widest text-zinc-600">
                            {label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {countdown?.isPast && (
                  <View className="border-b border-white/[0.05] px-6 py-4">
                    <View className="flex-row items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
                      <Animated.View style={{ opacity: pulseAnim }} className="h-2 w-2 rounded-full bg-green-400" />
                      <Text className="text-xs font-bold uppercase tracking-widest text-green-400">
                        Evento en curso
                      </Text>
                    </View>
                  </View>
                )}

                {activeEvent.location && (
                  <Pressable
                    onPress={() => openMaps(activeEvent.location!)}
                    className="border-b border-white/[0.05] px-6 py-4 active:bg-white/[0.03]"
                  >
                    <Text className="mb-1 text-[8px] font-bold uppercase tracking-[3] text-zinc-600">
                      UBICACIÓN
                    </Text>
                    <View className="flex-row items-center justify-between">
                      <Text className="flex-1 text-sm font-semibold text-zinc-200">
                        {activeEvent.location}
                      </Text>
                      <Text className="ml-3 text-xs font-bold tracking-wider text-[#D4AF37]">
                        MAPS →
                      </Text>
                    </View>
                  </Pressable>
                )}

                <View className="px-6 py-4">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-[8px] font-bold uppercase tracking-[3] text-zinc-600">
                      AFORO
                    </Text>
                    <Text className="text-[10px] font-bold text-zinc-500">
                      {confirmedCount}/{maxTeams} parejas
                      {spotsLeft > 0 ? ` · ${spotsLeft} lugares disponibles` : ' · COMPLETO'}
                    </Text>
                  </View>
                  <View className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
                    <View
                      style={{ width: `${fillRatio * 100}%` }}
                      className="h-full rounded-full bg-[#D4AF37]"
                    />
                  </View>
                </View>
              </View>

              <Text className="mb-3 mt-2 text-[9px] font-black uppercase tracking-[4] text-zinc-600">
                TU ACCESO
              </Text>

              {pendingInvitations.map((invite) => {
                const senderName = invite.profiles?.[0]?.full_name?.trim() || 'Un socio';
                return (
                  <View
                    key={invite.id}
                    className="mb-4 overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-[#0c0a07]"
                  >
                    <View className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#D4AF37]/10" />
                    <View className="p-5">
                      <Text className="mb-1 text-[9px] font-black uppercase tracking-[3] text-[#D4AF37]">
                        Invitación recibida
                      </Text>
                      <Text className="mb-3 text-base font-semibold leading-snug text-white">
                        {senderName} te invitó a ir juntos
                      </Text>
                      <View className="flex-row gap-3">
                        <Pressable
                          onPress={() => handleRespondInvite(invite, 'accepted')}
                          disabled={respondingInvite}
                          className="min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#D4AF37] active:opacity-90 disabled:opacity-50"
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
                          className="min-h-[44px] flex-1 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/80 active:opacity-80 disabled:opacity-50"
                        >
                          <Text className="text-sm font-bold uppercase tracking-wide text-zinc-400">Rechazar</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}

              {myTeam && (
                <View className="overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-[#080600]">
                  <View className="items-center border-b border-white/[0.05] bg-[#D4AF37]/8 px-6 py-4">
                    <View className="mb-1 flex-row items-center gap-2">
                      <Animated.View style={{ opacity: pulseAnim }} className="h-2 w-2 rounded-full bg-[#D4AF37]" />
                      <Text className="text-[9px] font-black uppercase tracking-[4] text-[#D4AF37]">
                        {myTeam.is_solo_pool ? 'En lista de solitarios' : 'Equipo confirmado'}
                      </Text>
                    </View>
                  </View>

                  {!myTeam.is_solo_pool && (
                    <View className="flex-row items-start justify-center gap-6 px-6 py-6">
                      <View className="flex-1 items-center gap-2">
                        <Text className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Vos</Text>
                        <MemberAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} size={68} />
                        <Text className="text-center text-sm font-bold leading-snug text-white" numberOfLines={2}>
                          {profile?.full_name?.trim() || 'Vos'}
                        </Text>
                        <Text className="font-mono text-xs text-zinc-500">{profile?.member_number || '—'}</Text>
                      </View>
                      <View className="mt-8 items-center px-1">
                        <Text className="text-2xl text-[#D4AF37]/30">×</Text>
                      </View>
                      <View className="flex-1 items-center gap-2">
                        <Text className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Tu pareja</Text>
                        <MemberAvatar avatarUrl={myTeam.partner?.avatar_url ?? null} name={myTeam.partner?.full_name ?? null} size={68} />
                        <Text className="text-center text-sm font-bold leading-snug text-white" numberOfLines={2}>
                          {myTeam.partner?.full_name?.trim() || 'Pareja asignada'}
                        </Text>
                        <Text className="font-mono text-xs text-zinc-500">{myTeam.partner?.member_number || '—'}</Text>
                      </View>
                    </View>
                  )}

                  {myTeam.is_solo_pool && (
                    <View className="items-center gap-3 px-6 py-6">
                      <MemberAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} size={72} />
                      <Text className="text-center text-base font-bold text-white">{profile?.full_name?.trim() || 'Vos'}</Text>
                      <View className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                        <Text className="text-center text-sm leading-relaxed text-zinc-400">
                          El equipo te asignará una pareja{'\n'}antes del evento.
                        </Text>
                      </View>
                    </View>
                  )}

                  <View className="mx-6 border-t border-white/[0.05]" />

                  <View className="p-6">
                    <Pressable
                      onPress={handleOpenPassline}
                      className="min-h-[60px] items-center justify-center rounded-2xl bg-[#D4AF37] active:opacity-90"
                    >
                      <Text className="text-sm font-black uppercase tracking-[2] text-black">Comprar Entrada</Text>
                      <Text className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-black/50">
                        Powered by Passline
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {!myTeam && mySentInvitation && (
                <View className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
                  <View className="mb-5 items-center gap-3 rounded-xl border border-white/[0.06] bg-[#050505] p-5">
                    <MemberAvatar avatarUrl={mySentInvitation.receiver?.avatar_url ?? null} name={mySentInvitation.receiver?.full_name ?? null} size={64} />
                    <View className="items-center gap-1">
                      <Text className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Esperando respuesta de</Text>
                      <Text className="text-lg font-bold text-white">{mySentInvitation.receiver?.full_name?.trim() || 'Tu invitado'}</Text>
                      <Text className="font-mono text-xs text-zinc-500">{mySentInvitation.receiver?.member_number || '—'}</Text>
                    </View>
                    <View className="flex-row items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-900/80 px-3 py-1.5">
                      <ActivityIndicator color="#D4AF37" size="small" />
                      <Text className="text-xs font-semibold tracking-wide text-zinc-400">Solicitud pendiente</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={handleCancelInvitation}
                    disabled={cancellingInvite}
                    className="min-h-[44px] items-center justify-center rounded-xl border border-zinc-800 active:bg-white/5 disabled:opacity-50"
                  >
                    {cancellingInvite ? (
                      <ActivityIndicator color="#71717a" />
                    ) : (
                      <Text className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Cancelar invitación</Text>
                    )}
                  </Pressable>
                </View>
              )}

              {!myTeam && !mySentInvitation && matchPhase === 'search' && (
                <View className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
                  <Text className="mb-1 text-[8px] font-bold uppercase tracking-[3] text-zinc-600">EMPAREJAMIENTO</Text>
                  <Text className="mb-5 text-sm leading-relaxed text-zinc-400">
                    Buscá a tu pareja por Member Number o Instagram para ir juntos al evento.
                  </Text>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Member Number o @instagram"
                    placeholderTextColor="#52525b"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!searching}
                    className="mb-3 min-h-[50px] rounded-xl border border-white/10 bg-[#111111] px-4 text-sm text-white"
                  />
                  <Pressable
                    onPress={handleSearchPartner}
                    disabled={searching}
                    className="mb-3 min-h-[50px] items-center justify-center rounded-xl bg-white active:opacity-90 disabled:opacity-50"
                  >
                    {searching ? <ActivityIndicator color="#000" /> : (
                      <Text className="text-sm font-bold uppercase tracking-[2] text-black">Buscar Pareja</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={handleJoinSoloPool}
                    disabled={joiningPool}
                    className="min-h-[50px] items-center justify-center rounded-xl border border-[#D4AF37]/40 active:bg-[#D4AF37]/5 disabled:opacity-50"
                  >
                    {joiningPool ? <ActivityIndicator color="#D4AF37" /> : (
                      <Text className="text-xs font-bold uppercase tracking-[1] text-[#D4AF37]">
                        Voy solo · Asígnenme pareja
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}

              {!myTeam && !mySentInvitation && matchPhase === 'result' && matchedUser && (
                <View className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
                  <Text className="mb-4 text-[8px] font-bold uppercase tracking-[3] text-zinc-600">Coincidencia encontrada</Text>
                  <View className="mb-4 overflow-hidden rounded-xl border border-white/[0.07] bg-[#050505]">
                    <View className="flex-row items-center gap-4 p-4">
                      <MemberAvatar avatarUrl={matchedUser.avatar_url} name={matchedUser.full_name} size={60} />
                      <View className="flex-1">
                        <Text className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-zinc-600">Member</Text>
                        <Text className="text-base font-bold text-white">{matchedUser.full_name?.trim() || 'Socio'}</Text>
                        <Text className="mt-0.5 font-mono text-xs text-zinc-400">{matchedUser.member_number || '—'}</Text>
                      </View>
                    </View>
                    <View className="border-t border-white/[0.05] px-4 py-2.5">
                      <Text className="text-xs text-zinc-600">Perfil verificado · Social Club</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={handleSendRequest}
                    disabled={sending || !activeEvent?.id}
                    className="mb-3 min-h-[50px] items-center justify-center rounded-xl bg-[#D4AF37] active:opacity-90 disabled:opacity-50"
                  >
                    {sending ? <ActivityIndicator color="#000" /> : (
                      <Text className="text-sm font-bold uppercase tracking-wide text-black">Enviar Solicitud</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={resetSearchFlow}
                    disabled={sending}
                    className="min-h-[44px] items-center justify-center rounded-xl border border-zinc-800 active:bg-white/5 disabled:opacity-50"
                  >
                    <Text className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Cancelar</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {!eventLoading && !activeEvent && (
            <View className="flex-1 items-center justify-center py-24 gap-3">
              <Text className="text-4xl">🎭</Text>
              <Text className="text-base font-bold text-zinc-400">Sin eventos programados</Text>
              <Text className="text-sm text-zinc-600">Volvé pronto para el próximo encuentro.</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

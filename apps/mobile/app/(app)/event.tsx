import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { fetchActiveEvent, searchPartner, sendInvitation } from '../../supabase';

type MatchPhase = 'search' | 'result';

type MatchedProfile = {
  id: string;
  full_name: string | null;
  member_number: string | null;
  avatar_url: string | null;
};

function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function EventScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [invitePending, setInvitePending] = useState(true);
  const [matchPhase, setMatchPhase] = useState<MatchPhase>('search');
  const [query, setQuery] = useState('');
  const [matchedUser, setMatchedUser] = useState<MatchedProfile | null>(null);

  const [activeEvent, setActiveEvent] = useState<{ id: string; title: string } | null>(null);
  const [eventLoading, setEventLoading] = useState(true);

  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ev = await fetchActiveEvent();
        if (alive) setActiveEvent(ev);
      } catch (e) {
        console.error(e);
        Alert.alert('Eventos', 'No pudimos cargar el evento activo. Intentá de nuevo más tarde.');
      } finally {
        if (alive) setEventLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
      const msg = e instanceof Error ? e.message : 'Ocurrió un error al buscar.';
      Alert.alert('Error', msg);
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest() {
    if (!user?.id) {
      Alert.alert('Sesión', 'No hay sesión activa.');
      return;
    }
    if (!matchedUser?.id) {
      Alert.alert('Invitar', 'No hay un socio seleccionado.');
      return;
    }
    if (!activeEvent?.id) {
      Alert.alert('Evento', 'No hay un evento activo cargado. No podés enviar la solicitud.');
      return;
    }
    if (matchedUser.id === user.id) {
      Alert.alert('Invitar', 'No podés invitarte a vos mismo.');
      return;
    }
    if (sending) return;

    setSending(true);
    try {
      await sendInvitation(activeEvent.id, user.id, matchedUser.id);
      resetSearchFlow();
      Alert.alert('¡Listo!', 'Tu solicitud fue enviada.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No pudimos enviar la solicitud.';
      Alert.alert('Error', msg);
    } finally {
      setSending(false);
    }
  }

  function handleCancelResult() {
    resetSearchFlow();
  }

  function handleSoloOrAssign() {
    Alert.alert(
      'Lista de espera',
      'Te asignaremos una pareja antes del evento. Recibirás un aviso en la app.'
    );
  }

  function handleAcceptInvite() {
    Alert.alert('Invitación aceptada', 'Quedaron confirmados como pareja para el evento.');
    setInvitePending(false);
  }

  function handleRejectInvite() {
    Alert.alert('Invitación rechazada', 'Le avisaremos a tu invitante.');
    setInvitePending(false);
  }

  const eventTitle = eventLoading
    ? 'Cargando evento…'
    : activeEvent?.title ?? 'Sin eventos programados';

  const displayName = matchedUser?.full_name?.trim() || 'Socio';
  const displayNumber = matchedUser?.member_number || '—';
  const avatarInitials = initialsFromName(matchedUser?.full_name);

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
          {/* Header */}
          <View className="mb-6 flex-row items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 active:opacity-70"
            >
              <Text className="text-xs font-semibold tracking-widest text-zinc-400">VOLVER</Text>
            </Pressable>
            <View className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1">
              <Text className="text-[10px] font-bold tracking-[0.2em] text-[#D4AF37]">SOCIAL</Text>
            </View>
          </View>

          {/* Estado 3: invitación pendiente (banner destacado) */}
          {invitePending && (
            <View className="mb-8 overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-[#0c0a07] shadow-lg shadow-black/80">
              <View className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#D4AF37]/15" />
              <View className="p-5">
                <Text className="mb-1 text-[10px] font-black uppercase tracking-[0.25em] text-[#D4AF37]">
                  Bandeja de entrada
                </Text>
                <Text className="mb-4 text-lg font-semibold leading-snug text-white">
                  Usuario Secreto te ha invitado a ir juntos
                </Text>
                <Text className="mb-5 text-sm leading-relaxed text-zinc-500">
                  Podés aceptar para aparecer como pareja en el próximo encuentro, o rechazar si preferís
                  buscar por tu cuenta.
                </Text>
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={handleAcceptInvite}
                    className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[#D4AF37] active:opacity-90"
                  >
                    <Text className="text-sm font-bold uppercase tracking-wide text-black">Aceptar</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleRejectInvite}
                    className="min-h-[48px] flex-1 items-center justify-center rounded-xl border border-zinc-600 bg-zinc-900/80 active:opacity-80"
                  >
                    <Text className="text-sm font-bold uppercase tracking-wide text-zinc-300">Rechazar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Estado 1: buscador */}
          {matchPhase === 'search' && (
            <View className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6">
              <Text className="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">
                Próximo evento
              </Text>
              <Text className="mb-8 text-center text-2xl font-bold leading-tight text-white">{eventTitle}</Text>

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
                  <Text className="text-sm font-bold uppercase tracking-[0.15em] text-black">Buscar Pareja</Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleSoloOrAssign}
                className="min-h-[52px] items-center justify-center rounded-2xl border-2 border-[#D4AF37]/50 bg-transparent active:bg-[#D4AF37]/5"
              >
                <Text className="text-center text-xs font-bold uppercase leading-snug tracking-[0.12em] text-[#D4AF37]">
                  VOY SOLO /{'\n'}ASÍGNENME PAREJA
                </Text>
              </Pressable>
            </View>
          )}

          {/* Estado 2: resultado de búsqueda */}
          {matchPhase === 'result' && matchedUser && (
            <View className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6">
              <Text className="mb-6 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                Coincidencia encontrada
              </Text>

              <View className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#050505]">
                <View className="flex-row items-center gap-4 p-4">
                  {matchedUser.avatar_url ? (
                    <Image
                      source={{ uri: matchedUser.avatar_url }}
                      style={{ width: 64, height: 64, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/35 bg-[#141210]">
                      <Text className="text-lg font-black text-[#D4AF37]">{avatarInitials}</Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                      Member
                    </Text>
                    <Text className="text-lg font-bold text-white">{displayName}</Text>
                    <Text className="mt-1 font-mono text-sm text-zinc-400">{displayNumber}</Text>
                  </View>
                </View>
                <View className="border-t border-white/5 px-4 py-3">
                  <Text className="text-xs text-zinc-600">Perfil verificado en Scrap World</Text>
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
                  <Text className="text-sm font-bold uppercase tracking-wide text-black">Enviar Solicitud</Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleCancelResult}
                disabled={sending}
                className="min-h-[48px] items-center justify-center rounded-2xl border border-zinc-700 bg-transparent active:bg-white/5"
              >
                <Text className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Cancelar</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

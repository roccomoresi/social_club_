import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MemberCard } from '../../components/MemberCard';
import { ScannerModal } from '../../components/ScannerModal';
import { fetchActiveEvent } from '../../supabase';
import { assignTableForRound } from '../../services/matchmakingService';
import { useAuth } from '../../contexts/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [joining, setJoining] = useState(false);

  async function handleScan(_data: string) {
    setIsScannerVisible(false);
    if (!user?.id) return;
    setJoining(true);
    try {
      const event = await fetchActiveEvent();
      if (!event) {
        Alert.alert('Sin evento', 'No hay un evento activo en este momento.');
        return;
      }
      const { sessionId } = await assignTableForRound(user.id, event.id, 1);
      router.push(`/game?sessionId=${sessionId}`);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No pudimos asignarte una mesa.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="h-14 items-center justify-center border-b border-zinc-900">
        <Text className="text-xs font-black tracking-[5px] text-white">SCRAP WORLD</Text>
      </View>

      <View className="flex-1 items-center justify-between px-6 py-8">
        <MemberCard
          name={profile?.full_name || 'NUEVO SOCIO'}
          role={profile?.role || 'MEMBER'}
          id={profile?.member_number || 'SW-PENDING'}
        />

        <Pressable
          className="w-full min-h-[56px] items-center justify-center rounded-2xl bg-[#D4AF37] active:opacity-90 disabled:opacity-50"
          onPress={() => setIsScannerVisible(true)}
          disabled={joining}
        >
          {joining ? (
            <ActivityIndicator color="#000" />
          ) : (
            <View className="items-center">
              <Text className="text-sm font-black tracking-[2px] text-black">INGRESAR AL EVENTO</Text>
              <Text className="text-[10px] font-semibold tracking-widest text-black/50">
                Escanear QR de entrada
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScan={handleScan}
      />
    </SafeAreaView>
  );
}

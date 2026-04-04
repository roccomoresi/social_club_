import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { MemberCard } from '../../components/MemberCard';
import { ScannerModal } from '../../components/ScannerModal';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);

  const userData = {
    name: profile?.full_name || 'NUEVO SOCIO',
    number: profile?.member_number || 'SW-PENDING',
    role: profile?.role || 'MEMBER',
    id: user?.id ?? '',
    instagram: profile?.instagram_user || '',
    secretFact: profile?.secret_fact || '',
    avatarUrl: profile?.avatar_url || '',
  };

  async function handleScan(scannedId: string) {
    setIsScannerVisible(false);
    const { data } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('member_number', scannedId)
      .single();

    if (data) {
      Alert.alert('ACCESO CONCEDIDO', `Socio: ${data.full_name}\nRole: ${data.role}`);
    } else {
      Alert.alert('ERROR', 'Socio no encontrado o código inválido');
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Data = result.assets[0].base64;
      setLoading(true);
      try {
        const img = result.assets[0];
        const ext = img.uri.split('.').pop();
        const fileName = `${userData.id}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, decode(base64Data), {
            contentType: `image/${ext}`,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', userData.id);

        if (updateError) throw updateError;

        await refreshProfile(userData.id);
        Alert.alert('¡Éxito!', 'Foto de perfil actualizada.');
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'No pudimos subir la foto.');
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleLogout() {
    await signOut();
  }

  return (
    <SafeAreaView className="flex-1 bg-black">

      {/* Navbar */}
      <View className="h-14 items-center justify-center border-b border-zinc-900">
        <Text className="text-xs font-black tracking-[5px] text-white">SCRAP WORLD</Text>
      </View>

      {/* Contenido scrollable */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Tarjeta de membresía */}
        <MemberCard name={userData.name} role={userData.role} id={userData.number} />

        {/* Datos de perfil */}
        <View className="mt-5 rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
          <View>
            <Text className="text-[10px] font-bold tracking-[2px] text-[#D4AF37]">INSTAGRAM</Text>
            <Text className="mt-1 text-base text-white">
              @{userData.instagram || 'No configurado'}
            </Text>
          </View>
          <View className="my-4 h-px bg-zinc-900" />
          <View>
            <Text className="text-[10px] font-bold tracking-[2px] text-[#D4AF37]">TU DATO SECRETO</Text>
            <Text className="mt-1 text-sm italic leading-relaxed text-zinc-400">
              "{userData.secretFact || 'Sin dato'}"
            </Text>
          </View>
        </View>

        {/* Acciones */}
        <View className="mt-4 gap-3">
          <Pressable
            className="h-12 items-center justify-center rounded-xl border border-zinc-800 active:bg-white/5 disabled:opacity-50"
            onPress={pickImage}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-xs font-semibold tracking-[2px] text-zinc-400">
                ACTUALIZAR FOTO
              </Text>
            )}
          </Pressable>

          <Pressable
            className="h-12 items-center justify-center rounded-xl border border-[#D4AF37]/40 active:bg-[#D4AF37]/5"
            onPress={() => router.push('/event')}
          >
            <Text className="text-xs font-semibold tracking-[2px] text-[#D4AF37]">
              IR AL EVENTO
            </Text>
          </Pressable>

          {userData.role === 'ADMIN' && (
            <Pressable
              className="h-12 items-center justify-center rounded-xl bg-[#D4AF37] active:opacity-90"
              onPress={() => setIsScannerVisible(true)}
            >
              <Text className="text-xs font-bold tracking-[2px] text-black">MODO ESCÁNER</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Logout */}
      <Pressable
        className="items-center border-t border-zinc-900 py-5 active:bg-white/5"
        onPress={handleLogout}
      >
        <Text className="text-[11px] tracking-[2px] text-zinc-600">CERRAR SESIÓN</Text>
      </Pressable>

      <ScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScan={handleScan}
      />
    </SafeAreaView>
  );
}

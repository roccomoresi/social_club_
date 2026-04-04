import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { MemberAvatar } from '../../components/MemberAvatar';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function ProfileScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const id = user?.id ?? '';
  const name = profile?.full_name || 'NUEVO SOCIO';
  const role = profile?.role || 'MEMBER';
  const number = profile?.member_number || 'SW-PENDING';
  const instagram = profile?.instagram_user || '';
  const secretFact = profile?.secret_fact || '';
  const avatarUrl = profile?.avatar_url || null;

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
        const fileName = `${id}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, decode(base64Data), { contentType: `image/${ext}` });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', id);

        if (updateError) throw updateError;

        await refreshProfile(id);
        Alert.alert('Éxito', 'Foto de perfil actualizada.');
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'No pudimos subir la foto.');
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="h-14 items-center justify-center border-b border-zinc-900">
        <Text className="text-xs font-black tracking-[5px] text-white">MI PERFIL</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 items-center gap-4">
          <Pressable onPress={pickImage} disabled={loading} className="relative">
            <MemberAvatar avatarUrl={avatarUrl} name={name} size={88} />
            {loading && (
              <View
                style={{ borderRadius: 22 }}
                className="absolute inset-0 items-center justify-center bg-black/60"
              >
                <ActivityIndicator color="#D4AF37" />
              </View>
            )}
          </Pressable>
          <View className="items-center gap-2">
            <Text className="text-xl font-bold tracking-wide text-white">{name.toUpperCase()}</Text>
            <View className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1">
              <Text className="text-[9px] font-bold tracking-[3px] text-[#D4AF37]">{role}</Text>
            </View>
          </View>
        </View>

        <View className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
          <View>
            <Text className="text-[10px] font-bold tracking-[2px] text-[#D4AF37]">MEMBER NUMBER</Text>
            <Text className="mt-1 font-mono text-base text-white">{number}</Text>
          </View>
          <View className="my-4 h-px bg-zinc-900" />
          <View>
            <Text className="text-[10px] font-bold tracking-[2px] text-[#D4AF37]">INSTAGRAM</Text>
            <Text className="mt-1 text-base text-white">
              @{instagram || 'No configurado'}
            </Text>
          </View>
          <View className="my-4 h-px bg-zinc-900" />
          <View>
            <Text className="text-[10px] font-bold tracking-[2px] text-[#D4AF37]">DATO SECRETO</Text>
            <Text className="mt-1 text-sm italic leading-relaxed text-zinc-400">
              "{secretFact || 'Sin dato'}"
            </Text>
          </View>
        </View>

        <Pressable
          className="mt-4 h-12 items-center justify-center rounded-xl border border-zinc-800 active:bg-white/5 disabled:opacity-50"
          onPress={pickImage}
          disabled={loading}
        >
          <Text className="text-xs font-semibold tracking-[2px] text-zinc-400">ACTUALIZAR FOTO</Text>
        </Pressable>
      </ScrollView>

      <Pressable
        className="items-center border-t border-zinc-900 py-5 active:bg-white/5"
        onPress={() => signOut()}
      >
        <Text className="text-[11px] tracking-[2px] text-zinc-600">CERRAR SESIÓN</Text>
      </Pressable>
    </SafeAreaView>
  );
}

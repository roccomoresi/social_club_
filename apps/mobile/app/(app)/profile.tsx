import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { MemberAvatar } from '../../components/MemberAvatar';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

type TriviaKey = 'trivia_1' | 'trivia_2' | 'trivia_3';

const TRIVIA_LABELS: Record<TriviaKey, string> = {
  trivia_1: 'PISTA 1',
  trivia_2: 'PISTA 2',
  trivia_3: 'PISTA 3',
};

function TriviaField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  async function handleSave() {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      Alert.alert('Error', 'No pudimos guardar el cambio.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <View>
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-[10px] font-bold tracking-[2px] text-[#D4AF37]">{label}</Text>
        {!editing && (
          <Pressable onPress={() => { setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }}>
            <Text className="text-[10px] tracking-widest text-zinc-600">EDITAR</Text>
          </Pressable>
        )}
      </View>
      {editing ? (
        <View className="gap-2">
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={120}
            placeholder="Contá algo sobre vos..."
            placeholderTextColor="#52525b"
            className="rounded-xl border border-[#D4AF37]/30 bg-zinc-900 px-4 py-3 text-sm text-white"
            style={{ minHeight: 72, textAlignVertical: 'top' }}
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="flex-1 h-9 items-center justify-center rounded-xl bg-[#D4AF37] disabled:opacity-50"
            >
              {saving ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text className="text-[11px] font-black tracking-[2px] text-black">GUARDAR</Text>
              )}
            </Pressable>
            <Pressable
              onPress={handleCancel}
              disabled={saving}
              className="flex-1 h-9 items-center justify-center rounded-xl border border-zinc-800"
            >
              <Text className="text-[11px] font-semibold tracking-[2px] text-zinc-500">CANCELAR</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => { setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }}>
          <Text className="text-sm leading-relaxed text-zinc-300">
            {value || <Text className="italic text-zinc-600">Sin pista — tocá para agregar</Text>}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [uploading, setUploading] = useState(false);

  const id = user?.id ?? '';
  const name = profile?.full_name || 'NUEVO SOCIO';
  const role = profile?.role || 'MEMBER';
  const number = profile?.member_number || 'SW-PENDING';
  const instagram = profile?.instagram_user || '';
  const avatarUrl = profile?.avatar_url || null;

  const trivias: Record<TriviaKey, string> = {
    trivia_1: profile?.trivia_1 || '',
    trivia_2: profile?.trivia_2 || '',
    trivia_3: profile?.trivia_3 || '',
  };

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
      setUploading(true);
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
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'No pudimos subir la foto.');
      } finally {
        setUploading(false);
      }
    }
  }

  async function saveTrivia(key: TriviaKey, value: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ [key]: value })
      .eq('id', id);
    if (error) throw error;
    await refreshProfile(id);
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="h-14 items-center justify-center border-b border-zinc-900">
        <Text className="text-xs font-black tracking-[5px] text-white">MI PERFIL</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8 items-center gap-4">
            <Pressable onPress={pickImage} disabled={uploading} className="relative">
              <MemberAvatar avatarUrl={avatarUrl} name={name} size={88} />
              <View
                style={{ borderRadius: 22, bottom: 0, right: 0, width: 26, height: 26 }}
                className="absolute items-center justify-center bg-[#D4AF37]"
              >
                <Text style={{ fontSize: 12 }}>✎</Text>
              </View>
              {uploading && (
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

          <View className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5 mb-4">
            <View>
              <Text className="text-[10px] font-bold tracking-[2px] text-[#D4AF37]">MEMBER NUMBER</Text>
              <Text className="mt-1 font-mono text-base text-white">{number}</Text>
            </View>
            <View className="my-4 h-px bg-zinc-900" />
            <View>
              <Text className="text-[10px] font-bold tracking-[2px] text-[#D4AF37]">INSTAGRAM</Text>
              <Text className="mt-1 text-base text-white">
                {instagram ? `@${instagram}` : 'No configurado'}
              </Text>
            </View>
          </View>

          <View className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
            <View className="mb-4">
              <Text className="text-[11px] font-black tracking-[3px] text-white">MIS PISTAS</Text>
              <Text className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Los demás socios van a intentar adivinar de quién son estas pistas durante el juego.
              </Text>
            </View>
            {(Object.keys(TRIVIA_LABELS) as TriviaKey[]).map((key, i) => (
              <View key={key}>
                {i > 0 && <View className="my-4 h-px bg-zinc-900" />}
                <TriviaField
                  label={TRIVIA_LABELS[key]}
                  value={trivias[key]}
                  onSave={(val) => saveTrivia(key, val)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Pressable
        className="items-center border-t border-zinc-900 py-5 active:bg-white/5"
        onPress={() => signOut()}
      >
        <Text className="text-[11px] tracking-[2px] text-zinc-600">CERRAR SESIÓN</Text>
      </Pressable>
    </SafeAreaView>
  );
}

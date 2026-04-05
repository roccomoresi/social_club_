import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

const TRIVIA_FIELDS = [
  { label: 'TRIVIA 1', key: 'trivia1' },
  { label: 'TRIVIA 2', key: 'trivia2' },
  { label: 'TRIVIA 3', key: 'trivia3' },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [trivia1, setTrivia1] = useState('');
  const [trivia2, setTrivia2] = useState('');
  const [trivia3, setTrivia3] = useState('');

  const setters = { trivia1: setTrivia1, trivia2: setTrivia2, trivia3: setTrivia3 };
  const values  = { trivia1, trivia2, trivia3 };

  async function handleSave() {
    if (!user?.id) {
      Alert.alert('Sesión', 'No hay usuario activo.');
      return;
    }
    if (!trivia1.trim() || !trivia2.trim() || !trivia3.trim()) {
      Alert.alert('Casi listo', 'Completá las tres respuestas de trivia.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          trivia_1: trivia1.trim(),
          trivia_2: trivia2.trim(),
          trivia_3: trivia3.trim(),
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Error de base de datos', error.message);
        return;
      }

      await refreshProfile(user.id);
      router.replace('/home');
    } catch (e) {
      console.error(e);
      Alert.alert('Error inesperado', 'Revisá la conexión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 32, paddingTop: 48, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="mb-10">
            <Text className="text-2xl font-black tracking-[3px] text-white">TU PERFIL</Text>
            <View className="mt-3 h-px w-10 bg-[#D4AF37]/50" />
            <Text className="mt-4 text-sm leading-relaxed text-zinc-500">
              Estas respuestas alimentan el juego del club.{'\n'}Podés editarlas después si hace falta.
            </Text>
          </View>

          {/* Campos */}
          <View className="gap-6">
            {TRIVIA_FIELDS.map(({ label, key }) => (
              <View key={key}>
                <Text className="mb-2 text-[10px] font-black tracking-[3px] text-[#D4AF37]">
                  {label}
                </Text>
                <TextInput
                  className="min-h-[52px] rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-base text-white"
                  placeholder="Respuesta"
                  placeholderTextColor="#3f3f46"
                  value={values[key]}
                  onChangeText={setters[key]}
                />
              </View>
            ))}
          </View>

          {/* CTA */}
          <Pressable
            className="mt-10 h-14 items-center justify-center rounded-xl bg-white active:opacity-75 disabled:opacity-50"
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="font-bold tracking-[3px] text-black">CONTINUAR</Text>
            )}
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completá todos los campos');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      Alert.alert('Error de acceso', 'Credenciales incorrectas');
      setLoading(false);
      return;
    }

    if (data.user) {
      const prof = await refreshProfile(data.user.id);
      setLoading(false);
      if (!prof?.onboarding_completed) {
        router.replace('/onboarding');
      } else {
        router.replace('/home');
      }
    } else {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 justify-between px-6 pb-12 pt-16">

        {/* Logo */}
        <View className="items-center gap-3">
          <Text className="text-[28px] font-black tracking-[6px] text-white">
            SOCIAL CLUB
          </Text>
          <Text className="text-[10px] tracking-[4px] text-zinc-500">
            PRIVATE MEMBERS CLUB
          </Text>
          <View className="mt-1 h-px w-12 bg-[#D4AF37]/40" />
        </View>

        {/* Formulario */}
        <View className="gap-3">
          <TextInput
            className="h-14 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm tracking-widest text-white"
            placeholder="EMAIL"
            placeholderTextColor="#3f3f46"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            className="h-14 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm tracking-widest text-white"
            placeholder="PASSWORD"
            placeholderTextColor="#3f3f46"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Pressable
            className="mt-2 h-14 items-center justify-center rounded-xl bg-white active:opacity-75 disabled:opacity-50"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-sm font-bold tracking-[3px] text-black">MEMBER LOGIN</Text>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <Pressable className="h-14 items-center justify-center rounded-xl border border-zinc-800 active:bg-white/5">
          <Text className="text-xs font-semibold tracking-[3px] text-zinc-500">
            APPLY FOR MEMBERSHIP
          </Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

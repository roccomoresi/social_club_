import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>SCRAP WORLD</Text>
          <Text style={styles.subtitle}>PRIVATE MEMBERS CLUB</Text>
        </View>
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="EMAIL"
            placeholderTextColor="#444"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="PASSWORD"
            placeholderTextColor="#444"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryButtonText}>MEMBER LOGIN</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>APPLY FOR MEMBERSHIP</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 80,
  },
  header: { alignItems: 'center' },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 5,
    textTransform: 'uppercase',
  },
  subtitle: { color: '#71717a', fontSize: 12, marginTop: 12, letterSpacing: 4 },
  form: { gap: 16, marginTop: -40 },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    height: 56,
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 14,
    letterSpacing: 1,
  },
  footer: { width: '100%' },
  primaryButton: {
    backgroundColor: '#ffffff',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  primaryButtonText: { color: '#000000', fontSize: 14, fontWeight: 'bold', letterSpacing: 2 },
  secondaryButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  secondaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600', letterSpacing: 2 },
});

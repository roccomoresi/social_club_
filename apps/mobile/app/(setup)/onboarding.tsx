import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [trivia1, setTrivia1] = useState('');
  const [trivia2, setTrivia2] = useState('');
  const [trivia3, setTrivia3] = useState('');

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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>ONBOARDING</Text>
            <Text style={styles.subtitle}>
              Tres respuestas para el juego del club. Podés editarlas después si hace falta.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>TRIVIA 1</Text>
            <TextInput
              style={styles.input}
              placeholder="Respuesta"
              placeholderTextColor="#444"
              value={trivia1}
              onChangeText={setTrivia1}
            />

            <Text style={styles.label}>TRIVIA 2</Text>
            <TextInput
              style={styles.input}
              placeholder="Respuesta"
              placeholderTextColor="#444"
              value={trivia2}
              onChangeText={setTrivia2}
            />

            <Text style={styles.label}>TRIVIA 3</Text>
            <TextInput
              style={styles.input}
              placeholder="Respuesta"
              placeholderTextColor="#444"
              value={trivia3}
              onChangeText={setTrivia3}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>CONTINUAR</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  inner: { flex: 1, padding: 32, justifyContent: 'center' },
  header: { marginBottom: 32 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', letterSpacing: 2 },
  subtitle: { color: '#71717a', fontSize: 14, marginTop: 12, lineHeight: 20 },
  form: { gap: 16 },
  label: { color: '#D4AF37', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#fff',
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  buttonText: { fontWeight: 'bold', letterSpacing: 2 },
});

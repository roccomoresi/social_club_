import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../supabase';

interface Props {
  userId: string;
  onComplete: () => void;
}

export const OnboardingScreen = ({ userId, onComplete }: Props) => {
  const [loading, setLoading] = useState(false);
  const [instagram, setInstagram] = useState('');
  const [secretFact, setSecretFact] = useState('');

  async function handleSave() {
    if (!instagram || !secretFact) {
      Alert.alert('Casi listo', 'Necesitamos tu Instagram y un dato secreto.');
      return;
    }
  
    setLoading(true);
    console.log("Intentando guardar para el usuario:", userId); // DEBUG
  
    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .update({ 
          instagram_user: instagram.trim().replace('@', ''), 
          secret_fact: secretFact.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select(); // El select() ayuda a confirmar que hubo cambios
  
      console.log("Status de la respuesta:", status); // DEBUG
  
      if (error) {
        console.error("Error detallado de Supabase:", error); // DEBUG
        Alert.alert('Error de base de datos', error.message);
      } else {
        console.log("Datos actualizados correctamente:", data); // DEBUG
        onComplete();
      }
    } catch (err) {
      console.error("Error inesperado:", err); // DEBUG
      Alert.alert('Error inesperado', 'Revisá la conexión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>COMPLETÁ TU PERFIL</Text>
          <Text style={styles.subtitle}>Para acceder a tu credencial de socio y participar en las dinámicas del club.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>TU INSTAGRAM</Text>
          <TextInput
            style={styles.input}
            placeholder="@usuario"
            placeholderTextColor="#444"
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
          />

          <Text style={styles.label}>TU DATO SECRETO (PARA EL JUEGO)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ej: Fui extra en una película / Hablo 4 idiomas..."
            placeholderTextColor="#444"
            value={secretFact}
            onChangeText={setSecretFact}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.helperText}>Máximo 150 caracteres. Sé creativo, alguien tendrá que adivinar que eres tú.</Text>
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>ACTIVAR MEMBRESÍA</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  inner: { flex: 1, padding: 32, justifyContent: 'center' },
  header: { marginBottom: 40 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', letterSpacing: 2 },
  subtitle: { color: '#71717a', fontSize: 14, marginTop: 12, lineHeight: 20 },
  form: { gap: 20 },
  label: { color: '#D4AF37', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
  input: { 
    backgroundColor: '#111', 
    borderWidth: 1, 
    borderColor: '#222', 
    borderRadius: 8, 
    padding: 16, 
    color: '#fff', 
    fontSize: 16 
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  helperText: { color: '#444', fontSize: 11, marginTop: -10 },
  button: { 
    backgroundColor: '#fff', 
    height: 56, 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 40 
  },
  buttonText: { fontWeight: 'bold', letterSpacing: 2 }
});
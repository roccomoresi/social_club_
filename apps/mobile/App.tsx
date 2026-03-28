import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MemberCard } from './components/MemberCard';
import { supabase } from './supabase';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completá todos los campos');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert('Error de acceso', 'Credenciales incorrectas');
      setLoading(false);
    } else {
      setIsLoggedIn(true);
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setEmail('');
    setPassword('');
  }

  return (
    <SafeAreaView style={styles.container}>
      {isLoggedIn ? (
        <View style={styles.fullScreen}>
          <View style={styles.navBar}>
            <Text style={styles.navTitle}>SCRAP WORLD</Text>
          </View>
          <View style={styles.centerContent}>
            <MemberCard 
              name="Ignacio Pachelo" 
              role="FOUNDING MEMBER" 
              id="SW-0001" 
            />
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
            
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleLogin}
              disabled={loading}
            >
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
      )}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  fullScreen: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', padding: 24 },
  content: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 48, paddingTop: 80 },
  header: { alignItems: 'center' },
  title: { color: '#ffffff', fontSize: 32, fontWeight: 'bold', letterSpacing: 5, textTransform: 'uppercase' },
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
  primaryButton: { backgroundColor: '#ffffff', height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  primaryButtonText: { color: '#000000', fontSize: 14, fontWeight: 'bold', letterSpacing: 2 },
  secondaryButton: { height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#333333' },
  secondaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600', letterSpacing: 2 },
  navBar: { height: 60, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#111111' },
  navTitle: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', letterSpacing: 3 },
  logoutButton: { padding: 24, alignItems: 'center' },
  logoutText: { color: '#71717a', fontSize: 12, letterSpacing: 2 }
});
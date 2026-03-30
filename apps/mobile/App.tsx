import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MemberCard } from './components/MemberCard';
import { supabase } from './supabase';
import { ScannerModal } from './components/ScannerModal';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userData, setUserData] = useState({ name: '', number: '', role: '' });
  const [isScannerVisible, setIsScannerVisible] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsLoggedIn(true);
      fetchProfile(session.user.id);
    }
  }

  async function handleScan(scannedId: string) {
    // Cerramos el scanner
    setIsScannerVisible(false);
    
    // Buscamos al socio escaneado
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('member_number', scannedId) // o .eq('id', scannedId) según qué guardes en el QR
      .single();
  
    if (data) {
      Alert.alert('ACCESO CONCEDIDO', `Socio: ${data.full_name}\nRole: ${data.role}`);
    } else {
      Alert.alert('ERROR', 'Socio no encontrado o código inválido');
    }
  }

  async function fetchProfile(userId: string) {
    setFetchingProfile(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, member_number, role')
      .eq('id', userId)
      .single();

    if (data) {
      setUserData({
        name: data.full_name || 'NUEVO SOCIO',
        number: data.member_number || 'SW-PENDING',
        role: data.role || 'MEMBER'
      });
    }
    setFetchingProfile(false);
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completá todos los campos');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Error de acceso', 'Credenciales incorrectas');
      setLoading(false);
    } else if (data.user) {
      await fetchProfile(data.user.id);
      setIsLoggedIn(true);
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserData({ name: '', number: '', role: '' });
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
            {fetchingProfile ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MemberCard 
                name={userData.name} 
                role={userData.role} 
                id={userData.number} 
              />
              
              
            )}

{userData.role === 'ADMIN' && (
  <TouchableOpacity 
    style={[styles.primaryButton, { marginTop: 20, backgroundColor: '#D4AF37' }]} 
    onPress={() => setIsScannerVisible(true)}
  >
    <Text style={styles.primaryButtonText}>MODO ESCÁNER</Text>
  </TouchableOpacity>
)}

<ScannerModal 
  visible={isScannerVisible} 
  onClose={() => setIsScannerVisible(false)} 
  onScan={handleScan} 
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
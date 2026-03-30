import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MemberCard } from './components/MemberCard';
import { supabase } from './supabase';
import { ScannerModal } from './components/ScannerModal';
import { OnboardingScreen } from './screens/OnboardingScreen';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userData, setUserData] = useState({ 
    name: '', 
    number: '', 
    role: '', 
    id: '',
    instagram: '',
    secretFact: '',
    avatarUrl: ''
  });
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  async function fetchProfile(userId: string) {
    setFetchingProfile(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, member_number, role, secret_fact, instagram_user, avatar_url')
      .eq('id', userId)
      .single();
  
    if (data) {
      setUserData({
        name: data.full_name || 'NUEVO SOCIO',
        number: data.member_number || 'SW-PENDING',
        role: data.role || 'MEMBER',
        id: userId,
        instagram: data.instagram_user || '',
        secretFact: data.secret_fact || '',
        avatarUrl: data.avatar_url || ''
      });
  
      if (data.secret_fact) {
        setShowOnboarding(false);
      } else {
        setShowOnboarding(true);
      }
    }
    setFetchingProfile(false);
  }

  async function handleScan(scannedId: string) {
    setIsScannerVisible(false);
    const { data, error } = await supabase
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
    } else if (data.user) {
      await fetchProfile(data.user.id);
      setIsLoggedIn(true);
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setShowOnboarding(false);
    setUserData({ name: '', number: '', role: '', id: '', instagram: '', secretFact: '', avatarUrl: '' });
    setEmail('');
    setPassword('');
  }

  async function pickImage() {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
  
    // Validamos que no se canceló y que REALMENTE tenemos el string base64
    if (!result.canceled && result.assets[0].base64) {
      const base64Data = result.assets[0].base64; // Guardamos en una constante para que TS sepa que es string
      
      setLoading(true);
      try {
        const img = result.assets[0];
        const ext = img.uri.split('.').pop();
        const fileName = `${userData.id}-${Date.now()}.${ext}`;
        const filePath = `${fileName}`;
  
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(base64Data), { // Usamos la constante validada
            contentType: `image/${ext}`,
          });
  
        if (uploadError) throw uploadError;
  
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
  
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', userData.id);
  
        if (updateError) throw updateError;
  
        setUserData(prev => ({ ...prev, avatarUrl: publicUrl }));
        Alert.alert('¡Éxito!', 'Foto de perfil actualizada.');
  
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'No pudimos subir la foto.');
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {isLoggedIn ? (
        showOnboarding ? (
          <OnboardingScreen 
            userId={userData.id} 
            onComplete={() => {
              setShowOnboarding(false);
              fetchProfile(userData.id);
            }} 
          />
        ) : (
          <View style={styles.fullScreen}>
            <View style={styles.navBar}>
              <Text style={styles.navTitle}>SCRAP WORLD</Text>
            </View>
            <View style={styles.centerContent}>
              {fetchingProfile ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MemberCard 
                    name={userData.name} 
                    role={userData.role} 
                    id={userData.number} 
                  />
                  
                  <View style={styles.dataSection}>
                    <Text style={styles.dataLabel}>INSTAGRAM</Text>
                    <Text style={styles.dataValue}>@{userData.instagram || 'No configurado'}</Text>
                    
                    <Text style={[styles.dataLabel, { marginTop: 15 }]}>TU DATO SECRETO</Text>
                    <Text style={styles.dataValue}>"{userData.secretFact || 'Sin dato'}"</Text>

                    <TouchableOpacity 
                      style={[styles.secondaryButton, { marginTop: 20 }]} 
                      onPress={pickImage}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.secondaryButtonText}>ACTUALIZAR FOTO</Text>
                      )}
                    </TouchableOpacity>
                  </View>

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
                </>
              )}
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
            </TouchableOpacity>
          </View>
        )
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
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryButtonText}>MEMBER LOGIN</Text>}
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
  logoutText: { color: '#71717a', fontSize: 12, letterSpacing: 2 },
  dataSection: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  dataLabel: {
    color: '#D4AF37', 
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  dataValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    fontStyle: 'italic',
  }
});
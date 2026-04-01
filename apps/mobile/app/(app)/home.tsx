import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { MemberCard } from '../../components/MemberCard';
import { ScannerModal } from '../../components/ScannerModal';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function HomeScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);

  const userData = {
    name: profile?.full_name || 'NUEVO SOCIO',
    number: profile?.member_number || 'SW-PENDING',
    role: profile?.role || 'MEMBER',
    id: user?.id ?? '',
    instagram: profile?.instagram_user || '',
    secretFact: profile?.secret_fact || '',
    avatarUrl: profile?.avatar_url || '',
  };

  async function handleScan(scannedId: string) {
    setIsScannerVisible(false);
    const { data } = await supabase
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
        const fileName = `${userData.id}-${Date.now()}.${ext}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(base64Data), {
            contentType: `image/${ext}`,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', userData.id);

        if (updateError) throw updateError;

        await refreshProfile(userData.id);
        Alert.alert('¡Éxito!', 'Foto de perfil actualizada.');
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'No pudimos subir la foto.');
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleLogout() {
    await signOut();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fullScreen}>
        <View style={styles.navBar}>
          <Text style={styles.navTitle}>SCRAP WORLD</Text>
        </View>
        <View style={styles.centerContent}>
          <>
            <MemberCard name={userData.name} role={userData.role} id={userData.number} />

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
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  fullScreen: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', padding: 24 },
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
  navBar: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
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
  },
});

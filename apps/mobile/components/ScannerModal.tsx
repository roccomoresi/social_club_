import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface ScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export const ScannerModal = ({ visible, onClose, onScan }: ScannerModalProps) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    onScan(data);
    // Resetear para el próximo escaneo después de 2 segundos
    setTimeout(() => setScanned(false), 2000);
  };

  if (!permission) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {!permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.text}>Necesitamos permiso para usar la cámara</Text>
            <TouchableOpacity onPress={requestPermission} style={styles.button}>
              <Text style={styles.buttonText}>DAR PERMISO</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.unfocusedContainer}></View>
              <View style={styles.middleContainer}>
                <View style={styles.unfocusedContainer}></View>
                <View style={styles.focusedContainer}></View>
                <View style={styles.unfocusedContainer}></View>
              </View>
              <View style={styles.unfocusedContainer}>
                <Text style={styles.instructionText}>APUNTÁ AL QR DEL SOCIO</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>CANCELAR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  text: { color: '#fff', textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#fff', padding: 15, borderRadius: 8 },
  buttonText: { fontWeight: 'bold' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  unfocusedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  middleContainer: { flexDirection: 'row', height: 250 },
  focusedContainer: { width: 250, borderWidth: 2, borderColor: '#D4AF37', borderRadius: 20 },
  instructionText: { color: '#fff', marginTop: 20, letterSpacing: 2, fontWeight: 'bold' },
  closeButton: { marginTop: 40, padding: 10 },
  closeButtonText: { color: '#71717a', fontSize: 14, letterSpacing: 2 }
});
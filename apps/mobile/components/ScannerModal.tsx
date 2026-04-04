import React, { useState, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
    setTimeout(() => setScanned(false), 2000);
  };

  if (!permission) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {!permission.granted ? (
          /* ── Sin permiso de cámara ── */
          <View style={styles.permissionScreen}>
            <Text style={styles.permissionTitle}>ACCESO A CÁMARA</Text>
            <View style={styles.permissionDivider} />
            <Text style={styles.permissionBody}>
              Necesitamos permiso para usar la cámara y escanear códigos QR.
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>DAR PERMISO</Text>
            </Pressable>
            <Pressable style={styles.cancelLink} onPress={onClose}>
              <Text style={styles.cancelLinkText}>Cancelar</Text>
            </Pressable>
          </View>
        ) : (
          /* ── Visor de cámara ── */
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          >
            <View style={styles.overlay}>
              {/* Zona oscura superior */}
              <View style={styles.dimZone} />

              {/* Fila central: sombra | ventana | sombra */}
              <View style={styles.scanRow}>
                <View style={styles.dimZone} />
                <View style={styles.scanWindow}>
                  {/* Esquinas decorativas */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <View style={styles.dimZone} />
              </View>

              {/* Zona oscura inferior con instrucción y botón */}
              <View style={[styles.dimZone, styles.bottomZone]}>
                <Text style={styles.instruction}>APUNTÁ AL QR DEL SOCIO</Text>
                <Pressable style={styles.closeButton} onPress={onClose}>
                  <Text style={styles.closeButtonText}>CANCELAR</Text>
                </Pressable>
              </View>
            </View>
          </CameraView>
        )}
      </View>
    </Modal>
  );
};

const WINDOW_SIZE = 240;
const CORNER_SIZE = 20;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Sin permiso ──
  permissionScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 16,
  },
  permissionDivider: {
    width: 32,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.5)',
    marginBottom: 20,
  },
  permissionBody: {
    color: '#71717a',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#ffffff',
    height: 52,
    paddingHorizontal: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 2,
  },
  cancelLink: {
    marginTop: 20,
    padding: 12,
  },
  cancelLinkText: {
    color: '#52525b',
    fontSize: 14,
    letterSpacing: 1,
  },

  // ── Overlay de cámara ──
  overlay: {
    flex: 1,
  },
  dimZone: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  scanRow: {
    flexDirection: 'row',
    height: WINDOW_SIZE,
  },
  scanWindow: {
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
  },
  bottomZone: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  instruction: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
  },
  closeButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  closeButtonText: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
  },

  // ── Esquinas del visor ──
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#D4AF37',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 4,
  },
});

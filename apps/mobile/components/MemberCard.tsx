import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface MemberCardProps {
  name: string;
  role: string;
  id: string;
}

const { width } = Dimensions.get('window');

export const MemberCard = ({ name, role, id }: MemberCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.clubName}>SCRAP WORLD</Text>
        <Text style={styles.memberRole}>{role}</Text>
      </View>

      <View style={styles.qrContainer}>
        {/* Generamos el QR con el ID del socio */}
        <QRCode
          value={id}
          size={width * 0.4}
          color="white"
          backgroundColor="transparent"
        />
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.label}>MEMBER NAME</Text>
          <Text style={styles.name}>{name.toUpperCase()}</Text>
        </View>
        <View style={styles.memberNumberContainer}>
          <Text style={styles.label}>ID NO.</Text>
          <Text style={styles.number}>{id}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#050505',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    aspectRatio: 0.63, // Proporción tipo tarjeta vertical
    borderWidth: 1,
    borderColor: '#1A1A1A',
    justifyContent: 'space-between',
    // Sombra sutil para que flote
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
  },
  clubName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 6,
  },
  memberRole: {
    color: '#D4AF37', // Un dorado Scrap World
    fontSize: 10,
    marginTop: 8,
    letterSpacing: 3,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 15,
    backgroundColor: '#0A0A0A',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    color: '#444',
    fontSize: 8,
    letterSpacing: 1,
    marginBottom: 4,
  },
  name: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  memberNumberContainer: {
    alignItems: 'flex-end',
  },
  number: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Courier', // Le da toque de ID técnica
    letterSpacing: 1,
  },
});
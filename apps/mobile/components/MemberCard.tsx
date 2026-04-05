import React from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.clubName}>SCRAP WORLD</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{role}</Text>
        </View>
      </View>

      {/* QR */}
      <View style={styles.qrContainer}>
        <QRCode
          value={id || ' '}
          size={width * 0.42}
          color="white"
          backgroundColor="transparent"
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.label}>MEMBER NAME</Text>
          <Text style={styles.name}>{name.toUpperCase()}</Text>
        </View>
        <View style={styles.numberBlock}>
          <Text style={styles.label}>ID NO.</Text>
          <Text style={styles.number}>{id}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#080808',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    aspectRatio: 0.63,
    borderWidth: 1,
    borderColor: '#1c1c1c',
    justifyContent: 'space-between',
    // Sombra sutil dorada en iOS
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    // Elevación para Android
    elevation: 14,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  clubName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 7,
  },
  roleBadge: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.07)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  roleText: {
    color: '#D4AF37',
    fontSize: 9,
    letterSpacing: 3,
    fontWeight: '700',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: '#141414',
    borderRadius: 16,
    backgroundColor: '#040404',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    color: '#3f3f46',
    fontSize: 8,
    letterSpacing: 1.5,
    marginBottom: 4,
    fontWeight: '600',
  },
  name: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  numberBlock: {
    alignItems: 'flex-end',
  },
  number: {
    color: '#d4d4d8',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
});

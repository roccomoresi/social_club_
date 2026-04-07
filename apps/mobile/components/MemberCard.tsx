import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

interface MemberCardProps {
  name: string;
  role: string;
  id: string;
}

export const MemberCard = ({ name, role, id }: MemberCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.clubName}>SOCIAL CLUB</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{role}</Text>
        </View>
      </View>

      <View style={styles.centerpiece}>
        <View style={styles.accentLine} />
        <Text style={styles.monogram}>SW</Text>
        <View style={styles.accentLine} />
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.label}>MEMBER NAME</Text>
          <Text style={styles.name}>{name.toUpperCase()}</Text>
        </View>
        <View style={styles.idBlock}>
          <Text style={styles.label}>ID NO.</Text>
          <Text style={styles.number}>{id}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#060606',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    aspectRatio: 0.63,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    justifyContent: 'space-between',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 14,
  },
  header: {
    alignItems: 'center',
    gap: 10,
  },
  clubName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 8,
  },
  roleBadge: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 100,
  },
  roleText: {
    color: '#D4AF37',
    fontSize: 9,
    letterSpacing: 3,
    fontWeight: '700',
  },
  centerpiece: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: 8,
  },
  accentLine: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  monogram: {
    color: 'rgba(212,175,55,0.18)',
    fontSize: 96,
    fontWeight: '900',
    letterSpacing: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    color: '#3f3f46',
    fontSize: 8,
    letterSpacing: 2,
    marginBottom: 5,
    fontWeight: '600',
  },
  name: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  idBlock: {
    alignItems: 'flex-end',
  },
  number: {
    color: '#a1a1aa',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1.5,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface MemberCardProps {
  name: string;
  role: string;
  id: string;
}

export const MemberCard = ({ name, role, id }: MemberCardProps) => {
  return (
    <View style={styles.memberCard}>
      <Text style={styles.memberName}>{name}</Text>
      <Text style={styles.memberRole}>{role}</Text>
      
      <View style={styles.qrContainer}>
        <QRCode
          value={`${id}-${name}-AUTH`}
          size={180}
          color="#000000"
          backgroundColor="#ffffff"
        />
      </View>
      
      <Text style={styles.memberId}>ID: {id}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  memberCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222222',
    width: '100%',
  },
  memberName: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  memberRole: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 3,
    marginTop: 8,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 40,
    marginBottom: 40,
  },
  memberId: {
    color: '#71717a',
    fontSize: 14,
    letterSpacing: 2,
  },
});
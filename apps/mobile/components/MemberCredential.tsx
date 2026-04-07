import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = CARD_WIDTH / 1.586;
const MAX_TILT = 22;
const SPRING_TILT = { friction: 5, tension: 100, useNativeDriver: true };
const SPRING_FLIP = { friction: 7, tension: 90, useNativeDriver: true };

interface MemberCredentialProps {
  name: string;
  role: string;
  memberNumber: string;
}

export function MemberCredential({ name, role, memberNumber }: MemberCredentialProps) {
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const shineX = useRef(new Animated.Value(0)).current;
  const shineY = useRef(new Animated.Value(0)).current;
  const shineOpacity = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const isFlipped = useRef(false);
  const tapStartTime = useRef(0);

  const [flippedVisible, setFlippedVisible] = useState(false);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(300),
      Animated.spring(rotateY, { toValue: 10, ...SPRING_TILT }),
      Animated.spring(rotateY, { toValue: -10, ...SPRING_TILT }),
      Animated.spring(rotateY, { toValue: 0, ...SPRING_TILT }),
    ]).start();
  }, []);

  flipAnim.addListener(({ value }) => {
    setFlippedVisible(value > 0.5);
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        tapStartTime.current = Date.now();
      },
      onPanResponderMove: (_, gs) => {
        const rx = Math.max(-1, Math.min(1, gs.dx / (CARD_WIDTH / 2)));
        const ry = Math.max(-1, Math.min(1, gs.dy / (CARD_HEIGHT / 2)));
        rotateY.setValue(rx * MAX_TILT);
        rotateX.setValue(-ry * MAX_TILT);
        shineX.setValue(rx * CARD_WIDTH * 0.28);
        shineY.setValue(ry * CARD_HEIGHT * 0.28);
        shineOpacity.setValue((Math.abs(rx) + Math.abs(ry)) * 0.32);
      },
      onPanResponderRelease: (_, gs) => {
        const elapsed = Date.now() - tapStartTime.current;
        if (elapsed < 280 && Math.abs(gs.dx) < 8 && Math.abs(gs.dy) < 8) {
          const toValue = isFlipped.current ? 0 : 1;
          isFlipped.current = !isFlipped.current;
          Animated.spring(flipAnim, { toValue, ...SPRING_FLIP }).start();
        }
        Animated.parallel([
          Animated.spring(rotateX, { toValue: 0, ...SPRING_TILT }),
          Animated.spring(rotateY, { toValue: 0, ...SPRING_TILT }),
          Animated.spring(shineX, { toValue: 0, ...SPRING_TILT }),
          Animated.spring(shineY, { toValue: 0, ...SPRING_TILT }),
          Animated.spring(shineOpacity, { toValue: 0, ...SPRING_TILT }),
        ]).start();
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(rotateX, { toValue: 0, ...SPRING_TILT }),
          Animated.spring(rotateY, { toValue: 0, ...SPRING_TILT }),
          Animated.spring(shineOpacity, { toValue: 0, ...SPRING_TILT }),
        ]).start();
      },
    })
  ).current;

  const tiltRotateX = rotateX.interpolate({
    inputRange: [-MAX_TILT, MAX_TILT],
    outputRange: [`-${MAX_TILT}deg`, `${MAX_TILT}deg`],
  });
  const tiltRotateY = rotateY.interpolate({
    inputRange: [-MAX_TILT, MAX_TILT],
    outputRange: [`-${MAX_TILT}deg`, `${MAX_TILT}deg`],
  });

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wrapper,
        {
          transform: [
            { perspective: 900 },
            { rotateX: tiltRotateX },
            { rotateY: tiltRotateY },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.face,
          { transform: [{ rotateY: frontRotate }] },
        ]}
        pointerEvents={flippedVisible ? 'none' : 'auto'}
      >
        <LinearGradient
          colors={['#111111', '#0a0a0a', '#141210', '#0d0c0b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={[
            'rgba(212,175,55,0.09)',
            'transparent',
            'transparent',
            'rgba(212,175,55,0.05)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          style={[
            styles.shine,
            {
              opacity: shineOpacity,
              transform: [{ translateX: shineX }, { translateY: shineY }],
            },
          ]}
        />
        <View style={styles.topStripe} />
        <View style={styles.bottomStripe} />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.clubLabel}>SOCIAL CLUB</Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{role.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.monogramRow}>
            <Text style={styles.monogram}>{initials}</Text>
            <View style={styles.holoDot} />
          </View>
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <Text style={styles.fieldLabel}>NOMBRE</Text>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {name.toUpperCase()}
              </Text>
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.fieldLabel}>TOCA PARA VER NÚMERO</Text>
              <Text style={styles.hintText}>↺</Text>
            </View>
          </View>
        </View>
        <View style={styles.border} />
      </Animated.View>

      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.face,
          { transform: [{ rotateY: backRotate }] },
        ]}
        pointerEvents={flippedVisible ? 'auto' : 'none'}
      >
        <LinearGradient
          colors={['#0d0c0b', '#141210', '#0a0a0a', '#111111']}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={[
            'rgba(212,175,55,0.12)',
            'transparent',
            'rgba(212,175,55,0.06)',
          ]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          style={[
            styles.shine,
            {
              opacity: shineOpacity,
              transform: [{ translateX: shineX }, { translateY: shineY }],
            },
          ]}
        />
        <View style={styles.topStripe} />
        <View style={styles.backContent}>
          <Text style={styles.backClubLabel}>SOCIAL CLUB</Text>
          <View style={styles.backDivider} />
          <Text style={styles.backFieldLabel}>NÚMERO DE SOCIO</Text>
          <Text style={styles.backMemberNumber}>{memberNumber}</Text>
          <View style={styles.backDivider} />
          <Text style={styles.backName}>{name.toUpperCase()}</Text>
        </View>
        <View style={styles.border} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 36,
    elevation: 24,
  },
  face: {
    borderRadius: 20,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  shine: {
    position: 'absolute',
    width: CARD_WIDTH * 0.85,
    height: CARD_HEIGHT * 0.85,
    borderRadius: CARD_WIDTH,
    backgroundColor: 'rgba(212,175,55,0.18)',
    alignSelf: 'center',
    top: '7%',
  },
  topStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#D4AF37',
    opacity: 0.65,
  },
  bottomStripe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.25)',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
  },
  content: {
    flex: 1,
    padding: 26,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clubLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 6,
  },
  rolePill: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  roleText: {
    color: '#D4AF37',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2,
  },
  monogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  monogram: {
    color: 'rgba(212,175,55,0.13)',
    fontSize: 88,
    fontWeight: '900',
    lineHeight: 96,
  },
  holoDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLeft: {
    flex: 1,
    marginRight: 16,
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  fieldLabel: {
    color: '#3f3f46',
    fontSize: 7,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  hintText: {
    color: 'rgba(212,175,55,0.4)',
    fontSize: 18,
    fontWeight: '300',
  },
  backContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 26,
  },
  backClubLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 6,
  },
  backDivider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.3)',
  },
  backFieldLabel: {
    color: '#3f3f46',
    fontSize: 8,
    letterSpacing: 3,
    fontWeight: '700',
  },
  backMemberNumber: {
    color: '#D4AF37',
    fontSize: 38,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 4,
  },
  backName: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
  },
});

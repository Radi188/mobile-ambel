import { useEffect, useRef } from 'react';
import { View, Image, Text, StyleSheet, Animated } from 'react-native';

type Props = { onDone: () => void };

export default function AppSplash({ onDone }: Props) {
  const cardScale = useRef(new Animated.Value(0.88)).current;
  const cardOp    = useRef(new Animated.Value(0)).current;
  const tagOp     = useRef(new Animated.Value(0)).current;
  const lineScaleX = useRef(new Animated.Value(0)).current;
  const screenOp  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Card entrance
      Animated.parallel([
        Animated.timing(cardOp, {
          toValue: 1, duration: 550, useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1, tension: 55, friction: 9, useNativeDriver: true,
        }),
      ]),
      // Decorative line grows
      Animated.timing(lineScaleX, {
        toValue: 1, duration: 380, useNativeDriver: true,
      }),
      // Tagline fades in
      Animated.timing(tagOp, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
      // Hold
      Animated.delay(900),
      // Fade out entire splash
      Animated.timing(screenOp, {
        toValue: 0, duration: 480, useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[s.root, { opacity: screenOp }]}>
      <Animated.View style={[s.card, { opacity: cardOp, transform: [{ scale: cardScale }] }]}>
        <Image
          source={require('../assets/logo.png')}
          style={s.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[s.divider, { transform: [{ scaleX: lineScaleX }] }]} />

      <Animated.Text style={[s.tag, { opacity: tagOp }]}>
        POS SYSTEM
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    gap: 20,
  },
  card: {
    width: 188,
    height: 188,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    shadowColor: '#C4A882',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
  logo: {
    width: 148,
    height: 148,
  },
  divider: {
    width: 32,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C4A882',
    opacity: 0.6,
  },
  tag: {
    fontSize: 10,
    letterSpacing: 5,
    color: '#5A5A5A',
    fontWeight: '500',
    marginLeft: 5,
  },
});

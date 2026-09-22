import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { colors, radius, shadow, space, text } from '../constants/theme';

type Props = { onDone: () => void };

/** Cover shown over the app on cold start until the first frame is worth seeing. */
export default function AppSplash({ onDone }: Props) {
  const markScale = useRef(new Animated.Value(0.9)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const ruleScale = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(markOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.spring(markScale, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
      ]),
      Animated.timing(ruleScale, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(wordOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.delay(700),
      Animated.timing(screenOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[s.root, { opacity: screenOpacity }]}>
      <Animated.View style={[s.mark, { opacity: markOpacity, transform: [{ scale: markScale }] }]}>
        <Image source={require('../assets/logo-mark.png')} style={s.logo} resizeMode="contain" />
      </Animated.View>

      <Animated.View style={[s.rule, { transform: [{ scaleX: ruleScale }] }]} />

      <Animated.Text style={[text.overline, s.word, { opacity: wordOpacity }]}>
        BongPOS Owner
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
    zIndex: 9999,
  },
  mark: {
    width: 148,
    height: 148,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    ...shadow.md,
  },
  logo: { width: 104, height: 104 },
  rule: { width: 28, height: 1.5, backgroundColor: colors.accent },
  word: { color: colors.textSecondary },
});

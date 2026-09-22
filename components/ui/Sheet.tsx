import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space, text } from '../../constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Fraction of the screen the sheet may grow to. */
  maxHeight?: `${number}%`;
};

/**
 * Bottom sheet with a hand-rolled transition — the backdrop fades while the
 * panel springs up, which reads better than Modal's stock slide. Stays mounted
 * through the exit animation so it doesn't disappear mid-flight.
 */
export function Sheet({ visible, onClose, title, subtitle, children, footer, maxHeight = '78%' }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 3 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 190, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        <Animated.View style={[s.backdrop, { opacity: anim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>

        <Animated.View
          style={[
            s.panel,
            { maxHeight, paddingBottom: Math.max(insets.bottom, space.xl), transform: [{ translateY }] },
          ]}
        >
          <View style={s.handle} />
          {!!title && (
            <View style={s.head}>
              <Text style={text.h1}>{title}</Text>
              {!!subtitle && <Text style={text.small}>{subtitle}</Text>}
            </View>
          )}
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {!!footer && <View style={s.footer}>{footer}</View>}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    ...shadow.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: space.lg,
  },
  head: { gap: 2, marginBottom: space.lg },
  scroll: { flexGrow: 0 },
  scrollBody: { paddingBottom: space.sm },
  footer: { paddingTop: space.lg, flexDirection: 'row', gap: space.md },
});

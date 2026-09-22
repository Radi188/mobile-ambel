import { useRef } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** How far the surface sinks on touch. Bigger surfaces want a subtler scale. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  accessibilityLabel?: string;
};

/**
 * The app's only tappable primitive. Every button, card and row presses the same
 * way — a short spring down on touch — so touch feedback is uniform without each
 * screen hand-rolling `activeOpacity`.
 */
export function Press({ children, onPress, onLongPress, disabled, scaleTo = 0.97, style, hitSlop, accessibilityLabel }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 50, bounciness: 0 }).start();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={hitSlop}
      onPressIn={() => spring(scaleTo)}
      onPressOut={() => spring(1)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

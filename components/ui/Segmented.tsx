import { useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../constants/theme';

type Props<T extends string> = {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  inverse?: boolean;
};

/**
 * Sliding segmented control. The indicator animates between segments instead of
 * hard-swapping, which is most of what makes a tab row feel native.
 */
export function Segmented<T extends string>({ options, value, onChange, inverse }: Props<T>) {
  const [width, setWidth] = useState(0);
  const slide = useRef(new Animated.Value(options.findIndex(o => o.key === value))).current;
  const segment = width > 0 ? (width - 8) / options.length : 0;

  const select = (key: T, index: number) => {
    Animated.spring(slide, { toValue: index, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
    onChange(key);
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={[s.track, inverse && s.trackInverse]} onLayout={onLayout}>
      {segment > 0 && (
        <Animated.View
          style={[
            s.thumb,
            inverse && s.thumbInverse,
            {
              width: segment,
              transform: [{
                translateX: slide.interpolate({
                  inputRange: options.map((_, idx) => idx),
                  outputRange: options.map((_, idx) => idx * segment),
                }),
              }],
            },
          ]}
        />
      )}
      {options.map((opt, idx) => {
        const on = opt.key === value;
        return (
          <Pressable key={opt.key} style={s.segment} onPress={() => select(opt.key, idx)}>
            <Text
              style={[
                s.label,
                inverse && { color: colors.textInverseSub },
                on && (inverse ? s.labelOnInverse : s.labelOn),
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    padding: 4,
  },
  trackInverse: { backgroundColor: colors.fillInverse },
  thumb: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  thumbInverse: { backgroundColor: colors.surface },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space.sm + 2 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  labelOn: { color: colors.textInverse },
  labelOnInverse: { color: colors.text },
});

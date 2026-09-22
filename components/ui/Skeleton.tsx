import { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, space } from '../../constants/theme';

/**
 * One shared pulse driver so every placeholder on a screen breathes in sync
 * instead of each block running its own loop.
 */
function usePulse() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return v;
}

type BlockProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  /** Use on dark surfaces (the inverse hero card). */
  onDark?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export function Skeleton({ width = '100%', height = 14, radius: r = 8, onDark, style }: BlockProps) {
  const v = usePulse();
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: r, backgroundColor: onDark ? colors.trackInverse : colors.surfaceSunken, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({ size = 44, onDark }: { size?: number; onDark?: boolean }) {
  return <Skeleton width={size} height={size} radius={size / 2} onDark={onDark} />;
}

// ─── Composed layouts ─────────────────────────────────────────────────────────

export function SkeletonList({ rows = 6, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <View style={s.card}>
      {Array.from({ length: rows }).map((_, idx) => (
        <View key={idx}>
          {idx > 0 && <View style={s.divider} />}
          <View style={s.row}>
            {avatar && <SkeletonCircle size={44} />}
            <View style={s.rowBody}>
              <Skeleton width={`${52 + ((idx * 13) % 28)}%`} height={13} />
              <Skeleton width={`${32 + ((idx * 17) % 22)}%`} height={11} />
            </View>
            <Skeleton width={52} height={20} radius={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={s.stack}>
      <View style={s.hero}>
        <Skeleton width={110} height={10} onDark />
        <Skeleton width="64%" height={40} radius={12} onDark />
        <Skeleton width="100%" height={56} radius={14} onDark />
        <View style={s.heroChips}>
          <Skeleton width="31%" height={52} radius={16} onDark />
          <Skeleton width="31%" height={52} radius={16} onDark />
          <Skeleton width="31%" height={52} radius={16} onDark />
        </View>
      </View>
      <View style={s.grid}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <View key={idx} style={s.tile}>
            <Skeleton width="58%" height={10} />
            <Skeleton width="46%" height={24} radius={10} />
          </View>
        ))}
      </View>
      <SkeletonList rows={3} avatar={false} />
    </View>
  );
}

export function SkeletonReport() {
  return (
    <View style={s.stack}>
      <View style={s.grid}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <View key={idx} style={s.tile}>
            <Skeleton width="55%" height={10} />
            <Skeleton width="70%" height={24} radius={10} />
          </View>
        ))}
      </View>
      <View style={[s.card, s.chartCard]}>
        <Skeleton width={130} height={12} />
        <View style={s.bars}>
          {[62, 40, 84, 30, 58, 74, 46].map((h, idx) => (
            <Skeleton key={idx} width={20} height={h} radius={10} />
          ))}
        </View>
      </View>
      <SkeletonList rows={4} avatar={false} />
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: space.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.xs,
  },
  chartCard: { padding: space.xl, gap: space.xl },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg },
  rowBody: { flex: 1, gap: space.sm },
  hero: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.xl,
    padding: space.xxl,
    gap: space.lg,
  },
  heroChips: { flexDirection: 'row', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 90 },
});

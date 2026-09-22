import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Press } from './Press';
import { colors, radius, shadow, space } from '../../constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  index:    { on: 'pie-chart', off: 'pie-chart-outline' },
  orders:   { on: 'receipt', off: 'receipt-outline' },
  products: { on: 'cafe', off: 'cafe-outline' },
  reports:  { on: 'stats-chart', off: 'stats-chart-outline' },
  settings: { on: 'person-circle', off: 'person-circle-outline' },
};

/**
 * Floating tab bar. The active tab is marked by a solid black disc behind the
 * icon — the same "filled = selected" language the chips and badges use.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, space.md) }]} pointerEvents="box-none">
      <View style={s.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const icon = ICONS[route.name] ?? { on: 'ellipse', off: 'ellipse-outline' };
          const label = options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Press key={route.key} onPress={onPress} scaleTo={0.9} style={s.item} accessibilityLabel={label}>
              <View style={[s.iconBox, focused && s.iconBoxOn]}>
                <Ionicons
                  name={focused ? icon.on : icon.off}
                  size={19}
                  color={focused ? colors.textInverse : colors.textTertiary}
                />
              </View>
              <Text style={[s.label, focused && s.labelOn]} numberOfLines={1}>{label}</Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.sm,
    ...shadow.md,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  iconBox: {
    width: 38,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxOn: { backgroundColor: colors.accent },
  label: { fontSize: 10, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.1 },
  labelOn: { color: colors.text },
});

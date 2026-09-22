import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Press } from './Press';
import { colors, radius, space } from '../../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to fill the parent — the default for footers and forms. */
  full?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZES: Record<ButtonSize, { height: number; padding: number; font: number; icon: number; gap: number }> = {
  sm: { height: 36, padding: space.md, font: 13, icon: 15, gap: 6 },
  md: { height: 46, padding: space.xl, font: 14, icon: 17, gap: 8 },
  lg: { height: 54, padding: space.xxl, font: 15, icon: 18, gap: 8 },
};

/**
 * Monochrome buttons: emphasis comes from fill, not hue. `destructive` reads as
 * a heavier outline rather than red — the confirming system alert supplies the
 * warning colour.
 */
export function Button({
  label, onPress, variant = 'primary', size = 'md',
  icon, iconRight, loading, disabled, full, style,
}: Props) {
  const dim = SIZES[size];
  const off = disabled || loading;
  const ink = variant === 'primary' ? colors.textInverse
    : variant === 'ghost' ? colors.textSecondary
    : colors.text;

  return (
    <Press
      onPress={onPress}
      disabled={off}
      scaleTo={0.96}
      accessibilityLabel={label}
      style={[
        s.base,
        { height: dim.height, paddingHorizontal: dim.padding, gap: dim.gap },
        variant === 'primary' && s.primary,
        variant === 'secondary' && s.secondary,
        variant === 'ghost' && s.ghost,
        variant === 'destructive' && s.destructive,
        full && s.full,
        off && s.off,
        style,
      ]}
    >
      <View style={[s.inner, { gap: dim.gap }]}>
        {loading ? (
          <ActivityIndicator size="small" color={ink} />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={dim.icon} color={ink} />}
            <Text style={[s.label, { fontSize: dim.font, color: ink }]} numberOfLines={1}>{label}</Text>
            {iconRight && <Ionicons name={iconRight} size={dim.icon} color={ink} />}
          </>
        )}
      </View>
    </Press>
  );
}

const s = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  full: { alignSelf: 'stretch', flexGrow: 1 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.text },
  off: { opacity: 0.45 },
  label: { fontWeight: '600', letterSpacing: -0.1 },
});

// ─── Icon button ──────────────────────────────────────────────────────────────

type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  variant?: 'plain' | 'filled' | 'outline';
  size?: number;
  disabled?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({ icon, onPress, variant = 'plain', size = 40, disabled, label, style }: IconButtonProps) {
  const ink = variant === 'filled' ? colors.textInverse : colors.text;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.9}
      accessibilityLabel={label ?? icon}
      hitSlop={8}
      style={[
        i.base,
        { width: size, height: size, borderRadius: size / 2 },
        variant === 'filled' && i.filled,
        variant === 'outline' && i.outline,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={ink} />
    </Press>
  );
}

const i = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: colors.accent },
  outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});

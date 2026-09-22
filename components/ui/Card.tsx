import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Press } from './Press';
import { colors, radius, shadow, space, text } from '../../constants/theme';

export type CardTone = 'default' | 'inverse' | 'sunken' | 'outline';

type CardProps = {
  children: React.ReactNode;
  tone?: CardTone;
  /** Turn off to lay rows edge-to-edge inside the card. */
  padded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, tone = 'default', padded = true, onPress, style }: CardProps) {
  const body = (
    <View style={[s.base, TONES[tone], padded && s.padded, style]}>
      {children}
    </View>
  );
  if (!onPress) return body;
  return <Press onPress={onPress} scaleTo={0.985}>{body}</Press>;
}

const TONES: Record<CardTone, ViewStyle> = {
  default: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, ...shadow.xs },
  inverse: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse, borderWidth: 1, ...shadow.md },
  sunken:  { backgroundColor: colors.surfaceSunken, borderColor: 'transparent', borderWidth: 1 },
  outline: { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 },
};

// ─── Header ───────────────────────────────────────────────────────────────────

type CardHeaderProps = {
  title: string;
  subtitle?: string;
  /** Right-hand affordance — a link-style action or any node. */
  action?: { label: string; onPress: () => void };
  right?: React.ReactNode;
  inverse?: boolean;
};

export function CardHeader({ title, subtitle, action, right, inverse }: CardHeaderProps) {
  return (
    <View style={s.header}>
      <View style={s.headerText}>
        <Text style={[text.h3, inverse && { color: colors.textInverse }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && (
          <Text style={[text.caption, inverse && { color: colors.textInverseSub }]} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      {right}
      {!!action && (
        <Press onPress={action.onPress} hitSlop={8} scaleTo={0.94}>
          <Text style={[text.smallStrong, inverse && { color: colors.textInverse }]}>{action.label}</Text>
        </Press>
      )}
    </View>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

export function SectionLabel({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return <Text style={[text.overline, s.sectionLabel, style as any]}>{children}</Text>;
}

export function Divider({ inset = 0, inverse }: { inset?: number; inverse?: boolean }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: inverse ? colors.borderInverse : colors.divider,
        marginLeft: inset,
      }}
    />
  );
}

const s = StyleSheet.create({
  base: { borderRadius: radius.lg, overflow: 'hidden' },
  padded: { padding: space.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  sectionLabel: { marginBottom: space.sm, marginLeft: space.xs },
});

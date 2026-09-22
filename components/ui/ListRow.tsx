import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Press } from './Press';
import { Divider } from './Card';
import { colors, radius, shadow, space, text } from '../../constants/theme';

// ─── List container ───────────────────────────────────────────────────────────

type ListProps = {
  children: React.ReactNode;
  /** Card-styled container. Off = rows sit directly on the page background. */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Wraps rows in one surface and hairlines between them — no per-row borders. */
export function List({ children, inset = true, style }: ListProps) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={[inset && l.card, style]}>
      {rows.map((row, idx) => (
        <View key={idx}>
          {idx > 0 && <Divider inset={inset ? space.lg : 0} />}
          {row}
        </View>
      ))}
    </View>
  );
}

const l = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.xs,
  },
});

// ─── Row ──────────────────────────────────────────────────────────────────────

type RowProps = {
  title: string;
  subtitle?: string;
  /** Small icon+text pairs under the subtitle (branch, cashier, time…). */
  meta?: { icon: keyof typeof Ionicons.glyphMap; text: string }[];
  leading?: React.ReactNode;
  /** Right-hand headline, usually money. */
  value?: string;
  valueSub?: string;
  badge?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  compact?: boolean;
};

export function ListRow({
  title, subtitle, meta, leading, value, valueSub, badge, onPress, chevron, compact,
}: RowProps) {
  const body = (
    <View style={[r.row, compact && r.rowCompact]}>
      {leading}
      <View style={r.body}>
        <View style={r.titleLine}>
          <Text style={[text.bodyStrong, r.title]} numberOfLines={1}>{title}</Text>
          {badge}
        </View>
        {!!subtitle && <Text style={text.caption} numberOfLines={1}>{subtitle}</Text>}
        {!!meta?.length && (
          <View style={r.metaRow}>
            {meta.map((m, idx) => (
              <View key={idx} style={r.metaItem}>
                <Ionicons name={m.icon} size={12} color={colors.textTertiary} />
                <Text style={text.micro} numberOfLines={1}>{m.text}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {(!!value || !!valueSub) && (
        <View style={r.valueBox}>
          {!!value && <Text style={text.money}>{value}</Text>}
          {!!valueSub && <Text style={text.micro}>{valueSub}</Text>}
        </View>
      )}
      {chevron && <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />}
    </View>
  );

  if (!onPress) return body;
  return <Press onPress={onPress} scaleTo={0.99}>{body}</Press>;
}

const r = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg - 2,
    backgroundColor: colors.surface,
  },
  rowCompact: { paddingVertical: space.md - 1 },
  body: { flex: 1, gap: 3 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md, marginTop: 1 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '70%' },
  valueBox: { alignItems: 'flex-end', gap: 2 },
});

// ─── Key/value row ────────────────────────────────────────────────────────────

/** Label on the left, figure on the right — the atom every report table is built from. */
export function DataRow({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <View style={d.row}>
      <View style={d.labelBox}>
        <Text style={strong ? text.bodyStrong : text.body} numberOfLines={1}>{label}</Text>
        {!!sub && <Text style={text.micro} numberOfLines={1}>{sub}</Text>}
      </View>
      <Text style={[strong ? text.h2 : text.money, d.value]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const d = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.md,
  },
  labelBox: { flex: 1, gap: 1 },
  value: { textAlign: 'right' },
});

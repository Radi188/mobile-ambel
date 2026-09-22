import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Press } from './Press';
import { colors, radius, space } from '../../constants/theme';

export type ChipOption<T extends string> = { key: T; label: string; count?: number };

type Props<T extends string> = {
  options: ChipOption<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Lay the chips out in a wrapping block instead of a horizontal scroller. */
  wrap?: boolean;
};

/** Single-select filter chips. Selected = black fill, the app's only "on" state. */
export function Chips<T extends string>({ options, value, onChange, wrap }: Props<T>) {
  const items = options.map(opt => {
    const on = opt.key === value;
    return (
      <Press key={opt.key} onPress={() => onChange(opt.key)} scaleTo={0.94} style={[s.chip, on && s.chipOn]}>
        <Text style={[s.label, on && s.labelOn]}>
          {opt.label}
          {opt.count != null ? `  ${opt.count}` : ''}
        </Text>
      </Press>
    );
  });

  if (wrap) return <View style={s.wrap}>{items}</View>;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {items}
    </ScrollView>
  );
}

/** Multi-select variant — same visuals, a set instead of one value. */
export function MultiChips<T extends string>({
  options, values, onToggle,
}: {
  options: ChipOption<T>[];
  values: T[];
  onToggle: (key: T) => void;
}) {
  return (
    <View style={s.wrap}>
      {options.map(opt => {
        const on = values.includes(opt.key);
        return (
          <Press key={opt.key} onPress={() => onToggle(opt.key)} scaleTo={0.94} style={[s.chip, on && s.chipOn]}>
            <Text style={[s.label, on && s.labelOn]}>{opt.label}</Text>
          </Press>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { gap: space.sm, paddingRight: space.xl, paddingVertical: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.lg - 2,
    paddingVertical: space.sm + 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  labelOn: { color: colors.textInverse, fontWeight: '600' },
});

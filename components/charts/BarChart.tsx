import { StyleSheet, Text, View } from 'react-native';
import { colors, moneyCompact, space, text } from '../../constants/theme';

export type Bar = { label: string; value: number };

type Props = {
  data: Bar[];
  height?: number;
  /** Prints a compact money figure above each bar. */
  showValues?: boolean;
  onDark?: boolean;
};

/**
 * Vertical bars. The peak is filled solid and the rest sit a step lighter, so
 * the high point is legible without colour.
 */
export function BarChart({ data, height = 150, showValues = true, onDark }: Props) {
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <View style={[s.wrap, { height }]}>
      {data.map((bar, idx) => {
        const pct = (bar.value / max) * 100;
        const peak = bar.value === max && bar.value > 0;
        return (
          <View key={`${bar.label}-${idx}`} style={s.col}>
            {showValues && (
              <Text style={[s.value, onDark && { color: colors.textInverseSub }]} numberOfLines={1}>
                {bar.value > 0 ? moneyCompact(bar.value) : ''}
              </Text>
            )}
            <View style={[s.track, onDark && s.trackDark]}>
              <View
                style={[
                  s.fill,
                  onDark ? s.fillDark : s.fillLight,
                  peak && (onDark ? s.peakDark : s.peakLight),
                  { height: `${Math.max(pct, 2)}%` },
                ]}
              />
            </View>
            <Text style={[s.label, onDark && { color: colors.textInverseSub }]} numberOfLines={1}>
              {bar.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  track: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.track,
  },
  trackDark: { backgroundColor: colors.trackInverse },
  fill: { width: '100%', borderRadius: 12 },
  fillLight: { backgroundColor: colors.borderStrong },
  fillDark: { backgroundColor: 'rgba(255,255,255,0.45)' },
  peakLight: { backgroundColor: colors.accent },
  peakDark: { backgroundColor: colors.textInverse },
  value: { ...text.micro, fontSize: 9, marginBottom: space.xs, textAlign: 'center' },
  label: { ...text.micro, fontSize: 10, marginTop: 6, textAlign: 'center' },
});

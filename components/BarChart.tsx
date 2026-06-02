import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type Bar = {
  label: string;
  value: number;
};

type BarChartProps = {
  data: Bar[];
  maxValue?: number;
  showValues?: boolean;
};

function fmtVal(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function BarChart({ data, maxValue, showValues = false }: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.container}>
      {data.map((bar, i) => {
        const heightPct = (bar.value / max) * 100;
        return (
          <View key={i} style={styles.barGroup}>
            {showValues && (
              <Text style={styles.valueLabel}>{fmtVal(bar.value)}</Text>
            )}
            <View style={styles.barTrack}>
              <View style={[styles.bar, { height: `${heightPct}%` }]} />
            </View>
            <Text style={styles.barLabel} numberOfLines={1}>{bar.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    gap: 8,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Colors.gray100,
  },
  bar: {
    width: '100%',
    backgroundColor: Colors.gray800,
    borderRadius: 6,
  },
  valueLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  barLabel: {
    marginTop: 6,
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
});

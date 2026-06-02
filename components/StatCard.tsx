import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  accent?: boolean;
};

export function StatCard({ label, value, sub, trend, trendValue, accent }: StatCardProps) {
  const trendColor =
    trend === 'up' ? '#4CAF50' : trend === 'down' ? '#F44336' : Colors.gray500;
  const trendSymbol = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <Text style={[styles.label, accent && styles.labelAccent]}>{label}</Text>
      <Text style={[styles.value, accent && styles.valueAccent]}>{value}</Text>
      {(sub || trendValue) && (
        <View style={styles.footer}>
          {trendValue && trend && (
            <Text style={[styles.trend, { color: accent ? Colors.gray300 : trendColor }]}>
              {trendSymbol} {trendValue}
            </Text>
          )}
          {sub && (
            <Text style={[styles.sub, accent && styles.subAccent]}>{sub}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardAccent: {
    backgroundColor: Colors.gray900,
    borderColor: Colors.gray900,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  labelAccent: {
    color: Colors.gray400,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  valueAccent: {
    color: Colors.white,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  trend: {
    fontSize: 12,
    fontWeight: '600',
  },
  sub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  subAccent: {
    color: Colors.gray400,
  },
});

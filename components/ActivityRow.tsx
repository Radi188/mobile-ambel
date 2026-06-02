import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type ActivityRowProps = {
  title: string;
  subtitle: string;
  value: string;
  valueColor?: string;
  isLast?: boolean;
};

export function ActivityRow({ title, subtitle, value, valueColor, isLast }: ActivityRowProps) {
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.dot} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gray300,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});

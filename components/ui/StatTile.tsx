import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, space, text } from '../../constants/theme';

type Props = {
  label: string;
  value: string;
  sub?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'inverse';
  style?: StyleProp<ViewStyle>;
};

/** Compact KPI tile for grid rows. Value shrinks to fit rather than truncating. */
export function StatTile({ label, value, sub, icon, tone = 'default', style }: Props) {
  const inverse = tone === 'inverse';
  return (
    <View style={[s.tile, inverse && s.tileInverse, style]}>
      <View style={s.head}>
        <Text style={[text.overline, inverse && { color: colors.textInverseDim }]} numberOfLines={1}>{label}</Text>
        {!!icon && <Ionicons name={icon} size={14} color={inverse ? colors.textInverseDim : colors.textTertiary} />}
      </View>
      <Text
        style={[text.metric, inverse && { color: colors.textInverse }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      {!!sub && <Text style={[text.micro, inverse && { color: colors.textInverseSub }]} numberOfLines={1}>{sub}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 150,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
    ...shadow.xs,
  },
  tileInverse: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});

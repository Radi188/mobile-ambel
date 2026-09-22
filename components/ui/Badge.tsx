import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, space } from '../../constants/theme';

export type BadgeTone = 'solid' | 'subtle' | 'outline' | 'inverse';

type Props = {
  label: string;
  tone?: BadgeTone;
  /** Leading dot — the monochrome stand-in for a status colour. */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Status pill. With no hue available, a filled badge means "the notable state"
 * (open, active, completed) and a hollow one means the quiet default.
 */
export function Badge({ label, tone = 'subtle', dot, style }: Props) {
  const ink =
    tone === 'solid' ? colors.textInverse :
    tone === 'inverse' ? colors.textInverse :
    tone === 'outline' ? colors.textSecondary :
    colors.text;

  return (
    <View style={[s.base, TONES[tone], style]}>
      {dot && <View style={[s.dot, { backgroundColor: ink }]} />}
      <Text style={[s.label, { color: ink }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const TONES: Record<BadgeTone, ViewStyle> = {
  solid:   { backgroundColor: colors.accent },
  subtle:  { backgroundColor: colors.surfaceSunken },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  inverse: { backgroundColor: colors.fillInverse },
};

const s = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm + 1,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
});

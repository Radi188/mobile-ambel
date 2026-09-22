import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors, palette, space, text } from '../../constants/theme';

type Props = {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

/** Labelled switch row, themed to the black/white track. */
export function Toggle({ label, sub, value, onChange }: Props) {
  return (
    <View style={s.row}>
      <View style={s.copy}>
        <Text style={text.bodyStrong}>{label}</Text>
        {!!sub && <Text style={text.caption}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={palette.white}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg },
  copy: { flex: 1, gap: 2 },
});

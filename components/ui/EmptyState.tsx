import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, radius, space, text } from '../../constants/theme';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ icon = 'file-tray-outline', title, message, action }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.iconRing}>
        <Ionicons name={icon} size={24} color={colors.textTertiary} />
      </View>
      <View style={s.copy}>
        <Text style={text.h3}>{title}</Text>
        {!!message && <Text style={[text.small, s.message]}>{message}</Text>}
      </View>
      {!!action && <Button label={action.label} onPress={action.onPress} variant="secondary" size="sm" />}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.lg, paddingVertical: space.huge, paddingHorizontal: space.xl },
  iconRing: {
    width: 56, height: 56, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
  },
  copy: { alignItems: 'center', gap: space.xs },
  message: { textAlign: 'center', maxWidth: 280 },
});

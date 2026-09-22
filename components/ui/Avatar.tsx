import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';

type Props = {
  /** Initials are derived from the name; falsy names fall back to the icon. */
  name?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: number;
  tone?: 'solid' | 'sunken' | 'outline';
  /** Dims the avatar for deactivated records. */
  muted?: boolean;
};

export function Avatar({ name, icon, size = 44, tone = 'solid', muted }: Props) {
  const ink = tone === 'solid' ? colors.textInverse : colors.text;
  const initial = (name?.trim()?.[0] ?? '').toUpperCase();

  return (
    <View
      style={[
        s.base,
        { width: size, height: size, borderRadius: size / 2 },
        tone === 'solid' && s.solid,
        tone === 'sunken' && s.sunken,
        tone === 'outline' && s.outline,
        muted && s.muted,
      ]}
    >
      {initial && !icon ? (
        <Text style={{ color: ink, fontSize: Math.round(size * 0.4), fontWeight: '700' }}>{initial}</Text>
      ) : (
        <Ionicons name={icon ?? 'person'} size={Math.round(size * 0.44)} color={ink} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  solid: { backgroundColor: colors.accent },
  sunken: { backgroundColor: colors.surfaceSunken },
  outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  muted: { opacity: 0.35 },
});

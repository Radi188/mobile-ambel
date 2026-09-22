import { useState } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Press } from './Press';
import { colors, layout, radius, space, text } from '../../constants/theme';

type FieldProps = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  optional?: boolean;
  hint?: string;
  error?: string;
  secure?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'decimal-pad' | 'number-pad' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Labelled text field. Focus is shown by darkening the border to black rather
 * than tinting it — the whole system's focus language.
 */
export function TextField({
  label, value, onChangeText, placeholder, icon, optional, hint, error,
  secure, multiline, keyboardType = 'default', autoCapitalize, maxLength, style,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  return (
    <View style={[s.wrap, style]}>
      {!!label && (
        <Text style={text.overline}>
          {label}
          {optional ? <Text style={s.optional}>  optional</Text> : null}
        </Text>
      )}
      <View style={[s.box, multiline && s.boxMultiline, focused && s.boxFocused, !!error && s.boxError]}>
        {!!icon && <Ionicons name={icon} size={17} color={focused ? colors.text : colors.textTertiary} />}
        <TextInput
          style={[s.input, multiline && s.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={secure && !reveal}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')}
          autoCorrect={false}
          maxLength={maxLength}
          selectionColor={colors.text}
          keyboardAppearance="light"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secure && (
          <Press onPress={() => setReveal(v => !v)} hitSlop={10} scaleTo={0.9}>
            <Ionicons name={reveal ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.textSecondary} />
          </Press>
        )}
      </View>
      {!!(error || hint) && (
        <Text style={[text.micro, !!error && s.errorText]}>{error || hint}</Text>
      )}
    </View>
  );
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function SearchField({
  value, onChangeText, placeholder = 'Search', style,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.box, s.search, focused && s.boxFocused, style]}>
      <Ionicons name="search" size={17} color={focused ? colors.text : colors.textTertiary} />
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        selectionColor={colors.text}
        clearButtonMode="never"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value.length > 0 && (
        <Press onPress={() => onChangeText('')} hitSlop={layout.hitSlop} scaleTo={0.9}>
          <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
        </Press>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: space.sm },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md - 2,
    minHeight: 50,
    paddingHorizontal: space.lg - 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  search: { minHeight: 46 },
  boxMultiline: { minHeight: 96, alignItems: 'flex-start', paddingVertical: space.md },
  boxFocused: { borderColor: colors.text },
  boxError: { borderColor: colors.text, borderWidth: 1.5, backgroundColor: colors.surfaceSunken },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: space.md,
    paddingHorizontal: 0,
  },
  inputMultiline: { textAlignVertical: 'top', minHeight: 72 },
  optional: { fontSize: 10, fontWeight: '500', color: colors.textTertiary, letterSpacing: 0.4 },
  errorText: { color: colors.text, fontWeight: '600' },
});

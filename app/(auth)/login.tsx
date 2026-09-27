import { useEffect, useRef, useState } from 'react';
import {
  Animated, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Press, TextField } from '../../components/ui';
import { ServerSwitcherModal } from '../../components/ServerSwitcherModal';
import { PRODUCTION_API_URL } from '../../lib/serverConfig';
import { useAuth } from '../../context/AuthContext';
import { colors, layout, radius, shadow, space, text } from '../../constants/theme';

export default function LoginScreen() {
  const { login, server } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [serverOpen, setServerOpen] = useState(false);

  const brand = useRef(new Animated.Value(0)).current;
  const form = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(brand, { toValue: 1, duration: 620, useNativeDriver: true }),
      Animated.timing(form, { toValue: 1, duration: 560, useNativeDriver: true }),
    ]).start();
  }, []);

  const rise = (v: Animated.Value, distance: number) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  });

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isProduction = server === PRODUCTION_API_URL;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.column}>
            <Animated.View style={[s.brand, rise(brand, 16)]}>
              <View style={s.mark}>
                <Image source={require('../../assets/logo-mark.png')} style={s.logo} resizeMode="contain" />
              </View>
              <Text style={text.overline}>BongPOS Owner</Text>
            </Animated.View>

            <Animated.View style={[s.form, rise(form, 22)]}>
              <View style={s.heading}>
                <Text style={text.title}>Welcome back</Text>
                <Text style={text.small}>Sign in to manage your branch.</Text>
              </View>

              <View style={s.fields}>
                <TextField
                  label="Email"
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextField
                  label="Password"
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  autoCapitalize="none"
                  secure
                />
              </View>

              {!!error && (
                <View style={s.error}>
                  <Ionicons name="alert-circle" size={16} color={colors.text} />
                  <Text style={[text.small, s.errorText]}>{error}</Text>
                </View>
              )}

              <Button label="Sign in" onPress={handleLogin} loading={loading} size="lg" full iconRight="arrow-forward" />
            </Animated.View>
          </View>

          <View style={s.footer}>
            <Press onPress={() => setServerOpen(true)} style={s.server} accessibilityLabel="Change server">
              <Ionicons name="server-outline" size={13} color={colors.textSecondary} />
              <Text style={text.micro} numberOfLines={1}>
                {isProduction ? 'Production' : server.replace(/^https?:\/\//, '')}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
            </Press>
            <View style={s.rule} />
            <Text style={text.micro}>© 2026 BongPOS · All rights reserved</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ServerSwitcherModal visible={serverOpen} onClose={() => setServerOpen(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: space.huge,
    paddingBottom: space.xxl,
    justifyContent: 'space-between',
    gap: space.xxxl,
  },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: space.xxxl },

  brand: { alignItems: 'center', gap: space.md },
  mark: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
    ...shadow.sm,
  },
  logo: { width: 68, height: 68 },

  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xxl,
    gap: space.xxl,
    ...shadow.sm,
  },
  heading: { gap: space.xs },
  fields: { gap: space.lg },

  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 14,
    paddingHorizontal: space.lg - 2,
    paddingVertical: space.md,
  },
  errorText: { flex: 1, color: colors.text, fontWeight: '500' },

  footer: { alignItems: 'center', gap: space.md },
  server: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    maxWidth: '100%',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  rule: { width: 24, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
});

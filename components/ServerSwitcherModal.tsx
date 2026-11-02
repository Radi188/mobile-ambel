import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, FormModal, Segmented, TextField } from './ui';
import { useAuth } from '../context/AuthContext';
import { BACKENDS, normaliseBaseUrl, ServerTest, testServer } from '../lib/serverConfig';
import { colors, space, text } from '../constants/theme';

type Choice = 'production' | 'custom';

type Props = { visible: boolean; onClose: () => void };

/**
 * The login screen's "which server" sheet, as in ambel-mobile, for the backend
 * picked there (BongPOS or Ambel): its production address or a custom one
 * (staging, a laptop on the shop's Wi-Fi), a connection test, and a switch
 * that forgets the old server's session.
 */
export function ServerSwitcherModal({ visible, onClose }: Props) {
  const { backend, server, switchServer } = useAuth();
  const { label, url: production } = BACKENDS[backend];
  const [choice, setChoice] = useState<Choice>('production');
  const [url, setUrl] = useState('');
  const [test, setTest] = useState<ServerTest | 'running' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Start from whatever is in use each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    const custom = server !== production;
    setChoice(custom ? 'custom' : 'production');
    setUrl(custom ? server : '');
    setTest(null);
    setError('');
  }, [visible, server, production]);

  const target = choice === 'custom' ? normaliseBaseUrl(url) : production;
  const unchanged = target === server;

  const runTest = async () => {
    if (!target) { setTest({ ok: false, error: 'Enter a server address first.' }); return; }
    setTest('running');
    setTest(await testServer(target, backend));
  };

  const save = async () => {
    if (!target) { setError('Enter a server address, e.g. http://192.168.1.7:3000'); return; }
    setSaving(true);
    try {
      await switchServer(backend, target);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Could not switch server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      visible={visible}
      title={`${label} server`}
      onClose={onClose}
      onSubmit={unchanged ? onClose : save}
      submitLabel={unchanged ? 'Done' : 'Switch server'}
      submitting={saving}
      error={error}
    >
      <View style={s.section}>
        <Text style={text.small}>Where this device reaches {label}.</Text>
        <Segmented
          options={[{ key: 'production', label: 'Production' }, { key: 'custom', label: 'Custom' }]}
          value={choice}
          onChange={key => { setChoice(key); setTest(null); setError(''); }}
        />
      </View>

      {choice === 'production' ? (
        <View style={s.current}>
          <Ionicons name="cloud-outline" size={16} color={colors.textSecondary} />
          <Text style={[text.small, s.flex]} numberOfLines={1}>{production}</Text>
          {server === production && <Text style={text.micro}>In use</Text>}
        </View>
      ) : (
        <TextField
          label="Server address"
          icon="server-outline"
          value={url}
          onChangeText={v => { setUrl(v); setTest(null); setError(''); }}
          placeholder={backend === 'ambel' ? 'http://192.168.1.7:3000/api' : 'http://192.168.1.7:3000'}
          autoCapitalize="none"
          error={url && !normaliseBaseUrl(url) ? 'That doesn’t look like a web address.' : undefined}
          hint={target && target !== url.trim() ? `Will use ${target}` : undefined}
        />
      )}

      <View style={s.section}>
        <Button
          label="Test connection"
          icon="pulse-outline"
          variant="secondary"
          onPress={runTest}
          disabled={test === 'running'}
          full
        />
        {test === 'running' && <ActivityIndicator color={colors.text} />}
        {test && test !== 'running' && (
          <View style={s.result}>
            <Ionicons name={test.ok ? 'checkmark-circle' : 'alert-circle'} size={16} color={colors.text} />
            <Text style={[text.small, s.flex, s.resultText]}>
              {test.ok ? `Reachable · answered in ${test.ms} ms` : test.error}
            </Text>
          </View>
        )}
      </View>

      {!unchanged && (
        <Text style={text.small}>
          Switching signs this device out. Sign in again with an account that exists on the new server.
        </Text>
      )}
    </FormModal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space.md },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg - 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg - 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  resultText: { color: colors.text, fontWeight: '500' },
});

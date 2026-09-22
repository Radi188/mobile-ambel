import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, IconButton } from './Button';
import { colors, space, text } from '../../constants/theme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  /** Shows a trash affordance in the header when editing an existing record. */
  onDelete?: () => void;
  deleting?: boolean;
  error?: string;
  children: React.ReactNode;
};

/**
 * The shared create/edit scaffold: page-sheet modal, fixed header, scrolling
 * body, sticky footer. Every form in the app (product, user, branch) is this
 * component plus fields, so they can't drift apart.
 */
export function FormModal({
  visible, title, onClose, onSubmit, submitLabel, submitting,
  onDelete, deleting, error, children,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.header}>
            <IconButton icon="close" onPress={onClose} label="Close" size={36} />
            <Text style={text.h2} numberOfLines={1}>{title}</Text>
            {onDelete ? (
              <IconButton
                icon={deleting ? 'hourglass-outline' : 'trash-outline'}
                onPress={onDelete}
                disabled={deleting}
                label="Delete"
                size={36}
              />
            ) : (
              <View style={s.headerSpacer} />
            )}
          </View>

          <ScrollView
            contentContainerStyle={s.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}

            {!!error && (
              <View style={s.error}>
                <Ionicons name="alert-circle" size={16} color={colors.text} />
                <Text style={[text.small, s.errorText]}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={s.footer}>
            <Button label="Cancel" onPress={onClose} variant="secondary" size="lg" style={s.cancel} />
            <Button label={submitLabel} onPress={onSubmit} loading={submitting} size="lg" style={s.submit} />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerSpacer: { width: 36 },
  body: { padding: space.xl, paddingBottom: space.xxxl, gap: space.xxl },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 14,
    padding: space.lg - 2,
  },
  errorText: { flex: 1, color: colors.text, fontWeight: '500' },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.xl,
    paddingTop: space.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cancel: { flex: 1 },
  submit: { flex: 1.6 },
});

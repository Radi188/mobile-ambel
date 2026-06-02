import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';

type SettingRowProps = {
  label: string;
  subtitle?: string;
  value?: string;
  isLast?: boolean;
  onPress?: () => void;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  danger?: boolean;
};

function SettingRow({ label, subtitle, value, isLast, onPress, toggle, toggleValue, onToggle, danger }: SettingRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={toggle ? 1 : 0.6}
    >
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: Colors.gray200, true: Colors.gray700 }}
          thumbColor={Colors.white}
          ios_backgroundColor={Colors.gray200}
        />
      ) : (
        <View style={styles.rowRight}>
          {value && <Text style={styles.rowValue}>{value}</Text>}
          <Text style={styles.chevron}>›</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const canManageUsers = user?.role === 'super_admin' || user?.role === 'manager';

  const roleBadge: Record<string, string> = {
    super_admin: 'Super Admin',
    manager: 'Manager',
    cashier: 'Cashier',
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(user?.name?.[0] ?? 'A').toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name ?? '—'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? '—'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {roleBadge[user?.role ?? ''] ?? user?.role ?? ''}
              </Text>
            </View>
          </View>
        </View>

        <SettingGroup title="Preferences">
          <SettingRow
            label="Push Notifications"
            subtitle="Alerts for orders and shifts"
            toggle
            toggleValue={notifications}
            onToggle={setNotifications}
            isLast
          />
        </SettingGroup>

        {canManageUsers && (
          <SettingGroup title="Management">
            <SettingRow
              label="Manage Users"
              subtitle="Staff accounts, roles & access"
              onPress={() => router.push('/users')}
              isLast
            />
          </SettingGroup>
        )}

        <SettingGroup title="Account">
          <SettingRow label="Change Password" onPress={() => {}} />
          <SettingRow label="Role" value={roleBadge[user?.role ?? ''] ?? user?.role ?? '—'} isLast />
        </SettingGroup>

        <SettingGroup title="About">
          <SettingRow label="Version" value="1.0.0" isLast />
        </SettingGroup>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.7} disabled={loggingOut}>
          {loggingOut
            ? <ActivityIndicator color="#D32F2F" size="small" />
            : <Text style={styles.signOutText}>Sign Out</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40, gap: 20 },
  header: { paddingVertical: 8 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5 },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.gray800,
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  profileEmail: { fontSize: 13, color: Colors.textSecondary },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: Colors.gray100,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: { fontSize: 11, fontWeight: '600', color: Colors.gray700, letterSpacing: 0.3 },
  group: { gap: 6 },
  groupTitle: {
    fontSize: 11, fontWeight: '600', color: Colors.textSecondary,
    letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 4,
  },
  groupCard: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  rowLabelDanger: { color: '#D32F2F' },
  rowSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowValue: { fontSize: 13, color: Colors.textSecondary },
  chevron: { fontSize: 18, color: Colors.gray400, marginTop: -1 },
  signOutBtn: {
    backgroundColor: Colors.white,
    borderRadius: 14, padding: 16,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: '#D32F2F' },
});

import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Avatar, Badge, Button, Card, List, ListRow, Screen, ScreenHeader, SectionLabel, Toggle,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { priceFor, subscriptionService } from '../../services/subscription.service';
import { money2, space, text } from '../../constants/theme';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  manager: 'Manager',
  cashier: 'Cashier',
};

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [planLabel, setPlanLabel] = useState('');

  // The account row shows what this account pays, so it stays honest if the
  // branch count or billing cycle changes.
  const loadPlan = useCallback(async () => {
    try {
      const [catalog, subscription] = await Promise.all([
        subscriptionService.getCatalog(),
        subscriptionService.getSubscription(),
      ]);
      const price = priceFor(catalog, subscription.branches);
      setPlanLabel(
        subscription.cycle === 'yearly'
          ? `${money2(price.yearly)} / year`
          : `${money2(price.monthly)} / month`,
      );
    } catch {
      setPlanLabel('');
    }
  }, []);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), loadPlan()]);
    setRefreshing(false);
  }, [refreshUser, loadPlan]);

  const isSuperAdmin = user?.role === 'super_admin';
  const canManageUsers = isSuperAdmin || user?.role === 'manager';
  const role = ROLE_LABEL[user?.role ?? ''] ?? user?.role ?? '—';

  const handleSignOut = () => {
    Alert.alert('Sign out', 'You will need to sign in again to use the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await logout();
        },
      },
    ]);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader subtitle="Signed in" title="Account" />

      <Card style={s.profile}>
        <Avatar name={user?.name} size={58} />
        <View style={s.profileCopy}>
          <Text style={text.h1} numberOfLines={1}>{user?.name ?? '—'}</Text>
          <Text style={text.small} numberOfLines={1}>{user?.email ?? '—'}</Text>
          <Badge label={role} tone="subtle" />
        </View>
      </Card>

      <View style={s.group}>
        <SectionLabel>Billing</SectionLabel>
        <List>
          <ListRow
            title="Subscription"
            subtitle="Plan, branches and what's included"
            leading={<Avatar icon="card-outline" size={38} tone="sunken" />}
            value={planLabel || undefined}
            onPress={() => router.push('/plans')}
            chevron
            compact
          />
        </List>
      </View>

      <View style={s.group}>
        <SectionLabel>Preferences</SectionLabel>
        <Card>
          <Toggle
            label="Push notifications"
            sub="Alerts for orders and shifts"
            value={notifications}
            onChange={setNotifications}
          />
        </Card>
      </View>

      {canManageUsers && (
        <View style={s.group}>
          <SectionLabel>Management</SectionLabel>
          <List>
            <ListRow
              title="Staff"
              subtitle="Accounts, roles and access"
              leading={<Avatar icon="people-outline" size={38} tone="sunken" />}
              onPress={() => router.push('/users')}
              chevron
              compact
            />
            {isSuperAdmin ? (
              <ListRow
                title="Branches"
                subtitle="Locations, contact details and status"
                leading={<Avatar icon="business-outline" size={38} tone="sunken" />}
                onPress={() => router.push('/branches')}
                chevron
                compact
              />
            ) : null}
          </List>
        </View>
      )}

      <View style={s.group}>
        <SectionLabel>About</SectionLabel>
        <List>
          <ListRow title="Role" value={role} compact />
          <ListRow title="Version" value="1.0.0" compact />
        </List>
      </View>

      <Button
        label="Sign out"
        icon="log-out-outline"
        variant="destructive"
        size="lg"
        full
        loading={signingOut}
        onPress={handleSignOut}
        style={s.signOut}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  profileCopy: { flex: 1, gap: space.xs, alignItems: 'flex-start' },
  group: { gap: space.xs },
  signOut: { marginTop: space.sm },
});

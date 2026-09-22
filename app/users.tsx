import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar, Badge, Card, Chips, EmptyState, FormModal, IconButton, ListRow,
  PagedList, RowCard, Screen, SearchField, SkeletonList, TextField, Toggle, TopBar,
} from '../components/ui';
import { usePaginatedList } from '../lib/usePaginatedList';
import { useAuth } from '../context/AuthContext';
import { usersService, UserPayload } from '../services/users.service';
import { Branch, User, UserRole } from '../types/api.types';
import { colors, plural, radius, space, text } from '../constants/theme';

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super admin',
  manager: 'Manager',
  cashier: 'Cashier',
};

const PAGE_SIZE = 20;

type RoleFilter = 'all' | UserRole;

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'super_admin', label: 'Admins' },
  { key: 'manager', label: 'Managers' },
  { key: 'cashier', label: 'Cashiers' },
];

function branchName(user: User): string {
  const b = user.branch;
  return typeof b === 'object' && b ? b.name : '';
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function emptyForm() {
  return {
    name: '',
    email: '',
    password: '',
    role: 'cashier' as UserRole,
    branch: '',
    isActive: true,
  };
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function UserForm({
  visible, editing, branches, isAdmin, managerBranchName, currentUserId, onClose, onSaved,
}: {
  visible: boolean;
  editing: User | null;
  branches: Branch[];
  isAdmin: boolean;
  managerBranchName: string;
  currentUserId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Managers can create staff, but not other admins.
  const roleOptions: UserRole[] = isAdmin ? ['cashier', 'manager', 'super_admin'] : ['cashier', 'manager'];

  useEffect(() => {
    if (!visible) return;
    setError('');
    if (editing) {
      setForm({
        name: editing.name,
        email: editing.email,
        password: '',
        role: editing.role,
        branch: typeof editing.branch === 'object' && editing.branch
          ? editing.branch._id
          : (editing.branch as string) ?? '',
        isActive: editing.isActive,
      });
    } else {
      setForm(emptyForm());
    }
  }, [visible, editing]);

  const set = (key: keyof ReturnType<typeof emptyForm>, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Name is required.';
    if (!isValidEmail(form.email.trim())) return 'A valid email is required.';
    if (!isEdit && form.password.length < 6) return 'Password must be at least 6 characters.';
    if (isEdit && form.password && form.password.length < 6) return 'New password must be at least 6 characters.';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);
    try {
      const wantsBranch = isAdmin && form.role !== 'super_admin' && form.branch;
      if (isEdit && editing) {
        const dto: Partial<UserPayload> = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          isActive: form.isActive,
          ...(wantsBranch ? { branch: form.branch } : {}),
        };
        await usersService.update(editing._id, dto);
        if (form.password) await usersService.changePassword(editing._id, form.password);
      } else {
        await usersService.create({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          isActive: form.isActive,
          ...(wantsBranch ? { branch: form.branch } : {}),
        });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert('Delete user', `Delete “${editing.name}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await usersService.remove(editing._id);
            onSaved();
            onClose();
          } catch (e: any) {
            setError(e?.message ?? 'Failed to delete.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const canDelete = isAdmin && isEdit && editing?._id !== currentUserId;

  return (
    <FormModal
      visible={visible}
      title={isEdit ? 'Edit staff' : 'New staff'}
      onClose={onClose}
      onSubmit={handleSave}
      submitLabel={isEdit ? 'Save changes' : 'Create user'}
      submitting={saving}
      onDelete={canDelete ? handleDelete : undefined}
      deleting={deleting}
      error={error}
    >
      <TextField label="Full name" value={form.name} onChangeText={v => set('name', v)} placeholder="e.g. Sok Dara" autoCapitalize="words" />
      <TextField
        label="Email"
        value={form.email}
        onChangeText={v => set('email', v)}
        placeholder="name@bongpos.com"
        keyboardType="email-address"
        icon="mail-outline"
      />
      <TextField
        label={isEdit ? 'New password' : 'Password'}
        value={form.password}
        onChangeText={v => set('password', v)}
        placeholder={isEdit ? 'Leave blank to keep current' : 'At least 6 characters'}
        secure
        optional={isEdit}
        icon="lock-closed-outline"
      />

      <View style={f.section}>
        <Text style={text.overline}>Role</Text>
        <Chips
          options={roleOptions.map(r => ({ key: r, label: ROLE_LABEL[r] }))}
          value={form.role}
          onChange={key => set('role', key)}
          wrap
        />
      </View>

      <View style={f.section}>
        <Text style={text.overline}>Branch</Text>
        {isAdmin ? (
          form.role === 'super_admin' ? (
            <Text style={text.caption}>Super admins can see every branch.</Text>
          ) : (
            <Chips
              options={branches.map(b => ({ key: b._id, label: b.name }))}
              value={form.branch}
              onChange={key => set('branch', key)}
              wrap
            />
          )
        ) : (
          <View style={f.readonly}>
            <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
            <Text style={[text.small, f.readonlyText]}>{managerBranchName || 'Your branch'}</Text>
            <Badge label="Auto-assigned" tone="subtle" />
          </View>
        )}
      </View>

      <Card>
        <Toggle
          label="Active"
          sub="Inactive users cannot sign in"
          value={form.isActive}
          onChange={v => set('isActive', v)}
        />
      </Card>
    </FormModal>
  );
}

const f = StyleSheet.create({
  section: { gap: space.md },
  readonly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: space.md,
  },
  readonlyText: { flex: 1, color: colors.text, fontWeight: '600' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const staff = usePaginatedList<User>(
    page => usersService.getUsers({
      page,
      limit: PAGE_SIZE,
      role: roleFilter === 'all' ? undefined : roleFilter,
      branch: branchFilter === 'all' ? undefined : branchFilter,
      search: debounced || undefined,
    }),
    [roleFilter, branchFilter, debounced],
  );

  useEffect(() => {
    if (!isAdmin) return;
    usersService.getBranches().then(list => setBranches(list ?? [])).catch(() => {});
  }, [isAdmin]);

  // Managers are locked to one branch — derive its name from the scoped list.
  const managerBranchName = !isAdmin ? staff.items.map(branchName).find(Boolean) ?? '' : '';
  const roleFilters = isAdmin ? ROLE_FILTERS : ROLE_FILTERS.filter(r => r.key !== 'super_admin');

  const openCreate = () => { setEditing(null); setFormOpen(true); };

  return (
    <Screen
      scroll={false}
      padded={false}
      gap={0}
      topBar={
        <TopBar
          title="Staff"
          onBack={() => router.back()}
          right={<IconButton icon="add" variant="filled" size={38} onPress={openCreate} label="Add user" />}
        />
      }
    >
      <PagedList
        tabBar={false}
        data={staff.items}
        keyExtractor={item => item._id}
        refreshing={staff.refreshing}
        onRefresh={staff.refresh}
        onEndReached={staff.loadMore}
        loadingMore={staff.loadingMore}
        hasMore={staff.hasMore}
        total={staff.total}
        noun="accounts"
        header={
          <>
            <View style={s.summary}>
              <Text style={text.caption}>
                {plural(staff.total, 'account')}{managerBranchName ? ` · ${managerBranchName}` : ''}
              </Text>
              <Text style={text.micro}>{staff.items.filter(u => !u.isActive).length} inactive shown</Text>
            </View>

            <SearchField value={search} onChangeText={setSearch} placeholder="Search by name or email" />
            <Chips options={roleFilters} value={roleFilter} onChange={setRoleFilter} />

            {isAdmin && branches.length > 0 && (
              <Chips
                options={[{ key: 'all', label: 'All branches' }, ...branches.map(b => ({ key: b._id, label: b.name }))]}
                value={branchFilter}
                onChange={setBranchFilter}
              />
            )}
          </>
        }
        empty={
          staff.loading ? (
            <SkeletonList rows={6} />
          ) : (
            <Card padded={false}>
              <EmptyState
                icon="people-outline"
                title={staff.error ? 'Couldn\u2019t load staff' : debounced ? 'No matching staff' : 'No staff yet'}
                message={
                  staff.error
                    ? staff.error
                    : debounced
                      ? `Nothing matches \u201C${debounced}\u201D.`
                      : 'Create an account for your team.'
                }
                action={
                  staff.error
                    ? { label: 'Try again', onPress: staff.reload }
                    : { label: 'Add user', onPress: openCreate }
                }
              />
            </Card>
          )
        }
        renderItem={({ item, index }) => (
          <RowCard first={index === 0} last={index === staff.items.length - 1}>
            <ListRow
              title={item.name}
              subtitle={item.email}
              leading={<Avatar name={item.name} size={42} tone={item.isActive ? 'solid' : 'sunken'} muted={!item.isActive} />}
              badge={!item.isActive ? <Badge label="Inactive" tone="outline" /> : undefined}
              meta={[
                { icon: 'shield-outline', text: ROLE_LABEL[item.role] ?? item.role },
                ...(branchName(item) ? [{ icon: 'business-outline' as const, text: branchName(item) }] : []),
              ]}
              onPress={() => { setEditing(item); setFormOpen(true); }}
              chevron
            />
          </RowCard>
        )}
      />

      <UserForm
        visible={formOpen}
        editing={editing}
        branches={branches}
        isAdmin={isAdmin}
        managerBranchName={managerBranchName}
        currentUserId={user?.userId}
        onClose={() => setFormOpen(false)}
        onSaved={staff.reload}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

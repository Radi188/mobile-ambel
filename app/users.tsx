import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar, Badge, Button, Card, Chips, EmptyState, FormModal, List, ListRow, PagedList, Press,
  RowCard, Screen, SearchField, Segmented, Sheet, SkeletonList, TextField, Toggle, TopBar,
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
  { key: 'all', label: 'All' },
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
    username: '',
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
  // Ambel accounts sign in by username, with email as an optional contact.
  const usesUsername = useAuth().backend === 'ambel';
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
        username: editing.username ?? '',
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
    if (usesUsername) {
      if (!form.username.trim()) return 'Username is required.';
      if (/\s/.test(form.username.trim())) return 'Username can’t contain spaces.';
      if (form.email.trim() && !isValidEmail(form.email.trim())) return 'Please enter a valid email.';
    } else if (!isValidEmail(form.email.trim())) {
      return 'A valid email is required.';
    }
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
          ...(usesUsername ? { username: form.username.trim().toLowerCase() } : {}),
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
          ...(usesUsername ? { username: form.username.trim().toLowerCase() } : {}),
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
      {usesUsername && (
        <TextField
          label="Username"
          value={form.username}
          onChangeText={v => set('username', v)}
          placeholder="e.g. dara"
          icon="person-outline"
          hint="Used to sign in."
        />
      )}
      <TextField
        label="Email"
        value={form.email}
        onChangeText={v => set('email', v)}
        placeholder="name@bongpos.com"
        keyboardType="email-address"
        icon="mail-outline"
        optional={usesUsername}
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
  const { user, backend } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const usesUsername = backend === 'ambel';

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
  const [branchOpen, setBranchOpen] = useState(false);
  const branchLabel = branchFilter === 'all'
    ? 'All branches'
    : branches.find(b => b._id === branchFilter)?.name ?? 'Branch';

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (member: User) => { setEditing(member); setFormOpen(true); };

  return (
    <Screen
      scroll={false}
      padded={false}
      gap={0}
      topBar={
        <TopBar
          title="Staff"
          onBack={() => router.back()}
          right={<Button label="Add" icon="add" size="sm" variant="secondary" onPress={openCreate} />}
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
        noun="people"
        header={
          <>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={usesUsername ? 'Search name or username' : 'Search name or email'}
            />
            <Segmented options={roleFilters} value={roleFilter} onChange={setRoleFilter} />

            <View style={s.summary}>
              <Text style={text.caption}>
                {staff.loading ? 'Loading…' : plural(staff.total, 'person', 'people')}
              </Text>
              {isAdmin && branches.length > 0 ? (
                <Press onPress={() => setBranchOpen(true)} scaleTo={0.96} style={s.branchBtn} accessibilityLabel="Filter by branch">
                  <Ionicons name="business-outline" size={13} color={colors.text} />
                  <Text style={[text.smallStrong, s.branchLabel]} numberOfLines={1}>{branchLabel}</Text>
                  <Ionicons name="chevron-down" size={13} color={colors.textTertiary} />
                </Press>
              ) : !!managerBranchName && (
                <Text style={text.caption} numberOfLines={1}>{managerBranchName}</Text>
              )}
            </View>
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
            <StaffRow member={item} usesUsername={usesUsername} onPress={() => openEdit(item)} />
          </RowCard>
        )}
      />

      {isAdmin && (
        <Sheet visible={branchOpen} onClose={() => setBranchOpen(false)} title="Branch">
          <List>
            {[{ _id: 'all', name: 'All branches' }, ...branches].map(branch => (
              <ListRow
                key={branch._id}
                title={branch.name}
                compact
                leading={
                  <Ionicons
                    name={branchFilter === branch._id ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={branchFilter === branch._id ? colors.text : colors.textTertiary}
                  />
                }
                onPress={() => { setBranchFilter(branch._id); setBranchOpen(false); }}
              />
            ))}
          </List>
        </Sheet>
      )}

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

// ─── Row ──────────────────────────────────────────────────────────────────────

/**
 * One person: who they are, how they sign in and where they work on the left,
 * their role on the right. Admins get the filled avatar so they stand out in a
 * long list; inactive accounts fade back.
 */
function StaffRow({ member, usesUsername, onPress }: { member: User; usesUsername: boolean; onPress: () => void }) {
  const handle = usesUsername && member.username ? `@${member.username}` : member.email;
  const where = member.role === 'super_admin' ? 'All branches' : branchName(member);
  const detail = [handle, where].filter(Boolean).join('  \u00B7  ');

  return (
    <Press onPress={onPress} scaleTo={0.99}>
      <View style={s.row}>
        <Avatar
          name={member.name}
          size={40}
          tone={member.role === 'super_admin' ? 'solid' : 'sunken'}
          muted={!member.isActive}
        />
        <View style={s.rowBody}>
          <Text style={[text.bodyStrong, !member.isActive && s.faded]} numberOfLines={1}>{member.name}</Text>
          {!!detail && <Text style={text.caption} numberOfLines={1}>{detail}</Text>}
        </View>
        {member.isActive
          ? <Text style={text.micro}>{ROLE_LABEL[member.role] ?? member.role}</Text>
          : <Badge label="Inactive" tone="outline" />}
      </View>
    </Press>
  );
}

const s = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: 32,
  },
  branchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    maxWidth: '60%',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  branchLabel: { flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    backgroundColor: colors.surface,
  },
  rowBody: { flex: 1, gap: 2 },
  faded: { color: colors.textSecondary },
});

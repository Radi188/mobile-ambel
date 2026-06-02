import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Modal, Switch, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { usersService, UserPayload } from '../services/users.service';
import { User, UserRole, Branch } from '../types/api.types';

// ─── Tokens ────────────────────────────────────────────────────────────────────

const C = {
  bg:       '#F5F4F0',
  card:     '#FFFFFF',
  dark:     '#0D0D0D',
  border:   '#EBEBEB',
  text:     '#111111',
  textSub:  '#888888',
  textDim:  '#BBBBBB',
  danger:   '#EF4444',
  dangerBg: '#FEF2F2',
};

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string }> = {
  super_admin: { label: 'Super Admin', color: '#5B21B6', bg: '#EDE9FE' },
  manager:     { label: 'Manager',     color: '#1D4ED8', bg: '#DBEAFE' },
  cashier:     { label: 'Cashier',     color: '#374151', bg: '#F3F4F6' },
};

type RoleFilter = 'all' | UserRole;

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'super_admin', label: 'Admins' },
  { key: 'manager',     label: 'Managers' },
  { key: 'cashier',     label: 'Cashiers' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function branchName(u: User): string {
  const b = u.branch;
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
    branch: '' as string,
    isActive: true,
  };
}

// ─── User Card ─────────────────────────────────────────────────────────────────

function UserCard({ user, onPress }: { user: User; onPress: () => void }) {
  const rm = ROLE_META[user.role] ?? ROLE_META.cashier;
  const branch = branchName(user);
  return (
    <TouchableOpacity style={s.uCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.avatar, !user.isActive && s.avatarOff]}>
        <Text style={s.avatarText}>{(user.name?.[0] ?? '?').toUpperCase()}</Text>
      </View>
      <View style={s.uInfo}>
        <View style={s.uTopLine}>
          <Text style={s.uName} numberOfLines={1}>{user.name}</Text>
          {!user.isActive && (
            <View style={s.inactiveBadge}><Text style={s.inactiveText}>Inactive</Text></View>
          )}
        </View>
        <Text style={s.uEmail} numberOfLines={1}>{user.email}</Text>
        <View style={s.uMeta}>
          <View style={[s.roleBadge, { backgroundColor: rm.bg }]}>
            <Text style={[s.roleText, { color: rm.color }]}>{rm.label}</Text>
          </View>
          {!!branch && (
            <View style={s.metaItem}>
              <Ionicons name="business-outline" size={12} color={C.textSub} />
              <Text style={s.metaText} numberOfLines={1}>{branch}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textDim} />
    </TouchableOpacity>
  );
}

// ─── User Form Modal ───────────────────────────────────────────────────────────

function UserModal({
  visible, editingUser, branches, isAdmin, managerBranchName, currentUserId, onClose, onSaved,
}: {
  visible: boolean;
  editingUser: User | null;
  branches: Branch[];
  isAdmin: boolean;
  managerBranchName: string;
  currentUserId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!editingUser;
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const roleOptions: UserRole[] = isAdmin
    ? ['cashier', 'manager', 'super_admin']
    : ['cashier', 'manager'];

  useEffect(() => {
    if (!visible) return;
    setError('');
    if (editingUser) {
      setForm({
        name: editingUser.name,
        email: editingUser.email,
        password: '',
        role: editingUser.role,
        branch: typeof editingUser.branch === 'object' && editingUser.branch
          ? editingUser.branch._id
          : (editingUser.branch as string) ?? '',
        isActive: editingUser.isActive,
      });
    } else {
      setForm(emptyForm());
    }
  }, [visible, editingUser]);

  const set = (key: keyof ReturnType<typeof emptyForm>, val: any) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Name is required.';
    if (!isValidEmail(form.email.trim())) return 'A valid email is required.';
    if (!isEdit && form.password.length < 6) return 'Password must be at least 6 characters.';
    if (isEdit && form.password && form.password.length < 6)
      return 'New password must be at least 6 characters.';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);
    try {
      const wantsBranch = isAdmin && form.role !== 'super_admin' && form.branch;
      if (isEdit && editingUser) {
        const dto: Partial<UserPayload> = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          isActive: form.isActive,
          ...(wantsBranch ? { branch: form.branch } : {}),
        };
        await usersService.update(editingUser._id, dto);
        if (form.password) {
          await usersService.changePassword(editingUser._id, form.password);
        }
      } else {
        const dto: UserPayload = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          isActive: form.isActive,
          ...(wantsBranch ? { branch: form.branch } : {}),
        };
        await usersService.create(dto);
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
    if (!editingUser) return;
    Alert.alert('Delete User', `Delete "${editingUser.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await usersService.remove(editingUser._id);
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

  const canDelete = isAdmin && isEdit && editingUser?._id !== currentUserId;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={m.safe}>
          <View style={m.header}>
            <TouchableOpacity onPress={onClose} style={m.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={C.text} />
            </TouchableOpacity>
            <Text style={m.title}>{isEdit ? 'Edit User' : 'New User'}</Text>
            {canDelete ? (
              <TouchableOpacity onPress={handleDelete} style={m.iconBtn} disabled={deleting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {deleting ? <ActivityIndicator size="small" color={C.danger} />
                          : <Ionicons name="trash-outline" size={20} color={C.danger} />}
              </TouchableOpacity>
            ) : <View style={{ width: 36 }} />}
          </View>

          <ScrollView contentContainerStyle={m.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Field label="Full Name" value={form.name} onChangeText={v => set('name', v)} placeholder="e.g. Sok Dara" />
            <Field
              label="Email" value={form.email} onChangeText={v => set('email', v)}
              placeholder="name@ambel.com" keyboardType="email-address"
            />
            <Field
              label={isEdit ? 'New Password' : 'Password'}
              value={form.password} onChangeText={v => set('password', v)}
              placeholder={isEdit ? 'Leave blank to keep current' : 'At least 6 characters'}
              secureTextEntry optional={isEdit}
            />

            {/* Role */}
            <View style={m.section}>
              <Text style={m.sectionLabel}>ROLE</Text>
              <View style={m.roleRow}>
                {roleOptions.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[m.roleBtn, form.role === r && m.roleBtnActive]}
                    onPress={() => set('role', r)}
                    activeOpacity={0.7}
                  >
                    <Text style={[m.roleBtnText, form.role === r && m.roleBtnTextActive]}>
                      {ROLE_META[r].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Branch — picker for admins; auto-assigned & read-only for managers */}
            {isAdmin ? (
              form.role !== 'super_admin' && (
                <View style={m.section}>
                  <Text style={m.sectionLabel}>BRANCH</Text>
                  <View style={m.pillWrap}>
                    {branches.map(b => (
                      <TouchableOpacity
                        key={b._id}
                        style={[m.pill, form.branch === b._id && m.pillActive]}
                        onPress={() => set('branch', b._id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[m.pillText, form.branch === b._id && m.pillTextActive]}>{b.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )
            ) : (
              <View style={m.section}>
                <Text style={m.sectionLabel}>BRANCH</Text>
                <View style={m.branchInfo}>
                  <Ionicons name="business-outline" size={16} color={C.textSub} />
                  <Text style={m.branchInfoText}>{managerBranchName || 'Your branch'}</Text>
                  <View style={m.branchBadge}><Text style={m.branchBadgeText}>Auto-assigned</Text></View>
                </View>
              </View>
            )}

            {/* Active */}
            <View style={m.toggleRow}>
              <View>
                <Text style={m.toggleLabel}>Active</Text>
                <Text style={m.toggleSub}>Inactive users cannot sign in</Text>
              </View>
              <Switch
                value={form.isActive}
                onValueChange={v => set('isActive', v)}
                trackColor={{ false: C.border, true: C.dark }}
                thumbColor={C.card}
              />
            </View>

            {error ? (
              <View style={m.errorWrap}>
                <Ionicons name="alert-circle-outline" size={14} color={C.danger} />
                <Text style={m.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={m.footer}>
            <TouchableOpacity style={m.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.saveBtn, saving && m.busy]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={m.saveText}>{isEdit ? 'Save Changes' : 'Create User'}</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label, value, onChangeText, placeholder, keyboardType, secureTextEntry, optional,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean; optional?: boolean;
}) {
  return (
    <View style={m.fieldWrap}>
      <Text style={m.fieldLabel}>
        {label.toUpperCase()}{optional && <Text style={m.fieldOpt}> · optional</Text>}
      </Text>
      <TextInput
        style={m.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textDim}
        keyboardType={keyboardType ?? 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        autoCorrect={false}
        selectionColor={C.dark}
      />
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers]         = useState<User[]>([]);
  const [branches, setBranches]   = useState<Branch[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [branchFilter, setBranchFilter] = useState<string | undefined>(undefined);
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<User | null>(null);

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const list = await usersService.getUsers(
        roleFilter === 'all' ? undefined : roleFilter,
        branchFilter,
        debouncedSearch || undefined,
      );
      setUsers(list ?? []);
    } catch {
      setUsers([]);
    }
  }, [roleFilter, branchFilter, debouncedSearch]);

  useEffect(() => {
    if (!isAdmin) return;
    usersService.getBranches().then(b => setBranches(b ?? [])).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (u: User) => { setEditing(u); setModalOpen(true); };

  // Managers are locked to one branch — derive its name from the (branch-scoped) list.
  const managerBranchName = !isAdmin ? users.map(branchName).find(Boolean) ?? '' : '';

  // Managers don't manage admins, so only offer the roles they can assign.
  const roleFilters = isAdmin ? ROLE_FILTERS : ROLE_FILTERS.filter(f => f.key !== 'super_admin');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Users</Text>
        <TouchableOpacity onPress={openCreate} style={s.addBtn} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textDim} />}
      >
        <Text style={s.subtitle}>
          {users.length} user{users.length === 1 ? '' : 's'}{managerBranchName ? ` · ${managerBranchName}` : ''}
        </Text>

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={17} color={C.textSub} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or email"
            placeholderTextColor={C.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            selectionColor={C.dark}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={C.textDim} />
            </TouchableOpacity>
          )}
        </View>

        {/* Role filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
          {roleFilters.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterPill, roleFilter === f.key && s.filterPillOn]}
              onPress={() => setRoleFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.filterPillText, roleFilter === f.key && s.filterPillTextOn]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Branch filter — super admin only */}
        {isAdmin && branches.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
            <TouchableOpacity
              style={[s.filterPill, !branchFilter && s.filterPillOn]}
              onPress={() => setBranchFilter(undefined)}
              activeOpacity={0.7}
            >
              <Text style={[s.filterPillText, !branchFilter && s.filterPillTextOn]}>All Branches</Text>
            </TouchableOpacity>
            {branches.map(b => (
              <TouchableOpacity
                key={b._id}
                style={[s.filterPill, branchFilter === b._id && s.filterPillOn]}
                onPress={() => setBranchFilter(b._id)}
                activeOpacity={0.7}
              >
                <Text style={[s.filterPillText, branchFilter === b._id && s.filterPillTextOn]}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <View style={s.loader}><ActivityIndicator size="large" color={C.textDim} /></View>
        ) : users.length === 0 ? (
          <View style={s.card}>
            <View style={s.empty}>
              <Ionicons name="people-outline" size={36} color={C.textDim} />
              <Text style={s.emptyText}>
                {debouncedSearch ? `No users match “${debouncedSearch}”` : 'No users found'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={s.card}>
            {users.map((u, i) => (
              <View key={u._id}>
                <UserCard user={u} onPress={() => openEdit(u)} />
                {i < users.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <UserModal
        visible={modalOpen}
        editingUser={editing}
        branches={branches}
        isAdmin={isAdmin}
        managerBranchName={managerBranchName}
        currentUserId={user?.userId}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: C.text },
  addBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' },

  scroll:   { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  subtitle: { fontSize: 13, color: C.textSub },

  loader: { paddingTop: 64, alignItems: 'center' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  pillRow:          { gap: 8, paddingBottom: 2 },
  filterPill:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  filterPillOn:     { backgroundColor: C.dark, borderColor: C.dark },
  filterPillText:   { fontSize: 13, fontWeight: '500', color: C.textSub },
  filterPillTextOn: { color: '#FFF' },

  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  divider: { height: 1, backgroundColor: '#F5F4F0', marginVertical: 2 },

  empty:     { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 14, color: C.textDim },

  uCard:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' },
  avatarOff: { backgroundColor: C.textDim },
  avatarText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  uInfo:    { flex: 1, gap: 3 },
  uTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uName:    { fontSize: 14, fontWeight: '600', color: C.text, flexShrink: 1 },
  uEmail:   { fontSize: 12, color: C.textSub },
  uMeta:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  roleText:  { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
  metaItem:  { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText:  { fontSize: 12, color: C.textSub, fontWeight: '500', flexShrink: 1 },
  inactiveBadge: { backgroundColor: C.dangerBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  inactiveText:  { fontSize: 10, fontWeight: '700', color: C.danger },
});

const m = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.card },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 16, fontWeight: '700', color: C.text },

  scroll: { padding: 20, gap: 22, paddingBottom: 8 },

  fieldWrap:  { gap: 8 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 1.5 },
  fieldOpt:   { fontWeight: '400', color: C.textDim },
  fieldInput: {
    backgroundColor: C.bg, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text,
  },

  section:      { gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 1.5 },

  roleRow: { flexDirection: 'row', gap: 8 },
  roleBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' },
  roleBtnActive: { borderColor: C.dark, backgroundColor: C.dark },
  roleBtnText: { fontSize: 13, fontWeight: '600', color: C.textSub },
  roleBtnTextActive: { color: '#FFF' },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.border },
  pillActive:     { borderColor: C.dark, backgroundColor: C.dark },
  pillText:       { fontSize: 13, fontWeight: '500', color: C.textSub },
  pillTextActive: { color: '#FFF' },

  branchInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  branchInfoText: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  branchBadge:    { backgroundColor: '#F0FDF4', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  branchBadgeText: { fontSize: 11, fontWeight: '600', color: '#16A34A' },

  toggleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  toggleSub:   { fontSize: 12, color: C.textSub, marginTop: 2 },

  errorWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.dangerBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  errorText: { fontSize: 13, color: C.danger, fontWeight: '500', flex: 1 },

  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.border },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: C.dark, alignItems: 'center' },
  busy: { opacity: 0.65 },
  saveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

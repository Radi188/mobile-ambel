import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Avatar, Badge, Card, EmptyState, FormModal, IconButton, ListRow,
  PagedList, RowCard, Screen, SearchField, SkeletonList, TextField, Toggle, TopBar,
} from '../components/ui';
import { usePaginatedList } from '../lib/usePaginatedList';
import { branchesService, BranchPayload } from '../services/branches.service';
import { Branch } from '../types/api.types';
import { plural, text } from '../constants/theme';

const PAGE_SIZE = 20;

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function emptyForm() {
  return { name: '', address: '', phone: '', email: '', isActive: true };
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function BranchForm({ visible, editing, onClose, onSaved }: {
  visible: boolean;
  editing: Branch | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    setForm(editing
      ? {
          name: editing.name,
          address: editing.address ?? '',
          phone: editing.phone ?? '',
          email: editing.email ?? '',
          isActive: editing.isActive,
        }
      : emptyForm());
  }, [visible, editing]);

  const set = (key: keyof ReturnType<typeof emptyForm>, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (form.email.trim() && !isValidEmail(form.email.trim())) { setError('Please enter a valid email.'); return; }
    setError('');
    setSaving(true);
    try {
      const dto: BranchPayload = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim().toLowerCase() || undefined,
        isActive: form.isActive,
      };
      if (isEdit && editing) await branchesService.update(editing._id, dto);
      else await branchesService.create(dto);
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
    Alert.alert('Delete branch', `Delete “${editing.name}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await branchesService.remove(editing._id);
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

  return (
    <FormModal
      visible={visible}
      title={isEdit ? 'Edit branch' : 'New branch'}
      onClose={onClose}
      onSubmit={handleSave}
      submitLabel={isEdit ? 'Save changes' : 'Create branch'}
      submitting={saving}
      onDelete={isEdit ? handleDelete : undefined}
      deleting={deleting}
      error={error}
    >
      <TextField label="Branch name" value={form.name} onChangeText={v => set('name', v)} placeholder="e.g. Central Branch" autoCapitalize="words" />
      <TextField label="Address" value={form.address} onChangeText={v => set('address', v)} placeholder="Street, city" icon="location-outline" optional />
      <TextField label="Phone" value={form.phone} onChangeText={v => set('phone', v)} placeholder="012 345 678" keyboardType="phone-pad" icon="call-outline" optional />
      <TextField label="Email" value={form.email} onChangeText={v => set('email', v)} placeholder="branch@bongpos.com" keyboardType="email-address" icon="mail-outline" optional />

      <Card>
        <Toggle
          label="Active"
          sub="Inactive branches are hidden from operations"
          value={form.isActive}
          onChange={v => set('isActive', v)}
        />
      </Card>
    </FormModal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BranchesScreen() {
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const list = usePaginatedList<Branch>(
    page => branchesService.list({ page, limit: PAGE_SIZE, search: debounced || undefined }),
    [debounced],
  );

  const openCreate = () => { setEditing(null); setFormOpen(true); };

  return (
    <Screen
      scroll={false}
      padded={false}
      gap={0}
      topBar={
        <TopBar
          title="Branches"
          onBack={() => router.back()}
          right={<IconButton icon="add" variant="filled" size={38} onPress={openCreate} label="Add branch" />}
        />
      }
    >
      <PagedList
        tabBar={false}
        data={list.items}
        keyExtractor={item => item._id}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        hasMore={list.hasMore}
        total={list.total}
        noun="locations"
        header={
          <>
            <View style={s.summary}>
              <Text style={text.caption}>{plural(list.total, 'location')}</Text>
              <Text style={text.micro}>{list.items.filter(b => !b.isActive).length} inactive shown</Text>
            </View>
            <SearchField value={search} onChangeText={setSearch} placeholder="Search by name or address" />
          </>
        }
        empty={
          list.loading ? (
            <SkeletonList rows={5} />
          ) : (
            <Card padded={false}>
              <EmptyState
                icon="business-outline"
                title={list.error ? 'Couldn\u2019t load branches' : debounced ? 'No matching branches' : 'No branches yet'}
                message={
                  list.error
                    ? list.error
                    : debounced
                      ? `Nothing matches \u201C${debounced}\u201D.`
                      : 'Add your first location to get started.'
                }
                action={
                  list.error
                    ? { label: 'Try again', onPress: list.reload }
                    : { label: 'Add branch', onPress: openCreate }
                }
              />
            </Card>
          )
        }
        renderItem={({ item, index }) => (
          <RowCard first={index === 0} last={index === list.items.length - 1}>
            <ListRow
              title={item.name}
              subtitle={item.address}
              leading={<Avatar icon="business" size={42} tone={item.isActive ? 'solid' : 'sunken'} muted={!item.isActive} />}
              badge={!item.isActive ? <Badge label="Inactive" tone="outline" /> : undefined}
              meta={[
                ...(item.phone ? [{ icon: 'call-outline' as const, text: item.phone }] : []),
                ...(item.email ? [{ icon: 'mail-outline' as const, text: item.email }] : []),
              ]}
              onPress={() => { setEditing(item); setFormOpen(true); }}
              chevron
            />
          </RowCard>
        )}
      />

      <BranchForm
        visible={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={list.reload}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

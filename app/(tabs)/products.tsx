import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge, Button, Card, Chips, EmptyState, FormModal, IconButton, MultiChips,
  PagedList, Press, Screen, ScreenHeader, SearchField, SkeletonList, TextField, Toggle,
} from '../../components/ui';
import { usePaginatedList } from '../../lib/usePaginatedList';
import { useAuth } from '../../context/AuthContext';
import { productsService, ProductPayload } from '../../services/products.service';
import { useResponsive } from '../../lib/responsive';
import { Branch, Category, Product } from '../../types/api.types';
import { colors, layout, money2, plural, radius, shadow, space, text } from '../../constants/theme';

const PAGE_SIZE = 18;

type PickedImage = { uri: string; name: string; type: string };

/**
 * Product images are absolute URIs: remote http(s) ones, or the local file://
 * URI handed back by the image picker. A server-relative path (e.g.
 * "/uploads/products/x.jpg") can't be resolved without an API host, so it falls
 * back to the icon tile — prefix it here again once the new server is wired up.
 */
function imageUri(url?: string): string | undefined {
  if (!url) return undefined;
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : undefined;
}

function catName(product: Product): string {
  return typeof product.category === 'object' ? product.category.name : '';
}

function priceRange(product: Product): string {
  if (!product.sizes?.length) return '—';
  const prices = product.sizes.map(sz => sz.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? money2(min) : `${money2(min)} – ${money2(max)}`;
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormSize = { name: string; price: string; isAvailable: boolean };

const EMPTY_SIZE: FormSize = { name: '', price: '', isAvailable: true };

function freshForm() {
  return {
    name: '',
    description: '',
    type: 'main' as 'main' | 'topping',
    category: '',
    isAvailable: true,
    sizes: [{ ...EMPTY_SIZE }] as FormSize[],
    branches: [] as string[],
  };
}

// ─── Product tile ─────────────────────────────────────────────────────────────

function ProductTile({ product, width, onPress, canEdit }: {
  product: Product;
  width: number;
  onPress: () => void;
  canEdit: boolean;
}) {
  // Fall back to the icon tile when the file 404s — otherwise a broken URL is
  // just an empty square with no hint that anything is wrong.
  const [failed, setFailed] = useState(false);
  const uri = imageUri(product.imageUrl);
  useEffect(() => { setFailed(false); }, [uri]);

  return (
    <Press onPress={onPress} disabled={!canEdit} scaleTo={0.97} style={[p.tile, { width }]}>
      <View style={[p.thumb, { height: width * 0.78 }]}>
        {uri && !failed ? (
          <Image source={{ uri }} style={p.image} onError={() => setFailed(true)} />
        ) : (
          <Ionicons
            name={product.type === 'topping' ? 'add-circle-outline' : 'cafe-outline'}
            size={26}
            color={colors.textTertiary}
          />
        )}
        {!product.isAvailable && (
          <View style={p.offOverlay}>
            <Badge label="Hidden" tone="solid" />
          </View>
        )}
      </View>

      <View style={p.body}>
        <Text style={text.h3} numberOfLines={1}>{product.name}</Text>
        <Text style={text.micro} numberOfLines={1}>{catName(product) || '—'}</Text>
        <View style={p.priceRow}>
          <Text style={text.money} numberOfLines={1}>{priceRange(product)}</Text>
          <Text style={text.micro}>{plural(product.sizes?.length ?? 0, 'size')}</Text>
        </View>
      </View>
    </Press>
  );
}

const p = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.xs,
  },
  thumb: {
    width: '100%',
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  offOverlay: { position: 'absolute', top: space.sm, left: space.sm },
  body: { padding: space.md, gap: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: 2 },
});

// ─── Size editor ──────────────────────────────────────────────────────────────

function SizeEditor({ sizes, onChange }: { sizes: FormSize[]; onChange: (next: FormSize[]) => void }) {
  const set = (idx: number, key: keyof FormSize, value: any) =>
    onChange(sizes.map((sz, i) => (i === idx ? { ...sz, [key]: value } : sz)));

  return (
    <View style={sz.wrap}>
      {sizes.map((size, idx) => (
        <View key={idx} style={sz.row}>
          <TextField
            value={size.name}
            onChangeText={v => set(idx, 'name', v)}
            placeholder="Size"
            style={sz.nameField}
          />
          <TextField
            value={size.price}
            onChangeText={v => set(idx, 'price', v)}
            placeholder="0.00"
            keyboardType="decimal-pad"
            style={sz.priceField}
          />
          <Press
            onPress={() => set(idx, 'isAvailable', !size.isAvailable)}
            scaleTo={0.9}
            style={[sz.availability, size.isAvailable && sz.availabilityOn]}
            accessibilityLabel={size.isAvailable ? 'Size available' : 'Size unavailable'}
          >
            <Ionicons
              name={size.isAvailable ? 'checkmark' : 'close'}
              size={16}
              color={size.isAvailable ? colors.textInverse : colors.textTertiary}
            />
          </Press>
          {sizes.length > 1 && (
            <IconButton icon="remove-circle-outline" onPress={() => onChange(sizes.filter((_, i) => i !== idx))} size={32} />
          )}
        </View>
      ))}
      <Button
        label="Add size"
        icon="add"
        variant="secondary"
        size="sm"
        onPress={() => onChange([...sizes, { ...EMPTY_SIZE }])}
      />
    </View>
  );
}

const sz = StyleSheet.create({
  wrap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  nameField: { flex: 2 },
  priceField: { flex: 1, minWidth: 84 },
  availability: {
    width: 44, height: 44, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  availabilityOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});

// ─── Product form ─────────────────────────────────────────────────────────────

function ProductForm({
  visible, onClose, onSaved, editing, categories, branches, isAdmin,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Product | null;
  categories: Category[];
  branches: Branch[];
  isAdmin: boolean;
}) {
  const { user } = useAuth();
  const isEdit = !!editing;
  const managerBranch = !isAdmin ? branches.find(b => b._id === user?.branchId) ?? null : null;

  const [form, setForm] = useState(freshForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [existingImage, setExistingImage] = useState<string | undefined>();
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPicked(null);
    setPreviewFailed(false);
    setExistingImage(editing?.imageUrl);
    setError('');
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? '',
        type: editing.type,
        category: typeof editing.category === 'object' ? editing.category._id : editing.category,
        isAvailable: editing.isAvailable,
        sizes: editing.sizes.map(s => ({ name: s.name, price: String(s.price), isAvailable: s.isAvailable })),
        branches: (editing.branches ?? []).map(b => (typeof b === 'object' ? b._id : b)),
      });
    } else {
      setForm(freshForm());
    }
  }, [visible, editing]);

  const set = (key: keyof ReturnType<typeof freshForm>, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required to add an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
    setPreviewFailed(false);
    setPicked({
      uri: asset.uri,
      name: asset.fileName ?? `product.${ext}`,
      type: asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    });
    setError('');
  };

  const previewUri = picked?.uri ?? imageUri(existingImage);

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Product name is required.';
    if (!form.category) return 'Please select a category.';
    if (isAdmin && form.branches.length === 0) return 'Select at least one branch.';
    if (form.sizes.length === 0) return 'Add at least one size.';
    for (const size of form.sizes) {
      if (!size.name.trim()) return 'Each size needs a name.';
      if (isNaN(parseFloat(size.price)) || parseFloat(size.price) < 0) return 'Each size needs a valid price.';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);
    try {
      const dto: Partial<ProductPayload> = {
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || undefined,
        category: form.category,
        isAvailable: form.isAvailable,
        sizes: form.sizes.map(size => ({
          name: size.name.trim(),
          price: parseFloat(size.price) || 0,
          isAvailable: size.isAvailable,
        })),
        ...(isAdmin && form.branches.length > 0 ? { branches: form.branches } : {}),
      };
      const saved = isEdit && editing
        ? await productsService.update(editing._id, dto)
        : await productsService.create(dto as ProductPayload);

      // The image is a separate multipart call once the product exists.
      if (picked && saved?._id) await productsService.uploadImage(saved._id, picked);

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
    Alert.alert('Delete product', `Delete “${editing.name}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await productsService.remove(editing._id);
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
      title={isEdit ? 'Edit product' : 'New product'}
      onClose={onClose}
      onSubmit={handleSave}
      submitLabel={isEdit ? 'Save changes' : 'Create product'}
      submitting={saving}
      onDelete={isEdit ? handleDelete : undefined}
      deleting={deleting}
      error={error}
    >
      <View style={f.section}>
        <Text style={text.overline}>Photo</Text>
        <Press onPress={pickImage} scaleTo={0.98} style={f.imagePicker}>
          {previewUri && !previewFailed ? (
            <>
              <Image source={{ uri: previewUri }} style={f.image} onError={() => setPreviewFailed(true)} />
              <View style={f.imageBadge}>
                <Ionicons name="camera" size={14} color={colors.textInverse} />
                <Text style={f.imageBadgeText}>Change</Text>
              </View>
            </>
          ) : (
            <View style={f.imageEmpty}>
              <Ionicons name="image-outline" size={24} color={colors.textTertiary} />
              <Text style={text.caption}>
                {previewUri ? 'Image unavailable — tap to replace' : 'Tap to add a photo'}
              </Text>
            </View>
          )}
        </Press>
      </View>

      <View style={f.section}>
        <Text style={text.overline}>Type</Text>
        <Chips
          options={[{ key: 'main', label: 'Main item' }, { key: 'topping', label: 'Topping' }]}
          value={form.type}
          onChange={key => set('type', key)}
          wrap
        />
      </View>

      <TextField label="Product name" value={form.name} onChangeText={v => set('name', v)} placeholder="e.g. Iced Latte" />

      <TextField
        label="Description"
        value={form.description}
        onChangeText={v => set('description', v)}
        placeholder="Short description…"
        optional
        multiline
      />

      <View style={f.section}>
        <Text style={text.overline}>Category</Text>
        {categories.length === 0 ? (
          <Text style={text.caption}>No categories available.</Text>
        ) : (
          <Chips
            options={categories.map(c => ({ key: c._id, label: c.name }))}
            value={form.category}
            onChange={key => set('category', key)}
            wrap
          />
        )}
      </View>

      <View style={f.section}>
        <Text style={text.overline}>Branches</Text>
        {isAdmin ? (
          <MultiChips
            options={branches.map(b => ({ key: b._id, label: b.name }))}
            values={form.branches}
            onToggle={id =>
              set('branches', form.branches.includes(id)
                ? form.branches.filter(b => b !== id)
                : [...form.branches, id])
            }
          />
        ) : (
          <View style={f.readonly}>
            <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
            <Text style={[text.small, f.readonlyText]}>{managerBranch?.name ?? 'Your branch'}</Text>
            <Badge label="Auto-assigned" tone="subtle" />
          </View>
        )}
      </View>

      <Card>
        <Toggle
          label="Available"
          sub="Show this product to cashiers"
          value={form.isAvailable}
          onChange={v => set('isAvailable', v)}
        />
      </Card>

      <View style={f.section}>
        <Text style={text.overline}>Sizes & prices</Text>
        <SizeEditor sizes={form.sizes} onChange={next => set('sizes', next)} />
        <Text style={text.micro}>Tap the check to toggle a single size on or off.</Text>
      </View>
    </FormModal>
  );
}

const f = StyleSheet.create({
  section: { gap: space.md },
  imagePicker: {
    height: 170,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  imageEmpty: { alignItems: 'center', gap: space.sm },
  imageBadge: {
    position: 'absolute',
    bottom: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accent,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  imageBadgeText: { color: colors.textInverse, fontSize: 12, fontWeight: '600' },
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

export default function ProductsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const canEdit = isAdmin || user?.role === 'manager';
  const { width, columns, gutter } = useResponsive();

  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Category now filters server-side: with a paged list, filtering one page in
  // memory would hide matches sitting on later pages.
  const products = usePaginatedList<Product>(
    page => productsService.getProducts({
      page,
      limit: PAGE_SIZE,
      category: selectedCat === 'all' ? undefined : selectedCat,
      search: debounced || undefined,
    }),
    [selectedCat, debounced],
  );

  const loadBase = useCallback(async () => {
    try {
      const [cats, branchList] = await Promise.all([
        productsService.getCategories(),
        productsService.getBranches(),
      ]);
      setCategories(cats ?? []);
      setBranches(branchList ?? []);
    } catch {}
  }, []);

  useEffect(() => { loadBase(); }, [loadBase]);

  const onRefresh = useCallback(() => {
    products.refresh();
    loadBase();
  }, [products, loadBase]);

  const managerBranch = !isAdmin ? branches.find(b => b._id === user?.branchId) ?? null : null;

  // Keep the selected chip even if a search empties its category, so the pill
  // you tapped can never disappear under you.
  const catOptions = [
    { key: 'all', label: 'All' },
    ...categories.map(category => ({ key: category._id, label: category.name })),
  ];
  if (selectedCat !== 'all' && !categories.some(c => c._id === selectedCat)) {
    catOptions.push({ key: selectedCat, label: 'Selected' });
  }

  const contentWidth = Math.min(width, layout.maxContentWidth) - gutter * 2;
  const tileWidth = (contentWidth - space.md * (columns - 1)) / columns;

  const openCreate = () => { setEditing(null); setFormOpen(true); };

  return (
    <Screen scroll={false} padded={false} gap={0}>
      <PagedList
        variant="grid"
        columns={columns}
        data={products.items}
        keyExtractor={product => product._id}
        refreshing={products.refreshing}
        onRefresh={onRefresh}
        onEndReached={products.loadMore}
        loadingMore={products.loadingMore}
        hasMore={products.hasMore}
        total={products.total}
        noun="items"
        header={
          <>
            <ScreenHeader
              subtitle={managerBranch ? managerBranch.name : 'Catalogue'}
              title="Menu"
              right={canEdit ? <Button label="New" icon="add" size="sm" onPress={openCreate} /> : undefined}
            />
            <SearchField value={search} onChangeText={setSearch} placeholder="Search products" />
            <Chips options={catOptions} value={selectedCat} onChange={setSelectedCat} />
            {products.items.length > 0 && (
              <View style={s.countRow}>
                <Text style={text.caption}>{plural(products.total, 'item')}</Text>
                {products.hasMore && <Text style={text.micro}>{products.items.length} loaded</Text>}
              </View>
            )}
          </>
        }
        empty={
          products.loading ? (
            <SkeletonList rows={5} />
          ) : (
            <Card padded={false}>
              <EmptyState
                icon="cafe-outline"
                title={products.error ? 'Couldn\u2019t load the menu' : debounced ? 'Nothing found' : 'No products yet'}
                message={
                  products.error
                    ? products.error
                    : debounced
                      ? `Nothing matches \u201C${debounced}\u201D.`
                      : 'Add your first item to build the menu.'
                }
                action={
                  products.error
                    ? { label: 'Try again', onPress: products.reload }
                    : canEdit
                      ? { label: 'Add product', onPress: openCreate }
                      : undefined
                }
              />
            </Card>
          )
        }
        renderItem={({ item }) => (
          <ProductTile
            product={item}
            width={tileWidth}
            canEdit={canEdit}
            onPress={() => { setEditing(item); setFormOpen(true); }}
          />
        )}
      />

      <ProductForm
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { products.reload(); loadBase(); }}
        editing={editing}
        categories={categories}
        branches={branches}
        isAdmin={isAdmin}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

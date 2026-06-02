import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { productsService, ProductPayload } from '../../services/products.service';
import { BASE_URL } from '../../lib/api';
import { Product, Category, Branch } from '../../types/api.types';

// Static uploads are served from the server root (outside the /api prefix).
const ASSET_BASE = BASE_URL.replace(/\/api\/?$/, '');

type PickedImage = { uri: string; name: string; type: string };

/** Resolve a stored imageUrl (e.g. "/uploads/products/x.jpg") to a full URL. */
function imageUri(url?: string): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//.test(url) ? url : `${ASSET_BASE}${url}`;
}

// ─── Tokens ────────────────────────────────────────────────────────────────────

const C = {
  bg:       '#F5F4F0',
  card:     '#FFFFFF',
  dark:     '#0D0D0D',
  border:   '#EBEBEB',
  input:    '#F5F4F0',
  text:     '#111111',
  textSub:  '#888888',
  textDim:  '#BBBBBB',
  danger:   '#EF4444',
  dangerBg: '#FEF2F2',
};

// ─── Types ─────────────────────────────────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function catName(product: Product): string {
  return typeof product.category === 'object' ? product.category.name : '';
}

function priceRange(product: Product): string {
  if (!product.sizes?.length) return '—';
  const prices = product.sizes.map(s => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
}

// ─── Form field ────────────────────────────────────────────────────────────────

function Field({
  label, value, onChangeText, placeholder, multiline, keyboardType, optional,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad';
  optional?: boolean;
}) {
  return (
    <View style={f.fieldWrap}>
      <Text style={f.fieldLabel}>
        {label.toUpperCase()}
        {optional && <Text style={f.fieldOpt}> · optional</Text>}
      </Text>
      <TextInput
        style={[f.fieldInput, multiline && f.fieldMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textDim}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        autoCapitalize="sentences"
        selectionColor={C.dark}
      />
    </View>
  );
}

// ─── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({
  product, onPress, canEdit,
}: {
  product: Product;
  onPress: () => void;
  canEdit: boolean;
}) {
  return (
    <TouchableOpacity
      style={s.pCard}
      onPress={onPress}
      activeOpacity={canEdit ? 0.7 : 1}
      disabled={!canEdit}
    >
      {imageUri(product.imageUrl) ? (
        <Image source={{ uri: imageUri(product.imageUrl) }} style={s.pImage} />
      ) : (
        <View style={s.pIcon}>
          <Text style={s.pEmoji}>{product.type === 'topping' ? '＋' : '☕'}</Text>
        </View>
      )}
      <View style={s.pInfo}>
        <Text style={s.pName} numberOfLines={1}>{product.name}</Text>
        <Text style={s.pCat} numberOfLines={1}>{catName(product)}</Text>
      </View>
      <View style={s.pRight}>
        <Text style={s.pPrice}>{priceRange(product)}</Text>
        <View style={[s.availBadge, !product.isAvailable && s.availBadgeOff]}>
          <Text style={[s.availText, !product.isAvailable && s.availTextOff]}>
            {product.isAvailable ? 'Active' : 'Off'}
          </Text>
        </View>
      </View>
      {canEdit && (
        <Ionicons name="chevron-forward" size={16} color={C.textDim} style={{ marginLeft: 4 }} />
      )}
    </TouchableOpacity>
  );
}

// ─── Product Form Modal ────────────────────────────────────────────────────────

function ProductModal({
  visible, onClose, onSaved, editingProduct, categories, branches, isAdmin,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingProduct: Product | null;
  categories: Category[];
  branches: Branch[];
  isAdmin: boolean;
}) {
  const { user } = useAuth();
  const isEdit = !!editingProduct;
  const managerBranch = !isAdmin
    ? branches.find(b => b._id === user?.branchId) ?? null
    : null;
  const [form, setForm] = useState(freshForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [existingImage, setExistingImage] = useState<string | undefined>(undefined);
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPickedImage(null);
    setExistingImage(editingProduct?.imageUrl);
    if (editingProduct) {
      setForm({
        name: editingProduct.name,
        description: editingProduct.description ?? '',
        type: editingProduct.type,
        category: typeof editingProduct.category === 'object'
          ? editingProduct.category._id
          : editingProduct.category,
        isAvailable: editingProduct.isAvailable,
        sizes: editingProduct.sizes.map(sz => ({
          name: sz.name,
          price: String(sz.price),
          isAvailable: sz.isAvailable,
        })),
        branches: (editingProduct.branches ?? []).map(b =>
          typeof b === 'object' ? b._id : b
        ),
      });
    } else {
      setForm(freshForm());
    }
    setError('');
  }, [visible, editingProduct]);

  const set = (key: keyof ReturnType<typeof freshForm>, val: any) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const setSize = (i: number, key: keyof FormSize, val: any) =>
    setForm(prev => {
      const sizes = [...prev.sizes];
      sizes[i] = { ...sizes[i], [key]: val };
      return { ...prev, sizes };
    });

  const addSize = () =>
    setForm(prev => ({ ...prev, sizes: [...prev.sizes, { ...EMPTY_SIZE }] }));

  const removeSize = (i: number) =>
    setForm(prev => ({ ...prev, sizes: prev.sizes.filter((_, idx) => idx !== i) }));

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
    setPickedImage({
      uri: asset.uri,
      name: asset.fileName ?? `product.${ext}`,
      type: asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    });
    setError('');
  };

  const previewUri = pickedImage?.uri ?? imageUri(existingImage);

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Product name is required.';
    if (!form.category) return 'Please select a category.';
    if (isAdmin && form.branches.length === 0) return 'Select at least one branch.';
    if (form.sizes.length === 0) return 'Add at least one size.';
    for (const sz of form.sizes) {
      if (!sz.name.trim()) return 'Each size must have a name.';
      if (isNaN(parseFloat(sz.price)) || parseFloat(sz.price) < 0)
        return 'Each size must have a valid price.';
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
        sizes: form.sizes.map(sz => ({
          name: sz.name.trim(),
          price: parseFloat(sz.price) || 0,
          isAvailable: sz.isAvailable,
        })),
        ...(isAdmin && form.branches.length > 0 ? { branches: form.branches } : {}),
      };
      const saved = isEdit && editingProduct
        ? await productsService.update(editingProduct._id, dto)
        : await productsService.create(dto as ProductPayload);

      // Upload the image separately (multipart) once the product exists.
      if (pickedImage && saved?._id) {
        await productsService.uploadImage(saved._id, pickedImage);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingProduct) return;
    Alert.alert(
      'Delete Product',
      `Delete "${editingProduct.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await productsService.remove(editingProduct._id);
              onSaved();
              onClose();
            } catch (e: any) {
              setError(e.message ?? 'Failed to delete.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={m.safe}>
          {/* Header */}
          <View style={m.header}>
            <TouchableOpacity onPress={onClose} style={m.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={C.text} />
            </TouchableOpacity>
            <Text style={m.title}>{isEdit ? 'Edit Product' : 'New Product'}</Text>
            {isEdit ? (
              <TouchableOpacity
                onPress={handleDelete}
                style={m.deleteBtn}
                disabled={deleting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {deleting
                  ? <ActivityIndicator size="small" color={C.danger} />
                  : <Ionicons name="trash-outline" size={20} color={C.danger} />
                }
              </TouchableOpacity>
            ) : (
              <View style={{ width: 36 }} />
            )}
          </View>

          <ScrollView
            contentContainerStyle={m.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Image */}
            <View style={m.section}>
              <Text style={m.sectionLabel}>IMAGE</Text>
              <TouchableOpacity style={m.imagePicker} onPress={pickImage} activeOpacity={0.8}>
                {previewUri ? (
                  <>
                    <Image source={{ uri: previewUri }} style={m.imagePreview} />
                    <View style={m.imageOverlay}>
                      <Ionicons name="camera" size={18} color="#FFF" />
                      <Text style={m.imageOverlayText}>Change</Text>
                    </View>
                  </>
                ) : (
                  <View style={m.imageEmpty}>
                    <Ionicons name="image-outline" size={26} color={C.textDim} />
                    <Text style={m.imageEmptyText}>Tap to add a photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Type */}
            <View style={m.section}>
              <Text style={m.sectionLabel}>TYPE</Text>
              <View style={m.typeRow}>
                {(['main', 'topping'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[m.typeBtn, form.type === t && m.typeBtnActive]}
                    onPress={() => set('type', t)}
                    activeOpacity={0.7}
                  >
                    <Text style={[m.typeBtnText, form.type === t && m.typeBtnTextActive]}>
                      {t === 'main' ? '☕  Main' : '＋  Topping'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Name */}
            <View style={m.section}>
              <Field label="Product Name" value={form.name} onChangeText={v => set('name', v)} placeholder="e.g. Espresso" />
            </View>

            {/* Description */}
            <View style={m.section}>
              <Field
                label="Description" value={form.description}
                onChangeText={v => set('description', v)}
                placeholder="Short description…"
                multiline optional
              />
            </View>

            {/* Category */}
            <View style={m.section}>
              <Text style={m.sectionLabel}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={m.pillRow}>
                {categories.map(c => (
                  <TouchableOpacity
                    key={c._id}
                    style={[m.pill, form.category === c._id && m.pillActive]}
                    onPress={() => set('category', c._id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[m.pillText, form.category === c._id && m.pillTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Branch — picker for admin, read-only for manager */}
            <View style={m.section}>
              <Text style={m.sectionLabel}>BRANCH</Text>
              {isAdmin ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={m.pillRow}>
                  {branches.map(b => {
                    const selected = form.branches.includes(b._id);
                    return (
                      <TouchableOpacity
                        key={b._id}
                        style={[m.pill, selected && m.pillActive]}
                        onPress={() =>
                          set('branches', selected
                            ? form.branches.filter(id => id !== b._id)
                            : [...form.branches, b._id]
                          )
                        }
                        activeOpacity={0.7}
                      >
                        <Text style={[m.pillText, selected && m.pillTextActive]}>{b.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={m.branchInfo}>
                  <Ionicons name="business-outline" size={16} color={C.textSub} />
                  <Text style={m.branchInfoText}>
                    {managerBranch?.name ?? 'Your branch'}
                  </Text>
                  <View style={m.branchBadge}>
                    <Text style={m.branchBadgeText}>Auto-assigned</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Available */}
            <View style={m.section}>
              <View style={m.toggleRow}>
                <View>
                  <Text style={m.toggleLabel}>Available</Text>
                  <Text style={m.toggleSub}>Show this product to cashiers</Text>
                </View>
                <Switch
                  value={form.isAvailable}
                  onValueChange={v => set('isAvailable', v)}
                  trackColor={{ false: C.border, true: C.dark }}
                  thumbColor={C.card}
                />
              </View>
            </View>

            {/* Sizes */}
            <View style={m.section}>
              <View style={m.sizeHeader}>
                <Text style={m.sectionLabel}>SIZES & PRICES</Text>
                <TouchableOpacity onPress={addSize} style={m.addSizeBtn} activeOpacity={0.7}>
                  <Ionicons name="add" size={14} color={C.dark} />
                  <Text style={m.addSizeText}>Add Size</Text>
                </TouchableOpacity>
              </View>
              {form.sizes.map((sz, i) => (
                <View key={i} style={m.sizeRow}>
                  <TextInput
                    style={[m.sizeInput, { flex: 2 }]}
                    value={sz.name}
                    onChangeText={v => setSize(i, 'name', v)}
                    placeholder="Size name"
                    placeholderTextColor={C.textDim}
                    selectionColor={C.dark}
                  />
                  <TextInput
                    style={[m.sizeInput, { flex: 1 }]}
                    value={sz.price}
                    onChangeText={v => setSize(i, 'price', v)}
                    placeholder="0.00"
                    placeholderTextColor={C.textDim}
                    keyboardType="decimal-pad"
                    selectionColor={C.dark}
                  />
                  <TouchableOpacity
                    onPress={() => setSize(i, 'isAvailable', !sz.isAvailable)}
                    style={[m.sizeAvail, sz.isAvailable && m.sizeAvailOn]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={sz.isAvailable ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={sz.isAvailable ? C.dark : C.textDim}
                    />
                  </TouchableOpacity>
                  {form.sizes.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeSize(i)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle-outline" size={20} color={C.textDim} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <Text style={m.sizeHint}>Tap ✓ to toggle size availability</Text>
            </View>

            {/* Error */}
            {error ? (
              <View style={m.errorWrap}>
                <Ionicons name="alert-circle-outline" size={14} color={C.danger} />
                <Text style={m.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={m.footer}>
            <TouchableOpacity style={m.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.saveBtn, saving && m.saveBtnBusy]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={m.saveText}>{isEdit ? 'Save Changes' : 'Create Product'}</Text>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const canEdit = isAdmin || user?.role === 'manager';

  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [products, setProducts]       = useState<Product[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | undefined>(undefined);
  const [branches, setBranches]           = useState<Branch[]>([]);
  const [modalVisible, setModalVisible]   = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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

  const loadProducts = useCallback(async () => {
    try {
      const list = await productsService.getProducts(selectedCat);
      setProducts(list ?? []);
    } catch {}
  }, [selectedCat]);

  useEffect(() => {
    Promise.all([loadBase(), loadProducts()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProducts(); }, [selectedCat]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBase(), loadProducts()]);
    setRefreshing(false);
  }, [loadBase, loadProducts]);

  const managerBranch = !isAdmin
    ? branches.find(b => b._id === user?.branchId) ?? null
    : null;

  const openCreate = () => {
    setEditingProduct(null);
    setModalVisible(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textDim} />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Products</Text>
            <Text style={s.subtitle}>
              {products.length} items{managerBranch ? ` · ${managerBranch.name}` : ''}
            </Text>
          </View>
          {canEdit && (
            <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.85}>
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={s.addBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={s.loader}>
            <ActivityIndicator size="large" color={C.textDim} />
          </View>
        ) : (
          <>
            {/* Category filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.pillRow}
            >
              <TouchableOpacity
                style={[s.pill, !selectedCat && s.pillOn]}
                onPress={() => setSelectedCat(undefined)}
                activeOpacity={0.7}
              >
                <Text style={[s.pillText, !selectedCat && s.pillTextOn]}>All</Text>
              </TouchableOpacity>
              {categories.map(c => (
                <TouchableOpacity
                  key={c._id}
                  style={[s.pill, selectedCat === c._id && s.pillOn]}
                  onPress={() => setSelectedCat(c._id)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.pillText, selectedCat === c._id && s.pillTextOn]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Product list */}
            <View style={s.card}>
              {products.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="cube-outline" size={36} color={C.textDim} />
                  <Text style={s.emptyText}>No products found</Text>
                  {canEdit && (
                    <TouchableOpacity onPress={openCreate} activeOpacity={0.7}>
                      <Text style={s.emptyAction}>+ Add your first product</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                products.map((p, i) => (
                  <View key={p._id}>
                    <ProductCard product={p} onPress={() => openEdit(p)} canEdit={canEdit} />
                    {i < products.length - 1 && <View style={s.divider} />}
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <ProductModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={() => { loadProducts(); loadBase(); }}
        editingProduct={editingProduct}
        categories={categories}
        branches={branches}
        isAdmin={isAdmin}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 48, gap: 14 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title:  { fontSize: 24, fontWeight: '700', color: C.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: C.textSub, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.dark, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  loader: { paddingTop: 64, alignItems: 'center' },

  pillRow: { gap: 8, paddingBottom: 2 },
  pill:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  pillOn:   { backgroundColor: C.dark, borderColor: C.dark },
  pillText: { fontSize: 13, fontWeight: '500', color: C.textSub },
  pillTextOn: { color: '#FFF' },

  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 12 },
  divider:   { height: 1, backgroundColor: '#F5F4F0', marginVertical: 2 },

  empty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText:   { fontSize: 14, color: C.textDim },
  emptyAction: { fontSize: 14, color: C.dark, fontWeight: '600' },

  // Product card
  pCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  pIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  pImage: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.bg },
  pEmoji: { fontSize: 20 },
  pInfo: { flex: 1, gap: 2 },
  pName: { fontSize: 14, fontWeight: '600', color: C.text },
  pCat:  { fontSize: 12, color: C.textSub },
  pRight: { alignItems: 'flex-end', gap: 5 },
  pPrice: { fontSize: 13, fontWeight: '700', color: C.text },
  availBadge:    { backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  availBadgeOff: { backgroundColor: '#FEF2F2' },
  availText:     { fontSize: 11, fontWeight: '600', color: '#16A34A' },
  availTextOff:  { color: C.danger },

});

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.card },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  closeBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 16, fontWeight: '700', color: C.text },

  scroll: { padding: 20, gap: 24, paddingBottom: 8 },

  section:      { gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 1.5 },

  imagePicker: {
    height: 160, borderRadius: 14, overflow: 'hidden',
    backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  imagePreview: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  imageOverlay: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(13,13,13,0.78)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  imageOverlayText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  imageEmpty:     { alignItems: 'center', gap: 6 },
  imageEmptyText: { fontSize: 13, color: C.textSub, fontWeight: '500' },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center',
  },
  typeBtnActive:    { borderColor: C.dark, backgroundColor: C.dark },
  typeBtnText:      { fontSize: 14, fontWeight: '600', color: C.textSub },
  typeBtnTextActive: { color: '#FFF' },

  pillRow: { gap: 8, paddingBottom: 4 },
  pill:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.border },
  pillActive:   { borderColor: C.dark, backgroundColor: C.dark },
  pillText:     { fontSize: 13, fontWeight: '500', color: C.textSub },
  pillTextActive: { color: '#FFF' },

  branchInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  branchInfoText: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  branchBadge: {
    backgroundColor: '#F0FDF4', borderRadius: 5,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  branchBadgeText: { fontSize: 11, fontWeight: '600', color: '#16A34A' },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  toggleSub:   { fontSize: 12, color: C.textSub, marginTop: 2 },

  sizeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addSizeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: C.bg },
  addSizeText: { fontSize: 12, fontWeight: '600', color: C.dark },

  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sizeInput: {
    backgroundColor: C.bg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: C.text,
  },
  sizeAvail:   { width: 36, height: 36, borderRadius: 8, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  sizeAvailOn: { backgroundColor: '#F0FDF4' },
  sizeHint:    { fontSize: 11, color: C.textDim, marginTop: 4 },

  errorWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.dangerBg, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  errorText: { fontSize: 13, color: C.danger, fontWeight: '500', flex: 1 },

  footer: {
    flexDirection: 'row', gap: 10,
    padding: 20, borderTopWidth: 1, borderTopColor: C.border,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  saveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.dark, alignItems: 'center',
  },
  saveBtnBusy: { opacity: 0.65 },
  saveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

// ─── Field Styles ─────────────────────────────────────────────────────────────

const f = StyleSheet.create({
  fieldWrap: { gap: 8 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 1.5 },
  fieldOpt:   { fontWeight: '400', color: C.textDim },
  fieldInput: {
    backgroundColor: C.bg, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.text,
  },
  fieldMultiline: { minHeight: 80, textAlignVertical: 'top' },
});

import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { ordersService } from '../../services/orders.service';
import { Order, OrderItem, OrderStatus, Branch } from '../../types/api.types';

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

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completed', color: '#065F46', bg: '#D1FAE5' },
  cancelled: { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2' },
};

type StatusFilter = 'all' | OrderStatus;

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function money(v: unknown): string {
  const n = Number(v);
  return `$${(isFinite(n) ? n : 0).toFixed(2)}`;
}

function branchName(order: Order): string {
  const b = order.branch;
  return typeof b === 'object' && b ? b.name : '';
}

function productName(item: OrderItem): string {
  return typeof item.product === 'object' && item.product ? item.product.name : 'Item';
}

function itemCount(order: Order): number {
  return (order.items ?? []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
}

function lineTotal(item: OrderItem): number {
  if (typeof item.itemTotal === 'number') return item.itemTotal;
  const toppings = (item.toppings ?? []).reduce((s, t) => s + (Number(t.price) || 0), 0);
  return (Number(item.unitPrice) + toppings) * Number(item.quantity);
}

function dateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusChip({ status }: { status: string }) {
  const st = STATUS_MAP[status] ?? STATUS_MAP.completed;
  return (
    <View style={[s.chip, { backgroundColor: st.bg }]}>
      <Text style={[s.chipText, { color: st.color }]}>{st.label}</Text>
    </View>
  );
}

// ─── Order Card ──────────────────────────────────────────────────────────────────

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const branch = branchName(order);
  const count = itemCount(order);
  return (
    <TouchableOpacity style={s.oCard} onPress={onPress} activeOpacity={0.7}>
      <View style={s.oLeft}>
        <View style={s.oTopLine}>
          <Text style={s.oCustomer} numberOfLines={1}>{order.customerName || 'Walk-in'}</Text>
          <StatusChip status={order.status} />
        </View>
        {!!order.orderNumber && <Text style={s.oNumber}>#{order.orderNumber}</Text>}
        <View style={s.oMeta}>
          {!!branch && <MetaItem icon="business-outline" text={branch} />}
          {!!order.cashierName && <MetaItem icon="person-outline" text={order.cashierName} />}
        </View>
        <View style={s.oMeta}>
          <MetaItem icon="cube-outline" text={`${count} item${count === 1 ? '' : 's'}`} />
          <MetaItem icon="time-outline" text={dateTime(order.createdAt)} />
        </View>
      </View>
      <View style={s.oRight}>
        <Text style={s.oTotal}>{money(order.total)}</Text>
        <Ionicons name="chevron-forward" size={16} color={C.textDim} />
      </View>
    </TouchableOpacity>
  );
}

function MetaItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.metaItem}>
      <Ionicons name={icon} size={12} color={C.textSub} />
      <Text style={s.metaText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

// ─── Order Detail Modal ────────────────────────────────────────────────────────

function OrderDetailModal({
  order, visible, loading, onClose, onChanged, canEdit,
}: {
  order: Order | null;
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onChanged: () => void;
  canEdit: boolean;
}) {
  const [busy, setBusy] = useState(false);

  if (!order) return null;

  const isCancelled = order.status === 'cancelled';

  const changeStatus = (status: OrderStatus, confirmTitle: string, confirmMsg: string) => {
    Alert.alert(confirmTitle, confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: status === 'cancelled' ? 'destructive' : 'default',
        onPress: async () => {
          setBusy(true);
          try {
            await ordersService.updateStatus(order._id, status);
            onChanged();
            onClose();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not update order.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Order',
      `Permanently delete order ${order.orderNumber ? `#${order.orderNumber}` : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await ordersService.remove(order._id);
              onChanged();
              onClose();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not delete order.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={m.safe}>
        {/* Header */}
        <View style={m.header}>
          <TouchableOpacity onPress={onClose} style={m.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={m.title}>Order Details</Text>
          {canEdit ? (
            <TouchableOpacity onPress={handleDelete} style={m.iconBtn} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={20} color={C.danger} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={m.scroll} showsVerticalScrollIndicator={false}>
          {/* Summary */}
          <View style={m.summary}>
            <View style={m.summaryTop}>
              <View style={{ flex: 1 }}>
                <Text style={m.summaryCustomer}>{order.customerName || 'Walk-in'}</Text>
                {!!order.orderNumber && <Text style={m.summaryNumber}>#{order.orderNumber}</Text>}
              </View>
              <StatusChip status={order.status} />
            </View>
            <View style={m.summaryRows}>
              {!!branchName(order) && <InfoRow icon="business-outline" label="Branch" value={branchName(order)} />}
              {!!order.cashierName && <InfoRow icon="person-outline" label="Cashier" value={order.cashierName} />}
              <InfoRow icon="time-outline" label="Placed" value={dateTime(order.createdAt)} />
            </View>
          </View>

          {/* Items */}
          <Text style={m.sectionLabel}>ITEMS ({itemCount(order)})</Text>
          <View style={m.itemsCard}>
            {loading && (
              <View style={m.itemsLoader}>
                <ActivityIndicator size="small" color={C.textDim} />
              </View>
            )}
            {(order.items ?? []).map((item, i, arr) => (
              <View key={i} style={[m.itemRow, i < arr.length - 1 && m.itemRowBorder]}>
                <View style={m.itemQty}>
                  <Text style={m.itemQtyText}>{item.quantity}×</Text>
                </View>
                <View style={m.itemInfo}>
                  <Text style={m.itemName} numberOfLines={1}>{productName(item)}</Text>
                  <Text style={m.itemSub}>
                    {item.size}{item.unitPrice ? ` · ${money(item.unitPrice)}` : ''}
                  </Text>
                  {(item.toppings ?? []).length > 0 && (
                    <Text style={m.itemToppings} numberOfLines={2}>
                      + {(item.toppings ?? []).map(t => t.name).join(', ')}
                    </Text>
                  )}
                </View>
                <Text style={m.itemTotal}>{money(lineTotal(item))}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={m.totalsCard}>
            <TotalRow label="Subtotal" value={money(order.subtotal)} />
            {Number(order.discountAmount) > 0 && (
              <TotalRow label="Discount" value={`– ${money(order.discountAmount)}`} />
            )}
            <View style={m.totalsDivider} />
            <TotalRow label="Total" value={money(order.total)} strong />
          </View>

          {!!order.note && (
            <View style={m.noteCard}>
              <Ionicons name="document-text-outline" size={15} color={C.textSub} />
              <Text style={m.noteText}>{order.note}</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer actions */}
        {canEdit && (
          <View style={m.footer}>
            {isCancelled ? (
              <TouchableOpacity
                style={[m.actionBtn, m.actionPrimary, busy && m.busy]}
                onPress={() => changeStatus('completed', 'Restore Order', 'Mark this order as completed again?')}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={m.actionPrimaryText}>Mark Completed</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[m.actionBtn, m.actionDanger, busy && m.busy]}
                onPress={() => changeStatus('cancelled', 'Cancel Order', 'Cancel this order? It will be marked as cancelled.')}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color={C.danger} size="small" />
                      : <Text style={m.actionDangerText}>Cancel Order</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={m.infoRow}>
      <Ionicons name={icon} size={15} color={C.textSub} />
      <Text style={m.infoLabel}>{label}</Text>
      <Text style={m.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={m.totalRow}>
      <Text style={[m.totalLabel, strong && m.totalLabelStrong]}>{label}</Text>
      <Text style={[m.totalValue, strong && m.totalValueStrong]}>{value}</Text>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const canEdit = isAdmin || user?.role === 'manager';

  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders]       = useState<Order[]>([]);
  const [filter, setFilter]       = useState<StatusFilter>('all');
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [branches, setBranches]   = useState<Branch[]>([]);
  const [branchId, setBranchId]   = useState<string | undefined>(undefined);
  const [selected, setSelected]   = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Branch filter is admin-only (managers/cashiers are locked to their branch).
  useEffect(() => {
    if (!isAdmin) return;
    ordersService.getBranches().then(b => setBranches(b ?? [])).catch(() => {});
  }, [isAdmin]);

  const load = useCallback(async () => {
    try {
      const list = await ordersService.getOrders({
        status: filter === 'all' ? undefined : filter,
        search: debouncedSearch || undefined,
        branch: branchId,
      });
      setOrders(list ?? []);
    } catch {
      setOrders([]);
    }
  }, [filter, debouncedSearch, branchId]);

  // Reload whenever any filter (status, search, branch) changes.
  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openDetail = async (order: Order) => {
    // Show the summary immediately from the list payload, then fetch the fully
    // populated order (with product/topping names) for the items breakdown.
    setSelected(order);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const full = await ordersService.getOrder(order._id);
      setSelected(full);
    } catch {
      // keep the lightweight version on failure
    } finally {
      setDetailLoading(false);
    }
  };

  const total = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textDim} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Sale Orders</Text>
            <Text style={s.subtitle}>
              {orders.length} order{orders.length === 1 ? '' : 's'} · {money(total)}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={17} color={C.textSub} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search order #, customer or cashier"
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

        {/* Status filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.pill, filter === f.key && s.pillOn]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.pillText, filter === f.key && s.pillTextOn]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Branch filter — admin only */}
        {isAdmin && branches.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
            <TouchableOpacity
              style={[s.pill, !branchId && s.pillOn]}
              onPress={() => setBranchId(undefined)}
              activeOpacity={0.7}
            >
              <Text style={[s.pillText, !branchId && s.pillTextOn]}>All Branches</Text>
            </TouchableOpacity>
            {branches.map(b => (
              <TouchableOpacity
                key={b._id}
                style={[s.pill, branchId === b._id && s.pillOn]}
                onPress={() => setBranchId(b._id)}
                activeOpacity={0.7}
              >
                <Text style={[s.pillText, branchId === b._id && s.pillTextOn]}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <View style={s.loader}><ActivityIndicator size="large" color={C.textDim} /></View>
        ) : orders.length === 0 ? (
          <View style={s.card}>
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={36} color={C.textDim} />
              <Text style={s.emptyText}>
                {debouncedSearch ? `No orders match “${debouncedSearch}”` : 'No orders found'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={s.card}>
            {orders.map((o, i) => (
              <View key={o._id}>
                <OrderCard order={o} onPress={() => openDetail(o)} />
                {i < orders.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <OrderDetailModal
        order={selected}
        visible={detailOpen}
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
        onChanged={() => load()}
        canEdit={canEdit}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 48, gap: 14 },

  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title:    { fontSize: 24, fontWeight: '700', color: C.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: C.textSub, marginTop: 2 },

  loader: { paddingTop: 64, alignItems: 'center' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  pillRow:    { gap: 8, paddingBottom: 2 },
  pill:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  pillOn:     { backgroundColor: C.dark, borderColor: C.dark },
  pillText:   { fontSize: 13, fontWeight: '500', color: C.textSub },
  pillTextOn: { color: '#FFF' },

  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  divider: { height: 1, backgroundColor: '#F5F4F0', marginVertical: 2 },

  empty:     { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 14, color: C.textDim },

  // Order card
  oCard:     { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, gap: 10 },
  oLeft:     { flex: 1, gap: 6 },
  oTopLine:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oCustomer: { fontSize: 14, fontWeight: '600', color: C.text, flexShrink: 1 },
  oNumber:   { fontSize: 11, color: C.textDim, fontWeight: '600', letterSpacing: 0.3 },
  oMeta:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  oRight:    { alignItems: 'flex-end', gap: 6, justifyContent: 'space-between' },
  oTotal:    { fontSize: 15, fontWeight: '700', color: C.text },

  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '60%' },
  metaText: { fontSize: 12, color: C.textSub, fontWeight: '500', flexShrink: 1 },

  chip:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  chipText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 16, fontWeight: '700', color: C.text },

  scroll: { padding: 20, gap: 16, paddingBottom: 24 },

  summary: {
    backgroundColor: C.card, borderRadius: 18, padding: 18, gap: 16,
    borderWidth: 1, borderColor: C.border,
  },
  summaryTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  summaryCustomer: { fontSize: 18, fontWeight: '700', color: C.text },
  summaryNumber:   { fontSize: 12, color: C.textSub, marginTop: 2, fontWeight: '600' },
  summaryRows:     { gap: 10 },

  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 13, color: C.textSub, width: 64 },
  infoValue: { fontSize: 13, color: C.text, fontWeight: '600', flex: 1 },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 1.5, marginTop: 4 },

  itemsCard: {
    backgroundColor: C.card, borderRadius: 18, paddingHorizontal: 18,
    borderWidth: 1, borderColor: C.border,
  },
  itemsLoader:   { paddingVertical: 18, alignItems: 'center' },
  itemRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F4F0' },
  itemQty:       { minWidth: 34, height: 28, borderRadius: 8, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  itemQtyText:   { fontSize: 13, fontWeight: '700', color: C.text },
  itemInfo:      { flex: 1, gap: 2 },
  itemName:      { fontSize: 14, fontWeight: '600', color: C.text },
  itemSub:       { fontSize: 12, color: C.textSub },
  itemToppings:  { fontSize: 12, color: C.textDim, marginTop: 1 },
  itemTotal:     { fontSize: 14, fontWeight: '700', color: C.text },

  totalsCard: {
    backgroundColor: C.card, borderRadius: 18, padding: 18, gap: 12,
    borderWidth: 1, borderColor: C.border,
  },
  totalRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:       { fontSize: 14, color: C.textSub },
  totalLabelStrong: { fontSize: 15, color: C.text, fontWeight: '700' },
  totalValue:       { fontSize: 14, color: C.text, fontWeight: '600' },
  totalValueStrong: { fontSize: 18, color: C.text, fontWeight: '800', letterSpacing: -0.5 },
  totalsDivider:    { height: 1, backgroundColor: C.border },

  noteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: C.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  noteText: { fontSize: 13, color: C.text, flex: 1, lineHeight: 19 },

  footer: {
    padding: 20, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card,
  },
  actionBtn:        { paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  actionPrimary:    { backgroundColor: C.dark },
  actionPrimaryText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  actionDanger:     { backgroundColor: C.dangerBg, borderWidth: 1, borderColor: '#FECACA' },
  actionDangerText: { fontSize: 15, fontWeight: '700', color: C.danger },
  busy:             { opacity: 0.6 },
});

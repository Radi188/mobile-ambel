import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar, Badge, Button, Card, Chips, DataRow, Divider, EmptyState, IconButton,
  ListRow, PagedList, RowCard, Screen, ScreenHeader, SearchField, Skeleton, SkeletonList,
} from '../../components/ui';
import { usePaginatedList } from '../../lib/usePaginatedList';
import { useAuth } from '../../context/AuthContext';
import { ordersService } from '../../services/orders.service';
import { reportsService } from '../../services/reports.service';
import { Order, OrderItem, OrderStatus, OrderSummaryReport } from '../../types/api.types';
import {
  colors, count, money, money2, plural, radius, space, text, toNumber,
} from '../../constants/theme';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | OrderStatus;

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function branchName(order: Order): string {
  const b = order.branch;
  return typeof b === 'object' && b ? b.name : '';
}

function productName(item: OrderItem): string {
  return typeof item.product === 'object' && item.product ? item.product.name : 'Item';
}

function itemCount(order: Order): number {
  return (order.items ?? []).reduce((sum, it) => sum + toNumber(it.quantity), 0);
}

function lineTotal(item: OrderItem): number {
  if (typeof item.itemTotal === 'number') return item.itemTotal;
  const toppings = (item.toppings ?? []).reduce((sum, t) => sum + toNumber(t.price), 0);
  return (toNumber(item.unitPrice) + toppings) * toNumber(item.quantity);
}

function dateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const cancelled = status === 'cancelled';
  return <Badge label={cancelled ? 'Cancelled' : 'Completed'} tone={cancelled ? 'outline' : 'solid'} />;
}

// ─── Totals ───────────────────────────────────────────────────────────────────

type Totals = {
  sales: number;
  orders: number;
  cancelled: number;
  avgOrder: number;
  avgItems: number;
  allTime: boolean;
};

/**
 * All-time totals come from /reports/orders, which aggregates in Mongo over the
 * whole collection — the list itself is capped at 50 rows, so summing it would
 * silently under-report.
 */
function totalsFromReport(r: OrderSummaryReport): Totals {
  const cancelled = r.byStatus.find(b => b.status === 'cancelled');
  const cancelledCount = cancelled?.count ?? 0;
  // overview.totalValue counts every order regardless of status; strip the
  // cancelled ones so the headline is money actually taken.
  const sales = (r.overview.totalValue ?? 0) - (cancelled?.totalValue ?? 0);
  const netOrders = (r.overview.totalOrders ?? 0) - cancelledCount;

  return {
    sales,
    orders: netOrders,
    cancelled: cancelledCount,
    avgOrder: netOrders > 0 ? sales / netOrders : 0,
    avgItems: r.overview.avgItemsPerOrder ?? 0,
    allTime: true,
  };
}

/** Fallback for cashiers, who aren't allowed to call the reports endpoint. */
function totalsFromList(orders: Order[]): Totals {
  let sales = 0;
  let net = 0;
  let cancelled = 0;
  let items = 0;

  for (const o of orders) {
    if (o.status === 'cancelled') { cancelled += 1; continue; }
    net += 1;
    sales += toNumber(o.total);
    items += itemCount(o);
  }

  return {
    sales,
    orders: net,
    cancelled,
    avgOrder: net > 0 ? sales / net : 0,
    avgItems: net > 0 ? items / net : 0,
    allTime: false,
  };
}

function TotalsCard({ totals, loading }: { totals: Totals | null; loading: boolean }) {
  return (
    <Card tone="inverse" style={t.card}>
      <Text style={[text.overline, { color: colors.textInverseDim }]}>
        {totals?.allTime === false ? 'Sales · listed orders' : 'Total sales · all time'}
      </Text>

      {loading || !totals ? (
        <View style={t.loading}><Skeleton width="58%" height={38} radius={12} onDark /></View>
      ) : (
        <Text style={[text.display, { color: colors.textInverse }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {money(totals.sales)}
        </Text>
      )}

      <Text style={[text.caption, { color: colors.textInverseSub }]}>
        {plural(totals?.orders ?? 0, 'order')}
        {totals?.cancelled ? ` · ${totals.cancelled} cancelled` : ''}
      </Text>

      <View style={t.chips}>
        {[
          { label: 'Avg order', value: totals ? money2(totals.avgOrder) : '—' },
          { label: 'Avg items', value: totals ? totals.avgItems.toFixed(1) : '—' },
          { label: 'Cancelled', value: totals ? count(totals.cancelled) : '—' },
        ].map(chip => (
          <View key={chip.label} style={t.chip}>
            <Text style={[text.micro, { color: colors.textInverseDim }]}>{chip.label}</Text>
            <Text style={[text.smallStrong, { color: colors.textInverse }]} numberOfLines={1}>{chip.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const t = StyleSheet.create({
  card: { gap: space.xs, padding: space.xxl },
  loading: { height: 44, justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  chip: {
    flex: 1,
    backgroundColor: colors.fillInverse,
    borderRadius: radius.sm,
    paddingVertical: space.md - 2,
    paddingHorizontal: space.md,
    gap: 3,
  },
});

// ─── Detail ───────────────────────────────────────────────────────────────────

function OrderDetail({
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

  const cancelled = order.status === 'cancelled';

  /** Runs a status action, keeping the confirm → busy → close flow in one place. */
  const runAction = (
    { title, message, confirm, destructive, action, failure }: {
      title: string;
      message: string;
      confirm: string;
      destructive?: boolean;
      action: () => Promise<unknown>;
      failure: string;
    },
  ) => {
    Alert.alert(title, message, [
      { text: 'Back', style: 'cancel' },
      {
        text: confirm,
        style: destructive ? 'destructive' : 'default',
        onPress: async () => {
          setBusy(true);
          try {
            await action();
            onChanged();
            onClose();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? failure);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleCancel = () =>
    runAction({
      title: 'Cancel order',
      message: `${order.orderNumber ? `Order #${order.orderNumber}` : 'This order'} will be cancelled and its payment voided.`,
      confirm: 'Cancel order',
      destructive: true,
      action: () => ordersService.cancel(order._id),
      failure: 'Could not cancel this order.',
    });

  const handleRestore = () =>
    runAction({
      title: 'Restore order',
      message: 'Mark this order as completed again?',
      confirm: 'Restore',
      action: () => ordersService.updateStatus(order._id, 'completed'),
      failure: 'Could not restore this order.',
    });

  const handleDelete = () => {
    Alert.alert(
      'Delete order',
      `Permanently delete ${order.orderNumber ? `order #${order.orderNumber}` : 'this order'}? This cannot be undone.`,
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
              Alert.alert('Error', e?.message ?? 'Could not delete this order.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={d.safe} edges={['top', 'bottom']}>
        <View style={d.header}>
          <IconButton icon="close" onPress={onClose} label="Close" size={36} />
          <Text style={text.h2}>Order</Text>
          {canEdit
            ? <IconButton icon="trash-outline" onPress={handleDelete} disabled={busy} label="Delete" size={36} />
            : <View style={d.spacer} />}
        </View>

        <ScrollView contentContainerStyle={d.scroll} showsVerticalScrollIndicator={false}>
          <Card style={d.summary}>
            <View style={d.summaryTop}>
              <Avatar name={order.customerName || 'Walk in'} size={46} />
              <View style={d.summaryCopy}>
                <Text style={text.h1} numberOfLines={1}>{order.customerName || 'Walk-in'}</Text>
                {!!order.orderNumber && <Text style={text.caption}>#{order.orderNumber}</Text>}
              </View>
              <StatusBadge status={order.status} />
            </View>

            <Divider />

            <View style={d.infoRows}>
              {!!branchName(order) && <InfoRow icon="business-outline" label="Branch" value={branchName(order)} />}
              {!!order.cashierName && <InfoRow icon="person-outline" label="Cashier" value={order.cashierName} />}
              <InfoRow icon="time-outline" label="Placed" value={dateTime(order.createdAt)} />
            </View>
          </Card>

          <View style={d.section}>
            <Text style={text.overline}>{plural(itemCount(order), 'item')}</Text>
            <Card padded={false}>
              {loading && (
                <View style={d.itemsLoading}>
                  {[0, 1, 2].map(idx => (
                    <View key={idx} style={d.loadingRow}>
                      <Skeleton width={34} height={30} radius={10} />
                      <View style={d.loadingBody}>
                        <Skeleton width={`${58 + idx * 8}%`} height={12} />
                        <Skeleton width="32%" height={10} />
                      </View>
                      <Skeleton width={44} height={12} />
                    </View>
                  ))}
                </View>
              )}
              {(order.items ?? []).map((item, idx, arr) => (
                <View key={idx}>
                  {idx > 0 && <Divider inset={space.lg} />}
                  <View style={d.itemRow}>
                    <View style={d.qty}><Text style={d.qtyText}>{item.quantity}×</Text></View>
                    <View style={d.itemCopy}>
                      <Text style={text.bodyStrong} numberOfLines={1}>{productName(item)}</Text>
                      <Text style={text.caption}>
                        {item.size}{item.unitPrice ? ` · ${money2(item.unitPrice)}` : ''}
                      </Text>
                      {(item.toppings ?? []).length > 0 && (
                        <Text style={text.micro} numberOfLines={2}>
                          + {(item.toppings ?? []).map(top => top.name).join(', ')}
                        </Text>
                      )}
                    </View>
                    <Text style={text.money}>{money2(lineTotal(item))}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>

          <Card>
            <DataRow label="Subtotal" value={money2(order.subtotal)} />
            {toNumber(order.discountAmount) > 0 && (
              <DataRow label="Discount" value={`– ${money2(order.discountAmount)}`} />
            )}
            <Divider />
            <DataRow label="Total" value={money2(order.total)} strong />
          </Card>

          {!!order.note && (
            <Card style={d.note}>
              <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
              <Text style={[text.small, d.noteText]}>{order.note}</Text>
            </Card>
          )}
        </ScrollView>

        {canEdit && (
          <View style={d.footer}>
            {cancelled ? (
              <Button
                label="Mark completed"
                onPress={handleRestore}
                loading={busy}
                size="lg"
                full
              />
            ) : (
              <Button
                label="Cancel order"
                onPress={handleCancel}
                loading={busy}
                variant="destructive"
                size="lg"
                full
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={d.infoRow}>
      <Ionicons name={icon} size={15} color={colors.textTertiary} />
      <Text style={[text.small, d.infoLabel]}>{label}</Text>
      <Text style={[text.smallStrong, d.infoValue]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const d = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  spacer: { width: 36 },
  scroll: { padding: space.xl, gap: space.lg, paddingBottom: space.xxxl },
  summary: { gap: space.lg },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  summaryCopy: { flex: 1, gap: 2 },
  infoRows: { gap: space.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  infoLabel: { width: 64 },
  infoValue: { flex: 1, textAlign: 'right' },
  section: { gap: space.sm },
  itemsLoading: { paddingVertical: space.sm },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  loadingBody: { flex: 1, gap: space.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  qty: {
    minWidth: 34, height: 28, borderRadius: radius.xs,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
    backgroundColor: colors.surfaceSunken,
  },
  qtyText: { fontSize: 12, fontWeight: '700', color: colors.text },
  itemCopy: { flex: 1, gap: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  noteText: { flex: 1, color: colors.text, lineHeight: 20 },
  footer: {
    padding: space.xl,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const { user } = useAuth();
  const canEdit = user?.role === 'super_admin' || user?.role === 'manager';

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [totalsLoading, setTotalsLoading] = useState(true);

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // One page of orders at a time, scoped to the active branch by the service.
  const orders = usePaginatedList<Order>(
    page => ordersService.getOrders({
      page,
      limit: PAGE_SIZE,
      status: filter === 'all' ? undefined : filter,
      search: debounced || undefined,
    }),
    [filter, debounced],
  );

  // The headline totals are all-time aggregates, unaffected by the filters, so
  // they load alongside the first page and on pull-to-refresh only. Cashiers
  // get a 403 from the reports endpoint and fall back to the rows on screen.
  const loadTotals = useCallback(async (loaded: Order[]) => {
    try {
      setTotals(totalsFromReport(await reportsService.getOrderSummary()));
    } catch {
      setTotals(totalsFromList(loaded));
    }
  }, []);

  const totalsInit = useRef(false);
  useEffect(() => {
    if (totalsInit.current || orders.loading) return;
    totalsInit.current = true;
    loadTotals(orders.items).finally(() => setTotalsLoading(false));
  }, [orders.loading, orders.items, loadTotals]);

  const onRefresh = useCallback(() => {
    orders.refresh();
    loadTotals(orders.items);
  }, [orders, loadTotals]);

  const openDetail = async (order: Order) => {
    // Show the list payload immediately, then swap in the fully populated order
    // (with product and topping names) for the items breakdown.
    setSelected(order);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      setSelected(await ordersService.getOrder(order._id));
    } catch {
      // keep the lightweight version
    } finally {
      setDetailLoading(false);
    }
  };

  const afterChange = useCallback(() => {
    orders.reload();
    loadTotals(orders.items);
  }, [orders, loadTotals]);

  return (
    <Screen scroll={false} padded={false} gap={0}>
      <PagedList
        data={orders.items}
        keyExtractor={order => order._id}
        refreshing={orders.refreshing}
        onRefresh={onRefresh}
        onEndReached={orders.loadMore}
        loadingMore={orders.loadingMore}
        hasMore={orders.hasMore}
        total={orders.total}
        noun="orders"
        header={
          <>
            <ScreenHeader
              subtitle="Sales"
              title="Orders"
              right={<Badge label={`${count(orders.total)} total`} tone="subtle" />}
            />
            <TotalsCard totals={totals} loading={totalsLoading} />
            <SearchField value={search} onChangeText={setSearch} placeholder="Order #, customer or cashier" />
            <Chips options={FILTERS} value={filter} onChange={setFilter} />
          </>
        }
        empty={
          orders.loading ? (
            <SkeletonList rows={6} avatar={false} />
          ) : (
            <Card padded={false}>
              <EmptyState
                icon="receipt-outline"
                title={orders.error ? 'Couldn\u2019t load orders' : debounced ? 'No matching orders' : 'No orders yet'}
                message={
                  orders.error
                    ? orders.error
                    : debounced
                      ? `Nothing matches \u201C${debounced}\u201D.`
                      : 'Completed sales will show up here.'
                }
                action={orders.error ? { label: 'Try again', onPress: orders.reload } : undefined}
              />
            </Card>
          )
        }
        renderItem={({ item, index }) => (
          <RowCard first={index === 0} last={index === orders.items.length - 1}>
            <ListRow
              title={item.customerName || 'Walk-in'}
              subtitle={item.orderNumber ? `#${item.orderNumber}` : undefined}
              leading={<Avatar name={item.customerName || 'Walk in'} size={42} tone="sunken" />}
              badge={<StatusBadge status={item.status} />}
              meta={[
                { icon: 'cube-outline', text: plural(itemCount(item), 'item') },
                { icon: 'time-outline', text: dateTime(item.createdAt) },
              ]}
              value={money2(item.total)}
              onPress={() => openDetail(item)}
            />
          </RowCard>
        )}
      />

      <OrderDetail
        order={selected}
        visible={detailOpen}
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
        onChanged={afterChange}
        canEdit={canEdit}
      />
    </Screen>
  );
}

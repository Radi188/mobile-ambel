import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar, Badge, Button, Card, CardHeader, Chips, DataRow, Divider, EmptyState,
  List, ListRow, Press, Screen, ScreenHeader, Segmented, Sheet, SkeletonReport, StatTile, TextField,
} from '../../components/ui';
import { Sparkline } from '../../components/charts/Sparkline';
import { Donut } from '../../components/charts/Donut';
import { RankBar } from '../../components/charts/RankBar';
import { reportsService, ReportFilter } from '../../services/reports.service';
import { branchesService } from '../../services/branches.service';
import { useAuth } from '../../context/AuthContext';
import {
  Branch, CashierReport, ProductReport, SalesReport, Shift, ShiftTransactions,
} from '../../types/api.types';
import {
  colors, count, money, money2, moneyCompact, plural, radius, space, text, toNumber,
} from '../../constants/theme';

type ReportTab = 'sales' | 'products' | 'cashiers' | 'shifts';
type ShiftRow = { shift: Shift; tx: ShiftTransactions | null };

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'products', label: 'Items' },
  { key: 'cashiers', label: 'Staff' },
  { key: 'shifts', label: 'Shifts' },
];

// ─── Dates ────────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

type Preset = { key: string; label: string; from: string; to: string };

function buildPresets(): Preset[] {
  const now = new Date();
  const today = toISO(now);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  return [
    { key: 'today', label: 'Today', from: today, to: today },
    { key: 'week', label: 'This week', from: toISO(weekStart), to: today },
    { key: 'month', label: 'This month', from: toISO(monthStart), to: toISO(monthEnd) },
    { key: 'last', label: 'Last month', from: toISO(lastMonthStart), to: toISO(lastMonthEnd) },
  ];
}

// ─── Filter sheet ─────────────────────────────────────────────────────────────

function FilterSheet({ visible, current, onApply, onClose }: {
  visible: boolean;
  current: ReportFilter;
  onApply: (f: ReportFilter) => void;
  onClose: () => void;
}) {
  const presets = useMemo(buildPresets, []);
  const [from, setFrom] = useState(current.dateFrom ?? '');
  const [to, setTo] = useState(current.dateTo ?? '');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFrom(current.dateFrom ?? '');
    setTo(current.dateTo ?? '');
    setInvalid(false);
  }, [visible]);

  const active = presets.find(p => p.from === from && p.to === to)?.key ?? 'custom';

  const apply = () => {
    const bad = (from !== '' && !isValidDate(from)) || (to !== '' && !isValidDate(to));
    setInvalid(bad);
    if (bad) return;
    onApply({ dateFrom: from || undefined, dateTo: to || undefined });
    onClose();
  };

  // Keeps typing in YYYY-MM-DD shape without a native picker dependency.
  const formatInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length > 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
    if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return digits;
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Date range"
      subtitle="Every figure below follows this range"
      footer={
        <>
          <Button label="Clear" variant="secondary" size="lg" style={sheet.clear} onPress={() => { onApply({}); onClose(); }} />
          <Button label="Apply" size="lg" style={sheet.apply} onPress={apply} />
        </>
      }
    >
      <View style={sheet.body}>
        <Chips
          options={presets.map(p => ({ key: p.key, label: p.label }))}
          value={active}
          onChange={key => {
            const preset = presets.find(p => p.key === key);
            if (!preset) return;
            setFrom(preset.from);
            setTo(preset.to);
            setInvalid(false);
          }}
          wrap
        />

        <Divider />

        <View style={sheet.dates}>
          <TextField
            label="From"
            value={from}
            onChangeText={v => setFrom(formatInput(v))}
            placeholder="YYYY-MM-DD"
            keyboardType="number-pad"
            icon="calendar-outline"
            maxLength={10}
            style={sheet.dateField}
          />
          <TextField
            label="To"
            value={to}
            onChangeText={v => setTo(formatInput(v))}
            placeholder="YYYY-MM-DD"
            keyboardType="number-pad"
            icon="calendar-outline"
            maxLength={10}
            style={sheet.dateField}
          />
        </View>

        {invalid && <Text style={[text.caption, sheet.invalid]}>Use the YYYY-MM-DD format, e.g. 2026-01-31.</Text>}
      </View>
    </Sheet>
  );
}

const sheet = StyleSheet.create({
  body: { gap: space.lg },
  dates: { flexDirection: 'row', gap: space.md },
  dateField: { flex: 1 },
  invalid: { color: colors.text, fontWeight: '600' },
  clear: { flex: 1 },
  apply: { flex: 1.6 },
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────


/**
 * Aggregate reports come back as one whole period rather than pages, so these
 * tables reveal more rows locally instead of asking the server for page 2.
 */
function ShowMore({ shown, total, onPress, noun }: {
  shown: number; total: number; onPress: () => void; noun: string;
}) {
  if (shown >= total) return null;
  return (
    <Press onPress={onPress} scaleTo={0.97} style={s.showMore}>
      <Text style={text.smallStrong}>Show more</Text>
      <Text style={text.micro}>{shown} of {total} {noun}</Text>
    </Press>
  );
}

function SalesTab({ sales }: { sales: SalesReport }) {
  const [visibleDays, setVisibleDays] = useState(7);
  const overview = sales.overview;
  const byDay = sales.byDay ?? [];
  const methods = (['cash', 'card', 'qr'] as const).map(method => {
    const entry = (sales.byMethod ?? []).find(m => m.method === method);
    return { label: method.toUpperCase(), value: toNumber(entry?.total), txns: toNumber(entry?.count) };
  }).filter(m => m.value > 0);

  return (
    <>
      <View style={s.grid}>
        <StatTile label="Revenue" value={money(overview?.totalRevenue)} icon="cash-outline" />
        <StatTile label="Transactions" value={count(overview?.totalTransactions)} icon="receipt-outline" />
        <StatTile label="Average sale" value={money2(overview?.averageTransaction)} icon="trending-up-outline" />
        <StatTile label="Change given" value={money(overview?.totalChangeGiven)} icon="swap-horizontal-outline" />
      </View>

      {byDay.length > 1 && (
        <Card>
          <CardHeader
            title="Daily revenue"
            subtitle={`${byDay.length} days`}
            right={<Text style={text.money}>{money(byDay.reduce((sum, d) => sum + toNumber(d.revenue), 0))}</Text>}
          />
          <View style={s.sparkline}>
            <Sparkline values={byDay.map(d => toNumber(d.revenue))} height={80} />
          </View>
          <View style={s.axis}>
            <Text style={text.micro}>{formatDisplay(byDay[0].date)}</Text>
            <Text style={text.micro}>{formatDisplay(byDay[byDay.length - 1].date)}</Text>
          </View>
        </Card>
      )}

      {methods.length > 0 && (
        <Card>
          <CardHeader title="Payment mix" subtitle="Share of takings" />
          <View style={s.donut}>
            <Donut data={methods.map(m => ({ label: m.label, value: m.value }))} size={140} />
          </View>
        </Card>
      )}

      <Card>
        <CardHeader title="Cash drawer" />
        <DataRow label="Cash received" value={money(overview?.totalCashReceived)} />
        <Divider />
        <DataRow label="Change given" value={money(overview?.totalChangeGiven)} />
        {toNumber(sales.refunds?.count) > 0 && (
          <>
            <Divider />
            <DataRow
              label="Refunds"
              sub={plural(toNumber(sales.refunds?.count), 'refund')}
              value={money(sales.refunds?.total)}
            />
          </>
        )}
      </Card>

      {byDay.length > 0 && (
        <Card padded={false}>
          <View style={s.cardPad}><CardHeader title="Daily breakdown" subtitle="Most recent first" /></View>
          <List inset={false}>
            {[...byDay].reverse().slice(0, visibleDays).map(day => (
              <ListRow
                key={day.date}
                title={formatDisplay(day.date)}
                subtitle={plural(toNumber(day.transactions), 'transaction')}
                value={money(day.revenue)}
                compact
              />
            ))}
          </List>
          <View style={s.cardPad}>
            <ShowMore
              shown={Math.min(visibleDays, byDay.length)}
              total={byDay.length}
              noun="days"
              onPress={() => setVisibleDays(n => n + 7)}
            />
          </View>
        </Card>
      )}
    </>
  );
}

function ProductsTab({ products }: { products: ProductReport }) {
  const items = products.topProducts ?? [];
  const max = items.reduce((mx, item) => Math.max(mx, toNumber(item.totalRevenue)), 0);
  const revenue = items.reduce((sum, item) => sum + toNumber(item.totalRevenue), 0);
  const units = items.reduce((sum, item) => sum + toNumber(item.totalQuantity), 0);

  return (
    <>
      <View style={s.grid}>
        <StatTile label="Item revenue" value={money(revenue)} icon="cash-outline" />
        <StatTile label="Units sold" value={count(units)} icon="cube-outline" />
      </View>

      <Card>
        <CardHeader title="Best sellers" subtitle="By revenue" />
        {items.length === 0 ? (
          <EmptyState icon="cube-outline" title="No product sales yet" />
        ) : (
          items.map((item, idx) => (
            <RankBar
              key={item.productId}
              rank={idx + 1}
              label={item.productName}
              sub={`${item.categoryName} · ${plural(toNumber(item.totalQuantity), 'unit')}`}
              value={toNumber(item.totalRevenue)}
              max={max}
              display={moneyCompact(item.totalRevenue)}
            />
          ))
        )}
      </Card>

      {(products.byCategory ?? []).length > 0 && (
        <Card>
          <CardHeader title="By category" />
          <View style={s.donut}>
            <Donut
              data={(products.byCategory ?? []).map(c => ({ label: c.categoryName, value: toNumber(c.totalRevenue) }))}
              size={140}
            />
          </View>
        </Card>
      )}
    </>
  );
}

function CashiersTab({ cashiers }: { cashiers: CashierReport }) {
  const items = [...(cashiers.cashiers ?? [])].sort((a, b) => toNumber(b.totalRevenue) - toNumber(a.totalRevenue));
  const revenue = items.reduce((sum, c) => sum + toNumber(c.totalRevenue), 0);
  const orders = items.reduce((sum, c) => sum + toNumber(c.totalOrders), 0);

  return (
    <>
      <View style={s.grid}>
        <StatTile label="Team revenue" value={money(revenue)} icon="cash-outline" />
        <StatTile label="Orders taken" value={count(orders)} icon="receipt-outline" />
      </View>

      {items.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon="people-outline" title="No cashier activity" message="Sales attributed to staff appear here." />
        </Card>
      ) : (
        <List>
          {items.map((cashier, idx) => (
            <ListRow
              key={cashier.cashierName}
              title={cashier.cashierName}
              leading={<Avatar name={cashier.cashierName} size={42} tone={idx === 0 ? 'solid' : 'sunken'} />}
              badge={idx === 0 ? <Badge label="Top" tone="solid" /> : undefined}
              meta={[
                { icon: 'receipt-outline', text: plural(toNumber(cashier.totalOrders), 'order') },
                { icon: 'trending-up-outline', text: `avg ${money2(cashier.averageOrderValue)}` },
              ]}
              value={money(cashier.totalRevenue)}
            />
          ))}
        </List>
      )}
    </>
  );
}

function shiftDateTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function ShiftsTab({ shifts }: { shifts: ShiftRow[] }) {
  const [visible, setVisible] = useState(8);
  const revenue = shifts.reduce((sum, row) => sum + toNumber(row.tx?.revenue), 0);
  const orders = shifts.reduce((sum, row) => sum + toNumber(row.tx?.orders), 0);
  const open = shifts.filter(row => row.shift.status === 'open').length;

  return (
    <>
      <View style={s.grid}>
        <StatTile label="Shifts" value={count(shifts.length)} sub={`${open} open`} icon="time-outline" />
        <StatTile label="Revenue" value={money(revenue)} icon="cash-outline" />
        <StatTile label="Transactions" value={count(orders)} icon="receipt-outline" />
        <StatTile
          label="Per shift"
          value={shifts.length ? moneyCompact(revenue / shifts.length) : '—'}
          icon="stats-chart-outline"
        />
      </View>

      {shifts.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon="time-outline" title="No shifts in range" message="Try widening the date range." />
        </Card>
      ) : (
        <List>
          {shifts.slice(0, visible).map(({ shift, tx }) => (
            <ListRow
              key={shift._id}
              title={shift.cashierName || 'Cashier'}
              leading={<Avatar name={shift.cashierName} size={42} tone="sunken" />}
              badge={
                <Badge
                  label={shift.status === 'open' ? 'Open' : 'Closed'}
                  tone={shift.status === 'open' ? 'solid' : 'outline'}
                  dot={shift.status === 'open'}
                />
              }
              meta={[
                { icon: 'calendar-outline', text: shiftDateTime(shift.openedAt) },
                { icon: 'receipt-outline', text: plural(toNumber(tx?.orders), 'txn') },
              ]}
              value={money(tx?.revenue)}
            />
          ))}
        </List>
      )}

      <ShowMore
        shown={Math.min(visible, shifts.length)}
        total={shifts.length}
        noun="shifts"
        onPress={() => setVisible(n => n + 8)}
      />
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const { user, activeBranchId, switchBranch } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ReportTab>('sales');
  const [filter, setFilter] = useState<ReportFilter>({});
  const [filterOpen, setFilterOpen] = useState(false);

  const [sales, setSales] = useState<SalesReport | null>(null);
  const [products, setProducts] = useState<ProductReport | null>(null);
  const [cashiers, setCashiers] = useState<CashierReport | null>(null);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchOpen, setBranchOpen] = useState(false);

  const branchName = branches.find(b => b._id === activeBranchId)?.name ?? 'Select branch';
  const hasFilter = !!(filter.dateFrom || filter.dateTo);

  const filterLabel = useMemo(() => {
    if (!hasFilter) return 'All time';
    if (filter.dateFrom && filter.dateTo) return `${formatDisplay(filter.dateFrom)} – ${formatDisplay(filter.dateTo)}`;
    if (filter.dateFrom) return `From ${formatDisplay(filter.dateFrom)}`;
    return `Until ${formatDisplay(filter.dateTo!)}`;
  }, [filter, hasFilter]);

  // Reports are scoped to the active branch via the x-branch-id header.
  const loadAll = useCallback(async (f: ReportFilter = {}) => {
    setError(null);
    try {
      const [salesData, productData, cashierData, shiftList] = await Promise.all([
        reportsService.getSales(f),
        reportsService.getProducts(f),
        reportsService.getCashiers(f),
        reportsService.getShifts(),
      ]);
      setSales(salesData);
      setProducts(productData);
      setCashiers(cashierData);

      // Shifts have no date params, so trim to the range here before pulling totals.
      const inRange = (shiftList ?? []).filter(sh => {
        const day = (sh.openedAt ?? '').slice(0, 10);
        if (f.dateFrom && day < f.dateFrom) return false;
        if (f.dateTo && day > f.dateTo) return false;
        return true;
      }).slice(0, 30);

      const summaries = await Promise.all(
        inRange.map(sh => reportsService.getShiftSummary(sh._id).catch(() => null)),
      );
      setShifts(inRange.map((shift, idx) => ({ shift, tx: summaries[idx] })));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load reports.');
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    branchesService.getBranches(true).then(list => setBranches(list ?? [])).catch(() => {});
  }, [isAdmin]);

  // Admins always view a single branch — default to the first, and re-point at it
  // if the stored branch id no longer exists.
  useEffect(() => {
    if (!isAdmin || branches.length === 0) return;
    const known = branches.some(branch => branch._id === activeBranchId);
    if (!known) switchBranch(branches[0]._id);
  }, [isAdmin, activeBranchId, branches, switchBranch]);

  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    loadAll({}).finally(() => setLoading(false));
  }, []);

  const prevFilter = useRef(filter);
  useEffect(() => {
    if (!mounted.current || prevFilter.current === filter) return;
    prevFilter.current = filter;
    setLoading(true);
    loadAll(filter).finally(() => setLoading(false));
  }, [filter, loadAll]);

  const prevBranch = useRef(activeBranchId);
  useEffect(() => {
    if (!mounted.current || prevBranch.current === activeBranchId) return;
    prevBranch.current = activeBranchId;
    setLoading(true);
    loadAll(filter).finally(() => setLoading(false));
  }, [activeBranchId, loadAll, filter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll(filter);
    setRefreshing(false);
  }, [loadAll, filter]);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader
        subtitle={isAdmin ? 'Performance' : 'Your branch'}
        title="Reports"
        right={
          <Press onPress={() => setFilterOpen(true)} scaleTo={0.95} style={[s.filterBtn, hasFilter && s.filterBtnOn]}>
            <Ionicons
              name={hasFilter ? 'funnel' : 'funnel-outline'}
              size={14}
              color={hasFilter ? colors.textInverse : colors.text}
            />
            <Text style={[s.filterText, hasFilter && s.filterTextOn]} numberOfLines={1}>{filterLabel}</Text>
          </Press>
        }
        below={
          isAdmin && branches.length > 0 ? (
            <Press onPress={() => setBranchOpen(true)} scaleTo={0.96} style={s.branchBtn}>
              <Ionicons name="business-outline" size={14} color={colors.text} />
              <Text style={[text.smallStrong, s.branchLabel]} numberOfLines={1}>{branchName}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
            </Press>
          ) : undefined
        }
      />

      <Segmented options={TABS} value={tab} onChange={setTab} />

      {loading ? (
        <SkeletonReport />
      ) : error ? (
        <Card padded={false}>
          <EmptyState icon="alert-circle-outline" title="Couldn't load reports" message={error} />
        </Card>
      ) : (
        <>
          {tab === 'sales' && (sales ? <SalesTab sales={sales} /> : <Card padded={false}><EmptyState title="No sales data" /></Card>)}
          {tab === 'products' && (products ? <ProductsTab products={products} /> : <Card padded={false}><EmptyState title="No product data" /></Card>)}
          {tab === 'cashiers' && (cashiers ? <CashiersTab cashiers={cashiers} /> : <Card padded={false}><EmptyState title="No cashier data" /></Card>)}
          {tab === 'shifts' && <ShiftsTab shifts={shifts} />}
        </>
      )}

      <FilterSheet visible={filterOpen} current={filter} onApply={setFilter} onClose={() => setFilterOpen(false)} />

      {isAdmin && (
        <Sheet visible={branchOpen} onClose={() => setBranchOpen(false)} title="Branch">
          <List>
            {branches.map(branch => (
              <ListRow
                key={branch._id}
                title={branch.name}
                subtitle={branch.address}
                leading={<Avatar icon="business" size={38} tone={branch._id === activeBranchId ? 'solid' : 'sunken'} />}
                badge={branch._id === activeBranchId ? <Badge label="Active" tone="solid" /> : undefined}
                onPress={() => { switchBranch(branch._id); setBranchOpen(false); }}
              />
            ))}
          </List>
        </Sheet>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  sparkline: { marginTop: space.lg },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  donut: { marginTop: space.lg },
  cardPad: { padding: space.xl, paddingBottom: space.md },
  showMore: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 180,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.text, flexShrink: 1 },
  filterTextOn: { color: colors.textInverse },
  branchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  branchLabel: { maxWidth: 200 },
});

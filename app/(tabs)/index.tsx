import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Avatar, Badge, Card, CardHeader, EmptyState, List, ListRow,
  Press, Screen, Segmented, Sheet, Skeleton, SkeletonDashboard, StatTile,
} from '../../components/ui';
import { useResponsive } from '../../lib/responsive';
import { BarChart } from '../../components/charts/BarChart';
import { useAuth } from '../../context/AuthContext';
import { dashboardService, localDate } from '../../services/dashboard.service';
import {
  Branch, OrderSummaryReport, ProductReportItem, SalesReport, ShiftReport,
} from '../../types/api.types';
import {
  colors, count, money, money2, moneyCompact, plural, radius, space, text, toNumber,
} from '../../constants/theme';

// ─── Period filter ────────────────────────────────────────────────────────────

type Period = 'today' | 'yesterday' | 'week' | 'month';

// Always an explicit range, as ambel-mobile sends: an open-ended request is
// left to the server's default, which is not "all time".
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

function periodRange(p: Period): { dateFrom: string; dateTo: string } {
  const now = new Date();
  if (p === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { dateFrom: localDate(y), dateTo: localDate(y) };
  }
  const start = new Date(now);
  if (p === 'week') start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
  if (p === 'month') start.setDate(1);
  return { dateFrom: localDate(start), dateTo: localDate(now) };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * The three biggest payment methods by takings. The server groups by the
 * configured method ("ABA QR", "Wing"), so the names come from the data rather
 * than a fixed cash/card/qr list that read $0 whenever a code didn't match.
 */
function topMethods(sales: SalesReport | null): { key: string; label: string; total: number }[] {
  const rows = [...(sales?.byMethod ?? [])]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map(m => ({
      key: m.methodCode || m.method,
      label: String(m.methodName || m.method || m.methodCode || '—'),
      total: m.total,
    }));
  if (rows.length) return rows;
  return ['Cash', 'Card', 'QR'].map(label => ({ key: label, label, total: 0 }));
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function RevenueHero({ sales, period, onPeriod, loading }: {
  sales: SalesReport | null;
  period: Period;
  onPeriod: (p: Period) => void;
  loading: boolean;
}) {
  const methods = topMethods(sales);

  return (
    <Card tone="inverse" style={hero.card}>
      <Segmented options={PERIODS} value={period} onChange={onPeriod} inverse />

      <View style={hero.figure}>
        <Text style={[text.overline, { color: colors.textInverseDim }]}>Total revenue</Text>
        {loading ? (
          <View style={hero.loading}><Skeleton width="64%" height={40} radius={12} onDark /></View>
        ) : (
          <Text style={[text.display, hero.value]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {money(sales?.overview?.totalRevenue)}
          </Text>
        )}
        <Text style={[text.caption, { color: colors.textInverseSub }]}>
          {plural(toNumber(sales?.overview?.totalTransactions), 'transaction')} · avg{' '}
          {moneyCompact(sales?.overview?.averageTransaction)}
        </Text>
      </View>

      <View style={hero.chips}>
        {methods.map(m => (
          <View key={m.key} style={hero.chip}>
            <Text style={[text.micro, { color: colors.textInverseDim }]} numberOfLines={1}>{m.label.toUpperCase()}</Text>
            <Text style={[text.smallStrong, { color: colors.textInverse }]} numberOfLines={1}>
              {moneyCompact(m.total)}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const hero = StyleSheet.create({
  card: { gap: space.xl, padding: space.xxl },
  figure: { gap: space.xs },
  loading: { height: 46, justifyContent: 'center' },
  value: { color: colors.textInverse },
  chips: { flexDirection: 'row', gap: space.sm },
  chip: {
    flex: 1,
    backgroundColor: colors.fillInverse,
    borderRadius: radius.sm,
    paddingVertical: space.md - 2,
    paddingHorizontal: space.md,
    gap: 3,
  },
});

// ─── Header ───────────────────────────────────────────────────────────────────

function roleLabel(role?: string): string {
  if (role === 'super_admin') return 'Admin';
  if (role === 'manager') return 'Manager';
  return 'Cashier';
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Phone: greeting + avatar on one row, branch switcher full width beneath it so
 * it's an easy thumb target. Tablet: everything on a single row, switcher sits
 * next to the avatar.
 */
function DashboardHeader({ name, role, branch, onBranch, branchDisabled }: {
  name?: string;
  role?: string;
  /** Omit to hide the switcher (non-admins, or no branches yet). */
  branch?: string;
  onBranch: () => void;
  branchDisabled?: boolean;
}) {
  const router = useRouter();
  const { isTablet } = useResponsive();
  const firstName = name?.trim().split(/\s+/)[0];

  const switcher = branch !== undefined && (
    <Press
      onPress={onBranch}
      disabled={branchDisabled}
      scaleTo={0.98}
      style={[hd.branch, isTablet ? hd.branchTablet : hd.branchPhone, branchDisabled && hd.dim]}
      accessibilityLabel={`Branch: ${branch}. Change branch`}
    >
      <View style={hd.branchIcon}>
        <Ionicons name="business" size={15} color={colors.textInverse} />
      </View>
      <View style={hd.branchText}>
        <Text style={text.overline}>Branch</Text>
        <Text style={text.smallStrong} numberOfLines={1}>{branch}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
    </Press>
  );

  return (
    <View style={hd.wrap}>
      <View style={hd.row}>
        <View style={hd.titleBox}>
          <Text style={text.caption} numberOfLines={1}>
            {todayLabel()} · {roleLabel(role)}
          </Text>
          <Text style={[text.title, isTablet && hd.titleTablet]} numberOfLines={1}>
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </Text>
        </View>

        {isTablet && switcher}

        <Press onPress={() => router.push('/settings')} scaleTo={0.92} accessibilityLabel="Account settings">
          <Avatar name={name} size={isTablet ? 48 : 44} />
        </Press>
      </View>

      {!isTablet && switcher}
    </View>
  );
}

const hd = StyleSheet.create({
  wrap: { gap: space.lg, paddingTop: space.sm, paddingBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleBox: { flex: 1, gap: 2 },
  titleTablet: { fontSize: 32, letterSpacing: -0.9 },
  branch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  branchPhone: { alignSelf: 'stretch' },
  branchTablet: { width: 260 },
  branchIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceInverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchText: { flex: 1, gap: 1 },
  dim: { opacity: 0.5 },
});

/** `activeId` null = every branch. */
function BranchSheet({ visible, branches, activeId, onSelect, onClose }: {
  visible: boolean;
  branches: Branch[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Branch" subtitle="Scope every figure to one location, or see them all">
      <List>
        <ListRow
          title="All branches"
          subtitle={`Every location combined · ${plural(branches.length, 'branch', 'branches')}`}
          leading={<Avatar icon="layers" size={38} tone={activeId === null ? 'solid' : 'sunken'} />}
          badge={activeId === null ? <Badge label="Active" tone="solid" /> : undefined}
          onPress={() => { onSelect(null); onClose(); }}
        />
        {branches.map(branch => {
          const active = branch._id === activeId;
          return (
            <ListRow
              key={branch._id}
              title={branch.name}
              subtitle={branch.address}
              leading={<Avatar icon="business" size={38} tone={active ? 'solid' : 'sunken'} />}
              badge={active ? <Badge label="Active" tone="solid" /> : undefined}
              onPress={() => { onSelect(branch._id); onClose(); }}
            />
          );
        })}
      </List>
    </Sheet>
  );
}

// ─── Top items ────────────────────────────────────────────────────────────────

function TopItems({ items }: { items: ProductReportItem[] }) {
  const max = Math.max(...items.map(i => i.totalQuantity), 1);
  return (
    <Card>
      <CardHeader title="Top selling" subtitle={items.length > 0 ? `Best ${items.length} by quantity` : undefined} />
      {items.length === 0 ? (
        <Text style={[text.small, ti.empty]}>No sales in this period yet.</Text>
      ) : (
        <View style={ti.list}>
          {items.map((item, idx) => (
            <View key={String(item.productId ?? idx)} style={ti.row}>
              <Text style={[text.smallStrong, ti.rank]}>{idx + 1}</Text>
              <View style={ti.body}>
                <Text style={text.smallStrong} numberOfLines={1}>{item.productName || 'Item'}</Text>
                <View style={ti.track}>
                  <View style={[ti.fill, { width: `${(item.totalQuantity / max) * 100}%` }]} />
                </View>
              </View>
              <View style={ti.figures}>
                <Text style={text.money}>{moneyCompact(item.totalRevenue)}</Text>
                <Text style={text.micro}>{count(item.totalQuantity)} sold</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const ti = StyleSheet.create({
  empty: { marginTop: space.lg },
  list: { marginTop: space.lg, gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rank: { width: 18, color: colors.textTertiary },
  body: { flex: 1, gap: 6 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  figures: { alignItems: 'flex-end', gap: 1 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

const PERIOD_NOTE: Record<Period, string> = { today: 'today', yesterday: 'yesterday', week: 'this week', month: 'this month' };

export default function DashboardScreen() {
  const { user, activeBranchId, switchBranch } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('today');
  const [periodLoading, setPeriodLoading] = useState(false);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [orders, setOrders] = useState<OrderSummaryReport | null>(null);
  const [topItems, setTopItems] = useState<ProductReportItem[]>([]);
  const [shiftReport, setShiftReport] = useState<ShiftReport | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [weekly, setWeekly] = useState<{ label: string; value: number }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Admins start on every branch combined, as in ambel-mobile. Picking one
  // branch scopes the dashboard to it (and makes it the app's active branch).
  const [allBranches, setAllBranches] = useState(isAdmin);
  const scopeAll = isAdmin && allBranches;

  const branchName = scopeAll
    ? 'All branches'
    : branches.find(b => b._id === activeBranchId)?.name ?? 'Select branch';
  const weekTotal = weekly.reduce((sum, d) => sum + d.value, 0);
  const recentShifts = (shiftReport?.shifts ?? []).slice(0, 5);

  // Everything the period filter drives. Each report settles on its own, so one
  // failing endpoint blanks its own card instead of the whole screen.
  const loadPeriod = useCallback(async (p: Period) => {
    const f = { ...periodRange(p), allBranches: scopeAll };
    const [s, o, t, sh] = await Promise.allSettled([
      dashboardService.getSalesReport(f),
      dashboardService.getOrderSummary(f),
      dashboardService.getTopProducts(f),
      dashboardService.getShiftReport(f),
    ]);
    if (s.status === 'fulfilled') setSales(s.value);
    if (o.status === 'fulfilled') setOrders(o.value);
    if (t.status === 'fulfilled') setTopItems(t.value);
    if (sh.status === 'fulfilled') setShiftReport(sh.value);
  }, [scopeAll]);

  const loadData = useCallback(async () => {
    const [, week, branchList] = await Promise.allSettled([
      loadPeriod(period),
      dashboardService.getWeeklyRevenue(scopeAll),
      isAdmin ? dashboardService.getActiveBranches() : Promise.resolve([] as Branch[]),
    ]);
    if (week.status === 'fulfilled') setWeekly(week.value);
    if (isAdmin && branchList.status === 'fulfilled') {
      // Keep the fullest list we've seen so the switcher can't collapse if the
      // branches endpoint ever scopes itself to the selected branch.
      const list = branchList.value;
      setBranches(prev => (list.length >= prev.length ? list : prev));
    }
  }, [isAdmin, period, loadPeriod]);

  // Initial load, and a full reload whenever the admin switches branch or scope.
  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [activeBranchId, scopeAll]);

  // Admins always view a single branch. Fall back to the first one when nothing
  // is selected, or when the stored id no longer matches a branch — a branch can
  // be deleted, and a stored id can outlive the backend that issued it.
  useEffect(() => {
    if (!isAdmin || branches.length === 0) return;
    const known = branches.some(branch => branch._id === activeBranchId);
    if (!known) switchBranch(branches[0]._id);
  }, [isAdmin, activeBranchId, branches, switchBranch]);

  // Period changes only reload the period's reports, not the whole screen.
  const periodMounted = useRef(false);
  useEffect(() => {
    if (!periodMounted.current) { periodMounted.current = true; return; }
    let cancelled = false;
    setPeriodLoading(true);
    loadPeriod(period).finally(() => { if (!cancelled) setPeriodLoading(false); });
    return () => { cancelled = true; };
  }, [period, loadPeriod]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <DashboardHeader
        name={user?.name}
        role={user?.role}
        branch={isAdmin && branches.length > 0 ? branchName : undefined}
        onBranch={() => setPickerOpen(true)}
        branchDisabled={loading}
      />

      {loading ? (
        <SkeletonDashboard />
      ) : (
        <>
          <RevenueHero sales={sales} period={period} onPeriod={setPeriod} loading={periodLoading} />

          <View style={s.grid}>
            <StatTile label="Orders" value={count(orders?.overview?.totalOrders)} icon="receipt-outline" />
            <StatTile
              label="Average order"
              value={money2(orders?.overview?.averageOrderValue)}
              icon="trending-up-outline"
            />
            <StatTile
              label="Cash sales"
              value={moneyCompact(shiftReport?.overview?.totalCashSales)}
              icon="cash-outline"
            />
            <StatTile
              label="Open shifts"
              value={count(shiftReport?.overview?.openShifts)}
              icon="time-outline"
            />
          </View>

          {weekly.length > 0 && (
            <Card>
              <CardHeader title="Revenue" subtitle="Last 7 days" right={<Text style={text.money}>{money(weekTotal)}</Text>} />
              <View style={s.chart}>
                <BarChart data={weekly} height={150} />
              </View>
            </Card>
          )}

          <TopItems items={topItems} />

          <View style={s.section}>
            <CardHeader
              title="Shifts"
              subtitle={
                recentShifts.length > 0
                  ? `${plural(shiftReport?.overview?.totalShifts ?? recentShifts.length, 'shift')} ${PERIOD_NOTE[period]}`
                  : undefined
              }
            />
            {recentShifts.length === 0 ? (
              <Card padded={false}>
                <EmptyState icon="time-outline" title={`No shifts ${PERIOD_NOTE[period]}`} message="Shifts appear here once a cashier opens the till." />
              </Card>
            ) : (
              <List>
                {recentShifts.map(row => {
                  const open = row.status !== 'closed';
                  return (
                    <ListRow
                      key={row.shiftId}
                      title={row.cashierName}
                      leading={<Avatar name={row.cashierName} size={40} tone="sunken" />}
                      badge={<Badge label={open ? 'Open' : 'Closed'} tone={open ? 'solid' : 'outline'} dot={open} />}
                      meta={[
                        ...(row.branchName ? [{ icon: 'business-outline' as const, text: row.branchName }] : []),
                        { icon: 'time-outline' as const, text: timeAgo(row.openedAt) },
                      ]}
                      value={money(row.revenue)}
                      valueSub={plural(row.orders, 'order')}
                    />
                  );
                })}
              </List>
            )}
          </View>
        </>
      )}

      {isAdmin && (
        <BranchSheet
          visible={pickerOpen}
          branches={branches}
          activeId={scopeAll ? null : activeBranchId}
          onSelect={id => {
            setAllBranches(id === null);
            if (id && id !== activeBranchId) switchBranch(id);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  chart: { marginTop: space.lg },
  section: { gap: space.md },
});

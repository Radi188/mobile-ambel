import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar, Badge, Card, CardHeader, EmptyState, List, ListRow,
  Press, Screen, ScreenHeader, Segmented, Sheet, Skeleton, SkeletonDashboard, StatTile,
} from '../../components/ui';
import { BarChart } from '../../components/charts/BarChart';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboard.service';
import { Branch, Order, SalesReport, Shift, ShiftTransactions } from '../../types/api.types';
import {
  colors, count, money, moneyCompact, plural, radius, space, text, toNumber,
} from '../../constants/theme';

// ─── Period filter ────────────────────────────────────────────────────────────

type Period = 'month' | 'lastMonth' | 'total';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'total', label: 'All time' },
];

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function periodRange(p: Period): { dateFrom?: string; dateTo?: string } {
  if (p === 'total') return {};
  const now = new Date();
  const offset = p === 'lastMonth' ? -1 : 0;
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { dateFrom: isoDate(start), dateTo: isoDate(end) };
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

function shiftBranchName(shift: Shift): string {
  const b = shift.branch;
  return typeof b === 'object' && b ? b.name : '';
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function RevenueHero({ sales, period, onPeriod, loading }: {
  sales: SalesReport | null;
  period: Period;
  onPeriod: (p: Period) => void;
  loading: boolean;
}) {
  const byMethod: Record<string, number> = {};
  (sales?.byMethod ?? []).forEach(m => { byMethod[m.method] = m.total; });

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
        {(['cash', 'card', 'qr'] as const).map(method => (
          <View key={method} style={hero.chip}>
            <Text style={[text.micro, { color: colors.textInverseDim }]}>{method.toUpperCase()}</Text>
            <Text style={[text.smallStrong, { color: colors.textInverse }]} numberOfLines={1}>
              {moneyCompact(byMethod[method] ?? 0)}
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

// ─── Branch switcher ──────────────────────────────────────────────────────────

function BranchSwitch({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Press onPress={onPress} disabled={disabled} scaleTo={0.96} style={bs.button}>
      <Ionicons name="business-outline" size={14} color={colors.text} />
      <Text style={[text.smallStrong, bs.label]} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
    </Press>
  );
}

const bs = StyleSheet.create({
  button: {
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
  label: { maxWidth: 200 },
});

function BranchSheet({ visible, branches, activeId, onSelect, onClose }: {
  visible: boolean;
  branches: Branch[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Branch" subtitle="Scope every figure to one location">
      <List>
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user, activeBranchId, switchBranch } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [period, setPeriod] = useState<Period>('total');
  const [salesLoading, setSalesLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shiftRows, setShiftRows] = useState<{ shift: Shift; tx: ShiftTransactions | null }[]>([]);
  const [discounts, setDiscounts] = useState(0);
  const [weekly, setWeekly] = useState<{ label: string; value: number }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const branchName = branches.find(b => b._id === activeBranchId)?.name ?? 'Select branch';
  const weekTotal = weekly.reduce((sum, d) => sum + d.value, 0);

  const loadData = useCallback(async () => {
    try {
      const range = periodRange(period);
      const tasks: Promise<any>[] = [
        dashboardService.getSalesReport(range.dateFrom, range.dateTo),
        dashboardService.getRecentOrders(),
        dashboardService.getWeeklyRevenue(),
        dashboardService.getShifts(),
      ];
      if (isAdmin) tasks.push(dashboardService.getActiveBranches());

      const [salesData, orders, week, shifts, branchList] = await Promise.all(tasks);
      setSales(salesData);
      setDiscounts((orders ?? []).reduce((sum: number, o: Order) => sum + toNumber(o.discountAmount), 0));

      // Most recent shifts plus their live transaction totals.
      const recent: Shift[] = (shifts ?? []).slice(0, 5);
      const summaries = await Promise.all(
        recent.map(sh => dashboardService.getShiftSummary(sh._id).catch(() => null)),
      );
      setShiftRows(recent.map((shift, idx) => ({ shift, tx: summaries[idx] })));
      setWeekly(week);

      if (isAdmin) {
        // Keep the fullest list we've seen so the switcher can't collapse if the
        // branches endpoint ever scopes itself to the selected branch.
        setBranches(prev => ((branchList?.length ?? 0) >= prev.length ? (branchList ?? []) : prev));
      }
    } catch {
      // keep whatever we already have on screen
    }
  }, [isAdmin, period]);

  // Initial load, and a full reload whenever the admin switches branch.
  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [activeBranchId]);

  // Admins always view a single branch. Fall back to the first one when nothing
  // is selected, or when the stored id no longer matches a branch — a branch can
  // be deleted, and a stored id can outlive the backend that issued it.
  useEffect(() => {
    if (!isAdmin || branches.length === 0) return;
    const known = branches.some(branch => branch._id === activeBranchId);
    if (!known) switchBranch(branches[0]._id);
  }, [isAdmin, activeBranchId, branches, switchBranch]);

  // Period changes only need the revenue report, not the whole screen.
  const periodMounted = useRef(false);
  useEffect(() => {
    if (!periodMounted.current) { periodMounted.current = true; return; }
    let cancelled = false;
    setSalesLoading(true);
    const { dateFrom, dateTo } = periodRange(period);
    dashboardService.getSalesReport(dateFrom, dateTo)
      .then(data => { if (!cancelled) setSales(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSalesLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader
        subtitle={greeting()}
        title={user?.name ?? 'Dashboard'}
        right={
          <View style={s.headerRight}>
            <Badge label={isAdmin ? 'Admin' : user?.role === 'manager' ? 'Manager' : 'Cashier'} tone="outline" />
            <Avatar name={user?.name} size={40} />
          </View>
        }
        below={
          isAdmin && branches.length > 0 ? (
            <BranchSwitch label={branchName} onPress={() => setPickerOpen(true)} disabled={loading} />
          ) : undefined
        }
      />

      {loading ? (
        <SkeletonDashboard />
      ) : (
        <>
          <RevenueHero sales={sales} period={period} onPeriod={setPeriod} loading={salesLoading} />

          <View style={s.grid}>
            <StatTile
              label="Transactions"
              value={count(sales?.overview?.totalTransactions)}
              icon="receipt-outline"
            />
            <StatTile
              label="Average order"
              value={moneyCompact(sales?.overview?.averageTransaction)}
              icon="trending-up-outline"
            />
            <StatTile
              label="Discounts"
              value={discounts > 0 && discounts < 1000 ? `$${discounts.toFixed(2)}` : moneyCompact(discounts)}
              icon="pricetag-outline"
            />
            <StatTile
              label={isAdmin ? 'Branches' : 'Cash taken'}
              value={isAdmin ? String(branches.length) : moneyCompact(sales?.overview?.totalCashReceived)}
              icon={isAdmin ? 'business-outline' : 'cash-outline'}
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

          <View style={s.section}>
            <CardHeader
              title="Shifts"
              subtitle={shiftRows.length > 0 ? `${shiftRows.length} most recent` : undefined}
            />
            {shiftRows.length === 0 ? (
              <Card padded={false}>
                <EmptyState icon="time-outline" title="No shifts yet" message="Transactions appear here once a cashier opens a shift." />
              </Card>
            ) : (
              <List>
                {shiftRows.map(({ shift, tx }) => (
                  <ListRow
                    key={shift._id}
                    title={shift.cashierName || 'Cashier'}
                    leading={<Avatar name={shift.cashierName} size={40} tone="sunken" />}
                    badge={
                      <Badge
                        label={shift.status === 'open' ? 'Open' : 'Closed'}
                        tone={shift.status === 'open' ? 'solid' : 'outline'}
                        dot={shift.status === 'open'}
                      />
                    }
                    meta={[
                      ...(shiftBranchName(shift) ? [{ icon: 'business-outline' as const, text: shiftBranchName(shift) }] : []),
                      { icon: 'time-outline' as const, text: timeAgo(shift.openedAt) },
                    ]}
                    value={money(tx?.revenue)}
                    valueSub={plural(toNumber(tx?.orders), 'txn')}
                  />
                ))}
              </List>
            )}
          </View>
        </>
      )}

      {isAdmin && (
        <BranchSheet
          visible={pickerOpen}
          branches={branches}
          activeId={activeBranchId}
          onSelect={id => { if (id !== activeBranchId) switchBranch(id); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  chart: { marginTop: space.lg },
  section: { gap: space.md },
});

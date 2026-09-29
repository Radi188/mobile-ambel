import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar, Badge, Button, Card, CardHeader, Chips, DataRow, Divider, EmptyState,
  List, ListRow, Press, Screen, ScreenHeader, Sheet, SkeletonReport, StatTile, TextField,
} from '../../components/ui';
import { BarChart } from '../../components/charts/BarChart';
import { Sparkline } from '../../components/charts/Sparkline';
import { RankBar } from '../../components/charts/RankBar';
import { allTimeRange, reportsService, ReportFilter } from '../../services/reports.service';
import { branchesService } from '../../services/branches.service';
import { localDate } from '../../services/dashboard.service';
import { useAuth } from '../../context/AuthContext';
import {
  Branch, BranchReport, CashierReport, OrderSummaryReport, PaymentMethodsReport, ProductReport,
  SalesReport, SalesReportByMethod, ShiftReport,
} from '../../types/api.types';
import {
  colors, count, money2, moneyCompact, plural, radius, space, text, toNumber,
} from '../../constants/theme';

/**
 * Reports, in ambel-mobile's flow: pick a range (preset or custom), pick a
 * report, and each report loads on its own from the server's aggregation —
 * one failing endpoint shows its own retry instead of blanking the page.
 */

// ─── Tabs & ranges ────────────────────────────────────────────────────────────

type ReportTab = 'sales' | 'payments' | 'orders' | 'shifts' | 'products' | 'cashiers' | 'branches';

const TABS: { key: ReportTab; label: string; adminOnly?: boolean }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'payments', label: 'Payments' },
  { key: 'orders', label: 'Orders' },
  { key: 'shifts', label: 'Shifts' },
  { key: 'products', label: 'Products' },
  { key: 'cashiers', label: 'Cashiers' },
  { key: 'branches', label: 'Branches', adminOnly: true },
];

type PresetKey = 'today' | 'yesterday' | 'week' | 'month' | 'last30' | 'all' | 'custom';
type Range = { dateFrom: string; dateTo: string };

function presetRange(key: Exclude<PresetKey, 'custom'>): Range {
  if (key === 'all') return allTimeRange() as Range;
  const now = new Date();
  if (key === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { dateFrom: localDate(y), dateTo: localDate(y) };
  }
  const start = new Date(now);
  if (key === 'week') start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
  if (key === 'month') start.setDate(1);
  if (key === 'last30') start.setDate(now.getDate() - 30);
  return { dateFrom: localDate(start), dateTo: localDate(now) };
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

// ─── Formatting ───────────────────────────────────────────────────────────────

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

function shortDate(iso: string): string {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function longDate(iso: string): string {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function clock(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function duration(from: string, to?: string | null): string {
  const mins = Math.max(0, Math.floor(((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

function methodLabel(m: Pick<SalesReportByMethod, 'method' | 'methodCode' | 'methodName'>): string {
  if (m.methodName) return m.methodName;
  if (m.method === 'qr') return 'QR';
  const raw = m.method || m.methodCode || 'Other';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ─── Loading one report ───────────────────────────────────────────────────────

type ReportState<T> = { data: T | null; loading: boolean; error: string | null; reload: () => void };

/**
 * Fetch one report and re-fetch when its range, the branch or `version` (pull
 * to refresh) changes. `onSettled` tells the screen to stop its spinner.
 */
function useReport<T>(
  fetcher: (f: ReportFilter) => Promise<T>,
  range: Range,
  branchId: string | null,
  version: number,
  onSettled: () => void,
  allBranches = false,
): ReportState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRef.current({ ...range, allBranches })
      .then(result => { if (!cancelled) setData(result); })
      .catch((e: any) => { if (!cancelled) setError(e?.message ?? 'Failed to load'); })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        settledRef.current();
      });
    return () => { cancelled = true; };
  }, [range.dateFrom, range.dateTo, branchId, allBranches, version, retry]);

  return { data, loading, error, reload: () => setRetry(n => n + 1) };
}

type TabProps = { range: Range; branchId: string | null; version: number; onSettled: () => void; allBranches: boolean };

/** Loading / error / content, the same for every tab. */
function ReportBody<T>({ state, children }: { state: ReportState<T>; children: (data: T) => React.ReactNode }) {
  // Keep showing the previous figures while a refresh is in flight.
  if (state.loading && !state.data) return <SkeletonReport />;
  if (state.error && !state.data) {
    return (
      <Card padded={false}>
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't load this report"
          message={state.error}
          action={{ label: 'Retry', onPress: state.reload }}
        />
      </Card>
    );
  }
  if (!state.data) return null;
  return <>{children(state.data)}</>;
}

function Empty({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <Card padded={false}>
      <EmptyState icon={icon} title={title} message="Try a wider date range." />
    </Card>
  );
}

// ─── Shared pieces ────────────────────────────────────────────────────────────

/** Methods ranked by takings with their share — ambel-mobile's MethodList. */
function MethodBreakdown({ methods }: { methods: SalesReportByMethod[] }) {
  const sorted = [...methods].sort((a, b) => toNumber(b.total) - toNumber(a.total));
  const total = sorted.reduce((sum, m) => sum + toNumber(m.total), 0);
  const max = toNumber(sorted[0]?.total);
  return (
    <>
      {sorted.map((m, idx) => (
        <RankBar
          key={m.methodCode || m.method || String(idx)}
          rank={idx + 1}
          label={methodLabel(m)}
          sub={`${pct(toNumber(m.total), total)}% · ${plural(toNumber(m.count), 'txn')} · avg ${money2(toNumber(m.total) / (toNumber(m.count) || 1))}`}
          value={toNumber(m.total)}
          max={max}
          display={money2(m.total)}
        />
      ))}
    </>
  );
}

// ─── Sales ────────────────────────────────────────────────────────────────────

function SalesTab(props: TabProps) {
  const state = useReport(reportsService.getSales, props.range, props.branchId, props.version, props.onSettled, props.allBranches);
  const [visibleDays, setVisibleDays] = useState(7);

  return (
    <ReportBody state={state}>
      {(sales: SalesReport) => {
        const ov = sales.overview;
        const byDay = sales.byDay ?? [];
        const net = toNumber(ov.totalRevenue) - toNumber(sales.refunds.total);
        const bestDay = byDay.reduce<typeof byDay[number] | null>(
          (best, d) => (toNumber(d.revenue) > toNumber(best?.revenue ?? -1) ? d : best), null,
        );
        const dayTotal = byDay.reduce((sum, d) => sum + toNumber(d.revenue), 0);
        const dayTxns = byDay.reduce((sum, d) => sum + toNumber(d.transactions), 0);

        return (
          <>
            <View style={s.grid}>
              <StatTile label="Total revenue" value={money2(ov.totalRevenue)} sub={plural(toNumber(ov.totalTransactions), 'transaction')} icon="cash-outline" />
              <StatTile label="Net revenue" value={money2(net)} sub={toNumber(sales.refunds.count) > 0 ? `after ${plural(toNumber(sales.refunds.count), 'refund')}` : 'no refunds'} icon="wallet-outline" />
              <StatTile label="Avg transaction" value={money2(ov.averageTransaction)} icon="trending-up-outline" />
              <StatTile
                label="Best day"
                value={bestDay ? moneyCompact(bestDay.revenue) : '—'}
                sub={bestDay ? shortDate(bestDay.date) : undefined}
                icon="star-outline"
              />
            </View>

            {byDay.length > 0 && (
              <Card>
                <CardHeader title="Revenue by day" subtitle={plural(byDay.length, 'day')} />
                <View style={s.chart}>
                  {byDay.length <= 10 ? (
                    <BarChart data={byDay.map(d => ({ label: shortDate(d.date), value: toNumber(d.revenue) }))} height={150} />
                  ) : (
                    <>
                      <Sparkline values={byDay.map(d => toNumber(d.revenue))} height={90} />
                      <View style={s.axis}>
                        <Text style={text.micro}>{shortDate(byDay[0].date)}</Text>
                        <Text style={text.micro}>{shortDate(byDay[byDay.length - 1].date)}</Text>
                      </View>
                    </>
                  )}
                </View>
              </Card>
            )}

            {byDay.length > 0 && (
              <Card padded={false}>
                <View style={s.cardPad}><CardHeader title="Daily breakdown" subtitle="Most recent first" /></View>
                <List inset={false}>
                  {[...byDay].reverse().slice(0, visibleDays).map(day => (
                    <ListRow
                      key={day.date}
                      title={longDate(day.date)}
                      subtitle={plural(toNumber(day.transactions), 'txn')}
                      value={money2(day.revenue)}
                      compact
                    />
                  ))}
                </List>
                <View style={s.cardPad}>
                  <ShowMore shown={Math.min(visibleDays, byDay.length)} total={byDay.length} noun="days" onPress={() => setVisibleDays(n => n + 7)} />
                  <Divider />
                  <DataRow label="Total" sub={plural(dayTxns, 'txn')} value={money2(dayTotal)} strong />
                </View>
              </Card>
            )}

            <Card>
              <CardHeader title="Payment methods" subtitle="Share of takings" />
              {(sales.byMethod ?? []).length === 0
                ? <Text style={[text.small, s.muted]}>No payments in this period.</Text>
                : <View style={s.rankList}><MethodBreakdown methods={sales.byMethod} /></View>}
            </Card>

            <Card>
              <CardHeader title="Cash drawer" />
              <DataRow label="Cash received" value={money2(ov.totalCashReceived)} />
              <Divider />
              <DataRow label="Change given" value={money2(ov.totalChangeGiven)} />
              <Divider />
              <DataRow label="Refunds" sub={plural(toNumber(sales.refunds.count), 'refund')} value={money2(sales.refunds.total)} />
            </Card>
          </>
        );
      }}
    </ReportBody>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────

function PaymentsTab(props: TabProps) {
  const state = useReport(reportsService.getPaymentMethods, props.range, props.branchId, props.version, props.onSettled, props.allBranches);

  return (
    <ReportBody state={state}>
      {(report: PaymentMethodsReport) => {
        const branches = report.branches;
        if (branches.length === 0) return <Empty icon="card-outline" title="No payments in this period" />;

        const total = branches.reduce((sum, b) => sum + b.total, 0);
        const txns = branches.reduce((sum, b) => sum + b.transactions, 0);

        // The same method across branches, combined into one ranked list.
        const combined = new Map<string, SalesReportByMethod>();
        for (const b of branches) {
          for (const m of b.methods) {
            const key = m.methodCode || m.method;
            const cur = combined.get(key) ?? { ...m, total: 0, count: 0 };
            cur.total += toNumber(m.total);
            cur.count += toNumber(m.count);
            combined.set(key, cur);
          }
        }
        const methods = [...combined.values()];

        return (
          <>
            <View style={s.grid}>
              <StatTile label="Total revenue" value={money2(total)} sub={plural(branches.length, 'branch', 'branches')} icon="cash-outline" />
              <StatTile label="Transactions" value={count(txns)} icon="receipt-outline" />
              <StatTile label="Avg / txn" value={money2(txns > 0 ? total / txns : 0)} icon="trending-up-outline" />
              <StatTile label="Methods used" value={String(methods.length)} icon="card-outline" />
            </View>

            <Card>
              <CardHeader title="All payment methods" />
              <View style={s.rankList}><MethodBreakdown methods={methods} /></View>
            </Card>

            {branches.length > 1 && branches.map(b => (
              <Card key={b.branchId || b.branchName}>
                <CardHeader title={b.branchName || 'Branch'} subtitle={plural(b.transactions, 'txn')} right={<Text style={text.money}>{money2(b.total)}</Text>} />
                <View style={s.rankList}><MethodBreakdown methods={b.methods} /></View>
              </Card>
            ))}
          </>
        );
      }}
    </ReportBody>
  );
}

// ─── Orders ───────────────────────────────────────────────────────────────────

const STATUS_ORDER = ['completed', 'ready', 'preparing', 'pending', 'cancelled'];

function OrdersTab(props: TabProps) {
  const state = useReport(reportsService.getOrderSummary, props.range, props.branchId, props.version, props.onSettled, props.allBranches);

  return (
    <ReportBody state={state}>
      {(report: OrderSummaryReport) => {
        const ov = report.overview;
        const byStatus = [...(report.byStatus ?? [])].sort(
          (a, b) => (STATUS_ORDER.indexOf(a.status) + 99) % 99 - (STATUS_ORDER.indexOf(b.status) + 99) % 99,
        );
        const total = toNumber(ov.totalOrders);
        const completed = toNumber(byStatus.find(x => x.status === 'completed')?.count);
        const cancelled = toNumber(byStatus.find(x => x.status === 'cancelled')?.count);
        const maxCount = Math.max(...byStatus.map(x => toNumber(x.count)), 1);

        return (
          <>
            <View style={s.grid}>
              <StatTile label="Total orders" value={count(ov.totalOrders)} icon="receipt-outline" />
              <StatTile label="Total value" value={money2(ov.totalValue)} icon="cash-outline" />
              <StatTile
                label="Avg order"
                value={money2(ov.averageOrderValue)}
                sub={`${toNumber(ov.avgItemsPerOrder).toFixed(1)} items / order`}
                icon="trending-up-outline"
              />
              <StatTile
                label="Completion"
                value={`${pct(completed, total)}%`}
                sub={`${count(completed)} done · ${count(cancelled)} cancelled`}
                icon="checkmark-done-outline"
              />
            </View>

            <Card>
              <CardHeader title="Orders by status" />
              {byStatus.length === 0 ? (
                <Text style={[text.small, s.muted]}>No orders in this period.</Text>
              ) : (
                <View style={s.rankList}>
                  {byStatus.map(row => (
                    <RankBar
                      key={row.status}
                      label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      sub={`${count(row.count)} · ${pct(toNumber(row.count), total)}%`}
                      value={toNumber(row.count)}
                      max={maxCount}
                      display={money2(row.totalValue)}
                      rank={row.status === 'completed' ? 1 : 2}
                    />
                  ))}
                </View>
              )}
            </Card>
          </>
        );
      }}
    </ReportBody>
  );
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

function ShiftsTab(props: TabProps) {
  const state = useReport(reportsService.getShiftReport, props.range, props.branchId, props.version, props.onSettled, props.allBranches);
  const [visible, setVisible] = useState(8);

  return (
    <ReportBody state={state}>
      {(report: ShiftReport) => {
        const ov = report.overview;
        const shifts = report.shifts;
        return (
          <>
            <View style={s.grid}>
              <StatTile
                label="Shifts"
                value={count(ov.totalShifts)}
                sub={ov.openShifts > 0 ? `${ov.openShifts} still open` : 'all closed'}
                icon="time-outline"
              />
              <StatTile label="Revenue" value={money2(ov.totalRevenue)} icon="cash-outline" />
              <StatTile label="Cash sales" value={money2(ov.totalCashSales)} icon="wallet-outline" />
              <StatTile label="Expenses" value={money2(ov.totalExpenses)} sub={plural(ov.totalOrders, 'order')} icon="remove-circle-outline" />
            </View>

            {shifts.length === 0 ? (
              <Empty icon="time-outline" title="No shifts in this period" />
            ) : (
              shifts.slice(0, visible).map(row => <ShiftCard key={row.shiftId} row={row} />)
            )}

            <ShowMore shown={Math.min(visible, shifts.length)} total={shifts.length} noun="shifts" onPress={() => setVisible(n => n + 8)} />
          </>
        );
      }}
    </ReportBody>
  );
}

function ShiftCard({ row }: { row: ShiftReport['shifts'][number] }) {
  const closed = row.status === 'closed';
  const diff = toNumber(row.difference);
  const balanced = Math.abs(diff) < 0.01;
  const diffText = balanced ? 'Balanced' : diff > 0 ? `Over ${money2(Math.abs(diff))}` : `Short ${money2(Math.abs(diff))}`;

  return (
    <Card style={sc.card}>
      <View style={sc.top}>
        <Avatar name={row.cashierName} size={40} tone="sunken" />
        <View style={sc.who}>
          <Text style={text.bodyStrong} numberOfLines={1}>{row.cashierName}</Text>
          <Text style={text.caption} numberOfLines={1}>
            {[row.branchName, `${clock(row.openedAt)}${closed ? ` → ${clock(row.closedAt)}` : ''}`, duration(row.openedAt, row.closedAt)]
              .filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Badge label={closed ? 'Closed' : 'Open'} tone={closed ? 'outline' : 'solid'} dot={!closed} />
      </View>

      <View style={sc.stats}>
        <View style={sc.stat}><Text style={text.overline}>Revenue</Text><Text style={text.money}>{money2(row.revenue)}</Text></View>
        <View style={sc.stat}><Text style={text.overline}>Orders</Text><Text style={text.money}>{count(row.orders)}</Text></View>
        <View style={sc.stat}><Text style={text.overline}>Cash sales</Text><Text style={text.money}>{money2(row.cashSales)}</Text></View>
      </View>

      <View style={sc.cash}>
        <Text style={[text.caption, sc.cashText]} numberOfLines={2}>
          Open {money2(row.openingCash)} → Close {closed ? money2(row.closingCash) : '—'}
          {row.expenses > 0 ? ` · Expenses −${money2(row.expenses)}` : ''}
        </Text>
        {closed && row.difference != null && (
          <Badge label={diffText} tone={balanced ? 'outline' : 'solid'} />
        )}
      </View>
    </Card>
  );
}

const sc = StyleSheet.create({
  card: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  who: { flex: 1, gap: 2 },
  stats: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
  },
  stat: { flex: 1, gap: 3 },
  cash: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  cashText: { flex: 1 },
});

// ─── Products ─────────────────────────────────────────────────────────────────

function ProductsTab(props: TabProps) {
  const state = useReport(reportsService.getProducts, props.range, props.branchId, props.version, props.onSettled, props.allBranches);

  return (
    <ReportBody state={state}>
      {(products: ProductReport) => {
        const top = products.topProducts ?? [];
        const bottom = products.bottomProducts ?? [];
        const categories = [...(products.byCategory ?? [])].sort((a, b) => toNumber(b.totalRevenue) - toNumber(a.totalRevenue));
        if (top.length === 0 && categories.length === 0) return <Empty icon="cube-outline" title="No product sales in this period" />;

        const maxTop = Math.max(...top.map(p => toNumber(p.totalRevenue)), 1);
        const maxCat = Math.max(...categories.map(c => toNumber(c.totalRevenue)), 1);
        const units = top.reduce((sum, p) => sum + toNumber(p.totalQuantity), 0);
        const revenue = top.reduce((sum, p) => sum + toNumber(p.totalRevenue), 0);

        return (
          <>
            <View style={s.grid}>
              <StatTile label="Top items revenue" value={money2(revenue)} icon="cash-outline" />
              <StatTile label="Units sold" value={count(units)} icon="cube-outline" />
            </View>

            <Card>
              <CardHeader title="Top products" subtitle="By revenue" />
              <View style={s.rankList}>
                {top.map((p, idx) => (
                  <RankBar
                    key={p.productId || String(idx)}
                    rank={idx + 1}
                    label={p.productName || 'Item'}
                    sub={[p.categoryName, `${count(p.totalQuantity)} sold`].filter(Boolean).join(' · ')}
                    value={toNumber(p.totalRevenue)}
                    max={maxTop}
                    display={money2(p.totalRevenue)}
                  />
                ))}
              </View>
            </Card>

            {categories.length > 0 && (
              <Card>
                <CardHeader title="By category" />
                <View style={s.rankList}>
                  {categories.map((c, idx) => (
                    <RankBar
                      key={c.categoryId || c.categoryName}
                      rank={idx + 1}
                      label={c.categoryName || 'Uncategorised'}
                      sub={`${count(c.totalQuantity)} sold`}
                      value={toNumber(c.totalRevenue)}
                      max={maxCat}
                      display={money2(c.totalRevenue)}
                    />
                  ))}
                </View>
              </Card>
            )}

            {bottom.length > 0 && (
              <Card padded={false}>
                <View style={s.cardPad}><CardHeader title="Slow movers" subtitle="Fewest sold in this period" /></View>
                <List inset={false}>
                  {bottom.map((p, idx) => (
                    <ListRow
                      key={p.productId || String(idx)}
                      title={p.productName || 'Item'}
                      subtitle={p.categoryName}
                      value={money2(p.totalRevenue)}
                      valueSub={`${count(p.totalQuantity)} sold`}
                      compact
                    />
                  ))}
                </List>
              </Card>
            )}
          </>
        );
      }}
    </ReportBody>
  );
}

// ─── Cashiers ─────────────────────────────────────────────────────────────────

function CashiersTab(props: TabProps) {
  const state = useReport(reportsService.getCashiers, props.range, props.branchId, props.version, props.onSettled, props.allBranches);

  return (
    <ReportBody state={state}>
      {(report: CashierReport) => {
        const cashiers = [...(report.cashiers ?? [])].sort((a, b) => toNumber(b.totalRevenue) - toNumber(a.totalRevenue));
        if (cashiers.length === 0) return <Empty icon="people-outline" title="No cashier activity in this period" />;
        const revenue = cashiers.reduce((sum, c) => sum + toNumber(c.totalRevenue), 0);
        const orders = cashiers.reduce((sum, c) => sum + toNumber(c.totalOrders), 0);

        return (
          <>
            <View style={s.grid}>
              <StatTile label="Team revenue" value={money2(revenue)} icon="cash-outline" />
              <StatTile label="Orders taken" value={count(orders)} icon="receipt-outline" />
            </View>
            <List>
              {cashiers.map((c, idx) => (
                <ListRow
                  key={`${c.cashierName}-${idx}`}
                  title={c.cashierName || 'Cashier'}
                  leading={<Avatar name={c.cashierName} size={42} tone={idx === 0 ? 'solid' : 'sunken'} />}
                  badge={idx === 0 ? <Badge label="Top" tone="solid" /> : undefined}
                  meta={[
                    { icon: 'receipt-outline', text: plural(toNumber(c.totalOrders), 'order') },
                    { icon: 'trending-up-outline', text: `avg ${money2(c.averageOrderValue)}` },
                  ]}
                  value={money2(c.totalRevenue)}
                />
              ))}
            </List>
          </>
        );
      }}
    </ReportBody>
  );
}

// ─── Branches (admin) ─────────────────────────────────────────────────────────

function BranchesTab(props: TabProps) {
  const state = useReport(reportsService.getBranches, props.range, props.branchId, props.version, props.onSettled, props.allBranches);

  return (
    <ReportBody state={state}>
      {(report: BranchReport) => {
        const branches = [...(report.branches ?? [])].sort((a, b) => toNumber(b.revenue) - toNumber(a.revenue));
        if (branches.length === 0) return <Empty icon="business-outline" title="No branch data in this period" />;
        const revenue = branches.reduce((sum, b) => sum + toNumber(b.revenue), 0);
        const orders = branches.reduce((sum, b) => sum + toNumber(b.totalOrders), 0);
        const txns = branches.reduce((sum, b) => sum + toNumber(b.transactions), 0);
        const max = Math.max(...branches.map(b => toNumber(b.revenue)), 1);

        return (
          <>
            <View style={s.grid}>
              <StatTile label="Total revenue" value={money2(revenue)} sub={`across ${plural(branches.length, 'branch', 'branches')}`} icon="cash-outline" />
              <StatTile label="Total orders" value={count(orders)} icon="receipt-outline" />
              <StatTile label="Branches" value={String(branches.length)} icon="business-outline" />
              <StatTile label="Transactions" value={count(txns)} icon="swap-horizontal-outline" />
            </View>
            <Card>
              <CardHeader title="Revenue by branch" subtitle="Every branch, not just the one selected" />
              <View style={s.rankList}>
                {branches.map((b, idx) => (
                  <RankBar
                    key={b.branchId || b.branchName}
                    rank={idx + 1}
                    label={b.branchName || 'Branch'}
                    sub={plural(toNumber(b.totalOrders), 'order')}
                    value={toNumber(b.revenue)}
                    max={max}
                    display={money2(b.revenue)}
                  />
                ))}
              </View>
            </Card>
          </>
        );
      }}
    </ReportBody>
  );
}

// ─── Custom range sheet ───────────────────────────────────────────────────────

const isValidDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// Keeps typing in YYYY-MM-DD shape without a native picker dependency.
function formatInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return digits;
}

function RangeSheet({ visible, current, onApply, onClose }: {
  visible: boolean;
  current: Range;
  onApply: (r: Range) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(current.dateFrom);
  const [to, setTo] = useState(current.dateTo);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setFrom(current.dateFrom);
    setTo(current.dateTo);
    setProblem(null);
  }, [visible]);

  const apply = () => {
    if (!isValidDate(from) || !isValidDate(to)) { setProblem('Use the YYYY-MM-DD format, e.g. 2026-01-31.'); return; }
    if (from > to) { setProblem('The start date is after the end date.'); return; }
    onApply({ dateFrom: from, dateTo: to });
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Custom range"
      subtitle="Every report follows this range"
      footer={<Button label="Apply" size="lg" style={s.flex} onPress={apply} />}
    >
      <View style={s.dates}>
        <TextField
          label="From"
          value={from}
          onChangeText={v => setFrom(formatInput(v))}
          placeholder="YYYY-MM-DD"
          keyboardType="number-pad"
          icon="calendar-outline"
          maxLength={10}
          style={s.flex}
        />
        <TextField
          label="To"
          value={to}
          onChangeText={v => setTo(formatInput(v))}
          placeholder="YYYY-MM-DD"
          keyboardType="number-pad"
          icon="calendar-outline"
          maxLength={10}
          style={s.flex}
        />
      </View>
      {!!problem && <Text style={[text.caption, s.problem]}>{problem}</Text>}
    </Sheet>
  );
}

// ─── Small bits ───────────────────────────────────────────────────────────────

/** Aggregates come back whole, so long lists reveal more rows locally. */
function ShowMore({ shown, total, onPress, noun }: { shown: number; total: number; onPress: () => void; noun: string }) {
  if (shown >= total) return null;
  return (
    <Press onPress={onPress} scaleTo={0.97} style={s.showMore}>
      <Text style={text.smallStrong}>Show more</Text>
      <Text style={text.micro}>{shown} of {total} {noun}</Text>
    </Press>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const { user, activeBranchId, switchBranch } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [tab, setTab] = useState<ReportTab>('sales');
  const [preset, setPreset] = useState<PresetKey>('month');
  const [range, setRange] = useState<Range>(() => presetRange('month'));
  const [rangeOpen, setRangeOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchOpen, setBranchOpen] = useState(false);
  // Admins start on every branch combined, as in ambel-mobile.
  const [allBranches, setAllBranches] = useState(isAdmin);
  const scopeAll = isAdmin && allBranches;
  const branchName = scopeAll
    ? 'All branches'
    : branches.find(b => b._id === activeBranchId)?.name ?? 'Select branch';

  const tabs = useMemo(() => TABS.filter(t => !t.adminOnly || isAdmin), [isAdmin]);

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

  const choosePreset = (key: PresetKey) => {
    if (key === 'custom') { setRangeOpen(true); return; }
    setPreset(key);
    setRange(presetRange(key));
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setVersion(v => v + 1);
  }, []);
  const onSettled = useCallback(() => setRefreshing(false), []);

  const presetOptions = PRESETS.map(p => (
    p.key === 'custom' && preset === 'custom'
      ? { key: p.key, label: `${shortDate(range.dateFrom)} – ${shortDate(range.dateTo)}` }
      : p
  ));

  const tabProps: TabProps = { range, branchId: activeBranchId, version, onSettled, allBranches: scopeAll };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader
        subtitle={isAdmin ? 'Performance' : 'Your branch'}
        title="Reports"
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

      <View style={s.controls}>
        <Chips options={presetOptions} value={preset} onChange={choosePreset} />
        <Chips options={tabs} value={tab} onChange={setTab} />
      </View>

      {tab === 'sales' && <SalesTab {...tabProps} />}
      {tab === 'payments' && <PaymentsTab {...tabProps} />}
      {tab === 'orders' && <OrdersTab {...tabProps} />}
      {tab === 'shifts' && <ShiftsTab {...tabProps} />}
      {tab === 'products' && <ProductsTab {...tabProps} />}
      {tab === 'cashiers' && <CashiersTab {...tabProps} />}
      {tab === 'branches' && isAdmin && <BranchesTab {...tabProps} />}

      <RangeSheet
        visible={rangeOpen}
        current={range}
        onApply={r => { setPreset('custom'); setRange(r); }}
        onClose={() => setRangeOpen(false)}
      />

      {isAdmin && (
        <Sheet visible={branchOpen} onClose={() => setBranchOpen(false)} title="Branch">
          <List>
            <ListRow
              title="All branches"
              subtitle={`Every location combined · ${plural(branches.length, 'branch', 'branches')}`}
              leading={<Avatar icon="layers" size={38} tone={scopeAll ? 'solid' : 'sunken'} />}
              badge={scopeAll ? <Badge label="Active" tone="solid" /> : undefined}
              onPress={() => { setAllBranches(true); setBranchOpen(false); }}
            />
            {branches.map(branch => (
              <ListRow
                key={branch._id}
                title={branch.name}
                subtitle={branch.address}
                leading={<Avatar icon="business" size={38} tone={!scopeAll && branch._id === activeBranchId ? 'solid' : 'sunken'} />}
                badge={!scopeAll && branch._id === activeBranchId ? <Badge label="Active" tone="solid" /> : undefined}
                onPress={() => { setAllBranches(false); switchBranch(branch._id); setBranchOpen(false); }}
              />
            ))}
          </List>
        </Sheet>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  controls: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  chart: { marginTop: space.lg },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  rankList: { marginTop: space.md },
  muted: { marginTop: space.md },
  cardPad: { padding: space.xl, paddingBottom: space.md, gap: space.md },
  flex: { flex: 1 },
  dates: { flexDirection: 'row', gap: space.md },
  problem: { color: colors.text, fontWeight: '600', marginTop: space.md },
  showMore: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
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

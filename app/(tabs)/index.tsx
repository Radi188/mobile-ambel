import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboard.service';
import { SalesReport, Order, Branch, Payment, PaymentMethod } from '../../types/api.types';

// ─── Tokens ────────────────────────────────────────────────────────────────────

const C = {
  bg:       '#F5F4F0',
  card:     '#FFFFFF',
  hero:     '#0D0D0D',
  border:   '#EBEBEB',
  text:     '#111111',
  textSub:  '#888888',
  textDim:  '#BBBBBB',
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#92600A', bg: '#FEF3C7' },
  preparing: { label: 'Preparing', color: '#1D4ED8', bg: '#DBEAFE' },
  ready:     { label: 'Ready',     color: '#065F46', bg: '#D1FAE5' },
  completed: { label: 'Completed', color: '#374151', bg: '#F3F4F6' },
  cancelled: { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function safeNum(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function fmt(n: unknown, compact = false): string {
  const safe = safeNum(n);
  if (compact) {
    if (safe >= 1_000_000) return `$${(safe / 1_000_000).toFixed(1)}M`;
    if (safe >= 1_000)     return `$${(safe / 1_000).toFixed(1)}k`;
    return `$${safe.toFixed(0)}`;
  }
  return `$${safe.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Revenue period filter ───────────────────────────────────────────────────────

type Period = 'month' | 'lastMonth' | 'total';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'month',     label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'total',     label: 'Total' },
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

function branchName(order: Order): string {
  const b = order.branch;
  return typeof b === 'object' && b ? b.name : '';
}

function itemCount(order: Order): number {
  return (order.items ?? []).reduce((sum, it) => sum + safeNum(it.quantity), 0);
}

const PAYMENT_META: Record<PaymentMethod, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  cash: { label: 'Cash', icon: 'cash-outline' },
  card: { label: 'Card', icon: 'card-outline' },
  qr:   { label: 'QR',   icon: 'qr-code-outline' },
};

// ─── Hero Card ─────────────────────────────────────────────────────────────────

function HeroCard({ sales, period, onPeriod, loading }: {
  sales: SalesReport | null;
  period: Period;
  onPeriod: (p: Period) => void;
  loading: boolean;
}) {
  const methodTotals: Record<string, number> = {};
  (sales?.byMethod ?? []).forEach((m) => { methodTotals[m.method] = m.total; });
  const pm = {
    cash: methodTotals.cash ?? 0,
    card: methodTotals.card ?? 0,
    qr: methodTotals.qr ?? 0,
  };
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? '';
  return (
    <View style={s.hero}>
      <View style={s.heroTabs}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              style={[s.heroTab, active && s.heroTabActive]}
              onPress={() => onPeriod(p.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.heroTabText, active && s.heroTabTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.heroLabelRow}>
        <Text style={s.heroLabel}>TOTAL REVENUE</Text>
        {loading && <ActivityIndicator size="small" color="#5A5A5A" />}
      </View>
      <Text style={s.heroValue}>{fmt(sales?.overview?.totalRevenue ?? 0)}</Text>
      <Text style={s.heroPeriod}>{periodLabel}</Text>
      <View style={s.heroChips}>
        {([['Cash', pm.cash], ['Card', pm.card], ['QR', pm.qr]] as [string, number][]).map(
          ([key, val]) => (
            <View key={key} style={s.heroChip}>
              <Text style={s.heroChipLabel}>{key}</Text>
              <Text style={s.heroChipVal}>{fmt(val, true)}</Text>
            </View>
          )
        )}
      </View>
    </View>
  );
}

// ─── Mini Stat ─────────────────────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.miniCard}>
      <Text style={s.miniLabel}>{label}</Text>
      <Text style={s.miniValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

// ─── Week Chart ────────────────────────────────────────────────────────────────

function WeekChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={s.chartWrap}>
      {data.map((bar, i) => {
        const pct = (bar.value / max) * 100;
        const isTop = bar.value === max;
        return (
          <View key={i} style={s.barCol}>
            <Text style={s.barValLabel}>
              {bar.value > 0 ? fmt(bar.value, true) : ''}
            </Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, { height: `${Math.max(pct, 3)}%` }, isTop && s.barFillDark]} />
            </View>
            <Text style={s.barDayLabel}>{bar.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Branch Bars ───────────────────────────────────────────────────────────────

function BranchBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={s.branchList}>
      {data.map((b, i) => (
        <View key={i} style={s.branchRow}>
          <Text style={s.branchName} numberOfLines={1}>{b.label}</Text>
          <View style={s.branchTrack}>
            <View style={[s.branchFill, { width: `${(b.value / max) * 100}%` }]} />
          </View>
          <Text style={s.branchVal}>{fmt(b.value, true)}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Order Row ─────────────────────────────────────────────────────────────────

function MetaItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.metaItem}>
      <Ionicons name={icon} size={12} color={C.textSub} />
      <Text style={s.metaText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function OrderRow({ order, method, isLast }: { order: Order; method?: PaymentMethod; isLast: boolean }) {
  const st = STATUS_MAP[order.status] ?? STATUS_MAP.pending;
  const branch = branchName(order);
  const count = itemCount(order);
  const pay = method ? PAYMENT_META[method] : null;

  return (
    <View style={[s.orderRow, !isLast && s.orderRowBorder]}>
      <View style={s.orderLeft}>
        <View style={s.orderTopLine}>
          <Text style={s.orderName} numberOfLines={1}>{order.customerName || 'Walk-in'}</Text>
          <View style={[s.statusChip, { backgroundColor: st.bg }]}>
            <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        {!!order.orderNumber && <Text style={s.orderNumber}>#{order.orderNumber}</Text>}

        <View style={s.orderMeta}>
          {!!branch && <MetaItem icon="business-outline" text={branch} />}
          {!!order.cashierName && <MetaItem icon="person-outline" text={order.cashierName} />}
        </View>

        <View style={s.orderMeta}>
          <MetaItem icon="cube-outline" text={`${count} item${count === 1 ? '' : 's'}`} />
          {pay && <MetaItem icon={pay.icon} text={pay.label} />}
          <MetaItem icon="time-outline" text={timeAgo(order.createdAt)} />
        </View>
      </View>
      <Text style={s.orderAmt}>{fmt(order.total)}</Text>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [refreshing, setRefreshing]       = useState(false);
  const [loading, setLoading]             = useState(true);
  const [sales, setSales]                 = useState<SalesReport | null>(null);
  const [period, setPeriod]               = useState<Period>('total');
  const [salesLoading, setSalesLoading]   = useState(false);
  const [activeBranches, setActiveBranches] = useState<Branch[]>([]);
  const [recentOrders, setRecentOrders]   = useState<Order[]>([]);
  const [totalDiscounts, setTotalDiscounts] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, PaymentMethod>>({});
  const [weeklyData, setWeeklyData]       = useState<{ label: string; value: number }[]>([]);
  const [branchData, setBranchData]       = useState<{ label: string; value: number }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const range = periodRange(period);
      const tasks: Promise<any>[] = [
        dashboardService.getSalesReport(range.dateFrom, range.dateTo),
        dashboardService.getRecentOrders(),
        dashboardService.getWeeklyRevenue(),
        dashboardService.getRecentPayments(),
      ];
      if (isAdmin) {
        tasks.push(dashboardService.getBranchReport());
        tasks.push(dashboardService.getActiveBranches());
      }
      const [salesData, orders, weekly, payments, branchReport, branches] = await Promise.all(tasks);
      setSales(salesData);
      setRecentOrders((orders ?? []).slice(0, 5));

      // Total discount given across all orders in the period
      setTotalDiscounts(
        (orders ?? []).reduce((sum: number, o: Order) => sum + safeNum(o.discountAmount), 0)
      );

      // Map each order id → its paid payment method
      const methodMap: Record<string, PaymentMethod> = {};
      (payments ?? []).forEach((p: Payment) => {
        const orderId = typeof p.order === 'object' && p.order ? p.order._id : (p.order as string);
        if (orderId && p.status === 'paid') methodMap[orderId] = p.method;
      });
      setPaymentMethods(methodMap);

      setWeeklyData(weekly);
      if (isAdmin) {
        setBranchData(
          (branchReport?.branches ?? []).map((b: any) => ({
            label: b.branchName ?? 'Unknown',
            value: safeNum(b.revenue),
          }))
        );
        setActiveBranches(branches ?? []);
      }
    } catch {
      // keep previous data on error
    }
  }, [isAdmin, period]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  // Refetch only the revenue report when the period tab changes (skip first mount)
  const periodMounted = useRef(false);
  useEffect(() => {
    if (!periodMounted.current) { periodMounted.current = true; return; }
    let cancelled = false;
    setSalesLoading(true);
    const { dateFrom, dateTo } = periodRange(period);
    dashboardService
      .getSalesReport(dateFrom, dateTo)
      .then((data) => { if (!cancelled) setSales(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSalesLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const overview = sales?.overview;
  const avgOrder = safeNum(overview?.averageTransaction);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textDim} />
        }
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{greeting()}</Text>
            <Text style={s.name}>{user?.name ?? 'Dashboard'}</Text>
          </View>
          <View style={s.headerRight}>
            <View style={s.roleBadge}>
              <Text style={s.roleBadgeText}>{isAdmin ? 'ADMIN' : 'MANAGER'}</Text>
            </View>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{(user?.name?.[0] ?? 'A').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={s.loader}>
            <ActivityIndicator size="large" color={C.textDim} />
            <Text style={s.loaderText}>Loading dashboard…</Text>
          </View>
        ) : (
          <>
            {/* ── Hero Revenue ── */}
            <HeroCard sales={sales} period={period} onPeriod={setPeriod} loading={salesLoading} />

            {/* ── Stats Grid ── */}
            <View style={s.grid}>
              <MiniStat label="Transactions" value={(overview?.totalTransactions ?? 0).toLocaleString()} />
              <MiniStat label="Avg. Order" value={fmt(avgOrder)} />
              <MiniStat
                label="Discounts"
                value={
                  totalDiscounts > 0 && totalDiscounts < 1000
                    ? `$${totalDiscounts.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : fmt(totalDiscounts, true)
                }
              />
              {isAdmin
                ? <MiniStat label="Branches" value={String(activeBranches.length)} />
                : <MiniStat label="Branch" value="Active" />
              }
            </View>

            {/* ── Weekly Revenue ── */}
            {weeklyData.length > 0 && (
              <View style={s.card}>
                <View style={s.cardHead}>
                  <Text style={s.cardTitle}>Revenue · Last 7 Days</Text>
                </View>
                <WeekChart data={weeklyData} />
              </View>
            )}

            {/* ── Branch Revenue (Admin only) ── */}
            {isAdmin && branchData.length > 0 && (
              <View style={s.card}>
                <View style={s.cardHead}>
                  <Text style={s.cardTitle}>Branch Revenue</Text>
                  <Text style={s.cardSub}>{branchData.length} branches</Text>
                </View>
                <BranchBars data={branchData} />
              </View>
            )}

            {/* ── Recent Orders ── */}
            {recentOrders.length > 0 && (
              <View style={s.card}>
                <View style={s.cardHead}>
                  <Text style={s.cardTitle}>Recent Orders</Text>
                  <Text style={s.cardSub}>{recentOrders.length} shown</Text>
                </View>
                {recentOrders.map((order, i) => (
                  <OrderRow
                    key={order._id}
                    order={order}
                    method={paymentMethods[order._id]}
                    isLast={i === recentOrders.length - 1}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 48, gap: 14 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  greeting: { fontSize: 13, color: C.textSub },
  name:     { fontSize: 24, fontWeight: '700', color: C.text, letterSpacing: -0.5, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: C.text,
    borderRadius: 5,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1.5 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.text,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Loader
  loader:     { alignItems: 'center', paddingTop: 64, gap: 12 },
  loaderText: { fontSize: 13, color: C.textDim },

  // Hero
  hero: {
    backgroundColor: C.hero,
    borderRadius: 22,
    padding: 24,
    gap: 4,
  },
  heroTabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 11,
    padding: 4,
    marginBottom: 16,
  },
  heroTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  heroTabActive: { backgroundColor: '#FFFFFF' },
  heroTabText: { fontSize: 12, fontWeight: '600', color: '#7A7A7A' },
  heroTabTextActive: { color: '#0D0D0D' },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLabel:  { fontSize: 10, fontWeight: '700', color: '#4A4A4A', letterSpacing: 2.5 },
  heroValue:  {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
    marginTop: 4,
    marginBottom: 2,
  },
  heroPeriod: { fontSize: 13, color: '#4A4A4A', marginBottom: 10 },
  heroChips:  { flexDirection: 'row', gap: 8, marginTop: 6 },
  heroChip: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
  },
  heroChipLabel: { fontSize: 10, color: '#4A4A4A', fontWeight: '600', letterSpacing: 0.3 },
  heroChipVal:   { fontSize: 14, color: '#EDE9E3', fontWeight: '700' },

  // Stats grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  miniCard: {
    width: '47.5%',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  miniLabel: {
    fontSize: 11,
    color: C.textSub,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  miniValue: { fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: -0.8 },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: C.text, letterSpacing: -0.2 },
  cardSub:   { fontSize: 12, color: C.textDim, fontWeight: '500' },

  // Week chart
  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 5 },
  barCol:    { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValLabel: {
    fontSize: 8,
    color: C.textDim,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#EEEDE9',
  },
  barFill:      { width: '100%', backgroundColor: '#D0CFC9', borderRadius: 8 },
  barFillDark:  { backgroundColor: C.hero },
  barDayLabel:  { marginTop: 6, fontSize: 10, color: C.textSub, fontWeight: '500' },

  // Branch bars
  branchList: { gap: 14 },
  branchRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  branchName: { fontSize: 13, color: C.text, fontWeight: '500', width: 76 },
  branchTrack: {
    flex: 1,
    height: 7,
    backgroundColor: '#EEEDE9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  branchFill: { height: '100%', backgroundColor: C.hero, borderRadius: 4 },
  branchVal:  { fontSize: 12, fontWeight: '600', color: C.textSub, width: 46, textAlign: 'right' },

  // Orders
  orderRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, gap: 12 },
  orderRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F4F0' },
  orderLeft:   { flex: 1, gap: 6 },
  orderTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderName:   { fontSize: 14, fontWeight: '600', color: C.text, flexShrink: 1 },
  orderNumber: { fontSize: 11, color: C.textDim, fontWeight: '600', letterSpacing: 0.3 },
  orderMeta:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '60%' },
  metaText:    { fontSize: 12, color: C.textSub, fontWeight: '500', flexShrink: 1 },
  statusChip:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  statusText:  { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
  orderAmt:    { fontSize: 15, fontWeight: '700', color: C.text, marginTop: 1 },
});

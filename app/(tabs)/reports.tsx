import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { SectionHeader } from '../../components/SectionHeader';
import { reportsService, ReportFilter } from '../../services/reports.service';
import { useAuth } from '../../context/AuthContext';
import {
  SalesReport, ProductReport, CashierReport, BranchReport,
} from '../../types/api.types';

type ReportTab = 'sales' | 'products' | 'cashiers' | 'branches';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: number | undefined | null): number {
  return v ?? 0;
}

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

type Preset = { label: string; from: string; to: string };

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
    { label: 'Today', from: today, to: today },
    { label: 'This Week', from: toISO(weekStart), to: today },
    { label: 'This Month', from: toISO(monthStart), to: toISO(monthEnd) },
    { label: 'Last Month', from: toISO(lastMonthStart), to: toISO(lastMonthEnd) },
  ];
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

function StatRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.statRow, !isLast && styles.statRowBorder]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ProgressRow({ label, sub, value, max, suffix = '' }: {
  label: string; sub?: string; value: number; max: number; suffix?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.progressLabel} numberOfLines={1}>{label}</Text>
          {sub ? <Text style={styles.progressSub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        <Text style={styles.progressValue}>{suffix}{num(value).toLocaleString()}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` }]} />
      </View>
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="bar-chart-outline" size={36} color={Colors.gray300} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

// ─── Date Input ──────────────────────────────────────────────────────────────

function DateInput({ label, value, onChange, error }: {
  label: string; value: string; onChange: (v: string) => void; error?: boolean;
}) {
  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let f = digits;
    if (digits.length > 4) f = digits.slice(0, 4) + '-' + digits.slice(4);
    if (digits.length > 6) f = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6);
    onChange(f);
  };
  return (
    <View style={styles.dateInputWrap}>
      <Text style={styles.dateInputLabel}>{label}</Text>
      <View style={[styles.dateInputBox, error && styles.dateInputBoxErr]}>
        <Ionicons name="calendar-outline" size={16} color={error ? '#EF4444' : Colors.gray500} />
        <TextInput
          style={styles.dateInputText}
          value={value}
          onChangeText={handleChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.gray400}
          keyboardType="number-pad"
          maxLength={10}
          selectionColor={Colors.gray900}
        />
      </View>
    </View>
  );
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────

function FilterModal({ visible, current, onApply, onClose }: {
  visible: boolean; current: ReportFilter;
  onApply: (f: ReportFilter) => void; onClose: () => void;
}) {
  const [from, setFrom] = useState(current.dateFrom ?? '');
  const [to, setTo] = useState(current.dateTo ?? '');
  const [fromErr, setFromErr] = useState(false);
  const [toErr, setToErr] = useState(false);
  const presets = useMemo(() => buildPresets(), []);

  useEffect(() => {
    if (visible) {
      setFrom(current.dateFrom ?? '');
      setTo(current.dateTo ?? '');
      setFromErr(false);
      setToErr(false);
    }
  }, [visible]);

  const applyPreset = (p: Preset) => {
    setFrom(p.from); setTo(p.to);
    setFromErr(false); setToErr(false);
  };

  const handleApply = () => {
    const fe = from !== '' && !isValidDate(from);
    const te = to !== '' && !isValidDate(to);
    setFromErr(fe); setToErr(te);
    if (fe || te) return;
    onApply({ dateFrom: from || undefined, dateTo: to || undefined });
    onClose();
  };

  const handleClear = () => {
    setFrom(''); setTo('');
    onApply({});
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Filter by Date</Text>
        <View style={styles.presetRow}>
          {presets.map((p) => {
            const active = from === p.from && to === p.to;
            return (
              <TouchableOpacity
                key={p.label}
                style={[styles.presetBtn, active && styles.presetBtnActive]}
                onPress={() => applyPreset(p)}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetText, active && styles.presetTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.dividerLine} />
        <Text style={styles.customLabel}>Custom Range</Text>
        <View style={styles.dateRow}>
          <DateInput label="From" value={from} onChange={setFrom} error={fromErr} />
          <View style={styles.dateArrow}>
            <Ionicons name="arrow-forward" size={14} color={Colors.gray400} />
          </View>
          <DateInput label="To" value={to} onChange={setTo} error={toErr} />
        </View>
        {(fromErr || toErr) && (
          <Text style={styles.errHint}>Use YYYY-MM-DD format (e.g. 2025-01-31)</Text>
        )}
        <View style={styles.sheetActions}>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.7}>
            <Text style={styles.clearBtnText}>Clear Filter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.7}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Tab Sections ─────────────────────────────────────────────────────────────

function SalesTab({ sales }: { sales: SalesReport }) {
  const totalRevenue = num(sales.overview?.totalRevenue);

  // Build a lookup for byMethod
  const methodMap = useMemo(() => {
    const m: Record<string, { total: number; count: number }> = {};
    (sales.byMethod ?? []).forEach((r) => { m[r.method] = r; });
    return m;
  }, [sales.byMethod]);

  return (
    <>
      <View style={styles.card}>
        <SectionHeader title="Overview" />
        <StatRow label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} />
        <StatRow label="Total Transactions" value={num(sales.overview?.totalTransactions).toLocaleString()} />
        <StatRow label="Avg. Transaction" value={`$${num(sales.overview?.averageTransaction).toFixed(2)}`} />
        <StatRow label="Cash Received" value={`$${num(sales.overview?.totalCashReceived).toLocaleString()}`} />
        <StatRow label="Change Given" value={`$${num(sales.overview?.totalChangeGiven).toLocaleString()}`} isLast />
      </View>

      <View style={styles.card}>
        <SectionHeader title="By Payment Method" />
        {(['cash', 'card', 'qr'] as const).map((m, i, arr) => {
          const entry = methodMap[m];
          return (
            <StatRow
              key={m}
              label={`${m.toUpperCase()}${entry ? ` (${entry.count} txn)` : ''}`}
              value={`$${num(entry?.total).toLocaleString()}`}
              isLast={i === arr.length - 1}
            />
          );
        })}
      </View>

      {num(sales.refunds?.count) > 0 && (
        <View style={styles.card}>
          <SectionHeader title="Refunds" />
          <StatRow label="Total Refunded" value={`$${num(sales.refunds?.total).toLocaleString()}`} />
          <StatRow label="Refund Count" value={num(sales.refunds?.count).toLocaleString()} isLast />
        </View>
      )}

      {(sales.byDay ?? []).length > 0 && (
        <View style={styles.card}>
          <SectionHeader title="Daily Breakdown" />
          {[...(sales.byDay ?? [])].reverse().slice(0, 7).map((d, i, arr) => (
            <StatRow
              key={d.date}
              label={formatDisplay(d.date)}
              value={`$${num(d.revenue).toLocaleString()} · ${d.transactions} txn`}
              isLast={i === arr.length - 1}
            />
          ))}
        </View>
      )}
    </>
  );
}

function ProductsTab({ products }: { products: ProductReport }) {
  const items = products.topProducts ?? [];
  const maxRevenue = items.reduce((mx, p) => Math.max(mx, num(p.totalRevenue)), 0);
  const totalRevenue = items.reduce((s, p) => s + num(p.totalRevenue), 0);
  const totalQty = items.reduce((s, p) => s + num(p.totalQuantity), 0);

  return (
    <View style={styles.card}>
      <SectionHeader title="Top Products" />
      <StatRow label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} />
      <StatRow label="Total Units Sold" value={totalQty.toLocaleString()} isLast />
      <View style={styles.spacer} />
      {items.length === 0 ? (
        <EmptyState message="No product sales yet" />
      ) : (
        items.map((p) => (
          <ProgressRow
            key={p.productId}
            label={p.productName}
            sub={p.categoryName}
            value={num(p.totalRevenue)}
            max={maxRevenue}
            suffix="$"
          />
        ))
      )}
    </View>
  );
}

function CashiersTab({ cashiers }: { cashiers: CashierReport }) {
  const items = [...(cashiers.cashiers ?? [])].sort((a, b) => num(b.totalRevenue) - num(a.totalRevenue));
  const totalRevenue = items.reduce((s, c) => s + num(c.totalRevenue), 0);

  return (
    <View style={styles.card}>
      <SectionHeader title="Cashier Performance" />
      <StatRow label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} isLast />
      <View style={styles.spacer} />
      {items.length === 0 ? (
        <EmptyState message="No cashier data yet" />
      ) : (
        items.map((c) => (
          <View key={c.cashierName} style={styles.cashierRow}>
            <View style={styles.cashierAvatar}>
              <Text style={styles.cashierAvatarText}>{c.cashierName?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={styles.cashierInfo}>
              <Text style={styles.cashierName}>{c.cashierName}</Text>
              <Text style={styles.cashierSub}>
                {num(c.totalOrders)} orders · avg ${num(c.averageOrderValue).toFixed(2)}
              </Text>
            </View>
            <Text style={styles.cashierRevenue}>${num(c.totalRevenue).toLocaleString()}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function BranchesTab({ branches }: { branches: BranchReport }) {
  const items = [...(branches.branches ?? [])].sort((a, b) => num(b.revenue) - num(a.revenue));
  const maxRevenue = items.reduce((mx, b) => Math.max(mx, num(b.revenue)), 0);
  const totalRevenue = items.reduce((s, b) => s + num(b.revenue), 0);

  return (
    <View style={styles.card}>
      <SectionHeader title="Branch Performance" />
      <StatRow label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} isLast />
      <View style={styles.spacer} />
      {items.length === 0 ? (
        <EmptyState message="No branch data yet" />
      ) : (
        items.map((b) => (
          <View key={String(b.branchId)} style={styles.branchItem}>
            <ProgressRow
              label={b.branchName ?? 'Unknown Branch'}
              sub={`${num(b.completedOrders)} completed · ${num(b.cancelledOrders)} cancelled`}
              value={num(b.revenue)}
              max={maxRevenue}
              suffix="$"
            />
          </View>
        ))
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<ReportTab>('sales');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<ReportFilter>({});

  const [sales, setSales] = useState<SalesReport | null>(null);
  const [products, setProducts] = useState<ProductReport | null>(null);
  const [cashiers, setCashiers] = useState<CashierReport | null>(null);
  const [branches, setBranches] = useState<BranchReport | null>(null);

  const hasFilter = !!(filter.dateFrom || filter.dateTo);

  const filterLabel = useMemo(() => {
    if (!hasFilter) return 'Filter';
    if (filter.dateFrom && filter.dateTo)
      return `${formatDisplay(filter.dateFrom)} – ${formatDisplay(filter.dateTo)}`;
    if (filter.dateFrom) return `From ${formatDisplay(filter.dateFrom)}`;
    return `Until ${formatDisplay(filter.dateTo!)}`;
  }, [filter, hasFilter]);

  const TABS = useMemo(() => {
    const all = [
      { key: 'sales' as const, label: 'Sales', icon: 'cash-outline' as const },
      { key: 'products' as const, label: 'Products', icon: 'cube-outline' as const },
      { key: 'cashiers' as const, label: 'Cashiers', icon: 'people-outline' as const },
      { key: 'branches' as const, label: 'Branches', icon: 'business-outline' as const },
    ];
    return isAdmin ? all : all.filter(t => t.key !== 'branches');
  }, [isAdmin]);

  const loadAll = useCallback(async (f: ReportFilter = {}) => {
    setError(null);
    try {
      if (isAdmin) {
        const [s, p, c, b] = await Promise.all([
          reportsService.getSales(f),
          reportsService.getProducts(f),
          reportsService.getCashiers(f),
          reportsService.getBranches(f),
        ]);
        setSales(s); setProducts(p); setCashiers(c); setBranches(b);
      } else {
        const [s, p, c] = await Promise.all([
          reportsService.getSales(f),
          reportsService.getProducts(f),
          reportsService.getCashiers(f),
        ]);
        setSales(s); setProducts(p); setCashiers(c);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load reports');
    }
  }, [isAdmin]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll(filter);
    setRefreshing(false);
  }, [loadAll, filter]);

  useEffect(() => {
    if (!TABS.find(t => t.key === tab)) setTab('sales');
  }, [TABS, tab]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FilterModal
        visible={filterOpen}
        current={filter}
        onApply={setFilter}
        onClose={() => setFilterOpen(false)}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gray400} />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Reports</Text>
            <Text style={styles.subtitle}>
              {isAdmin ? 'All branches · Real-time' : 'Your branch · Real-time'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, hasFilter && styles.filterBtnActive]}
            onPress={() => setFilterOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={hasFilter ? 'funnel' : 'funnel-outline'}
              size={14}
              color={hasFilter ? Colors.white : Colors.gray700}
            />
            <Text style={[styles.filterBtnText, hasFilter && styles.filterBtnTextActive]} numberOfLines={1}>
              {filterLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {hasFilter && (
          <View style={styles.activeBadge}>
            <Ionicons name="time-outline" size={13} color={Colors.gray600} />
            <Text style={styles.activeBadgeText}>{filterLabel}</Text>
            <TouchableOpacity onPress={() => setFilter({})} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={Colors.gray500} />
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={t.icon} size={16} color={tab === t.key ? Colors.white : Colors.gray500} />
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.gray400} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            {tab === 'sales' && (
              sales
                ? <SalesTab sales={sales} />
                : <EmptyState message="No sales data available" />
            )}
            {tab === 'products' && (
              products
                ? <ProductsTab products={products} />
                : <EmptyState message="No product data available" />
            )}
            {tab === 'cashiers' && (
              cashiers
                ? <CashiersTab cashiers={cashiers} />
                : <EmptyState message="No cashier data available" />
            )}
            {tab === 'branches' && isAdmin && (
              branches
                ? <BranchesTab branches={branches} />
                : <EmptyState message="No branch data available" />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border, maxWidth: 160,
  },
  filterBtnActive: { backgroundColor: Colors.gray900, borderColor: Colors.gray900 },
  filterBtnText: { fontSize: 12, fontWeight: '600', color: Colors.gray700, flexShrink: 1 },
  filterBtnTextActive: { color: Colors.white },

  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.gray100, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start',
  },
  activeBadgeText: { fontSize: 12, color: Colors.gray700, fontWeight: '500', flex: 1 },

  tabRow: { gap: 8, paddingBottom: 4 },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.gray900, borderColor: Colors.gray900 },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.gray500 },
  tabTextActive: { color: Colors.white },

  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  statRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  statLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  statValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '700' },
  spacer: { height: 8 },

  progressRow: { gap: 4, marginBottom: 14 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  progressLabel: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  progressSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  progressValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginLeft: 8 },
  progressTrack: { height: 5, backgroundColor: Colors.gray100, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', backgroundColor: Colors.gray700, borderRadius: 3 },

  cashierRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  cashierAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center',
  },
  cashierAvatarText: { fontSize: 16, fontWeight: '700', color: Colors.gray700 },
  cashierInfo: { flex: 1 },
  cashierName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  cashierSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cashierRevenue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },

  branchItem: { marginBottom: 2 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 16, marginTop: 8,
  },
  errorText: { fontSize: 14, color: '#EF4444', flex: 1 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  // Filter modal
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 16,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.gray300, alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  presetBtnActive: { backgroundColor: Colors.gray900, borderColor: Colors.gray900 },
  presetText: { fontSize: 13, fontWeight: '600', color: Colors.gray600 },
  presetTextActive: { color: Colors.white },
  dividerLine: { height: 1, backgroundColor: Colors.divider },
  customLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.3 },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  dateArrow: { paddingBottom: 10 },
  dateInputWrap: { flex: 1, gap: 6 },
  dateInputLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.5 },
  dateInputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  dateInputBoxErr: { borderColor: '#EF4444' },
  dateInputText: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  errHint: { fontSize: 12, color: '#EF4444', marginTop: -8 },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  clearBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  clearBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  applyBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.gray900, alignItems: 'center' },
  applyBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});

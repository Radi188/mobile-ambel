import { http } from '../lib/api';
import {
  BranchReport, CashierReport, OrderSummaryReport, PaymentMethodsReport, ProductReport, SalesReport, Shift, ShiftReport,
  ShiftTransactions,
} from '../types/api.types';
import { listOf, normaliseShift, normaliseShiftSummary, recordOf, toNumber } from './shape';

export type ReportFilter = {
  dateFrom?: string;
  dateTo?: string;
  /** Admin's every-branch view (x-skip-branch), as ambel-mobile's admins see. */
  allBranches?: boolean;
};

/**
 * Money arrives as decimal strings ("12.50"). Reports are read-only figures, so
 * rather than map every field by name, numeric strings are turned into numbers
 * throughout — except fields that are ids, names or dates.
 */
const KEEP_AS_TEXT = /(id|name|date|method|status|address|phone|email)$/i;
function numeric<T>(value: any, key = ''): T {
  if (Array.isArray(value)) return value.map(v => numeric(v, key)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, numeric(v, k)])) as T;
  }
  if (typeof value === 'string' && !KEEP_AS_TEXT.test(key) && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    return Number(value) as T;
  }
  return value;
}

const read = <T>(data: unknown) => numeric<T>(recordOf(data) ?? {});

// Defaults for anything a report leaves out, so the screens never read
// `undefined.total`.
export const normaliseSalesReport = (data: unknown): SalesReport => {
  const r = read<any>(data);
  return {
    ...r,
    overview: {
      totalRevenue: 0, totalTransactions: 0, averageTransaction: 0,
      totalCashReceived: 0, totalChangeGiven: 0,
      ...(r.overview ?? {}),
    },
    refunds: { total: 0, count: 0, ...(r.refunds ?? {}) },
    byMethod: r.byMethod ?? [],
    byDay: r.byDay ?? [],
  };
};

const normaliseOrderReport = (data: unknown): OrderSummaryReport => {
  const r = read<any>(data);
  return {
    ...r,
    overview: { totalOrders: 0, totalValue: 0, averageOrderValue: 0, avgItemsPerOrder: 0, ...(r.overview ?? {}) },
    byStatus: r.byStatus ?? [],
    byDay: r.byDay ?? [],
  };
};

const normaliseProductReport = (data: unknown): ProductReport => {
  const r = read<any>(data);
  return { ...r, topProducts: r.topProducts ?? [], bottomProducts: r.bottomProducts ?? [], byCategory: r.byCategory ?? [] };
};

export const normaliseBranchReport = (data: unknown): BranchReport => {
  const r = read<any>(data);
  return { ...r, branches: r.branches ?? listOf(r) };
};

export const normaliseShiftReport = (data: unknown): ShiftReport => {
  const r = read<any>(data);
  return {
    ...r,
    overview: {
      totalShifts: 0, openShifts: 0, totalRevenue: 0, totalCashSales: 0, totalExpenses: 0, totalOrders: 0,
      ...(r.overview ?? {}),
    },
    shifts: (r.shifts ?? []).map((row: any) => ({
      ...row,
      shiftId: String(row.shiftId ?? row.id ?? ''),
      cashierName: row.cashierName || 'Cashier',
      branchName: row.branchName ?? '',
      revenue: toNumber(row.revenue),
      orders: toNumber(row.orders),
      transactions: toNumber(row.transactions),
      cashSales: toNumber(row.cashSales),
      openingCash: toNumber(row.openingCash),
      closingCash: toNumber(row.closingCash),
      expenses: toNumber(row.expenses),
      difference: row.difference == null ? null : toNumber(row.difference),
    })),
  };
};

/**
 * The live API documents its report range as `from` / `to` (Swagger), while
 * ambel-mobile and the web dashboard send `dateFrom` / `dateTo`. Both are sent
 * so the range is honoured whichever the server reads.
 */
const rangeParams = ({ dateFrom, dateTo }: ReportFilter = {}) => ({ dateFrom, dateTo, from: dateFrom, to: dateTo });

/**
 * "All time" as an explicit range. The live API does not read a missing range
 * as "everything" — ask without dates and it answers for its default window
 * (today), so an all-time total read $0 the day after the last sale.
 */
export const ALL_TIME_FROM = '2020-01-01';
export function allTimeRange(): ReportFilter {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { dateFrom: ALL_TIME_FROM, dateTo: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
}

/** Query + branch scope for one report request. */
const requestOf = (f: ReportFilter = {}) => ({
  params: rangeParams(f),
  ...(f.allBranches ? { headers: { 'x-skip-branch': '1' } } : {}),
});

/**
 * Reports. Everything except the cross-branch report is scoped to the branch
 * the app is currently viewing, through the x-branch-id header.
 *
 *   GET /reports/sales-summary   GET /reports/orders   GET /reports/products
 *   GET /reports/cashiers        GET /reports/shifts
 *   GET /reports/payment-methods
 *   GET /reports/branches (super admin)
 *   GET /shifts                  GET /shifts/:id/summary
 */
export const reportsService = {
  getSales: async (params: ReportFilter = {}) =>
    normaliseSalesReport(await http.get('/reports/sales-summary', requestOf(params))),

  getOrderSummary: async (params: ReportFilter = {}) =>
    normaliseOrderReport(await http.get('/reports/orders', requestOf(params))),

  getProducts: async (params: ReportFilter = {}) =>
    normaliseProductReport(await http.get('/reports/products', requestOf(params))),

  getCashiers: async (params: ReportFilter = {}): Promise<CashierReport> => {
    const r = read<any>(await http.get('/reports/cashiers', requestOf(params)));
    return { ...r, cashiers: r.cashiers ?? listOf(r) };
  },

  getPaymentMethods: async (params: ReportFilter = {}): Promise<PaymentMethodsReport> => {
    const r = read<any>(await http.get('/reports/payment-methods', requestOf(params)));
    return {
      branches: (r.branches ?? listOf(r)).map((b: any) => ({
        ...b,
        branchId: String(b.branchId ?? b.id ?? ''),
        branchName: b.branchName ?? b.name ?? '',
        total: toNumber(b.total),
        transactions: toNumber(b.transactions),
        methods: b.methods ?? [],
      })),
    };
  },

  // Deliberately unscoped: this one exists to compare branches against each other.
  getBranches: async (params: ReportFilter = {}) =>
    normaliseBranchReport(await http.get('/reports/branches', { params: rangeParams(params), headers: { 'x-skip-branch': '1' } })),

  // One row per shift with cashier, branch and takings already resolved —
  // what ambel-mobile's shifts report reads. Prefer it over /shifts + a
  // /summary per row: /shifts carries only the opener's id (so "Unknown"), and
  // /summary has no revenue field (so $0).
  getShiftReport: async (params: ReportFilter = {}) =>
    normaliseShiftReport(await http.get('/reports/shifts', requestOf(params))),

  getShifts: async (): Promise<Shift[]> =>
    listOf(await http.get('/shifts'))
      .map(normaliseShift)
      .sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt))),

  getShiftSummary: async (id: string): Promise<ShiftTransactions> =>
    normaliseShiftSummary(await http.get(`/shifts/${id}/summary`)),
};

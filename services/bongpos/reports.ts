import { http } from '../../lib/api';
import { CashierReport, PaymentMethodsReport, Shift, ShiftTransactions } from '../../types/api.types';
import type { ReportFilter } from '../reports.service';
import {
  listOf, normaliseBranchReport, normaliseOrderReport, normaliseProductReport, normaliseSalesReport, normaliseShift,
  normaliseShiftReport, normaliseShiftSummary, read, toNumber,
} from '../shape';

/**
 * The live API documents its report range as `from` / `to` (Swagger), while
 * ambel-mobile and the web dashboard send `dateFrom` / `dateTo`. Both are sent
 * so the range is honoured whichever the server reads.
 */
const rangeParams = ({ dateFrom, dateTo }: ReportFilter = {}) => ({ dateFrom, dateTo, from: dateFrom, to: dateTo });

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
export const bongposReports = {
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

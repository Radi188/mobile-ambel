import { http } from '../../lib/api';
import { CashierReport, PaymentMethodsReport, Shift, ShiftTransactions } from '../../types/api.types';
import type { ReportFilter } from '../reports.service';
import {
  listOf, normaliseBranchReport, normaliseOrderReport, normaliseProductReport, normaliseSalesReport, normaliseShift,
  normaliseShiftReport, normaliseShiftSummary, read, toNumber,
} from '../shape';

/**
 * Query + branch scope for one report request. Only `dateFrom` / `dateTo`:
 * the API validates with `forbidNonWhitelisted`, so BongPOS's extra `from` /
 * `to` would be refused with a 400.
 */
const requestOf = ({ dateFrom, dateTo, allBranches }: ReportFilter = {}) => ({
  params: { dateFrom, dateTo },
  ...(allBranches ? { headers: { 'x-skip-branch': '1' } } : {}),
});

/**
 * api-ambel — src/reports and src/shifts
 *
 * Scoped by x-branch-id, or by the token's branch when it's skipped (a super
 * admin's token has none, so that reads as every branch).
 *
 *   GET /reports/sales           GET /reports/orders   GET /reports/products
 *   GET /reports/cashiers        GET /reports/shifts
 *   GET /reports/payment-methods
 *   GET /reports/branches (super admin)
 *   GET /shifts                  GET /shifts/:id/summary
 */
export const ambelReports = {
  getSales: async (params: ReportFilter = {}) =>
    normaliseSalesReport(await http.get('/reports/sales', requestOf(params))),

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
        branchId: String(b.branchId ?? ''),
        branchName: b.branchName ?? '',
        total: toNumber(b.total),
        transactions: toNumber(b.transactions),
        methods: b.methods ?? [],
      })),
    };
  },

  // Deliberately unscoped: this one exists to compare branches against each other.
  getBranches: async (params: ReportFilter = {}) =>
    normaliseBranchReport(await http.get('/reports/branches', requestOf({ ...params, allBranches: true }))),

  getShiftReport: async (params: ReportFilter = {}) =>
    normaliseShiftReport(await http.get('/reports/shifts', requestOf(params))),

  getShifts: async (): Promise<Shift[]> =>
    listOf(await http.get('/shifts'))
      .map(normaliseShift)
      .sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt))),

  getShiftSummary: async (id: string): Promise<ShiftTransactions> =>
    normaliseShiftSummary(await http.get(`/shifts/${id}/summary`)),
};

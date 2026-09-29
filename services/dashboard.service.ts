import { http } from '../lib/api';
import { Branch } from '../types/api.types';
import { listOf, normaliseBranch } from './shape';
import { normaliseBranchReport, ReportFilter, reportsService } from './reports.service';

/** YYYY-MM-DD in the device's timezone — toISOString() would give UTC, which
 *  is still yesterday before 7am in Phnom Penh. */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The dashboard reads the server's own aggregation, the same reports
 * ambel-mobile's dashboard uses: sales-summary, orders, products and shifts.
 * Scoped to the branch being viewed (x-branch-id), or every branch when
 * `allBranches` is set (x-skip-branch).
 */
export const dashboardService = {
  getSalesReport: (f: ReportFilter) => reportsService.getSales(f),

  getOrderSummary: (f: ReportFilter) => reportsService.getOrderSummary(f),

  getTopProducts: async (f: ReportFilter) => (await reportsService.getProducts(f)).topProducts.slice(0, 5),

  getShiftReport: (f: ReportFilter) => reportsService.getShiftReport(f),

  getBranchReport: async (dateFrom?: string, dateTo?: string) =>
    normaliseBranchReport(await http.get('/reports/branches', {
      params: { dateFrom, dateTo, from: dateFrom, to: dateTo },
      headers: { 'x-skip-branch': '1' },
    })),

  getActiveBranches: async (): Promise<Branch[]> =>
    listOf(await http.get('/branches')).map(normaliseBranch).filter(b => b.isActive),

  // Revenue for each of the last 7 days, oldest → today.
  getWeeklyRevenue: async (allBranches = false): Promise<{ label: string; value: number }[]> => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    const buckets = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - idx));
      return { label: days[d.getDay()], value: 0, key: localDate(d) };
    });

    const report = await reportsService.getSales({ dateFrom: buckets[0].key, dateTo: buckets[6].key, allBranches });
    const revenueByDate = new Map((report.byDay ?? []).map(day => [String(day.date).slice(0, 10), day.revenue]));
    buckets.forEach(bucket => { bucket.value = revenueByDate.get(bucket.key) ?? 0; });

    return buckets.map(({ label, value }) => ({ label, value }));
  },
};

import { http } from '../lib/api';
import { Branch, Order } from '../types/api.types';
import { listOf, normaliseBranch, normaliseOrder, sortNewestFirst } from './shape';
import { normaliseBranchReport, normaliseSalesReport, reportsService } from './reports.service';

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export const dashboardService = {
  getSalesReport: async (dateFrom?: string, dateTo?: string) =>
    normaliseSalesReport(await http.get('/reports/sales-summary', { params: { dateFrom, dateTo } })),

  getBranchReport: async (dateFrom?: string, dateTo?: string) =>
    normaliseBranchReport(await http.get('/reports/branches', {
      params: { dateFrom, dateTo },
      headers: { 'x-skip-branch': '1' },
    })),

  getRecentOrders: async (): Promise<Order[]> =>
    sortNewestFirst(listOf(await http.get('/orders')).map(normaliseOrder)).slice(0, 50),

  getActiveBranches: async (): Promise<Branch[]> =>
    listOf(await http.get('/branches')).map(normaliseBranch).filter(b => b.isActive),

  getShifts: reportsService.getShifts,

  getShiftSummary: reportsService.getShiftSummary,

  // Revenue for each of the last 7 days, oldest → today.
  getWeeklyRevenue: async (): Promise<{ label: string; value: number }[]> => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 6);

    const buckets = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date();
      d.setDate(today.getDate() - (6 - idx));
      return { label: days[d.getDay()], value: 0, key: isoDate(d) };
    });

    const report = await dashboardService.getSalesReport(isoDate(from), isoDate(today));
    const revenueByDate = new Map((report.byDay ?? []).map(day => [String(day.date).slice(0, 10), day.revenue]));
    buckets.forEach(bucket => { bucket.value = revenueByDate.get(bucket.key) ?? 0; });

    return buckets.map(({ label, value }) => ({ label, value }));
  },
};

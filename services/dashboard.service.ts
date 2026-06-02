import api from '../lib/api';
import { SalesReport, BranchReport, Order, Branch, Payment } from '../types/api.types';

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export const dashboardService = {
  getSalesReport: (dateFrom?: string, dateTo?: string) =>
    api.get('/reports/sales', { params: { dateFrom, dateTo } }) as unknown as Promise<SalesReport>,

  getBranchReport: (dateFrom?: string, dateTo?: string) =>
    api.get('/reports/branches', { params: { dateFrom, dateTo } }) as unknown as Promise<BranchReport>,

  getRecentOrders: () =>
    api.get('/orders', { params: { status: undefined } }) as unknown as Promise<Order[]>,

  // Payments carry the payment method — joined to orders by order id on the dashboard
  getRecentPayments: () =>
    api.get('/payments') as unknown as Promise<Payment[]>,

  getActiveBranches: () =>
    api.get('/branches', { params: { active: true } }) as unknown as Promise<Branch[]>,

  // Revenue for each of the last 7 days — derived from a single sales report's byDay
  getWeeklyRevenue: async (): Promise<{ label: string; value: number }[]> => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 6);

    // Seed 7 ordered day buckets (oldest → today), all starting at 0.
    const buckets = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date();
      d.setDate(today.getDate() - (6 - idx));
      return { label: days[d.getDay()], value: 0, key: isoDate(d) };
    });

    try {
      const report = await api.get('/reports/sales', {
        params: { dateFrom: isoDate(from), dateTo: isoDate(today) },
      }) as unknown as SalesReport;
      const revenueByDate = new Map((report.byDay ?? []).map((d) => [d.date, d.revenue]));
      buckets.forEach((b) => { b.value = revenueByDate.get(b.key) ?? 0; });
    } catch {
      // leave zeros on failure
    }

    return buckets.map(({ label, value }) => ({ label, value }));
  },
};

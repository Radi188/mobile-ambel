import { Shift } from '../types/api.types';
import { db, delay, fail, scopedOrders, scopedPayments, scopedShifts } from './mock/store';
import {
  branchReport, filterOrders, filterPayments, salesReport, shiftSummary,
} from './mock/reports';

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export const dashboardService = {
  getSalesReport: async (dateFrom?: string, dateTo?: string) =>
    delay(salesReport(filterPayments(await scopedPayments(), { dateFrom, dateTo }))),

  getBranchReport: (dateFrom?: string, dateTo?: string) =>
    delay(branchReport(
      filterOrders(db.orders, { dateFrom, dateTo }),
      filterPayments(db.payments, { dateFrom, dateTo }),
    )),

  getRecentOrders: async () => delay((await scopedOrders()).slice(0, 50)),

  getRecentPayments: async () => delay((await scopedPayments()).slice(0, 50)),

  getActiveBranches: () => delay(db.branches.filter(branch => branch.isActive)),

  getShifts: () => scopedShifts().then(list => delay(list)),

  getShiftSummary: (id: string) => {
    const shift: Shift | undefined = db.shifts.find(s => s._id === id);
    if (!shift) fail('Shift not found.');
    return delay(shiftSummary(shift), 90);
  },

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

    const report = salesReport(
      filterPayments(await scopedPayments(), { dateFrom: isoDate(from), dateTo: isoDate(today) }),
    );
    const revenueByDate = new Map((report.byDay ?? []).map(day => [day.date, day.revenue]));
    buckets.forEach(bucket => { bucket.value = revenueByDate.get(bucket.key) ?? 0; });

    return buckets.map(({ label, value }) => ({ label, value }));
  },
};

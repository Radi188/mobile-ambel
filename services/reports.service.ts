import { Shift } from '../types/api.types';
import { db, delay, fail, scopedOrders, scopedPayments, scopedShifts } from './mock/store';
import {
  branchReport, cashierReport, filterOrders, filterPayments,
  orderSummaryReport, productReport, salesReport, shiftSummary,
} from './mock/reports';

export type ReportFilter = { dateFrom?: string; dateTo?: string };

/**
 * Reports over the mock dataset. Everything except the cross-branch report is
 * scoped to the branch the app is currently viewing, matching how the old
 * x-branch-id header behaved.
 */
export const reportsService = {
  getSales: async (filter: ReportFilter = {}) =>
    delay(salesReport(filterPayments(await scopedPayments(), filter))),

  getOrderSummary: async (filter: ReportFilter = {}) =>
    delay(orderSummaryReport(filterOrders(await scopedOrders(), filter))),

  getProducts: async (filter: ReportFilter = {}) =>
    delay(productReport(filterOrders(await scopedOrders(), filter))),

  getCashiers: async (filter: ReportFilter = {}) =>
    delay(cashierReport(filterOrders(await scopedOrders(), filter))),

  // Deliberately unscoped: this one exists to compare branches against each other.
  getBranches: (filter: ReportFilter = {}) =>
    delay(branchReport(filterOrders(db.orders, filter), filterPayments(db.payments, filter))),

  getShifts: () => scopedShifts().then(list => delay(list)),

  getShiftSummary: (id: string) => {
    const shift: Shift | undefined = db.shifts.find(s => s._id === id);
    if (!shift) fail('Shift not found.');
    return delay(shiftSummary(shift), 90);
  },
};

import {
  BranchReport, CashierReport, Order, OrderSummaryReport, Payment,
  ProductReport, ProductReportItem, SalesReport, Shift, ShiftTransactions,
} from '../../types/api.types';
import { branchIdOf, db } from './store';

/**
 * Report aggregation over the mock orders and payments.
 *
 * Every figure the app shows is derived from the same order set, so the
 * dashboard, the orders tab and the reports tab can't disagree with each other
 * the way independently faked numbers would.
 */

export type Range = { dateFrom?: string; dateTo?: string };

function inRange(isoDate: string, range: Range): boolean {
  const day = (isoDate ?? '').slice(0, 10);
  if (range.dateFrom && day < range.dateFrom) return false;
  if (range.dateTo && day > range.dateTo) return false;
  return true;
}

export function filterOrders(orders: Order[], range: Range): Order[] {
  return orders.filter(order => inRange(order.createdAt, range));
}

export function filterPayments(payments: Payment[], range: Range): Payment[] {
  return payments.filter(payment => inRange(payment.paidAt ?? payment.createdAt, range));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function itemCount(order: Order): number {
  return (order.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export function salesReport(payments: Payment[]): SalesReport {
  const revenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const cashReceived = payments.reduce((sum, p) => sum + (p.cashReceived ?? 0), 0);
  const changeGiven = payments.reduce((sum, p) => sum + (p.changeGiven ?? 0), 0);

  const methods = new Map<string, { total: number; count: number }>();
  const days = new Map<string, { revenue: number; transactions: number }>();

  for (const payment of payments) {
    const method = methods.get(payment.method) ?? { total: 0, count: 0 };
    method.total = round2(method.total + payment.amount);
    method.count += 1;
    methods.set(payment.method, method);

    const key = (payment.paidAt ?? payment.createdAt).slice(0, 10);
    const day = days.get(key) ?? { revenue: 0, transactions: 0 };
    day.revenue = round2(day.revenue + payment.amount);
    day.transactions += 1;
    days.set(key, day);
  }

  return {
    overview: {
      totalRevenue: round2(revenue),
      totalTransactions: payments.length,
      averageTransaction: payments.length ? round2(revenue / payments.length) : 0,
      totalCashReceived: round2(cashReceived),
      totalChangeGiven: round2(changeGiven),
    },
    refunds: { total: 0, count: 0 },
    byMethod: (['cash', 'card', 'qr'] as const)
      .map(method => ({ method, ...(methods.get(method) ?? { total: 0, count: 0 }) }))
      .filter(entry => entry.count > 0),
    byDay: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, ...value })),
  };
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export function orderSummaryReport(orders: Order[]): OrderSummaryReport {
  const totalValue = orders.reduce((sum, order) => sum + order.total, 0);
  const items = orders.reduce((sum, order) => sum + itemCount(order), 0);

  const statuses = new Map<string, { count: number; totalValue: number }>();
  const days = new Map<string, { orders: number; revenue: number }>();

  for (const order of orders) {
    const status = statuses.get(order.status) ?? { count: 0, totalValue: 0 };
    status.count += 1;
    status.totalValue = round2(status.totalValue + order.total);
    statuses.set(order.status, status);

    const key = order.createdAt.slice(0, 10);
    const day = days.get(key) ?? { orders: 0, revenue: 0 };
    day.orders += 1;
    if (order.status !== 'cancelled') day.revenue = round2(day.revenue + order.total);
    days.set(key, day);
  }

  return {
    overview: {
      totalOrders: orders.length,
      totalValue: round2(totalValue),
      averageOrderValue: orders.length ? round2(totalValue / orders.length) : 0,
      avgItemsPerOrder: orders.length ? round2(items / orders.length) : 0,
    },
    byStatus: [...statuses.entries()].map(([status, value]) => ({ status, ...value })),
    byDay: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, ...value })),
  };
}

// ─── Products ─────────────────────────────────────────────────────────────────

export function productReport(orders: Order[]): ProductReport {
  const sold = new Map<string, ProductReportItem>();
  const byCategory = new Map<string, { categoryId: string; categoryName: string; totalQuantity: number; totalRevenue: number }>();

  for (const order of orders) {
    if (order.status === 'cancelled') continue;

    for (const item of order.items ?? []) {
      const product = typeof item.product === 'object' ? item.product : undefined;
      if (!product) continue;
      const categoryName = typeof product.category === 'object' ? product.category.name : '—';
      const categoryId = typeof product.category === 'object' ? product.category._id : 'unknown';
      const revenue = item.itemTotal ?? item.unitPrice * item.quantity;

      const entry = sold.get(product._id) ?? {
        productId: product._id,
        productName: product.name,
        categoryName,
        totalQuantity: 0,
        totalRevenue: 0,
        totalOrders: 0,
        averageUnitPrice: 0,
      };
      entry.totalQuantity += item.quantity;
      entry.totalRevenue = round2(entry.totalRevenue + revenue);
      entry.totalOrders += 1;
      entry.averageUnitPrice = round2(entry.totalRevenue / Math.max(entry.totalQuantity, 1));
      sold.set(product._id, entry);

      const cat = byCategory.get(categoryId) ?? { categoryId, categoryName, totalQuantity: 0, totalRevenue: 0 };
      cat.totalQuantity += item.quantity;
      cat.totalRevenue = round2(cat.totalRevenue + revenue);
      byCategory.set(categoryId, cat);
    }
  }

  const ranked = [...sold.values()].sort((a, b) => b.totalRevenue - a.totalRevenue);

  return {
    topProducts: ranked.slice(0, 8),
    bottomProducts: ranked.slice(-5).reverse(),
    byCategory: [...byCategory.values()].sort((a, b) => b.totalRevenue - a.totalRevenue),
  };
}

// ─── Cashiers ─────────────────────────────────────────────────────────────────

export function cashierReport(orders: Order[]): CashierReport {
  const byCashier = new Map<string, { totalOrders: number; totalRevenue: number }>();

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const name = order.cashierName || 'Unassigned';
    const entry = byCashier.get(name) ?? { totalOrders: 0, totalRevenue: 0 };
    entry.totalOrders += 1;
    entry.totalRevenue = round2(entry.totalRevenue + order.total);
    byCashier.set(name, entry);
  }

  return {
    cashiers: [...byCashier.entries()]
      .map(([cashierName, value]) => ({
        cashierName,
        totalOrders: value.totalOrders,
        totalRevenue: value.totalRevenue,
        averageOrderValue: value.totalOrders ? round2(value.totalRevenue / value.totalOrders) : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue),
  };
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export function branchReport(orders: Order[], payments: Payment[]): BranchReport {
  return {
    branches: db.branches.map(branch => {
      const branchOrders = orders.filter(order => branchIdOf(order.branch) === branch._id);
      const branchPayments = payments.filter(payment => branchIdOf(payment.branch) === branch._id);
      const completed = branchOrders.filter(order => order.status !== 'cancelled');

      return {
        branchId: branch._id,
        branchName: branch.name,
        branchAddress: branch.address,
        branchPhone: branch.phone,
        branchEmail: branch.email,
        branchIsActive: branch.isActive,
        totalOrders: branchOrders.length,
        totalOrderValue: round2(branchOrders.reduce((sum, order) => sum + order.total, 0)),
        completedOrders: completed.length,
        cancelledOrders: branchOrders.length - completed.length,
        revenue: round2(branchPayments.reduce((sum, payment) => sum + payment.amount, 0)),
        transactions: branchPayments.length,
      };
    }),
  };
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

/** Live totals for one shift, summed from the payments taken while it was open. */
export function shiftSummary(shift: Shift): ShiftTransactions {
  const from = shift.openedAt;
  const to = shift.closedAt ?? new Date().toISOString();
  const branchId = branchIdOf(shift.branch);

  const taken = db.payments.filter(payment => {
    if (branchIdOf(payment.branch) !== branchId) return false;
    const at = payment.paidAt ?? payment.createdAt;
    return at >= from && at <= to;
  });

  const byMethod = (method: string) =>
    round2(taken.filter(p => p.method === method).reduce((sum, p) => sum + p.amount, 0));

  const orderIds = new Set(taken.map(payment => (typeof payment.order === 'object' ? payment.order._id : payment.order)));
  const discount = db.orders
    .filter(order => orderIds.has(order._id))
    .reduce((sum, order) => sum + (order.discountAmount ?? 0), 0);

  return {
    orders: taken.length,
    revenue: round2(taken.reduce((sum, payment) => sum + payment.amount, 0)),
    cashRevenue: byMethod('cash'),
    cardRevenue: byMethod('card'),
    qrRevenue: byMethod('qr'),
    totalDiscount: round2(discount),
  };
}

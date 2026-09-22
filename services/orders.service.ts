import { Branch, Order, OrderStatus, PageQuery, Paginated } from '../types/api.types';
import { activeBranchId, branchIdOf, db, delay, fail, nextId, nowIso, paginate } from './mock/store';

export type OrderQuery = PageQuery & {
  status?: OrderStatus;
  search?: string;
  branch?: string;
  dateFrom?: string;
  dateTo?: string;
};

/** Cancelling an order drops its payment so revenue follows; restoring re-adds one. */
function syncPayment(order: Order, status: OrderStatus) {
  const index = db.payments.findIndex(payment =>
    (typeof payment.order === 'object' ? payment.order._id : payment.order) === order._id);

  if (status === 'cancelled') {
    if (index >= 0) db.payments.splice(index, 1);
    return;
  }
  if (index < 0) {
    db.payments.push({
      _id: nextId('pay'),
      branch: order.branch,
      order: order._id,
      amount: order.total,
      method: 'qr',
      status: 'paid',
      paidAt: nowIso(),
      createdAt: nowIso(),
    });
  }
}

export const ordersService = {
  /**
   * GET /orders?page=&limit=&status=&search=&branch=&dateFrom=&dateTo=
   * → Paginated<Order>, newest first.
   *
   * Scoped to the active branch unless an explicit branch is passed.
   */
  getOrders: async ({ status, search, branch, dateFrom, dateTo, page = 1, limit = 20 }: OrderQuery = {}): Promise<Paginated<Order>> => {
    const branchId = branch ?? (await activeBranchId());
    const needle = search?.trim().toLowerCase();

    const list = db.orders.filter(order => {
      if (branchId && branchIdOf(order.branch) !== branchId) return false;
      if (status && order.status !== status) return false;
      const day = order.createdAt.slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (needle) {
        const haystack = `${order.orderNumber ?? ''} ${order.customerName ?? ''} ${order.cashierName ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    return delay(paginate(list, page, limit));
  },

  getOrder: (id: string) => {
    const order = db.orders.find(o => o._id === id);
    if (!order) fail('Order not found.');
    return delay(order, 220);
  },

  getBranches: () => delay([...db.branches] as Branch[]),

  updateStatus: (id: string, status: OrderStatus) => {
    const order = db.orders.find(o => o._id === id);
    if (!order) fail('Order not found.');
    order.status = status;
    order.updatedAt = nowIso();
    syncPayment(order, status);
    return delay(order);
  },

  remove: (id: string) => {
    const index = db.orders.findIndex(order => order._id === id);
    if (index < 0) fail('Order not found.');
    const [removed] = db.orders.splice(index, 1);
    syncPayment(removed, 'cancelled');
    return delay(undefined as void);
  },
};

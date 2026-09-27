import { http } from '../lib/api';
import { Branch, Order, OrderStatus, PageQuery, Paginated } from '../types/api.types';
import { listOf, matches, normaliseOrder, paginate, recordOf, sortNewestFirst } from './shape';
import { branchesService } from './branches.service';

export type OrderQuery = PageQuery & {
  status?: OrderStatus;
  search?: string;
  branch?: string;
  dateFrom?: string;
  dateTo?: string;
};

/**
 * GET    /orders?status=&dateFrom=&dateTo=   the list (scoped by x-branch-id)
 * GET    /orders/:id
 * PATCH  /orders/:id/status  { status }
 * DELETE /orders/:id
 */
export const ordersService = {
  /**
   * Newest first. The API returns the whole list, so search and paging happen
   * here; status and dates also go to the server, and are re-checked locally in
   * case it ignores them.
   */
  getOrders: async ({ status, search, branch, dateFrom, dateTo, page = 1, limit = 20 }: OrderQuery = {}): Promise<Paginated<Order>> => {
    const data = await http.get('/orders', {
      params: { status, dateFrom, dateTo },
      headers: branch ? { 'x-branch-id': branch } : undefined,
    });
    const list = sortNewestFirst(listOf(data).map(normaliseOrder)).filter(order => {
      if (status && order.status !== status) return false;
      const day = String(order.createdAt).slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return matches(search, order.orderNumber, order.customerName, order.cashierName);
    });
    return paginate(list, page, limit);
  },

  getOrder: async (id: string) => normaliseOrder(recordOf(await http.get(`/orders/${id}`))),

  getBranches: (): Promise<Branch[]> => branchesService.getBranches(),

  /**
   * Cancels through the status route — the API has no dedicated cancel
   * endpoint. A reason, when given, isn't sent: the status DTO only takes
   * `status`. Cancelling an already-cancelled order is a no-op.
   */
  cancel: async (id: string, _reason?: string) => {
    const order = await ordersService.getOrder(id);
    if (order.status === 'cancelled') return order;
    return ordersService.updateStatus(id, 'cancelled');
  },

  updateStatus: async (id: string, status: OrderStatus) =>
    normaliseOrder(recordOf(await http.patch(`/orders/${id}/status`, { status }))),

  remove: async (id: string) => { await http.delete(`/orders/${id}`); },
};

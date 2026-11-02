import { http } from '../../lib/api';
import { Branch, Order, OrderStatus, Paginated } from '../../types/api.types';
import type { OrderQuery } from '../orders.service';
import { listOf, matches, paginate, read, recordOf, sortNewestFirst, toNumber } from '../shape';
import { normaliseOrder } from './shape';
import { ambelBranches } from './branches';

/**
 * How many orders match, from the orders report — the list itself is fetched
 * only as far as the screen has scrolled, so it can't count them. Unknown (0)
 * for a search, which the report can't filter by, or for a cashier, who can't
 * read reports.
 */
async function countOrders({ status, search, dateFrom, dateTo }: OrderQuery, headers?: Record<string, string>) {
  if (search) return 0;
  try {
    const r = read<any>(await http.get('/reports/orders', { params: { dateFrom, dateTo }, headers }));
    if (!status) return toNumber(r?.overview?.totalOrders);
    return toNumber((r?.byStatus ?? []).find((s: any) => s?.status === status)?.count);
  } catch {
    return 0;
  }
}

/**
 * api-ambel — src/orders
 *
 * GET    /orders?status=&dateFrom=&dateTo=&search=   (scoped by x-branch-id)
 * GET    /orders/:id
 * PATCH  /orders/:id/status  { status: 'completed' | 'cancelled' }
 * DELETE /orders/:id
 */
export const ambelOrders = {
  /**
   * Newest first, fetched only up to the page asked for (plus one, to know
   * whether there's more). Unlimited, `GET /orders` returns every order the
   * branch has ever taken, each with its branch populated — receipt logo
   * raster included — and a busy branch's list outgrows what the phone's JS
   * engine can hold in one string ("String length exceeds limit").
   *
   * Filters go to the server and are re-checked here.
   */
  getOrders: async (query: OrderQuery = {}): Promise<Paginated<Order>> => {
    const { status, search, branch, dateFrom, dateTo, page = 1, limit = 20 } = query;
    const headers = branch ? { 'x-branch-id': branch } : undefined;
    const [data, total] = await Promise.all([
      http.get('/orders', { params: { status, dateFrom, dateTo, search, limit: page * limit + 1 }, headers }),
      countOrders(query, headers),
    ]);
    const list = sortNewestFirst(listOf(data).map(normaliseOrder)).filter(order => {
      if (status && order.status !== status) return false;
      const day = String(order.createdAt).slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return matches(search, order.orderNumber, order.customerName, order.cashierName);
    });
    const result = paginate(list, page, limit);
    return { ...result, total: total || (result.hasMore ? 0 : list.length) };
  },

  getOrder: async (id: string) => normaliseOrder(recordOf(await http.get(`/orders/${id}`))),

  getBranches: (): Promise<Branch[]> => ambelBranches.getBranches(),

  /** The status DTO takes only `status`, so a reason isn't sent. Already cancelled is a no-op. */
  cancel: async (id: string, _reason?: string) => {
    const order = await ambelOrders.getOrder(id);
    if (order.status === 'cancelled') return order;
    return ambelOrders.updateStatus(id, 'cancelled');
  },

  updateStatus: async (id: string, status: OrderStatus) =>
    normaliseOrder(recordOf(await http.patch(`/orders/${id}/status`, { status }))),

  remove: async (id: string) => { await http.delete(`/orders/${id}`); },
};

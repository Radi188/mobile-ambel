import api from '../lib/api';
import { Order, OrderStatus, Branch } from '../types/api.types';

export type OrderQuery = {
  status?: OrderStatus;
  search?: string;
  branch?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export const ordersService = {
  // Branch-scoped automatically via the x-branch-id header / JWT for managers & cashiers;
  // super admins see all branches unless a `branch` is passed.
  getOrders: ({ status, search, branch, dateFrom, dateTo, limit = 50 }: OrderQuery = {}) =>
    api.get('/orders', { params: { status, search, branch, dateFrom, dateTo, limit } }) as unknown as Promise<Order[]>,

  getOrder: (id: string) =>
    api.get(`/orders/${id}`) as unknown as Promise<Order>,

  // Super-admin only — used to populate the branch filter.
  getBranches: () =>
    api.get('/branches') as unknown as Promise<Branch[]>,

  updateStatus: (id: string, status: OrderStatus) =>
    api.patch(`/orders/${id}/status`, { status }) as unknown as Promise<Order>,

  remove: (id: string) =>
    api.delete(`/orders/${id}`) as unknown as Promise<void>,
};

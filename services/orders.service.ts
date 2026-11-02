import { OrderStatus, PageQuery } from '../types/api.types';
import { byBackend } from './backend';
import { bongposOrders } from './bongpos/orders';
import { ambelOrders } from './ambel/orders';

export type OrderQuery = PageQuery & {
  status?: OrderStatus;
  search?: string;
  branch?: string;
  dateFrom?: string;
  dateTo?: string;
};

export const ordersService = byBackend<typeof bongposOrders>({ bongpos: bongposOrders, ambel: ambelOrders });

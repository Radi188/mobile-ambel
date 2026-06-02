import api from '../lib/api';
import { SalesReport, ProductReport, CashierReport, BranchReport } from '../types/api.types';

export type ReportFilter = { dateFrom?: string; dateTo?: string };

export const reportsService = {
  getSales: (filter?: ReportFilter) =>
    api.get('/reports/sales', { params: filter }) as unknown as Promise<SalesReport>,

  getProducts: (filter?: ReportFilter) =>
    api.get('/reports/products', { params: filter }) as unknown as Promise<ProductReport>,

  getCashiers: (filter?: ReportFilter) =>
    api.get('/reports/cashiers', { params: filter }) as unknown as Promise<CashierReport>,

  getBranches: (filter?: ReportFilter) =>
    api.get('/reports/branches', { params: filter }) as unknown as Promise<BranchReport>,
};

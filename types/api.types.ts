// ─── Paging ──────────────────────────────────────────────────────────────────

/**
 * Envelope every list endpoint returns.
 *
 * The REST contract the app expects:
 *   GET /<resource>?page=1&limit=20&...filters
 *   → { items: [...], page: 1, pageSize: 20, total: 137, hasMore: true }
 *
 * `page` is 1-based. `hasMore` is authoritative — the app appends pages until
 * it is false rather than comparing counts itself, so a server that can't cheaply
 * produce `total` may return 0 for it without breaking infinite scroll.
 */
export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

/** Query params shared by every list endpoint. */
export type PageQuery = {
  page?: number;
  limit?: number;
};

// ─── Billing ─────────────────────────────────────────────────────────────────

export type BillingCycle = 'monthly' | 'yearly';

/**
 * The price list, served rather than hard-coded in the app so a change doesn't
 * need a release.
 *   GET /billing/catalog → PlanCatalog
 */
export type PlanCatalog = {
  currency: string;
  /** List price vs what the customer actually pays, per month. */
  base: { listPrice: number; price: number; includedBranches: number };
  extraBranch: { listPrice: number; price: number };
  discountLabel: string;
  yearly: { monthsCharged: number; perks: string[] };
  /** Services bundled at no cost. */
  included: string[];
  platforms: string[];
  /** Named honestly so the app never implies a module it doesn't have. */
  notYetAvailable: string[];
};

/** GET /billing/subscription → Subscription */
export type Subscription = {
  plan: 'store';
  cycle: BillingCycle;
  /** Total branches on the account, including the one the base plan covers. */
  branches: number;
  status: 'active' | 'trial' | 'past_due';
  renewsAt: string;
};

// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'manager' | 'cashier';

export type AuthUser = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  branchId?: string;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

// Full user record returned by the /users management endpoints (password excluded).
export type User = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  /** The server assigns roles by id (`GET /roles`); `role` is its name. */
  roleId?: string | null;
  branch?: Branch | string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// ─── Branch ──────────────────────────────────────────────────────────────────

export type Branch = {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// ─── Category ────────────────────────────────────────────────────────────────

export type Category = {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
};

// ─── Product ─────────────────────────────────────────────────────────────────

export type ProductType = 'main' | 'topping';

export type ProductSize = {
  name: string;
  price: number;
  isAvailable: boolean;
};

export type Product = {
  _id: string;
  name: string;
  description?: string;
  type: ProductType;
  category: Category;
  sizes: ProductSize[];
  imageUrl?: string;
  isAvailable: boolean;
  /**
   * Optional: the API no longer takes branch ids when a product is created, so
   * a product may come back without any branch relation at all. Treat a missing
   * or empty list as "available in every branch".
   */
  branches?: Branch[];
  createdAt: string;
  updatedAt: string;
};

// ─── Order ───────────────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type DiscountType = 'percentage' | 'fixed';

export type OrderItemTopping = {
  product: string;
  name: string;
  price: number;
};

export type OrderItem = {
  product: Product | string;
  size: string;
  quantity: number;
  unitPrice: number;
  toppings?: OrderItemTopping[];
  itemTotal?: number;
};

export type Order = {
  _id: string;
  orderNumber?: string;
  branch: Branch | string;
  items: OrderItem[];
  subtotal: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount: number;
  total: number;
  status: OrderStatus;
  customerName: string;
  cashierName?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

// ─── Shift ───────────────────────────────────────────────────────────────────

export type ShiftStatus = 'open' | 'closed';

export type Shift = {
  _id: string;
  branch: Branch | string;
  cashierName: string;
  openingCash: number;
  closingCash?: number;
  status: ShiftStatus;
  openedAt: string;
  closedAt?: string;
  note?: string;
};

export type ShiftSummary = Shift & {
  totalOrders: number;
  totalRevenue: number;
  totalCash: number;
  totalCard: number;
  totalQr: number;
};

// GET /shifts/:id/summary — live transaction totals for a shift
export type ShiftTransactions = {
  orders: number;
  revenue: number;
  cashRevenue: number;
  cardRevenue: number;
  qrRevenue: number;
  totalDiscount: number;
};

// ─── Payment ─────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card' | 'qr';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

export type Payment = {
  _id: string;
  branch: Branch | string;
  order: Order | string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  cashReceived?: number;
  changeGiven?: number;
  note?: string;
  paidAt?: string;
  createdAt: string;
};

// ─── Reports ─────────────────────────────────────────────────────────────────

// GET /reports/sales
export type SalesReportOverview = {
  totalRevenue: number;
  totalTransactions: number;
  averageTransaction: number;
  totalCashReceived: number;
  totalChangeGiven: number;
};

export type SalesReportByMethod = {
  method: 'cash' | 'card' | 'qr';
  total: number;
  count: number;
};

export type SalesReportByDay = {
  date: string;
  revenue: number;
  transactions: number;
};

export type SalesReport = {
  overview: SalesReportOverview;
  refunds: { total: number; count: number };
  byMethod: SalesReportByMethod[];
  byDay: SalesReportByDay[];
};

// GET /reports/products
export type ProductReportItem = {
  productId: string;
  productName: string;
  categoryName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalOrders: number;
  averageUnitPrice: number;
};

export type ProductReportByCategory = {
  categoryId: string;
  categoryName: string;
  totalQuantity: number;
  totalRevenue: number;
};

export type ProductReport = {
  topProducts: ProductReportItem[];
  bottomProducts: ProductReportItem[];
  byCategory: ProductReportByCategory[];
};

// GET /reports/orders
export type OrderSummaryByStatus = {
  status: OrderStatus | string;
  count: number;
  totalValue: number;
};

export type OrderSummaryReport = {
  overview: {
    totalOrders: number;
    totalValue: number;
    averageOrderValue: number;
    avgItemsPerOrder: number;
  };
  byStatus: OrderSummaryByStatus[];
  byDay: { date: string; orders: number; revenue: number }[];
};

// GET /reports/cashiers
export type CashierReportItem = {
  cashierName: string;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
};

export type CashierReport = {
  cashiers: CashierReportItem[];
};

// GET /reports/branches
export type BranchReportItem = {
  branchId: string;
  branchName: string;
  branchAddress?: string;
  branchPhone?: string;
  branchEmail?: string;
  branchIsActive?: boolean;
  totalOrders: number;
  totalOrderValue: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
  transactions: number;
};

export type BranchReport = {
  branches: BranchReportItem[];
};

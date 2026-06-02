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
  branches: Branch[];
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

import { storage } from '../../lib/storage';
import {
  Branch, Category, Order, OrderItem, Paginated, Payment, PaymentMethod,
  Product, Shift, Subscription, User, UserRole,
} from '../../types/api.types';

/**
 * In-memory backend used while the app is between servers.
 *
 * Everything the screens read comes from here. The dataset is generated once
 * from a fixed seed, so figures stay identical across reloads instead of
 * jittering every time a screen refetches. Writes (create/update/delete) mutate
 * these same arrays and survive until the JS bundle reloads.
 *
 * Swapping the real API back in means reimplementing the seven service modules
 * against HTTP again — nothing in `app/` or `components/` knows this exists.
 */

// ─── Deterministic RNG ────────────────────────────────────────────────────────

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const rng = makeRng(20260921);

function pick<T>(items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function between(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function iso(d: Date): string {
  return d.toISOString();
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Seeds ────────────────────────────────────────────────────────────────────

/** How much history the reports have to work with. */
const HISTORY_DAYS = 60;

const NOW = new Date();

const BRANCH_SEEDS = [
  { code: 'TTPC', name: 'Toul Tompong', address: 'St. 155, Toul Tompong, Phnom Penh', phone: '012 345 678', weight: 1.0 },
  { code: 'CLCB', name: 'Cellcard Branch', address: 'Behind Cellcard HQ, Phnom Penh', phone: '012 782 119', weight: 0.8 },
  { code: 'PHGB', name: 'Penghout Branch', address: 'Street C02, Phnom Penh 121205', phone: '011 904 220', weight: 0.65 },
  { code: 'SNTM', name: 'Sonthormuk', address: 'Sonthormuk, Phnom Penh', phone: '015 663 402', weight: 0.55 },
];

const CATEGORY_SEEDS = ['Coffee Time', 'Matcha', 'Fresh Tea', 'Sweet Drinks', 'Frappe', 'Toppings'];

type ProductSeed = { category: string; name: string; prices: [string, number][] };

const PRODUCT_SEEDS: ProductSeed[] = [
  { category: 'Coffee Time', name: 'Signature Cafe', prices: [['Regular', 2.0]] },
  { category: 'Coffee Time', name: 'Egg Cream Cafe', prices: [['Regular', 2.0]] },
  { category: 'Coffee Time', name: 'Salt Egg Cafe', prices: [['Regular', 2.0]] },
  { category: 'Coffee Time', name: 'Milk Cafe', prices: [['Regular', 1.63], ['Large', 2.13]] },
  { category: 'Coffee Time', name: 'Black Coffee', prices: [['Regular', 1.25], ['Large', 1.75]] },
  { category: 'Coffee Time', name: 'Iced Latte', prices: [['Regular', 2.25], ['Large', 2.75]] },
  { category: 'Coffee Time', name: 'Cappuccino', prices: [['Regular', 2.5]] },
  { category: 'Matcha', name: 'Matcha Latte', prices: [['Regular', 2.75], ['Large', 3.25]] },
  { category: 'Matcha', name: 'Matcha Strawberry', prices: [['Regular', 3.0]] },
  { category: 'Matcha', name: 'Matcha Coconut', prices: [['Regular', 3.0]] },
  { category: 'Fresh Tea', name: 'Lemon Tea', prices: [['Regular', 1.5], ['Large', 2.0]] },
  { category: 'Fresh Tea', name: 'Peach Tea', prices: [['Regular', 1.75], ['Large', 2.25]] },
  { category: 'Fresh Tea', name: 'Jasmine Milk Tea', prices: [['Regular', 2.0], ['Large', 2.5]] },
  { category: 'Sweet Drinks', name: 'Chocolate Machiato', prices: [['Regular', 2.5]] },
  { category: 'Sweet Drinks', name: 'Chocolate Egg', prices: [['Regular', 2.5]] },
  { category: 'Sweet Drinks', name: 'Strawberry Milk', prices: [['Regular', 2.25]] },
  { category: 'Frappe', name: 'Coffee Frappe', prices: [['Regular', 3.0], ['Large', 3.5]] },
  { category: 'Frappe', name: 'Oreo Frappe', prices: [['Regular', 3.25], ['Large', 3.75]] },
  { category: 'Frappe', name: 'Matcha Frappe', prices: [['Regular', 3.25]] },
];

const TOPPING_SEEDS: ProductSeed[] = [
  { category: 'Toppings', name: 'Extra Shot', prices: [['Regular', 0.5]] },
  { category: 'Toppings', name: 'Boba Pearl', prices: [['Regular', 0.5]] },
  { category: 'Toppings', name: 'Coconut Jelly', prices: [['Regular', 0.4]] },
  { category: 'Toppings', name: 'Whipped Cream', prices: [['Regular', 0.35]] },
];

const CUSTOMER_NAMES = [
  '', '', '', '', '', 'Sophea', 'Dara', 'Chanthou', 'Nita', 'Vibol', 'Sreyneang', 'Rithy',
];

// ─── Build the dataset ────────────────────────────────────────────────────────

function timestamps(createdAt: string) {
  return { createdAt, updatedAt: createdAt };
}

const createdLongAgo = iso(new Date(NOW.getTime() - HISTORY_DAYS * 864e5));

const branches: Branch[] = BRANCH_SEEDS.map((seed, idx) => ({
  _id: `br_${idx + 1}`,
  name: seed.name,
  address: seed.address,
  phone: seed.phone,
  email: `${seed.code.toLowerCase()}@bongpos.com`,
  isActive: true,
  ...timestamps(createdLongAgo),
}));

const categories: Category[] = CATEGORY_SEEDS.map((name, idx) => ({
  _id: `cat_${idx + 1}`,
  name,
  isActive: true,
}));

function categoryByName(name: string): Category {
  return categories.find(c => c.name === name)!;
}

function buildProducts(): Product[] {
  const build = (seed: ProductSeed, idx: number, type: 'main' | 'topping'): Product => ({
    _id: `prd_${type === 'main' ? 'm' : 't'}${idx + 1}`,
    name: seed.name,
    description: undefined,
    type,
    category: categoryByName(seed.category),
    sizes: seed.prices.map(([name, price]) => ({ name, price, isAvailable: true })),
    imageUrl: undefined,
    // A couple of items are parked as unavailable so the "Hidden" state is visible.
    isAvailable: !(type === 'main' && (idx === 6 || idx === 15)),
    branches: [...branches],
    ...timestamps(createdLongAgo),
  });

  return [
    ...PRODUCT_SEEDS.map((seed, idx) => build(seed, idx, 'main')),
    ...TOPPING_SEEDS.map((seed, idx) => build(seed, idx, 'topping')),
  ];
}

const products: Product[] = buildProducts();
const mainProducts = products.filter(p => p.type === 'main' && p.isAvailable);
const toppings = products.filter(p => p.type === 'topping');

function buildUsers(): User[] {
  const admin: User = {
    _id: 'usr_1',
    name: 'Super Admin',
    email: 'admin@bongpos.com',
    role: 'super_admin',
    branch: null,
    isActive: true,
    ...timestamps(createdLongAgo),
  };

  const staff = branches.flatMap((branch, idx) => {
    const code = BRANCH_SEEDS[idx].code.toLowerCase();
    const manager: User = {
      _id: `usr_m${idx + 1}`,
      name: `${branch.name} Manager`,
      email: `manager.${code}@bongpos.com`,
      role: 'manager',
      branch,
      isActive: true,
      ...timestamps(createdLongAgo),
    };
    const cashier: User = {
      _id: `usr_c${idx + 1}`,
      name: `Cashier ${branch.name}`,
      email: `cashier.${code}@bongpos.com`,
      role: 'cashier',
      // One inactive account so the Staff screen shows that state.
      isActive: idx !== 3,
      branch,
      ...timestamps(createdLongAgo),
    };
    return [manager, cashier];
  });

  return [admin, ...staff];
}

const users: User[] = buildUsers();

function cashierFor(branch: Branch): string {
  const cashier = users.find(u => u.role === 'cashier' && typeof u.branch === 'object' && u.branch?._id === branch._id);
  return cashier?.name ?? `Cashier ${branch.name}`;
}

const PAYMENT_MIX: PaymentMethod[] = [
  'qr', 'qr', 'qr', 'qr', 'qr', 'qr', 'card', 'card', 'cash', 'cash',
];

function buildOrdersAndPayments(): { orders: Order[]; payments: Payment[] } {
  const orders: Order[] = [];
  const payments: Payment[] = [];
  let seq = 0;

  for (let dayOffset = HISTORY_DAYS - 1; dayOffset >= 0; dayOffset--) {
    const day = new Date(NOW.getTime() - dayOffset * 864e5);

    branches.forEach((branch, branchIdx) => {
      const weight = BRANCH_SEEDS[branchIdx].weight;
      // Weekends run busier than weekdays.
      const weekendLift = day.getDay() === 0 || day.getDay() === 6 ? 1.35 : 1;
      const count = Math.max(1, Math.round(between(7, 16) * weight * weekendLift));

      for (let n = 0; n < count; n++) {
        const placed = new Date(day);
        placed.setHours(between(7, 19), between(0, 59), between(0, 59), 0);
        // Today's orders can't be in the future.
        if (placed > NOW) placed.setTime(NOW.getTime() - between(1, 90) * 60_000);

        const items: OrderItem[] = [];
        const lines = between(1, 3);
        for (let l = 0; l < lines; l++) {
          const product = pick(mainProducts);
          const size = pick(product.sizes);
          const quantity = rng() < 0.78 ? 1 : 2;
          const lineToppings = rng() < 0.28
            ? [pick(toppings)].map(t => ({ product: t._id, name: t.name, price: t.sizes[0].price }))
            : [];
          const extras = lineToppings.reduce((sum, t) => sum + t.price, 0);
          items.push({
            product,
            size: size.name,
            quantity,
            unitPrice: size.price,
            toppings: lineToppings,
            itemTotal: round2((size.price + extras) * quantity),
          });
        }

        const subtotal = round2(items.reduce((sum, item) => sum + (item.itemTotal ?? 0), 0));
        const discounted = rng() < 0.12;
        const percentage = discounted && rng() < 0.6;
        const discountValue = discounted ? (percentage ? 10 : 0.5) : 0;
        const discountAmount = discounted
          ? round2(percentage ? subtotal * 0.1 : Math.min(0.5, subtotal))
          : 0;

        seq += 1;
        const cancelled = rng() < 0.03;
        const createdAt = iso(placed);
        const order: Order = {
          _id: `ord_${seq}`,
          orderNumber: `${BRANCH_SEEDS[branchIdx].code}${dayKey(placed).replace(/-/g, '')}${String(n + 1).padStart(4, '0')}`,
          branch,
          items,
          subtotal,
          discountType: discounted ? (percentage ? 'percentage' : 'fixed') : undefined,
          discountValue: discounted ? discountValue : undefined,
          discountAmount,
          total: round2(subtotal - discountAmount),
          status: cancelled ? 'cancelled' : 'completed',
          customerName: pick(CUSTOMER_NAMES),
          cashierName: cashierFor(branch),
          note: undefined,
          ...timestamps(createdAt),
        };
        orders.push(order);

        if (!cancelled) {
          const method = pick(PAYMENT_MIX);
          const cashReceived = method === 'cash' ? Math.ceil(order.total) : undefined;
          payments.push({
            _id: `pay_${seq}`,
            branch,
            order: order._id,
            amount: order.total,
            method,
            status: 'paid',
            cashReceived,
            changeGiven: cashReceived != null ? round2(cashReceived - order.total) : undefined,
            paidAt: createdAt,
            createdAt,
          });
        }
      }
    });
  }

  // Newest first, the order every list screen expects.
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { orders, payments };
}

const { orders, payments } = buildOrdersAndPayments();

function buildShifts(): Shift[] {
  const shifts: Shift[] = [];
  let seq = 0;

  for (let dayOffset = 5; dayOffset >= 0; dayOffset--) {
    branches.forEach(branch => {
      const day = new Date(NOW.getTime() - dayOffset * 864e5);
      const opened = new Date(day);
      opened.setHours(7, between(0, 20), 0, 0);
      const closed = new Date(day);
      closed.setHours(20, between(0, 40), 0, 0);
      // Today's shifts are still running.
      const open = dayOffset === 0;

      seq += 1;
      shifts.push({
        _id: `shf_${seq}`,
        branch,
        cashierName: cashierFor(branch),
        openingCash: 20,
        closingCash: open ? undefined : round2(20 + between(40, 260)),
        status: open ? 'open' : 'closed',
        openedAt: iso(opened),
        closedAt: open ? undefined : iso(closed),
      });
    });
  }

  return shifts.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

const shifts: Shift[] = buildShifts();

// ─── The mutable store ────────────────────────────────────────────────────────

export const db = { branches, categories, products, users, orders, payments, shifts };

let idCounter = 1000;

/** Ids for records created inside the app, kept distinct from the seeded ones. */
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Network-ish pause so loading states and skeletons still get exercised. */
export function delay<T>(value: T, ms = 120 + Math.floor(Math.random() * 180)): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

export function branchIdOf(value: Branch | string | null | undefined): string {
  if (!value) return '';
  return typeof value === 'object' ? value._id : value;
}

/** The branch the app is currently scoped to, mirroring the x-branch-id header. */
export async function activeBranchId(): Promise<string | null> {
  return storage.getBranchId();
}

/** Orders for the active branch, newest first. */
export async function scopedOrders(): Promise<Order[]> {
  const branchId = await activeBranchId();
  if (!branchId) return db.orders;
  return db.orders.filter(order => branchIdOf(order.branch) === branchId);
}

export async function scopedPayments(): Promise<Payment[]> {
  const branchId = await activeBranchId();
  if (!branchId) return db.payments;
  return db.payments.filter(payment => branchIdOf(payment.branch) === branchId);
}

export async function scopedShifts(): Promise<Shift[]> {
  const branchId = await activeBranchId();
  if (!branchId) return db.shifts;
  return db.shifts.filter(shift => branchIdOf(shift.branch) === branchId);
}

export function findUserById(id: string): User | undefined {
  return db.users.find(user => user._id === id);
}

export function roleOf(name: string): UserRole {
  const lower = name.toLowerCase();
  if (lower.includes('cashier')) return 'cashier';
  if (lower.includes('manager')) return 'manager';
  return 'super_admin';
}

/** Mock errors read like the axios interceptor's normalised ones. */
export function fail(message: string): never {
  throw new Error(message);
}

// ─── Paging ───────────────────────────────────────────────────────────────────

/** Slices a list the way a paginated endpoint would, envelope included. */
export function paginate<T>(items: T[], page = 1, limit = 20): Paginated<T> {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  const start = (safePage - 1) * safeLimit;
  const slice = items.slice(start, start + safeLimit);

  return {
    items: slice,
    page: safePage,
    pageSize: safeLimit,
    total: items.length,
    hasMore: start + slice.length < items.length,
  };
}

// ─── Billing ──────────────────────────────────────────────────────────────────

/**
 * The account's current subscription. Branch count tracks the real branches so
 * the plan screen shows what this account would actually be billed.
 */
export const billing: { subscription: Subscription } = {
  subscription: {
    plan: 'store',
    cycle: 'monthly',
    branches: branches.length,
    status: 'active',
    renewsAt: new Date(NOW.getTime() + 21 * 864e5).toISOString(),
  },
};

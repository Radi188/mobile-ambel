import {
  Branch, BranchReport, Category, OrderSummaryReport, Paginated, ProductReport, SalesReport, Shift, ShiftReport,
  ShiftTransactions, UserRole,
} from '../types/api.types';
import { getApiBaseUrl } from '../lib/serverConfig';

/**
 * Helpers both backends share: reading numbers, ids, lists and envelopes,
 * paging whole lists for the screens, photo addresses, and the records whose
 * shape BongPOS and Ambel agree on (roles, branches, categories, shifts,
 * reports). Each backend's own translations live in services/<backend>/shape.ts.
 */

// ─── Primitives ──────────────────────────────────────────────────────────────

/** Money arrives as a decimal STRING ("2.00"); the app does arithmetic on it. */
export const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** …and goes back the same way. */
export const toMoney = (value: unknown) => toNumber(value).toFixed(2);

export const idOf = (value: any): string =>
  typeof value === 'string' ? value : String(value?.id ?? value?._id ?? '');

/** The list inside a response, however it is wrapped. */
const LIST_KEYS = ['data', 'items', 'results', 'rows', 'records', 'list'];
export function listOf(data: any, depth = 0): any[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object' || depth > 2) return [];
  for (const k of LIST_KEYS) {
    if (data[k] !== undefined) {
      const inner = listOf(data[k], depth + 1);
      if (inner.length || Array.isArray(data[k])) return inner;
    }
  }
  return [];
}

/** A single record, unwrapped from `{ data }` when the server wraps it. */
export const recordOf = (data: any) =>
  data && typeof data === 'object' && !Array.isArray(data) && data.data && !data.id ? data.data : data;

/**
 * The API returns whole lists; the screens page through them. Slicing here
 * keeps `usePaginatedList` and every list screen exactly as they were.
 */
export function paginate<T>(list: T[], page = 1, limit = 20): Paginated<T> {
  const start = (page - 1) * limit;
  return {
    items: list.slice(start, start + limit),
    page,
    pageSize: limit,
    total: list.length,
    hasMore: start + limit < list.length,
  };
}

/** Case-insensitive "does any of these contain the needle". */
export const matches = (needle: string | undefined, ...fields: (string | null | undefined)[]) => {
  const n = needle?.trim().toLowerCase();
  if (!n) return true;
  return fields.some(f => f?.toLowerCase().includes(n));
};

const newestFirst = <T extends { createdAt?: string | null }>(a: T, b: T) =>
  String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
export const sortNewestFirst = <T extends { createdAt?: string | null }>(list: T[]) => [...list].sort(newestFirst);

/**
 * A photo address the phone can load. Uploads may come back as a path
 * ("/uploads/…") or pointing at the server's own localhost, which no phone can
 * reach — both are re-pointed at the server this app talks to.
 */
const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.0\.2\.2)(:\d+)?(?=\/)/i;
export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const origin = getApiBaseUrl().replace(/\/api\/?$/, '');
  if (LOCAL_HOST.test(url)) {
    const path = url.replace(LOCAL_HOST, '');
    if (path.startsWith('/uploads/')) return `${origin}${path}`;
  }
  if (url.startsWith('/')) return `${origin}${url}`;
  return url;
}

/** The display name: English first, then whichever language the record has. */
export const displayName = (r: any): string => r?.nameEn || r?.name || r?.nameKm || r?.nameZh || '';

// ─── Roles ───────────────────────────────────────────────────────────────────

// The server names roles its own way. Anything unrecognised passes through
// untouched rather than guessed at.
const ROLE_NAMES: Record<string, UserRole> = {
  admin: 'super_admin',
  owner: 'super_admin',
  super_admin: 'super_admin',
  superadmin: 'super_admin',
  manager: 'manager',
  cashier: 'cashier',
};

export function normaliseRole(role: any): UserRole {
  const name = typeof role === 'string' ? role : role?.name;
  const key = String(name ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (ROLE_NAMES[key] ?? key) as UserRole;
}

// ─── Branches ────────────────────────────────────────────────────────────────

export function normaliseBranch(branch: any): Branch {
  // Ambel's branch carries its receipt logo as a 1-bit raster (`printLogo`) —
  // thousands of numbers no screen here uses, repeated on every populated order.
  const { printLogo: _printLogo, ...rest } = branch ?? {};
  return {
    ...rest,
    _id: idOf(branch),
    name: branch?.name ?? '',
    address: branch?.address ?? '',
    isActive: branch?.isActive !== false,
    createdAt: branch?.createdAt ?? '',
    updatedAt: branch?.updatedAt ?? '',
  };
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export function normaliseCategory(category: any): Category {
  return {
    ...category,
    _id: idOf(category),
    name: displayName(category),
    isActive: category?.isActive !== false,
  };
}

// ─── Shifts ──────────────────────────────────────────────────────────────────

const isId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || /^[0-9a-f]{24}$/i.test(value);

function cashierNameOf(shift: any): string {
  for (const field of ['cashierName', 'openedByName', 'userName']) {
    if (typeof shift[field] === 'string' && shift[field].trim()) return shift[field];
  }
  for (const field of ['cashier', 'user', 'openedBy', 'staff']) {
    const value = shift[field];
    if (typeof value === 'string' && value.trim() && !isId(value)) return value;
    const name = value?.fullName ?? value?.name ?? value?.email;
    if (typeof name === 'string' && name.trim()) return name;
  }
  return 'Unknown';
}

export function normaliseShift(shift: any): Shift {
  return {
    ...shift,
    _id: idOf(shift),
    branch: shift.branch && typeof shift.branch === 'object'
      ? normaliseBranch(shift.branch)
      : shift.branchId ?? shift.branch ?? '',
    cashierName: cashierNameOf(shift),
    openingCash: toNumber(shift.openingCashUsd ?? shift.openingCash ?? shift.startingCash),
    closingCash: shift.closingCashUsd ?? shift.closingCash ?? shift.endingCash ?? undefined,
    status: shift.status ?? (shift.closedAt ? 'closed' : 'open'),
    openedAt: shift.openedAt ?? shift.createdAt ?? '',
    closedAt: shift.closedAt ?? undefined,
  };
}

export function normaliseShiftSummary(summary: any): ShiftTransactions {
  const s = recordOf(summary) ?? {};
  const num = (...keys: string[]) => {
    for (const k of keys) if (s[k] != null) return toNumber(s[k]);
    return 0;
  };
  return {
    orders: num('orders', 'orderCount', 'totalOrders'),
    revenue: num('revenue', 'totalRevenue', 'totalSales'),
    cashRevenue: num('cashRevenue', 'cashSales', 'totalCash'),
    cardRevenue: num('cardRevenue', 'cardSales', 'totalCard'),
    qrRevenue: num('qrRevenue', 'qrSales', 'totalQr'),
    totalDiscount: num('totalDiscount', 'discountTotal', 'discounts'),
  };
}

// ─── Reports ─────────────────────────────────────────────────────────────────

/**
 * Money arrives as decimal strings ("12.50"). Reports are read-only figures, so
 * rather than map every field by name, numeric strings are turned into numbers
 * throughout — except fields that are ids, names or dates.
 */
const KEEP_AS_TEXT = /(id|name|date|method|status|address|phone|email)$/i;
function numeric<T>(value: any, key = ''): T {
  if (Array.isArray(value)) return value.map(v => numeric(v, key)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, numeric(v, k)])) as T;
  }
  if (typeof value === 'string' && !KEEP_AS_TEXT.test(key) && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    return Number(value) as T;
  }
  return value;
}

export const read = <T>(data: unknown) => numeric<T>(recordOf(data) ?? {});

// Defaults for anything a report leaves out, so the screens never read
// `undefined.total`.
export const normaliseSalesReport = (data: unknown): SalesReport => {
  const r = read<any>(data);
  return {
    ...r,
    overview: {
      totalRevenue: 0, totalTransactions: 0, averageTransaction: 0,
      totalCashReceived: 0, totalChangeGiven: 0,
      ...(r.overview ?? {}),
    },
    refunds: { total: 0, count: 0, ...(r.refunds ?? {}) },
    byMethod: r.byMethod ?? [],
    byDay: r.byDay ?? [],
  };
};

export const normaliseOrderReport = (data: unknown): OrderSummaryReport => {
  const r = read<any>(data);
  return {
    ...r,
    overview: { totalOrders: 0, totalValue: 0, averageOrderValue: 0, avgItemsPerOrder: 0, ...(r.overview ?? {}) },
    byStatus: r.byStatus ?? [],
    byDay: r.byDay ?? [],
  };
};

export const normaliseProductReport = (data: unknown): ProductReport => {
  const r = read<any>(data);
  return { ...r, topProducts: r.topProducts ?? [], bottomProducts: r.bottomProducts ?? [], byCategory: r.byCategory ?? [] };
};

export const normaliseBranchReport = (data: unknown): BranchReport => {
  const r = read<any>(data);
  return { ...r, branches: r.branches ?? listOf(r) };
};

export const normaliseShiftReport = (data: unknown): ShiftReport => {
  const r = read<any>(data);
  return {
    ...r,
    overview: {
      totalShifts: 0, openShifts: 0, totalRevenue: 0, totalCashSales: 0, totalExpenses: 0, totalOrders: 0,
      ...(r.overview ?? {}),
    },
    shifts: (r.shifts ?? []).map((row: any) => ({
      ...row,
      shiftId: String(row.shiftId ?? row.id ?? ''),
      cashierName: row.cashierName || 'Cashier',
      branchName: row.branchName ?? '',
      revenue: toNumber(row.revenue),
      orders: toNumber(row.orders),
      transactions: toNumber(row.transactions),
      cashSales: toNumber(row.cashSales),
      openingCash: toNumber(row.openingCash),
      closingCash: toNumber(row.closingCash),
      expenses: toNumber(row.expenses),
      difference: row.difference == null ? null : toNumber(row.difference),
    })),
  };
};

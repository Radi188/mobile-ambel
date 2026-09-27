import {
  AuthUser, Branch, Category, Order, OrderItem, Paginated, Product, ProductSize,
  Shift, ShiftTransactions, User, UserRole,
} from '../types/api.types';
import { getApiBaseUrl } from '../lib/serverConfig';

/**
 * The API's shapes, translated into the ones the screens already speak —
 * ported from ambel-mobile's features/{auth,menu,orders,shifts}/shape.js.
 *
 * The server sends `id` (the app reads `_id`), a name per language (`nameEn`,
 * `nameKm`, `nameZh`), money as decimal strings ("2.50"), roles as records and
 * bare arrays instead of paged envelopes. Everything is translated once, here,
 * at the edge, so nothing in `app/` or `components/` had to change.
 */

// ─── Primitives ──────────────────────────────────────────────────────────────

/** Money arrives as a decimal STRING ("2.00"); the app does arithmetic on it. */
export const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** …and goes back the same way. */
export const toMoney = (value: unknown) => toNumber(value).toFixed(2);

const idOf = (value: any): string =>
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
const displayName = (r: any): string => r?.nameEn || r?.name || r?.nameKm || r?.nameZh || '';

// ─── Auth & users ────────────────────────────────────────────────────────────

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

/**
 * `POST /auth/login` → `{ accessToken, user: { id, email, fullName, clientId,
 * branchId, role: { id, name } } }`; `GET /auth/me` → the same account with a
 * flat `roleName`. Both land here.
 */
export function toAuthUser(user: any): AuthUser {
  return {
    userId: idOf(user),
    name: user?.fullName ?? user?.name ?? user?.email ?? '',
    email: user?.email ?? '',
    role: normaliseRole(user?.role ?? user?.roleName),
    branchId: user?.branchId ?? (user?.branch ? idOf(user.branch) : undefined) ?? undefined,
  };
}

export function normaliseUser(user: any): User {
  return {
    ...user,
    _id: idOf(user),
    name: user?.fullName ?? user?.name ?? '',
    email: user?.email ?? '',
    role: normaliseRole(user?.role ?? user?.roleName),
    roleId: (typeof user?.role === 'object' ? user.role?.id : null) ?? user?.roleId ?? null,
    branch: user?.branch && typeof user.branch === 'object'
      ? normaliseBranch(user.branch)
      : user?.branchId ?? user?.branch ?? null,
    isActive: user?.isActive !== false,
    createdAt: user?.createdAt ?? '',
    updatedAt: user?.updatedAt ?? '',
  };
}

// ─── Branches ────────────────────────────────────────────────────────────────

export function normaliseBranch(branch: any): Branch {
  return {
    ...branch,
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

/** The size group: the single-choice group named like "Size". */
export const findSizeGroup = (groups: any[] | undefined) =>
  (groups ?? []).find(g => g?.selectionType === 'single' && /size/i.test(g?.name ?? '')) ?? null;

/**
 * A menu item as the app's Product.
 *
 * The server prices an item flat (`salesPrice`) and models sizes as a variation
 * group whose options carry a `priceDelta`; the app models sizes with absolute
 * prices. An item with no size group reads as one "Regular" size, so
 * `product.sizes[0]` is always there.
 */
export function normaliseMenuItem(item: any, categories?: Map<string, Category>): Product {
  const price = toNumber(item?.salesPrice ?? item?.price);
  const group = findSizeGroup(item?.variationGroups);
  const sizes: ProductSize[] = group
    ? (group.options ?? [])
        .filter((o: any) => o?.isActive !== false)
        .map((o: any) => ({ name: o.name, price: price + toNumber(o.priceDelta), isAvailable: true }))
    : [{ name: 'Regular', price, isAvailable: true }];

  const categoryId = item?.categoryId ?? (item?.category ? idOf(item.category) : '');
  const category = item?.category && typeof item.category === 'object'
    ? normaliseCategory(item.category)
    : categories?.get(categoryId) ?? { _id: categoryId, name: '', isActive: true };

  return {
    ...item,
    _id: idOf(item),
    name: displayName(item),
    description: item?.description ?? undefined,
    type: 'main',
    category,
    sizes,
    imageUrl: resolveImageUrl(item?.imageUrl),
    isAvailable: item?.isActive !== false && item?.isAvailable !== false,
    createdAt: item?.createdAt ?? '',
    updatedAt: item?.updatedAt ?? '',
  };
}

/** A topping is its own resource now; the product list shows it as a one-size item. */
export function normaliseTopping(topping: any): Product {
  const record = topping?.topping ?? topping;
  return {
    ...record,
    _id: idOf(record),
    name: record?.name ?? record?.nameEn ?? '',
    type: 'topping',
    category: { _id: 'toppings', name: 'Toppings', isActive: true },
    sizes: [{ name: 'Regular', price: toNumber(record?.priceDelta ?? record?.price), isAvailable: true }],
    isAvailable: record?.isActive !== false,
    createdAt: record?.createdAt ?? '',
    updatedAt: record?.updatedAt ?? '',
  };
}

type SizeForm = { name: string; price: number; isAvailable?: boolean };

/** The app's sizes → the server's size group (deltas from the cheapest size). */
function toSizeGroup(sizes: SizeForm[], base: number) {
  return {
    name: 'Size',
    selectionType: 'single',
    isRequired: true,
    options: sizes.map(s => ({ name: s.name.trim(), priceDelta: toMoney(s.price - base) })),
  };
}

/**
 * App form → `POST/PATCH /menu-items`.
 *
 * `salesPrice` is the cheapest size. More than one size also becomes a size
 * group — on create only: PATCH rejects `variationGroups`, so an edit's sizes
 * go through `planSizeSync` instead. `isActive` is never sent: the DTO refuses
 * it, and an item is taken off the menu with DELETE.
 */
export function toMenuItemPayload(
  form: { name?: string; description?: string; category?: string; sizes?: SizeForm[]; imageUrl?: string },
  { update = false } = {},
) {
  const payload: Record<string, unknown> = {};
  if (form.name !== undefined) {
    const name = form.name.trim();
    Object.assign(payload, { nameEn: name, nameKm: name, nameZh: name });
  }
  if (form.category) payload.categoryId = form.category;
  if (form.description !== undefined) payload.description = form.description ?? '';
  if (form.imageUrl !== undefined) payload.imageUrl = form.imageUrl;

  const sizes = (form.sizes ?? []).filter(s => s?.name?.trim());
  if (sizes.length) {
    const base = Math.min(...sizes.map(s => toNumber(s.price)));
    payload.salesPrice = toMoney(base);
    if (!update) {
      payload.costPrice = toMoney(0);
      if (sizes.length > 1) payload.variationGroups = [toSizeGroup(sizes, base)];
    }
  }
  return payload;
}

const sameName = (a: unknown, b: unknown) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const cents = (n: unknown) => Math.round(toNumber(n) * 100);

/**
 * Server size group + the editor's sizes → the calls that make them agree, in
 * order. Options are matched by name, so renaming a size is a remove plus an add.
 */
export function planSizeSync(itemId: string, groups: any[] | undefined, sizes: SizeForm[] | undefined) {
  const wanted = (sizes ?? []).filter(s => s?.name?.trim());
  const group = findSizeGroup(groups);
  const groupId = group ? idOf(group) : '';
  type Op = { url: string; method: 'post' | 'patch' | 'delete'; data?: unknown };

  // One size (or none) is not a choice: the item's own price covers it.
  if (wanted.length < 2) return groupId ? [{ url: `/variation-groups/${groupId}`, method: 'delete' } as Op] : [];

  const base = Math.min(...wanted.map(s => toNumber(s.price)));
  const delta = (s: SizeForm) => toMoney(toNumber(s.price) - base);

  if (!groupId) return [{ url: `/menu-items/${itemId}/variation-groups`, method: 'post', data: toSizeGroup(wanted, base) } as Op];

  const existing = (group.options ?? []).filter((o: any) => o?.isActive !== false);
  const ops: Op[] = [];
  for (const s of wanted) {
    const match = existing.find((o: any) => sameName(o.name, s.name));
    if (!match) {
      ops.push({ url: `/variation-groups/${groupId}/options`, method: 'post', data: { name: s.name.trim(), priceDelta: delta(s) } });
    } else if (cents(match.priceDelta) !== cents(delta(s))) {
      ops.push({ url: `/variation-options/${idOf(match)}`, method: 'patch', data: { priceDelta: delta(s) } });
    }
  }
  for (const o of existing) {
    if (!wanted.some(s => sameName(s.name, o.name))) ops.push({ url: `/variation-options/${idOf(o)}`, method: 'delete' });
  }
  return ops;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

function optionNames(line: any): string[] {
  const raw = line.selectedOptions ?? line.options ?? line.variationOptions ?? line.orderItemOptions;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o: any) => (typeof o === 'string' ? o : o?.name ?? o?.variationOption?.name ?? o?.option?.name ?? o?.nameEn))
    .filter(Boolean);
}

function lineToppings(line: any) {
  const raw = line.toppings ?? line.selectedToppings ?? line.orderItemToppings;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => {
      const tp = r?.topping ?? r;
      return {
        product: String(r?.toppingId ?? tp?.id ?? tp?._id ?? ''),
        name: r?.name ?? tp?.name ?? '',
        price: toNumber(r?.price ?? r?.unitPrice ?? r?.priceDelta ?? tp?.priceDelta ?? tp?.price),
      };
    })
    .filter((tp: { name: string }) => tp.name);
}

function normaliseLine(line: any): OrderItem {
  const options = optionNames(line);
  const quantity = toNumber(line.quantity ?? line.qty);
  const unitPrice = toNumber(line.unitPrice ?? line.salesPrice ?? line.price);
  const name = line.name ?? line.menuItem?.nameEn ?? line.nameEn ?? '';
  return {
    ...line,
    // The screens read `product.name` when the product is embedded.
    product: { _id: String(line.menuItemId ?? line.menuItem?.id ?? ''), name } as Product,
    size: line.size ?? options.join(', '),
    quantity,
    unitPrice,
    toppings: lineToppings(line),
    itemTotal: line.lineTotal != null || line.itemTotal != null || line.total != null
      ? toNumber(line.lineTotal ?? line.itemTotal ?? line.total)
      : undefined,
  };
}

/** The reference shown in the list — the order number, or the id's tail. */
function orderReference(order: any): string | undefined {
  const named = order.orderNumber ?? order.number ?? order.orderNo ?? order.code ?? order.invoiceNumber;
  if (named != null && String(named).trim()) return String(named);
  const id = order.id ?? order._id;
  return id ? String(id).slice(-6).toUpperCase() : undefined;
}

export function normaliseOrder(order: any): Order {
  return {
    ...order,
    _id: idOf(order),
    orderNumber: orderReference(order),
    branch: order.branch && typeof order.branch === 'object'
      ? normaliseBranch(order.branch)
      : order.branchId ?? order.branch ?? '',
    items: Array.isArray(order.items) ? order.items.map(normaliseLine) : [],
    subtotal: toNumber(order.subtotal ?? order.total ?? order.grandTotal),
    discountAmount: toNumber(order.discountAmount ?? order.discountTotal ?? order.discount),
    total: toNumber(order.total ?? order.grandTotal),
    status: order.status ?? 'pending',
    customerName: order.customerName ?? '',
    cashierName:
      order.cashierName ?? order.cashier?.fullName ?? order.user?.fullName ?? order.createdBy?.fullName ?? undefined,
    note: order.notes ?? order.note ?? undefined,
    createdAt: order.createdAt ?? order.placedAt ?? '',
    updatedAt: order.updatedAt ?? order.createdAt ?? '',
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

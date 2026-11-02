import { AuthUser, Category, Order, OrderItem, Product, ProductSize, User } from '../../types/api.types';
import {
  displayName, idOf, normaliseBranch, normaliseCategory, normaliseRole, resolveImageUrl, toMoney, toNumber,
} from '../shape';

/**
 * BongPOS's shapes, translated into the ones the screens already speak —
 * ported from ambel-mobile's features/{auth,menu,orders}/shape.js.
 *
 * The server sends `id` (the app reads `_id`), a name per language (`nameEn`,
 * `nameKm`, `nameZh`), money as decimal strings ("2.50"), roles as records and
 * bare arrays instead of paged envelopes. Everything is translated once, here,
 * at the edge, so nothing in `app/` or `components/` had to change.
 */

/**
 * `POST /auth/login` → `{ accessToken, user: { id, email, fullName, clientId,
 * branchId, role: { id, name } } }`; `GET /auth/me` → the same account with a
 * flat `roleName`. Both land here.
 */
export function toAuthUser(user: any): AuthUser {
  return {
    userId: idOf(user),
    name: user?.fullName ?? user?.name ?? user?.email ?? user?.username ?? '',
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

// ─── Menu ────────────────────────────────────────────────────────────────────

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

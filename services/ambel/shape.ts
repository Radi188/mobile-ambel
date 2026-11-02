import { AuthUser, Order, OrderItem, Product, User } from '../../types/api.types';
import type { ProductPayload } from '../products.service';
import { idOf, normaliseBranch, normaliseCategory, normaliseRole, resolveImageUrl, toNumber } from '../shape';

/**
 * api-ambel's shapes, translated into the app's.
 *
 * The app's types were modelled on this API — Mongo `_id`s, sizes with
 * absolute prices, orders that snapshot names — so most records pass straight
 * through. What's left is filling defaults, flattening populated refs, and
 * re-pointing upload paths ("/uploads/…") at the server.
 */

// ─── Auth & users ────────────────────────────────────────────────────────────

/**
 * `POST /auth/login` → `user: { id, name, username, email, role, branchId }`;
 * `GET /auth/me` → the token's payload `{ userId, name, username, role, branchId }`.
 */
export function toAuthUser(user: any): AuthUser {
  return {
    userId: String(user?.userId ?? idOf(user)),
    name: user?.name || user?.username || '',
    email: user?.email ?? '',
    username: user?.username ?? undefined,
    role: normaliseRole(user?.role),
    branchId: user?.branchId ?? (user?.branch ? idOf(user.branch) : undefined) ?? undefined,
  };
}

/** `GET /users` — the branch comes populated (or null for super admins). */
export function normaliseUser(user: any): User {
  return {
    ...user,
    _id: idOf(user),
    name: user?.name ?? '',
    username: user?.username ?? '',
    email: user?.email ?? '',
    role: normaliseRole(user?.role),
    branch: user?.branch && typeof user.branch === 'object'
      ? normaliseBranch(user.branch)
      : user?.branch ?? null,
    isActive: user?.isActive !== false,
    createdAt: user?.createdAt ?? '',
    updatedAt: user?.updatedAt ?? '',
  };
}

// ─── Products ────────────────────────────────────────────────────────────────

/** `GET /products` — category and branches come populated. */
export function normaliseProduct(product: any): Product {
  const category = product?.category && typeof product.category === 'object'
    ? normaliseCategory(product.category)
    : { _id: String(product?.category ?? ''), name: '', isActive: true };

  return {
    ...product,
    _id: idOf(product),
    name: product?.name ?? '',
    description: product?.description || undefined,
    type: product?.type === 'topping' ? 'topping' : 'main',
    category,
    sizes: (product?.sizes ?? []).map((size: any) => ({
      ...size,
      name: size?.name ?? '',
      price: toNumber(size?.price),
      isAvailable: size?.isAvailable !== false,
    })),
    imageUrl: resolveImageUrl(product?.imageUrl),
    isAvailable: product?.isAvailable !== false,
    branches: Array.isArray(product?.branches)
      ? product.branches.filter((b: any) => b && typeof b === 'object').map(normaliseBranch)
      : undefined,
    createdAt: product?.createdAt ?? '',
    updatedAt: product?.updatedAt ?? '',
  };
}

const sameName = (a: unknown, b: unknown) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/**
 * App form → `POST/PATCH /products`.
 *
 * The API validates with `forbidNonWhitelisted`, so only DTO fields are sent.
 * A size may carry per-payment-method price overrides (`prices`, e.g. Grab
 * markups) that the app doesn't edit; PATCH replaces the whole `sizes` array,
 * so each size keeps the overrides of the size it had by the same name.
 */
export function toProductPayload(form: Partial<ProductPayload>, current?: any) {
  const payload: Record<string, unknown> = {};
  if (form.type) payload.type = form.type;
  if (form.name !== undefined) payload.name = form.name.trim();
  if (form.description !== undefined) payload.description = form.description ?? '';
  if (form.category) payload.category = form.category;
  if (form.isAvailable !== undefined) payload.isAvailable = form.isAvailable;
  if (form.imageUrl !== undefined) payload.imageUrl = form.imageUrl;

  if (form.sizes) {
    const before: any[] = current?.sizes ?? [];
    payload.sizes = form.sizes
      .filter(size => size?.name?.trim())
      .map(size => {
        const prices = before.find(b => sameName(b?.name, size.name))?.prices;
        return {
          name: size.name.trim(),
          price: toNumber(size.price),
          isAvailable: size.isAvailable !== false,
          ...(prices?.length ? { prices: prices.map((p: any) => ({ method: p.method, price: toNumber(p.price) })) } : {}),
        };
      });
  }
  return payload;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

/** A line snapshots the product's name; `product` is an id in the list, populated on detail. */
function normaliseLine(line: any): OrderItem {
  const product = line?.product;
  const name = line?.name || (product && typeof product === 'object' ? product.name : '') || '';
  return {
    ...line,
    product: { _id: idOf(product), name } as Product,
    size: line?.size ?? '',
    quantity: toNumber(line?.quantity),
    unitPrice: toNumber(line?.unitPrice),
    toppings: (line?.toppings ?? []).map((t: any) => ({
      product: idOf(t?.product),
      name: t?.name ?? t?.product?.name ?? '',
      price: toNumber(t?.price),
    })),
    itemTotal: line?.itemTotal != null ? toNumber(line.itemTotal) : undefined,
  };
}

export function normaliseOrder(order: any): Order {
  const id = idOf(order);
  return {
    ...order,
    _id: id,
    orderNumber: order?.orderNumber || (id ? id.slice(-6).toUpperCase() : undefined),
    branch: order?.branch && typeof order.branch === 'object'
      ? normaliseBranch(order.branch)
      : order?.branch ?? '',
    items: Array.isArray(order?.items) ? order.items.map(normaliseLine) : [],
    subtotal: toNumber(order?.subtotal),
    discountAmount: toNumber(order?.discountAmount),
    total: toNumber(order?.total),
    status: order?.status ?? 'completed',
    customerName: order?.customerName ?? '',
    cashierName: order?.cashierName || undefined,
    note: order?.note || undefined,
    createdAt: order?.createdAt ?? '',
    updatedAt: order?.updatedAt ?? order?.createdAt ?? '',
  };
}

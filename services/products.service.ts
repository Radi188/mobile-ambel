import { Branch, Category, PageQuery, Paginated, Product, ProductReport } from '../types/api.types';
import {
  activeBranchId, branchIdOf, db, delay, fail, nextId, nowIso, paginate, scopedOrders,
} from './mock/store';
import { filterOrders, productReport } from './mock/reports';

export type ProductQuery = PageQuery & {
  category?: string;
  type?: 'main' | 'topping';
  search?: string;
};

export type ProductSizePayload = {
  name: string;
  price: number;
  isAvailable?: boolean;
};

export type ProductPayload = {
  name: string;
  type?: 'main' | 'topping';
  description?: string;
  category: string;
  sizes: ProductSizePayload[];
  isAvailable?: boolean;
  imageUrl?: string;
  branches?: string[];
};

function categoryId(product: Product): string {
  return typeof product.category === 'object' ? product.category._id : String(product.category ?? '');
}

function resolveBranches(ids?: string[], fallback?: string | null): Branch[] {
  if (ids?.length) return db.branches.filter(branch => ids.includes(branch._id));
  if (fallback) return db.branches.filter(branch => branch._id === fallback);
  return [...db.branches];
}

export const productsService = {
  /**
   * GET /products?page=&limit=&category=&type=&search= → Paginated<Product>
   *
   * Scoped to the active branch, the way the x-branch-id header used to be.
   * Category filtering is a server-side param now that the list is paged —
   * filtering a single page in memory would hide matches on later pages.
   */
  getProducts: async ({ category, type, search, page = 1, limit = 20 }: ProductQuery = {}): Promise<Paginated<Product>> => {
    const branch = await activeBranchId();
    const needle = search?.trim().toLowerCase();

    const list = db.products.filter(product => {
      if (branch && !(product.branches ?? []).some(b => branchIdOf(b) === branch)) return false;
      if (category && categoryId(product) !== category) return false;
      if (type && product.type !== type) return false;
      if (needle && !product.name.toLowerCase().includes(needle)) return false;
      return true;
    });

    return delay(paginate(list, page, limit));
  },

  /**
   * GET /categories → Category[]
   *
   * Only categories that actually have products in the active branch, so the
   * filter row can't offer a chip that returns an empty page.
   */
  getCategories: async (): Promise<Category[]> => {
    const branch = await activeBranchId();
    const present = new Set(
      db.products
        .filter(product => !branch || (product.branches ?? []).some(b => branchIdOf(b) === branch))
        .map(categoryId),
    );
    return delay(db.categories.filter(category => present.has(category._id)));
  },

  getProductReport: async (dateFrom?: string, dateTo?: string) =>
    delay(productReport(filterOrders(await scopedOrders(), { dateFrom, dateTo })) as ProductReport),

  create: async (dto: ProductPayload) => {
    const category = db.categories.find(c => c._id === dto.category);
    if (!category) fail('Pick a category first.');

    const product: Product = {
      _id: nextId('prd'),
      name: dto.name,
      description: dto.description,
      type: dto.type ?? 'main',
      category,
      sizes: dto.sizes.map(size => ({
        name: size.name,
        price: size.price,
        isAvailable: size.isAvailable ?? true,
      })),
      imageUrl: dto.imageUrl,
      isAvailable: dto.isAvailable ?? true,
      branches: resolveBranches(dto.branches, await activeBranchId()),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.products.unshift(product);
    return delay(product);
  },

  update: async (id: string, dto: Partial<ProductPayload>) => {
    const product = db.products.find(p => p._id === id);
    if (!product) fail('Product not found.');

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.type !== undefined) product.type = dto.type;
    if (dto.isAvailable !== undefined) product.isAvailable = dto.isAvailable;
    if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl;
    if (dto.category) {
      const category = db.categories.find(c => c._id === dto.category);
      if (category) product.category = category;
    }
    if (dto.sizes) {
      product.sizes = dto.sizes.map(size => ({
        name: size.name,
        price: size.price,
        isAvailable: size.isAvailable ?? true,
      }));
    }
    if (dto.branches) product.branches = resolveBranches(dto.branches);
    product.updatedAt = nowIso();

    return delay(product);
  },

  remove: (id: string) => {
    const index = db.products.findIndex(product => product._id === id);
    if (index < 0) fail('Product not found.');
    db.products.splice(index, 1);
    return delay(undefined as void);
  },

  toggleSize: (id: string, sizeName: string, isAvailable: boolean) => {
    const product = db.products.find(p => p._id === id);
    if (!product) fail('Product not found.');
    const size = product.sizes.find(s => s.name === sizeName);
    if (size) size.isAvailable = isAvailable;
    product.updatedAt = nowIso();
    return delay(product);
  },

  // No upload target while the app is on mock data — the picked file's local
  // URI is stored as-is, which renders fine in <Image> on device.
  uploadImage: (id: string, image: { uri: string; name: string; type: string }) => {
    const product = db.products.find(p => p._id === id);
    if (!product) fail('Product not found.');
    product.imageUrl = image.uri;
    product.updatedAt = nowIso();
    return delay(product, 350);
  },

  getBranches: () => delay([...db.branches]),
};

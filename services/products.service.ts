import { http } from '../lib/api';
import { Branch, Category, PageQuery, Paginated, Product, ProductReport } from '../types/api.types';
import {
  listOf, matches, normaliseCategory, normaliseMenuItem, normaliseTopping, paginate,
  planSizeSync, recordOf, resolveImageUrl, toMenuItemPayload, toMoney,
} from './shape';
import { branchesService } from './branches.service';
import { reportsService } from './reports.service';

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
};

const fetchCategories = async (): Promise<Category[]> =>
  listOf(await http.get('/categories')).map(normaliseCategory);

/**
 * The menu API:
 *
 *   GET/POST /menu-items           PATCH/DELETE /menu-items/:id
 *   GET      /categories           GET/POST/PATCH/DELETE /toppings
 *   POST     /uploads/images       (multipart, field "file")
 *
 *   sizes → POST /menu-items/:id/variation-groups, /variation-groups/:id/options,
 *           PATCH/DELETE /variation-options/:id
 *
 * A menu item's category comes back as an id, so the category list is fetched
 * alongside to give each product its name.
 */
export const productsService = {
  getProducts: async ({ category, type, search, page = 1, limit = 20 }: ProductQuery = {}): Promise<Paginated<Product>> => {
    let list: Product[];
    if (type === 'topping') {
      list = listOf(await http.get('/toppings')).map(normaliseTopping);
    } else {
      const [items, categories] = await Promise.all([
        http.get('/menu-items', { params: category ? { categoryId: category } : undefined }),
        fetchCategories().catch(() => [] as Category[]),
      ]);
      const byId = new Map(categories.map(c => [c._id, c]));
      list = listOf(items).map(item => normaliseMenuItem(item, byId));
    }
    const filtered = list.filter(p =>
      (!category || p.category?._id === category) && matches(search, p.name));
    return paginate(filtered, page, limit);
  },

  getCategories: async (): Promise<Category[]> =>
    (await fetchCategories()).filter(c => c.isActive),

  getProductReport: async (dateFrom?: string, dateTo?: string): Promise<ProductReport> =>
    reportsService.getProducts({ dateFrom, dateTo }),

  create: async (dto: ProductPayload) => {
    if (dto.type === 'topping') {
      return normaliseTopping(recordOf(await http.post('/toppings', {
        name: dto.name.trim(),
        priceDelta: toMoney(dto.sizes[0]?.price ?? 0),
      })));
    }
    const created = normaliseMenuItem(recordOf(await http.post('/menu-items', toMenuItemPayload(dto))));
    // New items are active; one saved as unavailable is taken off the menu straight away.
    if (dto.isAvailable === false) await http.delete(`/menu-items/${created._id}`);
    return created;
  },

  /**
   * Item fields go through PATCH; sizes through the variation routes, diffed
   * against what the server holds now. `isAvailable: false` takes the item off
   * the menu (DELETE deactivates rather than removes).
   */
  update: async (id: string, dto: Partial<ProductPayload>) => {
    if (dto.type === 'topping') {
      return normaliseTopping(recordOf(await http.patch(`/toppings/${id}`, {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sizes?.length ? { priceDelta: toMoney(dto.sizes[0].price) } : {}),
        ...(dto.isAvailable !== undefined ? { isActive: dto.isAvailable } : {}),
      })));
    }

    await http.patch(`/menu-items/${id}`, toMenuItemPayload(dto, { update: true }));

    if (dto.sizes) {
      const current: any = recordOf(await http.get(`/menu-items/${id}`));
      for (const op of planSizeSync(id, current?.variationGroups, dto.sizes)) {
        if (op.method === 'delete') await http.delete(op.url);
        else await http[op.method](op.url, op.data);
      }
    }
    if (dto.isAvailable === false) await http.delete(`/menu-items/${id}`);

    return normaliseMenuItem(recordOf(await http.get(`/menu-items/${id}`)));
  },

  remove: async (id: string) => { await http.delete(`/menu-items/${id}`); },

  /** Uploads the photo, then stores its address on the item as the thumbnail. */
  uploadImage: async (id: string, image: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('file', image as any);
    const res: any = recordOf(await http.post('/uploads/images', form));
    const url = typeof res === 'string' ? res : res?.url ?? res?.imageUrl ?? res?.fileUrl ?? res?.path;
    if (!url) throw new Error('The upload did not return an image address.');
    await http.patch(`/menu-items/${id}`, { imageUrl: resolveImageUrl(url) });
    return normaliseMenuItem(recordOf(await http.get(`/menu-items/${id}`)));
  },

  getBranches: (): Promise<Branch[]> => branchesService.getBranches(),
};

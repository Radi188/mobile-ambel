import { http } from '../../lib/api';
import { Branch, Category, Paginated, Product, ProductReport } from '../../types/api.types';
import type { ProductPayload, ProductQuery } from '../products.service';
import { listOf, matches, normaliseCategory, paginate, recordOf } from '../shape';
import { normaliseProduct, toProductPayload } from './shape';
import { ambelBranches } from './branches';
import { ambelReports } from './reports';

const fetchCategories = async (): Promise<Category[]> =>
  listOf(await http.get('/categories')).map(normaliseCategory);

/**
 * api-ambel — src/products and src/categories
 *
 *   GET/POST /products?type=&category=&search=   PATCH/DELETE /products/:id
 *   POST     /products/:id/image   (multipart, field "image")
 *   GET      /categories
 *
 * Main items and toppings are one resource, told apart by `type`, with sizes
 * priced absolutely — the app's own model. Reads are scoped to the branch
 * being viewed (x-branch-id); a new product is created in that branch.
 */
export const ambelProducts = {
  getProducts: async ({ category, type, search, page = 1, limit = 20 }: ProductQuery = {}): Promise<Paginated<Product>> => {
    const data = await http.get('/products', { params: { type: type ?? 'main', category, search } });
    const list = listOf(data).map(normaliseProduct).filter(p =>
      (!category || p.category?._id === category) && matches(search, p.name, p.description));
    return paginate(list, page, limit);
  },

  getCategories: async (): Promise<Category[]> =>
    (await fetchCategories()).filter(c => c.isActive),

  getProductReport: async (dateFrom?: string, dateTo?: string): Promise<ProductReport> =>
    ambelReports.getProducts({ dateFrom, dateTo }),

  create: async (dto: ProductPayload) =>
    normaliseProduct(recordOf(await http.post('/products', toProductPayload(dto)))),

  /** Sizes replace the whole array, so the current ones are read first to keep their price overrides. */
  update: async (id: string, dto: Partial<ProductPayload>) => {
    const current = dto.sizes ? recordOf(await http.get(`/products/${id}`)) : undefined;
    return normaliseProduct(recordOf(await http.patch(`/products/${id}`, toProductPayload(dto, current))));
  },

  remove: async (id: string) => { await http.delete(`/products/${id}`); },

  /** The server stores the file and sets it as the product's image in one call. */
  uploadImage: async (id: string, image: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('image', image as any);
    return normaliseProduct(recordOf(await http.post(`/products/${id}/image`, form)));
  },

  getBranches: (): Promise<Branch[]> => ambelBranches.getBranches(),
};

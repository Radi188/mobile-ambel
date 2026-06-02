import api from '../lib/api';
import { Product, Category, ProductReport, Branch } from '../types/api.types';

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

export const productsService = {
  getProducts: (categoryId?: string, type?: string, search?: string) =>
    api.get('/products', { params: { category: categoryId, type, search } }) as unknown as Promise<Product[]>,

  getCategories: () =>
    api.get('/categories') as unknown as Promise<Category[]>,

  getProductReport: (dateFrom?: string, dateTo?: string) =>
    api.get('/reports/products', { params: { dateFrom, dateTo } }) as unknown as Promise<ProductReport>,

  create: (dto: ProductPayload) =>
    api.post('/products', dto) as unknown as Promise<Product>,

  update: (id: string, dto: Partial<ProductPayload>) =>
    api.patch(`/products/${id}`, dto) as unknown as Promise<Product>,

  remove: (id: string) =>
    api.delete(`/products/${id}`) as unknown as Promise<void>,

  toggleSize: (id: string, sizeName: string, isAvailable: boolean) =>
    api.patch(`/products/${id}/size-availability`, { sizeName, isAvailable }) as unknown as Promise<Product>,

  // Multipart upload to POST /products/:id/image (field name "image").
  uploadImage: (id: string, image: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('image', image as any);
    return api.post(`/products/${id}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }) as unknown as Promise<Product>;
  },

  getBranches: () =>
    api.get('/branches') as unknown as Promise<Branch[]>,
};

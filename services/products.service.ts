import { PageQuery } from '../types/api.types';
import { byBackend } from './backend';
import { bongposProducts } from './bongpos/products';
import { ambelProducts } from './ambel/products';

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

export const productsService = byBackend<typeof bongposProducts>({ bongpos: bongposProducts, ambel: ambelProducts });

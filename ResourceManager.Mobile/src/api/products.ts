import { apiClient } from './auth';
import { DEFAULT_PAGE_SIZE } from './config';

export interface ProductService {
  id: number;
  name: string;
  type: string;
  price: number;
  currency?: string;
  description?: string;
  sku?: string;
  vatApplicable?: boolean;
  trackInventory?: boolean;
}

export interface ProductsListResponse {
  items: ProductService[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
}

export interface SaveProductRequest {
  name: string;
  type: string;
  price: number;
  description?: string;
  sku?: string;
  vatApplicable?: boolean;
  trackInventory?: boolean;
}

export const productsApi = {
  list: async (page = 1, size = DEFAULT_PAGE_SIZE): Promise<ProductsListResponse> => {
    const response = await apiClient.get('/ProductServices', { params: { page, size } });
    const d = response.data;
    // Normalize array response
    if (Array.isArray(d)) {
      const items = d.map((p: any) => ({ ...p, price: p.price ?? p.defaultUnitPrice ?? p.DefaultUnitPrice ?? 0 }));
      return { items, page: 1, size: items.length, totalCount: items.length, totalPages: 1 };
    }
    // Backend returns { data/Data, page, size, totalCount, totalPages } — map "data" → "items"
    if (d && (d.data || d.Data)) {
      const raw = d.data ?? d.Data ?? [];
      const items = raw.map((p: any) => ({ ...p, price: p.price ?? p.defaultUnitPrice ?? p.DefaultUnitPrice ?? 0 }));
      return { items, page: d.page ?? d.Page ?? page, size: d.size ?? d.Size ?? size, totalCount: d.totalCount ?? d.TotalCount ?? 0, totalPages: d.totalPages ?? d.TotalPages ?? 0 };
    }
    return d;
  },

  getById: async (id: number): Promise<ProductService> => {
    const response = await apiClient.get(`/ProductServices/${id}`);
    return response.data;
  },

  create: async (data: SaveProductRequest): Promise<ProductService> => {
    const response = await apiClient.post('/ProductServices', data);
    return response.data;
  },

  update: async (id: number, data: SaveProductRequest): Promise<ProductService> => {
    const response = await apiClient.put(`/ProductServices/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/ProductServices/${id}`);
  },
};

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
    // Normalize array response
    if (Array.isArray(response.data)) {
      return { items: response.data, page: 1, size: response.data.length, totalCount: response.data.length, totalPages: 1 };
    }
    return response.data;
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

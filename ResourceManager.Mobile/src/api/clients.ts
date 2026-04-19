import { apiClient } from './auth';
import { DEFAULT_PAGE_SIZE } from './config';

export interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  totalInvoices?: number;
  totalAmount?: number;
}

export interface ClientsListResponse {
  items: Client[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
}

export interface SaveClientRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
}

export const clientsApi = {
  list: async (page = 1, size = DEFAULT_PAGE_SIZE): Promise<ClientsListResponse> => {
    const response = await apiClient.get('/Clients', { params: { page, size } });
    const d = response.data;
    // Backend returns { data, page, size, totalCount, totalPages } — map "data" → "items"
    if (d && !Array.isArray(d) && (d.data || d.Data)) {
      return { items: d.data ?? d.Data ?? [], page: d.page ?? d.Page ?? page, size: d.size ?? d.Size ?? size, totalCount: d.totalCount ?? d.TotalCount ?? 0, totalPages: d.totalPages ?? d.TotalPages ?? 0 };
    }
    if (Array.isArray(d)) {
      return { items: d, page: 1, size: d.length, totalCount: d.length, totalPages: 1 };
    }
    return d;
  },

  getById: async (id: number): Promise<Client> => {
    const response = await apiClient.get(`/Clients/${id}`);
    return response.data;
  },

  create: async (data: SaveClientRequest): Promise<Client> => {
    const response = await apiClient.post('/Clients', data);
    return response.data;
  },

  update: async (id: number, data: SaveClientRequest): Promise<Client> => {
    const response = await apiClient.put(`/Clients/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/Clients/${id}`);
  },
};

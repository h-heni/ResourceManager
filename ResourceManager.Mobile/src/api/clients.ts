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
    return response.data;
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

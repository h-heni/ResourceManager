import { apiClient } from './auth';

export interface Supplier {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
}

export interface SaveSupplierRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
}

export const suppliersApi = {
  list: async (): Promise<Supplier[]> => {
    const response = await apiClient.get('/Suppliers');
    return response.data;
  },

  getById: async (id: number): Promise<Supplier> => {
    const response = await apiClient.get(`/Suppliers/${id}`);
    return response.data;
  },

  create: async (data: SaveSupplierRequest): Promise<Supplier> => {
    const response = await apiClient.post('/Suppliers', data);
    return response.data;
  },

  update: async (id: number, data: SaveSupplierRequest): Promise<Supplier> => {
    const response = await apiClient.put(`/Suppliers/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/Suppliers/${id}`);
  },
};

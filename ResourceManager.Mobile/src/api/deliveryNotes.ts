import { apiClient } from './auth';
import { DEFAULT_PAGE_SIZE } from './config';

export interface DeliveryNote {
  id: number;
  number: string;
  clientName: string;
  date: string;
  totalAmount: number;
  status: string;
  currency?: string;
  currencySymbol?: string;
}

export interface DeliveryNoteDetail extends DeliveryNote {
  items: DeliveryNoteItem[];
  client: { name: string; email: string; phone: string; address: string };
}

export interface DeliveryNoteItem {
  id: number;
  description: string;
  quantity: number;
  price: number;
  taxRate?: number;
  totalItemHT: number;
}

export interface DeliveryNotesListResponse {
  items: DeliveryNote[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
}

export interface SaveDeliveryNoteRequest {
  clientId: number;
  date: string;
  quoteId?: number;
  notes?: string;
  items: { description: string; quantity: number; price: number; taxRate?: number }[];
}

export const deliveryNotesApi = {
  list: async (page = 1, size = DEFAULT_PAGE_SIZE): Promise<DeliveryNotesListResponse> => {
    const response = await apiClient.get('/DeliveryNotes', { params: { page, size } });
    return response.data;
  },

  getById: async (id: number): Promise<DeliveryNoteDetail> => {
    const response = await apiClient.get(`/DeliveryNotes/${id}`);
    return response.data;
  },

  create: async (data: SaveDeliveryNoteRequest): Promise<DeliveryNote> => {
    const response = await apiClient.post('/DeliveryNotes', data);
    return response.data;
  },

  update: async (id: number, data: SaveDeliveryNoteRequest): Promise<DeliveryNote> => {
    const response = await apiClient.put(`/DeliveryNotes/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/DeliveryNotes/${id}`);
  },

  getPdfUrl: (id: number): string => {
    return `/DeliveryNotes/${id}/pdf`;
  },
};

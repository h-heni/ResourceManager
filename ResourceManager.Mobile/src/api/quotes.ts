import { apiClient } from './auth';
import { DEFAULT_PAGE_SIZE, API_BASE_URL } from './config';

export interface Quote {
  id: number;
  number: string;
  clientName: string;
  date: string;
  validUntil?: string;
  totalAmount: number;
  status: string;
  currency?: string;
  currencySymbol?: string;
}

export interface QuoteDetail extends Quote {
  items: QuoteItem[];
  client: { name: string; email: string; phone: string; address: string };
}

export interface QuoteItem {
  id: number;
  description: string;
  quantity: number;
  price: number;
  taxRate?: number;
  totalItemHT: number;
}

export interface QuotesListResponse {
  items: Quote[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
}

export interface SaveQuoteRequest {
  clientId: number;
  date: string;
  validUntil?: string;
  notes?: string;
  items: { description: string; quantity: number; price: number; taxRate?: number }[];
}

export const quotesApi = {
  list: async (page = 1, size = DEFAULT_PAGE_SIZE): Promise<QuotesListResponse> => {
    const response = await apiClient.get('/Quotes', { params: { page, size } });
    return response.data;
  },

  getById: async (id: number): Promise<QuoteDetail> => {
    const response = await apiClient.get(`/Quotes/${id}`);
    return response.data;
  },

  create: async (data: SaveQuoteRequest): Promise<Quote> => {
    const response = await apiClient.post('/Quotes', data);
    return response.data;
  },

  update: async (id: number, data: SaveQuoteRequest): Promise<Quote> => {
    const response = await apiClient.put(`/Quotes/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/Quotes/${id}`);
  },

  convertToInvoice: async (id: number): Promise<any> => {
    const response = await apiClient.post(`/Quotes/${id}/convert-to-invoice`);
    return response.data;
  },

  getPdfUrl: (id: number): string => {
    return `${API_BASE_URL}/Quotes/${id}/pdf`;
  },
};

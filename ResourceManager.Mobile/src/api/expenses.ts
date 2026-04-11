import { apiClient } from './auth';
import { DEFAULT_PAGE_SIZE } from './config';

export interface Expense {
  id: number;
  description: string;
  category: string;
  amount: number;
  date: string;
  supplierId?: number;
  supplierName?: string;
  notes?: string;
  currency?: string;
  currencySymbol?: string;
}

export interface ExpenseSummary {
  totalExpenses: number;
  byCategory: { category: string; total: number }[];
}

export interface SaveExpenseRequest {
  description: string;
  category: string;
  amount: number;
  date: string;
  supplierId?: number;
  notes?: string;
}

export interface ExpensesListResponse {
  items: Expense[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
}

export const expensesApi = {
  list: async (page = 1, size = DEFAULT_PAGE_SIZE, year?: number): Promise<ExpensesListResponse> => {
    const response = await apiClient.get('/Expenses', { params: { page, size, year } });
    // Some backends return array directly, normalize to paginated shape
    if (Array.isArray(response.data)) {
      return { items: response.data, page: 1, size: response.data.length, totalCount: response.data.length, totalPages: 1 };
    }
    return response.data;
  },

  getSummary: async (year?: number): Promise<ExpenseSummary> => {
    const response = await apiClient.get('/Expenses/summary', { params: { year } });
    return response.data;
  },

  create: async (data: SaveExpenseRequest): Promise<Expense> => {
    const response = await apiClient.post('/Expenses', data);
    return response.data;
  },

  update: async (id: number, data: SaveExpenseRequest): Promise<Expense> => {
    const response = await apiClient.put(`/Expenses/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/Expenses/${id}`);
  },
};

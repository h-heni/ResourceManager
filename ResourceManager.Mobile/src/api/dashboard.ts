import { apiClient } from './auth';

export interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  pendingInvoicesAmount: number;
  totalInvoiceCount: number;
  paidInvoiceCount: number;
  pendingInvoicesCount: number;
  partiallyPaidCount: number;
  overdueCount: number;
  activeClients: number;
  totalSuppliers: number;
  selectedCurrency: string;
  revenueChart: RevenueChartPoint[];
  expenseChart: ExpenseChartPoint[];
  growthDisplay: string;
  growthPercentage: number;
}

export interface RevenueChartPoint {
  year: number;
  month: number;
  label: string;
  amount: number;
  count: number;
}

export interface ExpenseChartPoint {
  year: number;
  month: number;
  label: string;
  amount: number;
}

export interface RevenueSummaryResponse {
  totalAllTime: number;
  selectedYearTotal: number;
  revenueByYear: { year: number; total: number }[];
}

export interface PurchasesSummaryResponse {
  totalAllTime: number;
  selectedYearTotal: number;
  purchasesByYear: { year: number; total: number }[];
}

export interface TopClient {
  clientName: string;
  totalRevenue: number;
  invoiceCount: number;
}

export const dashboardApi = {
  getStats: async (year?: number, currency?: string): Promise<DashboardStats> => {
    const response = await apiClient.get('/Dashboard/stats', { params: { year, currency } });
    return response.data;
  },

  getRevenueSummary: async (year?: number, currency?: string): Promise<RevenueSummaryResponse> => {
    const response = await apiClient.get('/Dashboard/revenue-summary', { params: { year, currency } });
    return response.data;
  },

  getPurchasesSummary: async (year?: number, currency?: string): Promise<PurchasesSummaryResponse> => {
    const response = await apiClient.get('/Dashboard/purchases-summary', { params: { year, currency } });
    return response.data;
  },

  getTopClients: async (year?: number, currency?: string): Promise<TopClient[]> => {
    const response = await apiClient.get('/Dashboard/top-clients', { params: { year, currency } });
    return response.data;
  },
};

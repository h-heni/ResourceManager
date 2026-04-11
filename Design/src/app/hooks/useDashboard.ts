import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import {
  dummyDashboardStats,
  dummyExpenseSummary,
  dummyRevenueSummary,
  dummyPurchasesSummary,
  dummyInventoryReport,
  dummyStockAlerts,
} from '../services/dummyData';

export function useDashboardStats(currency: string = 'USD', year: number | null = null) {
  return useQuery({
    queryKey: ['dashboard', currency, year],
    queryFn: async () => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 400));
        return dummyDashboardStats;
      }

      const params: Record<string, string> = {};
      if (currency) params.currency = currency;
      if (year !== null) params.year = String(year);
      const response = await api.get('/Dashboard/stats', { params });
      return response.data;
    },
  });
}

export function useExpenseSummary(year: number | null = null) {
  return useQuery({
    queryKey: ['expenseSummary', year],
    queryFn: async () => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return dummyExpenseSummary;
      }
      const params: Record<string, string> = {};
      if (year !== null) params.year = String(year);
      const res = await api.get('/Expenses/summary', { params });
      return res.data;
    },
  });
}

export function useRevenueSummary(currency: string = 'USD', year: number | null = null) {
  return useQuery({
    queryKey: ['revenueSummary', currency, year],
    queryFn: async () => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return dummyRevenueSummary;
      }
      const params: Record<string, string> = {};
      if (currency) params.currency = currency;
      if (year !== null) params.year = String(year);
      const res = await api.get('/Dashboard/revenue-summary', { params });
      return res.data;
    },
  });
}

export function usePurchasesSummary(currency: string = 'USD', year: number | null = null) {
  return useQuery({
    queryKey: ['purchasesSummary', currency, year],
    queryFn: async () => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return dummyPurchasesSummary;
      }
      const params: Record<string, string> = {};
      if (currency) params.currency = currency;
      if (year !== null) params.year = String(year);
      const res = await api.get('/SupplierInvoices', { params });
      return res.data;
    },
  });
}

export function useInventoryReport() {
  return useQuery({
    queryKey: ['inventoryReport'],
    queryFn: async () => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return dummyInventoryReport;
      }
      const res = await api.get('/Inventory/report');
      return res.data;
    },
  });
}

export function useStockAlerts() {
  return useQuery({
    queryKey: ['stockAlerts'],
    queryFn: async () => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return dummyStockAlerts;
      }
      const res = await api.get('/Inventory/stock-alerts');
      return res.data;
    },
  });
}

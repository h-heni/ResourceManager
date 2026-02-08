import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

// Types
export interface DashboardStats {
    totalInvoices: number;
    totalRevenue: number;
    unpaidInvoices: number;
    unpaidAmount: number;
    totalClients: number;
    totalDevis: number;
    pendingDevis: number;
    monthlyRevenue: MonthlyRevenue[];
    recentInvoices: RecentInvoice[];
}

export interface MonthlyRevenue {
    month: string;
    amount: number;
}

export interface RecentInvoice {
    id: number;
    number: number;
    clientName: string;
    amount: number;
    date: string;
    status: string;
}

// Query Keys
export const dashboardKeys = {
    all: ['dashboard'] as const,
    stats: () => [...dashboardKeys.all, 'stats'] as const,
};

// Hooks
export function useDashboardStats() {
    return useQuery({
        queryKey: dashboardKeys.stats(),
        queryFn: async () => {
            const res = await api.get('/Dashboard/stats');
            return res.data as DashboardStats;
        },
        staleTime: 1000 * 60 * 2, // Refresh dashboard every 2 minutes
    });
}

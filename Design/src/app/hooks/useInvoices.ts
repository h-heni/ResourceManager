import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyInvoices, dummyArchivedInvoices, availableDummyYears } from '../services/dummyData';

interface PaginatedResult<T> {
    items: T[];
    totalCount: number;
}

export function useInvoices(page: number, size: number, enabled = true) {
    return useQuery<PaginatedResult<unknown>>({
        queryKey: ['invoices', 'active', page, size],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                const start = (page - 1) * size;
                const end = start + size;
                const paginated = dummyInvoices.slice(start, end);
                return {
                    items: paginated,
                    totalCount: dummyInvoices.length,
                };
            }
            
            const res = await api.get(`/Invoices?page=${page}&size=${size}&includePaid=false`);
            const payload = res.data || {};
            return {
                items: payload.items || payload.data || [],
                totalCount: payload.totalCount ?? payload.TotalCount ?? 0,
            };
        },
        enabled,
    });
}

export function useArchivedInvoices(year: number | null, page: number, size: number) {
    return useQuery<PaginatedResult<unknown>>({
        queryKey: ['invoices', 'archived', year, page, size],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                const filtered = year 
                    ? dummyArchivedInvoices.filter(inv => new Date(inv.date).getFullYear() === year)
                    : dummyArchivedInvoices;
                const start = (page - 1) * size;
                const end = start + size;
                const paginated = filtered.slice(start, end);
                return {
                    items: paginated,
                    totalCount: filtered.length,
                };
            }
            
            const res = await api.get(`/Archive/invoices?year=${year}&page=${page}&pageSize=${size}`);
            const payload = res.data || {};
            return {
                items: payload.items || [],
                totalCount: payload.totalCount ?? 0,
            };
        },
        enabled: year != null,
    });
}

export function useAvailableYears() {
    return useQuery<{ years: number[]; latestYear: number | null }>({
        queryKey: ['invoices', 'availableYears'],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 200));
                return {
                    years: availableDummyYears,
                    latestYear: availableDummyYears[0] || null,
                };
            }
            
            const res = await api.get('/Archive/years');
            return {
                years: res.data.years || [],
                latestYear: res.data.latestYear ?? null,
            };
        },
    });
}

export function useDeleteInvoice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { success: true };
            }
            return api.delete(`/Invoices/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
            queryClient.invalidateQueries({ queryKey: ['deliveryNotes'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyInventoryItems, dummyStockLevels, dummyStockMovements, dummyProductServiceOptions } from '../services/dummyData';

export interface StockLevel {
    productServiceId: number;
    productName: string;
    currentStock: number;
    reorderPoint: number | null;
    stockValue: number;
    defaultUnitPrice: number;
    stockStatus: string;
    isStockTracked: boolean;
    costPrice?: number;
}

export interface StockMovement {
    id: number;
    date: string;
    productName: string;
    movementType: string;
    quantity: number;
    stockAfter: number;
    referenceNumber: string;
    notes: string;
}

export function useInventory() {
    return useQuery({
        queryKey: ['inventory'],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                return dummyInventoryItems;
            }
            const res = await api.get('/Inventory');
            return res.data || [];
        },
    });
}

export function useStockLevels(params: { search?: string; status?: string; page?: number; size?: number } = {}) {
    return useQuery({
        queryKey: ['stockLevels', params],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                let data = [...dummyStockLevels.data];
                if (params.search) {
                    data = data.filter(d => d.productName.toLowerCase().includes(params.search!.toLowerCase()));
                }
                if (params.status) {
                    data = data.filter(d => d.stockStatus === params.status);
                }
                return {
                    data,
                    totalCount: data.length,
                    totalPages: Math.ceil(data.length / (params.size || 20)),
                };
            }
            const res = await api.get('/Inventory/stock-levels', { params });
            return res.data;
        },
    });
}

export function useStockMovements(params: { type?: string; page?: number; size?: number } = {}) {
    return useQuery({
        queryKey: ['stockMovements', params],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                let data = [...dummyStockMovements.data];
                if (params.type) {
                    data = data.filter(d => d.movementType === params.type);
                }
                return {
                    data,
                    totalCount: data.length,
                    totalPages: Math.ceil(data.length / (params.size || 20)),
                };
            }
            const res = await api.get('/Inventory/movements', { params });
            return res.data;
        },
    });
}

export function useAdjustStock() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { productServiceId: number; newQuantity: number; reason: string }) => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { success: true };
            }
            return api.post('/Inventory/adjust-stock', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
            queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
            queryClient.invalidateQueries({ queryKey: ['inventoryReport'] });
        },
    });
}

export function useRecordMovement() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { productServiceId: number; movementType: string; quantity: number; unitCost?: number; notes?: string }) => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { success: true };
            }
            return api.post('/Inventory/movements', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
            queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
            queryClient.invalidateQueries({ queryKey: ['inventoryReport'] });
        },
    });
}

export function useProductServiceOptions() {
    return useQuery({
        queryKey: ['productServiceOptions'],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 200));
                return dummyProductServiceOptions;
            }
            const res = await api.get('/ProductServices?size=9999');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            return data;
        },
    });
}

export function useInventoryReport() {
    return useQuery({
        queryKey: ['inventoryReport'],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                const { dummyInventoryReport } = require('../services/dummyData');
                await new Promise(resolve => setTimeout(resolve, 300));
                return dummyInventoryReport;
            }
            const res = await api.get('/Inventory/report');
            return res.data;
        },
    });
}

export function useInventoryValuation() {
    return useQuery({
        queryKey: ['inventoryValuation'],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                const { dummyInventoryValuation } = require('../services/dummyData');
                await new Promise(resolve => setTimeout(resolve, 300));
                return dummyInventoryValuation;
            }
            const res = await api.get('/Inventory/valuation');
            return res.data;
        },
    });
}
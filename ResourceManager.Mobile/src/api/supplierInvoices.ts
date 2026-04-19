import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, DEFAULT_PAGE_SIZE, API_TIMEOUT } from './config';
import { authApi, refreshAccessToken, STORAGE_KEYS } from './auth';

// Create axios instance for supplier invoices
const supplierInvoicesClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
});

// Request interceptor to add token
supplierInvoicesClient.interceptors.request.use(async (config) => {
  const token = await authApi.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-refresh expired JWT and retry
supplierInvoicesClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return supplierInvoicesClient(originalRequest);
        }
      } catch {
        await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.REFRESH_TOKEN, STORAGE_KEYS.USER]);
      }
    }
    return Promise.reject(error);
  }
);

// Interfaces
export interface SupplierInvoice {
  id: number;
  fileName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  totalHT: number;
  totalTTC: number;
  TVA: number;
  extractionStatus: string;
  confidenceScore?: number;
  supplierName?: string;
  supplierId?: number;
  amountPaid: number;
  pendingAmount: number;
  remainingAmount: number;
  paymentStatus: 'Paid' | 'PartiallyPaid' | 'Pending';
  currency?: string;
  currencySymbol?: string;
}

export interface SupplierInvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  totalHT: number;
}

export interface SupplierInvoiceListResponse {
  data: SupplierInvoice[];
  page: number;
  size: number;
  totalCount: number;
}

export interface UploadResponse {
  success: boolean;
  tempFilePath: string;
  fileName: string;
  fileType: string;
  rawExtractedText: string;
  extractedData: ExtractedData;
  confidenceScore: number;
  requiresReview: boolean;
  warnings: string[];
  errors: string[];
  message: string;
}

export interface ExtractedData {
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalHT?: number;
  totalTTC?: number;
  TVA?: number;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  currency?: string;
  lineItems: ExtractedLineItem[];
}

export interface ExtractedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  totalHT: number;
}

export interface ConfirmSupplierInvoiceRequest {
  fileName: string;
  tempFilePath: string;
  fileType: string;
  invoiceNumber?: string;
  invoiceDate: Date;
  dueDate?: Date;
  totalHT?: number;
  totalTTC?: number;
  TVA?: number;
  supplierId?: number;
  supplierName?: string;
  supplierAddress?: string;
  supplierPhone?: string;
  rawExtractedText?: string;
  confidenceScore?: number;
  currency?: string;
  currencySymbol?: string;
  items?: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }[];
  purchaseOrderId?: number;
}

// Supplier Invoices API functions
export const supplierInvoicesApi = {
  // List supplier invoices
  list: async (
    page = 1,
    size = DEFAULT_PAGE_SIZE,
    year?: number,
    status?: string
  ): Promise<SupplierInvoiceListResponse> => {
    try {
      const params: any = { page, size };
      if (year) params.year = year;
      if (status) params.status = status;

      const response = await supplierInvoicesClient.get<SupplierInvoiceListResponse>(
        '/SupplierInvoices',
        { params }
      );
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch supplier invoices.');
    }
  },

  // Get by ID
  getById: async (id: number): Promise<SupplierInvoice> => {
    try {
      const response = await supplierInvoicesClient.get<SupplierInvoice>(
        `/SupplierInvoices/${id}`
      );
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch supplier invoice details.');
    }
  },

  // Upload invoice scan (camera capture)
  upload: async (
    fileUri: string,
    fileName: string,
    fileType: 'image/jpeg' | 'image/png' | 'application/pdf',
    supplierId?: number,
    extractedText?: string
  ): Promise<UploadResponse> => {
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: fileType,
        name: fileName,
      } as any);

      if (supplierId) {
        formData.append('supplierId', supplierId.toString());
      }

      if (extractedText && extractedText.trim().length > 0) {
        formData.append('extractedText', extractedText);
      }

      const response = await supplierInvoicesClient.post<UploadResponse>(
        '/SupplierInvoices/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (error) {
      const axiosError = error as any;
      const message = axiosError.response?.data?.message || 'Failed to upload invoice.';
      throw new Error(message);
    }
  },

  // Confirm and save supplier invoice
  confirmNew: async (data: ConfirmSupplierInvoiceRequest): Promise<any> => {
    try {
      const response = await supplierInvoicesClient.post(
        '/SupplierInvoices/confirm-new',
        data
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      const message =
        axiosError.response?.data?.message ||
        'Failed to save supplier invoice.';
      throw new Error(message);
    }
  },

  // Get file URL for download/viewing
  getFileUrl: (id: number): string => {
    return `${API_BASE_URL}/SupplierInvoices/${id}/file`;
  },

  // Discard temp upload
  discard: async (tempFilePath: string): Promise<void> => {
    try {
      await supplierInvoicesClient.post('/SupplierInvoices/discard', {
        tempFilePath,
      });
    } catch (error) {
      throw new Error('Failed to discard upload.');
    }
  },
};

export default supplierInvoicesApi;

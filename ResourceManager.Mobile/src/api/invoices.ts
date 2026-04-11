import axios from 'axios';
import { API_BASE_URL, DEFAULT_PAGE_SIZE, API_TIMEOUT } from './config';
import { authApi } from './auth';

// Create axios instance for invoices
const invoicesClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
});

// Request interceptor to add token
invoicesClient.interceptors.request.use(async (config) => {
  const token = await authApi.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interfaces
export interface Invoice {
  id: number;
  number: string;
  clientName: string;
  clientEmail?: string;
  date: string;
  dueDate?: string;
  totalAmount: number;
  amountPaid: number;
  pendingAmount: number;
  remainingAmount: number;
  status: string;
  isLocked?: boolean;
  currency?: string;
  currencySymbol?: string;
}

export interface InvoiceDetail extends Invoice {
  items: InvoiceItem[];
  payments: Payment[];
  quotes?: {
    id: number;
    number: string;
  }[];
  client: {
    id: number;
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  notes?: string;
}

export interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  price: number;
  taxRate?: number;
  totalItemHT: number;
}

export interface Payment {
  id: number;
  amount: number;
  paymentDate: string;
  notes?: string;
  status: 'Completed' | 'Pending';
  isScheduled?: boolean;
}

export interface InvoicesListResponse {
  data: Invoice[];
  items: Invoice[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
}

export interface SendEmailRequest {
  recipientEmail: string;
  subject: string;
  body: string;
  attachPdf?: boolean;
}

export interface RecordPaymentRequest {
  amount: number;
  paymentDate: string;
  notes?: string;
  isScheduled?: boolean;
}

export interface SaveInvoiceRequest {
  clientId: number;
  date: string;
  dueDate?: string;
  notes?: string;
  quoteId?: number;
  deliveryNoteId?: number;
  items: { description: string; quantity: number; price: number; taxRate?: number }[];
}

// Invoices API functions
export const invoicesApi = {
  list: async (
    page = 1,
    size = DEFAULT_PAGE_SIZE,
    includePaid = true
  ): Promise<InvoicesListResponse> => {
    const response = await invoicesClient.get<InvoicesListResponse>('/Invoices', {
      params: { page, size, includePaid },
    });
    return response.data;
  },

  getById: async (id: number): Promise<InvoiceDetail> => {
    const response = await invoicesClient.get<InvoiceDetail>(`/Invoices/${id}`);
    return response.data;
  },

  create: async (data: SaveInvoiceRequest): Promise<Invoice> => {
    const response = await invoicesClient.post('/Invoices', data);
    return response.data;
  },

  update: async (id: number, data: SaveInvoiceRequest): Promise<Invoice> => {
    const response = await invoicesClient.put(`/Invoices/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await invoicesClient.delete(`/Invoices/${id}`);
  },

  recordPayment: async (id: number, data: RecordPaymentRequest): Promise<void> => {
    await invoicesClient.post(`/Invoices/${id}/payments`, data);
  },

  archive: async (id: number): Promise<void> => {
    await invoicesClient.post(`/Invoices/${id}/archive`);
  },

  getArchived: async (year?: number, page = 1, size = DEFAULT_PAGE_SIZE): Promise<InvoicesListResponse> => {
    const response = await invoicesClient.get('/Archive/invoices', { params: { year, page, size } });
    return response.data;
  },

  getAvailableYears: async (): Promise<number[]> => {
    const response = await invoicesClient.get('/Archive/years');
    return response.data;
  },

  getPdfUrl: (id: number): string => {
    return `${API_BASE_URL}/Invoices/${id}/pdf`;
  },

  getRemainingPaymentPdfUrl: (id: number): string => {
    return `${API_BASE_URL}/Invoices/${id}/remaining-payment-pdf`;
  },

  sendEmail: async (id: number, data: SendEmailRequest): Promise<void> => {
    await invoicesClient.post(`/Invoices/${id}/send-email`, data);
  },

  getEmailHistory: async (id: number): Promise<any[]> => {
    const response = await invoicesClient.get(`/Invoices/${id}/emails`);
    return response.data;
  },
};

export default invoicesApi;

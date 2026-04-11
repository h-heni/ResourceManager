import { apiClient } from './auth';

export interface CompanySettings {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  taxId?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  signatureUrl?: string;
  signerPosition?: string;
  showSignature?: boolean;
  showLogo?: boolean;
  bankName?: string;
  bankIban?: string;
  bankBic?: string;
  vatRate?: number;
  customTaxRate?: number;
  emailSubject?: string;
  emailBody?: string;
  emailSignature?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  whatsappEnabled?: boolean;
  whatsappPhone?: string;
  whatsappApiKey?: string;
  baseStoragePath?: string;
  invoiceLanguage?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const settingsApi = {
  getBranding: async (): Promise<CompanySettings> => {
    const response = await apiClient.get('/Settings/branding');
    return response.data;
  },

  updateBranding: async (data: Partial<CompanySettings>): Promise<void> => {
    await apiClient.put('/Settings/branding', data);
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await apiClient.post('/Auth/change-password', data);
  },

  testEmail: async (): Promise<void> => {
    await apiClient.post('/Settings/test-email');
  },

  whatsappVerify: async (phone: string, apiKey: string): Promise<void> => {
    await apiClient.post('/Settings/whatsapp-verify', { phone, apiKey });
  },

  whatsappDisconnect: async (): Promise<void> => {
    await apiClient.post('/Settings/whatsapp-disconnect');
  },

  setupCompany: async (data: { companyName: string; industry?: string; size?: string }): Promise<void> => {
    await apiClient.post('/Company', data);
  },
};

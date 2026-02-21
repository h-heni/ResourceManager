import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
    Settings, Building2, Mail, Save, Loader2, Upload, X, Image, Info,
    CheckCircle, Eye, PenTool, Trash2, Lock, User, LogOut,
    FileText, FolderOpen, HardDrive, Palette, DollarSign,
    AlertTriangle, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { invalidateSettingsCache } from '../hooks/useSettings';
import { DEFAULT_CURRENCY, CURRENCY_SYMBOL_MAP, CURRENCY_OPTIONS } from '../lib/currencyUtils';
import PasswordInput from '../components/PasswordInput';
import { getErrorMessage, getAxiosResponseData } from '../utils/errorUtils';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface CompanySettings {
    companyName: string;
    companyAddress: string;
    companyTaxId: string;
    companyPhone: string;
    companyEmail: string;
    emailTemplate: string;
    emailSubjectTemplate: string;
    emailSignature: string;
    defaultEmailBody: string;
    logoUrl: string;
    hasLogoData: boolean;
    primaryColor: string;
    secondaryColor: string;
    currency: string;
    currencySymbol: string;
    defaultVatRate: number;
    customTaxEnabled: boolean;
    customTaxName: string;
    customTaxAmount: number;
    pdfFooterText: string;
    showCompanyLogo: boolean;
    pdfSignatureText: string;
    pdfSignerPosition: string;
    invoiceLanguage: string;
    hasSignatureImage: boolean;
    showSignatureOnPdf: boolean;
    proInvoiceUseTokenSignature: boolean;
    bankName: string;
    bankBIC: string;
    bankIBAN: string;
    showBankName: boolean;
    showBankBIC: boolean;
    showBankIBAN: boolean;
    includeLogoInEmailSignature: boolean;
    fileSystemLanguage: string;
    fileSystemLanguageLocked: boolean;
    baseStoragePath: string;
    isProfileComplete: boolean;
}

const EMAIL_PLACEHOLDERS = [
    { key: '@ClientName', description: 'The client\'s full name' },
    { key: '@InvoiceNumber', description: 'The invoice reference number (e.g. FA26-001)' },
    { key: '@TotalAmount', description: 'The total amount due on the invoice' },
    { key: '@DueDate', description: 'The payment deadline date' },
    { key: '@CompanyName', description: 'Your company\'s name' },
    { key: '@CompanyPhone', description: 'Your company phone number' },
    { key: '@CompanyEmail', description: 'Your company email address' },
    { key: '@Date', description: 'Today\'s date' },
];

type SidebarSection = 'personal' | 'email' | 'pdf';
type PersonalTab = 'company' | 'password' | 'userinfo';
type PdfTab = 'signature' | 'branding' | 'financial' | 'storage';

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SettingsPage() {
    const { t } = useTranslation();
    const { canManageSettings, logout, user, displayName, updateProfileComplete } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Section & Tab state
    const [activeSection, setActiveSection] = useState<SidebarSection>('personal');
    const [personalTab, setPersonalTab] = useState<PersonalTab>('company');
    const [pdfTab, setPdfTab] = useState<PdfTab>('signature');

    // Email/SMTP Status
    const [smtpStatus, setSmtpStatus] = useState<{
        smtpHost: string | null;
        smtpPort: number;
        fromEmail: string | null;
        fromName: string | null;
        isConfigured: boolean;
        configurationError: string | null;
    } | null>(null);
    const [testingEmail, setTestingEmail] = useState(false);

    // Signature
    const [uploadingSignature, setUploadingSignature] = useState(false);
    const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);

    // PDF Preview
    const [generatingPreview, setGeneratingPreview] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

    // PDF Storage
    const [consistencyReport, setConsistencyReport] = useState<{ missingFiles?: number; MissingFiles?: number; totalFiles?: number; TotalFiles?: number; existingFiles?: number; ExistingFiles?: number; missingFileDetails?: Array<{ id: number; documentType: string; documentNumber: string; fileName: string }> } | null>(null);
    const [checkingConsistency, setCheckingConsistency] = useState(false);
    const [newBasePath, setNewBasePath] = useState('');
    const [browsingFolders, setBrowsingFolders] = useState(false);
    const [folderBrowser, setFolderBrowser] = useState<{ currentPath?: string; parent?: string; items?: Array<{ path: string; name: string; type: string }> } | null>(null);
    const [browseTarget, setBrowseTarget] = useState<'basePath'>('basePath');
    const [recovering, setRecovering] = useState(false);
    const [recoveryProgress, setRecoveryProgress] = useState<{ current: number; total: number; message: string } | null>(null);

    // Confirmation dialog for locking base storage path
    const [showBasePathLockConfirm, setShowBasePathLockConfirm] = useState(false);

    // Password change
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // Settings data
    const [settings, setSettings] = useState<CompanySettings>({
        companyName: '', companyAddress: '', companyTaxId: '',
        companyPhone: '', companyEmail: '',
        emailTemplate: '',
        emailSubjectTemplate: 'Invoice #@InvoiceNumber from @CompanyName',
        emailSignature: '',
        defaultEmailBody: `Dear @ClientName,

Please find attached invoice #@InvoiceNumber for the amount of @TotalAmount.

Payment is due by @DueDate.

If you have any questions, please contact us at @CompanyPhone or @CompanyEmail.

Best regards,
@CompanyName`,
        logoUrl: '', hasLogoData: false,
        primaryColor: '#065F46', secondaryColor: '#14B8A6',
        currency: DEFAULT_CURRENCY, currencySymbol: DEFAULT_CURRENCY,
        defaultVatRate: 0.19, customTaxEnabled: true,
        customTaxName: 'Timbre Fiscal', customTaxAmount: 1.000,
        pdfFooterText: '', showCompanyLogo: true,
        pdfSignatureText: '', pdfSignerPosition: '', invoiceLanguage: 'fr',
        hasSignatureImage: false, showSignatureOnPdf: false,
        proInvoiceUseTokenSignature: false,
        bankName: '', bankBIC: '', bankIBAN: '',
        showBankName: true, showBankBIC: true, showBankIBAN: true,
        includeLogoInEmailSignature: false,
        fileSystemLanguage: '', fileSystemLanguageLocked: false,
        baseStoragePath: '', isProfileComplete: false,
    });
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

    // ═══════════════════════════════════════════════════════════════
    // DATA FETCHING
    // ═══════════════════════════════════════════════════════════════

    useEffect(() => {
        loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadAll = async () => {
        // Fetch settings first to check hasLogoData/hasSignatureImage flags
        const [settingsData] = await Promise.allSettled([
            fetchSettings(), fetchSmtpStatus()
        ]);

        // Only fetch logo/signature blobs if the backend confirms they exist (avoids 404s)
        const previewFetches: Promise<void>[] = [];
        if (settingsData.status === 'fulfilled' && settingsData.value) {
            if (settingsData.value.hasLogoData) previewFetches.push(fetchLogoPreview());
            if (settingsData.value.hasSignatureImage) previewFetches.push(fetchSignaturePreview());
        }
        if (previewFetches.length > 0) {
            await Promise.allSettled(previewFetches);
        }
    };

    const fetchSmtpStatus = async () => {
        try {
            const res = await api.get('/Settings/email-status');
            setSmtpStatus(res.data);
        } catch {
            setSmtpStatus({ smtpHost: null, smtpPort: 587, fromEmail: null, fromName: null, isConfigured: false, configurationError: 'Failed to load SMTP status' });
        }
    };

    const fetchSettings = async (): Promise<{ hasLogoData: boolean; hasSignatureImage: boolean } | null> => {
        try {
            const res = await api.get('/Settings');
            const hasLogoData = res.data.hasLogoData || false;
            const hasSignatureImage = res.data.hasSignatureImage || false;
            setSettings({
                companyName: res.data.companyName || '',
                companyAddress: res.data.companyAddress || '',
                companyTaxId: res.data.companyTaxId || '',
                companyPhone: res.data.companyPhone || '',
                companyEmail: res.data.companyEmail || '',
                emailTemplate: res.data.emailTemplate || '',
                emailSubjectTemplate: res.data.emailSubjectTemplate || 'Invoice #@InvoiceNumber from @CompanyName',
                emailSignature: res.data.emailSignature || '',
                defaultEmailBody: res.data.defaultEmailBody || settings.defaultEmailBody,
                logoUrl: res.data.logoUrl || '',
                hasLogoData: res.data.hasLogoData || false,
                primaryColor: res.data.primaryColor || '#065F46',
                secondaryColor: res.data.secondaryColor || '#14B8A6',
                currency: res.data.currency || DEFAULT_CURRENCY,
                currencySymbol: res.data.currencySymbol || DEFAULT_CURRENCY,
                defaultVatRate: res.data.defaultVatRate || 0.19,
                customTaxEnabled: res.data.customTaxEnabled ?? true,
                customTaxName: res.data.customTaxName || 'Timbre Fiscal',
                customTaxAmount: res.data.customTaxAmount || 1.000,
                pdfFooterText: res.data.pdfFooterText || '',
                showCompanyLogo: res.data.showCompanyLogo ?? true,
                pdfSignatureText: res.data.pdfSignatureText || '',
                pdfSignerPosition: res.data.pdfSignerPosition || '',
                invoiceLanguage: res.data.invoiceLanguage || 'fr',
                hasSignatureImage: res.data.hasSignatureImage || false,
                showSignatureOnPdf: res.data.showSignatureOnPdf ?? false,
                proInvoiceUseTokenSignature: res.data.proInvoiceUseTokenSignature ?? false,
                bankName: res.data.bankName || '',
                bankBIC: res.data.bankBIC || '',
                bankIBAN: res.data.bankIBAN || '',
                showBankName: res.data.showBankName ?? true,
                showBankBIC: res.data.showBankBIC ?? true,
                showBankIBAN: res.data.showBankIBAN ?? true,
                includeLogoInEmailSignature: res.data.includeLogoInEmailSignature ?? false,
                fileSystemLanguage: res.data.fileSystemLanguage || '',
                fileSystemLanguageLocked: res.data.fileSystemLanguageLocked ?? false,
                baseStoragePath: res.data.baseStoragePath || '',
                isProfileComplete: res.data.isProfileComplete ?? false,
            });
            setNewBasePath(res.data.baseStoragePath || '');
            return { hasLogoData, hasSignatureImage };
        } catch {
            setStatus({ type: 'error', message: t('settings.loadFailed', 'Failed to load settings') });
            return null;
        } finally {
            setLoading(false);
        }
    };

    const fetchLogoPreview = async () => {
        try {
            const res = await api.get('/Settings/logo', { responseType: 'blob' });
            if (res.data.size > 0) setLogoPreview(URL.createObjectURL(res.data));
        } catch { /* no logo */ }
    };

    const fetchSignaturePreview = async () => {
        try {
            const res = await api.get('/Settings/signature', { responseType: 'blob' });
            if (res.data.size > 0) setSignaturePreview(URL.createObjectURL(res.data));
        } catch { /* no signature */ }
    };

    // ═══════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════

    const updateSetting = (key: keyof CompanySettings, value: string | number | boolean) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async (skipConfirm = false) => {
        // If baseStoragePath is being set for the first time, ask for confirmation
        if (!skipConfirm && settings.baseStoragePath && !settings.isProfileComplete) {
            setShowBasePathLockConfirm(true);
            return;
        }
        setSaving(true);
        setStatus(null);
        try {
            await api.put('/Settings/company', {
                name: settings.companyName, address: settings.companyAddress,
                taxId: settings.companyTaxId,
                phone: settings.companyPhone, email: settings.companyEmail
            });
            await api.put('/Settings', {
                emailTemplate: settings.emailTemplate,
                emailSubjectTemplate: settings.emailSubjectTemplate,
                emailSignature: settings.emailSignature,
                defaultEmailBody: settings.defaultEmailBody,
                logoUrl: settings.logoUrl,
                primaryColor: settings.primaryColor,
                secondaryColor: settings.secondaryColor,
                currency: settings.currency,
                currencySymbol: settings.currencySymbol,
                defaultVatRate: settings.defaultVatRate,
                customTaxEnabled: settings.customTaxEnabled,
                customTaxName: settings.customTaxName,
                customTaxAmount: settings.customTaxAmount,
                pdfFooterText: settings.pdfFooterText,
                showCompanyLogo: settings.showCompanyLogo,
                // Signature fields - always send (trimmed), empty string is valid for clearing
                pdfSignatureText: settings.pdfSignatureText?.trim() ?? '',
                pdfSignerPosition: settings.pdfSignerPosition?.trim() ?? '',
                invoiceLanguage: settings.invoiceLanguage,
                showSignatureOnPdf: settings.showSignatureOnPdf,
                proInvoiceUseTokenSignature: settings.proInvoiceUseTokenSignature,
                bankName: settings.bankName,
                bankBIC: settings.bankBIC,
                bankIBAN: settings.bankIBAN,
                showBankName: settings.showBankName,
                showBankBIC: settings.showBankBIC,
                showBankIBAN: settings.showBankIBAN,
                fileSystemLanguage: settings.fileSystemLanguage || undefined,
                baseStoragePath: settings.baseStoragePath || undefined,
            });
            setStatus({ type: 'success', message: t('common.success', 'Settings saved successfully!') });
            invalidateSettingsCache(); // Clear stale currency cache

            // If baseStoragePath was just set, update auth context so SettingsGuard unlocks
            if (settings.baseStoragePath) {
                updateProfileComplete(true, settings.baseStoragePath);
            }
        } catch {
            setStatus({ type: 'error', message: t('common.error', 'Failed to save settings') });
        } finally { setSaving(false); }
    };

    // Logo
    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { setStatus({ type: 'error', message: 'Please select an image file' }); return; }
        if (file.size > 2 * 1024 * 1024) { setStatus({ type: 'error', message: 'Logo must be less than 2MB' }); return; }
        setUploadingLogo(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            await api.post('/Settings/logo', formData, { headers: { 'Content-Type': undefined } });
            setLogoPreview(URL.createObjectURL(file));
            setSettings(prev => ({ ...prev, hasLogoData: true }));
            setStatus({ type: 'success', message: 'Logo uploaded!' });
        } catch { setStatus({ type: 'error', message: 'Failed to upload logo' }); }
        finally { setUploadingLogo(false); }
    };

    const handleDeleteLogo = async () => {
        if (!confirm('Delete the company logo?')) return;
        try {
            await api.delete('/Settings/logo');
            setLogoPreview(null);
            setSettings(prev => ({ ...prev, hasLogoData: false }));
            setStatus({ type: 'success', message: 'Logo deleted' });
        } catch { setStatus({ type: 'error', message: 'Failed to delete logo' }); }
    };

    // Signature
    const handleSignatureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { setStatus({ type: 'error', message: 'Please select an image file' }); return; }
        if (file.size > 2 * 1024 * 1024) { setStatus({ type: 'error', message: 'File must be less than 2MB' }); return; }
        setUploadingSignature(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            await api.post('/Settings/signature', formData, { headers: { 'Content-Type': undefined } });
            setSignaturePreview(URL.createObjectURL(file));
            setSettings(prev => ({ ...prev, hasSignatureImage: true, showSignatureOnPdf: true }));
            setStatus({ type: 'success', message: 'Signature uploaded!' });
        } catch { setStatus({ type: 'error', message: 'Failed to upload signature' }); }
        finally { setUploadingSignature(false); }
    };

    const handleDeleteSignature = async () => {
        if (!confirm('Delete the signature/cachet?')) return;
        try {
            await api.delete('/Settings/signature');
            setSignaturePreview(null);
            setSettings(prev => ({ ...prev, hasSignatureImage: false, showSignatureOnPdf: false }));
            setStatus({ type: 'success', message: 'Signature removed' });
        } catch { setStatus({ type: 'error', message: 'Failed to delete signature' }); }
    };

    // Email Test
    const handleTestEmail = async () => {
        const testEmail = prompt('Enter email address to send test email:');
        if (!testEmail) return;
        setTestingEmail(true);
        try {
            const res = await api.post('/Settings/test-email', { toEmail: testEmail });
            setStatus({ type: res.data.success ? 'success' : 'error', message: res.data.message || 'Test email sent!' });
        } catch (error: unknown) {
            const responseData = getAxiosResponseData(error);
            const bounceType = responseData?.bounceType as string | undefined;
            const bounceStatus = responseData?.bounceStatus as string | undefined;
            const msg = bounceType === 'hard'
                ? `${getErrorMessage(error)}${bounceStatus ? ` (${bounceStatus})` : ''}`
                : getErrorMessage(error, 'Failed to send test email');
            setStatus({ type: 'error', message: msg });
        } finally { setTestingEmail(false); }
    };

    // Password change
    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) { setStatus({ type: 'error', message: 'Please fill in all password fields' }); return; }
        if (newPassword !== confirmPassword) { setStatus({ type: 'error', message: 'New passwords do not match' }); return; }
        if (newPassword.length < 6) { setStatus({ type: 'error', message: 'Password must be at least 6 characters' }); return; }
        setChangingPassword(true);
        try {
            await api.post('/Auth/change-password', { currentPassword, newPassword });
            setStatus({ type: 'success', message: 'Password changed successfully!' });
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (error: unknown) {
            setStatus({ type: 'error', message: getErrorMessage(error, 'Failed to change password') });
        } finally { setChangingPassword(false); }
    };

    // PDF Preview
    const handleGeneratePreview = async () => {
        setGeneratingPreview(true);
        try {
            await handleSave();
            const res = await api.post('/Settings/preview-pdf', {}, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl(url);
        } catch { setStatus({ type: 'error', message: 'Failed to generate PDF preview' }); }
        finally { setGeneratingPreview(false); }
    };

    // Storage
    const handleCheckConsistency = async () => {
        setCheckingConsistency(true);
        try {
            const res = await api.get('/pdf-storage/check-consistency');
            setConsistencyReport(res.data);
        } catch { setStatus({ type: 'error', message: 'Failed to check consistency' }); }
        finally { setCheckingConsistency(false); }
    };

    const handleRecoverFiles = async () => {
        if (!consistencyReport) return;
        setRecovering(true);
        setStatus(null);
        setRecoveryProgress({ current: 0, total: 0, message: 'Analyzing missing files...' });

        try {
            // Step 1: Get fresh consistency report with details
            const checkRes = await api.get('/pdf-storage/check-consistency');
            const report = checkRes.data;
            const missingFiles = report.missingFileDetails || [];

            if (missingFiles.length === 0) {
                setStatus({ type: 'success', message: t('settings.allFilesPresent', 'All files are already present on disk.') });
                setRecoveryProgress(null);
                setRecovering(false);
                await handleCheckConsistency();
                return;
            }

            const total = missingFiles.length;
            let regenerated = 0;
            let failed = 0;
            let skippedUploaded = 0;
            const errors: string[] = [];

            // Step 2: Group missing files by document type
            const byType: Record<string, typeof missingFiles> = {};
            for (const f of missingFiles) {
                const dtype = f.documentType || 'Unknown';
                if (!byType[dtype]) byType[dtype] = [];
                byType[dtype].push(f);
            }

            // Step 3: For each type, fetch entity list and regenerate PDFs
            const typeConfig: Record<string, { listEndpoint: string; pdfEndpoint: (id: number) => string; label: string }> = {
                'Invoice': { listEndpoint: '/Invoices?page=1&size=9999', pdfEndpoint: (id) => `/Invoices/${id}/pdf`, label: 'Invoice' },
                'Quote': { listEndpoint: '/Quotes?page=1&size=9999', pdfEndpoint: (id) => `/Quotes/${id}/pdf`, label: 'Quote' },
                'DeliveryNote': { listEndpoint: '/DeliveryNotes?page=1&size=9999', pdfEndpoint: (id) => `/DeliveryNotes/${id}/pdf`, label: 'Delivery Note' },
            };

            for (const [docType, files] of Object.entries(byType)) {
                const config = typeConfig[docType];
                if (!config) {
                    // SupplierInvoice or unknown - uploaded files cannot be regenerated
                    for (const f of files) {
                        skippedUploaded++;
                        errors.push(`${f.documentNumber || f.fileName}: Uploaded file (${docType}) — cannot be regenerated, must be re-uploaded manually`);
                        setRecoveryProgress({ current: regenerated + failed + skippedUploaded, total, message: `Skipping uploaded file: ${f.documentNumber || f.fileName}` });
                    }
                    continue;
                }

                let entities: Array<Record<string, unknown>> = [];
                try {
                    const listRes = await api.get(config.listEndpoint);
                    const data = listRes.data;
                    entities = Array.isArray(data) ? data : (data.data || data.Data || data.items || []);
                } catch {
                    for (const f of files) {
                        failed++;
                        errors.push(`${f.documentNumber}: Failed to fetch ${config.label} list from server`);
                    }
                    setRecoveryProgress({ current: regenerated + failed + skippedUploaded, total, message: `Failed to fetch ${config.label} list` });
                    continue;
                }

                // For each missing file, match by document number and regenerate
                for (const missing of files) {
                    setRecoveryProgress({ current: regenerated + failed + skippedUploaded, total, message: `Regenerating ${missing.documentNumber}...` });

                    // Match by document number (try multiple field names for robustness)
                    const entity = entities.find((e: Record<string, unknown>) => {
                        const num = e.number || e.Number || e.invoiceNumber || e.quoteNumber || '';
                        return num === missing.documentNumber;
                    });

                    if (!entity) {
                        failed++;
                        errors.push(`${missing.documentNumber}: ${config.label} not found in database — may have been deleted`);
                        continue;
                    }

                    try {
                        const entityId = (entity.id || entity.Id) as number;
                        // Delete the stale PDF record first
                        await api.delete(`/pdf-storage/files/${missing.id}`).catch(() => {});
                        // Regenerate PDF by calling the PDF endpoint (backend auto-saves to disk)
                        await api.get(config.pdfEndpoint(entityId), { responseType: 'blob' });
                        regenerated++;
                    } catch (pdfErr: unknown) {
                        failed++;
                        const detail = getErrorMessage(pdfErr, 'Server error during PDF generation');
                        errors.push(`${missing.documentNumber}: ${detail}`);
                    }
                }
            }

            // Step 4: Report results with clear summary
            setRecoveryProgress(null);
            const parts: string[] = [];
            if (regenerated > 0) parts.push(`${regenerated} PDF(s) regenerated`);
            if (skippedUploaded > 0) parts.push(`${skippedUploaded} uploaded file(s) skipped (must be re-uploaded)`);
            if (failed > 0) parts.push(`${failed} failed`);

            if (failed === 0 && skippedUploaded === 0) {
                setStatus({ type: 'success', message: t('settings.recoveryComplete', 'Recovery complete: {{summary}}.', { summary: parts.join(', ') }) });
            } else if (regenerated > 0) {
                setStatus({ type: 'warning', message: `${parts.join(', ')}. ${errors.slice(0, 2).join('; ')}` });
            } else if (skippedUploaded > 0 && failed === 0) {
                setStatus({ type: 'warning', message: `${parts.join(', ')}. ${errors.slice(0, 2).join('; ')}` });
            } else {
                setStatus({ type: 'error', message: `Recovery failed: ${errors.slice(0, 3).join('; ')}` });
            }

            // Refresh consistency report
            await handleCheckConsistency();
        } catch {
            setStatus({ type: 'error', message: t('settings.recoveryUnexpectedError', 'Recovery failed: unexpected error. Please check your connection and try again.') });
            setRecoveryProgress(null);
        } finally {
            setRecovering(false);
        }
    };

    const handleBrowseFolders = async (path?: string) => {
        setBrowsingFolders(true);
        try {
            const res = await api.get('/pdf-storage/browse', { params: { path } });
            setFolderBrowser(res.data);
        } catch { setStatus({ type: 'error', message: 'Failed to browse folders' }); }
        finally { setBrowsingFolders(false); }
    };

    const insertPlaceholder = (placeholder: string, field: 'defaultEmailBody' | 'emailSignature') => {
        setSettings(prev => ({ ...prev, [field]: prev[field] + placeholder }));
    };

    // ═══════════════════════════════════════════════════════════════
    // GUARD & LOADING
    // ═══════════════════════════════════════════════════════════════

    if (!canManageSettings) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <h2 className="text-xl font-bold text-red-800">{t('common.error', 'Access Denied')}</h2>
                    <p className="text-red-600 mt-2">{t('settings.noPermission')}</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-[#065F46]" size={32} />
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // SIDEBAR SECTIONS DEFINITION
    // ═══════════════════════════════════════════════════════════════

    const sections: { key: SidebarSection; label: string; icon: typeof Settings }[] = [
        { key: 'personal', label: t('settings.personalCompany', 'Personal & Company'), icon: Building2 },
        { key: 'email', label: t('settings.emailSettings', 'Email Settings'), icon: Mail },
        { key: 'pdf', label: t('settings.pdfSettings', 'PDF Settings'), icon: FileText },
    ];

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════

    return (
        <div className="max-w-6xl mx-auto px-4 py-6 lg:px-10">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center space-x-3">
                    <Settings className="text-[#065F46]" size={28} />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title', 'Settings')}</h1>
                        <p className="text-gray-500 text-sm">{t('settings.manage', 'Manage your company settings and preferences')}</p>
                    </div>
                </div>
                <button onClick={() => handleSave()} disabled={saving}
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all disabled:opacity-50">
                    {saving ? <Loader2 size={20} className="mr-2 animate-spin" /> : <Save size={20} className="mr-2" />}
                    {saving ? t('common.loading', 'Saving...') : t('common.save', 'Save Changes')}
                </button>
            </div>

            {/* Status */}
            {status && (
                <div className={`mb-4 p-4 rounded-xl flex items-center justify-between ${
                    status.type === 'success' ? 'bg-green-50 border border-green-300 text-green-800' :
                    status.type === 'warning' ? 'bg-orange-50 border border-orange-300 text-orange-800' :
                    'bg-red-50 border border-red-300 text-red-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {status.type === 'success' && <CheckCircle size={18} className="text-green-600 flex-shrink-0" />}
                        {status.type === 'warning' && <AlertTriangle size={18} className="text-orange-600 flex-shrink-0" />}
                        {status.type === 'error' && <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />}
                        <span>{status.message}</span>
                    </div>
                    <button onClick={() => setStatus(null)} className="ml-2 flex-shrink-0"><X size={16} /></button>
                </div>
            )}

            {/* Main layout: Top Tabs Grid + Content below */}
            <div className="space-y-6">
                {/* ═══════════ SECTION TABS (3-column grid) ═══════════ */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {sections.map(sec => (
                        <button key={sec.key} onClick={() => setActiveSection(sec.key)}
                            className={`flex items-center gap-3 p-5 rounded-2xl text-left transition-all text-sm font-semibold border-2 ${
                                activeSection === sec.key
                                    ? 'bg-[#065F46] text-white shadow-lg border-[#065F46]'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-100 shadow-sm'
                            }`}>
                            <div className={`p-2.5 rounded-xl ${activeSection === sec.key ? 'bg-white/20' : 'bg-[#065F46]/5'}`}>
                                <sec.icon size={20} className={activeSection === sec.key ? 'text-white' : 'text-[#065F46]'} />
                            </div>
                            {sec.label}
                        </button>
                    ))}
                </div>

                {/* ═══════════ CONTENT AREA ═══════════ */}
                <div>
                    {/* ──── SECTION 1: Personal & Company ──── */}
                    {activeSection === 'personal' && (
                        <div className="space-y-6">
                            {/* Sub-tabs */}
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl overflow-x-auto">
                                {([
                                    { key: 'company' as PersonalTab, label: t('settings.companyInfo', 'Company Information'), icon: Building2 },
                                    { key: 'password' as PersonalTab, label: t('settings.changePassword', 'Password'), icon: Lock },
                                    { key: 'userinfo' as PersonalTab, label: t('settings.userInfo', 'User Info'), icon: User },
                                ]).map(tab => (
                                    <button key={tab.key} onClick={() => setPersonalTab(tab.key)}
                                        className={`flex-shrink-0 sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                            personalTab === tab.key ? 'bg-white text-[#065F46] shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                        }`}>
                                        <tab.icon size={16} />{tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8">
                                {personalTab === 'company' && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <Building2 className="mr-2 text-[#065F46]" size={20} />
                                            {t('settings.companyInfo', 'Company Information')}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.companyName', 'Company Name')}</label>
                                                <input type="text" value={settings.companyName} onChange={e => updateSetting('companyName', e.target.value)}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.fiscalId', 'Tax ID (Matricule Fiscal)')}</label>
                                                <input type="text" value={settings.companyTaxId} onChange={e => updateSetting('companyTaxId', e.target.value)}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.address', 'Address')}</label>
                                                <textarea value={settings.companyAddress} onChange={e => updateSetting('companyAddress', e.target.value)} rows={2}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.phone', 'Phone')}</label>
                                                <input type="text" value={settings.companyPhone} onChange={e => updateSetting('companyPhone', e.target.value)}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.email', 'Email')}</label>
                                                <input type="email" value={settings.companyEmail} onChange={e => updateSetting('companyEmail', e.target.value)}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none" />
                                            </div>
                                        </div>
                                        {/* Logo Upload */}
                                        <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                                <Image size={18} className="text-[#065F46]" />
                                                {t('settings.logo', 'Company Logo')}
                                                {settings.hasLogoData && <CheckCircle size={16} className="text-emerald-500" />}
                                            </h4>
                                            <div className="flex flex-col sm:flex-row items-start gap-6">
                                                <div className="flex-shrink-0">
                                                    {logoPreview ? (
                                                        <div className="relative group">
                                                            <img src={logoPreview} alt="Logo" className="w-32 h-32 object-contain border border-gray-200 rounded-xl bg-white p-2" />
                                                            <button onClick={handleDeleteLogo}
                                                                className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50">
                                                            <Image size={32} className="text-gray-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                                                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}
                                                        className="flex items-center gap-2 px-4 py-2 bg-[#065F46]/5 text-[#065F46] rounded-xl hover:bg-[#065F46]/10 transition-colors disabled:opacity-50">
                                                        {uploadingLogo ? <><Loader2 size={18} className="animate-spin" />Uploading...</> : <><Upload size={18} />{t('common.upload', 'Upload Logo')}</>}
                                                    </button>
                                                    <p className="text-xs text-gray-500 mt-2">{t('settings.logoHint', 'PNG or JPG, max 2MB. Appears on PDFs and emails.')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center mt-4 pt-4 border-t border-gray-100">
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input type="checkbox" checked={settings.showCompanyLogo} onChange={e => updateSetting('showCompanyLogo', e.target.checked)}
                                                        className="w-5 h-5 text-[#065F46] border-gray-300 rounded focus:ring-[#065F46]" />
                                                    <span className="text-sm font-medium text-gray-700">{t('settings.showLogoOnPdf', 'Show logo on PDFs')}</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {personalTab === 'password' && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <Lock className="mr-2 text-[#065F46]" size={20} />
                                            {t('settings.changePassword', 'Change Password')}
                                        </h3>
                                        <div className="max-w-md space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.currentPassword', 'Current Password')}</label>
                                                <PasswordInput value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.newPassword', 'New Password')}</label>
                                                <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                                    showChecklist
                                                    checklistLabels={{
                                                        length: t('auth.checklist.length', 'At least 6 characters'),
                                                        uppercase: t('auth.checklist.uppercase', 'One uppercase letter'),
                                                        number: t('auth.checklist.number', 'One number'),
                                                        special: t('auth.checklist.special', 'One special character'),
                                                    }} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.confirmPassword', 'Confirm New Password')}</label>
                                                <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                                            </div>
                                            <button onClick={handleChangePassword} disabled={changingPassword}
                                                className="flex items-center px-6 py-3 bg-[#065F46] text-white rounded-xl hover:bg-[#047857] transition-all disabled:opacity-50">
                                                {changingPassword ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Lock size={18} className="mr-2" />}
                                                {changingPassword ? t('common.loading', 'Changing...') : t('settings.changePassword', 'Change Password')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {personalTab === 'userinfo' && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <User className="mr-2 text-[#065F46]" size={20} />
                                            {t('settings.userInfo', 'Logged-in User')}
                                        </h3>
                                        <div className="p-6 bg-gray-50 rounded-xl space-y-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 bg-[#065F46]/10 rounded-full flex items-center justify-center">
                                                    <User size={32} className="text-[#065F46]" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-gray-900">{displayName}</p>
                                                    <p className="text-sm text-gray-500">{user?.email}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={logout}
                                            className="flex items-center px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all">
                                            <LogOut size={18} className="mr-2" />
                                            {t('nav.signOut', 'Sign Out')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ──── SECTION 2: Email Settings ──── */}
                    {activeSection === 'email' && (
                        <div className="space-y-6">
                            {/* Email Status + Send Test */}
                            <div className={`p-5 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${smtpStatus?.isConfigured ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-center gap-3">
                                    {smtpStatus?.isConfigured ? (
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                            <CheckCircle className="text-emerald-600" size={22} />
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                            <Mail className="text-gray-500" size={22} />
                                        </div>
                                    )}
                                    <div>
                                        <p className={`text-sm font-semibold ${smtpStatus?.isConfigured ? 'text-emerald-800' : 'text-gray-700'}`}>
                                            {smtpStatus?.isConfigured ? t('settings.emailReady', 'Email service is active') : t('settings.emailNotReady', 'Email service not configured')}
                                        </p>
                                        <p className="text-xs text-gray-500">{t('settings.smtpInfoText', 'Email is sent via your domain SMTP server (mail.rscmanager.com). Configuration is managed through environment variables on the server.')}</p>
                                    </div>
                                </div>
                                <button onClick={handleTestEmail} disabled={testingEmail || !smtpStatus?.isConfigured}
                                    className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm">
                                    {testingEmail ? <><Loader2 size={16} className="animate-spin" />{t('common.sending')}</> : <><Mail size={16} />{t('settings.sendTestEmail', 'Send Test Email')}</>}
                                </button>
                            </div>

                            {/* Email Template Editor */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8 space-y-6">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                    <FileText className="mr-2 text-[#065F46]" size={20} />
                                    {t('settings.emailTemplate', 'Email Template')}
                                </h3>

                                {/* Placeholder Reference */}
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                    <div className="flex items-start gap-2 mb-3">
                                        <Info size={18} className="text-blue-600 mt-0.5" />
                                        <div>
                                            <h4 className="font-medium text-blue-800">{t('settings.availablePlaceholders', 'Available Placeholders')}</h4>
                                            <p className="text-xs text-blue-600">{t('settings.placeholderHelp', 'Click any placeholder below to copy it. Paste it into your email template where you want dynamic content to appear.')}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {EMAIL_PLACEHOLDERS.map(p => (
                                            <button key={p.key} type="button"
                                                onClick={() => { navigator.clipboard.writeText(p.key); setStatus({ type: 'success', message: `Copied ${p.key}` }); setTimeout(() => setStatus(null), 2000); }}
                                                className="px-2 py-2 bg-white border border-blue-300 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors text-left min-w-0 overflow-hidden"
                                                title={p.description}>
                                                <div className="font-mono font-bold text-xs whitespace-nowrap overflow-hidden text-ellipsis">{p.key}</div>
                                                <div className="text-[10px] text-blue-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{p.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.emailSubject', 'Email Subject')}</label>
                                    <input type="text" value={settings.emailSubjectTemplate} onChange={e => updateSetting('emailSubjectTemplate', e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                        placeholder={t('settings.emailSubjectPlaceholder')} />
                                    <p className="text-xs text-gray-500 mt-1">{t('settings.subjectHelp', 'Use @ placeholders for dynamic content. Example: Invoice #@InvoiceNumber from @CompanyName')}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.emailBody', 'Email Body')}</label>
                                    <textarea value={settings.defaultEmailBody} onChange={e => updateSetting('defaultEmailBody', e.target.value)} rows={10}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none font-mono text-sm"
                                        placeholder={t('settings.emailBodyPlaceholder')} />
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mt-1">
                                        <p className="text-xs text-gray-500">{t('settings.bodyHelp', 'This is the default message when sending invoices by email. Use the placeholders above for dynamic content.')}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {EMAIL_PLACEHOLDERS.slice(0, 4).map(p => (
                                                <button key={p.key} type="button" onClick={() => insertPlaceholder(p.key, 'defaultEmailBody')}
                                                    className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 whitespace-nowrap">+ {p.key}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.emailSignature', 'Email Signature')}</label>
                                    <textarea value={settings.emailSignature} onChange={e => updateSetting('emailSignature', e.target.value)} rows={4}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                        placeholder={t('settings.emailSignaturePlaceholder')} />
                                    <p className="text-xs text-gray-500 mt-1">{t('settings.signatureHelp', 'This text is appended at the end of every email you send.')}</p>
                                </div>

                                {/* Include logo in email signature */}
                                <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="checkbox" checked={settings.includeLogoInEmailSignature}
                                            onChange={e => updateSetting('includeLogoInEmailSignature', e.target.checked)}
                                            className="w-5 h-5 text-[#065F46] border-gray-300 rounded focus:ring-[#065F46]" />
                                        <span className="text-sm font-medium text-gray-700">{t('settings.includeLogoInSignature', 'Include company logo in email signature')}</span>
                                    </label>
                                    {!settings.hasLogoData && (
                                        <span className="text-xs text-gray-400">({t('settings.uploadLogoFirst', 'Upload a logo first in Personal & Company')})</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ──── SECTION 3: PDF Settings ──── */}
                    {activeSection === 'pdf' && (
                        <div className="space-y-6">
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl overflow-x-auto">
                                {([
                                    { key: 'signature' as PdfTab, label: t('settings.signature', 'Signature'), icon: PenTool },
                                    { key: 'branding' as PdfTab, label: t('settings.branding', 'Branding'), icon: Palette },
                                    { key: 'financial' as PdfTab, label: t('settings.financial', 'Financial'), icon: DollarSign },
                                    { key: 'storage' as PdfTab, label: t('settings.storage', 'Storage'), icon: HardDrive },
                                ]).map(tab => (
                                    <button key={tab.key} onClick={() => setPdfTab(tab.key)}
                                        className={`flex-shrink-0 sm:flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                            pdfTab === tab.key ? 'bg-white text-[#065F46] shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                        }`}>
                                        <tab.icon size={16} />{tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8">
                                {/* Signature Tab */}
                                {pdfTab === 'signature' && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <PenTool className="mr-2 text-[#065F46]" size={20} />
                                            {t('settings.signature', 'Signature')}
                                        </h3>
                                        <p className="text-sm text-gray-500">{t('settings.signatureDesc', 'Upload your company stamp or signature image. This will appear at the bottom of generated invoices and quotes.')}</p>

                                        <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl">
                                            <div className="flex flex-col sm:flex-row items-start gap-6">
                                                <div className="flex-shrink-0">
                                                    {signaturePreview ? (
                                                        <div className="relative group">
                                                            <img src={signaturePreview} alt="Signature" className="w-48 h-28 object-contain border border-gray-200 rounded-xl bg-white p-2" />
                                                            <button onClick={handleDeleteSignature}
                                                                className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="w-48 h-28 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50">
                                                            <PenTool size={28} className="text-gray-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <input ref={signatureInputRef} type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                                                    <button onClick={() => signatureInputRef.current?.click()} disabled={uploadingSignature}
                                                        className="flex items-center gap-2 px-4 py-2 bg-[#065F46]/5 text-[#065F46] rounded-xl hover:bg-[#065F46]/10 transition-colors disabled:opacity-50">
                                                        {uploadingSignature ? <><Loader2 size={18} className="animate-spin" />Uploading...</> : <><Upload size={18} />{t('settings.uploadSignature', 'Upload Signature / Cachet')}</>}
                                                    </button>
                                                    <p className="text-xs text-gray-500 mt-2">{t('settings.signatureHint', 'PNG with transparent background recommended. Max 2MB.')}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center mt-4 pt-4 border-t border-gray-100">
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input type="checkbox" checked={settings.showSignatureOnPdf}
                                                        onChange={e => updateSetting('showSignatureOnPdf', e.target.checked)}
                                                        disabled={!settings.hasSignatureImage}
                                                        className="w-5 h-5 text-[#065F46] border-gray-300 rounded focus:ring-[#065F46]" />
                                                    <span className={`text-sm font-medium ${settings.hasSignatureImage ? 'text-gray-700' : 'text-gray-400'}`}>
                                                        {t('settings.showSignatureOnPdf', 'Show signature on PDFs')}
                                                    </span>
                                                </label>
                                                {!settings.hasSignatureImage && <span className="text-xs text-gray-400 ml-3">{t('settings.uploadSignatureFirst', 'Upload a signature first')}</span>}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.pdfSignature', 'PDF Signature Text')}</label>
                                            <input type="text" value={settings.pdfSignatureText} onChange={e => updateSetting('pdfSignatureText', e.target.value)}
                                                maxLength={100}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                                placeholder={t('settings.signaturePlaceholder', 'E.g. John Smith')} />
                                            <p className="text-xs text-gray-500 mt-1">{t('settings.signatureNameHelp', 'The name that appears bold on the PDF signature')}</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.pdfSignerPosition', 'Signer Position / Title')}</label>
                                            <input type="text" value={settings.pdfSignerPosition} onChange={e => updateSetting('pdfSignerPosition', e.target.value)}
                                                maxLength={100}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                                placeholder={t('settings.signerPositionPlaceholder', 'E.g. Managing Director, CEO, Accountant')} />
                                            <p className="text-xs text-gray-500 mt-1">{t('settings.signerPositionHelp', 'Appears below the signature name on PDFs (e.g. job title or role)')}</p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-start sm:items-center mt-4 pt-4 border-t border-gray-100 gap-2">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input type="checkbox" checked={settings.proInvoiceUseTokenSignature}
                                                    onChange={e => updateSetting('proInvoiceUseTokenSignature', e.target.checked)}
                                                    className="w-5 h-5 text-[#065F46] border-gray-300 rounded focus:ring-[#065F46]" />
                                                <span className="text-sm font-medium text-gray-700">
                                                    {t('settings.proInvoiceTokenSignature', 'Enable verification token on invoices (Pro)')}
                                                </span>
                                            </label>
                                            <p className="text-xs text-gray-500 sm:ml-3">{t('settings.proInvoiceTokenHelp', 'Adds a QR code & verification token to invoice PDFs for authenticity verification')}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Branding Tab */}
                                {pdfTab === 'branding' && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <Palette className="mr-2 text-[#065F46]" size={20} />
                                            {t('settings.branding', 'Branding & Appearance')}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.language', 'Invoice Language')}</label>
                                                <select value={settings.invoiceLanguage} onChange={e => updateSetting('invoiceLanguage', e.target.value)}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none">
                                                    <option value="fr">Français</option>
                                                    <option value="en">English</option>
                                                    <option value="de">Deutsch</option>
                                                    <option value="ar">العربية</option>
                                                </select>
                                            </div>
                                            <div></div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.primaryColor', 'Primary Color')}</label>
                                                <div className="flex items-center space-x-3">
                                                    <input type="color" value={settings.primaryColor} onChange={e => updateSetting('primaryColor', e.target.value)} className="w-12 h-12 rounded-lg cursor-pointer border border-gray-200" />
                                                    <input type="text" value={settings.primaryColor} onChange={e => updateSetting('primaryColor', e.target.value)} className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
                                                    <button onClick={() => updateSetting('primaryColor', '#065F46')} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Reset</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.secondaryColor', 'Secondary Color')}</label>
                                                <div className="flex items-center space-x-3">
                                                    <input type="color" value={settings.secondaryColor} onChange={e => updateSetting('secondaryColor', e.target.value)} className="w-12 h-12 rounded-lg cursor-pointer border border-gray-200" />
                                                    <input type="text" value={settings.secondaryColor} onChange={e => updateSetting('secondaryColor', e.target.value)} className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
                                                    <button onClick={() => updateSetting('secondaryColor', '#14B8A6')} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Reset</button>
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.pdfFooter', 'PDF Footer Text')}</label>
                                                <textarea value={settings.pdfFooterText} onChange={e => updateSetting('pdfFooterText', e.target.value)} rows={2}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                                    placeholder={t('settings.pdfFooterPlaceholder')} />
                                            </div>
                                        </div>
                                        {/* Color Preview */}
                                        <div className="p-4 rounded-xl border-2 border-dashed border-gray-200">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-3">{t('settings.colorPreview')}</h4>
                                            <div className="flex flex-wrap items-center gap-4">
                                                <div className="w-24 h-12 rounded-lg flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: settings.primaryColor }}>{t('settings.primaryColor')}</div>
                                                <div className="w-24 h-12 rounded-lg flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: settings.secondaryColor }}>{t('settings.secondaryColor')}</div>
                                                <div className="flex-1 min-w-[120px] h-12 rounded-lg" style={{ background: `linear-gradient(to right, ${settings.primaryColor}, ${settings.secondaryColor})` }} />
                                            </div>
                                        </div>
                                        {/* Live PDF Preview */}
                                        <div className="p-6 rounded-xl border-2 border-gray-200 bg-gray-50">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Eye size={18} className="text-[#065F46]" />{t('settings.livePdfPreview', 'Live PDF Preview')}</h4>
                                                <button onClick={handleGeneratePreview} disabled={generatingPreview}
                                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-[#065F46] text-white rounded-xl hover:bg-[#047857] disabled:opacity-50">
                                                    {generatingPreview ? <><Loader2 size={16} className="animate-spin" />{t('settings.generating')}</> : <><Eye size={16} />{t('settings.generatePreview')}</>}
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-500 mb-4">{t('settings.previewDesc', 'Preview your invoice with current colors, logo, signature, and language.')}</p>
                                            {pdfPreviewUrl ? (
                                                <iframe src={pdfPreviewUrl} className="w-full bg-white rounded-xl border border-gray-200" style={{ height: '600px' }} title="PDF Preview" />
                                            ) : (
                                                <div className="w-full h-48 flex items-center justify-center bg-white rounded-xl border-2 border-dashed border-gray-300">
                                                    <div className="text-center text-gray-400"><Eye size={32} className="mx-auto mb-2" /><p className="text-sm">Click "Generate Preview" above</p></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Financial Tab */}
                                {pdfTab === 'financial' && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <DollarSign className="mr-2 text-[#065F46]" size={20} />
                                            {t('settings.financial', 'Financial Settings')}
                                        </h3>
                                        {settings.isProfileComplete && (
                                            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                                                <Lock size={16} className="text-gray-500" />
                                                <span className="text-sm text-gray-600">{t('settings.lockedSettingsHint', 'Currency and tax settings are locked after initial setup. Bank information remains editable.')}</span>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.currency', 'Currency')}</label>
                                                <select value={settings.currency} onChange={e => {
                                                    updateSetting('currency', e.target.value);
                                                    const sym = CURRENCY_SYMBOL_MAP[e.target.value];
                                                    if (sym) updateSetting('currencySymbol', sym);
                                                }} disabled={settings.isProfileComplete} className={`w-full px-4 py-3 border border-gray-200 rounded-xl ${settings.isProfileComplete ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'}`}>
                                                    {CURRENCY_OPTIONS.map(opt => (
                                                        <option key={opt.code} value={opt.code}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.currencySymbol', 'Currency Symbol')}</label>
                                                <input type="text" value={settings.currencySymbol} onChange={e => updateSetting('currencySymbol', e.target.value)}
                                                    disabled={settings.isProfileComplete}
                                                    className={`w-full px-4 py-3 border border-gray-200 rounded-xl ${settings.isProfileComplete ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'}`} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.defaultVatRate', 'Default VAT Rate (%)')}</label>
                                                <div className="flex items-center">
                                                    <input type="number" step="0.01" min="0" max="1" value={settings.defaultVatRate}
                                                        onChange={e => updateSetting('defaultVatRate', parseFloat(e.target.value) || 0)}
                                                        disabled={settings.isProfileComplete}
                                                        className={`w-full px-4 py-3 border border-gray-200 rounded-xl ${settings.isProfileComplete ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'}`} />
                                                    <span className="ml-3 text-gray-600">{(settings.defaultVatRate * 100).toFixed(0)}%</span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Custom Tax */}
                                        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-700">{t('settings.customTax', 'Additional Tax / Stamp Duty')}</h4>
                                                    <p className="text-xs text-gray-500 mt-1">{t('settings.customTaxHint', 'Configure a custom tax like Timbre Fiscal')}</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" checked={settings.customTaxEnabled} onChange={e => updateSetting('customTaxEnabled', e.target.checked)} disabled={settings.isProfileComplete} className="sr-only peer" />
                                                    <div className={`w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-[#065F46]/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#065F46] ${settings.isProfileComplete ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                                                </label>
                                            </div>
                                            {settings.customTaxEnabled && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.taxName', 'Tax Name')}</label>
                                                        <input type="text" value={settings.customTaxName} onChange={e => updateSetting('customTaxName', e.target.value)}
                                                            disabled={settings.isProfileComplete}
                                                            className={`w-full px-4 py-3 border border-amber-300 rounded-xl ${settings.isProfileComplete ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.taxAmount', 'Tax Amount')}</label>
                                                        <div className="flex items-center">
                                                            <input type="number" step="0.001" min="0" value={settings.customTaxAmount}
                                                                onChange={e => updateSetting('customTaxAmount', parseFloat(e.target.value) || 0)}
                                                                disabled={settings.isProfileComplete}
                                                                className={`w-full px-4 py-3 border border-amber-300 rounded-xl ${settings.isProfileComplete ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`} />
                                                            <span className="ml-3 text-gray-600">{settings.currencySymbol}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {/* Bank Info */}
                                        <div className="p-6 bg-blue-50 border border-blue-200 rounded-xl">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                                <DollarSign size={18} className="text-blue-600" />
                                                {t('settings.pdfBankDetails', 'Bank Information')}
                                            </h4>
                                            <p className="text-xs text-gray-500 mb-4">{t('settings.bankInfoHint', "Displayed on invoice PDFs for payment. Toggle each field's visibility.")}</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="text-sm font-medium text-gray-700">{t('settings.bankNameLabel')}</label>
                                                        <label className="flex items-center space-x-1 cursor-pointer">
                                                            <input type="checkbox" checked={settings.showBankName} onChange={e => updateSetting('showBankName', e.target.checked)}
                                                                className="w-4 h-4 text-blue-600 rounded" /><span className="text-xs text-gray-500">{t('settings.showField')}</span>
                                                        </label>
                                                    </div>
                                                    <input type="text" value={settings.bankName} onChange={e => updateSetting('bankName', e.target.value)} placeholder={t('settings.bankNamePlaceholder')}
                                                        className="w-full px-4 py-3 bg-white border border-blue-300 rounded-xl" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="text-sm font-medium text-gray-700">{t('settings.bankBICLabel')}</label>
                                                        <label className="flex items-center space-x-1 cursor-pointer">
                                                            <input type="checkbox" checked={settings.showBankBIC} onChange={e => updateSetting('showBankBIC', e.target.checked)}
                                                                className="w-4 h-4 text-blue-600 rounded" /><span className="text-xs text-gray-500">{t('settings.showField')}</span>
                                                        </label>
                                                    </div>
                                                    <input type="text" value={settings.bankBIC} onChange={e => updateSetting('bankBIC', e.target.value)} placeholder={t('settings.bankBICPlaceholder')}
                                                        className="w-full px-4 py-3 bg-white border border-blue-300 rounded-xl font-mono" />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="text-sm font-medium text-gray-700">{t('settings.bankIBANLabel')}</label>
                                                        <label className="flex items-center space-x-1 cursor-pointer">
                                                            <input type="checkbox" checked={settings.showBankIBAN} onChange={e => updateSetting('showBankIBAN', e.target.checked)}
                                                                className="w-4 h-4 text-blue-600 rounded" /><span className="text-xs text-gray-500">{t('settings.showField')}</span>
                                                        </label>
                                                    </div>
                                                    <input type="text" value={settings.bankIBAN} onChange={e => updateSetting('bankIBAN', e.target.value)} placeholder={t('settings.bankIBANPlaceholder')}
                                                        className="w-full px-4 py-3 bg-white border border-blue-300 rounded-xl font-mono" />
                                                </div>
                                            </div>
                                        </div>
                                        {/* Invoice calc example */}
                                        <div className="p-6 bg-gray-50 rounded-xl">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-4">{t('settings.exampleCalculation', 'Example Invoice Calculation')}</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between"><span className="text-gray-600">{t('settings.subtotal')}</span><span>1000.000 {settings.currencySymbol}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-600">{t('invoice.vat', 'VAT')} ({(settings.defaultVatRate * 100).toFixed(0)}%)</span><span>{(1000 * settings.defaultVatRate).toFixed(3)} {settings.currencySymbol}</span></div>
                                                {settings.customTaxEnabled && <div className="flex justify-between"><span className="text-gray-600">{settings.customTaxName}</span><span>{settings.customTaxAmount.toFixed(3)} {settings.currencySymbol}</span></div>}
                                                <div className="flex justify-between pt-2 border-t border-gray-200">
                                                    <span className="font-semibold">{t('common.total')}</span>
                                                    <span className="text-[#065F46] font-bold">{(1000 + 1000 * settings.defaultVatRate + (settings.customTaxEnabled ? settings.customTaxAmount : 0)).toFixed(3)} {settings.currencySymbol}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Storage Tab */}
                                {pdfTab === 'storage' && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <HardDrive className="mr-2 text-[#065F46]" size={20} />
                                            {t('settings.storage', 'PDF Storage')}
                                        </h3>

                                        {/* File System Language - set once, then locked */}
                                        <div className={`p-5 rounded-xl border ${settings.fileSystemLanguageLocked ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-semibold text-gray-800">
                                                    📂 File System Language
                                                </label>
                                                {settings.fileSystemLanguageLocked && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                                                        🔒 Locked
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mb-3">
                                                {settings.fileSystemLanguageLocked
                                                    ? 'This language is permanently set and cannot be changed. It determines folder names (e.g., "Factures" vs "Invoices") on disk.'
                                                    : '⚠️ Choose carefully — this setting is permanent and cannot be changed once saved. It determines folder names on disk (e.g., "Factures" for French, "Invoices" for English).'}
                                            </p>
                                            <select
                                                value={settings.fileSystemLanguage}
                                                onChange={e => updateSetting('fileSystemLanguage', e.target.value)}
                                                disabled={settings.fileSystemLanguageLocked}
                                                className={`w-full px-4 py-3 border rounded-xl transition-all ${
                                                    settings.fileSystemLanguageLocked
                                                        ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                                                        : 'bg-white border-amber-300 focus:ring-2 focus:ring-amber-500 outline-none'
                                                }`}
                                            >
                                                <option value="">-- Not Set --</option>
                                                <option value="fr">Français (Factures, Devis, Bons de Livraison)</option>
                                                <option value="en">English (Invoices, Quotes, Delivery Notes)</option>
                                                <option value="de">Deutsch (Rechnungen, Angebote, Lieferscheine)</option>
                                                <option value="ar">العربية (فواتير, عروض أسعار, إيصالات تسليم)</option>
                                            </select>
                                        </div>

                                        {/* Base Storage Path - Manager local sync destination */}
                                        <div className={`p-5 rounded-xl border ${settings.baseStoragePath ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-semibold text-gray-800">
                                                    💾 {t('settings.baseStoragePath', 'Base Storage Path')}
                                                </label>
                                                {settings.baseStoragePath && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                                                        🔒 Locked
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mb-3">
                                                {settings.baseStoragePath
                                                    ? 'This path is permanently locked. Employee-uploaded invoices will be synced here. Contact Super Admin to reset.'
                                                    : '⚠️ Set the local directory where employee-uploaded supplier invoices will be synced. This cannot be changed once saved.'}
                                            </p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={settings.baseStoragePath}
                                                    onChange={e => updateSetting('baseStoragePath', e.target.value)}
                                                    disabled={!!settings.baseStoragePath}
                                                    placeholder={t('settings.baseStoragePathPlaceholder', 'e.g. C:\\ResourceManager\\Invoices')}
                                                    className={`flex-1 px-4 py-3 border rounded-xl font-mono text-sm transition-all ${
                                                        settings.baseStoragePath
                                                            ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                                                            : 'bg-white border-amber-300 focus:ring-2 focus:ring-amber-500 outline-none'
                                                    }`}
                                                />
                                                {!settings.baseStoragePath && (
                                                    <button
                                                        onClick={() => {
                                                            if (folderBrowser) {
                                                                setFolderBrowser(null);
                                                            } else {
                                                                setBrowseTarget('basePath');
                                                                handleBrowseFolders(settings.baseStoragePath || undefined);
                                                            }
                                                        }}
                                                        disabled={browsingFolders}
                                                        className="flex items-center gap-2 px-4 py-3 bg-[#065F46] text-white rounded-xl hover:bg-[#047857] disabled:opacity-50 transition-colors text-sm font-medium whitespace-nowrap"
                                                    >
                                                        {browsingFolders ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
                                                        Browse
                                                    </button>
                                                )}
                                            </div>
                                            {!settings.baseStoragePath && (
                                                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                                    <AlertTriangle size={12} />
                                                    {t('settings.baseStoragePathWarning', 'You must set this path to complete your profile setup. Type the full path or use Browse to select a folder.')}
                                                </p>
                                            )}
                                        </div>

                                        {/* Folder Browser Modal */}
                                        {folderBrowser && (
                                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setFolderBrowser(null)}>
                                                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#065F46]/5 to-blue-50 border-b border-gray-200">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <FolderOpen size={18} className="text-[#065F46] flex-shrink-0" />
                                                            <span className="font-semibold text-gray-800">{t('settings.selectFolder', 'Select a folder')}</span>
                                                        </div>
                                                        <button onClick={() => setFolderBrowser(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"><X size={18} /></button>
                                                    </div>
                                                    {folderBrowser.currentPath && (
                                                        <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                                                            <p className="text-xs text-gray-500 font-mono truncate" title={folderBrowser.currentPath}>{folderBrowser.currentPath}</p>
                                                        </div>
                                                    )}
                                                    <div className="p-2 max-h-80 overflow-y-auto">
                                                        {folderBrowser.parent && (
                                                            <button onClick={() => handleBrowseFolders(folderBrowser.parent)}
                                                                className="w-full px-3 py-2.5 text-left hover:bg-[#065F46]/5 rounded-lg flex items-center gap-2 text-[#065F46] text-sm font-medium group">
                                                                <FolderOpen size={14} className="group-hover:scale-110 transition-transform" />
                                                                {t('settings.parentFolder', '.. (Parent folder)')}
                                                            </button>
                                                        )}
                                                        {folderBrowser.items?.length === 0 && (
                                                            <p className="px-3 py-6 text-center text-gray-400 text-sm">{t('settings.noSubfolders', 'No subfolders found')}</p>
                                                        )}
                                                        {folderBrowser.items?.map((item: { path: string; name: string; type: string }) => (
                                                            <button key={item.path}
                                                                onClick={() => {
                                                                    setNewBasePath(item.path);
                                                                    if (browseTarget === 'basePath') {
                                                                        updateSetting('baseStoragePath', item.path);
                                                                    }
                                                                    handleBrowseFolders(item.path);
                                                                }}
                                                                className={`w-full px-3 py-2.5 text-left hover:bg-[#065F46]/5 rounded-lg flex items-center gap-2 text-sm transition-colors ${
                                                                    newBasePath === item.path ? 'bg-[#065F46]/5 text-[#065F46] font-medium ring-1 ring-[#065F46]/20' : 'text-gray-700'
                                                                }`}>
                                                                <FolderOpen size={14} className={item.type === 'drive' ? 'text-blue-500' : 'text-amber-500'} />
                                                                <span className="font-mono text-sm">{item.name}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                                                        <p className="text-xs text-gray-600 font-mono truncate flex-1 mr-3" title={newBasePath || ''}>
                                                            {newBasePath || t('settings.noFolderSelected', 'No folder selected')}
                                                        </p>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setFolderBrowser(null)}
                                                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                                                                {t('common.cancel', 'Cancel')}
                                                            </button>
                                                            <button onClick={() => {
                                                                if (browseTarget === 'basePath' && newBasePath) {
                                                                    updateSetting('baseStoragePath', newBasePath);
                                                                }
                                                                setFolderBrowser(null);
                                                            }}
                                                                disabled={!newBasePath}
                                                                className="px-4 py-2 bg-[#065F46] text-white text-sm rounded-lg hover:bg-[#047857] disabled:opacity-40 whitespace-nowrap font-medium transition-colors">
                                                                {t('settings.useThisFolder', 'Use this folder')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* File Consistency Check */}
                                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                                                <div>
                                                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                                        <CheckCircle size={18} className="text-[#065F46]" />
                                                        {t('settings.fileConsistencyCheck', 'File Consistency Check')}
                                                    </h4>
                                                    <p className="text-sm text-gray-500 mt-1">{t('settings.fileConsistencyDesc', 'Verify all registered PDF files exist on disk. Missing files can be regenerated from your data.')}</p>
                                                </div>
                                                <button onClick={handleCheckConsistency} disabled={checkingConsistency || recovering}
                                                    className="w-full sm:w-auto px-5 py-2.5 bg-[#065F46] text-white rounded-xl hover:bg-[#047857] disabled:opacity-50 flex items-center justify-center gap-2 text-sm whitespace-nowrap transition-colors">
                                                    {checkingConsistency ? <><Loader2 size={16} className="animate-spin" />{t('settings.checking', 'Checking...')}</> : <><CheckCircle size={16} />{t('settings.checkNow', 'Check Now')}</>}
                                                </button>
                                            </div>

                                            {/* Recovery progress indicator */}
                                            {recovering && recoveryProgress && (
                                                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <RefreshCw size={18} className="text-blue-600 animate-spin" />
                                                        <span className="text-sm font-medium text-blue-800">
                                                            {t('settings.regeneratingPdfs', 'Regenerating PDFs...')} ({recoveryProgress.current} / {recoveryProgress.total})
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-blue-600 ml-7">{recoveryProgress.message}</p>
                                                    {recoveryProgress.total > 0 && (
                                                        <div className="mt-2 ml-7 h-2 bg-blue-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                                                                style={{ width: `${Math.round((recoveryProgress.current / recoveryProgress.total) * 100)}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {consistencyReport && !recovering && (
                                                <div className="mt-4">
                                                    {(() => {
                                                        const missing = consistencyReport.missingFiles ?? consistencyReport.MissingFiles ?? 0;
                                                        const total = consistencyReport.totalFiles ?? consistencyReport.TotalFiles ?? 0;
                                                        const existing = consistencyReport.existingFiles ?? consistencyReport.ExistingFiles ?? 0;
                                                        const hasMissing = missing > 0;

                                                        // Count by document type for detailed info
                                                        const details: Array<{ id: number; documentType: string; documentNumber: string; fileName: string }> = consistencyReport.missingFileDetails || [];
                                                        const canRegenerate = details.filter((d: { documentType: string }) => ['Invoice', 'Quote', 'DeliveryNote'].includes(d.documentType)).length;
                                                        const uploadedOnly = details.filter((d: { documentType: string }) => !['Invoice', 'Quote', 'DeliveryNote'].includes(d.documentType)).length;

                                                        return (
                                                            <div className={`p-4 rounded-xl ${hasMissing ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                                                                <div className="grid grid-cols-3 gap-4 text-center mb-3">
                                                                    <div>
                                                                        <p className="text-2xl font-bold text-gray-900">{total}</p>
                                                                        <p className="text-xs text-gray-500 font-medium">{t('settings.totalRegistered', 'Total Registered')}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-2xl font-bold text-emerald-600">{existing}</p>
                                                                        <p className="text-xs text-gray-500 font-medium">{t('settings.onDisk', 'On Disk')}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className={`text-2xl font-bold ${hasMissing ? 'text-red-600' : 'text-emerald-600'}`}>{missing}</p>
                                                                        <p className="text-xs text-gray-500 font-medium">{t('settings.missing', 'Missing')}</p>
                                                                    </div>
                                                                </div>

                                                                {hasMissing ? (
                                                                    <div className="space-y-3">
                                                                        {/* Type breakdown */}
                                                                        <div className="p-3 bg-white/60 rounded-lg">
                                                                            {canRegenerate > 0 && (
                                                                                <p className="text-sm text-amber-800 flex items-center gap-1.5">
                                                                                    <RefreshCw size={14} className="text-amber-600" />
                                                                                    <strong>{canRegenerate}</strong> {t('settings.canBeRegenerated', 'file(s) can be regenerated from your invoice/quote/delivery data')}
                                                                                </p>
                                                                            )}
                                                                            {uploadedOnly > 0 && (
                                                                                <p className="text-sm text-orange-700 flex items-center gap-1.5 mt-1">
                                                                                    <AlertTriangle size={14} className="text-orange-500" />
                                                                                    <strong>{uploadedOnly}</strong> {t('settings.mustBeReuploaded', 'uploaded file(s) must be re-uploaded manually')}
                                                                                </p>
                                                                            )}
                                                                        </div>

                                                                        <button onClick={handleRecoverFiles} disabled={recovering}
                                                                            className="w-full px-4 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors">
                                                                            <RefreshCw size={18} />
                                                                            {t('settings.regenerateMissing', 'Regenerate {{count}} Missing PDF(s)', { count: missing })}
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-center gap-2 mt-1">
                                                                        <CheckCircle size={18} className="text-emerald-600" />
                                                                        <p className="text-sm text-emerald-700 font-medium">{t('settings.allFilesConsistent', 'All files are consistent and present on disk.')}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Base Storage Path Lock Confirmation Dialog */}
            {showBasePathLockConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowBasePathLockConfirm(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-amber-100 rounded-xl">
                                <AlertTriangle size={24} className="text-amber-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">{t('settings.confirmStoragePath', 'Confirm Storage Path')}</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                            You are about to set the base storage path to:
                        </p>
                        <p className="font-mono text-sm bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 break-all">
                            {settings.baseStoragePath}
                        </p>
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                            <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                                <Lock size={14} />
                                {t('settings.cannotModifyLater')}
                            </p>
                            <p className="text-xs text-red-600 mt-1">{t('settings.financialLockWarning')}</p>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowBasePathLockConfirm(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    setShowBasePathLockConfirm(false);
                                    handleSave(true);
                                }}
                                className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 font-medium transition-colors"
                            >
                                Confirm & Lock
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

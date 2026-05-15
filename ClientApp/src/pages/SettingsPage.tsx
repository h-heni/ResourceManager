import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
    Settings, Building2, Mail, Save, Loader2, Upload, X, Image, Info,
    CheckCircle, Eye, PenTool, Trash2, Lock, User, LogOut,
    FileText, Palette, DollarSign,
    AlertTriangle, MessageCircle, Unlink
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
    whatsAppPhoneNumberId: string;
    whatsAppAccessToken: string;
    whatsAppBusinessAccountId: string;
    whatsAppDisplayPhone: string;
    whatsAppEnabled: boolean;
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

type SidebarSection = 'personal' | 'email' | 'pdf' | 'whatsapp';
type PersonalTab = 'company' | 'password' | 'userinfo';
type PdfTab = 'signature' | 'branding' | 'financial';

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SettingsPage() {
    const { t } = useTranslation();
    const { canManageSettings, logout, user, displayName } = useAuth();
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

    // Confirmation dialog for locking base storage path
    const [showBasePathLockConfirm, setShowBasePathLockConfirm] = useState(false);

    // WhatsApp Embedded Signup
    const [connectingWhatsApp, setConnectingWhatsApp] = useState(false);
    const [disconnectingWhatsApp, setDisconnectingWhatsApp] = useState(false);
    const [waConnectMode, setWaConnectMode] = useState<'embedded' | 'manual'>('embedded');
    const [waManualCreds, setWaManualCreds] = useState({ phoneNumberId: '', accessToken: '', businessAccountId: '', displayPhone: '' });
    const [savingManualCreds, setSavingManualCreds] = useState(false);

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
        primaryColor: '#7C3AED', secondaryColor: '#8B5CF6',
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
        whatsAppPhoneNumberId: '', whatsAppAccessToken: '',
        whatsAppBusinessAccountId: '', whatsAppDisplayPhone: '',
        whatsAppEnabled: false,
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
                primaryColor: res.data.primaryColor || '#7C3AED',
                secondaryColor: res.data.secondaryColor || '#8B5CF6',
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
                whatsAppPhoneNumberId: res.data.whatsAppPhoneNumberId || '',
                whatsAppAccessToken: res.data.whatsAppAccessToken || '',
                whatsAppBusinessAccountId: res.data.whatsAppBusinessAccountId || '',
                whatsAppDisplayPhone: res.data.whatsAppDisplayPhone || '',
                whatsAppEnabled: res.data.whatsAppEnabled ?? false,
            });
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

    const handleSave = async () => {
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
                whatsAppPhoneNumberId: settings.whatsAppPhoneNumberId || undefined,
                whatsAppAccessToken: settings.whatsAppAccessToken || undefined,
                whatsAppBusinessAccountId: settings.whatsAppBusinessAccountId || undefined,
                whatsAppEnabled: settings.whatsAppEnabled,
            });
            setStatus({ type: 'success', message: t('common.success', 'Settings saved successfully!') });
            invalidateSettingsCache(); // Clear stale currency cache
        } catch {
            setStatus({ type: 'error', message: t('common.error', 'Failed to save settings') });
        } finally { setSaving(false); }
    };

    // WhatsApp Embedded Signup
    const handleConnectWhatsApp = async () => {
        setConnectingWhatsApp(true);
        setStatus(null);
        console.log('[WA-DEBUG] ── handleConnectWhatsApp started ──');
        try {
            // 1. Get the Meta App ID and Embedded Signup Config ID from our backend
            console.log('[WA-DEBUG] 1. Fetching /Settings/whatsapp/app-id...');
            const appIdRes = await api.get('/Settings/whatsapp/app-id');
            console.log('[WA-DEBUG] 1. app-id response:', appIdRes.data);
            if (!appIdRes.data.configured || !appIdRes.data.appId) {
                setStatus({ type: 'error', message: t('whatsapp.settings.appNotConfigured', 'WhatsApp integration is not configured on the server. Contact your administrator.') });
                return;
            }
            const metaAppId = appIdRes.data.appId;
            const embeddedSignupConfigId: string | null = appIdRes.data.configId ?? null;
            console.log('[WA-DEBUG] 1. metaAppId:', metaAppId, '| embeddedSignupConfigId:', embeddedSignupConfigId);

            // 2. Load Facebook SDK if not already loaded
            const fbWindow = window as unknown as { FB?: { init: (opts: Record<string, unknown>) => void; login: (cb: (resp: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void } };
            console.log('[WA-DEBUG] 2. FB SDK already on window?', !!fbWindow.FB);
            if (!fbWindow.FB) {
                console.log('[WA-DEBUG] 2. Loading FB SDK script...');
                await new Promise<void>((resolve, reject) => {
                    // 15-second safety timeout — in Chrome, CSP violations silently drop
                    // the script without firing onerror, so we'd hang forever without this.
                    const sdkLoadTimer = setTimeout(() => {
                        console.error('[WA-DEBUG] 2. FB SDK load timeout (15s) — possible CSP or network block');
                        reject(new Error('Facebook SDK failed to load (timeout). Check your Content-Security-Policy or network connectivity.'));
                    }, 15000);

                    const script = document.createElement('script');
                    script.src = 'https://connect.facebook.net/en_US/sdk.js';
                    script.async = true;
                    script.defer = true;
                    script.onload = () => {
                        clearTimeout(sdkLoadTimer);
                        console.log('[WA-DEBUG] 2. FB SDK script loaded, calling init...');
                        const fb = (window as unknown as typeof fbWindow).FB!;
                        fb.init({
                            appId: metaAppId,
                            cookie: true,
                            xfbml: false,
                            version: 'v21.0',
                        });
                        fbWindow.FB = fb;
                        console.log('[WA-DEBUG] 2. FB.init() done');
                        resolve();
                    };
                    script.onerror = (e) => {
                        clearTimeout(sdkLoadTimer);
                        console.error('[WA-DEBUG] 2. FB SDK script failed to load:', e);
                        reject(new Error('Failed to load Facebook SDK'));
                    };
                    document.body.appendChild(script);
                });
            } else {
                // Re-init with potentially different app ID
                console.log('[WA-DEBUG] 2. Re-init existing FB SDK');
                fbWindow.FB.init({
                    appId: metaAppId,
                    cookie: true,
                    xfbml: false,
                    version: 'v21.0',
                });
                console.log('[WA-DEBUG] 2. FB.init() done (re-init)');
            }

            // 3. Launch Embedded Signup — listen for FB.login callback AND Meta postMessage,
            //    whichever arrives first. Timeout after 5 min so spinner never hangs forever.
            const loginOptions: Record<string, unknown> = embeddedSignupConfigId
                ? {
                    config_id: embeddedSignupConfigId,
                    response_type: 'code',
                    override_default_response_type: true,
                    extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
                }
                : {
                    scope: 'business_management,whatsapp_business_management,whatsapp_business_messaging',
                    response_type: 'code',
                };
            console.log('[WA-DEBUG] 3. FB.login options:', JSON.stringify(loginOptions));

            type SignupResult =
                | { kind: 'code'; code: string }
                | { kind: 'direct'; phoneNumberId: string; wabaId: string }
                | { kind: 'cancelled' }
                | { kind: 'timeout' };

            const signupResult = await new Promise<SignupResult>((resolve) => {
                let settled = false;
                const settle = (result: SignupResult) => {
                    console.log('[WA-DEBUG] settle() called → kind:', result.kind, '| already settled?', settled);
                    if (settled) return;
                    settled = true;
                    window.removeEventListener('message', onMessage);
                    clearTimeout(timer);
                    resolve(result);
                };

                // Capture Meta's postMessage when popup closes.
                // With config_id flow, Meta ONLY delivers results here (not via FB.login callback).
                // Events: FINISH (success), CANCEL / CLOSE (user quit), ERROR
                const onMessage = (event: MessageEvent) => {
                    console.log('[WA-DEBUG] window.message → origin:', event.origin, '| data:', event.data);
                    if (!String(event.origin).includes('facebook.com')) return;
                    try {
                        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                        console.log('[WA-DEBUG] FB postMessage parsed → type:', msg?.type, '| event:', msg?.event, '| data:', JSON.stringify(msg?.data));
                        if (msg?.type !== 'WA_EMBEDDED_SIGNUP') return;
                        if (msg.event === 'FINISH' && msg.data?.phone_number_id) {
                            settle({ kind: 'direct', phoneNumberId: msg.data.phone_number_id, wabaId: msg.data.waba_id || '' });
                        } else if (msg.event === 'FINISH' && msg.data?.code) {
                            // Some Meta flows send the OAuth code via postMessage instead of FB.login callback
                            console.log('[WA-DEBUG] WA_EMBEDDED_SIGNUP FINISH with code in postMessage');
                            settle({ kind: 'code', code: msg.data.code });
                        } else if (msg.event === 'CANCEL' || msg.event === 'CLOSE' || msg.event === 'ERROR') {
                            console.log('[WA-DEBUG] WA_EMBEDDED_SIGNUP user cancelled/closed → event:', msg.event);
                            settle({ kind: 'cancelled' });
                        } else {
                            // FINISH without phone_number_id and no code — unexpected; let timeout handle
                            console.log('[WA-DEBUG] WA_EMBEDDED_SIGNUP unhandled event:', msg.event, '| data:', JSON.stringify(msg?.data));
                        }
                    } catch (parseErr) {
                        console.warn('[WA-DEBUG] postMessage parse error:', parseErr);
                    }
                };

                // Fallback: auto-resolve after 5 minutes so spinner never hangs
                const timer = setTimeout(() => {
                    console.warn('[WA-DEBUG] 5-minute timeout fired → settling as timeout');
                    settle({ kind: 'timeout' });
                }, 5 * 60 * 1000);

                window.addEventListener('message', onMessage);

                console.log('[WA-DEBUG] 3. Calling FB.login()...');
                fbWindow.FB!.login((response) => {
                    console.log('[WA-DEBUG] FB.login callback → authResponse:', JSON.stringify(response?.authResponse), '| status:', (response as unknown as Record<string, unknown>)?.status);
                    if (response.authResponse?.code) {
                        // Got a code via the standard OAuth callback
                        settle({ kind: 'code', code: response.authResponse.code });
                    } else if (embeddedSignupConfigId) {
                        // config_id flow: null authResponse is NORMAL — Meta delivers results via
                        // postMessage (WA_EMBEDDED_SIGNUP FINISH/CANCEL) instead of the callback.
                        // Do NOT settle here; wait for the postMessage or the 5-min timeout.
                        console.log('[WA-DEBUG] FB.login null callback in config_id mode — waiting for postMessage...');
                    } else {
                        // Scope-based flow: null authResponse means user cancelled the popup
                        settle({ kind: 'cancelled' });
                    }
                }, loginOptions);
                console.log('[WA-DEBUG] 3. FB.login() called — waiting for callback or postMessage...');
            });
            console.log('[WA-DEBUG] Promise resolved → kind:', signupResult.kind);

            if (signupResult.kind === 'code') {
                // 4a. Exchange code for credentials via backend (60 s axios timeout)
                console.log('[WA-DEBUG] 4a. Sending code to /Settings/whatsapp/connect...');
                const connectRes = await api.post('/Settings/whatsapp/connect', { code: signupResult.code }, { timeout: 60000 });
                console.log('[WA-DEBUG] 4a. /connect response → status:', connectRes.status, '| data:', JSON.stringify(connectRes.data));
                if (connectRes.data.success) {
                    setSettings(prev => ({
                        ...prev,
                        whatsAppPhoneNumberId: connectRes.data.phoneNumberId || '',
                        whatsAppBusinessAccountId: connectRes.data.businessAccountId || '',
                        whatsAppDisplayPhone: connectRes.data.displayPhone || '',
                        whatsAppAccessToken: '••••••••',
                        whatsAppEnabled: true,
                    }));
                    setStatus({ type: 'success', message: t('whatsapp.settings.connectSuccess', 'WhatsApp connected successfully!') });
                } else {
                    setStatus({ type: 'error', message: connectRes.data.error || t('whatsapp.settings.connectFailed', 'Failed to connect WhatsApp.') });
                }
            } else if (signupResult.kind === 'direct') {
                // 4b. postMessage gave us phone_number_id + waba_id directly — save via PUT /Settings
                console.log('[WA-DEBUG] 4b. Saving direct credentials → phoneNumberId:', signupResult.phoneNumberId, '| wabaId:', signupResult.wabaId);
                const saveRes = await api.put('/Settings', {
                    whatsAppPhoneNumberId: signupResult.phoneNumberId,
                    whatsAppBusinessAccountId: signupResult.wabaId || undefined,
                    whatsAppEnabled: true,
                }, { timeout: 30000 });
                console.log('[WA-DEBUG] 4b. PUT /Settings response → status:', saveRes.status);
                if (saveRes.status < 300) {
                    setSettings(prev => ({
                        ...prev,
                        whatsAppPhoneNumberId: signupResult.phoneNumberId,
                        whatsAppBusinessAccountId: signupResult.wabaId,
                        whatsAppEnabled: true,
                    }));
                    setStatus({ type: 'success', message: t('whatsapp.settings.connectSuccess', 'WhatsApp connected successfully!') });
                } else {
                    setStatus({ type: 'error', message: t('whatsapp.settings.connectFailed', 'Failed to connect WhatsApp.') });
                }
            } else if (signupResult.kind === 'timeout') {
                setStatus({ type: 'error', message: t('whatsapp.settings.connectTimeout', 'Connection timed out. Please try again.') });
            } else {
                // User cancelled the dialog
                setStatus({ type: 'warning', message: t('whatsapp.settings.connectCancelled', 'WhatsApp connection was cancelled.') });
            }
        } catch (err: unknown) {
            console.error('[WA-DEBUG] CATCH block:', err);
            const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
            console.error('[WA-DEBUG] axios error detail → status:', (axiosErr as { response?: { status?: number } })?.response?.status, '| data:', JSON.stringify(axiosErr?.response?.data), '| message:', axiosErr?.message);
            setStatus({ type: 'error', message: axiosErr?.response?.data?.error || t('whatsapp.settings.connectFailed', 'Failed to connect WhatsApp.') });
        } finally {
            console.log('[WA-DEBUG] finally → setConnectingWhatsApp(false)');
            setConnectingWhatsApp(false);
        }
    };

    const handleDisconnectWhatsApp = async () => {
        setDisconnectingWhatsApp(true);
        setStatus(null);
        try {
            await api.post('/Settings/whatsapp/disconnect');
            setSettings(prev => ({
                ...prev,
                whatsAppPhoneNumberId: '',
                whatsAppAccessToken: '',
                whatsAppBusinessAccountId: '',
                whatsAppDisplayPhone: '',
                whatsAppEnabled: false,
            }));
            setStatus({ type: 'success', message: t('whatsapp.settings.disconnected', 'WhatsApp disconnected.') });
        } catch {
            setStatus({ type: 'error', message: t('whatsapp.settings.disconnectFailed', 'Failed to disconnect WhatsApp.') });
        } finally {
            setDisconnectingWhatsApp(false);
        }
    };

    const handleSaveManualCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!waManualCreds.phoneNumberId.trim() || !waManualCreds.accessToken.trim()) {
            setStatus({ type: 'error', message: 'Phone Number ID and Access Token are required.' });
            return;
        }
        setSavingManualCreds(true);
        setStatus(null);
        try {
            await api.put('/Settings', {
                whatsAppPhoneNumberId: waManualCreds.phoneNumberId.trim(),
                whatsAppAccessToken: waManualCreds.accessToken.trim(),
                whatsAppBusinessAccountId: waManualCreds.businessAccountId.trim() || null,
                whatsAppDisplayPhone: waManualCreds.displayPhone.trim() || null,
                whatsAppEnabled: true,
            });
            setSettings(prev => ({
                ...prev,
                whatsAppPhoneNumberId: waManualCreds.phoneNumberId.trim(),
                whatsAppAccessToken: '••••••••',
                whatsAppBusinessAccountId: waManualCreds.businessAccountId.trim(),
                whatsAppDisplayPhone: waManualCreds.displayPhone.trim(),
                whatsAppEnabled: true,
            }));
            setWaManualCreds({ phoneNumberId: '', accessToken: '', businessAccountId: '', displayPhone: '' });
            setStatus({ type: 'success', message: 'WhatsApp connected successfully!' });
        } catch {
            setStatus({ type: 'error', message: 'Failed to save WhatsApp credentials. Please check your values and try again.' });
        } finally {
            setSavingManualCreds(false);
        }
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
                <Loader2 className="animate-spin text-purple-600" size={32} />
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
        { key: 'whatsapp', label: t('whatsapp.settings.title', 'WhatsApp'), icon: MessageCircle },
    ];

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════

    return (
        <div className="max-w-6xl mx-auto px-4 py-6 lg:px-10">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center space-x-3">
                    <Settings className="text-purple-600" size={28} />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title', 'Settings')}</h1>
                        <p className="text-gray-500 text-sm">{t('settings.manage', 'Manage your company settings and preferences')}</p>
                    </div>
                </div>
                <button onClick={() => handleSave()} disabled={saving}
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-xl shadow-lg hover:bg-purple-700 transition-all disabled:opacity-50">
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

            {/* Main layout: Compact Tabs + Content below */}
            <div className="space-y-6">
                {/* ═══════════ SECTION TABS (compact horizontal bar) ═══════════ */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
                    {sections.map(sec => (
                        <button key={sec.key} onClick={() => setActiveSection(sec.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                                activeSection === sec.key
                                    ? 'bg-white text-purple-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}>
                            <sec.icon size={15} />
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
                                            personalTab === tab.key ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                        }`}>
                                        <tab.icon size={16} />{tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8">
                                {personalTab === 'company' && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <Building2 className="mr-2 text-purple-600" size={20} />
                                            {t('settings.companyInfo', 'Company Information')}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.companyName', 'Company Name')}</label>
                                                <input type="text" value={settings.companyName} onChange={e => updateSetting('companyName', e.target.value)}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.fiscalId', 'Tax ID (Matricule Fiscal)')}</label>
                                                <input type="text" value={settings.companyTaxId} onChange={e => updateSetting('companyTaxId', e.target.value)}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.address', 'Address')}</label>
                                                <textarea value={settings.companyAddress} onChange={e => updateSetting('companyAddress', e.target.value)} rows={2}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.phone', 'Phone')}</label>
                                                <input type="text" value={settings.companyPhone} onChange={e => updateSetting('companyPhone', e.target.value)}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.email', 'Email')}</label>
                                                <input type="email" value={settings.companyEmail} onChange={e => updateSetting('companyEmail', e.target.value)}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
                                            </div>
                                        </div>
                                        {/* Logo Upload */}
                                        <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                                <Image size={18} className="text-purple-600" />
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
                                                        className="flex items-center gap-2 px-4 py-2 bg-purple-600/5 text-purple-600 rounded-xl hover:bg-purple-600/10 transition-colors disabled:opacity-50">
                                                        {uploadingLogo ? <><Loader2 size={18} className="animate-spin" />Uploading...</> : <><Upload size={18} />{t('common.upload', 'Upload Logo')}</>}
                                                    </button>
                                                    <p className="text-xs text-gray-500 mt-2">{t('settings.logoHint', 'PNG or JPG, max 2MB. Appears on PDFs and emails.')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center mt-4 pt-4 border-t border-gray-100">
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input type="checkbox" checked={settings.showCompanyLogo} onChange={e => updateSetting('showCompanyLogo', e.target.checked)}
                                                        className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                                                    <span className="text-sm font-medium text-gray-700">{t('settings.showLogoOnPdf', 'Show logo on PDFs')}</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {personalTab === 'password' && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <Lock className="mr-2 text-purple-600" size={20} />
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
                                                className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50">
                                                {changingPassword ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Lock size={18} className="mr-2" />}
                                                {changingPassword ? t('common.loading', 'Changing...') : t('settings.changePassword', 'Change Password')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {personalTab === 'userinfo' && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <User className="mr-2 text-purple-600" size={20} />
                                            {t('settings.userInfo', 'Logged-in User')}
                                        </h3>
                                        <div className="p-6 bg-gray-50 rounded-xl space-y-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 bg-purple-600/10 rounded-full flex items-center justify-center">
                                                    <User size={32} className="text-purple-600" />
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
                                    <FileText className="mr-2 text-purple-600" size={20} />
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
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder={t('settings.emailSubjectPlaceholder')} />
                                    <p className="text-xs text-gray-500 mt-1">{t('settings.subjectHelp', 'Use @ placeholders for dynamic content. Example: Invoice #@InvoiceNumber from @CompanyName')}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.emailBody', 'Email Body')}</label>
                                    <textarea value={settings.defaultEmailBody} onChange={e => updateSetting('defaultEmailBody', e.target.value)} rows={10}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
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
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder={t('settings.emailSignaturePlaceholder')} />
                                    <p className="text-xs text-gray-500 mt-1">{t('settings.signatureHelp', 'This text is appended at the end of every email you send.')}</p>
                                </div>

                                {/* Include logo in email signature */}
                                <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="checkbox" checked={settings.includeLogoInEmailSignature}
                                            onChange={e => updateSetting('includeLogoInEmailSignature', e.target.checked)}
                                            className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
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
                                ]).map(tab => (
                                    <button key={tab.key} onClick={() => setPdfTab(tab.key)}
                                        className={`flex-shrink-0 sm:flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                            pdfTab === tab.key ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
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
                                            <PenTool className="mr-2 text-purple-600" size={20} />
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
                                                        className="flex items-center gap-2 px-4 py-2 bg-purple-600/5 text-purple-600 rounded-xl hover:bg-purple-600/10 transition-colors disabled:opacity-50">
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
                                                        className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
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
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                                placeholder={t('settings.signaturePlaceholder', 'E.g. John Smith')} />
                                            <p className="text-xs text-gray-500 mt-1">{t('settings.signatureNameHelp', 'The name that appears bold on the PDF signature')}</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.pdfSignerPosition', 'Signer Position / Title')}</label>
                                            <input type="text" value={settings.pdfSignerPosition} onChange={e => updateSetting('pdfSignerPosition', e.target.value)}
                                                maxLength={100}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                                placeholder={t('settings.signerPositionPlaceholder', 'E.g. Managing Director, CEO, Accountant')} />
                                            <p className="text-xs text-gray-500 mt-1">{t('settings.signerPositionHelp', 'Appears below the signature name on PDFs (e.g. job title or role)')}</p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-start sm:items-center mt-4 pt-4 border-t border-gray-100 gap-2">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input type="checkbox" checked={settings.proInvoiceUseTokenSignature}
                                                    onChange={e => updateSetting('proInvoiceUseTokenSignature', e.target.checked)}
                                                    className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
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
                                            <Palette className="mr-2 text-purple-600" size={20} />
                                            {t('settings.branding', 'Branding & Appearance')}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.language', 'Invoice Language')}</label>
                                                <select value={settings.invoiceLanguage} onChange={e => updateSetting('invoiceLanguage', e.target.value)}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none">
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
                                                    <button onClick={() => updateSetting('primaryColor', '#7C3AED')} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Reset</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.secondaryColor', 'Secondary Color')}</label>
                                                <div className="flex items-center space-x-3">
                                                    <input type="color" value={settings.secondaryColor} onChange={e => updateSetting('secondaryColor', e.target.value)} className="w-12 h-12 rounded-lg cursor-pointer border border-gray-200" />
                                                    <input type="text" value={settings.secondaryColor} onChange={e => updateSetting('secondaryColor', e.target.value)} className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
                                                    <button onClick={() => updateSetting('secondaryColor', '#8B5CF6')} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Reset</button>
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.pdfFooter', 'PDF Footer Text')}</label>
                                                <textarea value={settings.pdfFooterText} onChange={e => updateSetting('pdfFooterText', e.target.value)} rows={2}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
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
                                                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Eye size={18} className="text-purple-600" />{t('settings.livePdfPreview', 'Live PDF Preview')}</h4>
                                                <button onClick={handleGeneratePreview} disabled={generatingPreview}
                                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50">
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
                                            <DollarSign className="mr-2 text-purple-600" size={20} />
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
                                                    <div className={`w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-purple-500/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 ${settings.isProfileComplete ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
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
                                                    <span className="text-purple-600 font-bold">{(1000 + 1000 * settings.defaultVatRate + (settings.customTaxEnabled ? settings.customTaxAmount : 0)).toFixed(3)} {settings.currencySymbol}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    )}

                    {/* ──── SECTION 4: WhatsApp Settings ──── */}
                    {activeSection === 'whatsapp' && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 border-b border-gray-100">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <MessageCircle size={20} className="text-purple-600" />
                                        {t('whatsapp.settings.title', 'WhatsApp')}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">{t('whatsapp.settings.description', 'Configure your WhatsApp Business API credentials so messages appear from your company.')}</p>
                                </div>
                                <div className="p-6 space-y-5">
                                    {settings.whatsAppPhoneNumberId && settings.whatsAppAccessToken ? (
                                        /* ──── Connected State ──── */
                                        <>
                                            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="p-2 bg-emerald-100 rounded-lg">
                                                        <CheckCircle size={20} className="text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-emerald-800">{t('whatsapp.settings.connected', 'WhatsApp Connected')}</p>
                                                        <p className="text-xs text-emerald-600">{t('whatsapp.settings.configured', 'WhatsApp is configured and ready to send messages.')}</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                                    <div className="bg-white/70 rounded-lg p-3">
                                                        <p className="text-xs text-gray-500 mb-0.5">{t('whatsapp.settings.connectedPhone', 'Phone Number')}</p>
                                                        <p className="text-sm font-medium text-gray-900">{settings.whatsAppDisplayPhone || settings.whatsAppPhoneNumberId}</p>
                                                    </div>
                                                    <div className="bg-white/70 rounded-lg p-3">
                                                        <p className="text-xs text-gray-500 mb-0.5">{t('whatsapp.settings.businessAccountId', 'Business Account ID')}</p>
                                                        <p className="text-sm font-medium text-gray-900 truncate">{settings.whatsAppBusinessAccountId}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Enable toggle */}
                                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                                <div>
                                                    <label className="text-sm font-medium text-gray-900">{t('whatsapp.settings.enabled', 'Enable WhatsApp')}</label>
                                                    <p className="text-xs text-gray-500 mt-0.5">{t('whatsapp.settings.enabledHelp', 'When enabled, the Send via WhatsApp button will appear on invoices.')}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        updateSetting('whatsAppEnabled', !settings.whatsAppEnabled);
                                                        // Auto-save the toggle
                                                        api.put('/Settings', { whatsAppEnabled: !settings.whatsAppEnabled }).catch(() => {});
                                                    }}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.whatsAppEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}>
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.whatsAppEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            </div>

                                            {/* Disconnect */}
                                            <button
                                                onClick={handleDisconnectWhatsApp}
                                                disabled={disconnectingWhatsApp}
                                                className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors disabled:opacity-50">
                                                {disconnectingWhatsApp ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />}
                                                {t('whatsapp.settings.disconnect', 'Disconnect WhatsApp')}
                                            </button>
                                        </>
                                    ) : (
                                        /* ──── Not Connected State ──── */
                                        <>
                                            <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <MessageCircle size={20} className="text-amber-600" />
                                                    <p className="text-sm font-medium text-amber-700">
                                                        {t('whatsapp.settings.notConfigured', 'WhatsApp is not configured. Choose a setup method below to get started.')}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* ── Mode toggle ── */}
                                            <div className="flex rounded-xl border border-gray-200 p-1 bg-gray-50">
                                                <button
                                                    type="button"
                                                    onClick={() => setWaConnectMode('manual')}
                                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${waConnectMode === 'manual' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    Manual Setup
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setWaConnectMode('embedded')}
                                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${waConnectMode === 'embedded' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    Connect via Meta
                                                </button>
                                            </div>

                                            {/* ── Manual credentials form ── */}
                                            {waConnectMode === 'manual' && (
                                                <form onSubmit={handleSaveManualCredentials} className="space-y-4">
                                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                                        <div className="flex gap-3">
                                                            <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                                                            <div className="text-xs text-blue-700 space-y-1">
                                                                <p className="font-medium">Where to find your credentials:</p>
                                                                <ol className="list-decimal list-inside space-y-0.5">
                                                                    <li>Go to <span className="font-medium">developers.facebook.com</span> and open your WhatsApp app</li>
                                                                    <li>Navigate to <span className="font-medium">WhatsApp → API Setup</span></li>
                                                                    <li>Copy the <span className="font-medium">Phone Number ID</span></li>
                                                                    <li>Generate a <span className="font-medium">Permanent Access Token</span> (System User token)</li>
                                                                    <li>Copy the <span className="font-medium">WhatsApp Business Account ID</span></li>
                                                                </ol>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="text-sm font-medium text-gray-700">Phone Number ID <span className="text-red-500">*</span></label>
                                                            <input
                                                                type="text"
                                                                required
                                                                value={waManualCreds.phoneNumberId}
                                                                onChange={e => setWaManualCreds(p => ({ ...p, phoneNumberId: e.target.value }))}
                                                                placeholder="e.g. 123456789012345"
                                                                className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50/50 focus:bg-white font-mono"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-sm font-medium text-gray-700">Permanent Access Token <span className="text-red-500">*</span></label>
                                                            <input
                                                                type="password"
                                                                required
                                                                value={waManualCreds.accessToken}
                                                                onChange={e => setWaManualCreds(p => ({ ...p, accessToken: e.target.value }))}
                                                                placeholder="Paste your System User access token"
                                                                className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50/50 focus:bg-white font-mono"
                                                            />
                                                            <p className="text-xs text-gray-400 mt-1">Use a permanent System User token, not a temporary one.</p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-sm font-medium text-gray-700">Business Account ID</label>
                                                                <input
                                                                    type="text"
                                                                    value={waManualCreds.businessAccountId}
                                                                    onChange={e => setWaManualCreds(p => ({ ...p, businessAccountId: e.target.value }))}
                                                                    placeholder="Optional"
                                                                    className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50/50 focus:bg-white font-mono"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-sm font-medium text-gray-700">Display Phone</label>
                                                                <input
                                                                    type="text"
                                                                    value={waManualCreds.displayPhone}
                                                                    onChange={e => setWaManualCreds(p => ({ ...p, displayPhone: e.target.value }))}
                                                                    placeholder="+213 6XX XXX XXX"
                                                                    className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50/50 focus:bg-white"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="submit"
                                                        disabled={savingManualCreds}
                                                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] text-white font-medium rounded-xl shadow-lg hover:bg-[#20bd5a] transition-all disabled:opacity-50">
                                                        {savingManualCreds ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                                                        {savingManualCreds ? 'Saving...' : 'Connect WhatsApp'}
                                                    </button>
                                                </form>
                                            )}

                                            {/* ── Embedded Signup (Facebook) ── */}
                                            {waConnectMode === 'embedded' && (
                                                <>
                                                    <div className="text-center py-6">
                                                        <div className="mx-auto w-16 h-16 bg-[#25D366]/10 rounded-2xl flex items-center justify-center mb-4">
                                                            <MessageCircle size={32} className="text-[#25D366]" />
                                                        </div>
                                                        <h4 className="text-lg font-semibold text-gray-900 mb-2">{t('whatsapp.settings.connectTitle', 'Connect Your WhatsApp Business')}</h4>
                                                        <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                                                            {t('whatsapp.settings.connectDescription', 'Click the button below to link your WhatsApp Business number. You\'ll be guided through a quick setup process by Meta.')}
                                                        </p>
                                                        <button
                                                            onClick={handleConnectWhatsApp}
                                                            disabled={connectingWhatsApp}
                                                            className="inline-flex items-center gap-2.5 px-6 py-3 bg-[#25D366] text-white font-medium rounded-xl shadow-lg hover:bg-[#20bd5a] transition-all disabled:opacity-50 text-base">
                                                            {connectingWhatsApp ? <Loader2 size={20} className="animate-spin" /> : <MessageCircle size={20} />}
                                                            {connectingWhatsApp ? t('whatsapp.settings.connecting', 'Connecting...') : t('whatsapp.settings.connectButton', 'Connect WhatsApp')}
                                                        </button>
                                                    </div>

                                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                                        <div className="flex gap-3">
                                                            <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                                                            <div className="text-xs text-blue-700 space-y-1">
                                                                <p className="font-medium">{t('whatsapp.settings.howItWorks', 'How it works:')}</p>
                                                                <ol className="list-decimal list-inside space-y-0.5">
                                                                    <li>{t('whatsapp.settings.step1', 'A Facebook dialog will open')}</li>
                                                                    <li>{t('whatsapp.settings.step2', 'Log in with your Facebook account')}</li>
                                                                    <li>{t('whatsapp.settings.step3', 'Select or create a Meta Business Portfolio')}</li>
                                                                    <li>{t('whatsapp.settings.step4', 'Enter and verify your phone number')}</li>
                                                                    <li>{t('whatsapp.settings.step5', 'Done! Your WhatsApp is connected automatically')}</li>
                                                                </ol>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
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
                                    handleSave();
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

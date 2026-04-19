import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, MapPin, Phone, Mail, Hash, DollarSign, Upload,
    Loader2, CheckCircle, PenTool, Image, AlertCircle,
    Palette, Globe, Landmark
} from 'lucide-react';
import { useNotify } from '../hooks/useNotify';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import { CURRENCY_OPTIONS } from '../lib/currencyUtils';

const VAT_OPTIONS = [
    { label: '0%', value: 0 },
    { label: '7%', value: 0.07 },
    { label: '13%', value: 0.13 },
    { label: '19%', value: 0.19 },
];

export default function CompanyInitPage() {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const navigate = useNavigate();
    const { updateProfileComplete } = useAuth();
    const logoInputRef = useRef<HTMLInputElement>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [currentStep, setCurrentStep] = useState(1);

    // Company Info
    const [companyName, setCompanyName] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [companyEmail, setCompanyEmail] = useState('');
    const [taxId, setTaxId] = useState('');

    // Financial
    const [currency, setCurrency] = useState('TND');
    const [defaultVatRate, setDefaultVatRate] = useState(0.19);
    const [customTaxEnabled, setCustomTaxEnabled] = useState(true);
    const [customTaxName, setCustomTaxName] = useState('Timbre Fiscal');
    const [customTaxAmount, setCustomTaxAmount] = useState(1.0);

    // Bank Info
    const [bankName, setBankName] = useState('');
    const [bankBIC, setBankBIC] = useState('');
    const [bankIBAN, setBankIBAN] = useState('');
    const [showBankName, setShowBankName] = useState(true);
    const [showBankBIC, setShowBankBIC] = useState(true);
    const [showBankIBAN, setShowBankIBAN] = useState(true);

    // Branding
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
    const [primaryColor, setPrimaryColor] = useState('#7C3AED');
    const [secondaryColor, setSecondaryColor] = useState('#8B5CF6');

    // PDF Settings
    const [pdfFooterText, setPdfFooterText] = useState('');
    const [showCompanyLogo, setShowCompanyLogo] = useState(true);
    const [pdfSignatureText, setPdfSignatureText] = useState('');
    const [pdfSignerPosition, setPdfSignerPosition] = useState('');
    const [showSignatureOnPdf, setShowSignatureOnPdf] = useState(false);
    const [invoiceLanguage, setInvoiceLanguage] = useState('fr');
    const [fileSystemLanguage, setFileSystemLanguage] = useState('fr');
    const [fileSystemLanguageLocked, setFileSystemLanguageLocked] = useState(false);

    // Storage state removed — PDFs are not stored locally

    const [loading, setLoading] = useState(true);

    const totalSteps = 3;

    // ═══════════════════════════════════════════════════════════════
    // DATA HYDRATION - Fetch existing company data on mount
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const fetchExistingData = async () => {
            try {
                const res = await api.get('/settings');
                const data = res.data;
                
                // Pre-fill company info
                if (data.companyName) setCompanyName(data.companyName);
                if (data.companyAddress) setCompanyAddress(data.companyAddress);
                if (data.companyPhone) setCompanyPhone(data.companyPhone);
                if (data.companyEmail) setCompanyEmail(data.companyEmail);
                if (data.companyTaxId) setTaxId(data.companyTaxId);
                
                // Pre-fill financial settings
                if (data.currency) setCurrency(data.currency);
                if (data.defaultVatRate != null) setDefaultVatRate(data.defaultVatRate);
                if (data.customTaxEnabled != null) setCustomTaxEnabled(data.customTaxEnabled);
                if (data.customTaxName) setCustomTaxName(data.customTaxName);
                if (data.customTaxAmount != null) setCustomTaxAmount(data.customTaxAmount);

                // Pre-fill bank info
                if (data.bankName) setBankName(data.bankName);
                if (data.bankBIC) setBankBIC(data.bankBIC);
                if (data.bankIBAN) setBankIBAN(data.bankIBAN);
                if (data.showBankName != null) setShowBankName(data.showBankName);
                if (data.showBankBIC != null) setShowBankBIC(data.showBankBIC);
                if (data.showBankIBAN != null) setShowBankIBAN(data.showBankIBAN);

                // Pre-fill branding
                if (data.primaryColor) setPrimaryColor(data.primaryColor);
                if (data.secondaryColor) setSecondaryColor(data.secondaryColor);

                // Pre-fill PDF settings
                if (data.pdfFooterText) setPdfFooterText(data.pdfFooterText);
                if (data.showCompanyLogo != null) setShowCompanyLogo(data.showCompanyLogo);
                if (data.pdfSignatureText) setPdfSignatureText(data.pdfSignatureText);
                if (data.pdfSignerPosition) setPdfSignerPosition(data.pdfSignerPosition);
                if (data.showSignatureOnPdf != null) setShowSignatureOnPdf(data.showSignatureOnPdf);
                if (data.invoiceLanguage) setInvoiceLanguage(data.invoiceLanguage);
                if (data.fileSystemLanguage) setFileSystemLanguage(data.fileSystemLanguage);
                if (data.fileSystemLanguageLocked != null) setFileSystemLanguageLocked(data.fileSystemLanguageLocked);
                
                // Pre-fill storage path removed
                
                // Fetch logo as blob if exists (img tags can't send JWT headers)
                if (data.hasLogoData) {
                    try {
                        const logoRes = await api.get('/settings/logo', { responseType: 'blob' });
                        if (logoRes.data.size > 0) setLogoPreview(URL.createObjectURL(logoRes.data));
                    } catch { /* no logo */ }
                }
                
                // Fetch signature as blob if exists
                if (data.hasSignatureImage) {
                    try {
                        const sigRes = await api.get('/settings/signature', { responseType: 'blob' });
                        if (sigRes.data.size > 0) setSignaturePreview(URL.createObjectURL(sigRes.data));
                    } catch { /* no signature */ }
                }
                
                logger.info('[CompanyInit] Loaded existing data');
            } catch {
                // If 404 or no data, that's fine - user is setting up fresh
                logger.info('[CompanyInit] No existing data found, starting fresh');
            } finally {
                setLoading(false);
            }
        };
        
        fetchExistingData();
    }, []);

    const validateStep = (step: number): string | null => {
        if (step === 1) {
            if (!companyName.trim()) return t('companyInit.validation.companyNameRequired');
            if (!companyAddress.trim()) return t('companyInit.validation.companyAddressRequired');
        }
        return null;
    };

    const handleNext = () => {
        const err = validateStep(currentStep);
        if (err) { setError(err); return; }
        setError('');
        setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    };

    const handleBack = () => {
        setError('');
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError(t('companyInit.validation.imageOnly')); return; }
        if (file.size > 2 * 1024 * 1024) { setError(t('companyInit.validation.logoMaxSize')); return; }
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
        setError('');
    };

    const handleSignatureSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError(t('companyInit.validation.imageOnly')); return; }
        if (file.size > 2 * 1024 * 1024) { setError(t('companyInit.validation.fileMaxSize')); return; }
        setSignatureFile(file);
        setSignaturePreview(URL.createObjectURL(file));
        setError('');
    };

    const handleSubmit = async () => {
        const err = validateStep(currentStep);
        if (err) { setError(err); return; }

        setSaving(true);
        setError('');

        try {
            // Step 1: Save company info
            await api.put('/Settings/company', {
                name: companyName,
                address: companyAddress,
                phone: companyPhone,
                email: companyEmail,
                taxId: taxId,
            });

            // Step 2: Save ALL settings (triggers isProfileComplete = true via baseStoragePath)
            await api.put('/Settings', {
                // Financial
                currency,
                currencySymbol: currency,
                defaultVatRate,
                customTaxEnabled,
                customTaxName,
                customTaxAmount,
                // Bank
                bankName,
                bankBIC,
                bankIBAN,
                showBankName,
                showBankBIC,
                showBankIBAN,
                // Branding
                primaryColor,
                secondaryColor,
                // PDF Settings
                pdfFooterText,
                showCompanyLogo,
                pdfSignatureText: pdfSignatureText?.trim() ?? '',
                pdfSignerPosition: pdfSignerPosition?.trim() ?? '',
                showSignatureOnPdf,
                invoiceLanguage,
                // File system language
                fileSystemLanguage: fileSystemLanguage || undefined,
            });

            // Step 3: Upload logo if selected
            if (logoFile) {
                const logoData = new FormData();
                logoData.append('file', logoFile);
                await api.post('/Settings/logo', logoData, { headers: { 'Content-Type': undefined } });
            }

            // Step 4: Upload signature if selected
            if (signatureFile) {
                const sigData = new FormData();
                sigData.append('file', signatureFile);
                await api.post('/Settings/signature', sigData, { headers: { 'Content-Type': undefined } });
            }

            // Update localStorage so the app knows profile is complete
            localStorage.setItem('user_isProfileComplete', 'true');

            notify('success', t('companyInit.toast.success'));

            // Update AuthContext state so SettingsGuard unlocks the dashboard
            updateProfileComplete(true, '');

            navigate('/dashboard', { replace: true });
        } catch (err: unknown) {
            logger.error(t('companyInit.messages.setupErrorLog'), err);
            const msg = getErrorMessage(err, t('companyInit.messages.submitFailed'));
            setError(msg);
            notify('error', t('companyInit.toast.failed'));
        } finally {
            setSaving(false);
        }
    };

    const stepLabels = [
        t('companyInit.steps.companyInfo'),
        t('companyInit.steps.financial'),
        t('companyInit.steps.brandingPdf'),
    ];

    // Show loading state while fetching existing data
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#F0FDF4] to-[#F9FAFB] flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                    <p className="text-gray-600">{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#F0FDF4] to-[#F9FAFB] flex items-center justify-center p-4">
            <NotifyBanner />
            <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-lg rounded-2xl overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-8 py-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <Building2 className="w-8 h-8" />
                        <h1 className="text-2xl font-bold">{t('companyInit.title')}</h1>
                    </div>
                    <p className="text-white/80 text-sm">{t('companyInit.subtitle')}</p>

                    {/* Progress bar */}
                    <div className="mt-4 flex items-center gap-2">
                        {stepLabels.map((label, i) => (
                            <div key={i} className="flex-1">
                                <div className={cn(
                                    "h-1.5 rounded-full transition-all",
                                    i + 1 <= currentStep ? "bg-white" : "bg-white/30"
                                )} />
                                <p className={cn(
                                    "text-xs mt-1 transition-all",
                                    i + 1 === currentStep ? "text-white font-medium" : "text-white/50"
                                )}>{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-8">
                    {/* Step 1: Company Info */}
                    {currentStep === 1 && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">{t('settings.companyName')} *</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('companyInit.placeholders.companyName')} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">{t('settings.address')} *</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input value={companyAddress} onChange={e => setCompanyAddress(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('companyInit.placeholders.companyAddress')} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">{t('settings.fiscalId')}</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                        <input value={taxId} onChange={e => setTaxId(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50/50 focus:bg-white"
                                            placeholder={t('companyInit.placeholders.fiscalId')} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">{t('settings.phone')}</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                        <input value={companyPhone} onChange={e => setCompanyPhone(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50/50 focus:bg-white"
                                            placeholder={t('companyInit.placeholders.phone')} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">{t('users.fields.companyEmail')}</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('companyInit.placeholders.companyEmail')} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Financial & Banking */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Currency */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <DollarSign className="h-4 w-4" /> {t('users.fields.defaultCurrency')}
                                </label>
                                <select value={currency} onChange={e => setCurrency(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50/50 focus:bg-white">
                                    {CURRENCY_OPTIONS.map(c => (
                                        <option key={c.code} value={c.code}>{c.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* VAT Rate */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">{t('companyInit.defaultVatRate')}</label>
                                <div className="flex gap-2">
                                    {VAT_OPTIONS.map(opt => (
                                        <button key={opt.value} type="button"
                                            onClick={() => setDefaultVatRate(opt.value)}
                                            className={cn(
                                                "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all",
                                                defaultVatRate === opt.value
                                                    ? "border-purple-600 bg-purple-600/10 text-purple-600"
                                                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                                            )}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Tax */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={customTaxEnabled}
                                        onChange={e => setCustomTaxEnabled(e.target.checked)}
                                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                    <span className="text-sm font-medium text-gray-700">{t('companyInit.customTaxEnable')}</span>
                                </label>
                                {customTaxEnabled && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                                        <input value={customTaxName} onChange={e => setCustomTaxName(e.target.value)}
                                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                            placeholder={t('settings.taxName')} />
                                        <input type="number" step="0.001" value={customTaxAmount}
                                            onChange={e => setCustomTaxAmount(parseFloat(e.target.value) || 0)}
                                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                            placeholder={t('settings.taxAmount')} />
                                    </div>
                                )}
                            </div>

                            {/* Divider */}
                            <hr className="border-gray-100" />

                            {/* Bank Info */}
                            <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
                                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <Landmark className="h-4 w-4 text-blue-600" />
                                    {t('settings.pdfBankDetails')}
                                </h4>
                                <p className="text-xs text-gray-500 mb-4">{t('companyInit.bankInfoDesc')}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium text-gray-700">{t('companyInit.bankName')}</label>
                                            <label className="flex items-center space-x-1 cursor-pointer">
                                                <input type="checkbox" checked={showBankName} onChange={e => setShowBankName(e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded" />
                                                <span className="text-xs text-gray-500">{t('companyInit.showOnPdf')}</span>
                                            </label>
                                        </div>
                                        <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder={t('settings.bankNamePlaceholder')}
                                            className="w-full px-3 py-2.5 bg-white border border-blue-300 rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium text-gray-700">{t('settings.bankBICLabel')}</label>
                                            <label className="flex items-center space-x-1 cursor-pointer">
                                                <input type="checkbox" checked={showBankBIC} onChange={e => setShowBankBIC(e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded" />
                                                <span className="text-xs text-gray-500">{t('companyInit.showOnPdf')}</span>
                                            </label>
                                        </div>
                                        <input type="text" value={bankBIC} onChange={e => setBankBIC(e.target.value)} placeholder={t('settings.bankBICPlaceholder')}
                                            className="w-full px-3 py-2.5 bg-white border border-blue-300 rounded-lg text-sm font-mono" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium text-gray-700">{t('settings.bankIBANLabel')}</label>
                                            <label className="flex items-center space-x-1 cursor-pointer">
                                                <input type="checkbox" checked={showBankIBAN} onChange={e => setShowBankIBAN(e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded" />
                                                <span className="text-xs text-gray-500">{t('companyInit.showOnPdf')}</span>
                                            </label>
                                        </div>
                                        <input type="text" value={bankIBAN} onChange={e => setBankIBAN(e.target.value)} placeholder={t('settings.bankIBANPlaceholder')}
                                            className="w-full px-3 py-2.5 bg-white border border-blue-300 rounded-lg text-sm font-mono" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Branding & PDF Settings */}
                    {currentStep === 3 && (
                        <div className="space-y-6 animate-fade-in max-h-[60vh] overflow-y-auto pr-1">
                            {/* Logo Upload */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Image className="h-4 w-4" /> {t('settings.logo')}
                                    <span className="text-xs text-gray-400">({t('common.optional')})</span>
                                    {logoPreview && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                                </label>
                                <div className="flex items-center gap-4">
                                    {logoPreview ? (
                                        <div className="relative">
                                            <img src={logoPreview} alt={t('settings.logo')} className="h-16 w-16 object-contain rounded-lg border-2 border-emerald-400" />
                                            <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">
                                                &times;
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="h-16 w-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                                            <Image className="h-6 w-6 text-gray-300" />
                                        </div>
                                    )}
                                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                                    <button type="button" onClick={() => logoInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                        <Upload className="h-4 w-4" /> {logoFile ? t('companyInit.changeLogo') : t('companyInit.uploadLogo')}
                                    </button>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer mt-2">
                                    <input type="checkbox" checked={showCompanyLogo}
                                        onChange={e => setShowCompanyLogo(e.target.checked)}
                                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                    <span className="text-sm text-gray-600">{t('settings.showLogoOnPdf')}</span>
                                </label>
                            </div>

                            {/* Signature Upload */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <PenTool className="h-4 w-4" /> {t('settings.signature')}
                                    <span className="text-xs text-gray-400">({t('common.optional')})</span>
                                    {signaturePreview && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                                </label>
                                <div className="flex items-center gap-4">
                                    {signaturePreview ? (
                                        <div className="relative">
                                            <img src={signaturePreview} alt={t('settings.signature')} className="h-16 w-auto max-w-[120px] object-contain rounded-lg border-2 border-emerald-400" />
                                            <button type="button" onClick={() => { setSignatureFile(null); setSignaturePreview(null); }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">
                                                &times;
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="h-16 w-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                                            <PenTool className="h-6 w-6 text-gray-300" />
                                        </div>
                                    )}
                                    <input ref={signatureInputRef} type="file" accept="image/*" onChange={handleSignatureSelect} className="hidden" />
                                    <button type="button" onClick={() => signatureInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                        <Upload className="h-4 w-4" /> {signatureFile ? t('common.edit') : t('settings.uploadSignature')}
                                    </button>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer mt-1">
                                    <input type="checkbox" checked={showSignatureOnPdf}
                                        onChange={e => setShowSignatureOnPdf(e.target.checked)}
                                        disabled={!signaturePreview}
                                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                    <span className={cn("text-sm", signaturePreview ? "text-gray-600" : "text-gray-400")}>
                                        {t('settings.showSignatureOnPdf')}
                                    </span>
                                </label>
                            </div>

                            {/* Signature Text & Position */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">{t('settings.pdfSignature')}</label>
                                    <input type="text" value={pdfSignatureText} onChange={e => setPdfSignatureText(e.target.value)}
                                        maxLength={100}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder={t('settings.signaturePlaceholder')} />
                                    <p className="text-xs text-gray-400">{t('settings.signatureTextHelp')}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">{t('settings.pdfSignerPosition')}</label>
                                    <input type="text" value={pdfSignerPosition} onChange={e => setPdfSignerPosition(e.target.value)}
                                        maxLength={100}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder={t('settings.signerPositionPlaceholder')} />
                                    <p className="text-xs text-gray-400">{t('settings.signerPositionHelp')}</p>
                                </div>
                            </div>

                            {/* Divider */}
                            <hr className="border-gray-100" />

                            {/* Colors */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Palette className="h-4 w-4" /> {t('settings.branding')}
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-500">{t('settings.primaryColor')}</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                                                className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200" />
                                            <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-500">{t('settings.secondaryColor')}</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                                                className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200" />
                                            <input type="text" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
                                        </div>
                                    </div>
                                </div>
                                {/* Color Preview */}
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-8 rounded-md" style={{ backgroundColor: primaryColor }} />
                                    <div className="flex-1 h-8 rounded-md" style={{ background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }} />
                                    <div className="w-16 h-8 rounded-md" style={{ backgroundColor: secondaryColor }} />
                                </div>
                            </div>

                            {/* PDF Footer */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">{t('settings.pdfFooter')}</label>
                                <textarea value={pdfFooterText} onChange={e => setPdfFooterText(e.target.value)} rows={2}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder={t('companyInit.pdfFooterPlaceholder')} />
                            </div>

                            {/* Divider */}
                            <hr className="border-gray-100" />

                            {/* Language Settings */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Globe className="h-4 w-4" /> {t('settings.language')}
                                    </label>
                                    <select value={invoiceLanguage} onChange={e => setInvoiceLanguage(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none">
                                        <option value="fr">Français</option>
                                        <option value="en">English</option>
                                        <option value="de">Deutsch</option>
                                        <option value="ar">العربية</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">{t('companyInit.fileSystemLanguage')}</label>
                                    <select value={fileSystemLanguage} onChange={e => setFileSystemLanguage(e.target.value)}
                                        disabled={fileSystemLanguageLocked}
                                        className={cn(
                                            "w-full px-3 py-2.5 border rounded-lg text-sm",
                                            fileSystemLanguageLocked
                                                ? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed"
                                                : "border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                                        )}>
                                        <option value="fr">Français (Factures, Devis)</option>
                                        <option value="en">English (Invoices, Quotes)</option>
                                        <option value="de">Deutsch (Rechnungen, Angebote)</option>
                                        <option value="ar">العربية (فواتير, عروض أسعار)</option>
                                    </select>
                                    {!fileSystemLanguageLocked && (
                                        <p className="text-xs text-amber-600 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            {t('companyInit.fileSystemLanguageWarning')}
                                        </p>
                                    )}
                                    {fileSystemLanguageLocked && (
                                        <p className="text-xs text-gray-400">{t('companyInit.fileSystemLanguageLocked')}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-start gap-2 animate-slide-up">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-between mt-8">
                        {currentStep > 1 ? (
                            <button type="button" onClick={handleBack}
                                className="px-6 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-all">
                                {t('common.back')}
                            </button>
                        ) : <div />}

                        {currentStep < totalSteps ? (
                            <button type="button" onClick={handleNext}
                                className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-xl shadow-lg hover:bg-purple-700 transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                                {t('companyInit.continue')}
                            </button>
                        ) : (
                            <button type="button" onClick={handleSubmit} disabled={saving}
                                className={cn(
                                    "px-8 py-3 bg-purple-600 text-white font-semibold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                                    saving && "opacity-70 cursor-not-allowed"
                                )}>
                                <div className="flex items-center gap-2">
                                    {saving ? (
                                        <><Loader2 className="h-5 w-5 animate-spin" /><span>{t('common.saving')}</span></>
                                    ) : (
                                        <><CheckCircle className="h-5 w-5" /><span>{t('companyInit.completeSetup')}</span></>
                                    )}
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
}

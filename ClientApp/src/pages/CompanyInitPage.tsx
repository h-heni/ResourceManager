import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, MapPin, Phone, Mail, Hash, DollarSign, Upload,
    Loader2, CheckCircle, PenTool, FolderOpen, Image, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { CURRENCY_OPTIONS } from '../lib/currencyUtils';

const VAT_OPTIONS = [
    { label: '0%', value: 0 },
    { label: '7%', value: 0.07 },
    { label: '13%', value: 0.13 },
    { label: '19%', value: 0.19 },
];

export default function CompanyInitPage() {
    const { t } = useTranslation();
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
    const [matriculeFiscal, setMatriculeFiscal] = useState('');

    // Financial
    const [currency, setCurrency] = useState('TND');
    const [defaultVatRate, setDefaultVatRate] = useState(0.19);
    const [customTaxEnabled, setCustomTaxEnabled] = useState(true);
    const [customTaxName, setCustomTaxName] = useState('Timbre Fiscal');
    const [customTaxAmount, setCustomTaxAmount] = useState(1.0);

    // Branding
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

    // Storage
    const [baseStoragePath, setBaseStoragePath] = useState('');

    const totalSteps = 3;

    const validateStep = (step: number): string | null => {
        if (step === 1) {
            if (!companyName.trim()) return t('companyInit.validation.companyNameRequired');
            if (!companyAddress.trim()) return t('companyInit.validation.companyAddressRequired');
        }
        if (step === 3) {
            if (!baseStoragePath.trim()) return t('companyInit.validation.storagePathRequired');
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

    const handleBrowseFolder = async () => {
        try {
            const res = await api.get('/pdf-storage/browse-folders');
            if (res.data?.drives?.length > 0) {
                const firstDrive = res.data.drives[0];
                setBaseStoragePath(firstDrive.endsWith('\\') ? firstDrive : firstDrive + '\\');
            }
        } catch {
            // Folder browsing not available — user must type manually
        }
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
                matriculeFiscal: matriculeFiscal,
            });

            // Step 2: Save financial settings + storage path (triggers isProfileComplete = true)
            await api.put('/Settings', {
                currency,
                currencySymbol: currency,
                defaultVatRate,
                customTaxEnabled,
                customTaxName,
                customTaxAmount,
                baseStoragePath,
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
            localStorage.setItem('user_baseStoragePath', baseStoragePath);

            toast.success(t('companyInit.toast.success'));

            // Update AuthContext state so SettingsGuard unlocks the dashboard
            updateProfileComplete(true, baseStoragePath);

            navigate('/dashboard', { replace: true });
        } catch (err: unknown) {
            console.error(t('companyInit.messages.setupErrorLog'), err);
            const msg = getErrorMessage(err, t('companyInit.messages.submitFailed'));
            setError(msg);
            toast.error(t('companyInit.toast.failed'));
        } finally {
            setSaving(false);
        }
    };

    const stepLabels = [
        t('companyInit.steps.companyInfo'),
        t('companyInit.steps.financialBranding'),
        t('companyInit.steps.storageFinish')
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#F0FDF4] to-[#F9FAFB] flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-lg rounded-2xl overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#065F46] to-[#14B8A6] px-8 py-6 text-white">
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
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('companyInit.placeholders.companyName')} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">{t('settings.address')} *</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input value={companyAddress} onChange={e => setCompanyAddress(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('companyInit.placeholders.companyAddress')} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">{t('settings.fiscalId')}</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                        <input value={matriculeFiscal} onChange={e => setMatriculeFiscal(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none bg-gray-50/50 focus:bg-white"
                                            placeholder={t('companyInit.placeholders.fiscalId')} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">{t('settings.phone')}</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                        <input value={companyPhone} onChange={e => setCompanyPhone(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none bg-gray-50/50 focus:bg-white"
                                            placeholder={t('companyInit.placeholders.phone')} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">{t('users.fields.companyEmail')}</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('companyInit.placeholders.companyEmail')} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Financial & Branding */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Currency */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <DollarSign className="h-4 w-4" /> {t('users.fields.defaultCurrency')}
                                </label>
                                <select value={currency} onChange={e => setCurrency(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none bg-gray-50/50 focus:bg-white">
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
                                                    ? "border-[#065F46] bg-[#065F46]/10 text-[#065F46]"
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
                                        className="rounded border-gray-300 text-[#065F46] focus:ring-[#065F46]" />
                                    <span className="text-sm font-medium text-gray-700">{t('companyInit.customTaxEnable')}</span>
                                </label>
                                {customTaxEnabled && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                                        <input value={customTaxName} onChange={e => setCustomTaxName(e.target.value)}
                                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#065F46] outline-none"
                                            placeholder={t('settings.taxName')} />
                                        <input type="number" step="0.001" value={customTaxAmount}
                                            onChange={e => setCustomTaxAmount(parseFloat(e.target.value) || 0)}
                                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#065F46] outline-none"
                                            placeholder={t('settings.taxAmount')} />
                                    </div>
                                )}
                            </div>

                            {/* Divider */}
                            <hr className="border-gray-100" />

                            {/* Logo Upload */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Image className="h-4 w-4" /> {t('settings.logo')}
                                    <span className="text-xs text-gray-400">({t('common.optional')})</span>
                                </label>
                                <div className="flex items-center gap-4">
                                    {logoPreview ? (
                                        <div className="relative">
                                            <img src={logoPreview} alt={t('settings.logo')} className="h-16 w-16 object-contain rounded-lg border border-gray-200" />
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
                            </div>

                            {/* Signature Upload */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <PenTool className="h-4 w-4" /> {t('settings.signature')}
                                    <span className="text-xs text-gray-400">({t('common.optional')})</span>
                                </label>
                                <div className="flex items-center gap-4">
                                    {signaturePreview ? (
                                        <div className="relative">
                                            <img src={signaturePreview} alt={t('settings.signature')} className="h-16 w-auto max-w-[120px] object-contain rounded-lg border border-gray-200" />
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
                            </div>
                        </div>
                    )}

                    {/* Step 3: Storage */}
                    {currentStep === 3 && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium">{t('companyInit.storageRequiredTitle')}</p>
                                        <p className="mt-1">{t('companyInit.storageRequiredMessage')}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <FolderOpen className="h-4 w-4" /> {t('settings.baseStoragePath')} *
                                </label>
                                <div className="flex gap-2">
                                    <input value={baseStoragePath} onChange={e => setBaseStoragePath(e.target.value)}
                                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none bg-gray-50/50 focus:bg-white font-mono text-sm"
                                        placeholder={t('companyInit.placeholders.baseStoragePath')} />
                                    <button type="button" onClick={handleBrowseFolder}
                                        className="px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
                                        <FolderOpen className="h-5 w-5" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500">{t('companyInit.storagePathExample')}</p>
                            </div>

                            {/* Summary */}
                            <div className="mt-6 bg-gray-50 rounded-xl p-5 space-y-3">
                                <h3 className="font-medium text-gray-700 text-sm">{t('companyInit.setupSummary')}</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-gray-500">{t('common.company')}</div>
                                    <div className="font-medium">{companyName || t('companyInit.notSet')}</div>
                                    <div className="text-gray-500">{t('settings.address')}</div>
                                    <div className="font-medium">{companyAddress || t('companyInit.notSet')}</div>
                                    <div className="text-gray-500">{t('settings.currency')}</div>
                                    <div className="font-medium">{currency}</div>
                                    <div className="text-gray-500">{t('companyInit.defaultVatRate')}</div>
                                    <div className="font-medium">{(defaultVatRate * 100).toFixed(0)}%</div>
                                    <div className="text-gray-500">{t('settings.logo')}</div>
                                    <div className="font-medium">{logoFile ? t('companyInit.selected') : t('companyInit.none')}</div>
                                    <div className="text-gray-500">{t('settings.signature')}</div>
                                    <div className="font-medium">{signatureFile ? t('companyInit.selected') : t('companyInit.none')}</div>
                                    <div className="text-gray-500">{t('settings.baseStoragePath')}</div>
                                    <div className="font-medium font-mono text-xs break-all">{baseStoragePath || t('companyInit.notSet')}</div>
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
                                className="px-6 py-3 bg-[#065F46] text-white font-semibold rounded-xl shadow-lg hover:bg-[#047857] transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                                {t('companyInit.continue')}
                            </button>
                        ) : (
                            <button type="button" onClick={handleSubmit} disabled={saving}
                                className={cn(
                                    "px-8 py-3 bg-[#065F46] text-white font-semibold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
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

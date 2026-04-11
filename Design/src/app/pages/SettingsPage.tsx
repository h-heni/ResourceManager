import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
    Settings, Building2, Save, Palette, DollarSign, User, Lock, Mail
} from 'lucide-react';
import { useSettings, useSaveSettings } from '../hooks/useSettings';
import { DEFAULT_CURRENCY, CURRENCY_OPTIONS } from '../lib/currencyUtils';
import { useNotify } from '../hooks/useNotify';
import { getErrorMessage } from '../utils/errorUtils';
import { logger } from '../lib/logger';

interface CompanySettings {
    companyName: string;
    companyAddress: string;
    companyTaxId: string;
    companyPhone: string;
    companyEmail: string;
    currency: string;
    currencySymbol: string;
    defaultVatRate: number;
    primaryColor: string;
    secondaryColor: string;
}

type SettingsTab = 'company' | 'branding' | 'financial' | 'personal';

export default function SettingsPage() {
    const { t } = useTranslation();
    const { canManageSettings, displayName, user } = useAuth();
    const { notify, NotifyBanner } = useNotify();
    const [activeTab, setActiveTab] = useState<SettingsTab>('company');

    // React Query
    const { data: settingsData, isLoading: loading } = useSettings();
    const saveSettingsMutation = useSaveSettings();

    const [settings, setSettings] = useState<CompanySettings>({
        companyName: '',
        companyAddress: '',
        companyTaxId: '',
        companyPhone: '',
        companyEmail: '',
        currency: DEFAULT_CURRENCY,
        currencySymbol: '$',
        defaultVatRate: 20,
        primaryColor: '#065F46',
        secondaryColor: '#10B981',
    });

    // Update settings when data loads
    useEffect(() => {
        if (settingsData) {
            setSettings(prev => ({ ...prev, ...settingsData }));
        }
    }, [settingsData]);

    const handleSave = async () => {
        if (!canManageSettings) {
            notify('warning', t('common.managerOnly'));
            return;
        }
        try {
            await saveSettingsMutation.mutateAsync(settings);
            notify('success', t('settings.saveSuccess', 'Settings saved successfully'));
        } catch (error) {
            logger.error('Error saving settings', error);
            notify('error', getErrorMessage(error, t('settings.saveFailed', 'Failed to save settings')));
        }
    };

    const handleInputChange = (field: keyof CompanySettings, value: string | number) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const tabs = [
        { id: 'company' as SettingsTab, label: t('settings.company', 'Company Info'), icon: Building2 },
        { id: 'branding' as SettingsTab, label: t('settings.branding', 'Branding'), icon: Palette },
        { id: 'financial' as SettingsTab, label: t('settings.financial', 'Financial'), icon: DollarSign },
        { id: 'personal' as SettingsTab, label: t('settings.personal', 'Personal'), icon: User },
    ];

    if (loading) {
        return <div className="text-center py-20 text-gray-500">{t('settings.loading', 'Loading settings...')}</div>;
    }

    return (
        <div className="space-y-6">
            <NotifyBanner />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">⚙️ {t('nav.settings', 'Settings')}</h1>
                    <p className="text-gray-500 mt-1">{t('settings.pageDescription', 'Manage your account and company settings')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-[#065F46] text-white shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <Icon size={20} />
                                    <span className="font-medium">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                        {activeTab === 'company' && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Building2 size={24} className="text-[#065F46]" />
                                    {t('settings.companyInfo', 'Company Information')}
                                </h2>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('settings.companyName', 'Company Name')}
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.companyName}
                                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none"
                                        disabled={!canManageSettings}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('settings.companyAddress', 'Address')}
                                    </label>
                                    <textarea
                                        value={settings.companyAddress}
                                        onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none"
                                        disabled={!canManageSettings}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {t('settings.companyPhone', 'Phone')}
                                        </label>
                                        <input
                                            type="text"
                                            value={settings.companyPhone}
                                            onChange={(e) => handleInputChange('companyPhone', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none"
                                            disabled={!canManageSettings}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {t('settings.companyEmail', 'Email')}
                                        </label>
                                        <input
                                            type="email"
                                            value={settings.companyEmail}
                                            onChange={(e) => handleInputChange('companyEmail', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none"
                                            disabled={!canManageSettings}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('settings.taxId', 'Tax ID')}
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.companyTaxId}
                                        onChange={(e) => handleInputChange('companyTaxId', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none"
                                        disabled={!canManageSettings}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'branding' && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Palette size={24} className="text-[#065F46]" />
                                    {t('settings.branding', 'Branding')}
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {t('settings.primaryColor', 'Primary Color')}
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={settings.primaryColor}
                                                onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                                                className="h-10 w-20 border border-gray-200 rounded-lg cursor-pointer"
                                                disabled={!canManageSettings}
                                            />
                                            <input
                                                type="text"
                                                value={settings.primaryColor}
                                                onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none"
                                                disabled={!canManageSettings}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {t('settings.secondaryColor', 'Secondary Color')}
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={settings.secondaryColor}
                                                onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                                                className="h-10 w-20 border border-gray-200 rounded-lg cursor-pointer"
                                                disabled={!canManageSettings}
                                            />
                                            <input
                                                type="text"
                                                value={settings.secondaryColor}
                                                onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none"
                                                disabled={!canManageSettings}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'financial' && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <DollarSign size={24} className="text-[#065F46]" />
                                    {t('settings.financial', 'Financial Settings')}
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {t('settings.currency', 'Currency')}
                                        </label>
                                        <select
                                            value={settings.currency}
                                            onChange={(e) => {
                                                const curr = e.target.value;
                                                handleInputChange('currency', curr);
                                                handleInputChange('currencySymbol', CURRENCY_OPTIONS.find(c => c.code === curr)?.symbol || '$');
                                            }}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none"
                                            disabled={!canManageSettings}
                                        >
                                            {CURRENCY_OPTIONS.map(opt => (
                                                <option key={opt.code} value={opt.code}>
                                                    {opt.symbol} - {opt.code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {t('settings.vatRate', 'Default VAT Rate (%)')}
                                        </label>
                                        <input
                                            type="number"
                                            value={settings.defaultVatRate}
                                            onChange={(e) => handleInputChange('defaultVatRate', parseFloat(e.target.value) || 0)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none"
                                            disabled={!canManageSettings}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'personal' && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <User size={24} className="text-[#065F46]" />
                                    {t('settings.personal', 'Personal Information')}
                                </h2>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 bg-[#065F46] text-white rounded-full flex items-center justify-center text-lg font-bold">
                                            {displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{displayName}</p>
                                            <p className="text-sm text-gray-500">{user?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Mail size={16} />
                                        <span>{user?.email}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Save Button */}
                        {canManageSettings && activeTab !== 'personal' && (
                            <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={saveSettingsMutation.isPending}
                                    className="flex items-center gap-2 px-6 py-3 bg-[#065F46] text-white rounded-xl hover:bg-[#064E3B] transition-colors disabled:opacity-50"
                                >
                                    <Save size={20} />
                                    {saveSettingsMutation.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save Changes')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
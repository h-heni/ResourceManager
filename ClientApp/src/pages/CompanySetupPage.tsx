import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, MapPin, Hash, Phone, Loader, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';
import { cn } from '../lib/utils';

export default function CompanySetupPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        companyName: '',
        address: '',
        matriculeFiscal: '',
        phone: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/Company/setup', formData);
            // Clear the needsCompanySetup flag
            localStorage.removeItem('needsCompanySetup');
            navigate('/dashboard');
        } catch (err: unknown) {
            console.error(err);
            const msg = getErrorMessage(err, t('companySetup.setupFailed'));
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
            <div className="w-full max-w-lg bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden animate-fade-in">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#065F46] to-[#14B8A6] rounded-full mb-4">
                            <Building className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-[#065F46]">
                            {t('companySetup.title')}
                        </h1>
                        <p className="text-gray-500 mt-2">{t('companySetup.subtitle')}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">{t('companySetup.companyName')} *</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input
                                    name="companyName"
                                    value={formData.companyName}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder={t('companySetup.placeholders.companyName')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">{t('companySetup.address')} *</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder={t('companySetup.placeholders.address')}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">{t('companySetup.matriculeFiscal')} *</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input
                                        name="matriculeFiscal"
                                        value={formData.matriculeFiscal}
                                        onChange={handleChange}
                                        required
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('companySetup.placeholders.matriculeFiscal')}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">{t('companySetup.phone')}</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('companySetup.placeholders.phone')}
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(
                                "w-full py-3 px-4 rounded-xl text-white font-semibold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                                "bg-[#065F46] hover:bg-[#047857]",
                                loading && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                {loading ? (
                                    <>
                                        <Loader className="animate-spin h-5 w-5" />
                                        <span>{t('companySetup.settingUp')}</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-5 w-5" />
                                        <span>{t('companySetup.completeSetup')}</span>
                                    </>
                                )}
                            </div>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, FileText, Calendar, Download, Trash2, Filter, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/formatNumber';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';

interface DevisItem {
    id: number;
    description: string;
    quantity: number;
    price: number;
    tva: boolean;
    vatRate?: number;
    totalItemHT?: number;
    itemTaxAmount?: number;
}

interface Devis {
    id: number;
    number: string;
    date: string;
    totalAmount: number;
    subTotal: number;
    taxAmount: number;
    clientName: string;
    clientId: number;
    status: string;
    treated: boolean;
    devisItems?: DevisItem[];
    currency?: string;
    currencySymbol?: string;
    tfiscal?: number;
    tfiscalName?: string;
}

const getQuoteNumber = (quote: Devis & { Number?: string }) => quote.number || quote.Number || '';

export default function QuotesPage() {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const [quotes, setQuotes] = useState<Devis[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const navigate = useNavigate();
    const { isManager } = useAuth();

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        fetchQuotes();
    }, []);
    /* eslint-enable react-hooks/exhaustive-deps */

    // Refetch when a payment is confirmed/extended via NotificationBell (cascade changes quote status)
    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        const handler = () => fetchQuotes();
        window.addEventListener('payment-status-changed', handler);
        return () => window.removeEventListener('payment-status-changed', handler);
    }, []);
    /* eslint-enable react-hooks/exhaustive-deps */

    const fetchQuotes = async () => {
        try {
            const res = await api.get('/Devis');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            
            // Fetch full details for each quote to get items
            const quotesWithDetails = await Promise.all(
                data.filter((q: Devis) => q.status !== 'Rejected').map(async (q: Devis) => {
                    try {
                        const detailRes = await api.get(`/Devis/${q.id}`);
                        return { ...detailRes.data, clientName: q.clientName };
                    } catch {
                        return q;
                    }
                })
            );
            
            setQuotes(quotesWithDetails);
        } catch (error) {
            logger.error(t('quote.messages.fetchErrorLog'), error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = async (id: number, number: string | number) => {
        try {
            const res = await api.get(`/Devis/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Devis_${number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            logger.error(t('quote.messages.downloadErrorLog'), error);
            notify('error', t('common.downloadFailed'));
        }
    };

    const handleDeleteQuote = async (id: number) => {
        if (!confirm(t('quote.confirmDelete'))) return;
        try {
            await api.delete(`/Devis/${id}`);
            fetchQuotes();
        } catch (error) {
            logger.error(t('quote.messages.deleteErrorLog'), error);
            notify('error', t('quote.deleteError'));
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed':
                return 'bg-emerald-100 text-emerald-700';
            case 'Active':
                return 'bg-blue-100 text-blue-700';
            case 'Accepted':
                return 'bg-emerald-100 text-emerald-700';
            case 'Rejected':
                return 'bg-red-100 text-red-700';
            case 'Draft':
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const filteredQuotes = (quotes || []).filter(q => {
        const numMatch = getQuoteNumber(q)?.toString().includes(search) ?? false;
        const clientMatch = q.clientName?.toLowerCase().includes(search.toLowerCase()) ?? false;
        const searchMatch = numMatch || clientMatch;
        const isArchived = q.treated === true;
        if (viewMode === 'active') return searchMatch && !isArchived;
        return searchMatch && isArchived;
    });

    const activeCount = (quotes || []).filter(q => !q.treated).length;
    const archivedCount = (quotes || []).filter(q => q.treated === true).length;

    return (
        <div className="space-y-6">
            <NotifyBanner />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('quote.title')}</h1>
                    <p className="text-gray-500 mt-1">{t('quote.pageDescription')}</p>
                </div>
                <button
                    onClick={() => navigate('/quotes/create')}
                    className="flex items-center px-4 py-2 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all transform hover:scale-105"
                >
                    <Plus size={20} className="mr-2" />
                    {t('quote.create')}
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('quote.searchPlaceholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none transition-all"
                    />
                </div>
                {isManager && (
                    <div className="flex flex-wrap p-1 bg-gray-100 rounded-xl">
                        <button
                            onClick={() => setViewMode('active')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                viewMode === 'active' ? 'bg-white shadow-sm text-[#065F46]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Filter size={16} />
                            {t('quote.active')} ({activeCount})
                        </button>
                        <button
                            onClick={() => setViewMode('archived')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                viewMode === 'archived' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Archive size={16} />
                            {t('quote.archived')} ({archivedCount})
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">{t('quote.loading')}</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredQuotes.map((quote) => (
                        <div key={quote.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center space-x-3">
                                    <div className="h-10 w-10 bg-[#065F46]/5 rounded-xl flex items-center justify-center text-[#065F46] font-bold">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-gray-900">#{getQuoteNumber(quote)}</h3>
                                        <p className="text-sm font-semibold text-gray-800">{quote.clientName || t('common.unknown')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handleDownloadPdf(quote.id, getQuoteNumber(quote))}
                                        className="p-2 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded-lg transition-colors"
                                        title={t('quote.downloadPdf')}
                                    >
                                        <Download size={18} />
                                    </button>
                                    {/* Delete allowed for Draft and Active quotes (not Completed or Accepted) */}
                                    {(quote.status === 'Draft' || quote.status === 'Active') && (
                                        <button
                                            onClick={() => handleDeleteQuote(quote.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title={t('quote.deleteQuote')}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(quote.status)}`}>
                                        {quote.status ? t(`quote.status.${quote.status}`, quote.status) : t('invoice.draft')}
                                    </span>
                                </div>
                            </div>

                            {/* Date and Total */}
                            <div className="flex items-center justify-between text-sm mb-3 pb-3 border-b border-gray-100">
                                <span className="text-gray-500 flex items-center">
                                    <Calendar size={16} className="mr-2" />
                                    {quote.date ? new Date(quote.date).toLocaleDateString() : t('quote.notAvailable')}
                                </span>
                                <span className="font-bold text-[#065F46] text-lg">{formatCurrency(quote.totalAmount, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                            </div>

                            {/* Items Section - Always Visible */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-gray-700 mb-1">{t('quote.items')}</h4>
                                {quote.devisItems && quote.devisItems.length > 0 ? (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {quote.devisItems.map((item, idx) => (
                                            <div key={item.id || idx} className="bg-gray-50 p-2.5 rounded-lg text-sm">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-medium text-gray-800 flex-1">{item.description}</span>
                                                    <span className="text-[#065F46] font-semibold ml-2">
                                                        {formatCurrency((item.quantity || 0) * (item.price || 0), quote.currencySymbol || DEFAULT_CURRENCY)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                    <span>{t('quote.qtyLabel', { value: item.quantity || 0 })}</span>
                                                    <span>{t('quote.unitPriceLabel', { value: formatCurrency(item.price, quote.currencySymbol || DEFAULT_CURRENCY) })}</span>
                                                    {item.tva && <span className="text-orange-500">{t('quote.taxRateLabel', { rate: ((item.vatRate ?? 0.19) * 100).toFixed(0) })}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">{t('quote.noItemsInQuote')}</p>
                                )}

                                {/* Totals */}
                                {quote.devisItems && quote.devisItems.length > 0 && (
                                    <div className="pt-2 mt-2 border-t border-gray-200 space-y-1">
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>{t('invoice.subtotal')}:</span>
                                            <span>{formatCurrency(quote.subTotal, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>{t('invoice.tax')}:</span>
                                            <span>{formatCurrency(quote.taxAmount, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                        </div>
                                        {quote.tfiscal != null && quote.tfiscal > 0 && (
                                            <div className="flex justify-between text-sm text-gray-600">
                                                <span>{quote.tfiscalName || t('invoice.timbre')}:</span>
                                                <span>{formatCurrency(quote.tfiscal, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm font-bold text-[#065F46]">
                                            <span>{t('invoice.total')}:</span>
                                            <span>{formatCurrency(quote.totalAmount, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredQuotes.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-[#065F46]/5 rounded-2xl border border-dashed border-[#065F46]/20">
                            <FileText size={48} className="mx-auto text-[#065F46]/30 mb-4" />
                            <p className="text-gray-500 font-medium">{t('quote.noData')}</p>
                            <p className="text-sm text-gray-400 mt-1">{t('quote.createFirst')}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, FileText, Calendar, Download, Trash2, Filter, Archive, Eye, Edit, X, User, MapPin, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/formatNumber';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { useQuotes, useDeleteQuote } from '../hooks/useQuotes';

interface QuoteItem {
    id: number;
    description: string;
    quantity: number;
    price: number;
    tva: boolean;
    vatRate?: number;
    totalItemHT?: number;
    itemTaxAmount?: number;
}

interface QuoteData {
    id: number;
    number: string;
    date: string;
    totalAmount: number;
    subTotal: number;
    taxAmount: number;
    clientName: string;
    clientId: number;
    clientAddress?: string;
    clientTaxId?: string;
    clientPhone?: string;
    clientEmail?: string;
    clientMatriculeFiscal?: string;
    status: string;
    treated: boolean;
    createdBy?: string;
    modifiedBy?: string;
    quoteItems?: QuoteItem[];
    currency?: string;
    currencySymbol?: string;
    tfiscal?: number;
    tfiscalName?: string;
    invoiceId?: number;
}

const getQuoteNumber = (quote: QuoteData & { Number?: string }) => quote.number || quote.Number || '';

export default function QuotesPage() {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [detailQuote, setDetailQuote] = useState<QuoteData | null>(null);
    const navigate = useNavigate();
    const { isManager } = useAuth();

    // React Query
    const { data: rawQuotes, isLoading: loading } = useQuotes();
    const quotes = ((rawQuotes ?? []) as QuoteData[]).filter(q => q.status !== 'Rejected');
    const deleteQuoteMutation = useDeleteQuote();

    const handleDownloadPdf = async (id: number, number: string | number) => {
        try {
            const res = await api.get(`/Quotes/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Quote_${number}.pdf`);
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
            await deleteQuoteMutation.mutateAsync(id);
        } catch (error) {
            logger.error(t('quote.messages.deleteErrorLog'), error);
            notify('error', t('quote.deleteError'));
        }
    };

    const handleViewPdf = async (id: number) => {
        try {
            const res = await api.get(`/Quotes/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            window.open(url, '_blank');
        } catch (error) {
            logger.error('Error viewing quote PDF', error);
            notify('error', t('common.viewFailed'));
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredQuotes.map((quote) => (
                        <div key={quote.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                            {/* Header: Client + Quote# + Status */}
                            <div className="flex items-start justify-between mb-2">
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-bold text-gray-900 truncate">{quote.clientName || t('common.unknown')}</h3>
                                    <span className="text-xs text-gray-500">#{getQuoteNumber(quote)}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <button
                                        onClick={() => setDetailQuote(quote)}
                                        className="p-1.5 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded-lg transition-colors"
                                        title={t('common.viewDetails')}
                                    >
                                        <Eye size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDownloadPdf(quote.id, getQuoteNumber(quote))}
                                        className="p-1.5 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded-lg transition-colors"
                                        title={t('quote.downloadPdf')}
                                    >
                                        <Download size={16} />
                                    </button>
                                    {/* Edit - only if Draft */}
                                    {quote.status === 'Draft' && !quote.treated && (
                                        <button
                                            onClick={() => navigate(`/quotes/edit/${quote.id}`)}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title={t('common.edit')}
                                        >
                                            <Edit size={16} />
                                        </button>
                                    )}
                                    {/* Delete allowed for Draft and Active quotes (not Completed or Accepted) */}
                                    {(quote.status === 'Draft' || quote.status === 'Active') && (
                                        <button
                                            onClick={() => handleDeleteQuote(quote.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title={t('quote.deleteQuote')}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusColor(quote.status)}`}>
                                        {quote.status ? t(`quote.status.${quote.status}`, quote.status) : t('invoice.draft')}
                                    </span>
                                </div>
                            </div>
                            {(quote.invoiceId != null || quote.status === 'Completed') && (
                                <p className="mb-3 text-xs text-amber-700">{t('document.lockedInvoiceGenerated', 'Document is locked: Invoice already generated.')}</p>
                            )}

                            {/* Date */}
                            <div className="flex items-center text-xs text-gray-400 mb-2">
                                <Calendar size={12} className="mr-1" />
                                {quote.date ? new Date(quote.date).toLocaleDateString() : t('quote.notAvailable')}
                            </div>

                            {/* Items metadata: Qty / Unit Price / Tax */}
                            {quote.quoteItems && quote.quoteItems.length > 0 ? (
                                <div className="space-y-1 mb-2 flex-1">
                                    {quote.quoteItems.slice(0, 3).map((item, idx) => (
                                        <div key={item.id || idx} className="bg-gray-50 px-2 py-1.5 rounded text-xs">
                                            <p className="font-medium text-gray-800 truncate">{item.description}</p>
                                            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                                                <span>{t('quote.qtyLabel', { value: item.quantity || 0 })}</span>
                                                <span>{formatCurrency(item.price, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                                {item.tva && <span className="text-orange-500">{((item.vatRate ?? 0.19) * 100).toFixed(0)}%</span>}
                                            </div>
                                        </div>
                                    ))}
                                    {quote.quoteItems.length > 3 && (
                                        <p className="text-[10px] text-gray-400 text-center">+{quote.quoteItems.length - 3} {t('quote.items').toLowerCase()}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic mb-2 flex-1">{t('quote.noItemsInQuote')}</p>
                            )}

                            {/* Totals */}
                            <div className="pt-2 border-t border-gray-100 space-y-0.5 text-xs">
                                <div className="flex justify-between text-gray-500">
                                    <span>{t('invoice.subtotal')}</span>
                                    <span>{formatCurrency(quote.subTotal, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                </div>
                                <div className="flex justify-between text-gray-500">
                                    <span>{t('invoice.tax')}</span>
                                    <span>{formatCurrency(quote.taxAmount, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                </div>
                                {quote.tfiscal != null && quote.tfiscal > 0 && (
                                    <div className="flex justify-between text-gray-500">
                                        <span>{quote.tfiscalName || t('invoice.timbre')}</span>
                                        <span>{formatCurrency(quote.tfiscal, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-[#065F46]">
                                    <span>{t('invoice.total')}</span>
                                    <span>{formatCurrency(quote.totalAmount, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                </div>
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

            {/* Detail Modal */}
            {detailQuote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetailQuote(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b bg-[#065F46]/5">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-lg font-bold text-gray-900">{t('quote.title')} #{getQuoteNumber(detailQuote)}</h3>
                                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusColor(detailQuote.status)}`}>
                                        {detailQuote.status ? t(`quote.status.${detailQuote.status}`, detailQuote.status) : t('invoice.draft')}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                    <Calendar size={12} />
                                    {detailQuote.date ? new Date(detailQuote.date).toLocaleDateString() : t('quote.notAvailable')}
                                </p>
                            </div>
                            <button onClick={() => setDetailQuote(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-4 max-h-[65vh] overflow-y-auto space-y-5">

                            {/* Client Information */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                    <User size={14} />
                                    {detailQuote.clientName || t('common.unknown')}
                                </h4>
                                {detailQuote.clientAddress && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                        <MapPin size={12} />
                                        {detailQuote.clientAddress}
                                    </p>
                                )}
                                {detailQuote.clientMatriculeFiscal && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                        <Hash size={12} />
                                        {t('detail.taxId', 'Tax ID')}: {detailQuote.clientMatriculeFiscal}
                                    </p>
                                )}
                            </div>

                            {/* Audit Trail */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                                {detailQuote.createdBy && (
                                    <span className="flex items-center gap-1">
                                        <User size={12} />
                                        {t('common.createdBy')}{detailQuote.createdBy}
                                    </span>
                                )}
                                {detailQuote.modifiedBy && (
                                    <span className="flex items-center gap-1">
                                        <Edit size={12} />
                                        {t('common.updatedBy')}{detailQuote.modifiedBy}
                                    </span>
                                )}
                            </div>

                            {/* Items Table */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('invoice.items')} ({detailQuote.quoteItems?.length || 0})</h4>
                                {detailQuote.quoteItems && detailQuote.quoteItems.length > 0 ? (
                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-gray-50 text-gray-500 border-b">
                                                    <th className="text-left px-3 py-2 font-medium">{t('invoice.description')}</th>
                                                    <th className="text-center px-3 py-2 font-medium">{t('invoice.quantity')}</th>
                                                    <th className="text-right px-3 py-2 font-medium">{t('quote.unitPriceLabel')}</th>
                                                    <th className="text-center px-3 py-2 font-medium">{t('quote.taxRateLabel')}</th>
                                                    <th className="text-right px-3 py-2 font-medium">{t('invoice.total')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {detailQuote.quoteItems.map((item, idx) => (
                                                    <tr key={item.id || idx} className="hover:bg-gray-50/50">
                                                        <td className="px-3 py-2 text-gray-800 font-medium max-w-[200px] truncate">{item.description}</td>
                                                        <td className="px-3 py-2 text-center text-gray-600">{item.quantity || 0}</td>
                                                        <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(item.price, detailQuote.currencySymbol || DEFAULT_CURRENCY)}</td>
                                                        <td className="px-3 py-2 text-center text-gray-600">{item.tva ? `${((item.vatRate ?? 0.19) * 100).toFixed(0)}%` : '0%'}</td>
                                                        <td className="px-3 py-2 text-right font-medium text-gray-800">{formatCurrency(item.totalItemHT ?? 0, detailQuote.currencySymbol || DEFAULT_CURRENCY)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">{t('quote.noItemsInQuote')}</p>
                                )}
                            </div>

                            {/* Summary Footer */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>{t('invoice.subtotal')}</span>
                                    <span>{formatCurrency(detailQuote.subTotal, detailQuote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>{t('invoice.tax')}</span>
                                    <span>{formatCurrency(detailQuote.taxAmount, detailQuote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                </div>
                                {detailQuote.tfiscal != null && detailQuote.tfiscal > 0 && (
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>{detailQuote.tfiscalName || t('invoice.timbre')}</span>
                                        <span>{formatCurrency(detailQuote.tfiscal, detailQuote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-base font-bold text-[#065F46] pt-1 border-t border-gray-200">
                                    <span>{t('invoice.total')}</span>
                                    <span>{formatCurrency(detailQuote.totalAmount, detailQuote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center gap-2 px-6 py-4 border-t bg-gray-50">
                            <button
                                onClick={() => handleViewPdf(detailQuote.id)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#065F46] text-white rounded-xl hover:bg-[#047857] transition-colors text-sm font-medium"
                            >
                                <Eye size={16} />
                                {t('invoice.viewPdf')}
                            </button>
                            <button
                                onClick={() => handleDownloadPdf(detailQuote.id, getQuoteNumber(detailQuote))}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
                            >
                                <Download size={16} />
                            </button>
                            {detailQuote.status === 'Draft' && !detailQuote.treated && (
                                <button
                                    onClick={() => { setDetailQuote(null); navigate(`/quotes/edit/${detailQuote.id}`); }}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium"
                                >
                                    <Edit size={16} />
                                    {t('common.edit')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
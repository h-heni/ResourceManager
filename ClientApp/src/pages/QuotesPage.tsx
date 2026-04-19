import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, FileText, Calendar, Download, Trash2, Eye, Edit, X, User, MapPin, Hash, Mail, MessageSquare, Check, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/formatNumber';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { useQuotes, useDeleteQuote } from '../hooks/useQuotes';
import WhatsAppShareModal from '../components/WhatsAppShareModal';
import SendEmailModal from '../components/SendEmailModal';
import SendHistoryPanel from '../components/SendHistoryPanel';

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
    const [showWhatsApp, setShowWhatsApp] = useState(false);
    const [showEmail, setShowEmail] = useState(false);
    const [historyRefresh, setHistoryRefresh] = useState(0);
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
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

    const toggleRow = (id: number) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    };

    const handleTabChange = (mode: 'active' | 'archived') => {
        setViewMode(mode);
        setSelectedRows([]);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col gap-6">
            <NotifyBanner />

            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('quote.title')}</h1>
                    <p className="text-sm text-slate-500 mt-1">{t('quote.pageDescription')}</p>
                </div>
            </div>

            {/* ── Main Container ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col p-6">

                {/* Tabs */}
                <div className="flex gap-6 border-b border-slate-200 mb-6">
                    <button
                        onClick={() => handleTabChange('active')}
                        className={`pb-3 text-sm font-semibold transition-colors relative ${
                            viewMode === 'active' ? 'text-purple-600' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        {t('quote.active')} ({activeCount})
                        {viewMode === 'active' && (
                            <motion.div layoutId="quoteTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
                        )}
                    </button>
                    {isManager && (
                        <button
                            onClick={() => handleTabChange('archived')}
                            className={`pb-3 text-sm font-semibold transition-colors relative ${
                                viewMode === 'archived' ? 'text-purple-600' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {t('quote.archived')} ({archivedCount})
                            {viewMode === 'archived' && (
                                <motion.div layoutId="quoteTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
                            )}
                        </button>
                    )}
                </div>

                {/* Action Bar / Search */}
                <div className="flex items-center justify-between mb-6 h-12">
                    <div className="flex-1 flex items-center gap-4">
                        {selectedRows.length > 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="flex items-center gap-1 p-1 bg-white rounded-full border border-slate-200 shadow-sm"
                            >
                                <div className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 rounded-full flex items-center gap-2 border border-purple-100/50">
                                    <span className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] shadow-inner">{selectedRows.length}</span>
                                    {t('common.selected', 'Selected')}
                                </div>
                                {selectedRows.length === 1 && (() => {
                                    const q = filteredQuotes.find(q => q.id === selectedRows[0]);
                                    return q && q.status === 'Draft' && !q.treated ? (
                                        <button
                                            onClick={() => navigate(`/quotes/edit/${q.id}`)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors"
                                        >
                                            <Pencil size={14} className="text-purple-500" /> {t('common.edit')}
                                        </button>
                                    ) : null;
                                })()}
                                {selectedRows.length === 1 && (
                                    <button
                                        onClick={() => {
                                            const q = filteredQuotes.find(q => q.id === selectedRows[0]);
                                            if (q) { setDetailQuote(q); }
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors"
                                    >
                                        <Eye size={14} className="text-purple-500" /> {t('common.viewDetails')}
                                    </button>
                                )}
                                <div className="w-px h-4 bg-slate-200 mx-1" />
                                <button
                                    onClick={() => { selectedRows.forEach(id => handleDeleteQuote(id)); setSelectedRows([]); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-full text-xs font-medium transition-colors"
                                >
                                    <Trash2 size={14} className="text-red-500" /> {t('common.delete')}
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative max-w-sm w-full">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder={t('quote.searchPlaceholder')}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200/60 hover:border-purple-300 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 rounded-full text-sm font-medium outline-none transition-all placeholder:text-slate-400 text-slate-900 shadow-sm"
                                />
                            </motion.div>
                        )}
                    </div>
                    {!selectedRows.length && viewMode === 'active' && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            onClick={() => navigate('/quotes/create')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                            <Plus size={16} /> {t('quote.create')}
                        </motion.button>
                    )}
                </div>

                {/* ── Cards Grid ── */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400">{t('quote.loading')}</div>
                ) : filteredQuotes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        <AnimatePresence mode="popLayout">
                            {filteredQuotes.map((quote) => {
                                const isSelected = selectedRows.includes(quote.id);
                                return (
                                    <motion.div
                                        key={quote.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        onClick={() => toggleRow(quote.id)}
                                        className={`group relative flex flex-col bg-white border rounded-xl p-5 transition-all duration-200 cursor-pointer overflow-hidden ${
                                            isSelected
                                                ? 'border-purple-500 shadow-md ring-1 ring-purple-500'
                                                : 'border-slate-200 hover:border-purple-300 shadow-sm hover:shadow'
                                        }`}
                                    >
                                        {/* Card Header */}
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">#{getQuoteNumber(quote)}</span>
                                                <span className="text-base font-bold text-slate-800 mt-1">{quote.clientName || t('common.unknown')}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                                                    quote.status === 'Accepted' || quote.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                    quote.status === 'Active' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                    quote.status === 'Rejected' ? 'bg-red-50 text-red-600 border-red-200' :
                                                    'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                    {quote.status ? t(`quote.status.${quote.status}`, quote.status) : t('invoice.draft')}
                                                </span>
                                                <div
                                                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                                        isSelected
                                                            ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                                                            : 'border-slate-300 bg-white text-transparent group-hover:border-purple-400'
                                                    }`}
                                                >
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                            </div>
                                        </div>

                                        {(quote.invoiceId != null || quote.status === 'Completed') && (
                                            <p className="mb-3 text-xs text-amber-700">{t('document.lockedInvoiceGenerated', 'Document is locked: Invoice already generated.')}</p>
                                        )}

                                        {/* Items preview */}
                                        {quote.quoteItems && quote.quoteItems.length > 0 ? (
                                            <div className="space-y-1 mb-2 flex-1">
                                                {quote.quoteItems.slice(0, 2).map((item, idx) => (
                                                    <div key={item.id || idx} className="bg-slate-50 px-2 py-1.5 rounded text-xs">
                                                        <p className="font-medium text-slate-800 truncate">{item.description}</p>
                                                        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                                                            <span>{t('quote.qtyLabel', { value: item.quantity || 0 })}</span>
                                                            <span>{formatCurrency(item.price, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {quote.quoteItems.length > 2 && (
                                                    <p className="text-[10px] text-slate-400 text-center">+{quote.quoteItems.length - 2} {t('quote.items').toLowerCase()}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic mb-2 flex-1">{t('quote.noItemsInQuote')}</p>
                                        )}

                                        {/* Card Footer */}
                                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-end justify-between">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                    <Calendar size={12} /> {t('invoice.date')}
                                                </span>
                                                <span className="text-sm font-semibold text-slate-600">
                                                    {quote.date ? new Date(quote.date).toLocaleDateString() : '-'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('invoice.total')}</span>
                                                <span className="text-xl font-bold text-slate-900 tracking-tight">
                                                    {formatCurrency(quote.totalAmount, quote.currencySymbol || DEFAULT_CURRENCY)}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-center mb-3">
                            <FileText className="text-slate-400" size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">{t('quote.noData')}</h3>
                        <p className="text-xs text-slate-500 mt-1">{t('quote.createFirst')}</p>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {detailQuote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetailQuote(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b bg-purple-600/5">
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
                                <div className="flex justify-between text-base font-bold text-purple-600 pt-1 border-t border-gray-200">
                                    <span>{t('invoice.total')}</span>
                                    <span>{formatCurrency(detailQuote.totalAmount, detailQuote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                </div>
                            </div>

                        </div>

                        {/* Send History */}
                        <div className="px-6 py-3 border-t">
                            <SendHistoryPanel
                                apiEndpoint={`/Quotes/${detailQuote.id}/send-history`}
                                refreshKey={historyRefresh}
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center gap-2 px-6 py-4 border-t bg-gray-50 flex-wrap">
                            <button
                                onClick={() => handleViewPdf(detailQuote.id)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors text-sm font-medium"
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
                            <button
                                onClick={() => setShowEmail(true)}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0D9488] text-white rounded-xl hover:bg-[#0F766E] transition-colors text-sm font-medium"
                            >
                                <Mail size={16} />
                                {t('email.send')}
                            </button>
                            <button
                                onClick={() => setShowWhatsApp(true)}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-xl hover:bg-[#128C7E] transition-colors text-sm font-medium"
                            >
                                <MessageSquare size={16} />
                                WhatsApp
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

            {/* WhatsApp Modal */}
            {detailQuote && (
                <WhatsAppShareModal
                    isOpen={showWhatsApp}
                    onClose={() => { setShowWhatsApp(false); setHistoryRefresh(n => n + 1); }}
                    documentId={detailQuote.id}
                    documentNumber={getQuoteNumber(detailQuote)}
                    contactPhone={detailQuote.clientPhone || ''}
                    contactName={detailQuote.clientName}
                    apiEndpoint={`/Quotes/${detailQuote.id}/send-whatsapp`}
                />
            )}

            {/* Email Modal */}
            {detailQuote && (
                <SendEmailModal
                    isOpen={showEmail}
                    onClose={() => { setShowEmail(false); setHistoryRefresh(n => n + 1); }}
                    apiEndpoint={`/Quotes/${detailQuote.id}/send-email`}
                    documentNumber={getQuoteNumber(detailQuote)}
                    contactName={detailQuote.clientName}
                    contactEmail={detailQuote.clientEmail || ''}
                    defaultSubject={`${t('quote.title')} #${getQuoteNumber(detailQuote)} - ${detailQuote.clientName}`}
                    defaultBody={`${t('email.greeting')} ${detailQuote.clientName},\n\n${t('documentSend.quoteAttached')} #${getQuoteNumber(detailQuote)}.\n\n${t('email.regards')}`}
                    onSuccess={() => setHistoryRefresh(n => n + 1)}
                />
            )}
        </motion.div>
    );
}
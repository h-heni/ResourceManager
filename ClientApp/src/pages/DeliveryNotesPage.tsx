import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Trash2, Download, Eye, FileText, Package, Calendar, Edit, User, X, MapPin, Hash, Mail, MessageSquare, Check, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { useAuth } from '../context/AuthContext';
import { useDeliveryNotes, useDeleteDeliveryNote } from '../hooks/useDeliveryNotes';
import WhatsAppShareModal from '../components/WhatsAppShareModal';
import SendEmailModal from '../components/SendEmailModal';
import SendHistoryPanel from '../components/SendHistoryPanel';

interface DeliveryNoteItemData {
    description: string;
    quantity: number;
}

interface DeliveryNote {
    id: number;
    number: string;
    date: string;
    clientName: string;
    clientAddress?: string;
    clientTaxId?: string;
    clientPhone?: string;
    clientEmail?: string;
    quoteId?: number;
    quoteNumber?: string;
    invoiceId?: number;
    invoiceNumber?: string;
    treated?: boolean;
    deliveryNoteItems?: DeliveryNoteItemData[];
    itemsCount?: number;
    createdBy?: string;
    modifiedBy?: string;
}

export default function DeliveryNotesPage() {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [detailNote, setDetailNote] = useState<DeliveryNote | null>(null);
    const [showWhatsApp, setShowWhatsApp] = useState(false);
    const [showEmail, setShowEmail] = useState(false);
    const [historyRefresh, setHistoryRefresh] = useState(0);
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const navigate = useNavigate();
    const { user } = useAuth();

    const isManager = user?.roles?.includes('Manager') || user?.roles?.includes('SuperAdmin') || user?.roles?.includes('FreeUser');

    // React Query
    const { data: rawNotes, isLoading: loading } = useDeliveryNotes();
    const notes = (rawNotes ?? []) as DeliveryNote[];
    const deleteNoteMutation = useDeleteDeliveryNote();

    const openDetail = async (note: DeliveryNote) => {
        try {
            const res = await api.get(`/DeliveryNotes/${note.id}`);
            const detail = res.data;
            setDetailNote({
                ...note,
                clientAddress: detail.clientAddress,
                clientTaxId: detail.clientTaxId,
                clientPhone: detail.clientPhone,
                createdBy: detail.createdBy || (detail.createdByUser ? `${detail.createdByUser.firstName} ${detail.createdByUser.lastName}`.trim() : note.createdBy),
                modifiedBy: detail.modifiedBy,
                quoteNumber: detail.quoteNumber || note.quoteNumber,
                deliveryNoteItems: detail.deliveryNoteItems || note.deliveryNoteItems,
            });
        } catch {
            // Fallback to list data if detail fetch fails
            setDetailNote(note);
        }
    };

    const handleDelete = async (id: number) => {
        if (!isManager) {
            notify('warning', t('common.managerOnly'));
            return;
        }
        if (!confirm(t('deliveryNote.confirmDelete'))) return;
        try {
            await deleteNoteMutation.mutateAsync(id);
        } catch (error: unknown) {
            logger.error("Error deleting delivery note", error);
            notify('error', getErrorMessage(error, t('deliveryNote.deleteFailed')));
        }
    };

    const handleDownloadPdf = async (id: number, number: string) => {
        try {
            const res = await api.get(`/DeliveryNotes/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `BL_${number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            logger.error("Error downloading PDF", error);
            notify('error', t('common.downloadFailed'));
        }
    };

    const handleViewPdf = async (id: number) => {
        try {
            const res = await api.get(`/DeliveryNotes/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            window.open(url, '_blank');
        } catch (error) {
            logger.error("Error viewing PDF", error);
            notify('error', t('common.viewFailed'));
        }
    };

    const getItemsCount = (note: DeliveryNote) => {
        if (note.deliveryNoteItems) return note.deliveryNoteItems.length;
        if (note.itemsCount !== undefined) return note.itemsCount;
        return 0;
    };

    const filteredNotes = (notes || []).filter(n => {
        const searchMatch =
            n.number?.toLowerCase().includes(search.toLowerCase()) ||
            n.clientName?.toLowerCase().includes(search.toLowerCase());
        const isArchived = n.treated === true || n.invoiceId != null;
        if (viewMode === 'active') return searchMatch && !isArchived;
        return searchMatch && isArchived;
    });

    const activeCount = (notes || []).filter(n => !n.treated && n.invoiceId == null).length;
    const archivedCount = (notes || []).filter(n => n.treated === true || n.invoiceId != null).length;

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
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('nav.deliveryNotes')}</h1>
                    <p className="text-sm text-slate-500 mt-1">{t('deliveryNote.pageDescription')}</p>
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
                        {t('quote.active', 'Active')} ({activeCount})
                        {viewMode === 'active' && (
                            <motion.div layoutId="dnTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
                        )}
                    </button>
                    {isManager && (
                        <button
                            onClick={() => handleTabChange('archived')}
                            className={`pb-3 text-sm font-semibold transition-colors relative ${
                                viewMode === 'archived' ? 'text-purple-600' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {t('quote.archived', 'Archived')} ({archivedCount})
                            {viewMode === 'archived' && (
                                <motion.div layoutId="dnTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
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
                                    const n = filteredNotes.find(n => n.id === selectedRows[0]);
                                    return n && !n.treated ? (
                                        <button
                                            onClick={() => navigate(`/delivery-notes/edit/${n.id}`)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors"
                                        >
                                            <Pencil size={14} className="text-purple-500" /> {t('common.edit')}
                                        </button>
                                    ) : null;
                                })()}
                                {selectedRows.length === 1 && (
                                    <button
                                        onClick={() => {
                                            const n = filteredNotes.find(n => n.id === selectedRows[0]);
                                            if (n) openDetail(n);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors"
                                    >
                                        <Eye size={14} className="text-purple-500" /> {t('common.viewDetails')}
                                    </button>
                                )}
                                <div className="w-px h-4 bg-slate-200 mx-1" />
                                <button
                                    onClick={() => { selectedRows.forEach(id => handleDelete(id)); setSelectedRows([]); }}
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
                                    placeholder={t('deliveryNote.searchPlaceholder')}
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
                            onClick={() => navigate('/delivery-notes/create')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                            <Plus size={16} /> {t('deliveryNote.create')}
                        </motion.button>
                    )}
                </div>

                {/* ── Cards Grid ── */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400">{t('common.loading')}</div>
                ) : filteredNotes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        <AnimatePresence mode="popLayout">
                            {filteredNotes.map((note) => {
                                const isSelected = selectedRows.includes(note.id);
                                return (
                                    <motion.div
                                        key={note.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        onClick={() => toggleRow(note.id)}
                                        className={`group relative flex flex-col bg-white border rounded-xl p-5 transition-all duration-200 cursor-pointer overflow-hidden ${
                                            isSelected
                                                ? 'border-purple-500 shadow-md ring-1 ring-purple-500'
                                                : 'border-slate-200 hover:border-purple-300 shadow-sm hover:shadow'
                                        }`}
                                    >
                                        {/* Card Header */}
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">#{note.number}</span>
                                                <span className="text-base font-bold text-slate-800 mt-1">{note.clientName || t('common.unknown')}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {/* Linked doc badge */}
                                                {note.invoiceId ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-purple-50 text-purple-600 border-purple-200">
                                                        {t('invoice.title')}
                                                    </span>
                                                ) : note.quoteId ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-blue-50 text-blue-600 border-blue-200">
                                                        {t('quote.title')}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-slate-100 text-slate-600 border-slate-200">
                                                        {t('invoice.draft', 'Draft')}
                                                    </span>
                                                )}
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

                                        {/* Items preview */}
                                        {note.deliveryNoteItems && note.deliveryNoteItems.length > 0 ? (
                                            <div className="space-y-1 mb-2 flex-1">
                                                {note.deliveryNoteItems.slice(0, 2).map((item, idx) => (
                                                    <div key={idx} className="bg-slate-50 px-2 py-1.5 rounded text-xs">
                                                        <p className="font-medium text-slate-800 truncate">{item.description}</p>
                                                        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                                                            <span className="flex items-center gap-1">
                                                                <Package size={10} />
                                                                {t('quote.qtyLabel', { value: item.quantity || 0 })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {note.deliveryNoteItems.length > 2 && (
                                                    <p className="text-[10px] text-slate-400 text-center">+{note.deliveryNoteItems.length - 2} {t('deliveryNote.items').toLowerCase()}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 mb-2 flex-1">
                                                <Package size={14} className="text-slate-400" />
                                                <span className="px-2 py-1 bg-slate-50 text-slate-700 text-xs font-semibold rounded-full">
                                                    {getItemsCount(note)} {t('deliveryNote.items')}
                                                </span>
                                            </div>
                                        )}

                                        {/* Card Footer */}
                                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-end justify-between">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                    <Calendar size={12} /> {t('invoice.date')}
                                                </span>
                                                <span className="text-sm font-semibold text-slate-600">
                                                    {note.date ? new Date(note.date).toLocaleDateString() : '-'}
                                                </span>
                                            </div>
                                            {note.createdBy && (
                                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                    <User size={10} /> {note.createdBy}
                                                </span>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-center mb-3">
                            <Package className="text-slate-400" size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">{t('deliveryNote.noData')}</h3>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {detailNote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetailNote(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b bg-purple-600/5">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-lg font-bold text-gray-900">{t('nav.deliveryNotes')} #{detailNote.number}</h3>
                                    {detailNote.treated && (
                                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-700">{t('quote.archived', 'Archived')}</span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                    <Calendar size={12} />
                                    {detailNote.date ? new Date(detailNote.date).toLocaleDateString() : t('quote.notAvailable', 'N/A')}
                                </p>
                            </div>
                            <button onClick={() => setDetailNote(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-4 max-h-[65vh] overflow-y-auto space-y-5">

                            {/* Client Information */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                    <User size={14} />
                                    {detailNote.clientName || t('common.unknown')}
                                </h4>
                                {detailNote.clientAddress && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                        <MapPin size={12} />
                                        {detailNote.clientAddress}
                                    </p>
                                )}
                                {detailNote.clientTaxId && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                        <Hash size={12} />
                                        {t('detail.taxId', 'Tax ID')}: {detailNote.clientTaxId}
                                    </p>
                                )}
                            </div>

                            {/* Linked Document */}
                            <div className="flex flex-wrap gap-2">
                                {detailNote.invoiceId ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600/10 text-purple-600 text-xs font-semibold rounded-full">
                                        <FileText size={12} />
                                        {t('invoice.title')} #{detailNote.invoiceNumber}
                                    </span>
                                ) : null}
                                {detailNote.quoteId ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                        <FileText size={12} />
                                        {t('quote.title')} #{detailNote.quoteNumber}
                                    </span>
                                ) : null}
                            </div>

                            {/* Audit Trail */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                                {detailNote.createdBy && (
                                    <span className="flex items-center gap-1">
                                        <User size={12} />
                                        {t('common.createdBy')}{detailNote.createdBy}
                                    </span>
                                )}
                                {detailNote.modifiedBy && (
                                    <span className="flex items-center gap-1">
                                        <Edit size={12} />
                                        {t('common.updatedBy')}{detailNote.modifiedBy}
                                    </span>
                                )}
                            </div>

                            {/* Items Table */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                    <Package size={14} />
                                    {t('deliveryNote.items')} ({detailNote.deliveryNoteItems?.length || detailNote.itemsCount || 0})
                                </h4>
                                {detailNote.deliveryNoteItems && detailNote.deliveryNoteItems.length > 0 ? (
                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-gray-50 text-gray-500 border-b">
                                                    <th className="text-left px-3 py-2 font-medium">{t('invoice.description')}</th>
                                                    <th className="text-center px-3 py-2 font-medium">{t('invoice.quantity')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {detailNote.deliveryNoteItems.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50">
                                                        <td className="px-3 py-2 text-gray-800 font-medium">{item.description}</td>
                                                        <td className="px-3 py-2 text-center text-gray-600">{item.quantity || 0}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">{t('quote.noItemsInQuote', 'No items')}</p>
                                )}
                            </div>

                        </div>

                        {/* Send History */}
                        <div className="px-6 py-3 border-t">
                            <SendHistoryPanel
                                apiEndpoint={`/DeliveryNotes/${detailNote.id}/send-history`}
                                refreshKey={historyRefresh}
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center gap-2 px-6 py-4 border-t bg-gray-50 flex-wrap">
                            <button
                                onClick={() => { handleViewPdf(detailNote.id); }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors text-sm font-medium"
                            >
                                <Eye size={16} />
                                {t('invoice.viewPdf', 'View PDF')}
                            </button>
                            <button
                                onClick={() => { handleDownloadPdf(detailNote.id, detailNote.number); }}
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
                            {!detailNote.treated && (
                                <button
                                    onClick={() => { setDetailNote(null); navigate(`/delivery-notes/edit/${detailNote.id}`); }}
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
            {detailNote && (
                <WhatsAppShareModal
                    isOpen={showWhatsApp}
                    onClose={() => { setShowWhatsApp(false); setHistoryRefresh(n => n + 1); }}
                    documentId={detailNote.id}
                    documentNumber={detailNote.number}
                    contactPhone={detailNote.clientPhone || ''}
                    contactName={detailNote.clientName}
                    apiEndpoint={`/DeliveryNotes/${detailNote.id}/send-whatsapp`}
                />
            )}

            {/* Email Modal */}
            {detailNote && (
                <SendEmailModal
                    isOpen={showEmail}
                    onClose={() => { setShowEmail(false); setHistoryRefresh(n => n + 1); }}
                    apiEndpoint={`/DeliveryNotes/${detailNote.id}/send-email`}
                    documentNumber={detailNote.number}
                    contactName={detailNote.clientName}
                    contactEmail={detailNote.clientEmail || ''}
                    defaultSubject={`${t('deliveryNote.title')} #${detailNote.number} - ${detailNote.clientName}`}
                    defaultBody={`${t('email.greeting')} ${detailNote.clientName},\n\n${t('documentSend.deliveryNoteAttached')} #${detailNote.number}.\n\n${t('email.regards')}`}
                    onSuccess={() => setHistoryRefresh(n => n + 1)}
                />
            )}
        </motion.div>
    );
}
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Trash2, Download, Eye, FileText, Package, Calendar, Filter, Archive, Edit, User, X, MapPin, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { useAuth } from '../context/AuthContext';
import { useDeliveryNotes, useDeleteDeliveryNote } from '../hooks/useDeliveryNotes';

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

    return (
        <div className="space-y-6">
            <NotifyBanner />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">📦 {t('nav.deliveryNotes')}</h1>
                    <p className="text-gray-500 mt-1">{t('deliveryNote.pageDescription')}</p>
                </div>
                <button
                    onClick={() => navigate('/delivery-notes/create')}
                    className="flex items-center px-4 py-2 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all transform hover:scale-105"
                >
                    <Plus size={20} className="mr-2" />
                    {t('deliveryNote.create')}
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('deliveryNote.searchPlaceholder')}
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
                            {t('quote.active', 'Active')} ({activeCount})
                        </button>
                        <button
                            onClick={() => setViewMode('archived')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                viewMode === 'archived' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Archive size={16} />
                            {t('quote.archived', 'Archived')} ({archivedCount})
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">{t('common.loading')}</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredNotes.map((note) => (
                        <div key={note.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                            {/* Header: Client Name (bold) + DN Number + Actions */}
                            <div className="flex items-start justify-between mb-2">
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-bold text-gray-900 truncate">{note.clientName || t('common.unknown')}</h3>
                                    <span className="text-xs text-gray-500">#{note.number}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <button
                                        onClick={() => openDetail(note)}
                                        className="p-1.5 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded-lg transition-colors"
                                        title={t('common.viewDetails', 'View Details')}
                                    >
                                        <Eye size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDownloadPdf(note.id, note.number)}
                                        className="p-1.5 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded-lg transition-colors"
                                        title={t('common.download')}
                                    >
                                        <Download size={16} />
                                    </button>
                                    {/* Edit - only if not archived */}
                                    {!note.treated && (
                                        <button
                                            onClick={() => navigate(`/delivery-notes/edit/${note.id}`)}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title={t('common.edit', 'Edit')}
                                        >
                                            <Edit size={16} />
                                        </button>
                                    )}
                                    {/* Delete - Manager only, not archived */}
                                    {isManager && !note.treated && (
                                        <button
                                            onClick={() => handleDelete(note.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title={t('common.delete')}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Linked Document badge */}
                            {note.invoiceId ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 mb-2 bg-[#065F46]/10 text-[#065F46] text-xs font-semibold rounded-full w-fit">
                                    <FileText size={12} />
                                    {t('invoice.title')} #{note.invoiceNumber}
                                </span>
                            ) : note.quoteId ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 mb-2 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full w-fit">
                                    <FileText size={12} />
                                    {t('quote.title')} #{note.quoteNumber}
                                </span>
                            ) : null}

                            {/* Date */}
                            <div className="flex items-center text-xs text-gray-400 mb-2">
                                <Calendar size={12} className="mr-1" />
                                {note.date ? new Date(note.date).toLocaleDateString() : t('quote.notAvailable', 'N/A')}
                            </div>

                            {/* Items metadata: Description + Quantity */}
                            {note.deliveryNoteItems && note.deliveryNoteItems.length > 0 ? (
                                <div className="space-y-1 mb-2 flex-1">
                                    {note.deliveryNoteItems.slice(0, 3).map((item, idx) => (
                                        <div key={idx} className="bg-gray-50 px-2 py-1.5 rounded text-xs">
                                            <p className="font-medium text-gray-800 truncate">{item.description}</p>
                                            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                                                <span className="flex items-center gap-1">
                                                    <Package size={10} />
                                                    {t('quote.qtyLabel', { value: item.quantity || 0 })}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {note.deliveryNoteItems.length > 3 && (
                                        <p className="text-[10px] text-gray-400 text-center">+{note.deliveryNoteItems.length - 3} {t('deliveryNote.items').toLowerCase()}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mb-2 flex-1">
                                    <Package size={14} className="text-gray-400" />
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                                        {getItemsCount(note)} {t('deliveryNote.items')}
                                    </span>
                                </div>
                            )}

                            {/* Footer: Created by */}
                            {note.createdBy && (
                                <div className="pt-2 border-t border-gray-100">
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                        <User size={10} />
                                        {t('common.createdBy', 'Created by')} {note.createdBy}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}

                    {filteredNotes.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-[#065F46]/5 rounded-2xl border border-dashed border-[#065F46]/20">
                            <Package size={48} className="mx-auto text-[#065F46]/30 mb-4" />
                            <p className="text-gray-500 font-medium">{t('deliveryNote.noData')}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            {detailNote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetailNote(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b bg-[#065F46]/5">
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
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#065F46]/10 text-[#065F46] text-xs font-semibold rounded-full">
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

                        {/* Modal Footer */}
                        <div className="flex items-center gap-2 px-6 py-4 border-t bg-gray-50">
                            <button
                                onClick={() => { handleViewPdf(detailNote.id); }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#065F46] text-white rounded-xl hover:bg-[#047857] transition-colors text-sm font-medium"
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
        </div>
    );
}
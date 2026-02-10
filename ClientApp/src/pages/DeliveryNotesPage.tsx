import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Trash2, Download, Eye, FileText, Package, Calendar, Filter, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface DeliveryNoteItem {
    id: number;
    designation: string;
    quantity: number;
}

interface DeliveryNote {
    id: number;
    number: string;
    date: string;
    clientName: string;
    devisId?: number;
    devisNumber?: string;
    invoiceId?: number;
    invoiceNumber?: string;
    treated?: boolean;
    items?: DeliveryNoteItem[];
    itemsCount?: number;
}

export default function DeliveryNotesPage() {
    const { t } = useTranslation();
    const [notes, setNotes] = useState<DeliveryNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const navigate = useNavigate();
    const { user } = useAuth();

    const isManager = user?.roles?.includes('Manager') || user?.roles?.includes('SuperAdmin') || user?.roles?.includes('FreeUser');

    useEffect(() => {
        fetchNotes();
    }, []);

    // Refetch when a payment is confirmed/extended via NotificationBell (cascade changes treated status)
    useEffect(() => {
        const handler = () => fetchNotes();
        window.addEventListener('payment-status-changed', handler);
        return () => window.removeEventListener('payment-status-changed', handler);
    }, []);

    const fetchNotes = async () => {
        try {
            const res = await api.get('/DeliveryNotes');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setNotes(data);
        } catch (error) {
            console.error("Error fetching delivery notes", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!isManager) {
            alert(t('common.managerOnly'));
            return;
        }
        if (!confirm(t('deliveryNote.confirmDelete'))) return;
        try {
            await api.delete(`/DeliveryNotes/${id}`);
            fetchNotes();
        } catch (error: any) {
            console.error("Error deleting delivery note", error);
            alert(error.response?.data?.message || t('deliveryNote.deleteFailed'));
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
            console.error("Error downloading PDF", error);
            alert(t('common.downloadFailed'));
        }
    };

    const handleViewPdf = async (id: number) => {
        try {
            const res = await api.get(`/DeliveryNotes/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            window.open(url, '_blank');
        } catch (error) {
            console.error("Error viewing PDF", error);
            alert(t('common.viewFailed'));
        }
    };

    // Calculate items count
    const getItemsCount = (note: DeliveryNote) => {
        if (note.itemsCount !== undefined) return note.itemsCount;
        if (note.items) return note.items.length;
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
                    <div className="flex p-1 bg-gray-100 rounded-xl">
                        <button
                            onClick={() => setViewMode('active')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                viewMode === 'active' ? 'bg-white shadow-sm text-[#065F46]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Filter size={16} />
                            Active ({activeCount})
                        </button>
                        <button
                            onClick={() => setViewMode('archived')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                viewMode === 'archived' ? 'bg-white shadow-sm text-[#065F46]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Archive size={16} />
                            Archived ({archivedCount})
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">{t('common.loading')}</div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="p-4 font-semibold text-gray-600">{t('deliveryNote.noteNumber')}</th>
                                    <th className="p-4 font-semibold text-gray-600">{t('client.title')}</th>
                                    <th className="p-4 font-semibold text-gray-600">{t('invoice.date')}</th>
                                    <th className="p-4 font-semibold text-gray-600">{t('deliveryNote.items')}</th>
                                    <th className="p-4 font-semibold text-gray-600">{t('deliveryNote.linkedDoc')}</th>
                                    <th className="p-4 font-semibold text-gray-600 text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredNotes.map((note) => (
                                    <tr key={note.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="p-4">
                                            <span className="font-bold text-[#065F46]">📄 {note.number}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-[#065F46]/10 rounded-full flex items-center justify-center text-[#065F46] font-bold text-sm">
                                                    {(note.clientName || 'U')[0].toUpperCase()}
                                                </div>
                                                <span className="text-gray-900">{note.clientName || t('common.unknown')}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Calendar size={14} />
                                                {note.date ? new Date(note.date).toLocaleDateString() : 'N/A'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Package size={14} className="text-gray-400" />
                                                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                                                    {getItemsCount(note)} {t('invoice.items')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {note.invoiceId ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#065F46]/10 text-[#065F46] text-xs font-semibold rounded-full">
                                                    <FileText size={12} />
                                                    {t('invoice.title')} #{note.invoiceNumber}
                                                </span>
                                            ) : note.devisId ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                                    <FileText size={12} />
                                                    {t('quote.title')} #{note.devisNumber}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-sm">—</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end space-x-1">
                                                {/* View PDF */}
                                                <button
                                                    onClick={() => handleViewPdf(note.id)}
                                                    className="p-2 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded-lg transition-colors"
                                                    title={t('invoice.viewPdf')}
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                {/* Download PDF */}
                                                <button
                                                    onClick={() => handleDownloadPdf(note.id, note.number)}
                                                    className="p-2 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded-lg transition-colors"
                                                    title={t('common.download')}
                                                >
                                                    <Download size={18} />
                                                </button>
                                                {/* Delete - Manager only */}
                                                {isManager && (
                                                    <button
                                                        onClick={() => handleDelete(note.id)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title={t('common.delete')}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredNotes.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-gray-500">
                                            📭 {t('deliveryNote.noData')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

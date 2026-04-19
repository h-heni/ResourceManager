import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Search, Trash2, Pencil, Download, Building, FileText, Mail, Phone, MapPin, Check } from 'lucide-react';
import { getErrorMessage } from '../utils/errorUtils';
import SlideOverPanel from '../components/SlideOverPanel';
import Pagination from '../components/Pagination';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { useTranslation } from 'react-i18next';
import { useClients, useSaveClient, useDeleteClient } from '../hooks/useClients';

interface Client {
    id: number;
    name: string;
    address: string;
    taxId: string;
    phone: string;
    email: string;
}

export default function ClientsPage() {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(20);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        taxId: '',
        phone: '',
        email: ''
    });
    const [saving, setSaving] = useState(false);
    const [selectedRows, setSelectedRows] = useState<number[]>([]);

    // React Query
    const { data: clientsData, isLoading: loading } = useClients(page, size);
    const clients = (clientsData?.data ?? []) as Client[];
    const totalCount = clientsData?.totalCount ?? 0;
    const totalPages = clientsData?.totalPages ?? 0;
    const saveClientMutation = useSaveClient();
    const deleteClientMutation = useDeleteClient();

    const handleOpenModal = (client?: Client) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                name: client.name,
                address: client.address,
                taxId: client.taxId,
                phone: client.phone,
                email: client.email || ''
            });
        } else {
            setEditingClient(null);
            setFormData({ name: '', address: '', taxId: '', phone: '', email: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            await saveClientMutation.mutateAsync({
                id: editingClient?.id,
                data: { ...formData, companyName: formData.name },
            });
            setIsModalOpen(false);
        } catch (error: unknown) {
            logger.error("Error saving client", error);
            const msg = getErrorMessage(error, t('client.messages.saveFailed'));
            notify('error', msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('client.messages.confirmDelete'))) return;
        try {
            await deleteClientMutation.mutateAsync(id);
        } catch (error) {
            logger.error("Error deleting client", error);
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.taxId.toLowerCase().includes(search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
    );

    const toggleRow = (id: number) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (selectedRows.length === filteredClients.length && filteredClients.length > 0) {
            setSelectedRows([]);
        } else {
            setSelectedRows(filteredClients.map(c => c.id));
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col gap-6">
            <NotifyBanner />

            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t('client.title')}</h2>
                    <p className="text-sm text-slate-500 mt-1">{t('client.messages.manage')}</p>
                </div>
            </div>

            {/* ── Table Container ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col p-6">

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
                                {selectedRows.length === 1 && (
                                    <button
                                        onClick={() => handleOpenModal(filteredClients.find(c => c.id === selectedRows[0]))}
                                        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors"
                                    >
                                        <Pencil size={14} className="text-purple-500" /> {t('common.edit')}
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
                                    placeholder={t('client.messages.searchPlaceholder')}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200/60 hover:border-purple-300 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 rounded-full text-sm font-medium outline-none transition-all placeholder:text-slate-400 text-slate-900 shadow-sm"
                                />
                            </motion.div>
                        )}
                    </div>
                    {!selectedRows.length && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            onClick={() => handleOpenModal()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                            <Plus size={16} /> {t('client.newClient')}
                        </motion.button>
                    )}
                </div>

                {/* ── Clients Table ── */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400">{t('client.messages.loading')}</div>
                ) : (
                    <>
                        <div className="flex-1 overflow-x-auto overflow-y-visible">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr>
                                        <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest w-12">
                                            <button
                                                onClick={toggleAll}
                                                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                                    selectedRows.length > 0 && selectedRows.length === filteredClients.length
                                                        ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                                                        : 'border-slate-300 hover:border-purple-400 bg-white text-transparent'
                                                }`}
                                            >
                                                <Check size={12} strokeWidth={3} />
                                            </button>
                                        </th>
                                        <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest">{t('client.companyName')}</th>
                                        <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest">{t('client.contact', 'Contact')}</th>
                                        <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest">{t('client.fiscalId')}</th>
                                        <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest">{t('client.address')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredClients.map((client, idx) => {
                                        const isSelected = selectedRows.includes(client.id);
                                        return (
                                            <motion.tr
                                                key={client.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                onClick={() => toggleRow(client.id)}
                                                className={`group transition-all duration-200 border-b border-slate-100/50 last:border-0 hover:bg-white/60 cursor-pointer ${isSelected ? 'bg-purple-50/50' : ''}`}
                                            >
                                                <td className="py-4 px-4">
                                                    <div
                                                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                                            isSelected
                                                                ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                                                                : 'border-slate-300 bg-white text-transparent group-hover:border-purple-400'
                                                        }`}
                                                    >
                                                        <Check size={12} strokeWidth={3} />
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shadow-sm">
                                                            {client.name.charAt(0)}
                                                        </div>
                                                        <div className="font-semibold text-slate-800 text-sm">{client.name}</div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="text-sm font-medium text-slate-700">{client.email || '-'}</div>
                                                        <div className="text-xs text-slate-500">{client.phone || '-'}</div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 font-medium text-slate-500 text-sm">
                                                    {client.taxId || '-'}
                                                </td>
                                                <td className="py-4 px-4 text-slate-500 text-sm truncate max-w-[200px]">
                                                    {client.address || '-'}
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                    {filteredClients.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-400 text-sm font-medium">
                                                {t('client.messages.emptySearch')}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {!search && (
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                totalCount={totalCount}
                                size={size}
                                onPageChange={setPage}
                                onSizeChange={(s) => { setSize(s); setPage(1); }}
                            />
                        )}
                    </>
                )}
            </div>

            {/* ── Create/Edit Slide-Over ── */}
            <SlideOverPanel
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingClient ? t('client.messages.editTitle') : t('client.messages.addTitle')}
                subtitle={t('client.messages.manage')}
            >
                <form onSubmit={handleSubmit} className="panze-form">
                    <div className="panze-form-group">
                        <label className="panze-form-label">{t('client.companyName')}</label>
                        <div className="panze-input-icon-left">
                            <Building size={16} className="panze-input-icon-static" />
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="panze-form-input panze-form-input--icon-left"
                                placeholder={t('client.messages.placeholders.companyName')}
                            />
                        </div>
                    </div>
                    <div className="panze-form-group">
                        <label className="panze-form-label">{t('client.fiscalId')}</label>
                        <div className="panze-input-icon-left">
                            <FileText size={16} className="panze-input-icon-static" />
                            <input
                                type="text"
                                required
                                value={formData.taxId}
                                onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                                className="panze-form-input panze-form-input--icon-left"
                                placeholder={t('client.messages.placeholders.fiscalId')}
                            />
                        </div>
                    </div>
                    <div className="panze-form-row">
                        <div className="panze-form-group">
                            <label className="panze-form-label">{t('client.phone')}</label>
                            <div className="panze-input-icon-left">
                                <Phone size={16} className="panze-input-icon-static" />
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="panze-form-input panze-form-input--icon-left"
                                    placeholder={t('client.messages.placeholders.phone')}
                                />
                            </div>
                        </div>
                        <div className="panze-form-group">
                            <label className="panze-form-label">{t('client.email')}</label>
                            <div className="panze-input-icon-left">
                                <Mail size={16} className="panze-input-icon-static" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="panze-form-input panze-form-input--icon-left"
                                    placeholder={t('client.messages.placeholders.email')}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="panze-form-group">
                        <label className="panze-form-label">{t('client.address')}</label>
                        <div className="panze-input-icon-left">
                            <MapPin size={16} className="panze-input-icon-static" style={{ top: '16px' }} />
                            <textarea
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                className="panze-form-textarea" style={{ paddingLeft: '42px' }}
                                placeholder={t('client.messages.placeholders.address')}
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 gap-3">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="panze-form-btn-outline"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="panze-form-btn-secondary disabled:opacity-50"
                        >
                            {editingClient ? t('client.messages.saveChanges') : t('client.messages.create')}
                        </button>
                    </div>
                </form>
            </SlideOverPanel>
        </motion.div>
    );
}

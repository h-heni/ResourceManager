import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Search, Trash2, Upload, Check, Pencil } from 'lucide-react';
import { useSuppliers, useSaveSupplier, useDeleteSupplier } from '../hooks/useSuppliers';
import api from '../services/api';
import Modal from '../components/Modal';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { useTranslation } from 'react-i18next';

interface Supplier {
    id: number;
    name: string;
    address: string;
    taxId: string;
    phone: string;
}

export default function SuppliersPage() {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const [search, setSearch] = useState('');
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        taxId: '',
        phone: ''
    });

    // React Query hooks
    const { data: suppliersData, isLoading: loading } = useSuppliers();
    const saveMutation = useSaveSupplier();
    const deleteMutation = useDeleteSupplier();
    const suppliers = (suppliersData || []) as Supplier[];

    const handleOpenModal = (supplier?: Supplier) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setFormData({
                name: supplier.name,
                address: supplier.address,
                taxId: supplier.taxId,
                phone: supplier.phone
            });
        } else {
            setEditingSupplier(null);
            setFormData({ name: '', address: '', taxId: '', phone: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saveMutation.isPending) return;
        try {
            await saveMutation.mutateAsync({ id: editingSupplier?.id, data: formData });
            setIsModalOpen(false);
        } catch (error) {
            logger.error("Error saving supplier", error);
            notify('error', t('supplier.messages.saveFailed'));
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('supplier.messages.confirmDelete'))) return;
        try {
            await deleteMutation.mutateAsync(id);
        } catch (error) {
            logger.error("Error deleting supplier", error);
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.taxId.includes(search)
    );

    const toggleRow = (id: number) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    };
    const toggleAll = () => {
        setSelectedRows(prev => prev.length === filteredSuppliers.length ? [] : filteredSuppliers.map(s => s.id));
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col gap-6">
            <NotifyBanner />

            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('supplier.title')}</h1>
                    <p className="text-sm text-slate-500 mt-1">{t('supplier.messages.manage')}</p>
                </div>
            </div>

            {/* ── Main Container ── */}
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
                                        onClick={() => { const s = suppliers.find(s => s.id === selectedRows[0]); if (s) handleOpenModal(s); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors"
                                    >
                                        <Pencil size={14} className="text-purple-500" /> {t('common.edit')}
                                    </button>
                                )}
                                {selectedRows.length === 1 && (
                                    <button
                                        onClick={() => {
                                            const s = suppliers.find(s => s.id === selectedRows[0]);
                                            if (!s) return;
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'application/pdf';
                                            input.onchange = async (e) => {
                                                const file = (e.target as HTMLInputElement).files?.[0];
                                                if (!file) return;
                                                const fd = new FormData();
                                                fd.append('file', file);
                                                try {
                                                    await api.post(`/Suppliers/${s.id}/upload-invoice`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                                    notify('success', t('supplier.messages.uploadSuccess'));
                                                } catch (error) {
                                                    logger.error('Upload failed', error);
                                                    notify('error', t('supplier.messages.uploadFailed'));
                                                }
                                            };
                                            input.click();
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors"
                                    >
                                        <Upload size={14} className="text-purple-500" /> {t('supplier.messages.uploadInvoice')}
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
                                    placeholder={t('supplier.messages.searchPlaceholder')}
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
                            <Plus size={16} /> {t('supplier.newSupplier')}
                        </motion.button>
                    )}
                </div>

                {/* ── Table ── */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400">{t('supplier.messages.loading')}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left w-10">
                                        <div
                                            onClick={toggleAll}
                                            className={`w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
                                                selectedRows.length === filteredSuppliers.length && filteredSuppliers.length > 0
                                                    ? 'bg-purple-600 border-purple-600 text-white'
                                                    : 'border-slate-300 bg-white text-transparent hover:border-purple-400'
                                            }`}
                                        >
                                            <Check size={12} strokeWidth={3} />
                                        </div>
                                    </th>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left">{t('supplier.messages.companyName')}</th>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left">{t('supplier.messages.fiscalId')}</th>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left">{t('supplier.messages.phone')}</th>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left">{t('supplier.messages.address')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSuppliers.map((supplier, idx) => {
                                    const isSelected = selectedRows.includes(supplier.id);
                                    return (
                                        <motion.tr
                                            key={supplier.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            onClick={() => toggleRow(supplier.id)}
                                            className={`border-b border-slate-100 cursor-pointer transition-colors ${
                                                isSelected ? 'bg-purple-50/50' : 'hover:bg-slate-50/80'
                                            }`}
                                        >
                                            <td className="py-3.5 px-4">
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                                    isSelected ? 'bg-purple-600 border-purple-600 text-white shadow-sm' : 'border-slate-300 bg-white text-transparent'
                                                }`}>
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                                                        {supplier.name.charAt(0)}
                                                    </div>
                                                    <span className="font-semibold text-slate-900">{supplier.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-sm text-slate-600">{supplier.taxId || '-'}</td>
                                            <td className="py-3.5 px-4 text-sm text-slate-600">{supplier.phone || '-'}</td>
                                            <td className="py-3.5 px-4 text-sm text-slate-600 max-w-[200px] truncate">{supplier.address || '-'}</td>
                                        </motion.tr>
                                    );
                                })}
                                {filteredSuppliers.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                                            {t('supplier.messages.empty')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingSupplier ? t('supplier.messages.editTitle') : t('supplier.messages.addTitle')}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplier.messages.companyName')}</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder={t('supplier.messages.placeholders.companyName')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplier.messages.fiscalId')}</label>
                        <input
                            type="text"
                            required
                            value={formData.taxId}
                            onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder={t('supplier.messages.placeholders.fiscalId')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplier.messages.phone')}</label>
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder={t('supplier.messages.placeholders.phone')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplier.messages.address')}</label>
                        <textarea
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder={t('supplier.messages.placeholders.address')}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end pt-4 space-x-3">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={saveMutation.isPending}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg disabled:opacity-50"
                        >
                            {editingSupplier ? t('supplier.messages.saveChanges') : t('supplier.messages.create')}
                        </button>
                    </div>
                </form>
            </Modal>
        </motion.div>
    );
}

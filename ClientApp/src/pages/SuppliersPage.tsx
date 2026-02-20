import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Upload } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
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
    const { user } = useAuth();
    const isManager = user?.roles?.includes('Manager') || user?.roles?.includes('SuperAdmin') || user?.roles?.includes('FreeUser');
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        taxId: '',
        phone: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        try {
            const res = await api.get('/Suppliers');
            // Handle both pagination and raw list
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setSuppliers(data);
        } catch (error) {
            logger.error("Error fetching suppliers", error);
        } finally {
            setLoading(false);
        }
    };

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
        if (saving) return;
        setSaving(true);
        try {
            if (editingSupplier) {
                await api.put(`/Suppliers/${editingSupplier.id}`, { ...formData, id: editingSupplier.id });
            } else {
                await api.post('/Suppliers', formData);
            }
            setIsModalOpen(false);
            fetchSuppliers();
        } catch (error) {
            logger.error("Error saving supplier", error);
            notify('error', t('supplier.messages.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('supplier.messages.confirmDelete'))) return;
        try {
            await api.delete(`/Suppliers/${id}`);
            fetchSuppliers();
        } catch (error) {
            logger.error("Error deleting supplier", error);
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.taxId.includes(search)
    );

    return (
        <div className="space-y-6">
            <NotifyBanner />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('supplier.title')}</h1>
                    <p className="text-gray-500 mt-1">{t('supplier.messages.manage')}</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-4 py-2 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all transform hover:scale-105"
                >
                    <Plus size={20} className="mr-2" />
                    {t('supplier.newSupplier')}
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder={t('supplier.messages.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none transition-all"
                />
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">{t('supplier.messages.loading')}</div>
            ) : (
                <div className="rm-table-card">
                    <table className="rm-table">
                        <colgroup>
                            <col style={{ width: '25%' }} />{/* Company Name */}
                            <col style={{ width: '18%' }} />{/* Fiscal ID */}
                            <col style={{ width: '15%' }} />{/* Phone */}
                            <col style={{ width: '30%' }} />{/* Address */}
                            <col style={{ width: '12%' }} />{/* Actions */}
                        </colgroup>
                        <thead>
                            <tr>
                                <th>{t('supplier.messages.companyName')}</th>
                                <th className="rm-th-id">{t('supplier.messages.fiscalId')}</th>
                                <th className="rm-th-id">{t('supplier.messages.phone')}</th>
                                <th>{t('supplier.messages.address')}</th>
                                <th className="rm-th-actions">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSuppliers.map((supplier) => (
                                <tr key={supplier.id}>
                                    <td className="rm-cell-text">
                                        <span className="font-semibold text-gray-900">{supplier.name}</span>
                                    </td>
                                    <td className="rm-cell-text whitespace-nowrap text-gray-600">{supplier.taxId || '-'}</td>
                                    <td className="rm-cell-text whitespace-nowrap text-gray-600">{supplier.phone || '-'}</td>
                                    <td className="rm-cell-text text-gray-600">{supplier.address || '-'}</td>
                                    <td className="rm-cell-actions">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'application/pdf';
                                                input.onchange = async (e) => {
                                                    const file = (e.target as HTMLInputElement).files?.[0];
                                                    if (!file) return;
                                                    const formData = new FormData();
                                                    formData.append('file', file);
                                                    try {
                                                        await api.post(`/Suppliers/${supplier.id}/upload-invoice`, formData, {
                                                            headers: { 'Content-Type': 'multipart/form-data' }
                                                        });
                                                        notify('success', t('supplier.messages.uploadSuccess'));
                                                    } catch (error) {
                                                        logger.error("Upload failed", error);
                                                        notify('error', t('supplier.messages.uploadFailed'));
                                                    }
                                                };
                                                input.click();
                                            }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors" title={t('supplier.messages.uploadInvoice')}>
                                                <Upload size={18} />
                                            </button>
                                            <button onClick={() => handleOpenModal(supplier)} className="p-2 text-gray-400 hover:text-[#065F46] hover:bg-gray-50 rounded-lg transition-colors" title={t('common.edit')}>
                                                <Edit2 size={18} />
                                            </button>
                                            {isManager && (
                                                <button onClick={() => handleDelete(supplier.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-50 rounded-lg transition-colors" title={t('common.delete')}>
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredSuppliers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                                        {t('supplier.messages.empty')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

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
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
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
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder={t('supplier.messages.placeholders.fiscalId')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplier.messages.phone')}</label>
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder={t('supplier.messages.placeholders.phone')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplier.messages.address')}</label>
                        <textarea
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
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
                            disabled={saving}
                            className="px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#047857] transition-colors shadow-lg disabled:opacity-50"
                        >
                            {editingSupplier ? t('supplier.messages.saveChanges') : t('supplier.messages.create')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

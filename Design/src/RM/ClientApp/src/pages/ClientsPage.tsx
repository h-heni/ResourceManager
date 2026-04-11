import { useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { getErrorMessage } from '../utils/errorUtils';
import Modal from '../components/Modal';
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
        c.taxId.includes(search)
    );

    return (
        <div className="space-y-6">
            <NotifyBanner />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('client.title')}</h1>
                    <p className="text-gray-500 mt-1">{t('client.messages.manage')}</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-4 py-2 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all transform hover:scale-105"
                >
                    <Plus size={20} className="mr-2" />
                    {t('client.newClient')}
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder={t('client.messages.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none transition-all"
                />
            </div>

            {/* Clients Table */}
            {loading ? (
                <div className="text-center py-20 text-gray-500">{t('client.messages.loading')}</div>
            ) : (
                <>
                    <div className="rm-table-card">
                        <table className="rm-table min-w-[750px]">
                            <colgroup>
                                <col style={{ width: '20%' }} />{/* Company Name */}
                                <col style={{ width: '15%' }} />{/* Fiscal ID */}
                                <col style={{ width: '15%' }} />{/* Phone */}
                                <col style={{ width: '18%' }} />{/* Email */}
                                <col style={{ width: '24%' }} />{/* Address */}
                                <col style={{ width: '8%' }} />{/* Actions */}
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>{t('client.companyName')}</th>
                                    <th className="rm-th-id">{t('client.fiscalId')}</th>
                                    <th className="rm-th-id">{t('client.phone')}</th>
                                    <th className="rm-th-id">{t('client.email')}</th>
                                    <th>{t('client.address')}</th>
                                    <th className="rm-th-actions">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.map((client) => (
                                    <tr key={client.id}>
                                        <td className="rm-cell-text">
                                            <span className="font-semibold text-gray-900">{client.name}</span>
                                        </td>
                                        <td className="rm-cell-text whitespace-nowrap text-gray-600">{client.taxId || '-'}</td>
                                        <td className="rm-cell-text whitespace-nowrap text-gray-600">{client.phone || '-'}</td>
                                        <td className="rm-cell-text whitespace-nowrap text-gray-600">{client.email || '-'}</td>
                                        <td className="rm-cell-text text-gray-600">{client.address || '-'}</td>
                                        <td className="rm-cell-actions">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => handleOpenModal(client)} className="p-2 text-gray-400 hover:text-[#065F46] hover:bg-gray-50 rounded-lg transition-colors" title={t('common.edit')}>
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(client.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-50 rounded-lg transition-colors" title={t('common.delete')}>
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredClients.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
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

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingClient ? t('client.messages.editTitle') : t('client.messages.addTitle')}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('client.companyName')}</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder={t('client.messages.placeholders.companyName')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('client.fiscalId')}</label>
                        <input
                            type="text"
                            required
                            value={formData.taxId}
                            onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder={t('client.messages.placeholders.fiscalId')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('client.phone')}</label>
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder={t('client.messages.placeholders.phone')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('client.email')}</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder={t('client.messages.placeholders.email')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('client.address')}</label>
                        <textarea
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder={t('client.messages.placeholders.address')}
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
                            {editingClient ? t('client.messages.saveChanges') : t('client.messages.create')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

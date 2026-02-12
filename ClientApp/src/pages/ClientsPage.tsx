import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Phone, MapPin } from 'lucide-react';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { useTranslation } from 'react-i18next';

interface Client {
    id: number;
    name: string;
    address: string;
    matriculeFiscal: string;
    phone: string;
}

export default function ClientsPage() {
    const { t } = useTranslation();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        matriculeFiscal: '',
        phone: ''
    });

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        fetchClients();
    }, [page, size]);
    /* eslint-enable react-hooks/exhaustive-deps */

    const fetchClients = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/Clients?page=${page}&size=${size}`);
            const data = res.data;
            setClients(data.data || []);
            setTotalCount(data.totalCount || 0);
            setTotalPages(data.totalPages || 0);
        } catch (error) {
            console.error("Error fetching clients", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (client?: Client) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                name: client.name,
                address: client.address,
                matriculeFiscal: client.matriculeFiscal,
                phone: client.phone
            });
        } else {
            setEditingClient(null);
            setFormData({ name: '', address: '', matriculeFiscal: '', phone: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingClient) {
                await api.put(`/Clients/${editingClient.id}`, { ...formData, companyName: formData.name, id: editingClient.id });
            } else {
                await api.post('/Clients', { ...formData, companyName: formData.name });
            }
            setIsModalOpen(false);
            fetchClients();
        } catch (error: unknown) {
            console.error("Error saving client", error);
            const msg = getErrorMessage(error, t('client.messages.saveFailed'));
            alert(msg);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('client.messages.confirmDelete'))) return;
        try {
            await api.delete(`/Clients/${id}`);
            fetchClients();
        } catch (error) {
            console.error("Error deleting client", error);
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.matriculeFiscal.includes(search)
    );

    return (
        <div className="space-y-6">
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

            {/* Clients Grid/Table */}
            {loading ? (
                <div className="text-center py-20 text-gray-500">{t('client.messages.loading')}</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClients.map((client) => (
                        <div key={client.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="h-12 w-12 bg-[#065F46]/5 rounded-xl flex items-center justify-center text-[#065F46] font-bold text-lg">
                                    {client.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => handleOpenModal(client)} className="p-2 text-gray-400 hover:text-[#065F46] hover:bg-gray-50 rounded-lg transition-colors">
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(client.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-50 rounded-lg transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-1">{client.name}</h3>
                            <p className="text-sm text-gray-400 mb-4">{client.matriculeFiscal}</p>

                            <div className="space-y-2">
                                <div className="flex items-center text-sm text-gray-600">
                                    <MapPin size={16} className="mr-2 text-gray-400" />
                                    <span className="truncate">{client.address}</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-600">
                                    <Phone size={16} className="mr-2 text-gray-400" />
                                    <span>{client.phone}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredClients.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <p className="text-gray-500">{t('client.messages.emptySearch')}</p>
                        </div>
                    )}
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
                            value={formData.matriculeFiscal}
                            onChange={e => setFormData({ ...formData, matriculeFiscal: e.target.value })}
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
                            className="px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#047857] transition-colors shadow-lg"
                        >
                            {editingClient ? t('client.messages.saveChanges') : t('client.messages.create')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

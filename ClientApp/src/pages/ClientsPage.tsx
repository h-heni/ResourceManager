import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Phone, MapPin } from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';

interface Client {
    id: number;
    name: string;
    address: string;
    matriculeFiscal: string;
    phone: string;
}

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        matriculeFiscal: '',
        phone: ''
    });

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const res = await api.get('/Clients');
            setClients(res.data);
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
        } catch (error: any) {
            console.error("Error saving client", error);
            const msg = error.response?.data?.message || error.response?.data || error.message || "Failed to save client";
            alert(`Failed to save client: ${JSON.stringify(msg)}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this client?")) return;
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
                    <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
                    <p className="text-gray-500 mt-1">Manage your customer base</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-4 py-2 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all transform hover:scale-105"
                >
                    <Plus size={20} className="mr-2" />
                    Add Client
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search clients by name or matricule..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none transition-all"
                />
            </div>

            {/* Clients Grid/Table */}
            {loading ? (
                <div className="text-center py-20 text-gray-500">Loading clients...</div>
            ) : (
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
                            <p className="text-gray-500">No clients found matching your search.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingClient ? "Edit Client" : "Add New Client"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder="e.g. Acme Corp"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal ID (Matricule)</label>
                        <input
                            type="text"
                            required
                            value={formData.matriculeFiscal}
                            onChange={e => setFormData({ ...formData, matriculeFiscal: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder="e.g. 12345678"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder="e.g. +216 55 123 456"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <textarea
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder="Full business address..."
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end pt-4 space-x-3">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#047857] transition-colors shadow-lg"
                        >
                            {editingClient ? "Save Changes" : "Create Client"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

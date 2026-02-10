import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Phone, MapPin, Truck, Upload } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

interface Supplier {
    id: number;
    name: string;
    address: string;
    matriculeFiscal: string;
    phone: string;
}

export default function SuppliersPage() {
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
        matriculeFiscal: '',
        phone: ''
    });

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        try {
            const res = await api.get('/Fournisseurs');
            // Handle both pagination and raw list
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setSuppliers(data);
        } catch (error) {
            console.error("Error fetching suppliers", error);
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
                matriculeFiscal: supplier.matriculeFiscal,
                phone: supplier.phone
            });
        } else {
            setEditingSupplier(null);
            setFormData({ name: '', address: '', matriculeFiscal: '', phone: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingSupplier) {
                await api.put(`/Fournisseurs/${editingSupplier.id}`, { ...formData, id: editingSupplier.id });
            } else {
                await api.post('/Fournisseurs', formData);
            }
            setIsModalOpen(false);
            fetchSuppliers();
        } catch (error) {
            console.error("Error saving supplier", error);
            alert("Failed to save supplier");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this supplier?")) return;
        try {
            await api.delete(`/Fournisseurs/${id}`);
            fetchSuppliers();
        } catch (error) {
            console.error("Error deleting supplier", error);
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.matriculeFiscal.includes(search)
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
                    <p className="text-gray-500 mt-1">Manage your supply chain partners</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-4 py-2 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all transform hover:scale-105"
                >
                    <Plus size={20} className="mr-2" />
                    Add Supplier
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search suppliers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none transition-all"
                />
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">Loading suppliers...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSuppliers.map((supplier) => (
                        <div key={supplier.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="h-12 w-12 bg-[#065F46]/5 rounded-xl flex items-center justify-center text-[#065F46] font-bold text-lg">
                                    <Truck size={24} />
                                </div>
                                <div className="flex space-x-2">
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
                                                await api.post(`/Fournisseurs/${supplier.id}/upload-invoice`, formData, {
                                                    headers: { 'Content-Type': 'multipart/form-data' }
                                                });
                                                alert("Invoice uploaded successfully!");
                                            } catch (error) {
                                                console.error("Upload failed", error);
                                                alert("Upload failed.");
                                            }
                                        };
                                        input.click();
                                    }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors" title="Upload Invoice">
                                        <Upload size={18} />
                                    </button>
                                    <button onClick={() => handleOpenModal(supplier)} className="p-2 text-gray-400 hover:text-[#065F46] hover:bg-gray-50 rounded-lg transition-colors" title="Edit">
                                        <Edit2 size={18} />
                                    </button>
                                    {isManager && (
                                        <button onClick={() => handleDelete(supplier.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-50 rounded-lg transition-colors" title="Delete">
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-1">{supplier.name}</h3>
                            <p className="text-sm text-gray-400 mb-4">{supplier.matriculeFiscal}</p>

                            <div className="space-y-2">
                                <div className="flex items-center text-sm text-gray-600">
                                    <MapPin size={16} className="mr-2 text-gray-400" />
                                    <span className="truncate">{supplier.address}</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-600">
                                    <Phone size={16} className="mr-2 text-gray-400" />
                                    <span>{supplier.phone}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredSuppliers.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <p className="text-gray-500">No suppliers found.</p>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingSupplier ? "Edit Supplier" : "Add New Supplier"}
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
                            placeholder="e.g. Acme Supply"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal ID</label>
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
                            placeholder="e.g. +216..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <textarea
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none"
                            placeholder="Address..."
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
                            {editingSupplier ? "Save Changes" : "Create Supplier"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

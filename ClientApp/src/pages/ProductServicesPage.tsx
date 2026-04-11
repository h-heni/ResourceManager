import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
    Plus, Trash2, Search, Package, X,
    Loader2, Check, AlertCircle, PackagePlus, BarChart3, Pencil
} from 'lucide-react';
import api from '../services/api';
import { useSettings } from '../hooks/useSettings';
import { logger } from '../lib/logger';
import Pagination from '../components/Pagination';
import { useProductServices, useSaveProductService, useDeleteProductService } from '../hooks/useProductServices';

interface ProductServiceItem {
    id: number;
    name: string;
    description?: string;
    defaultUnitPrice: number;
    type: string;
    category?: string;
    vatApplicable: boolean;
    createdAt: string;
    tvaRate?: number;
    isStockTracked?: boolean;
    currentStock?: number;
    reorderPoint?: number;
}

interface TaxSettings {
    defaultVatRate: number;
    availableVatRates: number[];
}

export default function ProductServicesPage() {
    const { t } = useTranslation();
    const { currencySymbol } = useSettings();
    const [search, setSearch] = useState('');
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(20);

    // React Query hooks
    const { data: itemsData, isLoading: loading } = useProductServices(page, size);
    const saveMutation = useSaveProductService();
    const deleteMutation = useDeleteProductService();
    const items = (itemsData?.data || []) as ProductServiceItem[];
    const totalCount = itemsData?.totalCount || 0;
    const totalPages = itemsData?.totalPages || 0;

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<ProductServiceItem | null>(null);
    const [saveError, setSaveError] = useState('');
    const [form, setForm] = useState({
        name: '',
        description: '',
        defaultUnitPrice: '',
        type: 'product',
        category: '',
        vatApplicable: true,
        vatRate: 0,
        isStockTracked: false,
        reorderPoint: ''
    });


    // Tax settings
    const [taxSettings, setTaxSettings] = useState<TaxSettings>({ defaultVatRate: 0.19, availableVatRates: [0, 7, 13, 19] });

    const fetchTaxSettings = useCallback(async () => {
        try {
            const res = await api.get('/Settings');
            let vatRates = [0, 7, 13, 19];
            try { if (res.data.availableVatRates) vatRates = JSON.parse(res.data.availableVatRates); } catch { /* keep defaults */ }
            const defaultRate = res.data.defaultVatRate ?? 0.19;
            setTaxSettings({ defaultVatRate: defaultRate, availableVatRates: vatRates });
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchTaxSettings();
    }, [fetchTaxSettings]);

    // Sort alphabetically A→Z
    const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    const filteredItems = sortedItems.filter(item => {
        const matchesSearch = !search ||
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.description?.toLowerCase().includes(search.toLowerCase()) ||
            item.category?.toLowerCase().includes(search.toLowerCase());

        return matchesSearch;
    });

    const toggleRow = (id: number) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    };

    const openCreateModal = () => {
        setEditingItem(null);
        const defaultVatInt = Math.round(taxSettings.defaultVatRate * 100);
        setForm({ name: '', description: '', defaultUnitPrice: '', type: 'product', category: '', vatApplicable: true, vatRate: defaultVatInt, isStockTracked: false, reorderPoint: '' });
        setSaveError('');
        setShowModal(true);
    };

    const openEditModal = (item: ProductServiceItem) => {
        setEditingItem(item);
        const storedRate = item.tvaRate != null ? Math.round(item.tvaRate) : Math.round(taxSettings.defaultVatRate * 100);
        setForm({
            name: item.name,
            description: item.description || '',
            defaultUnitPrice: item.defaultUnitPrice.toString(),
            type: item.type,
            category: item.category || '',
            vatApplicable: item.vatApplicable,
            vatRate: item.vatApplicable ? storedRate : 0,
            isStockTracked: item.isStockTracked ?? false,
            reorderPoint: item.reorderPoint != null ? item.reorderPoint.toString() : ''
        });
        setSaveError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            setSaveError(t('product.nameRequired', 'Product name is required'));
            return;
        }

        // Google search is optional — user can type a name directly

        setSaveError('');
        try {
            const payload = {
                name: form.name,
                description: form.description || undefined,
                defaultUnitPrice: parseFloat(form.defaultUnitPrice) || 0,
                tvaRate: form.vatRate,
                type: form.type,
                category: form.category || undefined,
                vatApplicable: form.vatApplicable,
                isStockTracked: form.isStockTracked,
                reorderPoint: form.isStockTracked && form.reorderPoint !== '' ? parseFloat(form.reorderPoint) : null
            };

            await saveMutation.mutateAsync({ id: editingItem?.id, data: payload });
            setShowModal(false);
        } catch (err) {
            logger.error('Failed to save:', err);
            setSaveError(t('product.saveFailed', 'Failed to save product. Please try again.'));
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('product.confirmDelete'))) return;
        try {
            await deleteMutation.mutateAsync(id);
        } catch (err) {
            logger.error('Failed to delete:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-purple-600" size={32} />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('product.title', 'Products & Services')}</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {items.length} {t('product.title', 'products').toLowerCase()} &middot; {t('product.sortedAZ', 'Sorted A → Z')}
                    </p>
                </div>
            </div>

            {/* Main Container */}
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
                                        onClick={() => { const i = filteredItems.find(i => i.id === selectedRows[0]); if (i) openEditModal(i); }}
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
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t('product.searchPlaceholder', 'Filter saved products...')}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200/60 hover:border-purple-300 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 rounded-full text-sm font-medium outline-none transition-all placeholder:text-slate-400 text-slate-900 shadow-sm"
                                />
                            </motion.div>
                        )}
                    </div>
                    {!selectedRows.length && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            onClick={openCreateModal}
                            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                            <Plus size={16} /> {t('product.newProduct', 'New Product')}
                        </motion.button>
                    )}
                </div>

            {/* Items List */}
            {filteredItems.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-center mb-3">
                        <Package className="text-slate-400" size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">{t('product.noProducts', 'No products found')}</h3>
                    <p className="text-xs text-slate-500 mt-1">{t('product.addFirst', 'Click "New Product" to search and add products')}</p>
                </div>
            ) : (
                <div>
                    {filteredItems.map((item, idx) => {
                        const isSelected = selectedRows.includes(item.id);
                        return (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                onClick={() => toggleRow(item.id)}
                                className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors ${idx > 0 ? 'border-t border-slate-100' : ''} ${
                                    isSelected ? 'bg-purple-50/50' : 'hover:bg-slate-50/80'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                                    isSelected ? 'bg-purple-600 border-purple-600 text-white shadow-sm' : 'border-slate-300 bg-white text-transparent'
                                }`}>
                                    <Check size={12} strokeWidth={3} />
                                </div>
                                <div className="p-2 rounded-lg bg-purple-50 shrink-0">
                                    <Package size={16} className="text-purple-600" />
                                </div>
                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                    <span className="font-semibold text-slate-900 truncate">{item.name}</span>
                                    {item.category && (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-full shrink-0 border border-slate-200">{item.category}</span>
                                    )}
                                    {item.description && (
                                        <span className="text-sm text-slate-400 truncate hidden lg:inline">{item.description}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {item.isStockTracked && (
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-widest rounded-full border border-blue-200 flex items-center gap-1">
                                            <BarChart3 size={12} />
                                            {item.currentStock ?? 0} {t('product.inStock', 'in stock')}
                                        </span>
                                    )}
                                    {item.vatApplicable && (
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-200">{item.tvaRate}%</span>
                                    )}
                                    <span className="text-sm font-bold text-slate-900 w-28 text-right">
                                        {item.defaultUnitPrice.toFixed(3)} {currencySymbol}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
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

            {/* Create/Edit Modal - matches QuoteCreatePage "Create New Product" modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <PackagePlus size={20} className="mr-2 text-emerald-600" />
                                {editingItem ? t('product.editProduct', 'Edit Product') : t('product.createNew', 'Create New Product')}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-full">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Error banner */}
                            {saveError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                                    <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                                    <span className="text-sm text-red-700">{saveError}</span>
                                </div>
                            )}

                            {/* Product Name (read-only after selection for create, editable for edit) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('product.name', 'Product Name')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder={t('product.namePlaceholder', 'e.g. Web Design Service')}
                                    readOnly={false}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('product.description', 'Description')}
                                </label>
                                <input
                                    type="text"
                                    value={form.description}
                                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder={t('product.descriptionPlaceholder', 'Optional details...')}
                                />
                            </div>

                            {/* Default Unit Price + TVA */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('product.defaultPrice', 'Default Unit Price')}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            value={form.defaultUnitPrice}
                                            onChange={e => setForm(prev => ({ ...prev, defaultUnitPrice: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none pr-14"
                                            placeholder="0.000"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currencySymbol}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('product.tax', 'Tax (TVA)')}
                                    </label>
                                    <select
                                        value={form.vatApplicable ? form.vatRate : 0}
                                        onChange={e => {
                                            const rate = parseInt(e.target.value);
                                            setForm(prev => ({ ...prev, vatApplicable: rate > 0, vatRate: rate }));
                                        }}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        {taxSettings.availableVatRates.map(rate => (
                                            <option key={rate} value={rate}>
                                                {rate === 0 ? 'No TVA (0%)' : `TVA ${rate}%`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Inventory Management Toggle */}
                            <div className={`flex items-center justify-between p-3 rounded-xl border ${editingItem ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={16} className={editingItem ? 'text-gray-400' : 'text-blue-600'} />
                                    <div>
                                        <span className={`text-sm font-medium ${editingItem ? 'text-gray-500' : 'text-gray-700'}`}>{t('product.inventoryManaged', 'Inventory Managed')}</span>
                                        <p className="text-xs text-gray-400">
                                            {editingItem
                                                ? t('product.inventoryManagedLocked', 'This setting cannot be changed after creation')
                                                : t('product.inventoryManagedDesc', 'Enable to track stock levels — this choice is permanent')}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (editingItem) return;
                                        setForm(prev => ({ ...prev, isStockTracked: !prev.isStockTracked }));
                                    }}
                                    disabled={!!editingItem}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isStockTracked ? 'bg-emerald-600' : 'bg-gray-300'} ${editingItem ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isStockTracked ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Reorder Point — only shown when stock tracking is enabled */}
                            {form.isStockTracked && (
                                <div className="mt-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('product.reorderPoint', 'Reorder Point (Low Stock Alert)')}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={form.reorderPoint}
                                        onChange={e => setForm(prev => ({ ...prev, reorderPoint: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder={t('product.reorderPointPlaceholder', 'e.g. 10 — alert when stock reaches this level')}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">{t('product.reorderPointDesc', 'You will be notified when stock falls to or below this level')}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saveMutation.isPending || !form.name.trim()}
                                className="px-5 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saveMutation.isPending ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Check size={16} className="mr-1.5" />}
                                {saveMutation.isPending ? t('common.saving', 'Saving...') : editingItem ? t('common.save', 'Save') : t('product.createAndSave', 'Create & Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

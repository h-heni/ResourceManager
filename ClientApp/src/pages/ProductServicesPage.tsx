import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Plus, Trash2, Edit2, Search, Package, X,
    Loader2, Check, AlertCircle, Globe, PackagePlus
} from 'lucide-react';
import api from '../services/api';

interface ProductServiceItem {
    id: number;
    name: string;
    description?: string;
    defaultUnitPrice: number;
    type: string;
    category?: string;
    vatApplicable: boolean;
    createdAt: string;
}

interface GoogleSearchResult {
    title: string;
    snippet: string;
}

interface TaxSettings {
    defaultVatRate: number;
    availableVatRates: number[];
}

export default function ProductServicesPage() {
    const { t } = useTranslation();
    const [items, setItems] = useState<ProductServiceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<ProductServiceItem | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [form, setForm] = useState({
        name: '',
        description: '',
        defaultUnitPrice: '',
        type: 'product',
        category: '',
        vatApplicable: true,
        vatRate: 19
    });

    // Google search state
    const [googleQuery, setGoogleQuery] = useState('');
    const [googleResults, setGoogleResults] = useState<GoogleSearchResult[]>([]);
    const [googleSearching, setGoogleSearching] = useState(false);
    const [googleError, setGoogleError] = useState('');
    const [selectedGoogleProduct, setSelectedGoogleProduct] = useState<string | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Tax settings
    const [taxSettings, setTaxSettings] = useState<TaxSettings>({ defaultVatRate: 0.19, availableVatRates: [0, 7, 13, 19] });

    const fetchItems = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/ProductServices');
            setItems(res.data);
        } catch (err) {
            console.error('Failed to fetch products:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTaxSettings = useCallback(async () => {
        try {
            const res = await api.get('/Settings');
            let vatRates = [0, 7, 13, 19];
            try { if (res.data.availableVatRates) vatRates = JSON.parse(res.data.availableVatRates); } catch { /* keep defaults */ }
            const defaultRate = res.data.defaultVatRate ?? 0.19;
            setTaxSettings({ defaultVatRate: defaultRate, availableVatRates: vatRates });
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchItems(); fetchTaxSettings(); }, [fetchItems, fetchTaxSettings]);

    // Sort alphabetically A→Z
    const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const filteredItems = sortedItems.filter(item => {
        const matchesSearch = !search ||
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.description?.toLowerCase().includes(search.toLowerCase()) ||
            item.category?.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
    });

    // Google search for products using Google Custom Search JSON API proxy
    // Since we can't expose API keys in frontend, we use a simple approach:
    // Search via a CORS proxy or the backend. Here we use Google's autocomplete-like approach.
    const searchGoogle = useCallback(async (query: string) => {
        if (query.length < 2) {
            setGoogleResults([]);
            return;
        }
        setGoogleSearching(true);
        setGoogleError('');
        try {
            // Use Google's suggestion/search API via a simple fetch
            // We'll search using DuckDuckGo instant answer API (no API key needed, CORS-friendly)
            const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' product')}&format=json&no_html=1&skip_disambig=1`);
            const data = await res.json();
            
            const results: GoogleSearchResult[] = [];
            
            // Add abstract if available
            if (data.AbstractText && data.Heading) {
                results.push({ title: data.Heading, snippet: data.AbstractText });
            }
            
            // Add related topics
            if (data.RelatedTopics) {
                for (const topic of data.RelatedTopics) {
                    if (topic.Text && topic.FirstURL) {
                        const name = topic.Text.split(' - ')[0]?.trim();
                        if (name && name.length > 1 && name.length < 100) {
                            results.push({ title: name, snippet: topic.Text });
                        }
                    }
                    // Handle sub-topics
                    if (topic.Topics) {
                        for (const sub of topic.Topics) {
                            if (sub.Text) {
                                const name = sub.Text.split(' - ')[0]?.trim();
                                if (name && name.length > 1 && name.length < 100) {
                                    results.push({ title: name, snippet: sub.Text });
                                }
                            }
                        }
                    }
                }
            }

            // Also use Google Suggest for auto-complete product names
            try {
                const suggestRes = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`);
                const suggestData = await suggestRes.json();
                if (Array.isArray(suggestData) && suggestData[1]) {
                    for (const suggestion of suggestData[1].slice(0, 8)) {
                        if (!results.some(r => r.title.toLowerCase() === suggestion.toLowerCase())) {
                            results.push({ title: suggestion, snippet: '' });
                        }
                    }
                }
            } catch { /* Google suggest might be blocked by CORS, that's fine */ }

            // If we still have no results, create entries from the query itself
            if (results.length === 0) {
                // Search our own saved products as fallback
                try {
                    const apiRes = await api.get(`/ProductServices/search?q=${encodeURIComponent(query)}`);
                    const apiData = Array.isArray(apiRes.data) ? apiRes.data : (apiRes.data.data || []);
                    for (const p of apiData) {
                        results.push({ title: p.name, snippet: p.description || '' });
                    }
                } catch { /* ignore */ }
            }
            
            setGoogleResults(results.slice(0, 10));
        } catch (err) {
            console.error('Google search failed:', err);
            setGoogleError('Search failed. Please try again or enter product name manually.');
            // Fallback: search local products
            try {
                const apiRes = await api.get(`/ProductServices/search?q=${encodeURIComponent(query)}`);
                const apiData = Array.isArray(apiRes.data) ? apiRes.data : (apiRes.data.data || []);
                setGoogleResults(apiData.map((p: any) => ({ title: p.name, snippet: p.description || '' })));
            } catch { /* ignore */ }
        } finally {
            setGoogleSearching(false);
        }
    }, []);

    const handleGoogleSearch = (query: string) => {
        setGoogleQuery(query);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => searchGoogle(query), 400);
    };

    const selectGoogleResult = (result: GoogleSearchResult) => {
        setSelectedGoogleProduct(result.title);
        setForm(prev => ({ ...prev, name: result.title, description: result.snippet?.split(' - ').slice(1).join(' - ') || '' }));
        setGoogleResults([]);
        setGoogleQuery(result.title);
        setSaveError('');
    };

    const openCreateModal = () => {
        setEditingItem(null);
        const defaultVatInt = Math.round(taxSettings.defaultVatRate * 100);
        setForm({ name: '', description: '', defaultUnitPrice: '', type: 'product', category: '', vatApplicable: true, vatRate: defaultVatInt });
        setGoogleQuery('');
        setGoogleResults([]);
        setSelectedGoogleProduct(null);
        setSaveError('');
        setShowModal(true);
    };

    const openEditModal = (item: ProductServiceItem) => {
        setEditingItem(item);
        const defaultVatInt = Math.round(taxSettings.defaultVatRate * 100);
        setForm({
            name: item.name,
            description: item.description || '',
            defaultUnitPrice: item.defaultUnitPrice.toString(),
            type: item.type,
            category: item.category || '',
            vatApplicable: item.vatApplicable,
            vatRate: item.vatApplicable ? defaultVatInt : 0
        });
        setGoogleQuery(item.name);
        setGoogleResults([]);
        setSelectedGoogleProduct(item.name);
        setSaveError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            setSaveError(t('product.nameRequired', 'Product name is required'));
            return;
        }

        // When creating (not editing), validate that search was used and a result was selected
        if (!editingItem && !selectedGoogleProduct) {
            setSaveError(t('product.mustSearchFirst', 'Please search for a product and select it from the results before saving.'));
            return;
        }

        setSaving(true);
        setSaveError('');
        try {
            const payload = {
                name: form.name,
                description: form.description || undefined,
                defaultUnitPrice: parseFloat(form.defaultUnitPrice) || 0,
                type: form.type,
                category: form.category || undefined,
                vatApplicable: form.vatApplicable
            };

            if (editingItem) {
                await api.put(`/ProductServices/${editingItem.id}`, payload);
            } else {
                await api.post('/ProductServices', payload);
            }
            setShowModal(false);
            fetchItems();
        } catch (err) {
            console.error('Failed to save:', err);
            setSaveError(t('product.saveFailed', 'Failed to save product. Please try again.'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('product.confirmDelete', 'Are you sure you want to delete this product?'))) return;
        try {
            await api.delete(`/ProductServices/${id}`);
            fetchItems();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('product.title', 'Products & Services')}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {items.length} {t('product.title', 'products').toLowerCase()} &middot; {t('product.sortedAZ', 'Sorted A → Z')}
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all font-medium"
                >
                    <Plus size={18} />
                    {t('product.newProduct', 'New Product')}
                </button>
            </div>

            {/* Search Bar (filter saved products) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('product.searchPlaceholder', 'Filter saved products...')}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    />
                </div>
            </div>

            {/* Items List (alphabetically sorted) */}
            {filteredItems.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                    <Package size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">{t('product.noProducts', 'No products found')}</p>
                    <p className="text-sm text-gray-400 mt-1">{t('product.addFirst', 'Click "New Product" to search and add products')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-blue-100">
                                        <Package size={18} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                        {item.category && (
                                            <span className="text-xs text-gray-500">{item.category}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => openEditModal(item)}
                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            
                            {item.description && (
                                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{item.description}</p>
                            )}

                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                                <span className="text-lg font-bold text-gray-900">
                                    {item.defaultUnitPrice.toFixed(3)} TND
                                </span>
                                <div className="flex items-center gap-2">
                                    {item.category && (
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{item.category}</span>
                                    )}
                                    {item.vatApplicable && (
                                        <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full font-medium">{t('invoice.tax', 'TVA')}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal - matches DevisCreatePage "Create New Product" modal */}
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

                            {/* Google Product Search (only for create, not edit) */}
                            {!editingItem && (
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('product.searchProduct', 'Search Product')} <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={googleQuery}
                                            onChange={e => {
                                                handleGoogleSearch(e.target.value);
                                                setSelectedGoogleProduct(null);
                                                setForm(prev => ({ ...prev, name: e.target.value }));
                                            }}
                                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder={t('product.googleSearchPlaceholder', 'Search by product name...')}
                                            autoFocus
                                        />
                                        {googleSearching && (
                                            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                                        )}
                                    </div>
                                    {selectedGoogleProduct && (
                                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                            <Check size={12} /> Selected: <strong>{selectedGoogleProduct}</strong>
                                        </p>
                                    )}
                                    {googleError && (
                                        <p className="text-xs text-amber-600 mt-1">{googleError}</p>
                                    )}
                                    {/* Google search results dropdown */}
                                    {googleResults.length > 0 && !selectedGoogleProduct && (
                                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                            {googleResults.map((result, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => selectGoogleResult(result)}
                                                    className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 flex items-start text-sm border-b border-gray-50 last:border-0"
                                                >
                                                    <Globe size={14} className="mr-2 mt-0.5 text-gray-400 shrink-0" />
                                                    <div className="min-w-0">
                                                        <span className="font-medium text-gray-900 block truncate">{result.title}</span>
                                                        {result.snippet && (
                                                            <span className="text-xs text-gray-400 block truncate">{result.snippet.slice(0, 80)}</span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
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
                                    readOnly={!editingItem && !!selectedGoogleProduct}
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
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">TND</span>
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
                                disabled={saving || !form.name.trim()}
                                className="px-5 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Check size={16} className="mr-1.5" />}
                                {saving ? t('common.saving', 'Saving...') : editingItem ? t('common.save', 'Save') : t('product.createAndSave', 'Create & Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

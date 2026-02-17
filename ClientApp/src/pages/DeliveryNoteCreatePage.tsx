import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Save, Package, FileText, History, User, Calendar, AlertCircle, CheckCircle, PackagePlus, X, Check } from 'lucide-react';
import api from '../services/api';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { DEFAULT_CURRENCY, CURRENCY_OPTIONS, getCurrencySymbol } from '../lib/currencyUtils';

interface DevisItem {
    description: string;
    quantity: number;
    price: number;
    tva?: boolean;
}

interface Devis {
    id: number;
    number: string;
    clientId: number;
    clientName: string;
    status: string;
    totalAmount: number;
    currency?: string;
    currencySymbol?: string;
    pdfLanguage?: string;
    devisItems?: DevisItem[];
    createdByUser?: { email?: string; userName?: string; firstName?: string; lastName?: string };
    createdByUserId?: string;
}

interface DeliveryNoteItem {
    id?: number;
    description: string;
    quantity: number;
}

interface ExistingDeliveryNote {
    id: number;
    number: string;
    date: string;
    createdByUser?: { email?: string; userName?: string; firstName?: string; lastName?: string };
    deliveryNoteItems?: DeliveryNoteItem[];
}

interface ProductSuggestion {
    id: number;
    name: string;
    description?: string;
    defaultUnitPrice: number;
    vatApplicable: boolean;
    tvaRate?: number;
}

interface DeliveryItem {
    description: string;
    quantity: number;
    quotedQuantity: number; // Original quoted amount
    remainingQuantity: number; // What's left to deliver
    fromCatalog: boolean; // true when from quote, product catalog, or inline-created
}

// Validation errors interface
interface ValidationErrors {
    devisId?: string;
    date?: string;
    items?: string;
}

export default function DeliveryNoteCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const [loading, setLoading] = useState(false);
    const [pendingDevis, setPendingDevis] = useState<Devis[]>([]);
    const [selectedDevis, setSelectedDevis] = useState<Devis | null>(null);
    const [existingDeliveryNotes, setExistingDeliveryNotes] = useState<ExistingDeliveryNote[]>([]);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [submitted, setSubmitted] = useState(false);

    // Product autocomplete state
    const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Inline product creation state
    const [showCreateProduct, setShowCreateProduct] = useState(false);
    const [createProductForIndex, setCreateProductForIndex] = useState<number>(0);
    const [newProduct, setNewProduct] = useState({ name: '', description: '', defaultUnitPrice: 0, vatRate: 19 });
    const [creatingProduct, setCreatingProduct] = useState(false);

    // Currency & Language state (per-document override)
    const [pdfCurrency, setPdfCurrency] = useState('');
    const [pdfCurrencySymbol, setPdfCurrencySymbol] = useState('');
    const [pdfLanguage, setPdfLanguage] = useState('');

    // Form State
    const [selectedDevisId, setSelectedDevisId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<DeliveryItem[]>([
        { description: '', quantity: 1, quotedQuantity: 0, remainingQuantity: 0, fromCatalog: false }
    ]);

    // Calculate already delivered quantities per description
    const deliveredQuantitiesByDescription = useMemo(() => {
        const quantityMap: Record<string, number> = {};

        existingDeliveryNotes.forEach(dn => {
            dn.deliveryNoteItems?.forEach(item => {
                const key = item.description.toLowerCase().trim();
                quantityMap[key] = (quantityMap[key] || 0) + (item.quantity || 0);
            });
        });

        return quantityMap;
    }, [existingDeliveryNotes]);

    useEffect(() => {
        fetchPendingDevis();
        const fetchCurrencySettings = async () => {
            try {
                const res = await api.get('/Settings');
                if (!pdfCurrency) {
                    setPdfCurrency(res.data.currency || DEFAULT_CURRENCY);
                    setPdfCurrencySymbol(res.data.currencySymbol || getCurrencySymbol(res.data.currency) || DEFAULT_CURRENCY);
                }
                if (!pdfLanguage) {
                    setPdfLanguage(res.data.invoiceLanguage || 'fr');
                }
            } catch (error) {
                logger.error('Error fetching currency settings', error);
            }
        };
        fetchCurrencySettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Validate form
    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};

        if (!selectedDevisId) {
            newErrors.devisId = t('createPage.linkQuote');
        }

        if (!date) {
            newErrors.date = t('createPage.dateRequired');
        }

        const validItems = items.filter(item => item.description.trim() !== '');
        if (validItems.length === 0) {
            newErrors.items = t('createPage.itemsRequired');
        }

        const hasInvalidItems = items.some(item =>
            (item.description.trim() && item.quantity <= 0)
        );
        if (hasInvalidItems) {
            newErrors.items = t('createPage.itemsInvalid');
        }

        // Strict validation: every non-empty item must come from the catalog or quote
        const hasUnresolvedItems = items.some(item =>
            item.description.trim() !== '' && !item.fromCatalog
        );
        if (hasUnresolvedItems) {
            newErrors.items = t('deliveryNote.messages.productNotInCatalog', 'Each item must be selected from the product catalog or created as a new product');
        }

        // Over-delivery is allowed - just show info message, not blocking error

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Check for over-delivery (info message, not blocking)
    const hasOverDelivery = useMemo(() => {
        return items.some(item => {
            if (!item.description.trim()) return false;
            return item.quantity > item.remainingQuantity && item.remainingQuantity > 0;
        });
    }, [items]);

    // Mark field as touched
    const handleBlur = (field: string) => {
        setTouched(prev => ({ ...prev, [field]: true }));
    };

    // Fetch only Draft/Accepted (untreated) Devis
    const fetchPendingDevis = async () => {
        try {
            const res = await api.get('/Devis');
            const allDevis = Array.isArray(res.data) ? res.data : (res.data.data || []);
            const draftDevis = allDevis.filter((d: { status: string; isDeleted?: boolean; treated?: boolean }) =>
                (d.status === 'Draft' || d.status === 'Accepted') && !d.isDeleted && !d.treated
            );
            setPendingDevis(draftDevis);
        } catch (error) {
            logger.error("Error fetching devis", error);
        }
    };

    // Fetch existing delivery notes for the selected devis
    const fetchExistingDeliveryNotes = async (devisId: string) => {
        if (!devisId) {
            setExistingDeliveryNotes([]);
            return;
        }
        try {
            const res = await api.get('/DeliveryNotes');
            let allNotes: Array<{ id: number; devisId?: number; number?: string; date?: string }> = [];
            if (Array.isArray(res.data)) {
                allNotes = res.data;
            } else if (res.data?.Data) {
                allNotes = res.data.Data;
            } else if (res.data?.data) {
                allNotes = res.data.data;
            }

            // Filter delivery notes linked to this devis
            const linkedNoteIds = allNotes
                .filter((dn: { id: number; devisId?: number }) => dn.devisId === parseInt(devisId))
                .map((dn: { id: number; devisId?: number }) => dn.id);

            // Fetch full details for each delivery note
            const detailedNotes = await Promise.all(
                linkedNoteIds.map(async (id: number) => {
                    try {
                        const detailRes = await api.get(`/DeliveryNotes/${id}`);
                        return detailRes.data;
                    } catch {
                        return null;
                    }
                })
            );

            setExistingDeliveryNotes(detailedNotes.filter(Boolean) as ExistingDeliveryNote[]);
        } catch (error) {
            logger.error("Error fetching existing delivery notes", error);
        }
    };

    const handleDevisSelection = async (devisId: string) => {
        setSelectedDevisId(devisId);
        setTouched(prev => ({ ...prev, devisId: true }));

        if (!devisId) {
            setSelectedDevis(null);
            setExistingDeliveryNotes([]);
            setItems([{ description: '', quantity: 1, quotedQuantity: 0, remainingQuantity: 0, fromCatalog: false }]);
            return;
        }

        try {
            // Fetch devis details
            const res = await api.get(`/Devis/${devisId}`);
            const devis = res.data;
            setSelectedDevis(devis);

            // Inherit currency & language from the quote
            if (devis.currency) setPdfCurrency(devis.currency);
            if (devis.currencySymbol) setPdfCurrencySymbol(devis.currencySymbol);
            if (devis.pdfLanguage) setPdfLanguage(devis.pdfLanguage);

            // Fetch existing delivery notes for this devis
            await fetchExistingDeliveryNotes(devisId);

        } catch (error) {
            logger.error("Error fetching devis details", error);
        }
    };

    // Update items when selectedDevis or existingDeliveryNotes change
    useEffect(() => {
        if (selectedDevis?.devisItems) {
            const newItems: DeliveryItem[] = selectedDevis.devisItems.map((item: DevisItem) => {
                const key = item.description.toLowerCase().trim();
                const alreadyDelivered = deliveredQuantitiesByDescription[key] || 0;
                const remaining = Math.max(0, (item.quantity || 0) - alreadyDelivered);

                return {
                    description: item.description,
                    quantity: remaining, // Default to remaining quantity
                    quotedQuantity: item.quantity || 0,
                    remainingQuantity: remaining,
                    fromCatalog: true // Items from the linked quote are trusted
                };
            });

            // Filter out items with 0 remaining, but keep at least one
            const itemsToDeliver = newItems.filter(item => item.remainingQuantity > 0);
            setItems(itemsToDeliver.length > 0 ? itemsToDeliver : [{ description: '', quantity: 1, quotedQuantity: 0, remainingQuantity: 0, fromCatalog: false }]);
        }
    }, [selectedDevis, deliveredQuantitiesByDescription]);

    const addItem = () => {
        setItems([...items, { description: '', quantity: 1, quotedQuantity: 0, remainingQuantity: 0, fromCatalog: false }]);
    };

    const removeItem = (index: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof DeliveryItem, value: string | number | boolean) => {
        const newItems = [...items];
        (newItems[index] as unknown as Record<string, string | number | boolean>)[field] = value;
        setItems(newItems);
    };

    // Product autocomplete: search saved products as user types
    const searchProducts = useCallback((query: string, itemIndex: number) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (query.length < 1) {
            setSuggestions([]);
            setActiveItemIndex(null);
            return;
        }
        searchTimerRef.current = setTimeout(async () => {
            try {
                const res = await api.get(`/ProductServices/search?q=${encodeURIComponent(query)}`);
                const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
                setSuggestions(data.slice(0, 8));
                setActiveItemIndex(itemIndex);
            } catch {
                setSuggestions([]);
            }
        }, 250);
    }, []);

    const selectProduct = (product: ProductSuggestion, itemIndex: number) => {
        const newItems = [...items];
        newItems[itemIndex] = {
            ...newItems[itemIndex],
            description: product.name + (product.description ? ` - ${product.description}` : ''),
            fromCatalog: true,
        };
        setItems(newItems);
        setSuggestions([]);
        setActiveItemIndex(null);
    };

    const dismissSuggestions = () => {
        setTimeout(() => {
            setSuggestions([]);
            setActiveItemIndex(null);
        }, 200);
    };

    // Open inline product creation form
    const openCreateProduct = (itemIndex: number) => {
        const currentDesc = items[itemIndex]?.description || '';
        setNewProduct({ name: currentDesc, description: '', defaultUnitPrice: 0, vatRate: 19 });
        setCreateProductForIndex(itemIndex);
        setShowCreateProduct(true);
        setSuggestions([]);
        setActiveItemIndex(null);
    };

    // Create a new product via API and autofill the current line item
    const handleCreateProduct = async () => {
        if (!newProduct.name.trim()) return;
        setCreatingProduct(true);
        try {
            const res = await api.post('/ProductServices', {
                name: newProduct.name.trim(),
                description: newProduct.description.trim() || null,
                defaultUnitPrice: newProduct.defaultUnitPrice,
                tvaRate: newProduct.vatRate,
                type: 'product',
                category: null,
                vatApplicable: newProduct.vatRate > 0,
            });
            const created = res.data;
            // Auto-fill the line item description
            const newItems = [...items];
            newItems[createProductForIndex] = {
                ...newItems[createProductForIndex],
                description: created.name + (created.description ? ` - ${created.description}` : ''),
                fromCatalog: true,
            };
            setItems(newItems);
            setShowCreateProduct(false);
        } catch (error) {
            logger.error('Error creating product', error);
            notify('error', t('product.saveFailed'));
        } finally {
            setCreatingProduct(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Mark form as submitted for error display
        setSubmitted(true);

        // Validate form
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            const payload = {
                number: "BL-" + Date.now().toString().slice(-6),
                date: new Date(date).toISOString(),
                devisId: parseInt(selectedDevisId),
                clientId: selectedDevis?.clientId || null,
                deliveryNoteItems: items
                    .filter(item => item.description.trim() !== '')
                    .map(item => ({
                        description: item.description.trim(),
                        quantity: item.quantity
                    }))
            };

            await api.post('/DeliveryNotes', payload);
            navigate('/delivery-notes');
        } catch (error: unknown) {
            logger.error("Error creating BL", error);
            const axErr = error as { response?: { data?: { message?: string; detail?: string; title?: string; errors?: Record<string, string[]> } } };
            const serverMsg = axErr?.response?.data?.message
                || axErr?.response?.data?.detail
                || axErr?.response?.data?.title
                || (axErr?.response?.data?.errors ? Object.values(axErr.response.data.errors).flat().join('; ') : null);
            notify('error', serverMsg || t('deliveryNote.messages.createFailed'));
        } finally {
            setLoading(false);
        }
    };

    // Check if all items are fully delivered
    const allFullyDelivered = selectedDevis?.devisItems?.every(item => {
        const key = item.description.toLowerCase().trim();
        const alreadyDelivered = deliveredQuantitiesByDescription[key] || 0;
        return alreadyDelivered >= (item.quantity || 0);
    }) ?? false;

    return (
        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-0">
            <NotifyBanner />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start space-x-4">
                    <button onClick={() => navigate('/delivery-notes')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{t('deliveryNote.newDeliveryNote')}</h1>
                        <p className="text-gray-500 text-sm">{t('deliveryNote.pageDescription')}</p>
                    </div>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={loading || allFullyDelivered}
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={20} className="mr-2" />
                    {loading ? t('common.saving') : t('deliveryNote.create')}
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-8 animate-fade-in text-gray-800">
                {/* Validation Summary - only show after submit */}
                {submitted && Object.keys(errors).length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start space-x-3">
                            <AlertCircle className="text-red-500 mt-0.5" size={20} />
                            <div>
                                <h4 className="font-semibold text-red-800">{t('createPage.fixErrors')}</h4>
                                <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                                    {Object.values(errors).map((error, idx) => (
                                        <li key={idx}>{error}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Over-delivery info message - non-blocking */}
                {hasOverDelivery && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-start space-x-3">
                            <AlertCircle className="text-amber-500 mt-0.5" size={20} />
                            <div>
                                <h4 className="font-semibold text-amber-800">{t('deliveryNote.messages.overDeliveryTitle')}</h4>
                                <p className="text-sm text-amber-700 mt-1">
                                    {t('deliveryNote.messages.overDeliveryHelp')}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Currency & Language (inherited from Quote - read-only) */}
                {selectedDevisId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-[#065F46]/5 border border-emerald-100 rounded-xl">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('createPage.documentCurrency')}</label>
                            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600">
                                {CURRENCY_OPTIONS.find(c => c.code === pdfCurrency)?.label || pdfCurrency || t('createPage.inheritedFromQuote', 'Inherited from quote')}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{t('createPage.currencyFromQuote', 'Currency is inherited from the linked quote')}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('createPage.pdfLanguage')}</label>
                            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600">
                                {pdfLanguage === 'fr' ? t('language.fr') : pdfLanguage === 'en' ? t('language.en') : pdfLanguage === 'de' ? t('language.de') : pdfLanguage === 'ar' ? t('language.ar') : pdfLanguage || t('createPage.inheritedFromQuote', 'Inherited from quote')}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{t('createPage.languageFromQuote', 'Language is inherited from the linked quote')}</p>
                        </div>
                    </div>
                )}

                {/* Select Quote (Required) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select Quote (Devis) <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selectedDevisId}
                            onChange={e => handleDevisSelection(e.target.value)}
                            onBlur={() => handleBlur('devisId')}
                            className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none ${errors.devisId && submitted ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                }`}
                            required
                        >
                            <option value="">{t('createPage.noQuoteSelected')}</option>
                            {pendingDevis.map(devis => (
                                <option key={devis.id} value={devis.id}>
                                    {devis.number} - {devis.clientName} ({(devis.totalAmount || 0).toLocaleString()} {pdfCurrencySymbol || DEFAULT_CURRENCY})
                                </option>
                            ))}
                        </select>
                        {errors.devisId && submitted && (
                            <p className="text-xs text-red-600 mt-1">{errors.devisId}</p>
                        )}
                        {pendingDevis.length === 0 && (
                            <p className="text-sm text-amber-600 mt-2">{t('deliveryNote.messages.noQuotes')}</p>
                        )}
                    </div>

                    {/* Show selected quote info - Enhanced compact format */}
                    {selectedDevis && (
                        <div className="md:col-span-2 p-4 bg-[#065F46]/5 border border-[#065F46]/20 rounded-xl">
                            <div className="flex items-start space-x-3">
                                <FileText className="text-[#065F46] mt-1 flex-shrink-0" size={20} />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-[#065F46]">Quote: {selectedDevis.number}</h4>
                                        {selectedDevis.createdByUser && (
                                            <span className="text-xs text-[#065F46] flex items-center">
                                                <User size={12} className="mr-1" />
                                                {(selectedDevis.createdByUser.firstName || selectedDevis.createdByUser.lastName)
                                                    ? `${selectedDevis.createdByUser.firstName || ''} ${selectedDevis.createdByUser.lastName || ''}`.trim()
                                                    : selectedDevis.createdByUser.email}
                                            </span>
                                        )}
                                    </div>
                                    {/* Quote items list */}
                                    {selectedDevis.devisItems && selectedDevis.devisItems.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            <p className="text-xs font-semibold text-[#065F46] uppercase">{t('deliveryNote.items')}:</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                                {selectedDevis.devisItems.map((item, idx) => {
                                                    const key = item.description.toLowerCase().trim();
                                                    const delivered = deliveredQuantitiesByDescription[key] || 0;
                                                    const remaining = Math.max(0, (item.quantity || 0) - delivered);
                                                    const fullyDelivered = remaining === 0;

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`flex items-center justify-between text-sm px-2 py-1 rounded ${fullyDelivered ? 'bg-green-100 text-green-800' : 'bg-[#065F46]/10 text-[#065F46]'
                                                                }`}
                                                        >
                                                            <span className="truncate">{item.description}</span>
                                                            <span className="font-semibold ml-2 whitespace-nowrap">
                                                                {fullyDelivered ? (
                                                                    <span className="flex items-center">
                                                                        <CheckCircle size={14} className="mr-1" />
                                                                        {t('deliveryNote.delivered')}
                                                                    </span>
                                                                ) : (
                                                                    `${remaining}/${item.quantity}`
                                                                )}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* All Fully Delivered Warning */}
                    {allFullyDelivered && selectedDevis && (
                        <div className="md:col-span-2 p-4 bg-green-50 border border-green-200 rounded-xl">
                            <div className="flex items-center space-x-3">
                                <CheckCircle className="text-green-600" size={20} />
                                <div>
                                    <h4 className="font-semibold text-green-800">{t('deliveryNote.messages.allDeliveredTitle')}</h4>
                                    <p className="text-sm text-green-700">{t('deliveryNote.messages.allDeliveredHelp')}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('common.date')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            onBlur={() => handleBlur('date')}
                            className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none ${errors.date && submitted ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                }`}
                        />
                        {errors.date && submitted && (
                            <p className="text-xs text-red-600 mt-1">{errors.date}</p>
                        )}
                    </div>
                </div>

                {/* Previous Delivery Notes History */}
                {selectedDevisId && existingDeliveryNotes.length > 0 && (
                    <div className="border-t border-gray-100 pt-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center mb-4">
                            <History className="mr-2 text-amber-500" size={20} />
                            {t('deliveryNote.messages.previousDeliveryNotes')} ({existingDeliveryNotes.length})
                        </h3>
                        <p className="text-sm text-gray-500 mb-3">
                            {t('deliveryNote.messages.previousDeliveryNotesHelp')}
                        </p>
                        <div className="space-y-3">
                            {existingDeliveryNotes.map(dn => (
                                <div key={dn.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-amber-800">BL #{dn.number}</span>
                                        <div className="flex items-center space-x-3 text-sm text-amber-600">
                                            <span className="flex items-center">
                                                <Calendar size={14} className="mr-1" />
                                                {dn.date ? new Date(dn.date).toLocaleDateString() : t('users.table.notAvailable')}
                                            </span>
                                            {dn.createdByUser && (
                                                <span className="flex items-center">
                                                    <User size={14} className="mr-1" />
                                                    {(dn.createdByUser.firstName || dn.createdByUser.lastName)
                                                        ? `${dn.createdByUser.firstName || ''} ${dn.createdByUser.lastName || ''}`.trim()
                                                        : dn.createdByUser.email}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* DN Items */}
                                    {dn.deliveryNoteItems && dn.deliveryNoteItems.length > 0 && (
                                        <div className="mt-2 pl-2 border-l-2 border-amber-300">
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                                {dn.deliveryNoteItems.map((item, idx) => (
                                                    <div key={idx} className="flex items-center text-amber-700">
                                                        <Package size={12} className="mr-1 text-amber-500" />
                                                        <span className="truncate">{item.description}</span>
                                                        <span className="ml-1 font-semibold">x{item.quantity}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="border-t border-gray-100 pt-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center mb-4">
                        <Package className="mr-2 text-emerald-500" size={20} />
                        {t('deliveryNote.items')} <span className="text-red-500 ml-1">*</span>
                    </h3>

                    {errors.items && submitted && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-700 flex items-center">
                                <AlertCircle size={16} className="mr-2" />
                                {errors.items}
                            </p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {items.map((item, index) => {
                            const exceedsRemaining = item.quantity > item.remainingQuantity && item.remainingQuantity > 0;

                            return (
                                <div key={index} className="grid grid-cols-2 md:grid-cols-12 gap-4 items-end p-4 md:p-0 bg-gray-50 md:bg-white rounded-xl md:rounded-none border border-gray-100 md:border-0 mb-4 md:mb-0">
                                    <div className="col-span-2 md:col-span-8 relative">
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.description')}</label>
                                        <input
                                            type="text"
                                            value={item.description}
                                            onChange={e => {
                                                updateItem(index, 'description', e.target.value);
                                                // Reset catalog flag when user manually types (must re-select or create)
                                                if (item.fromCatalog) updateItem(index, 'fromCatalog', false);
                                                searchProducts(e.target.value, index);
                                            }}
                                            onBlur={() => { handleBlur('items'); dismissSuggestions(); }}
                                            className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#065F46] ${
                                                item.description.trim() !== '' && !item.fromCatalog && submitted
                                                    ? 'border-red-400 bg-red-50'
                                                    : item.description.trim() === '' && touched.items
                                                        ? 'border-amber-400'
                                                        : 'border-gray-200'
                                            }`}
                                            placeholder={t('devis.descriptionPlaceholder', 'Type to search products...')}
                                            autoComplete="off"
                                        />
                                        {/* Product suggestions dropdown */}
                                        {activeItemIndex === index && suggestions.length > 0 && (
                                            <div ref={suggestionsRef} className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                                {suggestions.map(product => (
                                                    <button
                                                        key={product.id}
                                                        type="button"
                                                        onMouseDown={() => selectProduct(product, index)}
                                                        className="w-full px-3 py-2 text-left hover:bg-[#065F46]/5 flex justify-between items-center text-sm border-b border-gray-50 last:border-0"
                                                    >
                                                        <div>
                                                            <span className="font-medium text-gray-900">{product.name}</span>
                                                            {product.description && (
                                                                <span className="text-gray-400 ml-1 text-xs">— {product.description}</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[#065F46] font-medium text-xs whitespace-nowrap ml-2">
                                                            {product.defaultUnitPrice.toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}
                                                        </span>
                                                    </button>
                                                ))}
                                                {/* Create new product option */}
                                                <button
                                                    type="button"
                                                    onMouseDown={() => openCreateProduct(index)}
                                                    className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 flex items-center text-sm font-medium text-emerald-700 border-t border-gray-100"
                                                >
                                                    <PackagePlus size={16} className="mr-2" />
                                                    {t('product.createNew', 'Create New Product')}...
                                                </button>
                                            </div>
                                        )}
                                        {/* Show create option when no suggestions and user typed ≥2 chars */}
                                        {activeItemIndex === index && suggestions.length === 0 && item.description.length >= 2 && (
                                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg">
                                                <button
                                                    type="button"
                                                    onMouseDown={() => openCreateProduct(index)}
                                                    className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 flex items-center text-sm font-medium text-emerald-700"
                                                >
                                                    <PackagePlus size={16} className="mr-2" />
                                                    {t('product.createNew', 'Create New Product')}: &quot;{item.description}&quot;
                                                </button>
                                            </div>
                                        )}
                                        {/* Unresolved item hint */}
                                        {item.description.trim() !== '' && !item.fromCatalog && submitted && (
                                            <p className="text-xs text-red-600 mt-1">
                                                {t('deliveryNote.messages.productNotInCatalog', 'Select from catalog or create a new product')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">
                                            Qty {item.remainingQuantity > 0 && (
                                                <span className="text-[#065F46]">(quoted: {item.remainingQuantity})</span>
                                            )}
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                            className={`w-full px-3 py-2 border rounded-lg text-right focus:ring-2 focus:ring-[#065F46] ${exceedsRemaining ? 'border-amber-400 bg-amber-50' :
                                                    item.quantity <= 0 ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                                }`}
                                        />
                                        {exceedsRemaining && (
                                            <p className="text-xs text-amber-600 mt-1">{t('deliveryNote.messages.exceedsQuote')}</p>
                                        )}
                                    </div>
                                    <div className="col-span-1 md:col-span-1 text-center flex items-center justify-center h-full pb-3">
                                        {item.quotedQuantity > 0 && (
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                / {item.quotedQuantity}
                                            </span>
                                        )}
                                    </div>
                                    <div className="col-span-2 md:col-span-1 flex justify-end">
                                        <button onClick={() => removeItem(index)} className="p-2 text-gray-400 hover:text-red-500 border md:border-0 rounded-lg md:rounded-none bg-white md:bg-transparent w-full md:w-auto flex justify-center">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button onClick={addItem} className="mt-4 flex items-center text-sm font-semibold text-[#065F46]">
                        <Plus size={18} className="mr-1" /> {t('invoice.addItem')}
                    </button>
                </div>
            </div>

            {/* Create Product Modal */}
            {showCreateProduct && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateProduct(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <PackagePlus size={20} className="mr-2 text-emerald-600" />
                                {t('product.createNew', 'Create New Product')}
                            </h3>
                            <button onClick={() => setShowCreateProduct(false)} className="p-1 hover:bg-gray-100 rounded-full">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('product.name', 'Product Name')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newProduct.name}
                                    onChange={e => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder={t('product.namePlaceholder', 'e.g. Web Design Service')}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('product.description', 'Description')}
                                </label>
                                <input
                                    type="text"
                                    value={newProduct.description}
                                    onChange={e => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder={t('product.descriptionPlaceholder', 'Optional details...')}
                                />
                            </div>
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
                                            value={newProduct.defaultUnitPrice}
                                            onChange={e => setNewProduct(prev => ({ ...prev, defaultUnitPrice: parseFloat(e.target.value) || 0 }))}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none pr-14"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('product.tax', 'Tax (TVA)')}
                                    </label>
                                    <select
                                        value={newProduct.vatRate}
                                        onChange={e => setNewProduct(prev => ({ ...prev, vatRate: parseInt(e.target.value) }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value={0}>{t('invoice.noTax', 'No Tax')}</option>
                                        <option value={7}>TVA 7%</option>
                                        <option value={13}>TVA 13%</option>
                                        <option value={19}>TVA 19%</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                            <button
                                onClick={() => setShowCreateProduct(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleCreateProduct}
                                disabled={!newProduct.name.trim() || creatingProduct}
                                className="px-5 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check size={16} className="mr-1.5" />
                                {creatingProduct ? t('common.creating', 'Creating...') : t('product.createAndUse', 'Create & Use')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

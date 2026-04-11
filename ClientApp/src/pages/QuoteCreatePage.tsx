import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Save, FileText, AlertCircle, PackagePlus, X, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { DEFAULT_CURRENCY, CURRENCY_OPTIONS, getCurrencySymbol } from '../lib/currencyUtils';

interface Client {
    id: number;
    name: string;
}

interface QuoteItem {
    description: string;
    quantity: number;
    price: number;
    tva: boolean;
    vatRate: number; // actual rate as percentage (e.g. 19, 7, 0)
    fromCatalog?: boolean; // true when selected from product catalog or created inline
    productServiceId?: number; // link to catalog product for inventory tracking
    isStockTracked?: boolean;
    currentStock?: number;
}

// Validation errors interface
interface ValidationErrors {
    clientId?: string;
    date?: string;
    items?: string;
}

// Company settings for tax configuration
interface TaxSettings {
    customTaxEnabled: boolean;
    customTaxName: string;
    customTaxAmount: number;
    defaultVatRate: number; // as decimal, e.g. 0.19
    availableVatRates: number[]; // as percentages [0, 7, 13, 19]
}

interface ProductSuggestion {
    id: number;
    name: string;
    description?: string;
    defaultUnitPrice: number;
    vatApplicable: boolean;
    tvaRate?: number;
    isStockTracked?: boolean;
    currentStock?: number;
}

export default function QuoteCreatePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const { id: editId } = useParams<{ id: string }>();
    const isEditMode = !!editId;
    const [loading, setLoading] = useState(false);
    const [loadingQuote, setLoadingQuote] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [submitted, setSubmitted] = useState(false);
    const [taxSettings, setTaxSettings] = useState<TaxSettings>({ customTaxEnabled: true, customTaxName: 'Timbre Fiscal', customTaxAmount: 1.0, defaultVatRate: 0.19, availableVatRates: [0, 7, 13, 19] });

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
    const [clientId, setClientId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [quoteNumber, setQuoteNumber] = useState('');
    const [lastQuoteNumber, setLastQuoteNumber] = useState('');
    const [suggestedQuoteNumber, setSuggestedQuoteNumber] = useState('');
    const [items, setItems] = useState<QuoteItem[]>([
        { description: '', quantity: 1, price: 0, tva: true, vatRate: 19, fromCatalog: false }
    ]);

    useEffect(() => {
        fetchClients();
        if (!isEditMode) {
            fetchLastQuoteNumber();
        }
        const fetchTaxSettings = async () => {
            try {
                const res = await api.get('/Settings');
                // Parse available VAT rates from JSON string
                let vatRates = [0, 7, 13, 19];
                try {
                    if (res.data.availableVatRates) {
                        vatRates = JSON.parse(res.data.availableVatRates);
                    }
                } catch { /* keep defaults */ }

                const defaultRate = res.data.defaultVatRate ?? 0.19;
                const defaultRateInt = Math.round(defaultRate * 100);
                // Sort so default rate appears first in dropdown
                const sortedRates = [...vatRates].sort((a, b) => {
                    if (a === defaultRateInt) return -1;
                    if (b === defaultRateInt) return 1;
                    return b - a; // descending for the rest
                });
                setTaxSettings({
                    customTaxEnabled: res.data.customTaxEnabled ?? true,
                    customTaxName: res.data.customTaxName || 'Timbre Fiscal',
                    customTaxAmount: res.data.customTaxAmount ?? 1.0,
                    defaultVatRate: defaultRate,
                    availableVatRates: sortedRates
                });
                // Update existing items default vatRate if they still have 19 (initial default)
                setItems(prev => prev.map(item => ({
                    ...item,
                    vatRate: item.vatRate === 19 ? defaultRateInt : item.vatRate
                })));
                // Initialize per-document currency & language from company defaults
                if (!pdfCurrency) {
                    setPdfCurrency(res.data.currency || DEFAULT_CURRENCY);
                    setPdfCurrencySymbol(res.data.currencySymbol || getCurrencySymbol(res.data.currency) || DEFAULT_CURRENCY);
                }
                if (!pdfLanguage) {
                    setPdfLanguage(res.data.invoiceLanguage || 'fr');
                }
            } catch (error) {
                logger.error("Error fetching tax settings", error);
            }
        };
        fetchTaxSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch quote data for edit mode
    useEffect(() => {
        const fetchQuoteForEdit = async (quoteId: number) => {
            setLoadingQuote(true);
            try {
                const res = await api.get(`/Quotes/${quoteId}`);
                const q = res.data;
                setQuoteNumber(q.number || '');
                setDate(q.date ? new Date(q.date).toISOString().split('T')[0] : '');
                setClientId(q.clientId?.toString() || '');
                if (q.currency) setPdfCurrency(q.currency);
                if (q.currencySymbol) setPdfCurrencySymbol(q.currencySymbol);
                if (q.pdfLanguage) setPdfLanguage(q.pdfLanguage);
                setItems(
                    q.quoteItems && q.quoteItems.length > 0
                        ? q.quoteItems.map((item: { description?: string; quantity?: number; price?: number; tva?: boolean; vatRate?: number; productServiceId?: number }) => ({
                            description: item.description || '',
                            quantity: item.quantity || 1,
                            price: item.price || 0,
                            tva: item.tva ?? true,
                            vatRate: item.vatRate != null ? Math.round(item.vatRate * 100) : 19,
                            fromCatalog: true,
                            productServiceId: item.productServiceId
                        }))
                        : [{ description: '', quantity: 1, price: 0, tva: true, vatRate: 19, fromCatalog: false }]
                );
            } catch (error) {
                logger.error('Error fetching quote for edit', error);
                notify('error', t('quote.editLoadFailed', 'Failed to load quote'));
                navigate('/quotes');
            } finally {
                setLoadingQuote(false);
            }
        };
        if (isEditMode && editId) {
            fetchQuoteForEdit(parseInt(editId));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, editId]);

    const fetchClients = async () => {
        try {
            const res = await api.get('/Clients?size=9999');
            const data = res.data;
            setClients(Array.isArray(data) ? data : (data.data || []));
        } catch (error) {
            logger.error("Error fetching clients", error);
        }
    };

    const fetchLastQuoteNumber = async () => {
        try {
            const res = await api.get('/Quotes/last-number');
            setLastQuoteNumber(res.data.lastNumber || '');
            setSuggestedQuoteNumber(res.data.suggestedNumber || '');
            setQuoteNumber(res.data.suggestedNumber || '');
        } catch (error) {
            logger.error('Error fetching last quote number', error);
        }
    };

    // Validate form
    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};

        if (!clientId) {
            newErrors.clientId = 'Client is required';
        }

        if (!date) {
            newErrors.date = 'Date is required';
        }

        const validItems = items.filter(item => item.description.trim() !== '');
        if (validItems.length === 0) {
            newErrors.items = 'At least one item with description is required';
        }

        const hasInvalidItems = items.some(item =>
            (item.description.trim() && (item.quantity <= 0 || item.price < 0))
        );
        if (hasInvalidItems) {
            newErrors.items = 'Items must have positive quantity and non-negative price';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Mark field as touched
    const handleBlur = (field: string) => {
        setTouched(prev => ({ ...prev, [field]: true }));
    };

    const addItem = () => {
        const defaultRate = Math.round(taxSettings.defaultVatRate * 100);
        setItems([...items, { description: '', quantity: 1, price: 0, tva: true, vatRate: defaultRate, fromCatalog: false }]);
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
        const defaultRate = Math.round(taxSettings.defaultVatRate * 100);
        const productRate = product.tvaRate != null ? Math.round(product.tvaRate) : defaultRate;
        const newItems = [...items];
        newItems[itemIndex] = {
            ...newItems[itemIndex],
            description: product.name + (product.description ? ` - ${product.description}` : ''),
            price: product.defaultUnitPrice,
            tva: product.vatApplicable,
            vatRate: product.vatApplicable ? productRate : 0,
            fromCatalog: true,
            productServiceId: product.id,
            isStockTracked: product.isStockTracked,
            currentStock: product.currentStock,
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
        const defaultRate = Math.round(taxSettings.defaultVatRate * 100);
        const currentDesc = items[itemIndex]?.description || '';
        setNewProduct({ name: currentDesc, description: '', defaultUnitPrice: 0, vatRate: defaultRate });
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
            // Auto-fill the line item
            const newItems = [...items];
            newItems[createProductForIndex] = {
                ...newItems[createProductForIndex],
                description: created.name + (created.description ? ` - ${created.description}` : ''),
                price: created.defaultUnitPrice,
                tva: created.vatApplicable,
                vatRate: created.vatApplicable ? newProduct.vatRate : 0,
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

    const removeItem = (index: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof QuoteItem, value: string | number | boolean) => {
        const newItems = [...items];
        const current = newItems[index];
        if (!current) return;

        if (field === 'description') {
            newItems[index] = { ...current, description: String(value), fromCatalog: false };
        } else if (field === 'quantity') {
            newItems[index] = { ...current, quantity: Number(value) };
        } else if (field === 'price') {
            newItems[index] = { ...current, price: Number(value) };
        } else if (field === 'tva') {
            newItems[index] = { ...current, tva: Boolean(value) };
        } else if (field === 'vatRate') {
            newItems[index] = { ...current, vatRate: Number(value) };
        } else if (field === 'fromCatalog') {
            newItems[index] = { ...current, fromCatalog: Boolean(value) };
        }

        setItems(newItems);
    };

    const calculateSubtotal = () => {
        return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    };

    const calculateTotal = () => {
        const taxAmount = taxSettings.customTaxEnabled ? taxSettings.customTaxAmount : 0;
        return items.reduce((sum, item) => {
            const lineTotal = item.quantity * item.price;
            const taxRate = item.tva ? (item.vatRate / 100) : 0;
            const tvaAmount = lineTotal * taxRate;
            return sum + lineTotal + tvaAmount;
        }, taxAmount); // Use configurable tax amount
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
            // Auto-create products for items not from catalog
            const validItems = items.filter(item => item.description.trim() !== '');
            const createdProducts: string[] = [];
            for (let i = 0; i < validItems.length; i++) {
                const item = validItems[i];
                if (!item.fromCatalog && item.description.trim()) {
                    try {
                        await api.post('/ProductServices', {
                            name: item.description.trim(),
                            description: null,
                            defaultUnitPrice: item.price,
                            tvaRate: item.tva ? item.vatRate : 0,
                            type: 'product',
                            category: null,
                            vatApplicable: item.tva,
                        });
                        createdProducts.push(item.description.trim());
                    } catch {
                        // Product may already exist — continue with quote creation
                    }
                }
            }

            const payload = {
                number: quoteNumber.trim(),
                date: new Date(date),
                clientId: parseInt(clientId),
                currency: pdfCurrency || undefined,
                currencySymbol: pdfCurrencySymbol || undefined,
                pdfLanguage: pdfLanguage || undefined,
                items: items
                    .filter(item => item.description.trim() !== '')
                    .map(item => ({
                        description: item.description.trim(),
                        quantity: item.quantity,
                        price: item.price,
                        tva: item.tva,
                        vatRate: item.tva ? item.vatRate / 100 : 0,
                        productServiceId: item.productServiceId || null
                    }))
            };

            if (isEditMode && editId) {
                await api.put(`/Quotes/${editId}`, payload);
            } else {
                await api.post('/Quotes', payload);
            }
            await queryClient.invalidateQueries({ queryKey: ['quotes'] });
            await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            navigate('/quotes');
        } catch (error: unknown) {
            logger.error("Error creating quote", error);
            // Show the real server error reason (e.g. stock / validation failure)
            const axErr = error as { response?: { data?: { message?: string; title?: string; errors?: Record<string, string[]> } } };
            const serverMsg = axErr?.response?.data?.message
                || axErr?.response?.data?.title
                || (axErr?.response?.data?.errors ? Object.values(axErr.response.data.errors).flat().join('; ') : null);
            notify('error', serverMsg || t('quote.createFailed', 'Failed to create quote'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-0">
            <NotifyBanner />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start space-x-4">
                    <button onClick={() => navigate('/quotes')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? t('quote.editQuote', 'Edit Quote') : t('quote.newQuote')}</h1>
                        <p className="text-gray-500 text-sm">{isEditMode ? `${t('quote.title')} #${quoteNumber}` : t('quote.title')}</p>
                    </div>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={loading || loadingQuote}
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-xl shadow-lg hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={20} className="mr-2" />
                    {loading ? t('common.saving') : isEditMode ? t('common.save') : t('invoice.save')}
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-8 animate-fade-in text-gray-800">
                {/* Validation Summary */}
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

                {/* Currency & Language Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-purple-600/5 border border-purple-600/10 rounded-xl">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('createPage.documentCurrency')}</label>
                        <select
                            value={pdfCurrency}
                            onChange={e => {
                                setPdfCurrency(e.target.value);
                                setPdfCurrencySymbol(getCurrencySymbol(e.target.value));
                            }}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                        >
                            {CURRENCY_OPTIONS.map(opt => (
                                <option key={opt.code} value={opt.code}>{opt.label}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">{t('createPage.currencyHelp')}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('createPage.pdfLanguage')}</label>
                        <select
                            value={pdfLanguage}
                            onChange={e => setPdfLanguage(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                        >
                            <option value="fr">{t('language.fr')}</option>
                            <option value="en">{t('language.en')}</option>
                            <option value="de">{t('language.de')}</option>
                            <option value="ar">{t('language.ar')}</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">{t('createPage.languageHelp')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('quote.quoteNumber')}
                        </label>
                        <input
                            type="text"
                            value={quoteNumber}
                            onChange={e => setQuoteNumber(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                        {(lastQuoteNumber || suggestedQuoteNumber) && (
                            <p className="text-xs text-gray-500 mt-1">
                                {lastQuoteNumber && <span>{t('createPage.lastInvoice')} <span className="font-medium text-purple-600">{lastQuoteNumber}</span></span>}
                                {suggestedQuoteNumber && (
                                    <span> — {t('createPage.suggested')} <span className="font-medium text-green-600">{suggestedQuoteNumber}</span></span>
                                )}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Client <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={clientId}
                            onChange={e => setClientId(e.target.value)}
                            onBlur={() => handleBlur('clientId')}
                            className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none ${errors.clientId && submitted ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                }`}
                        >
                            <option value="">{t('createPage.selectClient')}</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                        {errors.clientId && submitted && (
                            <p className="text-xs text-red-600 mt-1">{errors.clientId}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quote Date <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            onBlur={() => handleBlur('date')}
                            className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none ${errors.date && submitted ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                }`}
                        />
                        {errors.date && submitted && (
                            <p className="text-xs text-red-600 mt-1">{errors.date}</p>
                        )}
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center mb-4">
                        <FileText className="mr-2 text-purple-600" size={20} />
                        Quote Items <span className="text-red-500 ml-1">*</span>
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
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-2 md:grid-cols-12 gap-4 items-end p-4 md:p-0 bg-gray-50 md:bg-white rounded-xl md:rounded-none border border-gray-100 md:border-0 mb-4 md:mb-0">
                                <div className="col-span-2 md:col-span-5 relative">
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.description')}</label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={e => {
                                            updateItem(index, 'description', e.target.value);
                                            searchProducts(e.target.value, index);
                                        }}
                                        onBlur={() => { handleBlur('items'); dismissSuggestions(); }}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none ${item.description.trim() === '' && touched.items ? 'border-amber-400' : 'border-gray-200'
                                            }`}
                                        placeholder={t('quote.descriptionPlaceholder', 'Type to search products...')}
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
                                                    className="w-full px-3 py-2 text-left hover:bg-purple-600/5 flex justify-between items-center text-sm border-b border-gray-50 last:border-0"
                                                >
                                                    <div>
                                                        <span className="font-medium text-gray-900">{product.name}</span>
                                                        {product.description && (
                                                            <span className="text-gray-400 ml-1 text-xs">— {product.description}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-right ml-2">
                                                        <span className="text-purple-600 font-medium text-xs whitespace-nowrap">
                                                            {product.defaultUnitPrice.toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}
                                                        </span>
                                                        {product.isStockTracked && (
                                                            <span className={`block text-[10px] ${(product.currentStock ?? 0) <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                                {t('inventory.currentStock', 'Stock')}: {product.currentStock ?? 0}
                                                            </span>
                                                        )}
                                                    </div>
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
                                                {t('product.createNew', 'Create New Product')}: "{item.description}"
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.qty')}</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                        className={`w-full px-3 py-2 border rounded-lg text-right focus:ring-2 focus:ring-purple-500 outline-none ${item.quantity <= 0 && item.description.trim() ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                            }`}
                                    />
                                    {item.isStockTracked && item.quantity > (item.currentStock ?? 0) && (
                                        <p className="text-[10px] text-amber-600 mt-0.5">
                                            {t('inventory.stockWarning', 'Low stock: {{available}} available', { available: item.currentStock ?? 0 })}
                                        </p>
                                    )}
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.price')}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        value={item.price}
                                        onChange={e => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                                        className={`w-full px-3 py-2 border rounded-lg text-right focus:ring-2 focus:ring-purple-500 outline-none ${item.price < 0 && item.description.trim() ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                            }`}
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2 flex items-center space-x-2">
                                    <label className="md:hidden text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.tax')}</label>
                                    <select
                                        value={item.tva ? item.vatRate : 0}
                                        onChange={e => {
                                            const rate = parseInt(e.target.value);
                                            const newItems = [...items];
                                            newItems[index].tva = rate > 0;
                                            newItems[index].vatRate = rate;
                                            setItems(newItems);
                                        }}
                                        className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                                    >
                                        {taxSettings.availableVatRates.map(rate => (
                                            <option key={rate} value={rate}>
                                                {rate === 0 ? t('invoice.tax', 'TVA') + ' 0%' : `TVA ${rate}%`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-1 md:col-span-1 flex justify-end">
                                    <button onClick={() => removeItem(index)} className="p-2 text-gray-400 hover:text-red-500 border md:border-0 rounded-lg md:rounded-none bg-white md:bg-transparent">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button onClick={addItem} className="mt-4 flex items-center text-sm font-semibold text-purple-600">
                        <Plus size={18} className="mr-1" /> {t('invoice.addItem')}
                    </button>
                </div>

                <div className="border-t border-gray-100 pt-6 flex justify-end">
                    <div className="w-full md:w-1/3 space-y-3">
                        <div className="flex justify-between text-gray-600">
                            <span>{t('invoice.subtotal')}:</span>
                            <span>{calculateSubtotal().toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>{t('invoice.tax')}:</span>
                            <span>{(calculateTotal() - calculateSubtotal()).toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                        </div>
                        <div className="border-t border-gray-200 pt-3 flex justify-between text-xl font-bold text-gray-900">
                            <span>{t('invoice.total')}:</span>
                            <span className="text-purple-600">{calculateTotal().toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                        </div>
                    </div>
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
                                        {taxSettings.availableVatRates.map(rate => (
                                            <option key={rate} value={rate}>
                                                {rate === 0 ? t('invoice.noTax') : `${t('invoice.tax')} ${rate}%`}
                                            </option>
                                        ))}
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

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Save, FileText, Truck, User, Calendar, Package, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { DEFAULT_CURRENCY, CURRENCY_OPTIONS, getCurrencySymbol } from '../lib/currencyUtils';

interface Client {
    id: number;
    name: string;
}

interface DeliveryNoteItem {
    id: number;
    description: string;
    quantity: number;
}

interface DeliveryNote {
    id: number;
    number: string;
    date: string;
    clientName?: string;
    totalAmount: number;
    devisId?: number;
    createdByUser?: { email?: string; userName?: string; firstName?: string; lastName?: string };
    createdByUserId?: string;
    deliveryNoteItems?: DeliveryNoteItem[];
}

interface InvoiceItem {
    description: string;
    quantity: number;
    price: number;
    tva: boolean;
    vatRate: number; // actual rate as percentage (e.g. 19, 7, 0)
    fromCatalog?: boolean; // true when selected from product catalog, quote, or delivery note
}

interface DevisItem {
    description: string;
    quantity: number;
    price: number;
    tva: boolean;
}

interface Devis {
    id: number;
    number: string;
    clientId: number;
    clientName: string;
    status: string;
    totalAmount: number;
    devisItems?: DevisItem[];
}

// Validation errors interface
interface ValidationErrors {
    clientId?: string;
    invoiceNumber?: string;
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
}

export default function InvoiceCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { id: editId } = useParams<{ id: string }>();
    const isEditMode = !!editId;
    const [loading, setLoading] = useState(false);
    const [loadingInvoice, setLoadingInvoice] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [quotes, setQuotes] = useState<Devis[]>([]);
    const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
    const [selectedDeliveryNoteIds, setSelectedDeliveryNoteIds] = useState<number[]>([]);
    const [selectedQuoteData, setSelectedQuoteData] = useState<Devis | null>(null);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [submitted, setSubmitted] = useState(false);
    const [taxSettings, setTaxSettings] = useState<TaxSettings>({ customTaxEnabled: true, customTaxName: 'Timbre Fiscal', customTaxAmount: 1.0, defaultVatRate: 0.19, availableVatRates: [0, 7, 13, 19] });

    // Product autocomplete state
    const [prodSuggestions, setProdSuggestions] = useState<ProductSuggestion[]>([]);
    const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Currency & Language state (per-document override)
    const [pdfCurrency, setPdfCurrency] = useState('');
    const [pdfCurrencySymbol, setPdfCurrencySymbol] = useState('');
    const [pdfLanguage, setPdfLanguage] = useState('');

    // Form State
    const [clientId, setClientId] = useState('');
    const [selectedQuoteId, setSelectedQuoteId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [lastInvoiceNumber, setLastInvoiceNumber] = useState('');
    const [suggestedNumber, setSuggestedNumber] = useState('');
    const [items, setItems] = useState<InvoiceItem[]>([
        { description: '', quantity: 1, price: 0, tva: true, vatRate: 19, fromCatalog: false }
    ]);

    // Calculate aggregated quantities from selected delivery notes
    const deliveredQuantitiesByDescription = useMemo(() => {
        const quantityMap: Record<string, number> = {};

        deliveryNotes
            .filter(dn => selectedDeliveryNoteIds.includes(dn.id))
            .forEach(dn => {
                dn.deliveryNoteItems?.forEach(item => {
                    const key = item.description.toLowerCase().trim();
                    quantityMap[key] = (quantityMap[key] || 0) + (item.quantity || 0);
                });
            });

        return quantityMap;
    }, [deliveryNotes, selectedDeliveryNoteIds]);

    // Validate form fields
    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};

        if (!clientId) {
            newErrors.clientId = t('createPage.clientRequired');
        }

        if (!invoiceNumber.trim()) {
            newErrors.invoiceNumber = t('createPage.numberRequired');
        }

        if (!date) {
            newErrors.date = t('createPage.dateRequired');
        }

        const validItems = items.filter(item => item.description.trim() !== '');
        if (validItems.length === 0) {
            newErrors.items = t('createPage.itemsRequired');
        }

        const hasInvalidItems = items.some(item =>
            (item.description.trim() && (item.quantity <= 0 || item.price < 0))
        );
        if (hasInvalidItems) {
            newErrors.items = t('createPage.itemsInvalid');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Mark field as touched on blur
    const handleBlur = (field: string) => {
        setTouched(prev => ({ ...prev, [field]: true }));
    };

    useEffect(() => {
        fetchClients();
        fetchTaxSettings();
        if (!isEditMode) {
            fetchLastInvoiceNumber();
        }
    }, []);

    // Fetch invoice data for edit mode
    useEffect(() => {
        if (isEditMode && editId) {
            fetchInvoiceForEdit(parseInt(editId));
        }
    }, [editId]);

    const fetchInvoiceForEdit = async (invoiceId: number) => {
        setLoadingInvoice(true);
        try {
            const res = await api.get(`/Invoices/${invoiceId}/details`);
            const inv = res.data;
            setInvoiceNumber(inv.number || '');
            setDate(inv.date ? new Date(inv.date).toISOString().split('T')[0] : '');
            setClientId(inv.clientId?.toString() || '');
            if (inv.devisId) setSelectedQuoteId(inv.devisId.toString());
            // Load per-document currency/language if available
            if (inv.currency) setPdfCurrency(inv.currency);
            if (inv.currencySymbol) setPdfCurrencySymbol(inv.currencySymbol);
            if (inv.pdfLanguage) setPdfLanguage(inv.pdfLanguage);
            setItems(
                inv.items && inv.items.length > 0
                    ? inv.items.map((item: any) => ({
                        description: item.description || '',
                        quantity: item.quantity || 1,
                        price: item.unitPrice || 0,
                        tva: (item.vat ?? 0) > 0,
                        vatRate: (item.vat ?? 0) > 0 ? Math.round((item.vatRate ?? item.vat ?? 0.19) * 100) : 0,
                        fromCatalog: true
                    }))
                    : [{ description: '', quantity: 1, price: 0, tva: true, vatRate: Math.round((taxSettings.defaultVatRate) * 100), fromCatalog: false }]
            );
        } catch (error) {
            console.error('Error fetching invoice for edit', error);
            alert(t('createPage.loadFailed'));
            navigate('/invoices');
        } finally {
            setLoadingInvoice(false);
        }
    };

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
                vatRate: item.vatRate === 19 ? Math.round(defaultRate * 100) : item.vatRate
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
            console.error("Error fetching tax settings", error);
        }
    };

    const fetchLastInvoiceNumber = async () => {
        try {
            const res = await api.get('/Invoices/last-number');
            setLastInvoiceNumber(res.data.lastNumber || '');
            setSuggestedNumber(res.data.suggestedNumber || '');
            setInvoiceNumber(res.data.suggestedNumber || '');
        } catch (error) {
            console.error("Error fetching last invoice number", error);
        }
    };

    const fetchClients = async () => {
        try {
            const res = await api.get('/Clients');
            setClients(res.data);
        } catch (error) {
            console.error("Error fetching clients", error);
        }
    };

    const fetchQuotesForClient = async (cid: string) => {
        if (!cid) {
            setQuotes([]);
            return;
        }
        try {
            const res = await api.get('/Devis');
            const allDevis = Array.isArray(res.data) ? res.data : (res.data.data || []);
            // Filter to only show Draft or Accepted status quotes for this client
            const clientQuotes = allDevis.filter((d: any) =>
                (d.status === 'Draft' || d.status === 'Accepted') &&
                !d.isDeleted &&
                !d.treated &&
                d.clientId === parseInt(cid)
            );
            setQuotes(clientQuotes);
        } catch (error) {
            console.error("Error fetching devis", error);
        }
    };

    const fetchDeliveryNotesForQuote = async (quoteId: string) => {
        if (!quoteId) {
            setDeliveryNotes([]);
            setSelectedDeliveryNoteIds([]);
            return;
        }
        try {
            const res = await api.get('/DeliveryNotes');
            let allNotes: any[] = [];
            if (Array.isArray(res.data)) {
                allNotes = res.data;
            } else if (res.data?.Data) {
                allNotes = res.data.Data;
            } else if (res.data?.data) {
                allNotes = res.data.data;
            }

            // Filter delivery notes linked to this quote that don't have an invoice yet
            const linkedNoteIds = allNotes
                .filter((dn: any) => dn.devisId === parseInt(quoteId) && !dn.invoiceId)
                .map((dn: any) => dn.id);

            // Fetch full details for each delivery note to get items and creator info
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

            const validNotes = detailedNotes.filter(Boolean) as DeliveryNote[];
            setDeliveryNotes(validNotes);
            // Auto-select all linked delivery notes
            setSelectedDeliveryNoteIds(validNotes.map(dn => dn.id));
        } catch (error) {
            console.error("Error fetching delivery notes", error);
        }
    };

    const handleClientChange = (cid: string) => {
        setClientId(cid);
        setSelectedQuoteId('');
        setSelectedQuoteData(null);
        setSelectedDeliveryNoteIds([]);
        setDeliveryNotes([]);
        setTouched(prev => ({ ...prev, clientId: true }));
        fetchQuotesForClient(cid);
    };

    const handleDeliveryNoteToggle = (dnId: number) => {
        setSelectedDeliveryNoteIds(prev =>
            prev.includes(dnId)
                ? prev.filter(id => id !== dnId)
                : [...prev, dnId]
        );
    };

    // Auto-update items based on selected delivery notes and quote prices
    const updateItemsFromDeliveryNotes = (quoteData: Devis | null, selectedDNIds: number[]) => {
        if (!quoteData?.devisItems || selectedDNIds.length === 0) {
            return;
        }

        // Calculate aggregated delivered quantities
        const deliveredQty: Record<string, number> = {};
        deliveryNotes
            .filter(dn => selectedDNIds.includes(dn.id))
            .forEach(dn => {
                dn.deliveryNoteItems?.forEach(item => {
                    const key = item.description.toLowerCase().trim();
                    deliveredQty[key] = (deliveredQty[key] || 0) + (item.quantity || 0);
                });
            });

        // Map quote items with delivered quantities
        const newItems: InvoiceItem[] = quoteData.devisItems
            .filter(qi => {
                const key = qi.description.toLowerCase().trim();
                return deliveredQty[key] && deliveredQty[key] > 0;
            })
            .map(qi => {
                const key = qi.description.toLowerCase().trim();
                return {
                    description: qi.description,
                    quantity: deliveredQty[key] || qi.quantity,
                    price: qi.price,
                    tva: qi.tva,
                    vatRate: qi.tva ? Math.round(taxSettings.defaultVatRate * 100) : 0,
                    fromCatalog: true
                };
            });

        if (newItems.length > 0) {
            setItems(newItems);
        }
    };

    // When delivery note selection changes, update items
    useEffect(() => {
        if (selectedQuoteData && selectedDeliveryNoteIds.length > 0) {
            updateItemsFromDeliveryNotes(selectedQuoteData, selectedDeliveryNoteIds);
        }
    }, [selectedDeliveryNoteIds, selectedQuoteData, deliveryNotes]);

    const handleQuoteSelection = async (qid: string) => {
        setSelectedQuoteId(qid);
        if (!qid) {
            setSelectedQuoteData(null);
            setDeliveryNotes([]);
            setSelectedDeliveryNoteIds([]);
            return;
        }

        try {
            const res = await api.get(`/Devis/${qid}`);
            const quote = res.data;
            setSelectedQuoteData(quote);

            // Pre-fill items from quote
            if (quote.devisItems && quote.devisItems.length > 0) {
                setItems(quote.devisItems.map((item: any) => ({
                    description: item.description,
                    quantity: item.quantity,
                    price: item.price,
                    tva: item.tva,
                    vatRate: item.tva ? Math.round((item.vatRate ?? taxSettings.defaultVatRate) * 100) : 0,
                    fromCatalog: true
                })));
            }

            // Fetch delivery notes linked to this quote
            await fetchDeliveryNotesForQuote(qid);
        } catch (error) {
            console.error("Error fetching quote details", error);
        }
    };

    const addItem = () => {
        setItems([...items, { description: '', quantity: 1, price: 0, tva: true, vatRate: Math.round(taxSettings.defaultVatRate * 100), fromCatalog: false }]);
    };

    // Product autocomplete: search saved products as user types
    const searchProducts = useCallback((query: string, itemIndex: number) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (query.length < 2) {
            setProdSuggestions([]);
            setActiveItemIdx(null);
            return;
        }
        searchTimerRef.current = setTimeout(async () => {
            try {
                const res = await api.get(`/ProductServices/search?q=${encodeURIComponent(query)}`);
                const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
                setProdSuggestions(data.slice(0, 8));
                setActiveItemIdx(itemIndex);
            } catch { setProdSuggestions([]); }
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
        };
        setItems(newItems);
        setProdSuggestions([]);
        setActiveItemIdx(null);
    };

    const dismissProdSuggestions = () => {
        setTimeout(() => { setProdSuggestions([]); setActiveItemIdx(null); }, 200);
    };

    const removeItem = (index: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        // Reset fromCatalog when user manually edits the description
        if (field === 'description') {
            newItems[index].fromCatalog = false;
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
            const tvaAmount = item.tva ? lineTotal * (item.vatRate / 100) : 0;
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
            const payload = {
                number: invoiceNumber.trim(),
                date: new Date(date).toISOString(),
                clientId: parseInt(clientId),
                devisId: selectedQuoteId ? parseInt(selectedQuoteId) : null,
                deliveryNoteIds: selectedDeliveryNoteIds.length > 0 ? selectedDeliveryNoteIds : null,
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
                        vatRate: item.tva ? item.vatRate / 100 : 0
                    }))
            };

            if (isEditMode && editId) {
                await api.put(`/Invoices/${editId}`, payload);
            } else {
                await api.post('/Invoices', payload);
            }
            navigate('/invoices');
        } catch (error) {
            console.error("Error creating invoice", error);
            alert(t('createPage.createFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/invoices')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? t('createPage.titleEdit') : t('createPage.titleNew')}</h1>
                        <p className="text-gray-500 text-sm">{isEditMode ? t('createPage.subtitleEdit', { number: invoiceNumber }) : t('createPage.subtitleNew')}</p>
                    </div>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={loading || loadingInvoice}
                    className="flex items-center px-6 py-3 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    <Save size={20} className="mr-2" />
                    {loading ? t('createPage.saving') : isEditMode ? t('createPage.updateButton') : t('createPage.saveButton')}
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-8 animate-fade-in">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-[#065F46]/5 border border-[#065F46]/10 rounded-xl">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('createPage.documentCurrency')}
                        </label>
                        <select
                            value={pdfCurrency}
                            onChange={e => {
                                setPdfCurrency(e.target.value);
                                setPdfCurrencySymbol(getCurrencySymbol(e.target.value));
                            }}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none transition-all"
                        >
                            {CURRENCY_OPTIONS.map(opt => (
                                <option key={opt.code} value={opt.code}>{opt.label}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">{t('createPage.currencyHelp')}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('createPage.pdfLanguage')}
                        </label>
                        <select
                            value={pdfLanguage}
                            onChange={e => setPdfLanguage(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none transition-all"
                        >
                            <option value="fr">Français</option>
                            <option value="en">English</option>
                            <option value="de">Deutsch</option>
                            <option value="ar">العربية</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">{t('createPage.languageHelp')}</p>
                    </div>
                </div>

                {/* Invoice Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('invoice.invoiceNumber')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={invoiceNumber}
                            onChange={e => setInvoiceNumber(e.target.value)}
                            onBlur={() => handleBlur('invoiceNumber')}
                            className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none transition-all ${errors.invoiceNumber && submitted ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                }`}
                            placeholder={t('createPage.enterNumber')}
                            required
                        />
                        {errors.invoiceNumber && submitted && (
                            <p className="text-xs text-red-600 mt-1">{errors.invoiceNumber}</p>
                        )}
                        {lastInvoiceNumber && !errors.invoiceNumber && (
                            <p className="text-xs text-gray-500 mt-1">
                                {t('createPage.lastInvoice')} <span className="font-medium text-[#065F46]">{lastInvoiceNumber}</span>
                                {suggestedNumber && (
                                    <span> — {t('createPage.suggested')} <span className="font-medium text-green-600">{suggestedNumber}</span></span>
                                )}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('common.client')} <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={clientId}
                            onChange={e => handleClientChange(e.target.value)}
                            onBlur={() => handleBlur('clientId')}
                            className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none transition-all ${errors.clientId && submitted ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                }`}
                            required
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('createPage.linkQuote')}</label>
                        <select
                            value={selectedQuoteId}
                            onChange={e => handleQuoteSelection(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none transition-all"
                            disabled={!clientId}
                        >
                            <option value="">{t('createPage.noQuoteSelected')}</option>
                            {quotes.map(quote => (
                                <option key={quote.id} value={quote.id}>
                                    {t('createPage.selectQuote', { number: quote.number, amount: (quote.totalAmount || 0).toLocaleString() + ' ' + (pdfCurrencySymbol || DEFAULT_CURRENCY) })}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('createPage.invoiceDate')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            onBlur={() => handleBlur('date')}
                            className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none transition-all ${errors.date && submitted ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                }`}
                            required
                        />
                        {errors.date && submitted && (
                            <p className="text-xs text-red-600 mt-1">{errors.date}</p>
                        )}
                    </div>
                </div>

                {/* Delivery Notes Selection - Enhanced with item details */}
                {selectedQuoteId && deliveryNotes.length > 0 && (
                    <div className="border-t border-gray-100 pt-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center mb-2">
                            <Truck className="mr-2 text-green-500" size={20} />
                            {t('createPage.linkedDeliveryNotes')}
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            {t('createPage.deliveryNotesHelp')}
                        </p>
                        <div className="space-y-3">
                            {deliveryNotes.map(dn => (
                                <div
                                    key={dn.id}
                                    className={`p-4 rounded-xl border transition-all ${selectedDeliveryNoteIds.includes(dn.id)
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-gray-200 bg-gray-50 hover:border-green-300'
                                        }`}
                                >
                                    <label className="flex items-start cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedDeliveryNoteIds.includes(dn.id)}
                                            onChange={() => handleDeliveryNoteToggle(dn.id)}
                                            className="form-checkbox h-5 w-5 text-green-600 rounded mt-1 mr-3"
                                        />
                                        <div className="flex-1">
                                            {/* DN Header */}
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-semibold text-gray-800">BL #{dn.number}</span>
                                                <div className="flex items-center space-x-3 text-sm text-gray-500">
                                                    <span className="flex items-center">
                                                        <Calendar size={14} className="mr-1" />
                                                        {dn.date ? new Date(dn.date).toLocaleDateString() : 'N/A'}
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
                                                <div className="mt-2 pl-2 border-l-2 border-green-200">
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                                        {dn.deliveryNoteItems.map((item, idx) => (
                                                            <div key={idx} className="flex items-center text-gray-600">
                                                                <Package size={12} className="mr-1 text-green-500" />
                                                                <span className="truncate">{item.description}</span>
                                                                <span className="ml-1 font-semibold text-green-700">
                                                                    x{item.quantity}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            ))}
                        </div>

                        {/* Summary of delivered quantities */}
                        {selectedDeliveryNoteIds.length > 0 && Object.keys(deliveredQuantitiesByDescription).length > 0 && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                <h4 className="font-semibold text-blue-800 text-sm mb-2">Total Delivered Quantities:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(deliveredQuantitiesByDescription).map(([desc, qty]) => (
                                        <span key={desc} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                                            {desc}: <strong>{qty}</strong>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="border-t border-gray-100 pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center">
                            <FileText className="mr-2 text-[#065F46]" size={20} />
                            Invoice Items <span className="text-red-500 ml-1">*</span>
                        </h3>
                    </div>

                    {errors.items && submitted && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-700 flex items-center">
                                <AlertCircle size={16} className="mr-2" />
                                {errors.items}
                            </p>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <div className="space-y-4 min-w-[600px]">
                            {items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-4 items-end animate-slide-up">
                                    <div className="col-span-5 md:col-span-5 relative">
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
                                        <input
                                            type="text"
                                            value={item.description}
                                            onChange={e => {
                                                updateItem(index, 'description', e.target.value);
                                                searchProducts(e.target.value, index);
                                            }}
                                            onBlur={() => { handleBlur('items'); dismissProdSuggestions(); }}
                                            placeholder="Type to search products..."
                                            autoComplete="off"
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none ${item.description.trim() === '' && touched.items ? 'border-amber-400' : 'border-gray-200'
                                                }`}
                                        />
                                        {/* Product suggestions dropdown */}
                                        {activeItemIdx === index && prodSuggestions.length > 0 && (
                                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                                {prodSuggestions.map(product => (
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
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Qty</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none text-right ${item.quantity <= 0 && item.description.trim() ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                                }`}
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-2">
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Price</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            value={item.price}
                                            onChange={e => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none text-right ${item.price < 0 && item.description.trim() ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                                }`}
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-2">
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">TVA</label>
                                        <select
                                            value={item.tva ? item.vatRate : -1}
                                            onChange={e => {
                                                const val = parseInt(e.target.value);
                                                if (val === -1) {
                                                    updateItem(index, 'tva', false);
                                                    updateItem(index, 'vatRate', 0);
                                                } else {
                                                    updateItem(index, 'tva', true);
                                                    updateItem(index, 'vatRate', val);
                                                }
                                            }}
                                            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#065F46] outline-none"
                                        >
                                            <option value={-1}>{t('invoice.noTax', 'No Tax')}</option>
                                            {taxSettings.availableVatRates.filter(r => r > 0).map(rate => (
                                                <option key={rate} value={rate}>{t('invoice.tax', 'TVA')} {rate}%</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-1 flex justify-end pb-2">
                                        <button
                                            onClick={() => removeItem(index)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={addItem}
                        className="mt-4 flex items-center text-sm font-semibold text-[#065F46] hover:text-[#065F46] transition-colors"
                    >
                        <Plus size={18} className="mr-1" />
                        Add Item
                    </button>
                </div>

                {/* Totals */}
                <div className="border-t border-gray-100 pt-6 flex justify-end">
                    <div className="w-full md:w-1/3 space-y-3">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal:</span>
                            <span>{calculateSubtotal().toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Tax (Approx):</span>
                            <span>{(calculateTotal() - calculateSubtotal()).toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                        </div>
                        <div className="border-t border-gray-200 pt-3 flex justify-between text-xl font-bold text-gray-900">
                            <span>Total:</span>
                            <span className="text-[#065F46]">{calculateTotal().toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

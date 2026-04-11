import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Save, FileText, Truck, User, Calendar, Package, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { DEFAULT_CURRENCY, CURRENCY_OPTIONS, getCurrencySymbol } from '../lib/currencyUtils';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyClients, dummyQuotes, dummyDeliveryNotes } from '../services/dummyData';

interface Client { id: number; name: string; }
interface DeliveryNoteItem { id: number; description: string; quantity: number; productServiceId?: number; }
interface DeliveryNote { id: number; number: string; date: string; clientName?: string; totalAmount: number; quoteId?: number; createdByUser?: { email?: string; userName?: string; firstName?: string; lastName?: string }; deliveryNoteItems?: DeliveryNoteItem[]; }
interface InvoiceItem { description: string; quantity: number; price: number; tva: boolean; vatRate: number; fromCatalog?: boolean; productServiceId?: number; }
interface QuoteItem { description: string; quantity: number; price: number; tva: boolean; vatRate?: number; productServiceId?: number; }
interface QuoteData { id: number; number: string; Number?: string; clientId: number; clientName: string; status: string; totalAmount: number; quoteItems?: QuoteItem[]; currency?: string; currencySymbol?: string; pdfLanguage?: string; }
interface ValidationErrors { clientId?: string; invoiceNumber?: string; date?: string; items?: string; }
interface TaxSettings { customTaxEnabled: boolean; customTaxName: string; customTaxAmount: number; defaultVatRate: number; availableVatRates: number[]; }
interface ProductSuggestion { id: number; name: string; description?: string; defaultUnitPrice: number; vatApplicable: boolean; tvaRate?: number; }

const getQuoteNumber = (quote: QuoteData) => quote.number || quote.Number || '';

export default function InvoiceCreatePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const { id: editId } = useParams<{ id: string }>();
    const isEditMode = !!editId;
    const [loading, setLoading] = useState(false);
    const [loadingInvoice, setLoadingInvoice] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [quotes, setQuotes] = useState<QuoteData[]>([]);
    const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
    const [selectedDeliveryNoteIds, setSelectedDeliveryNoteIds] = useState<number[]>([]);
    const [selectedQuotesData, setSelectedQuotesData] = useState<QuoteData[]>([]);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [submitted, setSubmitted] = useState(false);
    const [taxSettings, setTaxSettings] = useState<TaxSettings>({ customTaxEnabled: true, customTaxName: 'Timbre Fiscal', customTaxAmount: 1.0, defaultVatRate: 0.19, availableVatRates: [0, 7, 13, 19] });
    const [prodSuggestions, setProdSuggestions] = useState<ProductSuggestion[]>([]);
    const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [pdfCurrency, setPdfCurrency] = useState('');
    const [pdfCurrencySymbol, setPdfCurrencySymbol] = useState('');
    const [pdfLanguage, setPdfLanguage] = useState('');
    const [clientId, setClientId] = useState('');
    const [selectedQuoteIds, setSelectedQuoteIds] = useState<number[]>([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [lastInvoiceNumber, setLastInvoiceNumber] = useState('');
    const [suggestedNumber, setSuggestedNumber] = useState('');
    const [items, setItems] = useState<InvoiceItem[]>([
        { description: '', quantity: 1, price: 0, tva: true, vatRate: 19, fromCatalog: false }
    ]);

    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};
        if (!clientId) newErrors.clientId = t('createPage.clientRequired', 'Client is required');
        if (!invoiceNumber.trim()) newErrors.invoiceNumber = t('createPage.numberRequired', 'Invoice number is required');
        if (!date) newErrors.date = t('createPage.dateRequired', 'Date is required');
        const validItems = items.filter(item => item.description.trim() !== '');
        if (validItems.length === 0) newErrors.items = t('createPage.itemsRequired', 'At least one item is required');
        const hasInvalidItems = items.some(item => (item.description.trim() && (item.quantity <= 0 || item.price < 0)));
        if (hasInvalidItems) newErrors.items = t('createPage.itemsInvalid', 'Items have invalid quantity or price');
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleBlur = (field: string) => { setTouched(prev => ({ ...prev, [field]: true })); };

    useEffect(() => {
        fetchClients();
        fetchTaxSettings();
        if (!isEditMode) fetchLastInvoiceNumber();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isEditMode && editId) {
            setLoadingInvoice(true);
            if (USE_DUMMY_DATA) {
                // In dummy mode, just set some placeholder data for edit
                setLoadingInvoice(false);
                notify('info', t('createPage.editNotAvailableInDemo', 'Edit mode uses placeholder data in demo'));
            } else {
                api.get(`/Invoices/${editId}/details`).then(res => {
                    const inv = res.data;
                    setInvoiceNumber(inv.number || '');
                    setDate(inv.date ? new Date(inv.date).toISOString().split('T')[0] : '');
                    setClientId(inv.clientId?.toString() || '');
                    if (inv.currency) setPdfCurrency(inv.currency);
                    if (inv.currencySymbol) setPdfCurrencySymbol(inv.currencySymbol);
                    if (inv.pdfLanguage) setPdfLanguage(inv.pdfLanguage);
                    setItems(inv.items?.length > 0
                        ? inv.items.map((item: Record<string, unknown>) => ({
                            description: item.description || '', quantity: item.quantity || 1,
                            price: item.unitPrice || 0, tva: ((item.vat as number) ?? 0) > 0,
                            vatRate: ((item.vat as number) ?? 0) > 0 ? Math.round(((item.vatRate as number) ?? 0.19) * 100) : 0,
                            fromCatalog: true, productServiceId: item.productServiceId
                        }))
                        : [{ description: '', quantity: 1, price: 0, tva: true, vatRate: 19, fromCatalog: false }]
                    );
                }).catch(err => {
                    logger.error('Error fetching invoice for edit', err);
                    notify('error', t('createPage.loadFailed', 'Failed to load invoice'));
                    navigate('/invoices');
                }).finally(() => setLoadingInvoice(false));
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, editId]);

    const fetchTaxSettings = async () => {
        if (USE_DUMMY_DATA) {
            setPdfCurrency('USD');
            setPdfCurrencySymbol('$');
            setPdfLanguage('en');
            return;
        }
        try {
            const res = await api.get('/Settings');
            let vatRates = [0, 7, 13, 19];
            try { if (res.data.availableVatRates) vatRates = JSON.parse(res.data.availableVatRates); } catch { /* keep defaults */ }
            const defaultRate = res.data.defaultVatRate ?? 0.19;
            const defaultRateInt = Math.round(defaultRate * 100);
            const sortedRates = [...vatRates].sort((a, b) => { if (a === defaultRateInt) return -1; if (b === defaultRateInt) return 1; return b - a; });
            setTaxSettings({ customTaxEnabled: res.data.customTaxEnabled ?? true, customTaxName: res.data.customTaxName || 'Timbre Fiscal', customTaxAmount: res.data.customTaxAmount ?? 1.0, defaultVatRate: defaultRate, availableVatRates: sortedRates });
            setItems(prev => prev.map(item => ({ ...item, vatRate: item.vatRate === 19 ? Math.round(defaultRate * 100) : item.vatRate })));
            if (!pdfCurrency) { setPdfCurrency(res.data.currency || DEFAULT_CURRENCY); setPdfCurrencySymbol(res.data.currencySymbol || getCurrencySymbol(res.data.currency) || DEFAULT_CURRENCY); }
            if (!pdfLanguage) setPdfLanguage(res.data.invoiceLanguage || 'fr');
        } catch (error) { logger.error("Error fetching tax settings", error); }
    };

    const fetchLastInvoiceNumber = async () => {
        if (USE_DUMMY_DATA) {
            setLastInvoiceNumber('INV-2024-005');
            setSuggestedNumber('INV-2024-006');
            setInvoiceNumber('INV-2024-006');
            return;
        }
        try {
            const res = await api.get('/Invoices/last-number');
            setLastInvoiceNumber(res.data.lastNumber || '');
            setSuggestedNumber(res.data.suggestedNumber || '');
            setInvoiceNumber(res.data.suggestedNumber || '');
        } catch (error) { logger.error("Error fetching last invoice number", error); }
    };

    const fetchClients = async () => {
        if (USE_DUMMY_DATA) {
            setClients(dummyClients.map(c => ({ id: c.id, name: c.name })));
            return;
        }
        try {
            const res = await api.get('/Clients?size=9999');
            const data = res.data;
            setClients(Array.isArray(data) ? data : (data.data || []));
        } catch (error) { logger.error("Error fetching clients", error); }
    };

    const fetchQuotesForClient = async (cid: string) => {
        if (!cid) { setQuotes([]); return; }
        if (USE_DUMMY_DATA) {
            const clientQuotes = dummyQuotes.filter(q => q.clientId === parseInt(cid) && (q.status === 'Draft' || q.status === 'Accepted' || q.status === 'Sent') && !q.treated);
            setQuotes(clientQuotes as unknown as QuoteData[]);
            return;
        }
        try {
            const res = await api.get('/Quotes');
            const allQuotes = Array.isArray(res.data) ? res.data : (res.data.data || []);
            const clientQuotes = allQuotes.filter((d: { status: string; isDeleted?: boolean; treated?: boolean; clientId: number }) =>
                (d.status === 'Draft' || d.status === 'Accepted') && !d.isDeleted && !d.treated && d.clientId === parseInt(cid));
            setQuotes(clientQuotes);
        } catch (error) { logger.error("Error fetching quotes", error); }
    };

    const handleClientChange = (cid: string) => {
        setClientId(cid);
        setSelectedQuoteIds([]);
        setSelectedQuotesData([]);
        setSelectedDeliveryNoteIds([]);
        setDeliveryNotes([]);
        setTouched(prev => ({ ...prev, clientId: true }));
        fetchQuotesForClient(cid);
    };

    const handleDeliveryNoteToggle = (dnId: number) => {
        setSelectedDeliveryNoteIds(prev => prev.includes(dnId) ? prev.filter(id => id !== dnId) : [...prev, dnId]);
    };

    const prevItemsKeyRef = useRef<string>('');

    useEffect(() => {
        if (selectedQuotesData.length === 0) return;
        const allQuoteItems = selectedQuotesData.flatMap(q => q.quoteItems ?? []);
        if (allQuoteItems.length === 0) return;
        const currentKey = `${selectedQuotesData.map(q => q.id).sort().join('+')}:${[...selectedDeliveryNoteIds].sort().join(',')}`;
        if (currentKey === prevItemsKeyRef.current) return;
        prevItemsKeyRef.current = currentKey;

        const selectedDNs = deliveryNotes.filter(dn => selectedDeliveryNoteIds.includes(dn.id));
        if (selectedDNs.length > 0) {
            const deliveredItems: Record<string, { description: string; quantity: number }> = {};
            selectedDNs.forEach(dn => {
                dn.deliveryNoteItems?.forEach(item => {
                    const key = item.description.toLowerCase().trim();
                    if (!deliveredItems[key]) deliveredItems[key] = { description: item.description, quantity: 0 };
                    deliveredItems[key].quantity += item.quantity || 0;
                });
            });
            const quotePriceMap: Record<string, { price: number; tva: boolean; vatRate?: number }> = {};
            allQuoteItems.forEach(qi => { quotePriceMap[qi.description.toLowerCase().trim()] = { price: qi.price, tva: qi.tva, vatRate: qi.vatRate }; });
            const newItems: InvoiceItem[] = Object.values(deliveredItems).filter(di => di.quantity > 0).map(di => {
                const quoteInfo = quotePriceMap[di.description.toLowerCase().trim()];
                return { description: di.description, quantity: di.quantity, price: quoteInfo?.price ?? 0, tva: quoteInfo?.tva ?? true, vatRate: quoteInfo?.tva ? Math.round((quoteInfo?.vatRate ?? taxSettings.defaultVatRate) * 100) : 0, fromCatalog: true };
            });
            if (newItems.length > 0) setItems(newItems);
        } else if (deliveryNotes.length === 0) {
            const newItems: InvoiceItem[] = allQuoteItems.map(qi => ({
                description: qi.description, quantity: qi.quantity, price: qi.price, tva: qi.tva,
                vatRate: qi.tva ? Math.round((qi.vatRate ?? taxSettings.defaultVatRate) * 100) : 0, fromCatalog: true
            }));
            if (newItems.length > 0) setItems(newItems);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDeliveryNoteIds, selectedQuotesData, deliveryNotes]);

    const handleQuoteSelection = async (quoteId: number, checked: boolean) => {
        const newIds = checked ? [...selectedQuoteIds, quoteId] : selectedQuoteIds.filter(id => id !== quoteId);
        setSelectedQuoteIds(newIds);
        if (newIds.length === 0) { setSelectedQuotesData([]); setDeliveryNotes([]); setSelectedDeliveryNoteIds([]); return; }
        if (USE_DUMMY_DATA) {
            const selectedQ = dummyQuotes.filter(q => newIds.includes(q.id)) as unknown as QuoteData[];
            setSelectedQuotesData(selectedQ);
            const linkedDNs = dummyDeliveryNotes.filter(dn => dn.quoteId && newIds.includes(dn.quoteId) && !dn.invoiceId) as unknown as DeliveryNote[];
            setDeliveryNotes(linkedDNs);
            setSelectedDeliveryNoteIds(linkedDNs.map(dn => dn.id));
            return;
        }
        try {
            const responses = await Promise.all(newIds.map(id => api.get(`/Quotes/${id}`)));
            const allQuotes: QuoteData[] = responses.map(r => r.data);
            setSelectedQuotesData(allQuotes);
            const firstQuote = allQuotes[0];
            if (firstQuote.currency) setPdfCurrency(firstQuote.currency);
            if (firstQuote.currencySymbol) setPdfCurrencySymbol(firstQuote.currencySymbol);
            if (firstQuote.pdfLanguage) setPdfLanguage(firstQuote.pdfLanguage);
        } catch (error) { logger.error("Error fetching quote details", error); }
    };

    const addItem = () => { setItems([...items, { description: '', quantity: 1, price: 0, tva: true, vatRate: Math.round(taxSettings.defaultVatRate * 100), fromCatalog: false }]); };

    const searchProducts = useCallback((query: string, itemIndex: number) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (query.length < 2) { setProdSuggestions([]); setActiveItemIdx(null); return; }
        searchTimerRef.current = setTimeout(async () => {
            if (USE_DUMMY_DATA) {
                const { dummyProducts } = require('../services/dummyData');
                const filtered = dummyProducts.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).map(p => ({
                    id: p.id, name: p.name, description: p.description, defaultUnitPrice: p.price, vatApplicable: true
                }));
                setProdSuggestions(filtered.slice(0, 8));
                setActiveItemIdx(itemIndex);
                return;
            }
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
        newItems[itemIndex] = { ...newItems[itemIndex], description: product.name + (product.description ? ` - ${product.description}` : ''), price: product.defaultUnitPrice, tva: product.vatApplicable, vatRate: product.vatApplicable ? productRate : 0, fromCatalog: true, productServiceId: product.id };
        setItems(newItems);
        setProdSuggestions([]);
        setActiveItemIdx(null);
    };

    const dismissProdSuggestions = () => { setTimeout(() => { setProdSuggestions([]); setActiveItemIdx(null); }, 200); };
    const removeItem = (index: number) => { if (items.length === 1) return; setItems(items.filter((_, i) => i !== index)); };

    const updateItem = (index: number, field: keyof InvoiceItem, value: string | number | boolean) => {
        const newItems = [...items];
        const current = newItems[index];
        if (!current) return;
        if (field === 'description') newItems[index] = { ...current, description: String(value), fromCatalog: false };
        else if (field === 'quantity') newItems[index] = { ...current, quantity: Number(value) };
        else if (field === 'price') newItems[index] = { ...current, price: Number(value) };
        else if (field === 'tva') newItems[index] = { ...current, tva: Boolean(value) };
        else if (field === 'vatRate') newItems[index] = { ...current, vatRate: Number(value) };
        else if (field === 'fromCatalog') newItems[index] = { ...current, fromCatalog: Boolean(value) };
        setItems(newItems);
    };

    const calculateSubtotal = () => items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const calculateTotal = () => {
        const taxAmount = taxSettings.customTaxEnabled ? taxSettings.customTaxAmount : 0;
        return items.reduce((sum, item) => {
            const lineTotal = item.quantity * item.price;
            const tvaAmount = item.tva ? lineTotal * (item.vatRate / 100) : 0;
            return sum + lineTotal + tvaAmount;
        }, taxAmount);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        if (!validateForm()) return;
        setLoading(true);
        try {
            const payload = {
                number: invoiceNumber.trim(), date: new Date(date).toISOString(), clientId: parseInt(clientId),
                quoteIds: selectedQuoteIds.length > 0 ? selectedQuoteIds : null,
                deliveryNoteIds: selectedDeliveryNoteIds.length > 0 ? selectedDeliveryNoteIds : null,
                items: items.filter(item => item.description.trim() !== '').map(item => ({
                    description: item.description.trim(), quantity: item.quantity, price: item.price,
                    tva: item.tva, vatRate: item.tva ? item.vatRate : 0, productServiceId: item.productServiceId || null
                }))
            };
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 800));
                logger.info('Invoice payload (dummy):', payload);
                notify('success', isEditMode ? t('createPage.updateSuccess', 'Invoice updated') : t('createPage.createSuccess', 'Invoice created'));
            } else {
                if (isEditMode && editId) await api.put(`/Invoices/${editId}`, payload);
                else await api.post('/Invoices', payload);
            }
            await queryClient.invalidateQueries({ queryKey: ['invoices'] });
            await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            navigate('/invoices');
        } catch (error) {
            logger.error("Error creating invoice", error);
            notify('error', t('createPage.createFailed', 'Failed to create invoice'));
        } finally { setLoading(false); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-0">
            <NotifyBanner />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start space-x-4">
                    <button onClick={() => navigate('/invoices')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? t('createPage.titleEdit', 'Edit Invoice') : t('createPage.titleNew', 'New Invoice')}</h1>
                        <p className="text-gray-500 text-sm">{isEditMode ? t('createPage.subtitleEdit', `Editing invoice ${invoiceNumber}`) : t('createPage.subtitleNew', 'Create a new invoice')}</p>
                    </div>
                </div>
                <button onClick={handleSubmit} disabled={loading || loadingInvoice} className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                    <Save size={20} className="mr-2" />
                    {loading ? t('createPage.saving', 'Saving...') : isEditMode ? t('createPage.updateButton', 'Update') : t('createPage.saveButton', 'Save Invoice')}
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-8">
                {submitted && Object.keys(errors).length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start space-x-3">
                            <AlertCircle className="text-red-500 mt-0.5" size={20} />
                            <div>
                                <h4 className="font-semibold text-red-800">{t('createPage.fixErrors', 'Please fix the following errors:')}</h4>
                                <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                                    {Object.values(errors).map((error, idx) => (<li key={idx}>{error}</li>))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {selectedQuoteIds.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-[#065F46]/5 border border-[#065F46]/10 rounded-xl">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('createPage.documentCurrency', 'Currency')}</label>
                            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600">
                                {CURRENCY_OPTIONS.find(c => c.code === pdfCurrency)?.label || pdfCurrency || t('createPage.inheritedFromQuote', 'Inherited from quote')}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('createPage.pdfLanguage', 'PDF Language')}</label>
                            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600">
                                {pdfLanguage === 'fr' ? 'Français' : pdfLanguage === 'en' ? 'English' : pdfLanguage === 'de' ? 'Deutsch' : pdfLanguage === 'ar' ? 'العربية' : pdfLanguage || '—'}
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.invoiceNumber', 'Invoice Number')} <span className="text-red-500">*</span></label>
                        <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} onBlur={() => handleBlur('invoiceNumber')}
                            className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none transition-all ${errors.invoiceNumber && submitted ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                            placeholder={t('createPage.enterNumber', 'e.g. INV-2024-006')} required />
                        {errors.invoiceNumber && submitted && <p className="text-xs text-red-600 mt-1">{errors.invoiceNumber}</p>}
                        {lastInvoiceNumber && !errors.invoiceNumber && (
                            <p className="text-xs text-gray-500 mt-1">
                                {t('createPage.lastInvoice', 'Last:')} <span className="font-medium text-[#065F46]">{lastInvoiceNumber}</span>
                                {suggestedNumber && (<span> — {t('createPage.suggested', 'Suggested:')} <span className="font-medium text-green-600">{suggestedNumber}</span></span>)}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.client', 'Client')} <span className="text-red-500">*</span></label>
                        <select value={clientId} onChange={e => handleClientChange(e.target.value)} onBlur={() => handleBlur('clientId')}
                            className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none transition-all ${errors.clientId && submitted ? 'border-red-500 bg-red-50' : 'border-gray-200'}`} required>
                            <option value="">{t('createPage.selectClient', 'Select a client')}</option>
                            {clients.map(client => (<option key={client.id} value={client.id}>{client.name}</option>))}
                        </select>
                        {errors.clientId && submitted && <p className="text-xs text-red-600 mt-1">{errors.clientId}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('createPage.linkQuote', 'Link Quote')}</label>
                        <div className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl max-h-48 overflow-y-auto space-y-2 ${!clientId ? 'opacity-50 pointer-events-none' : ''}`}>
                            {quotes.length === 0 ? (
                                <p className="text-sm text-gray-400">{t('createPage.noQuoteSelected', 'No quotes available for this client')}</p>
                            ) : (
                                quotes.map(quote => (
                                    <label key={quote.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                        <input type="checkbox" checked={selectedQuoteIds.includes(quote.id)} onChange={e => handleQuoteSelection(quote.id, e.target.checked)} className="accent-[#065F46]" />
                                        <span className="text-sm text-gray-700">
                                            {getQuoteNumber(quote)} — {(quote.totalAmount || 0).toLocaleString()} {pdfCurrencySymbol || DEFAULT_CURRENCY}
                                        </span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('createPage.invoiceDate', 'Invoice Date')} <span className="text-red-500">*</span></label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} onBlur={() => handleBlur('date')}
                            className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none transition-all ${errors.date && submitted ? 'border-red-500 bg-red-50' : 'border-gray-200'}`} required />
                        {errors.date && submitted && <p className="text-xs text-red-600 mt-1">{errors.date}</p>}
                    </div>
                </div>

                {selectedQuoteIds.length > 0 && deliveryNotes.length > 0 && (
                    <div className="border-t border-gray-100 pt-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center mb-2"><Truck className="mr-2 text-green-500" size={20} />{t('createPage.linkedDeliveryNotes', 'Linked Delivery Notes')}</h3>
                        <p className="text-sm text-gray-500 mb-4">{t('createPage.deliveryNotesHelp', 'Select which delivery notes to include')}</p>
                        <div className="space-y-3">
                            {deliveryNotes.map(dn => (
                                <div key={dn.id} className={`p-4 rounded-xl border transition-all ${selectedDeliveryNoteIds.includes(dn.id) ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-green-300'}`}>
                                    <label className="flex items-start cursor-pointer">
                                        <input type="checkbox" checked={selectedDeliveryNoteIds.includes(dn.id)} onChange={() => handleDeliveryNoteToggle(dn.id)} className="form-checkbox h-5 w-5 text-green-600 rounded mt-1 mr-3" />
                                        <div className="flex-1">
                                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <span className="font-semibold text-gray-800">{t('deliveryNote.title', 'Delivery Note')} #{dn.number}</span>
                                                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                                    <span className="flex items-center"><Calendar size={14} className="mr-1" />{dn.date ? new Date(dn.date).toLocaleDateString() : '—'}</span>
                                                    {dn.createdByUser && (<span className="flex items-center"><User size={14} className="mr-1" />{dn.createdByUser.firstName || dn.createdByUser.email}</span>)}
                                                </div>
                                            </div>
                                            {dn.deliveryNoteItems && dn.deliveryNoteItems.length > 0 && (
                                                <div className="mt-2 pl-2 border-l-2 border-green-200">
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                                        {dn.deliveryNoteItems.map((item, idx) => (
                                                            <div key={idx} className="flex items-center text-gray-600">
                                                                <Package size={12} className="mr-1 text-green-500" />
                                                                <span className="truncate">{item.description}</span>
                                                                <span className="ml-1 font-semibold text-green-700">x{item.quantity}</span>
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
                    </div>
                )}

                <div className="border-t border-gray-100 pt-6">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center"><FileText className="mr-2 text-[#065F46]" size={20} />{t('invoice.items', 'Items')} <span className="text-red-500 ml-1">*</span></h3>
                    </div>
                    {errors.items && submitted && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-700 flex items-center"><AlertCircle size={16} className="mr-2" />{errors.items}</p></div>
                    )}
                    <div className="overflow-x-auto">
                        <div className="space-y-4">
                            {items.map((item, index) => (
                                <div key={index} className="grid grid-cols-2 md:grid-cols-12 gap-4 items-end p-4 md:p-0 bg-gray-50 md:bg-white rounded-xl md:rounded-none border border-gray-100 md:border-0 mb-4 md:mb-0">
                                    <div className="col-span-2 md:col-span-5 relative">
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.description', 'Description')}</label>
                                        <input type="text" value={item.description}
                                            onChange={e => { updateItem(index, 'description', e.target.value); searchProducts(e.target.value, index); }}
                                            onBlur={() => { handleBlur('items'); dismissProdSuggestions(); }}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none ${item.description.trim() === '' && touched.items ? 'border-amber-400' : 'border-gray-200'}`}
                                            placeholder={t('createPage.enterDescription', 'Description or search product...')} autoComplete="off" />
                                        {activeItemIdx === index && prodSuggestions.length > 0 && (
                                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                                {prodSuggestions.map(product => (
                                                    <button key={product.id} type="button" onMouseDown={() => selectProduct(product, index)}
                                                        className="w-full px-3 py-2 text-left hover:bg-[#065F46]/5 flex justify-between items-center text-sm border-b border-gray-50 last:border-0">
                                                        <div>
                                                            <span className="font-medium text-gray-900">{product.name}</span>
                                                            {product.description && <span className="text-gray-400 ml-1 text-xs">— {product.description}</span>}
                                                        </div>
                                                        <span className="text-[#065F46] font-medium text-xs whitespace-nowrap ml-2">{product.defaultUnitPrice.toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.qty', 'Qty')}</label>
                                        <input type="number" min="1" value={item.quantity} onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none text-right ${item.quantity <= 0 && item.description.trim() ? 'border-red-500 bg-red-50' : 'border-gray-200'}`} />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.price', 'Price')}</label>
                                        <input type="number" min="0" step="0.001" value={item.price} onChange={e => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none text-right ${item.price < 0 && item.description.trim() ? 'border-red-500 bg-red-50' : 'border-gray-200'}`} />
                                    </div>
                                    <div className="col-span-1 md:col-span-2 flex items-center space-x-2">
                                        <select value={item.tva ? item.vatRate : -1}
                                            onChange={e => { const val = parseInt(e.target.value); if (val === -1) { updateItem(index, 'tva', false); updateItem(index, 'vatRate', 0); } else { updateItem(index, 'tva', true); updateItem(index, 'vatRate', val); } }}
                                            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#065F46] outline-none">
                                            <option value={-1}>{t('invoice.noTax', 'No Tax')}</option>
                                            {taxSettings.availableVatRates.filter(r => r > 0).map(rate => (<option key={rate} value={rate}>{t('invoice.tax', 'TVA')} {rate}%</option>))}
                                        </select>
                                    </div>
                                    <div className="col-span-1 md:col-span-1 flex justify-end">
                                        <button onClick={() => removeItem(index)} className="p-2 text-gray-400 hover:text-red-500 border md:border-0 rounded-lg md:rounded-none bg-white md:bg-transparent"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={addItem} className="mt-4 flex items-center text-sm font-semibold text-[#065F46] hover:text-[#065F46] transition-colors">
                            <Plus size={18} className="mr-1" />{t('invoice.addItem', 'Add Item')}
                        </button>
                    </div>

                    <div className="border-t border-gray-100 pt-6 flex justify-end">
                        <div className="w-full md:w-1/3 space-y-3">
                            <div className="flex justify-between text-gray-600">
                                <span>{t('invoice.subtotal', 'Subtotal')}:</span>
                                <span>{calculateSubtotal().toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>{t('invoice.tax', 'Tax')}:</span>
                                <span>{(calculateTotal() - calculateSubtotal()).toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                            </div>
                            <div className="border-t border-gray-200 pt-3 flex justify-between text-xl font-bold text-gray-900">
                                <span>{t('invoice.total', 'Total')}:</span>
                                <span className="text-[#065F46]">{calculateTotal().toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

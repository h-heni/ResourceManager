import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Save, FileText, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { DEFAULT_CURRENCY, CURRENCY_OPTIONS, getCurrencySymbol } from '../lib/currencyUtils';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyClients } from '../services/dummyData';

interface Client { id: number; name: string; }
interface QuoteItem { description: string; quantity: number; price: number; tva: boolean; vatRate: number; fromCatalog?: boolean; productServiceId?: number; }
interface ValidationErrors { clientId?: string; date?: string; items?: string; }
interface TaxSettings { customTaxEnabled: boolean; customTaxName: string; customTaxAmount: number; defaultVatRate: number; availableVatRates: number[]; }
interface ProductSuggestion { id: number; name: string; description?: string; defaultUnitPrice: number; vatApplicable: boolean; tvaRate?: number; }

export default function QuoteCreatePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const { id: editId } = useParams<{ id: string }>();
    const isEditMode = !!editId;
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [submitted, setSubmitted] = useState(false);
    const [taxSettings, setTaxSettings] = useState<TaxSettings>({ customTaxEnabled: true, customTaxName: 'Timbre Fiscal', customTaxAmount: 1.0, defaultVatRate: 0.19, availableVatRates: [0, 7, 13, 19] });
    const [prodSuggestions, setProdSuggestions] = useState<ProductSuggestion[]>([]);
    const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [pdfCurrency, setPdfCurrency] = useState('');
    const [pdfCurrencySymbol, setPdfCurrencySymbol] = useState('');
    const [clientId, setClientId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [validUntil, setValidUntil] = useState('');
    const [items, setItems] = useState<QuoteItem[]>([{ description: '', quantity: 1, price: 0, tva: true, vatRate: 19, fromCatalog: false }]);

    useEffect(() => {
        if (USE_DUMMY_DATA) {
            setClients(dummyClients.map(c => ({ id: c.id, name: c.name })));
            setPdfCurrency('USD'); setPdfCurrencySymbol('$');
        } else {
            api.get('/Clients?size=9999').then(res => { const d = res.data; setClients(Array.isArray(d) ? d : (d.data || [])); }).catch(e => logger.error('Clients fetch error', e));
            api.get('/Settings').then(res => {
                const defaultRate = res.data.defaultVatRate ?? 0.19;
                let vatRates = [0, 7, 13, 19]; try { if (res.data.availableVatRates) vatRates = JSON.parse(res.data.availableVatRates); } catch {}
                setTaxSettings({ ...taxSettings, defaultVatRate: defaultRate, availableVatRates: vatRates });
                setPdfCurrency(res.data.currency || DEFAULT_CURRENCY); setPdfCurrencySymbol(res.data.currencySymbol || getCurrencySymbol(res.data.currency) || DEFAULT_CURRENCY);
            }).catch(e => logger.error('Settings fetch error', e));
        }
        const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30);
        setValidUntil(thirtyDays.toISOString().split('T')[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};
        if (!clientId) newErrors.clientId = t('createPage.clientRequired', 'Client is required');
        if (!date) newErrors.date = t('createPage.dateRequired', 'Date is required');
        const validItems = items.filter(i => i.description.trim() !== '');
        if (validItems.length === 0) newErrors.items = t('createPage.itemsRequired', 'At least one item is required');
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const addItem = () => setItems([...items, { description: '', quantity: 1, price: 0, tva: true, vatRate: Math.round(taxSettings.defaultVatRate * 100), fromCatalog: false }]);
    const removeItem = (index: number) => { if (items.length === 1) return; setItems(items.filter((_, i) => i !== index)); };
    const updateItem = (index: number, field: keyof QuoteItem, value: string | number | boolean) => {
        const newItems = [...items]; const current = newItems[index]; if (!current) return;
        if (field === 'description') newItems[index] = { ...current, description: String(value), fromCatalog: false };
        else if (field === 'quantity') newItems[index] = { ...current, quantity: Number(value) };
        else if (field === 'price') newItems[index] = { ...current, price: Number(value) };
        else if (field === 'tva') newItems[index] = { ...current, tva: Boolean(value) };
        else if (field === 'vatRate') newItems[index] = { ...current, vatRate: Number(value) };
        setItems(newItems);
    };

    const searchProducts = useCallback((query: string, itemIndex: number) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (query.length < 2) { setProdSuggestions([]); setActiveItemIdx(null); return; }
        searchTimerRef.current = setTimeout(async () => {
            if (USE_DUMMY_DATA) {
                const { dummyProducts } = require('../services/dummyData');
                setProdSuggestions(dummyProducts.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).map(p => ({ id: p.id, name: p.name, description: p.description, defaultUnitPrice: p.price, vatApplicable: true })).slice(0, 8));
                setActiveItemIdx(itemIndex); return;
            }
            try { const res = await api.get(`/ProductServices/search?q=${encodeURIComponent(query)}`); setProdSuggestions((Array.isArray(res.data) ? res.data : (res.data.data || [])).slice(0, 8)); setActiveItemIdx(itemIndex); } catch { setProdSuggestions([]); }
        }, 250);
    }, []);

    const selectProduct = (product: ProductSuggestion, itemIndex: number) => {
        const newItems = [...items];
        newItems[itemIndex] = { ...newItems[itemIndex], description: product.name + (product.description ? ` - ${product.description}` : ''), price: product.defaultUnitPrice, tva: product.vatApplicable, vatRate: product.vatApplicable ? (product.tvaRate ?? Math.round(taxSettings.defaultVatRate * 100)) : 0, fromCatalog: true, productServiceId: product.id };
        setItems(newItems); setProdSuggestions([]); setActiveItemIdx(null);
    };

    const calculateSubtotal = () => items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const calculateTotal = () => {
        const taxAmount = taxSettings.customTaxEnabled ? taxSettings.customTaxAmount : 0;
        return items.reduce((sum, item) => { const lineTotal = item.quantity * item.price; return sum + lineTotal + (item.tva ? lineTotal * (item.vatRate / 100) : 0); }, taxAmount);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitted(true);
        if (!validateForm()) return;
        setLoading(true);
        try {
            const payload = {
                date: new Date(date).toISOString(), validUntil: validUntil ? new Date(validUntil).toISOString() : null,
                clientId: parseInt(clientId), currency: pdfCurrency, currencySymbol: pdfCurrencySymbol,
                items: items.filter(i => i.description.trim()).map(i => ({ description: i.description.trim(), quantity: i.quantity, price: i.price, tva: i.tva, vatRate: i.tva ? i.vatRate : 0, productServiceId: i.productServiceId || null }))
            };
            if (USE_DUMMY_DATA) { await new Promise(r => setTimeout(r, 800)); notify('success', t('quote.createSuccess', 'Quote created')); }
            else { if (isEditMode && editId) await api.put(`/Quotes/${editId}`, payload); else await api.post('/Quotes', payload); }
            await queryClient.invalidateQueries({ queryKey: ['quotes'] });
            navigate('/quotes');
        } catch (error) { logger.error("Error creating quote", error); notify('error', t('quote.createFailed', 'Failed to create quote')); }
        finally { setLoading(false); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-0">
            <NotifyBanner />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start space-x-4">
                    <button onClick={() => navigate('/quotes')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"><ArrowLeft size={24} /></button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? t('quote.editTitle', 'Edit Quote') : t('quote.createTitle', 'New Quote')}</h1>
                        <p className="text-gray-500 text-sm">{t('quote.createSubtitle', 'Create a new quote for your client')}</p>
                    </div>
                </div>
                <button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all disabled:opacity-70">
                    <Save size={20} className="mr-2" />{loading ? t('createPage.saving', 'Saving...') : t('createPage.saveButton', 'Save Quote')}
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-8">
                {submitted && Object.keys(errors).length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start space-x-3"><AlertCircle className="text-red-500 mt-0.5" size={20} /><div><h4 className="font-semibold text-red-800">{t('createPage.fixErrors', 'Please fix errors')}</h4><ul className="list-disc list-inside text-sm text-red-700 mt-1">{Object.values(errors).map((e, i) => <li key={i}>{e}</li>)}</ul></div></div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.client', 'Client')} <span className="text-red-500">*</span></label>
                        <select value={clientId} onChange={e => setClientId(e.target.value)} className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none ${errors.clientId && submitted ? 'border-red-500' : 'border-gray-200'}`} required>
                            <option value="">{t('createPage.selectClient', 'Select a client')}</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('quote.date', 'Quote Date')} <span className="text-red-500">*</span></label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none ${errors.date && submitted ? 'border-red-500' : 'border-gray-200'}`} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('quote.validUntil', 'Valid Until')}</label>
                        <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('createPage.documentCurrency', 'Currency')}</label>
                        <select value={pdfCurrency} onChange={e => { setPdfCurrency(e.target.value); const opt = CURRENCY_OPTIONS.find(o => o.code === e.target.value); setPdfCurrencySymbol(opt?.symbol || e.target.value); }} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none">
                            {CURRENCY_OPTIONS.map(opt => <option key={opt.code} value={opt.code}>{opt.symbol} — {opt.code}</option>)}
                        </select>
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center mb-4"><FileText className="mr-2 text-[#065F46]" size={20} />{t('invoice.items', 'Items')} <span className="text-red-500 ml-1">*</span></h3>
                    {errors.items && submitted && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-700 flex items-center"><AlertCircle size={16} className="mr-2" />{errors.items}</p></div>}
                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-2 md:grid-cols-12 gap-4 items-end p-4 md:p-0 bg-gray-50 md:bg-white rounded-xl md:rounded-none border border-gray-100 md:border-0">
                                <div className="col-span-2 md:col-span-5 relative">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.description', 'Description')}</label>
                                    <input type="text" value={item.description} onChange={e => { updateItem(index, 'description', e.target.value); searchProducts(e.target.value, index); }} onBlur={() => setTimeout(() => { setProdSuggestions([]); setActiveItemIdx(null); }, 200)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none" placeholder={t('createPage.enterDescription', 'Description or search product...')} />
                                    {activeItemIdx === index && prodSuggestions.length > 0 && (
                                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                            {prodSuggestions.map(p => (
                                                <button key={p.id} type="button" onMouseDown={() => selectProduct(p, index)} className="w-full px-3 py-2 text-left hover:bg-[#065F46]/5 flex justify-between items-center text-sm border-b border-gray-50 last:border-0">
                                                    <span className="font-medium text-gray-900">{p.name}</span>
                                                    <span className="text-[#065F46] font-medium text-xs">{p.defaultUnitPrice.toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="col-span-1 md:col-span-2"><label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.qty', 'Qty')}</label><input type="number" min="1" value={item.quantity} onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none text-right" /></div>
                                <div className="col-span-1 md:col-span-2"><label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.price', 'Price')}</label><input type="number" min="0" step="0.001" value={item.price} onChange={e => updateItem(index, 'price', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none text-right" /></div>
                                <div className="col-span-1 md:col-span-2">
                                    <select value={item.tva ? item.vatRate : 0} onChange={e => { const rate = parseInt(e.target.value); const newItems = [...items]; newItems[index].tva = rate > 0; newItems[index].vatRate = rate; setItems(newItems); }} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#065F46] outline-none bg-white">
                                        {taxSettings.availableVatRates.map(rate => <option key={rate} value={rate}>{rate === 0 ? t('invoice.noTax', 'No Tax') : `TVA ${rate}%`}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1 md:col-span-1 flex justify-end"><button onClick={() => removeItem(index)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button></div>
                            </div>
                        ))}
                    </div>
                    <button onClick={addItem} className="mt-4 flex items-center text-sm font-semibold text-[#065F46]"><Plus size={18} className="mr-1" /> {t('invoice.addItem', 'Add Item')}</button>
                </div>

                <div className="border-t border-gray-100 pt-6 flex justify-end">
                    <div className="w-full md:w-1/3 space-y-3">
                        <div className="flex justify-between text-gray-600"><span>{t('invoice.subtotal', 'Subtotal')}:</span><span>{calculateSubtotal().toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span></div>
                        <div className="flex justify-between text-gray-600"><span>{t('invoice.tax', 'Tax')}:</span><span>{(calculateTotal() - calculateSubtotal()).toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span></div>
                        <div className="border-t border-gray-200 pt-3 flex justify-between text-xl font-bold text-gray-900"><span>{t('invoice.total', 'Total')}:</span><span className="text-[#065F46]">{calculateTotal().toFixed(3)} {pdfCurrencySymbol || DEFAULT_CURRENCY}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

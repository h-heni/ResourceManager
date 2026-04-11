import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Save, Package, FileText, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyClients, dummyQuotes } from '../services/dummyData';

interface Client { id: number; name: string; }
interface QuoteData { id: number; number: string; clientId: number; clientName: string; status: string; totalAmount: number; quoteItems?: { description: string; quantity: number; price: number; productServiceId?: number }[]; }
interface DeliveryNoteItem { description: string; quantity: number; }
interface ValidationErrors { quoteId?: string; date?: string; items?: string; }

export default function DeliveryNoteCreatePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const { id: editId } = useParams<{ id: string }>();
    const isEditMode = !!editId;
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [quotes, setQuotes] = useState<QuoteData[]>([]);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [submitted, setSubmitted] = useState(false);
    const [clientId, setClientId] = useState('');
    const [quoteId, setQuoteId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<DeliveryNoteItem[]>([{ description: '', quantity: 1 }]);
    const [currencySymbol, setCurrencySymbol] = useState(DEFAULT_CURRENCY);

    useEffect(() => {
        if (USE_DUMMY_DATA) {
            setClients(dummyClients.map(c => ({ id: c.id, name: c.name })));
            setCurrencySymbol('$');
        } else {
            api.get('/Clients?size=9999').then(res => { const d = res.data; setClients(Array.isArray(d) ? d : (d.data || [])); }).catch(e => logger.error('Clients error', e));
        }
    }, []);

    const fetchQuotesForClient = async (cid: string) => {
        if (!cid) { setQuotes([]); return; }
        if (USE_DUMMY_DATA) {
            setQuotes(dummyQuotes.filter(q => q.clientId === parseInt(cid) && !q.treated) as unknown as QuoteData[]);
            return;
        }
        try {
            const res = await api.get('/Quotes');
            const all = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setQuotes(all.filter((q: QuoteData & { isDeleted?: boolean }) => q.clientId === parseInt(cid) && !q.isDeleted));
        } catch (e) { logger.error('Quotes error', e); }
    };

    const handleClientChange = (cid: string) => { setClientId(cid); setQuoteId(''); fetchQuotesForClient(cid); };

    const handleQuoteChange = (qid: string) => {
        setQuoteId(qid);
        if (!qid) return;
        const quote = quotes.find(q => q.id === parseInt(qid));
        if (quote?.quoteItems?.length) {
            setItems(quote.quoteItems.map(qi => ({ description: qi.description, quantity: qi.quantity })));
        }
    };

    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};
        if (!date) newErrors.date = t('createPage.dateRequired', 'Date is required');
        const validItems = items.filter(i => i.description.trim() !== '');
        if (validItems.length === 0) newErrors.items = t('createPage.itemsRequired', 'At least one item is required');
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const addItem = () => setItems([...items, { description: '', quantity: 1 }]);
    const removeItem = (index: number) => { if (items.length === 1) return; setItems(items.filter((_, i) => i !== index)); };
    const updateItem = (index: number, field: keyof DeliveryNoteItem, value: string | number) => {
        const newItems = [...items]; if (field === 'description') newItems[index] = { ...newItems[index], description: String(value) };
        else newItems[index] = { ...newItems[index], quantity: Number(value) }; setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitted(true);
        if (!validateForm()) return;
        setLoading(true);
        try {
            const payload = {
                date: new Date(date).toISOString(), quoteId: quoteId ? parseInt(quoteId) : null, clientId: clientId ? parseInt(clientId) : null,
                items: items.filter(i => i.description.trim()).map(i => ({ description: i.description.trim(), quantity: i.quantity }))
            };
            if (USE_DUMMY_DATA) { await new Promise(r => setTimeout(r, 800)); notify('success', t('deliveryNote.createSuccess', 'Delivery note created')); }
            else { if (isEditMode && editId) await api.put(`/DeliveryNotes/${editId}`, payload); else await api.post('/DeliveryNotes', payload); }
            await queryClient.invalidateQueries({ queryKey: ['deliveryNotes'] });
            navigate('/delivery-notes');
        } catch (error) { logger.error("Error creating delivery note", error); notify('error', t('deliveryNote.createFailed', 'Failed')); }
        finally { setLoading(false); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-0">
            <NotifyBanner />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start space-x-4">
                    <button onClick={() => navigate('/delivery-notes')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"><ArrowLeft size={24} /></button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? t('deliveryNote.editTitle', 'Edit Delivery Note') : t('deliveryNote.createTitle', 'New Delivery Note')}</h1>
                        <p className="text-gray-500 text-sm">{t('deliveryNote.createSubtitle', 'Create a delivery note')}</p>
                    </div>
                </div>
                <button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all disabled:opacity-70">
                    <Save size={20} className="mr-2" />{loading ? t('createPage.saving', 'Saving...') : t('createPage.saveButton', 'Save')}
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.client', 'Client')}</label>
                        <select value={clientId} onChange={e => handleClientChange(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none">
                            <option value="">{t('createPage.selectClient', 'Select a client')}</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('createPage.linkQuote', 'Link to Quote')}</label>
                        <select value={quoteId} onChange={e => handleQuoteChange(e.target.value)} disabled={!clientId} className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none ${!clientId ? 'opacity-50' : ''}`}>
                            <option value="">{t('deliveryNote.selectQuote', 'Select a quote (optional)')}</option>
                            {quotes.map(q => <option key={q.id} value={q.id}>{q.number} — {(q.totalAmount || 0).toLocaleString()} {currencySymbol}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('deliveryNote.date', 'Date')} <span className="text-red-500">*</span></label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none ${errors.date && submitted ? 'border-red-500' : 'border-gray-200'}`} required />
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center mb-4"><Package className="mr-2 text-[#065F46]" size={20} />{t('deliveryNote.items', 'Items')} <span className="text-red-500 ml-1">*</span></h3>
                    {errors.items && submitted && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-700 flex items-center"><AlertCircle size={16} className="mr-2" />{errors.items}</p></div>}
                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-6 md:grid-cols-12 gap-4 items-end p-4 md:p-0 bg-gray-50 md:bg-white rounded-xl md:rounded-none border border-gray-100 md:border-0">
                                <div className="col-span-4 md:col-span-8">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.description', 'Description')}</label>
                                    <input type="text" value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none" placeholder={t('deliveryNote.itemDescription', 'Item description')} />
                                </div>
                                <div className="col-span-1 md:col-span-3">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('invoice.qty', 'Qty')}</label>
                                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] outline-none text-right" />
                                </div>
                                <div className="col-span-1 md:col-span-1 flex justify-end"><button onClick={() => removeItem(index)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button></div>
                            </div>
                        ))}
                    </div>
                    <button onClick={addItem} className="mt-4 flex items-center text-sm font-semibold text-[#065F46]"><Plus size={18} className="mr-1" /> {t('invoice.addItem', 'Add Item')}</button>
                </div>
            </div>
        </div>
    );
}

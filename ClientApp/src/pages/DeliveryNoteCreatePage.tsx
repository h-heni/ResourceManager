import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Package, FileText, History, User, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';
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

interface DeliveryItem {
    description: string;
    quantity: number;
    quotedQuantity: number; // Original quoted amount
    remainingQuantity: number; // What's left to deliver
}

// Validation errors interface
interface ValidationErrors {
    devisId?: string;
    date?: string;
    items?: string;
}

export default function DeliveryNoteCreatePage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [pendingDevis, setPendingDevis] = useState<Devis[]>([]);
    const [selectedDevis, setSelectedDevis] = useState<Devis | null>(null);
    const [existingDeliveryNotes, setExistingDeliveryNotes] = useState<ExistingDeliveryNote[]>([]);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [submitted, setSubmitted] = useState(false);

    // Currency & Language state (per-document override)
    const [pdfCurrency, setPdfCurrency] = useState('');
    const [pdfCurrencySymbol, setPdfCurrencySymbol] = useState('');
    const [pdfLanguage, setPdfLanguage] = useState('');

    // Form State
    const [selectedDevisId, setSelectedDevisId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<DeliveryItem[]>([
        { description: '', quantity: 1, quotedQuantity: 0, remainingQuantity: 0 }
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
        fetchCurrencySettings();
    }, []);

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
            console.error('Error fetching currency settings', error);
        }
    };

    // Validate form
    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};

        if (!selectedDevisId) {
            newErrors.devisId = 'Quote (Devis) selection is required';
        }

        if (!date) {
            newErrors.date = 'Date is required';
        }

        const validItems = items.filter(item => item.description.trim() !== '');
        if (validItems.length === 0) {
            newErrors.items = 'At least one item with description is required';
        }

        const hasInvalidItems = items.some(item =>
            (item.description.trim() && item.quantity <= 0)
        );
        if (hasInvalidItems) {
            newErrors.items = 'Items must have positive quantity';
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
            const draftDevis = allDevis.filter((d: any) =>
                (d.status === 'Draft' || d.status === 'Accepted') && !d.isDeleted && !d.treated
            );
            setPendingDevis(draftDevis);
        } catch (error) {
            console.error("Error fetching devis", error);
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
            let allNotes: any[] = [];
            if (Array.isArray(res.data)) {
                allNotes = res.data;
            } else if (res.data?.Data) {
                allNotes = res.data.Data;
            } else if (res.data?.data) {
                allNotes = res.data.data;
            }

            // Filter delivery notes linked to this devis
            const linkedNoteIds = allNotes
                .filter((dn: any) => dn.devisId === parseInt(devisId))
                .map((dn: any) => dn.id);

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
            console.error("Error fetching existing delivery notes", error);
        }
    };

    const handleDevisSelection = async (devisId: string) => {
        setSelectedDevisId(devisId);
        setTouched(prev => ({ ...prev, devisId: true }));

        if (!devisId) {
            setSelectedDevis(null);
            setExistingDeliveryNotes([]);
            setItems([{ description: '', quantity: 1, quotedQuantity: 0, remainingQuantity: 0 }]);
            return;
        }

        try {
            // Fetch devis details
            const res = await api.get(`/Devis/${devisId}`);
            const devis = res.data;
            setSelectedDevis(devis);

            // Fetch existing delivery notes for this devis
            await fetchExistingDeliveryNotes(devisId);

        } catch (error) {
            console.error("Error fetching devis details", error);
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
                    remainingQuantity: remaining
                };
            });

            // Filter out items with 0 remaining, but keep at least one
            const itemsToDeliver = newItems.filter(item => item.remainingQuantity > 0);
            setItems(itemsToDeliver.length > 0 ? itemsToDeliver : [{ description: '', quantity: 1, quotedQuantity: 0, remainingQuantity: 0 }]);
        }
    }, [selectedDevis, deliveredQuantitiesByDescription]);

    const addItem = () => {
        setItems([...items, { description: '', quantity: 1, quotedQuantity: 0, remainingQuantity: 0 }]);
    };

    const removeItem = (index: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof DeliveryItem, value: any) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
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
                currency: pdfCurrency || undefined,
                currencySymbol: pdfCurrencySymbol || undefined,
                pdfLanguage: pdfLanguage || undefined,
                deliveryNoteItems: items
                    .filter(item => item.description.trim() !== '')
                    .map(item => ({
                        description: item.description.trim(),
                        quantity: item.quantity
                    }))
            };

            await api.post('/DeliveryNotes', payload);
            navigate('/delivery-notes');
        } catch (error) {
            console.error("Error creating BL", error);
            alert("Failed to create Delivery Note");
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
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button onClick={() => navigate('/delivery-notes')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">New Delivery Note (BL)</h1>
                        <p className="text-gray-500 text-sm">Create a delivery note for shipment</p>
                    </div>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={loading || allFullyDelivered}
                    className="flex items-center px-6 py-3 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={20} className="mr-2" />
                    {loading ? 'Saving...' : 'Save BL'}
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-8 animate-fade-in text-gray-800">
                {/* Validation Summary - only show after submit */}
                {submitted && Object.keys(errors).length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start space-x-3">
                            <AlertCircle className="text-red-500 mt-0.5" size={20} />
                            <div>
                                <h4 className="font-semibold text-red-800">Please fix the following errors:</h4>
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
                                <h4 className="font-semibold text-amber-800">Info: Over-delivery detected</h4>
                                <p className="text-sm text-amber-700 mt-1">
                                    Some items exceed the remaining quantity to deliver. You can still save this delivery note.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Currency & Language Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-[#065F46]/5 border border-emerald-100 rounded-xl">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Document Currency</label>
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
                        <p className="text-xs text-gray-500 mt-1">Currency used on this delivery note's PDF</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">PDF Language</label>
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
                        <p className="text-xs text-gray-500 mt-1">Language used on this delivery note's PDF</p>
                    </div>
                </div>

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
                            <option value="">-- Select a Quote --</option>
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
                            <p className="text-sm text-amber-600 mt-2">No quotes available. Create a quote first.</p>
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
                                            <p className="text-xs font-semibold text-[#065F46] uppercase">Items:</p>
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
                                                                        Done
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
                                    <h4 className="font-semibold text-green-800">All items fully delivered!</h4>
                                    <p className="text-sm text-green-700">This quote has no remaining items to deliver.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            BL Date <span className="text-red-500">*</span>
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
                            Previous Delivery Notes ({existingDeliveryNotes.length})
                        </h3>
                        <p className="text-sm text-gray-500 mb-3">
                            Delivery notes already created for this quote:
                        </p>
                        <div className="space-y-3">
                            {existingDeliveryNotes.map(dn => (
                                <div key={dn.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-amber-800">BL #{dn.number}</span>
                                        <div className="flex items-center space-x-3 text-sm text-amber-600">
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
                        BL Items <span className="text-red-500 ml-1">*</span>
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
                                    <div className="col-span-2 md:col-span-8">
                                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
                                        <input
                                            type="text"
                                            value={item.description}
                                            onChange={e => updateItem(index, 'description', e.target.value)}
                                            onBlur={() => handleBlur('items')}
                                            className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#065F46] ${item.description.trim() === '' && touched.items ? 'border-amber-400' : 'border-gray-200'
                                                }`}
                                        />
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
                                            <p className="text-xs text-amber-600 mt-1">Exceeds quoted qty</p>
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
                        <Plus size={18} className="mr-1" /> Add Item
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    X, FileText, User, DollarSign, CreditCard, Package, 
    ClipboardList, Truck, CheckCircle, AlertCircle, Clock, Edit2,
    Download, Mail, History, Receipt
} from 'lucide-react';
import api from '../services/api';

interface Payment {
    id: number;
    amount: number;
    paymentDate: string;
    notes?: string;
    status?: string;
    isScheduled?: boolean;
}

interface InvoiceItem {
    id: number;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    vat?: number;
}

interface RelatedDevis {
    id: number;
    number: number;
    date: string;
    totalAmount: number;
    status: string;
}

interface RelatedDeliveryNote {
    id: number;
    number: number;
    date: string;
    status: string;
}

interface InvoiceDetails {
    id: number;
    number: number;
    date: string;
    dueDate?: string;
    totalAmount: number;
    totalHT: number;
    totalTVA: number;
    timbreFiscal?: number;
    clientId: number;
    clientName: string;
    clientAddress?: string;
    clientEmail?: string;
    clientPhone?: string;
    status: string;
    isLocked: boolean;
    treated: boolean;
    amountPaid: number;
    remainingAmount: number;
    payments: Payment[];
    items: InvoiceItem[];
    devisId?: number;
    relatedDevis?: RelatedDevis;
    relatedDeliveryNotes?: RelatedDeliveryNote[];
    createdAt: string;
    updatedAt?: string;
    createdByUserName?: string;
    notes?: string;
}

interface Props {
    invoiceId: number;
    onClose: () => void;
    onEdit?: (id: number) => void;
    onDownloadPdf?: (id: number, number: number) => void;
    onSendEmail?: (invoice: any) => void;
    isManager?: boolean;
}

export default function InvoiceDetailView({ 
    invoiceId, 
    onClose, 
    onEdit, 
    onDownloadPdf, 
    onSendEmail,
    isManager = false 
}: Props) {
    const { t } = useTranslation();
    const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'items' | 'payments' | 'related'>('details');

    useEffect(() => {
        fetchInvoiceDetails();
    }, [invoiceId]);

    const fetchInvoiceDetails = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/Invoices/${invoiceId}/details`);
            setInvoice(res.data);
        } catch (err: any) {
            console.error('Error fetching invoice details:', err);
            // Fallback to basic invoice data
            try {
                const basicRes = await api.get(`/Invoices/${invoiceId}`);
                setInvoice({
                    ...basicRes.data,
                    items: basicRes.data.items || [],
                    payments: basicRes.data.payments || [],
                    relatedDeliveryNotes: []
                });
            } catch (fallbackErr) {
                setError('Failed to load invoice details');
            }
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { bg: string; text: string; icon: any }> = {
            'Paid': { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: CheckCircle },
            'Partial': { bg: 'bg-amber-100', text: 'text-amber-800', icon: Clock },
            'Pending': { bg: 'bg-blue-100', text: 'text-blue-800', icon: AlertCircle },
            'Overdue': { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle },
            'Cancelled': { bg: 'bg-gray-100', text: 'text-gray-800', icon: X },
        };
        const config = statusConfig[status] || statusConfig['Pending'];
        const Icon = config.icon;
        return (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
                <Icon size={14} className="mr-1" />
                {status}
            </span>
        );
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-TN', {
            style: 'decimal',
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        }).format(amount) + ' TND';
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                </div>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
                    <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
                    <p className="text-gray-600 mb-4">{error || 'Failed to load invoice'}</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'details', label: t('invoice.details') || 'Details', icon: FileText },
        { id: 'items', label: t('invoice.items') || 'Items', icon: Package },
        { id: 'payments', label: t('invoice.payments') || 'Payments', icon: CreditCard },
        { id: 'related', label: t('invoice.relatedDocs') || 'Related Docs', icon: ClipboardList }
    ] as const;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-scale-up">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                            <Receipt className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {t('invoice.title')} #{invoice.number}
                            </h2>
                            <p className="text-indigo-200 text-sm">
                                {invoice.clientName} • {formatDate(invoice.date)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {getStatusBadge(invoice.status)}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors ml-4"
                        >
                            <X className="text-white" size={20} />
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-3 bg-gray-50 border-b flex items-center space-x-3">
                    {isManager && !invoice.isLocked && (
                        <button
                            onClick={() => onEdit?.(invoice.id)}
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            <Edit2 size={16} className="mr-2" />
                            {t('common.edit')}
                        </button>
                    )}
                    <button
                        onClick={() => onDownloadPdf?.(invoice.id, invoice.number)}
                        className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <Download size={16} className="mr-2" />
                        {t('common.download')} PDF
                    </button>
                    <button
                        onClick={() => onSendEmail?.(invoice)}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Mail size={16} className="mr-2" />
                        {t('email.send')}
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b">
                    <div className="flex space-x-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-indigo-600 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <tab.icon size={16} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'details' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Invoice Info */}
                            <div className="bg-gray-50 rounded-xl p-5">
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                    <FileText size={18} className="mr-2 text-indigo-600" />
                                    {t('invoice.info')}
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">{t('invoice.number')}:</span>
                                        <span className="font-medium">#{invoice.number}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">{t('invoice.date')}:</span>
                                        <span className="font-medium">{formatDate(invoice.date)}</span>
                                    </div>
                                    {invoice.dueDate && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">{t('invoice.dueDate')}:</span>
                                            <span className="font-medium">{formatDate(invoice.dueDate)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">{t('invoice.status')}:</span>
                                        {getStatusBadge(invoice.status)}
                                    </div>
                                    {invoice.createdByUserName && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">{t('common.createdBy')}:</span>
                                            <span className="font-medium">{invoice.createdByUserName}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Client Info */}
                            <div className="bg-gray-50 rounded-xl p-5">
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                    <User size={18} className="mr-2 text-indigo-600" />
                                    {t('common.client')}
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">{t('common.name')}:</span>
                                        <span className="font-medium">{invoice.clientName}</span>
                                    </div>
                                    {invoice.clientAddress && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">{t('common.address')}:</span>
                                            <span className="font-medium text-right max-w-[60%]">{invoice.clientAddress}</span>
                                        </div>
                                    )}
                                    {invoice.clientEmail && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">{t('common.email')}:</span>
                                            <a href={`mailto:${invoice.clientEmail}`} className="font-medium text-indigo-600 hover:underline">
                                                {invoice.clientEmail}
                                            </a>
                                        </div>
                                    )}
                                    {invoice.clientPhone && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">{t('common.phone')}:</span>
                                            <span className="font-medium">{invoice.clientPhone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 lg:col-span-2">
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                    <DollarSign size={18} className="mr-2 text-indigo-600" />
                                    {t('invoice.financial')}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-gray-500">{t('invoice.totalHT')}</p>
                                        <p className="text-xl font-bold text-gray-900">{formatCurrency(invoice.totalHT || 0)}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-gray-500">{t('invoice.tva')}</p>
                                        <p className="text-xl font-bold text-gray-900">{formatCurrency(invoice.totalTVA || 0)}</p>
                                    </div>
                                    {invoice.timbreFiscal !== undefined && invoice.timbreFiscal > 0 && (
                                        <div className="bg-white rounded-lg p-4 shadow-sm">
                                            <p className="text-sm text-gray-500">{t('invoice.timbre')}</p>
                                            <p className="text-xl font-bold text-gray-900">{formatCurrency(invoice.timbreFiscal)}</p>
                                        </div>
                                    )}
                                    <div className="bg-indigo-600 rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-indigo-200">{t('invoice.totalTTC')}</p>
                                        <p className="text-xl font-bold text-white">{formatCurrency(invoice.totalAmount)}</p>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-3 gap-4">
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-gray-500">{t('invoice.paid')}</p>
                                        <p className="text-xl font-bold text-emerald-600">{formatCurrency(invoice.amountPaid || 0)}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-gray-500">{t('invoice.remaining')}</p>
                                        <p className="text-xl font-bold text-amber-600">{formatCurrency(invoice.remainingAmount || 0)}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-gray-500">{t('invoice.paymentProgress')}</p>
                                        <div className="mt-2">
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                                    style={{ width: `${Math.min(100, (invoice.amountPaid / invoice.totalAmount) * 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {Math.round((invoice.amountPaid / invoice.totalAmount) * 100)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {invoice.notes && (
                                <div className="bg-yellow-50 rounded-xl p-5 lg:col-span-2">
                                    <h3 className="font-semibold text-gray-900 mb-2">{t('common.notes')}</h3>
                                    <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'items' && (
                        <div className="bg-white rounded-xl border overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">#</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">{t('item.description')}</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">{t('item.quantity')}</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">{t('item.unitPrice')}</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">{t('item.vat')}</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">{t('item.total')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {invoice.items && invoice.items.length > 0 ? (
                                        invoice.items.map((item, index) => (
                                            <tr key={item.id || index} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                                                <td className="px-4 py-3 text-gray-900 font-medium">{item.description}</td>
                                                <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                                                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.unitPrice)}</td>
                                                <td className="px-4 py-3 text-right text-gray-700">{item.vat ? `${(item.vat * 100).toFixed(0)}%` : '0%'}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.totalPrice)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                                {t('invoice.noItems')}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-right font-semibold">{t('invoice.total')}:</td>
                                        <td className="px-4 py-3 text-right font-bold text-indigo-600">{formatCurrency(invoice.totalAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className="space-y-4">
                            {/* Payment Summary */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-indigo-50 rounded-xl p-4 text-center">
                                    <p className="text-sm text-indigo-600">{t('invoice.totalTTC')}</p>
                                    <p className="text-2xl font-bold text-indigo-900">{formatCurrency(invoice.totalAmount)}</p>
                                </div>
                                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                                    <p className="text-sm text-emerald-600">{t('invoice.totalPaid')}</p>
                                    <p className="text-2xl font-bold text-emerald-900">{formatCurrency(invoice.amountPaid || 0)}</p>
                                </div>
                                <div className="bg-amber-50 rounded-xl p-4 text-center">
                                    <p className="text-sm text-amber-600">{t('invoice.remaining')}</p>
                                    <p className="text-2xl font-bold text-amber-900">{formatCurrency(invoice.remainingAmount || 0)}</p>
                                </div>
                            </div>

                            {/* Payment History */}
                            <div className="bg-white rounded-xl border">
                                <div className="px-4 py-3 border-b flex items-center">
                                    <History size={18} className="mr-2 text-indigo-600" />
                                    <h3 className="font-semibold">{t('payment.history')}</h3>
                                </div>
                                {invoice.payments && invoice.payments.length > 0 ? (
                                    <div className="divide-y">
                                        {invoice.payments.map((payment, index) => (
                                            <div key={payment.id || index} className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                                                <div className="flex items-center space-x-4">
                                                    <div className={`p-2 rounded-lg ${payment.status === 'Completed' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                                                        {payment.isScheduled ? (
                                                            <Clock size={18} className="text-amber-600" />
                                                        ) : (
                                                            <CheckCircle size={18} className="text-emerald-600" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                                                        <p className="text-sm text-gray-500">
                                                            {formatDate(payment.paymentDate)}
                                                            {payment.isScheduled && (
                                                                <span className="ml-2 text-amber-600">({t('payment.scheduled')})</span>
                                                            )}
                                                        </p>
                                                        {payment.notes && (
                                                            <p className="text-sm text-gray-400 mt-1">{payment.notes}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                    payment.status === 'Completed' 
                                                        ? 'bg-emerald-100 text-emerald-800' 
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {payment.status || 'Completed'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="px-4 py-8 text-center text-gray-500">
                                        <CreditCard size={32} className="mx-auto mb-2 text-gray-300" />
                                        <p>{t('payment.noPayments')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'related' && (
                        <div className="space-y-6">
                            {/* Related Quote */}
                            <div className="bg-white rounded-xl border overflow-hidden">
                                <div className="px-4 py-3 border-b flex items-center bg-blue-50">
                                    <ClipboardList size={18} className="mr-2 text-blue-600" />
                                    <h3 className="font-semibold text-blue-900">{t('invoice.relatedQuote')}</h3>
                                </div>
                                {invoice.relatedDevis ? (
                                    <div className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {t('quote.title')} #{invoice.relatedDevis.number}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {formatDate(invoice.relatedDevis.date)} • {formatCurrency(invoice.relatedDevis.totalAmount)}
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            invoice.relatedDevis.status === 'Accepted' 
                                                ? 'bg-emerald-100 text-emerald-800' 
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {invoice.relatedDevis.status}
                                        </span>
                                    </div>
                                ) : invoice.devisId ? (
                                    <div className="p-4 text-gray-600">
                                        <p>{t('quote.linkedId')}: #{invoice.devisId}</p>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-500">
                                        <ClipboardList size={32} className="mx-auto mb-2 text-gray-300" />
                                        <p>{t('invoice.noRelatedQuote')}</p>
                                    </div>
                                )}
                            </div>

                            {/* Related Delivery Notes */}
                            <div className="bg-white rounded-xl border overflow-hidden">
                                <div className="px-4 py-3 border-b flex items-center bg-purple-50">
                                    <Truck size={18} className="mr-2 text-purple-600" />
                                    <h3 className="font-semibold text-purple-900">{t('invoice.relatedDeliveryNotes')}</h3>
                                </div>
                                {invoice.relatedDeliveryNotes && invoice.relatedDeliveryNotes.length > 0 ? (
                                    <div className="divide-y">
                                        {invoice.relatedDeliveryNotes.map((note, index) => (
                                            <div key={note.id || index} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                                <div>
                                                    <p className="font-medium text-gray-900">
                                                        {t('deliveryNote.title')} #{note.number}
                                                    </p>
                                                    <p className="text-sm text-gray-500">{formatDate(note.date)}</p>
                                                </div>
                                                <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                                                    {note.status || 'Delivered'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-500">
                                        <Truck size={32} className="mx-auto mb-2 text-gray-300" />
                                        <p>{t('invoice.noRelatedDeliveryNotes')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

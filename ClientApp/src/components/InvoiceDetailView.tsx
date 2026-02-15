import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    X, FileText, User, DollarSign, CreditCard, Package,
    ClipboardList, Truck, CheckCircle, AlertCircle, Clock, Edit2,
    Download, Mail, History, Receipt, Lock, FileWarning, Trash2
} from 'lucide-react';
import api from '../services/api';
import { formatCurrency as fmtCurrency } from '../lib/formatNumber';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';

interface Payment {
    id: number;
    amount: number;
    paymentDate: string;
    notes?: string;
    status?: string;
    isScheduled?: boolean;
    ConfirmedBy?: string;
    handledByName?: string;
    ConfirmedAt?: string;
    CreatedBy?: string;
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
    number: string;
    date: string;
    totalAmount: number;
    status: string;
}

interface RelatedDeliveryNote {
    id: number;
    number: string;
    date: string;
    status: string;
}

interface InvoiceDetails {
    id: number;
    number?: string;
    Number?: string;
    invoiceNumber?: string;
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
    TreatedBy?: string;
    TreatedAt?: string;
    amountPaid: number;
    pendingAmount: number;
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
    currency?: string;
    currencySymbol?: string;
}

interface Props {
    invoiceId: number;
    onClose: () => void;
    onEdit?: (id: number) => void;
    onDownloadPdf?: (id: number, number: string) => void;
    onSendEmail?: (invoice: InvoiceDetails) => void;
    onDelete?: (id: number) => void;
    isManager?: boolean;
}

export default function InvoiceDetailView({
    invoiceId,
    onClose,
    onEdit,
    onDownloadPdf,
    onSendEmail,
    onDelete,
    isManager = false
}: Props) {
    const { t } = useTranslation();
    const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloadingRemainingPdf, setDownloadingRemainingPdf] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'items' | 'payments' | 'related'>('details');

    useEffect(() => {
        const fetchInvoiceDetails = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/Invoices/${invoiceId}/details`);
                setInvoice(res.data);
            } catch (err: unknown) {
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
                } catch {
                    setError('Failed to load invoice details');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchInvoiceDetails();
    }, [invoiceId]);
        
    // 2. Calculate percentage safely
    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
            'Paid': { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: CheckCircle },
            'PartiallyPaid': { bg: 'bg-blue-100', text: 'text-blue-800', icon: Clock },
            'Pending': { bg: 'bg-amber-100', text: 'text-amber-800', icon: AlertCircle },
            'Archived': { bg: 'bg-slate-100', text: 'text-slate-800', icon: CheckCircle },
            'Cancelled': { bg: 'bg-gray-100', text: 'text-gray-800', icon: X },
        };
        const config = statusConfig[status] || statusConfig['Pending'];
        const Icon = config.icon;
        return (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
                <Icon size={14} className="me-1" />
                {t(`invoice.status.${status}`, status)}
            </span>
        );
    };

    // Use per-document currency, falling back to 'TND'
    const getCurrencySymbol = () => invoice?.currencySymbol || DEFAULT_CURRENCY;

    const formatCurrency = (amount: number) => {
        return fmtCurrency(amount, getCurrencySymbol());
    };

    const resolveInvoiceNumber = (inv: InvoiceDetails | null) => {
        if (!inv) return '';
        return inv.number || inv.Number || inv.invoiceNumber || String(inv.id);
    };

    // Edit lock: cannot edit once ANY payment has been registered  
    const hasPayments = invoice ? (invoice.payments && invoice.payments.length > 0) : false;
    const canEdit = isManager && !invoice?.isLocked && !hasPayments && invoice?.status !== 'Paid' && invoice?.status !== 'PartiallyPaid';

    const handleDeletePayment = async (paymentId: number) => {
        if (!invoice) return;
        if (!confirm(t('payment.confirmDelete', 'Are you sure you want to delete this payment?'))) return;
        try {
            const res = await api.delete(`/Invoices/${invoice.id}/payments/${paymentId}`);
            // Update local state with new data
            setInvoice(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    payments: prev.payments.filter(p => p.id !== paymentId),
                    status: res.data.status,
                    amountPaid: res.data.amountPaid,
                    pendingAmount: res.data.pendingAmount ?? 0,
                    remainingAmount: res.data.remainingAmount,
                    isLocked: res.data.status === 'Paid'
                };
            });
        } catch (err) {
            console.error('Error deleting payment:', err);
            alert(t('payment.deleteFailed', 'Failed to delete payment'));
        }
    };
    // 1. Force conversion and provide fallbacks
            const total = Number(invoice?.totalAmount || 0);
            const paid = Number(invoice?.amountPaid || 0);
            const percentage = total > 0 ? Number(Math.min(100, (paid / total) * 100) ): 0;
            const percentageDisplay = Number(percentage.toFixed(1)) * 100 ;
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
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#065F46] border-t-transparent"></div>
                </div>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
                    <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('common.error')}</h3>
                    <p className="text-gray-600 mb-4">{error || t('createPage.loadFailed')}</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'details', label: t('invoice.details') || 'Details', icon: FileText },
        { id: 'items', label: t('invoice.items') || 'Items', icon: Package },
        { id: 'payments', label: t('invoice.payments.label') || 'Payments', icon: CreditCard },
        { id: 'related', label: t('invoice.relatedDocs') || 'Related Docs', icon: ClipboardList }
    ] as const;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:max-w-5xl md:h-[90vh] flex flex-col overflow-hidden animate-scale-up">
                {/* Header */}
                <div className="bg-[#065F46] px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                            <Receipt className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {t('invoice.title')} #{resolveInvoiceNumber(invoice)}
                            </h2>
                            <p className="text-white/70 text-sm">
                                {invoice.clientName} • {formatDate(invoice.date)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {getStatusBadge(invoice.status)}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors ms-4"
                        >
                            <X className="text-white" size={20} />
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b flex flex-wrap items-center gap-2 sm:gap-3 overflow-x-auto">
                    {canEdit ? (
                        <button
                            onClick={() => onEdit?.(invoice.id)}
                            className="flex items-center px-3 sm:px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#047857] transition-colors text-sm whitespace-nowrap"
                        >
                            <Edit2 size={16} className="me-2" />
                            {t('common.edit')}
                        </button>
                    ) : hasPayments && isManager ? (
                        <div className="flex items-center px-3 sm:px-4 py-2 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed text-sm whitespace-nowrap">
                            <Lock size={16} className="me-2" />
                            {t('invoice.payments.lockedMessage', 'Payments locked')}
                        </div>
                    ) : null}
                    <button
                        onClick={() => onDownloadPdf?.(invoice.id, resolveInvoiceNumber(invoice))}
                        className="flex items-center px-3 sm:px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#047857] transition-colors text-sm whitespace-nowrap"
                    >
                        <Download size={16} className="me-2" />
                        <span className="hidden sm:inline">{t('common.download')}</span> PDF
                    </button>
                    <button
                        onClick={() => onSendEmail?.(invoice)}
                        className="flex items-center px-3 sm:px-4 py-2 bg-[#0D9488] text-white rounded-lg hover:bg-[#0F766E] transition-colors text-sm whitespace-nowrap"
                    >
                        <Mail size={16} className="me-2" />
                        {t('email.send')}
                    </button>
                    {/* Remaining Payment PDF - only for partially paid / pending with balance */}
                    {(invoice.status === 'PartiallyPaid' || (invoice.status === 'Pending' && invoice.remainingAmount > 0)) && (
                        <button
                            onClick={async () => {
                                if (downloadingRemainingPdf) return;
                                setDownloadingRemainingPdf(true);
                                try {
                                    const res = await api.get(`/Invoices/${invoice.id}/remaining-payment-pdf`, { responseType: 'blob' });
                                    const url = window.URL.createObjectURL(new Blob([res.data]));
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', `Reste_a_payer_${resolveInvoiceNumber(invoice) ?? invoice.id}.pdf`);
                                    document.body.appendChild(link);
                                    link.click();
                                    link.remove();
                                    window.URL.revokeObjectURL(url);
                                } catch (err) {
                                    console.error('Error downloading remaining payment PDF', err);
                                } finally {
                                    setDownloadingRemainingPdf(false);
                                }
                            }}
                            disabled={downloadingRemainingPdf}
                            className="flex items-center px-3 sm:px-4 py-2 bg-[#059669] text-white rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                            title={t('invoice.remainingPaymentPdf', 'Remaining Payment Notice')}
                        >
                            <FileWarning size={16} className="me-2" />
                            <span className="hidden sm:inline">{t('invoice.remainingPaymentPdf', 'Remaining Payment Notice')}</span>
                            <span className="sm:hidden">Notice</span>
                        </button>
                    )}
                    {/* Delete button - Manager only, not locked, not paid */}
                    {isManager && !invoice.isLocked && invoice.status !== 'Paid' && onDelete && (
                        <button
                            onClick={() => {
                                if (confirm(t('invoice.messages.confirmDelete'))) {
                                    onDelete(invoice.id);
                                }
                            }}
                            className="flex items-center px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm whitespace-nowrap"
                            title={t('common.delete')}
                        >
                            <Trash2 size={16} className="me-2" />
                            {t('common.delete')}
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="px-6 border-b">
                    <div className="flex space-x-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium transition-colors ${activeTab === tab.id
                                    ? 'border-[#065F46] text-[#065F46]'
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
                                    <FileText size={18} className="me-2 text-[#065F46]" />
                                    {t('invoice.info')}
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">{t('invoice.number')}:</span>
                                        <span className="font-medium">#{resolveInvoiceNumber(invoice)}</span>
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
                                    <div className="flex justify-between items-start">
                                        <span className="text-gray-600 mt-1">{t('invoice.statusLabel')}:</span>
                                        <div className="text-right">
                                            {getStatusBadge(invoice.status)}
                                            {invoice.TreatedBy && (
                                                <div className="text-xs text-stone-500 mt-1">
                                                    {t('common.archivedBy', 'Archived by')} {invoice.TreatedBy}
                                                    {invoice.TreatedAt && ` (${formatDate(invoice.TreatedAt)})`}
                                                </div>
                                            )}
                                        </div>
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
                                    <User size={18} className="me-2 text-[#065F46]" />
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
                                            <a href={`mailto:${invoice.clientEmail}`} className="font-medium text-[#065F46] hover:underline">
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
                            <div className="bg-[#065F46]/5 rounded-xl p-5 lg:col-span-2">
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                    <DollarSign size={18} className="me-2 text-[#065F46]" />
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
                                    <div className="bg-[#065F46] rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-white/70">{t('invoice.totalTTC')}</p>
                                        <p className="text-xl font-bold text-white">{formatCurrency(invoice.totalAmount)}</p>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-gray-500">{t('invoice.paid')}</p>
                                        <p className="text-xl font-bold text-emerald-600">{formatCurrency(invoice.amountPaid || 0)}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-gray-500">{t('invoice.remaining')}</p>
                                        <p className="text-xl font-bold text-amber-600">{formatCurrency(invoice.remainingAmount || 0)}</p>
                                    </div>
                                    {(invoice.pendingAmount || 0) > 0 && (
                                    <div className="bg-orange-50 rounded-xl shadow-sm p-4 text-center">
                                        <p className="text-sm text-orange-600">{t('invoice.pendingBalance')}</p>
                                        <p className="text-2xl font-bold text-orange-900">{formatCurrency(invoice.pendingAmount)}</p>
                                    </div>
                                    )}
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-gray-500">{t('invoice.paymentProgress')}</p>
                                        <div className="mt-2">
                                            {/* Progress = (AmountPaid / TotalAmount) * 100, guarded against zero */}
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                                    style={{ width: percentageDisplay }}
                                                    />
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {percentageDisplay} %
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
                                        <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">#</th>
                                        <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">{t('invoice.description', 'Description')}</th>
                                        <th className="px-4 py-3 text-end text-sm font-semibold text-gray-600">{t('invoice.qty', 'Qty')}</th>
                                        <th className="px-4 py-3 text-end text-sm font-semibold text-gray-600">{t('invoice.unitPrice', 'Unit Price')}</th>
                                        <th className="px-4 py-3 text-end text-sm font-semibold text-gray-600">{t('invoice.taxRate', 'Tax %')}</th>
                                        <th className="px-4 py-3 text-end text-sm font-semibold text-gray-600">{t('invoice.total', 'Total')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {invoice.items && invoice.items.length > 0 ? (
                                        invoice.items.map((item, index) => (
                                            <tr key={item.id || index} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                                                <td className="px-4 py-3 text-gray-900 font-medium">{item.description}</td>
                                                <td className="px-4 py-3 text-end text-gray-700">{item.quantity}</td>
                                                <td className="px-4 py-3 text-end text-gray-700">{formatCurrency(item.unitPrice)}</td>
                                                <td className="px-4 py-3 text-end text-gray-700">{item.vat ? `${(item.vat * 100).toFixed(0)}%` : '0%'}</td>
                                                <td className="px-4 py-3 text-end font-semibold text-gray-900">{formatCurrency(item.totalPrice)}</td>
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
                                        <td colSpan={5} className="px-4 py-3 text-end font-semibold">{t('invoice.total')}:</td>
                                        <td className="px-4 py-3 text-end font-bold text-[#065F46]">{formatCurrency(invoice.totalAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className="space-y-4">
                            {/* Payment Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-[#065F46]/5 rounded-xl p-4 text-center">
                                    <p className="text-sm text-[#065F46]">{t('invoice.totalTTC')}</p>
                                    <p className="text-2xl font-bold text-[#065F46]">{formatCurrency(invoice.totalAmount)}</p>
                                </div>
                                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                                    <p className="text-sm text-emerald-600">{t('invoice.totalPaid')}</p>
                                    <p className="text-2xl font-bold text-emerald-900">{formatCurrency(invoice.amountPaid || 0)}</p>
                                    {(invoice.pendingAmount || 0) > 0 && (
                                        <p className="text-xs text-orange-500 mt-1">
                                            {t('invoice.pending')}: {formatCurrency(invoice.pendingAmount)}
                                        </p>
                                    )}
                                </div>
                                <div className="bg-amber-50 rounded-xl p-4 text-center">
                                    <p className="text-sm text-amber-600">{t('invoice.remaining')}</p>
                                    <p className="text-2xl font-bold text-amber-900">{formatCurrency(invoice.remainingAmount || 0)}</p>
                                </div>
                            </div>

                            {/* Payment History */}
                            <div className="bg-white rounded-xl border">
                                <div className="px-4 py-3 border-b flex items-center">
                                    <History size={18} className="me-2 text-[#065F46]" />
                                    <h3 className="font-semibold">{t('invoice.paymentHistory', 'Payment History')}</h3>
                                </div>
                                {invoice.payments && invoice.payments.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-start">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold text-gray-600 text-sm text-start">{t('invoice.paymentAmount')}</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600 text-sm text-start">{t('invoice.date')}</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600 text-sm text-start">{t('invoice.handledBy')}</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600 text-sm text-start">{t('invoice.statusLabel')}</th>
                                                    {isManager && <th className="px-4 py-3 font-semibold text-gray-600 text-sm text-end">{t('common.actions')}</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {invoice.payments.map((payment, index) => (
                                                    <tr key={payment.id || index} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`p-1.5 rounded-lg ${payment.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                                    {payment.isScheduled ? <Clock size={16} /> : <CheckCircle size={16} />}
                                                                </div>
                                                                <span className="font-medium text-gray-900">{formatCurrency(payment.amount)}</span>
                                                            </div>
                                                            {payment.notes && <p className="text-xs text-gray-400 mt-0.5 ml-8">{payment.notes}</p>}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                            {formatDate(payment.paymentDate)}
                                                            {payment.isScheduled && <span className="ms-1 text-amber-600 text-xs">({t('payment.scheduled')})</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                            {payment.handledByName ? (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <User size={14} className="text-gray-400" />
                                                                    {payment.handledByName}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 italic">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${payment.status === 'Completed'
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : 'bg-amber-100 text-amber-800'
                                                                }`}>
                                                                {t(`payment.${(payment.status || 'Completed').toLowerCase()}`)}
                                                            </span>
                                                        </td>
                                                        {isManager && (
                                                            <td className="px-4 py-3 text-end">
                                                                <button
                                                                    onClick={() => handleDeletePayment(payment.id)}
                                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title={t('common.delete')}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="px-4 py-8 text-center text-gray-500">
                                        <CreditCard size={32} className="mx-auto mb-2 text-gray-300" />
                                        <p>{t('invoice.noPayments', 'No payments recorded')}</p>
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
                                    <ClipboardList size={18} className="me-2 text-blue-600" />
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
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${invoice.relatedDevis.status === 'Accepted'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {invoice.relatedDevis.status}
                                        </span>
                                    </div>
                                ) : invoice.devisId ? (
                                    <div className="p-4 text-gray-600">
                                        <p>{t('invoice.linkedQuote', 'Linked Quote')}: #{invoice.devisId}</p>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-500">
                                        <ClipboardList size={32} className="mx-auto mb-2 text-gray-300" />
                                        <p>{t('invoice.noRelatedQuote', 'No linked quote')}</p>
                                    </div>
                                )}
                            </div>

                            {/* Related Delivery Notes */}
                            <div className="bg-white rounded-xl border overflow-hidden">
                                <div className="px-4 py-3 border-b flex items-center bg-[#065F46]/5">
                                    <Truck size={18} className="me-2 text-[#065F46]" />
                                    <h3 className="font-semibold text-[#065F46]">{t('invoice.relatedDeliveryNotes', 'Related Delivery Notes')}</h3>
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
                                                <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#065F46]/10 text-[#065F46]">
                                                    {note.status || 'Delivered'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-500">
                                        <Truck size={32} className="mx-auto mb-2 text-gray-300" />
                                        <p>{t('invoice.noRelatedDeliveryNotes', 'No linked delivery notes')}</p>
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

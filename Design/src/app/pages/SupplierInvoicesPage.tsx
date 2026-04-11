import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Trash2, Search, DollarSign, Calendar, Clock, Filter, Archive, Eye, CheckCircle } from 'lucide-react';
import { useSupplierInvoices, useDeleteSupplierInvoice } from '../hooks/useSupplierInvoices';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/formatNumber';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { getErrorMessage } from '../utils/errorUtils';

interface SupplierInvoice {
    id: number;
    fileName: string;
    invoiceNumber: string;
    invoiceDate: string | null;
    dueDate: string | null;
    totalHT: number | null;
    totalTTC: number | null;
    tva: number | null;
    supplierName: string | null;
    supplierId: number | null;
    amountPaid: number;
    remainingAmount: number;
    paymentStatus: string;
    paymentCount: number;
    currency?: string;
    currencySymbol?: string;
}

const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
        case 'paid':
            return 'bg-green-100 text-green-700';
        case 'pending':
            return 'bg-yellow-100 text-yellow-700';
        case 'overdue':
            return 'bg-red-100 text-red-700';
        case 'partial':
            return 'bg-orange-100 text-orange-700';
        default:
            return 'bg-gray-100 text-gray-700';
    }
};

export default function SupplierInvoicesPage() {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const { isManager } = useAuth();
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [search, setSearch] = useState('');

    // React Query
    const { data: invoices, isLoading: loading } = useSupplierInvoices();
    const deleteInvoiceMutation = useDeleteSupplierInvoice();

    const handleDelete = async (id: number) => {
        if (!isManager) {
            notify('warning', t('common.managerOnly'));
            return;
        }
        if (!confirm(t('supplierInvoice.confirmDelete', 'Are you sure you want to delete this supplier invoice?'))) return;
        try {
            await deleteInvoiceMutation.mutateAsync(id);
            notify('success', t('supplierInvoice.deleteSuccess', 'Supplier invoice deleted successfully'));
        } catch (error) {
            logger.error('Error deleting supplier invoice', error);
            notify('error', getErrorMessage(error, t('supplierInvoice.deleteFailed', 'Failed to delete supplier invoice')));
        }
    };

    const filteredInvoices = (invoices || []).filter((inv: SupplierInvoice) => {
        const searchMatch =
            inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
            inv.supplierName?.toLowerCase().includes(search.toLowerCase());
        const isPaid = inv.paymentStatus?.toLowerCase() === 'paid';
        if (viewMode === 'active') return searchMatch && !isPaid;
        return searchMatch && isPaid;
    });

    const activeCount = (invoices || []).filter((inv: SupplierInvoice) => inv.paymentStatus?.toLowerCase() !== 'paid').length;
    const archivedCount = (invoices || []).filter((inv: SupplierInvoice) => inv.paymentStatus?.toLowerCase() === 'paid').length;

    // Calculate summary
    const totalAmount = filteredInvoices.reduce((sum: number, inv: SupplierInvoice) => sum + (inv.totalTTC || 0), 0);
    const totalPaid = filteredInvoices.reduce((sum: number, inv: SupplierInvoice) => sum + (inv.amountPaid || 0), 0);
    const totalRemaining = filteredInvoices.reduce((sum: number, inv: SupplierInvoice) => sum + (inv.remainingAmount || 0), 0);

    return (
        <div className="space-y-6">
            <NotifyBanner />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">📥 {t('nav.supplierInvoices', 'Supplier Invoices')}</h1>
                    <p className="text-gray-500 mt-1">{t('supplierInvoice.pageDescription', 'Manage invoices from your suppliers')}</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 rounded-lg">
                            <DollarSign size={24} className="text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('supplierInvoice.totalAmount', 'Total Amount')}</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount, DEFAULT_CURRENCY)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <CheckCircle size={24} className="text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('supplierInvoice.totalPaid', 'Total Paid')}</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPaid, DEFAULT_CURRENCY)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-orange-100 rounded-lg">
                            <Clock size={24} className="text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('supplierInvoice.remaining', 'Remaining')}</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRemaining, DEFAULT_CURRENCY)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('supplierInvoice.searchPlaceholder', 'Search by invoice number or supplier...')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none transition-all"
                    />
                </div>
                {isManager && (
                    <div className="flex flex-wrap p-1 bg-gray-100 rounded-xl">
                        <button
                            onClick={() => setViewMode('active')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                viewMode === 'active' ? 'bg-white shadow-sm text-[#065F46]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Filter size={16} />
                            {t('supplierInvoice.pending', 'Pending')} ({activeCount})
                        </button>
                        <button
                            onClick={() => setViewMode('archived')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                viewMode === 'archived' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Archive size={16} />
                            {t('supplierInvoice.paid', 'Paid')} ({archivedCount})
                        </button>
                    </div>
                )}
            </div>

            {/* Table */}
            {loading ? (
                <div className="text-center py-20 text-gray-500">{t('supplierInvoice.loading', 'Loading...')}</div>
            ) : (
                <div className="rm-table-card">
                    <div className="overflow-x-auto">
                        <table className="rm-table">
                            <thead>
                                <tr>
                                    <th>{t('supplierInvoice.invoiceNumber', 'Invoice #')}</th>
                                    <th>{t('supplierInvoice.supplier', 'Supplier')}</th>
                                    <th>{t('supplierInvoice.date', 'Date')}</th>
                                    <th>{t('supplierInvoice.dueDate', 'Due Date')}</th>
                                    <th className="text-right">{t('supplierInvoice.amount', 'Amount')}</th>
                                    <th className="text-right">{t('supplierInvoice.paid', 'Paid')}</th>
                                    <th className="text-right">{t('supplierInvoice.remaining', 'Remaining')}</th>
                                    <th>{t('supplierInvoice.status', 'Status')}</th>
                                    {isManager && <th className="text-right">{t('common.actions', 'Actions')}</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.map((invoice: SupplierInvoice) => (
                                    <tr key={invoice.id}>
                                        <td className="font-medium">{invoice.invoiceNumber}</td>
                                        <td>{invoice.supplierName || t('common.unknown', 'Unknown')}</td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-gray-400" />
                                                <span>{invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : '-'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-gray-400" />
                                                <span>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}</span>
                                            </div>
                                        </td>
                                        <td className="text-right font-semibold">
                                            {formatCurrency(invoice.totalTTC || 0, invoice.currencySymbol || DEFAULT_CURRENCY)}
                                        </td>
                                        <td className="text-right text-green-600">
                                            {formatCurrency(invoice.amountPaid || 0, invoice.currencySymbol || DEFAULT_CURRENCY)}
                                        </td>
                                        <td className="text-right text-orange-600">
                                            {formatCurrency(invoice.remainingAmount || 0, invoice.currencySymbol || DEFAULT_CURRENCY)}
                                        </td>
                                        <td>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(invoice.paymentStatus)}`}>
                                                {t(`supplierInvoice.paymentStatus.${invoice.paymentStatus?.toLowerCase()}`, invoice.paymentStatus || 'Unknown')}
                                            </span>
                                        </td>
                                        {isManager && (
                                            <td className="text-right">
                                                <button
                                                    onClick={() => handleDelete(invoice.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title={t('common.delete', 'Delete')}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredInvoices.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="font-medium">{t('supplierInvoice.noData', 'No supplier invoices found')}</p>
                                <p className="text-sm text-gray-400 mt-1">{t('supplierInvoice.noDataDescription', 'Supplier invoices will appear here')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

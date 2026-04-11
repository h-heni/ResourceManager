import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Trash2, Search, Package, Clock, CheckCircle2, Calendar } from 'lucide-react';
import { usePurchaseOrders, useDeletePurchaseOrder } from '../hooks/usePurchaseOrders';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/formatNumber';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { getErrorMessage } from '../utils/errorUtils';

interface PurchaseOrder {
    id: number;
    number: string;
    purchaseOrderNumber: string;
    date: string;
    expectedDeliveryDate: string | null;
    supplierId: number;
    supplierName: string;
    totalAmount: number;
    status: string;
    itemsCount: number;
    currency?: string;
    currencySymbol?: string;
}

const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
        case 'received':
            return 'bg-green-100 text-green-700';
        case 'sent':
            return 'bg-blue-100 text-blue-700';
        case 'partiallyreceived':
            return 'bg-orange-100 text-orange-700';
        case 'draft':
            return 'bg-gray-100 text-gray-700';
        case 'cancelled':
            return 'bg-red-100 text-red-700';
        default:
            return 'bg-gray-100 text-gray-700';
    }
};

export default function PurchaseOrdersPage() {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const { isManager } = useAuth();
    const [search, setSearch] = useState('');

    // React Query
    const { data: orders, isLoading: loading } = usePurchaseOrders();
    const deleteOrderMutation = useDeletePurchaseOrder();

    const handleDelete = async (id: number) => {
        if (!isManager) {
            notify('warning', t('common.managerOnly'));
            return;
        }
        if (!confirm(t('purchaseOrders.confirmDelete', 'Are you sure you want to delete this purchase order?'))) return;
        try {
            await deleteOrderMutation.mutateAsync(id);
            notify('success', t('purchaseOrders.deleteSuccess', 'Purchase order deleted successfully'));
        } catch (error) {
            logger.error('Error deleting purchase order', error);
            notify('error', getErrorMessage(error, t('purchaseOrders.deleteFailed', 'Failed to delete purchase order')));
        }
    };

    const filteredOrders = (orders || []).filter((order: PurchaseOrder) => {
        const searchMatch =
            order.purchaseOrderNumber?.toLowerCase().includes(search.toLowerCase()) ||
            order.supplierName?.toLowerCase().includes(search.toLowerCase());
        return searchMatch;
    });

    // Calculate summary
    const totalAmount = filteredOrders.reduce((sum: number, order: PurchaseOrder) => sum + (order.totalAmount || 0), 0);
    const receivedCount = filteredOrders.filter((order: PurchaseOrder) => order.status?.toLowerCase() === 'received').length;
    const pendingCount = filteredOrders.filter((order: PurchaseOrder) => ['sent', 'partiallyreceived'].includes(order.status?.toLowerCase())).length;

    return (
        <div className="space-y-6">
            <NotifyBanner />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">🛒 {t('nav.purchaseOrders', 'Purchase Orders')}</h1>
                    <p className="text-gray-500 mt-1">{t('purchaseOrders.pageDescription', 'Manage purchase orders to suppliers')}</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <ShoppingCart size={24} className="text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('purchaseOrders.totalAmount', 'Total Amount')}</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount, DEFAULT_CURRENCY)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <CheckCircle2 size={24} className="text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('purchaseOrders.received', 'Received')}</p>
                            <p className="text-2xl font-bold text-gray-900">{receivedCount}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-orange-100 rounded-lg">
                            <Clock size={24} className="text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('purchaseOrders.pending', 'Pending')}</p>
                            <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder={t('purchaseOrders.searchPlaceholder', 'Search by order number or supplier...')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none transition-all"
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="text-center py-20 text-gray-500">{t('purchaseOrders.loading', 'Loading...')}</div>
            ) : (
                <div className="rm-table-card">
                    <div className="overflow-x-auto">
                        <table className="rm-table">
                            <thead>
                                <tr>
                                    <th>{t('purchaseOrders.number', 'PO #')}</th>
                                    <th>{t('purchaseOrders.supplier', 'Supplier')}</th>
                                    <th>{t('purchaseOrders.date', 'Date')}</th>
                                    <th>{t('purchaseOrders.deliveryDate', 'Expected Delivery')}</th>
                                    <th className="text-right">{t('purchaseOrders.amount', 'Amount')}</th>
                                    <th className="text-center">{t('purchaseOrders.items', 'Items')}</th>
                                    <th>{t('purchaseOrders.status', 'Status')}</th>
                                    {isManager && <th className="text-right">{t('common.actions', 'Actions')}</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((order: PurchaseOrder) => (
                                    <tr key={order.id}>
                                        <td className="font-medium">{order.purchaseOrderNumber}</td>
                                        <td>{order.supplierName}</td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-gray-400" />
                                                <span>{order.date ? new Date(order.date).toLocaleDateString() : '-'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-gray-400" />
                                                <span>{order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : '-'}</span>
                                            </div>
                                        </td>
                                        <td className="text-right font-semibold">
                                            {formatCurrency(order.totalAmount || 0, order.currencySymbol || DEFAULT_CURRENCY)}
                                        </td>
                                        <td className="text-center">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                                <Package size={12} />
                                                {order.itemsCount || 0}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                                                {t(`purchaseOrders.status.${order.status?.toLowerCase()}`, order.status || 'Unknown')}
                                            </span>
                                        </td>
                                        {isManager && (
                                            <td className="text-right">
                                                <button
                                                    onClick={() => handleDelete(order.id)}
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

                        {filteredOrders.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <ShoppingCart size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="font-medium">{t('purchaseOrders.noData', 'No purchase orders found')}</p>
                                <p className="text-sm text-gray-400 mt-1">{t('purchaseOrders.noDataDescription', 'Create purchase orders to manage supplier orders')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, X, Clock, DollarSign, CalendarPlus, Banknote } from 'lucide-react';
import api from '../services/api';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import { queryClient } from '../lib/queryClient';

interface Notification {
    id: number;
    paymentId: number;
    invoiceId: number;
    message: string;
    createdAt: string;
    isRead: boolean;
    readAt?: string;
}

interface DuePayment {
    id: number;
    amount: number;
    paymentDate: string;
    invoiceId: number;
    invoiceNumber: string;
    clientName: string;
    invoiceTotal: number;
    notes?: string;
    invoiceCurrencySymbol?: string;
}

interface DueSupplierPayment {
    id: number;
    amount: number;
    paymentDate: string;
    supplierInvoiceId: number;
    invoiceNumber: string;
    supplierName: string;
    invoiceTotal: number;
    notes?: string;
    invoiceCurrencySymbol?: string;
}

import { useTranslation } from 'react-i18next';

export default function NotificationBell() {
    const { t } = useTranslation();
    const { isSuperAdmin } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [duePayments, setDuePayments] = useState<DuePayment[]>([]);
    const [dueSupplierPayments, setDueSupplierPayments] = useState<DueSupplierPayment[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'notifications' | 'due'>('notifications');
    const [extendingPaymentId, setExtendingPaymentId] = useState<number | null>(null);
    const [extendDate, setExtendDate] = useState('');
    const [extendNotes, setExtendNotes] = useState('');
    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // ─── Clear all state (called on logout or unmount) ───
    const resetState = useCallback(() => {
        setNotifications([]);
        setDuePayments([]);
        setDueSupplierPayments([]);
        setUnreadCount(0);
        setIsOpen(false);
        setLoading(false);
        setActiveTab('notifications');
        setExtendingPaymentId(null);
        setExtendDate('');
        setExtendNotes('');
        setConfirmingId(null);
    }, []);

    // Listen for logout event to clear state
    useEffect(() => {
        const handleLogout = () => resetState();
        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
    }, [resetState]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Trigger backend due payment processing on mount, then fetch counts
    useEffect(() => {
        // Fire-and-forget: tell backend to transition Pending→Due for current user
        api.post('/Notifications/process-due').catch(() => { });

        fetchNotificationCount();
        const interval = setInterval(fetchNotificationCount, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    const fetchNotificationCount = async () => {
        try {
            const [countRes, dueRes, dueSupplierRes] = await Promise.allSettled([
                api.get('/Notifications/count'),
                api.get('/Notifications/due-payments'),
                api.get('/Notifications/due-supplier-payments')
            ]);

            const notifCount = countRes.status === 'fulfilled' ? (countRes.value.data.count || 0) : 0;
            const duePaymentsList: DuePayment[] = dueRes.status === 'fulfilled' ? (dueRes.value.data || []) : [];
            const dueSupplierList: DueSupplierPayment[] = dueSupplierRes.status === 'fulfilled' ? (dueSupplierRes.value.data || []) : [];

            // Count = unread notifications + due payments (backend count may overlap, use actual lists)
            const dueTotal = duePaymentsList.length + dueSupplierList.length;
            setUnreadCount(notifCount + dueTotal);
            setDuePayments(duePaymentsList);
            setDueSupplierPayments(dueSupplierList);
        } catch (error) {
            logger.error('Error fetching notification count:', error);
        }
    };

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const [notifRes, dueRes, dueSupplierRes] = await Promise.allSettled([
                api.get('/Notifications'),
                api.get('/Notifications/due-payments'),
                api.get('/Notifications/due-supplier-payments')
            ]);

            setNotifications(notifRes.status === 'fulfilled' ? (notifRes.value.data || []) : []);
            setDuePayments(dueRes.status === 'fulfilled' ? (dueRes.value.data || []) : []);
            setDueSupplierPayments(dueSupplierRes.status === 'fulfilled' ? (dueSupplierRes.value.data || []) : []);
        } catch (error) {
            logger.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpen = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            fetchNotifications();
        }
    };

    const markAsRead = async (id: number) => {
        try {
            await api.post(`/Notifications/${id}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
            );
            // Recalculate count from actual state
            fetchNotificationCount();
        } catch (error) {
            logger.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.post('/Notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            fetchNotificationCount();
        } catch (error) {
            logger.error('Error marking all as read:', error);
        }
    };

    const deleteNotification = async (id: number) => {
        try {
            await api.delete(`/Notifications/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
            // Always refetch count from server — never decrement locally
            await fetchNotificationCount();
        } catch (error) {
            logger.error('Error deleting notification:', error);
        }
    };

    const handleConfirmPayment = async (notificationId: number, paymentId?: number) => {
        setConfirmingId(notificationId || paymentId || 0);
        try {
            if (paymentId) {
                await api.post(`/Notifications/confirm-payment-by-id/${paymentId}`);
                // Immediately remove from local due payments list
                setDuePayments(prev => prev.filter(p => p.id !== paymentId));
            } else {
                await api.post(`/Notifications/${notificationId}/confirm-payment`);
            }

            await Promise.allSettled([
                queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
                queryClient.invalidateQueries({ queryKey: ['invoices'] }),
                queryClient.invalidateQueries({ queryKey: ['notifications'] })
            ]);

            // Refetch everything from server — the single source of truth
            await fetchNotificationCount();
            await fetchNotifications();
            window.dispatchEvent(new CustomEvent('payment-status-changed'));
        } catch (error) {
            logger.error('Error confirming payment:', error);
        } finally {
            setConfirmingId(null);
        }
    };

    const handleExtendPayment = async (notificationId: number, paymentId?: number) => {
        if (!extendDate) return;

        try {
            if (paymentId) {
                await api.post(`/Notifications/extend-payment-by-id/${paymentId}`, {
                    newDate: new Date(extendDate).toISOString(),
                    notes: extendNotes || undefined
                });
                setDuePayments(prev => prev.filter(p => p.id !== paymentId));
            } else {
                await api.post(`/Notifications/${notificationId}/extend-payment`, {
                    newDate: new Date(extendDate).toISOString(),
                    notes: extendNotes || undefined
                });
            }
            setExtendingPaymentId(null);
            setExtendDate('');
            setExtendNotes('');
            // Refetch from server — single source of truth
            await fetchNotificationCount();
            await fetchNotifications();
            window.dispatchEvent(new CustomEvent('payment-status-changed'));
        } catch (error) {
            logger.error('Error extending payment:', error);
        }
    };

    const handleConfirmSupplierPayment = async (paymentId: number) => {
        setConfirmingId(paymentId);
        try {
            await api.post(`/Notifications/confirm-supplier-payment/${paymentId}`);

            await Promise.allSettled([
                queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
                queryClient.invalidateQueries({ queryKey: ['supplierInvoices'] }),
                queryClient.invalidateQueries({ queryKey: ['notifications'] })
            ]);

            // Refetch from server — single source of truth
            await fetchNotificationCount();
            await fetchNotifications();
            window.dispatchEvent(new CustomEvent('payment-status-changed'));
        } catch (error) {
            logger.error('Error confirming supplier payment:', error);
        } finally {
            setConfirmingId(null);
        }
    };

    const handleExtendSupplierPayment = async (paymentId: number) => {
        if (!extendDate) return;
        try {
            await api.post(`/Notifications/extend-supplier-payment/${paymentId}`, {
                newDate: new Date(extendDate).toISOString(),
                notes: extendNotes || undefined
            });
            // Immediately remove from local state
            setDueSupplierPayments(prev => prev.filter(p => p.id !== paymentId));
            setExtendingPaymentId(null);
            setExtendDate('');
            setExtendNotes('');
            // Refetch from server — single source of truth
            await fetchNotificationCount();
            await fetchNotifications();
            window.dispatchEvent(new CustomEvent('payment-status-changed'));
        } catch (error) {
            logger.error('Error extending supplier payment:', error);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('notifications.justNow');
        if (diffMins < 60) return t('notifications.agoMin', { count: diffMins });
        if (diffHours < 24) return t('notifications.agoHour', { count: diffHours });
        if (diffDays < 7) return t('notifications.agoDay', { count: diffDays });
        return date.toLocaleDateString();
    };

    const isDuePaymentNotification = (n: Notification) => {
        return n.message.includes('Is the money received') || n.message.includes('is now due');
    };

    // SuperAdmin should never see notifications — render nothing
    if (isSuperAdmin) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleOpen}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            >
                <Bell size={22} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute end-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-scale-up">
                    {/* Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-[#065F46] to-[#14B8A6] text-white flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Bell size={18} />
                            <span className="font-semibold">{t('notifications.title')}</span>
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors"
                            >
                                {t('notifications.markAllRead')}
                            </button>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'notifications'
                                ? 'text-[#065F46] border-b-2 border-[#065F46]'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {t('notifications.all')} ({notifications.filter(n => !isDuePaymentNotification(n)).length})
                        </button>
                        <button
                            onClick={() => setActiveTab('due')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors relative ${activeTab === 'due'
                                ? 'text-amber-600 border-b-2 border-amber-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {t('notifications.duePayments')} ({duePayments.length + dueSupplierPayments.length})
                            {(duePayments.length + dueSupplierPayments.length) > 0 && (
                                <span className="ml-1 w-2 h-2 bg-amber-500 rounded-full inline-block animate-pulse" />
                            )}
                        </button>
                    </div>

                    {/* Content */}
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="p-6 text-center text-gray-500">
                                <div className="animate-spin w-6 h-6 border-2 border-[#065F46] border-t-transparent rounded-full mx-auto mb-2"></div>
                                {t('notifications.loading')}
                            </div>
                        ) : activeTab === 'due' ? (
                            (duePayments.length === 0 && dueSupplierPayments.length === 0) ? (
                                <div className="p-6 text-center text-gray-500">
                                    <Banknote size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">{t('notifications.noPending')}</p>
                                </div>
                            ) : (
                                <>
                                    {/* Client payments */}
                                    {duePayments.map(payment => {
                                        const matchingNotif = notifications.find(n => n.paymentId === payment.id);
                                        const actionId = matchingNotif?.id || payment.id;
                                        const usePaymentId = !matchingNotif; // Use payment-based endpoint if no notification
                                        return (
                                            <div key={payment.id} className="px-4 py-3 border-b border-gray-100 bg-amber-50/50">
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 rounded-full bg-amber-100">
                                                        <Clock size={16} className="text-amber-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900">
                                                            Invoice #{payment.invoiceNumber} - {payment.clientName}
                                                        </p>
                                                        <p className="text-sm text-amber-700 font-semibold mt-0.5">
                                                            {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 3 })} {payment.invoiceCurrencySymbol || DEFAULT_CURRENCY}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            {t('notifications.due')} {new Date(payment.paymentDate).toLocaleDateString()}
                                                        </p>
                                                        <p className="text-xs text-amber-800 mt-1 font-medium">
                                                            {t('notifications.moneyReceivedQuestion')}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-2 ml-9 space-y-2">
                                                    {extendingPaymentId === actionId ? (
                                                        <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-2">
                                                            <label className="block text-xs font-medium text-gray-700">{t('notifications.newDate')}</label>
                                                            <input
                                                                type="date"
                                                                value={extendDate}
                                                                onChange={e => setExtendDate(e.target.value)}
                                                                min={new Date().toISOString().split('T')[0]}
                                                                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={extendNotes}
                                                                onChange={e => setExtendNotes(e.target.value)}
                                                                placeholder={t('notifications.reason')}
                                                                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                                                            />
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleExtendPayment(matchingNotif?.id || 0, usePaymentId ? payment.id : undefined)}
                                                                    disabled={!extendDate}
                                                                    className="flex-1 px-2 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50"
                                                                >
                                                                    {t('notifications.extend')}
                                                                </button>
                                                                <button
                                                                    onClick={() => { setExtendingPaymentId(null); setExtendDate(''); setExtendNotes(''); }}
                                                                    className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200"
                                                                >
                                                                    {t('notifications.cancel')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleConfirmPayment(matchingNotif?.id || 0, usePaymentId ? payment.id : undefined)}
                                                                disabled={confirmingId === actionId}
                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                                            >
                                                                <DollarSign size={14} />
                                                                {confirmingId === actionId ? t('notifications.confirming') : t('notifications.yesReceived')}
                                                            </button>
                                                            <button
                                                                onClick={() => setExtendingPaymentId(actionId)}
                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-800 text-xs rounded-lg hover:bg-amber-200 transition-colors"
                                                            >
                                                                <CalendarPlus size={14} />
                                                                {t('notifications.noExtend')}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {/* Supplier payments */}
                                    {dueSupplierPayments.map(payment => (
                                        <div key={`supplier-${payment.id}`} className="px-4 py-3 border-b border-gray-100 bg-orange-50/50">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 rounded-full bg-orange-100">
                                                    <Clock size={16} className="text-orange-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide">{t('notifications.supplierPayment')}</p>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        Invoice #{payment.invoiceNumber} - {payment.supplierName}
                                                    </p>
                                                    <p className="text-sm text-orange-700 font-semibold mt-0.5">
                                                        {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 3 })} {payment.invoiceCurrencySymbol || DEFAULT_CURRENCY}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {t('notifications.due')} {new Date(payment.paymentDate).toLocaleDateString()}
                                                    </p>
                                                    <p className="text-xs text-orange-800 mt-1 font-medium">
                                                        {t('notifications.paymentSentQuestion')}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-2 ml-9 space-y-2">
                                                {extendingPaymentId === payment.id + 100000 ? (
                                                    <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-2">
                                                        <label className="block text-xs font-medium text-gray-700">{t('notifications.newDate')}</label>
                                                        <input
                                                            type="date"
                                                            value={extendDate}
                                                            onChange={e => setExtendDate(e.target.value)}
                                                            min={new Date().toISOString().split('T')[0]}
                                                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={extendNotes}
                                                            onChange={e => setExtendNotes(e.target.value)}
                                                            placeholder={t('notifications.reason')}
                                                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleExtendSupplierPayment(payment.id)}
                                                                disabled={!extendDate}
                                                                className="flex-1 px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 disabled:opacity-50"
                                                            >
                                                                {t('notifications.extend')}
                                                            </button>
                                                            <button
                                                                onClick={() => { setExtendingPaymentId(null); setExtendDate(''); setExtendNotes(''); }}
                                                                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200"
                                                            >
                                                                {t('notifications.cancel')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleConfirmSupplierPayment(payment.id)}
                                                            disabled={confirmingId === payment.id}
                                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                                        >
                                                            <DollarSign size={14} />
                                                            {confirmingId === payment.id ? t('notifications.confirming') : t('notifications.yesSent')}
                                                        </button>
                                                        <button
                                                            onClick={() => setExtendingPaymentId(payment.id + 100000)}
                                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-800 text-xs rounded-lg hover:bg-orange-200 transition-colors"
                                                        >
                                                            <CalendarPlus size={14} />
                                                            {t('notifications.noExtend')}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )
                        ) : (
                            notifications.filter(n => !isDuePaymentNotification(n)).length === 0 ? (
                                <div className="p-6 text-center text-gray-500">
                                    <Bell size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">{t('notifications.noNotifications')}</p>
                                </div>
                            ) : (
                                notifications.filter(n => !isDuePaymentNotification(n)).map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${!notification.isRead ? 'bg-[#065F46]/5/50' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-full ${isDuePaymentNotification(notification)
                                                ? 'bg-amber-100'
                                                : notification.isRead ? 'bg-gray-100' : 'bg-[#065F46]/10'
                                                }`}>
                                                {isDuePaymentNotification(notification) ? (
                                                    <Banknote size={16} className="text-amber-600" />
                                                ) : (
                                                    <Clock size={16} className={
                                                        notification.isRead ? 'text-gray-500' : 'text-[#065F46]'
                                                    } />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${!notification.isRead ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {formatTime(notification.createdAt)}
                                                </p>

                                                {isDuePaymentNotification(notification) && !notification.isRead && (
                                                    <div className="mt-2 space-y-2">
                                                        {extendingPaymentId === notification.id ? (
                                                            <div className="bg-gray-50 p-2 rounded-lg space-y-2">
                                                                <input
                                                                    type="date"
                                                                    value={extendDate}
                                                                    onChange={e => setExtendDate(e.target.value)}
                                                                    min={new Date().toISOString().split('T')[0]}
                                                                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={extendNotes}
                                                                    onChange={e => setExtendNotes(e.target.value)}
                                                                    placeholder={t('notifications.reason')}
                                                                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                                                />
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={() => handleExtendPayment(notification.id, notification.paymentId || undefined)}
                                                                        disabled={!extendDate}
                                                                        className="flex-1 px-2 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50"
                                                                    >
                                                                        {t('notifications.extend')}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setExtendingPaymentId(null); setExtendDate(''); }}
                                                                        className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded"
                                                                    >
                                                                        {t('notifications.cancel')}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleConfirmPayment(notification.id, notification.paymentId || undefined)}
                                                                    disabled={confirmingId === notification.id}
                                                                    className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50"
                                                                >
                                                                    <DollarSign size={12} />
                                                                    {confirmingId === notification.id ? t('notifications.confirming') : t('notifications.yesReceived')}
                                                                </button>
                                                                <button
                                                                    onClick={() => setExtendingPaymentId(notification.id)}
                                                                    className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded hover:bg-amber-200"
                                                                >
                                                                    <CalendarPlus size={12} />
                                                                    {t('notifications.noExtend')}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {!notification.isRead && !isDuePaymentNotification(notification) && (
                                                    <button
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="p-1 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded transition-colors"
                                                        title="Mark as read"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteNotification(notification.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )
                        )}
                    </div>

                    {/* Footer */}
                    {(notifications.length > 0 || duePayments.length > 0 || dueSupplierPayments.length > 0) && (
                        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
                            <span className="text-xs text-gray-500">
                                {t('notifications.summary', { unread: notifications.filter(n => !isDuePaymentNotification(n) && !n.isRead).length, due: duePayments.length + dueSupplierPayments.length })}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

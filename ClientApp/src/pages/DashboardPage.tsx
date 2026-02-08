import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, FileText, Users, TrendingUp, AlertTriangle, Calendar, ArrowRight, Clock, Banknote, BarChart3, PieChart, ShoppingCart, Wallet, CheckCircle, RefreshCw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface StatusBreakdown {
    status: string;
    count: number;
    amount: number;
}

interface TopClient {
    clientId: number;
    clientName: string;
    totalInvoices: number;
    totalAmount: number;
    paidAmount: number;
}

interface DashboardStats {
    revenue: number;
    unpaid_count: number;
    unpaidAmount: number;
    partiallyPaidCount: number;
    partiallyPaidAmount: number;
    pendingPaymentsCount: number;
    pendingPaymentsAmount: number;
    duePaymentsCount: number;
    duePaymentsAmount: number;
    clients_count: number;
    totalSuppliers: number;
    supplierInvoices: number;
    thisMonthRevenue: number;
    lastMonthRevenue: number;
    totalInvoiceCount: number;
    paidInvoiceCount: number;
    statusBreakdown: StatusBreakdown[];
    topClients: TopClient[];
    chart_data: {
        year: number;
        month: number;
        revenue: number;
    }[];
    recent_invoices: {
        id: number;
        number: string;
        clientName: string;
        totalAmount: number;
        status: string;
        date: string;
    }[];
    overdue_invoices: {
        id: number;
        number: string;
        clientName: string;
        totalAmount: number;
        daysOverdue: number;
    }[];
}

interface ExpenseSummary {
    totalAll: number;
    totalThisMonth: number;
    totalThisYear: number;
    byCategory: { category: string; total: number; count: number }[];
    count: number;
}

export default function DashboardPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isManager } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [recoveryStatus, setRecoveryStatus] = useState<{ type: 'running' | 'success' | 'warning' | 'error'; message: string } | null>(null);
    const recoveryRunRef = useRef(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // OPTIMIZATION: Fetch all data in parallel using Promise.allSettled
                // This significantly improves dashboard load time
                const [dashRes, clientsRes, invoicesRes, overdueRes, expensesRes] = await Promise.allSettled([
                    api.get('/Dashboard/stats'),
                    api.get('/Clients'),
                    api.get('/Invoices?page=1&size=5'),
                    api.get('/Invoices/overdue'),
                    api.get('/Expenses/summary')
                ]);
                
                // Extract data from resolved promises, handle failures gracefully
                const dashData = dashRes.status === 'fulfilled' ? dashRes.value.data : { totalRevenue: 0, unpaidInvoices: 0, revenueChart: [] };
                const clientsData = clientsRes.status === 'fulfilled' 
                    ? (Array.isArray(clientsRes.value.data) ? clientsRes.value.data : (clientsRes.value.data.value || []))
                    : [];
                const invoicesData = invoicesRes.status === 'fulfilled'
                    ? (Array.isArray(invoicesRes.value.data) ? invoicesRes.value.data : (invoicesRes.value.data.data || []))
                    : [];
                const overdueData = overdueRes.status === 'fulfilled'
                    ? (Array.isArray(overdueRes.value.data) ? overdueRes.value.data : (overdueRes.value.data.value || []))
                    : [];

                // Expense summary
                if (expensesRes.status === 'fulfilled') {
                    const ed = expensesRes.value.data;
                    setExpenseSummary({
                        totalAll: ed.totalAll ?? 0,
                        totalThisMonth: ed.totalThisMonth ?? 0,
                        totalThisYear: ed.totalThisYear ?? 0,
                        byCategory: (ed.byCategory || []).map((c: any) => ({ category: c.category, total: c.total, count: c.count })),
                        count: ed.count ?? 0
                    });
                }

                setStats({
                    revenue: dashData.totalRevenue || 0,
                    unpaid_count: dashData.unpaidInvoices || 0,
                    unpaidAmount: dashData.unpaidAmount || 0,
                    partiallyPaidCount: dashData.partiallyPaidCount || 0,
                    partiallyPaidAmount: dashData.partiallyPaidAmount || 0,
                    pendingPaymentsCount: dashData.pendingPaymentsCount || 0,
                    pendingPaymentsAmount: dashData.pendingPaymentsAmount || 0,
                    duePaymentsCount: dashData.duePaymentsCount || 0,
                    duePaymentsAmount: dashData.duePaymentsAmount || 0,
                    clients_count: clientsData.length,
                    totalSuppliers: dashData.totalSuppliers || 0,
                    supplierInvoices: dashData.supplierInvoices || 0,
                    thisMonthRevenue: dashData.thisMonthRevenue || 0,
                    lastMonthRevenue: dashData.lastMonthRevenue || 0,
                    totalInvoiceCount: dashData.totalInvoiceCount || 0,
                    paidInvoiceCount: dashData.paidInvoiceCount || 0,
                    statusBreakdown: dashData.statusBreakdown || [],
                    topClients: dashData.topClients || [],
                    chart_data: (dashData.revenueChart || []).map((d: any) => ({
                        month: d.month,
                        revenue: d.amount,
                        year: new Date().getFullYear()
                    })),
                    recent_invoices: invoicesData.slice(0, 5).map((inv: any) => ({
                        id: inv.id,
                        number: inv.number,
                        clientName: inv.clientName,
                        totalAmount: inv.totalAmount,
                        status: inv.status,
                        date: inv.date
                    })),
                    overdue_invoices: overdueData.slice(0, 5).map((inv: any) => ({
                        id: inv.id,
                        number: inv.number,
                        clientName: inv.clientName,
                        totalAmount: inv.totalAmount,
                        daysOverdue: inv.daysOverdue || 0
                    }))
                });
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    // Auto-run file consistency check and recovery for managers on login
    useEffect(() => {
        // Only managers can auto-recover; skip for non-managers entirely
        if (!isManager) return;

        const sessionKey = 'pdf_consistency_checked';
        if (sessionStorage.getItem(sessionKey)) return;
        if (recoveryRunRef.current) return;
        recoveryRunRef.current = true;
        sessionStorage.setItem(sessionKey, 'true');

        const runConsistencyCheckAndRecover = async () => {
            try {
                const checkRes = await api.get('/pdf-storage/check-consistency');
                const report = checkRes.data;
                const missingCount = report.missingFiles ?? report.MissingFiles ?? 0;

                if (missingCount === 0) return; // All good

                // Manager: auto-recover missing PDFs silently
                const missingFiles: any[] = report.missingFileDetails || [];
                if (missingFiles.length === 0) return;

                // Separate regeneratable (system-generated) from uploaded files
                const typeConfig: Record<string, { listEndpoint: string; pdfEndpoint: (id: number) => string }> = {
                    'Invoice': { listEndpoint: '/Invoices?page=1&size=9999', pdfEndpoint: (id) => `/Invoices/${id}/pdf` },
                    'Quote': { listEndpoint: '/Devis?page=1&size=9999', pdfEndpoint: (id) => `/Devis/${id}/pdf` },
                    'DeliveryNote': { listEndpoint: '/DeliveryNotes?page=1&size=9999', pdfEndpoint: (id) => `/DeliveryNotes/${id}/pdf` },
                };

                const regeneratable = missingFiles.filter(f => typeConfig[f.documentType]);
                const uploaded = missingFiles.filter(f => !typeConfig[f.documentType]);

                if (regeneratable.length === 0) {
                    // All missing files are uploaded (FournisseurInvoice etc.) — can't auto-recover
                    if (uploaded.length > 0) {
                        setRecoveryStatus({ type: 'warning', message: t('dashboard.uploadedFilesMissing', '{{count}} uploaded file(s) missing — must be re-uploaded manually. Check Settings > PDF Storage.', { count: uploaded.length }) });
                        setTimeout(() => setRecoveryStatus(prev => prev?.type !== 'running' ? null : prev), 10000);
                    }
                    return;
                }

                setRecoveryStatus({ type: 'running', message: t('dashboard.regenerating', 'Regenerating {{count}} missing PDF(s)...', { count: regeneratable.length }) });

                let regenerated = 0;
                let failed = 0;

                // Group by document type
                const byType: Record<string, any[]> = {};
                for (const f of regeneratable) {
                    const docType = f.documentType;
                    if (!byType[docType]) byType[docType] = [];
                    byType[docType].push(f);
                }

                for (const [docType, files] of Object.entries(byType)) {
                    const config = typeConfig[docType];

                    let entities: any[] = [];
                    try {
                        const listRes = await api.get(config.listEndpoint);
                        const data = listRes.data;
                        entities = Array.isArray(data) ? data : (data.data || data.Data || data.items || []);
                    } catch {
                        failed += files.length;
                        continue;
                    }

                    for (const missing of files) {
                        const entity = entities.find((e: any) => {
                            const num = e.number || e.Number || e.invoiceNumber || e.devisNumber || '';
                            return num === missing.documentNumber;
                        });
                        if (!entity) {
                            failed++;
                            continue;
                        }
                        try {
                            await api.delete(`/pdf-storage/files/${missing.id}`).catch(() => {});
                            await api.get(config.pdfEndpoint(entity.id || entity.Id), { responseType: 'blob' });
                            regenerated++;
                        } catch {
                            failed++;
                        }
                    }
                }

                // Build result summary
                const parts: string[] = [];
                if (regenerated > 0) parts.push(`${regenerated} PDF(s) regenerated`);
                if (failed > 0) parts.push(`${failed} failed`);
                if (uploaded.length > 0) parts.push(`${uploaded.length} uploaded file(s) need manual re-upload`);

                if (failed === 0 && regenerated > 0) {
                    setRecoveryStatus({ type: 'success', message: `${t('dashboard.autoRecoveryDone', 'Auto-recovery complete')}: ${parts.join(', ')}.` });
                } else if (regenerated > 0 && failed > 0) {
                    setRecoveryStatus({ type: 'warning', message: `${t('dashboard.partialRecovery', 'Partial recovery')}: ${parts.join(', ')}.` });
                } else if (failed > 0 && regenerated === 0) {
                    setRecoveryStatus({ type: 'error', message: `${t('dashboard.autoRecoveryFailed', 'Auto-recovery failed')}: ${parts.join(', ')}. ${t('dashboard.checkSettings', 'Check Settings > PDF Storage.')}` });
                }

                // Auto-dismiss success/warning after 10 seconds, keep errors visible
                setTimeout(() => setRecoveryStatus(prev => {
                    if (prev && prev.type !== 'running' && prev.type !== 'error') return null;
                    return prev;
                }), 10000);
            } catch {
                // Silent failure - non-critical
            }
        };

        runConsistencyCheckAndRecover();
    }, [isManager, t]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Paid': return 'bg-emerald-100 text-emerald-700';
            case 'PartiallyPaid': return 'bg-blue-100 text-blue-700';
            case 'Unpaid': return 'bg-amber-100 text-amber-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    // Calculate growth (simple comparison - last month vs previous)
    const calculateGrowth = () => {
        if (!stats?.chart_data || stats.chart_data.length < 2) return '+0%';
        const currentMonth = new Date().getMonth() + 1;
        const thisMonthRev = stats.chart_data.find(d => d.month === currentMonth)?.revenue || 0;
        const lastMonthRev = stats.chart_data.find(d => d.month === currentMonth - 1)?.revenue || 0;
        if (lastMonthRev === 0) return thisMonthRev > 0 ? '+100%' : '+0%';
        const growth = ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100;
        return growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
    };

    const statCards = [
        {
            title: t('dashboard.totalRevenue'),
            value: stats ? `${stats.revenue.toLocaleString()} TND` : '-',
            icon: DollarSign,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            trend: '📈'
        },
        {
            title: t('dashboard.pendingInvoices'),
            value: stats ? `${stats.unpaid_count}` : '-',
            subtitle: stats?.unpaidAmount ? `${stats.unpaidAmount.toLocaleString()} TND` : undefined,
            icon: FileText,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            trend: stats && stats.unpaid_count > 0 ? '⚠️' : '✅'
        },
        {
            title: t('dashboard.activeClients'),
            value: stats ? stats.clients_count : '-',
            subtitle: stats ? `${stats.totalSuppliers} ${t('dashboard.suppliersLabel', 'suppliers')}` : undefined,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            trend: '👥'
        },
        {
            title: t('dashboard.growth'),
            value: calculateGrowth(),
            subtitle: stats ? `${t('dashboard.thisMonthLabel', 'This month')}: ${stats.thisMonthRevenue.toLocaleString()} TND` : undefined,
            icon: TrendingUp,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
            trend: calculateGrowth().startsWith('+') ? '🚀' : '📉'
        },
    ];

    const monthNames = [
        t('months.jan', 'Jan'), t('months.feb', 'Feb'), t('months.mar', 'Mar'),
        t('months.apr', 'Apr'), t('months.may', 'May'), t('months.jun', 'Jun'),
        t('months.jul', 'Jul'), t('months.aug', 'Aug'), t('months.sep', 'Sep'),
        t('months.oct', 'Oct'), t('months.nov', 'Nov'), t('months.dec', 'Dec')
    ];

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
                <p className="text-gray-500 mt-1">{t('dashboard.overview')}</p>
            </div>

            {/* Auto-recovery status banner (non-intrusive) */}
            {recoveryStatus && (
                <div className={`p-3 rounded-xl flex items-center justify-between text-sm ${
                    recoveryStatus.type === 'running' ? 'bg-blue-50 border border-blue-200 text-blue-800' :
                    recoveryStatus.type === 'success' ? 'bg-green-50 border border-green-300 text-green-800' :
                    recoveryStatus.type === 'warning' ? 'bg-orange-50 border border-orange-300 text-orange-800' :
                    'bg-red-50 border border-red-300 text-red-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {recoveryStatus.type === 'running' && <RefreshCw size={16} className="animate-spin text-blue-600" />}
                        {recoveryStatus.type === 'success' && <CheckCircle size={16} className="text-green-600" />}
                        {recoveryStatus.type === 'warning' && <AlertTriangle size={16} className="text-orange-600" />}
                        {recoveryStatus.type === 'error' && <AlertTriangle size={16} className="text-red-600" />}
                        <span>{recoveryStatus.message}</span>
                    </div>
                    {recoveryStatus.type !== 'running' && (
                        <button onClick={() => setRecoveryStatus(null)} className="ml-2 p-1 rounded hover:bg-black/5"><X size={14} /></button>
                    )}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1 flex items-center gap-2">
                                    {stat.value}
                                    <span className="text-lg">{stat.trend}</span>
                                </p>
                                {stat.subtitle && (
                                    <p className="text-xs text-gray-400 mt-1">{stat.subtitle}</p>
                                )}
                            </div>
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Payment Status Cards */}
            {stats && (stats.pendingPaymentsCount > 0 || stats.duePaymentsCount > 0 || stats.partiallyPaidCount > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {stats.pendingPaymentsCount > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
                            <div className="p-3 bg-blue-100 rounded-xl">
                                <Clock size={20} className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-800">{stats.pendingPaymentsCount} {t('dashboard.scheduledPayments', 'Scheduled Payments')}</p>
                                <p className="text-lg font-bold text-blue-900">{stats.pendingPaymentsAmount.toLocaleString()} TND</p>
                            </div>
                        </div>
                    )}
                    {stats.duePaymentsCount > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
                            <div className="p-3 bg-amber-100 rounded-xl">
                                <Banknote size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-amber-800">{stats.duePaymentsCount} {t('dashboard.awaitingConfirmation', 'Awaiting Confirmation')}</p>
                                <p className="text-lg font-bold text-amber-900">{stats.duePaymentsAmount.toLocaleString()} TND</p>
                            </div>
                        </div>
                    )}
                    {stats.partiallyPaidCount > 0 && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-4">
                            <div className="p-3 bg-purple-100 rounded-xl">
                                <BarChart3 size={20} className="text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-purple-800">{stats.partiallyPaidCount} {t('dashboard.partiallyPaid', 'Partially Paid')}</p>
                                <p className="text-lg font-bold text-purple-900">{stats.partiallyPaidAmount.toLocaleString()} TND {t('dashboard.remaining', 'remaining')}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Overdue Alert Banner */}
            {stats?.overdue_invoices && stats.overdue_invoices.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="text-red-500" size={24} />
                        <div>
                            <p className="font-semibold text-red-800">
                                ⚠️ {stats.overdue_invoices.length} {t('invoice.overdueInvoices')}
                            </p>
                            <p className="text-sm text-red-600">
                                {t('invoice.overdueAmount')}: {stats.overdue_invoices.reduce((sum, inv) => sum + inv.totalAmount, 0).toLocaleString()} TND
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/invoices')}
                        className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                        {t('common.view')} <ArrowRight size={16} />
                    </button>
                </div>
            )}

            {/* ═══════════ SALES vs PURCHASES SUMMARY ═══════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales (Client Invoices) */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-emerald-50 rounded-xl">
                            <Wallet size={22} className="text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">{t('dashboard.salesOverview', 'Sales (Clients)')}</h3>
                            <p className="text-xs text-gray-500">{t('dashboard.salesDesc', 'Revenue from client invoices')}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-emerald-50 rounded-xl text-center">
                            <p className="text-xl font-bold text-emerald-700">{stats?.revenue.toLocaleString() ?? 0}</p>
                            <p className="text-xs text-emerald-600 mt-1">TND {t('dashboard.totalRevenueLabel', 'Total Revenue')}</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-xl text-center">
                            <p className="text-xl font-bold text-blue-700">{stats?.totalInvoiceCount ?? 0}</p>
                            <p className="text-xs text-blue-600 mt-1">{t('dashboard.invoicesLabel', 'Invoices')}</p>
                        </div>
                        <div className="p-3 bg-indigo-50 rounded-xl text-center">
                            <p className="text-xl font-bold text-indigo-700">{stats?.clients_count ?? 0}</p>
                            <p className="text-xs text-indigo-600 mt-1">{t('dashboard.activeClients', 'Clients')}</p>
                        </div>
                    </div>
                    <div className="mt-3 flex justify-between text-xs text-gray-500 px-1">
                        <span>{t('dashboard.paidLabel', 'Paid')}: {stats?.paidInvoiceCount ?? 0} / {stats?.totalInvoiceCount ?? 0}</span>
                        <span>{t('dashboard.thisMonthLabel', 'This month')}: {stats?.thisMonthRevenue.toLocaleString() ?? 0} TND</span>
                    </div>
                </div>

                {/* Purchases (Suppliers + Expenses) */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-rose-50 rounded-xl">
                            <ShoppingCart size={22} className="text-rose-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">{t('dashboard.purchasesOverview', 'Purchases (Suppliers & Expenses)')}</h3>
                            <p className="text-xs text-gray-500">{t('dashboard.purchasesDesc', 'Supplier invoices and operating expenses')}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-rose-50 rounded-xl text-center">
                            <p className="text-xl font-bold text-rose-700">{expenseSummary?.totalAll.toFixed(3) ?? '0.000'}</p>
                            <p className="text-xs text-rose-600 mt-1">TND {t('expense.totalExpenses', 'Expenses')}</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-xl text-center">
                            <p className="text-xl font-bold text-purple-700">{stats?.supplierInvoices ?? 0}</p>
                            <p className="text-xs text-purple-600 mt-1">{t('nav.supplierInvoices', 'Supplier Inv.')}</p>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-xl text-center">
                            <p className="text-xl font-bold text-amber-700">{stats?.totalSuppliers ?? 0}</p>
                            <p className="text-xs text-amber-600 mt-1">{t('nav.suppliers', 'Suppliers')}</p>
                        </div>
                    </div>
                    {/* Net Result */}
                    {stats && (
                        <div className={`mt-3 p-3 rounded-xl border ${(stats.revenue - (expenseSummary?.totalAll ?? 0)) >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">{t('dashboard.netResult', 'Net Result')}</span>
                                <span className={`text-lg font-bold ${(stats.revenue - (expenseSummary?.totalAll ?? 0)) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {(stats.revenue - (expenseSummary?.totalAll ?? 0)) >= 0 ? '+' : ''}{(stats.revenue - (expenseSummary?.totalAll ?? 0)).toFixed(3)} TND
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════ REVENUE vs EXPENSES CHART ═══════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <BarChart3 size={20} className="text-indigo-600" />
                            {t('dashboard.revenueVsExpenses', 'Revenue vs Expenses')}
                        </h3>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-indigo-500 rounded-sm inline-block"></span>{t('dashboard.revenueLabel', 'Revenue')}</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-rose-400 rounded-sm inline-block"></span>{t('expense.totalExpenses', 'Expenses')}</span>
                        </div>
                    </div>
                    <div className="h-64 flex items-end justify-between space-x-1">
                        {stats?.chart_data && stats.chart_data.length > 0 ? (
                            stats.chart_data.map((item, idx) => {
                                const expenseThisMonth = (expenseSummary?.totalAll ?? 0) / Math.max(stats.chart_data.length, 1);
                                const maxVal = Math.max(...stats.chart_data.map(d => d.revenue), expenseThisMonth, 1);
                                const revHeight = maxVal > 0 ? (item.revenue / maxVal) * 100 : 0;
                                const expHeight = maxVal > 0 ? (expenseThisMonth / maxVal) * 100 : 0;
                                return (
                                    <div key={idx} className="w-full flex flex-col items-center group">
                                        <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: '100%' }}>
                                            {/* Revenue bar */}
                                            <div className="relative flex-1 max-w-[20px]">
                                                <div
                                                    className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t group-hover:from-indigo-700 group-hover:to-indigo-500 transition-colors cursor-pointer"
                                                    style={{ height: `${Math.max(revHeight, 3)}%`, minHeight: '3px' }}
                                                >
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                        {item.revenue.toLocaleString()} TND
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Expense bar */}
                                            <div className="relative flex-1 max-w-[20px]">
                                                <div
                                                    className="w-full bg-gradient-to-t from-rose-500 to-rose-300 rounded-t group-hover:from-rose-600 group-hover:to-rose-400 transition-colors cursor-pointer"
                                                    style={{ height: `${Math.max(expHeight, 3)}%`, minHeight: '3px' }}
                                                >
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                        {expenseThisMonth.toFixed(0)} TND
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-500 mt-2 font-medium">{monthNames[item.month - 1]}</span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                {t('common.noData')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Invoices */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">📋 {t('dashboard.recentInvoices')}</h3>
                        <button
                            onClick={() => navigate('/invoices')}
                            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                            {t('common.viewAll')} <ArrowRight size={14} />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {stats?.recent_invoices && stats.recent_invoices.length > 0 ? (
                            stats.recent_invoices.map((inv) => (
                                <div
                                    key={inv.id}
                                    className="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                                    onClick={() => navigate('/invoices')}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-gray-900">#{inv.number}</p>
                                            <p className="text-xs text-gray-500">{inv.clientName}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-900">{inv.totalAmount?.toLocaleString()} TND</p>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(inv.status)}`}>
                                                {t(`invoice.status.${inv.status}`, inv.status)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                                        <Calendar size={12} />
                                        {inv.date ? new Date(inv.date).toLocaleDateString() : 'N/A'}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-500 text-sm">
                                {t('common.noData')}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Status Breakdown + Top Clients */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Invoice Status Breakdown */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <BarChart3 size={20} className="text-indigo-600" />
                        {t('dashboard.statusBreakdown', 'Invoice Status Breakdown')}
                    </h3>
                    {stats?.statusBreakdown && stats.statusBreakdown.length > 0 ? (
                        <div className="space-y-3">
                            {stats.statusBreakdown.map((item) => {
                                const totalCount = stats.totalInvoiceCount || 1;
                                const pct = Math.round((item.count / totalCount) * 100);
                                const colorMap: Record<string, string> = {
                                    'Paid': 'bg-emerald-500',
                                    'Unpaid': 'bg-amber-500',
                                    'PartiallyPaid': 'bg-blue-500',
                                    'Draft': 'bg-gray-400'
                                };
                                return (
                                    <div key={item.status}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-700 font-medium">{t(`invoice.status.${item.status}`, item.status)}</span>
                                            <span className="text-gray-500">{item.count} ({pct}%) - {item.amount.toLocaleString()} TND</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${colorMap[item.status] || 'bg-gray-400'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm">{t('common.noData')}</p>
                    )}
                </div>

                {/* Top Clients */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Users size={20} className="text-indigo-600" />
                        {t('dashboard.topClients', 'Top Clients by Revenue')}
                    </h3>
                    {stats?.topClients && stats.topClients.length > 0 ? (
                        <div className="space-y-3">
                            {stats.topClients.map((client, idx) => {
                                const maxAmount = stats.topClients[0]?.totalAmount || 1;
                                const pct = Math.round((client.totalAmount / maxAmount) * 100);
                                return (
                                    <div key={client.clientId} className="group">
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">
                                                    {idx + 1}
                                                </span>
                                                <span className="font-medium text-gray-900">{client.clientName}</span>
                                            </div>
                                            <span className="text-gray-500">{client.totalAmount.toLocaleString()} TND</span>
                                        </div>
                                        <div className="ml-8 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <div className="ml-8 flex justify-between text-xs text-gray-400 mt-1">
                                            <span>{client.totalInvoices} {t('dashboard.invoicesLabel', 'invoices')}</span>
                                            <span>{client.paidAmount.toLocaleString()} TND {t('dashboard.paidLabel', 'paid')}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm">{t('common.noData')}</p>
                    )}
                </div>
            </div>

            {/* Expense by Category (shown if exists) */}
            {expenseSummary && expenseSummary.byCategory.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <PieChart size={20} className="text-rose-600" />
                        {t('dashboard.expensesByCategory', 'Expenses by Category')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {expenseSummary.byCategory.map((cat) => {
                            const maxTotal = expenseSummary.byCategory[0]?.total || 1;
                            const pct = Math.round((cat.total / expenseSummary.totalAll) * 100);
                            const barPct = Math.round((cat.total / maxTotal) * 100);
                            const categoryColors: Record<string, string> = {
                                rent: 'bg-blue-500', utilities: 'bg-yellow-500', office: 'bg-green-500',
                                travel: 'bg-purple-500', marketing: 'bg-pink-500', insurance: 'bg-indigo-500',
                                maintenance: 'bg-orange-500', subscription: 'bg-cyan-500', salary: 'bg-emerald-500',
                                telecom: 'bg-teal-500', bankFees: 'bg-rose-500', other: 'bg-gray-500'
                            };
                            return (
                                <div key={cat.category}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-700 font-medium">{t(`expense.categories.${cat.category}`, cat.category)}</span>
                                        <span className="text-gray-500">{cat.total.toFixed(3)} TND ({pct}%)</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${categoryColors[cat.category] || 'bg-gray-400'}`} style={{ width: `${barPct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

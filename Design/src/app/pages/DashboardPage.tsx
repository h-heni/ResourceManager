import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, FileText, Users, TrendingUp, AlertTriangle, Package } from 'lucide-react';
import {
    BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { CHART_COLORS, DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { formatCurrency, formatNumber } from '../lib/formatNumber';
import {
    useDashboardStats, useExpenseSummary, useRevenueSummary,
    usePurchasesSummary, useInventoryReport, useStockAlerts,
} from '../hooks/useDashboard';

export default function DashboardPage() {
    const { t } = useTranslation();
    const { isManager } = useAuth();

    /* ─── Year filter state ─── */
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number | null>(currentYear);
    const [activeCurrency, setActiveCurrency] = useState<string>('USD');

    const isAllYearsMode = selectedYear === null;

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    /* ─── Data hooks ─── */
    const { data: stats, isLoading: loading } = useDashboardStats(activeCurrency, selectedYear);
    const { data: expenseSummary } = useExpenseSummary(selectedYear);
    const { data: revenueSummary } = useRevenueSummary(activeCurrency, selectedYear);
    const { data: purchasesSummary } = usePurchasesSummary(activeCurrency, selectedYear);
    const { data: inventoryReport } = useInventoryReport();
    const { data: stockAlerts } = useStockAlerts();
    const activeAlertCount = stockAlerts?.filter((a: { isResolved: boolean }) => !a.isResolved).length || 0;

    const availableYears = stats?.availableYears || [currentYear];

    /* ─── Helpers ─── */
    const cur = stats?.selectedCurrency || activeCurrency || DEFAULT_CURRENCY;
    const fmt = (value: number) => formatCurrency(value, cur);

    const calculateGrowth = () => {
        if (!stats) return '+0%';
        if (stats.growthDisplay) {
            return stats.growthDisplay === 'New' ? t('common.new', 'New') : stats.growthDisplay;
        }
        const { thisMonthRevenue, lastMonthRevenue } = stats;
        if (lastMonthRevenue === 0) return thisMonthRevenue > 0 ? t('common.new', 'New') : '+0%';
        const growth = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
        return growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
    };

    const selectedYearRevenue = isAllYearsMode
        ? (revenueSummary?.totalAllTime ?? stats?.totalRevenue ?? 0)
        : (revenueSummary?.selectedYearTotal ?? stats?.totalRevenue ?? 0);
    const allTimeRevenue = revenueSummary?.totalAllTime ?? 0;
    const netResult = selectedYearRevenue - (stats?.totalExpenses ?? 0);

    /* Growth Trajectory data */
    const growthTrajectoryData = useMemo(() => {
        if (!stats) return [];
        const allYears = stats.isAllYearsMode;
        return stats.revenueChart.map((r: { month: number; label: string; amount: number }) => {
            const exp = allYears
                ? stats.expenseChart.find((e: { label: string }) => e.label === r.label)
                : stats.expenseChart.find((e: { month: number }) => e.month === r.month);
            const expAmount = exp?.amount ?? 0;
            return {
                month: r.month,
                label: r.label || '',
                revenue: r.amount,
                expenses: expAmount,
                net: r.amount - expAmount,
            };
        });
    }, [stats]);

    const monthNames = useMemo(() => [
        t('months.jan', 'Jan'), t('months.feb', 'Feb'), t('months.mar', 'Mar'),
        t('months.apr', 'Apr'), t('months.may', 'May'), t('months.jun', 'Jun'),
        t('months.jul', 'Jul'), t('months.aug', 'Aug'), t('months.sep', 'Sep'),
        t('months.oct', 'Oct'), t('months.nov', 'Nov'), t('months.dec', 'Dec')
    ], [t]);

    const growthTrajectoryChartData = useMemo(() => {
        return growthTrajectoryData.map((d: { month: number; label: string; net: number }, idx: number) => {
            let baseName = isAllYearsMode ? d.label : (monthNames[d.month - 1] || `Month ${d.month}`);
            if (!baseName) baseName = `Item ${idx}`;
            return { name: `${baseName}_${idx}`, displayName: baseName, net: d.net };
        });
    }, [growthTrajectoryData, isAllYearsMode, monthNames]);

    /* Recharts chart data */
    const revenueExpenseChartData = useMemo(() => {
        if (!stats?.revenueChart) return [];
        const allYears = stats.isAllYearsMode;
        return stats.revenueChart.map((r: { month: number; label: string; amount: number; year?: number }, idx: number) => {
            const exp = allYears
                ? stats.expenseChart?.find((e: { label: string }) => e.label === r.label)
                : stats.expenseChart?.find((e: { month: number }) => e.month === r.month);
            const name = allYears ? (r.label || String(r.year) || `Item ${idx}`) : (monthNames[r.month - 1] || `Month ${r.month}`);
            return {
                name: `${name}_${idx}`,
                displayName: name,
                revenue: r.amount,
                expenses: exp?.amount ?? 0,
            };
        });
    }, [stats, monthNames]);

    const statCards = [
        {
            title: t('dashboard.totalRevenue', 'Total Revenue'),
            value: stats ? fmt(selectedYearRevenue) : '-',
            subtitle: stats ? `${t('dashboard.allTime', 'All-time')}: ${fmt(allTimeRevenue)}` : undefined,
            icon: DollarSign,
            iconColor: CHART_COLORS.net,
        },
        {
            title: t('dashboard.pendingInvoices', 'Pending Invoices'),
            value: stats ? `${stats.pendingInvoicesCount}` : '-',
            subtitle: stats ? fmt(stats.pendingInvoicesAmount ?? 0) : undefined,
            icon: FileText,
            iconColor: CHART_COLORS.unpaid,
        },
        {
            title: t('dashboard.activeClients', 'Active Clients'),
            value: stats ? stats.activeClients : '-',
            subtitle: stats ? `${stats.totalSuppliers} ${t('dashboard.suppliersLabel', 'suppliers')}` : undefined,
            icon: Users,
            iconColor: CHART_COLORS.revenue,
        },
        {
            title: t('dashboard.growth', 'Growth'),
            value: calculateGrowth(),
            subtitle: stats ? `${t('dashboard.thisMonthLabel', 'This month')}: ${fmt(stats.thisMonthRevenue)}` : undefined,
            icon: TrendingUp,
            iconColor: CHART_COLORS.growth,
        },
    ];

    /* Status bar colors */
    const statusBarColor: Record<string, string> = {
        'Paid': CHART_COLORS.paid,
        'Pending': CHART_COLORS.unpaid,
        'PartiallyPaid': CHART_COLORS.partial,
        'Archived': CHART_COLORS.draft,
    };

    /* Custom tooltip for Recharts */
    const ChartTooltipContent = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string; payload?: Record<string, unknown> }>; label?: string }) => {
        if (!active || !payload?.length) return null;
        const displayLabel = (payload[0]?.payload as Record<string, unknown>)?.displayName as string || label;
        return (
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                <p className="font-medium text-gray-900 mb-1">{displayLabel}</p>
                {payload.map((entry: { value: number; name: string; color: string }, i: number) => (
                    <p key={i} className="text-gray-600" style={{ color: entry.color }}>
                        {entry.name}: {fmt(entry.value)}
                    </p>
                ))}
            </div>
        );
    };

    /* Year change handler */
    const handleYearChange = (rawValue: string) => {
        const yr = rawValue === 'all' ? null : Number(rawValue);
        setSelectedYear(yr);
    };

    /* ─── Loading skeleton ─── */
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
        <div className="space-y-6">
            {/* Header with currency selector */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('nav.dashboard', 'Dashboard')}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{t('dashboard.overview', 'Overview of your business')}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Year selector */}
                    <select
                        value={selectedYear === null ? 'all' : selectedYear}
                        onChange={e => handleYearChange(e.target.value)}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 border-0 text-gray-700 focus:ring-2 focus:ring-[#065F46] outline-none cursor-pointer"
                    >
                        <option value="all">{t('dashboard.allYears', 'All Years')}</option>
                        {availableYears.map((yr: number) => (
                            <option key={yr} value={yr}>{yr}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, idx) => (
                    <div key={idx} className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.title}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                                {stat.subtitle && (
                                    <p className="text-xs text-gray-400 mt-1 truncate">{stat.subtitle}</p>
                                )}
                            </div>
                            <div className="p-2.5 rounded-lg bg-gray-50" style={{ color: stat.iconColor }}>
                                <stat.icon size={20} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Financial Summary: Sales vs Purchases */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Sales */}
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('dashboard.salesOverview', 'Sales')}</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">{fmt(selectedYearRevenue)}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.totalRevenueLabel', 'Revenue')}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">{stats?.totalInvoiceCount ?? 0}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.invoicesLabel', 'Invoices')}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">{stats?.activeClients ?? 0}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.activeClients', 'Clients')}</p>
                        </div>
                    </div>
                    <div className="mt-3 flex justify-between text-xs text-gray-400 border-t border-gray-50 pt-2">
                        <span>{t('quote.archived', 'Archived')}: {stats?.paidInvoiceCount ?? 0}</span>
                        <span>{t('dashboard.thisMonthLabel', 'This month')}: {fmt(stats?.thisMonthRevenue ?? 0)}</span>
                    </div>
                    {revenueSummary?.revenueByYear?.length ? (
                        <div className="mt-3 border-t border-gray-50 pt-2">
                            <p className="text-[11px] text-gray-400 mb-2">{t('dashboard.revenueByYear', 'Revenue by year')}</p>
                            <div className="rm-table-card border-gray-100 shadow-none overflow-x-auto">
                                <table className="rm-table">
                                    <colgroup>
                                        <col style={{ width: '40%' }} />
                                        <col style={{ width: '60%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th className="rm-th-id">{t('common.year', 'Year')}</th>
                                            <th className="rm-th-number">{t('dashboard.totalRevenueLabel', 'Revenue')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {revenueSummary.revenueByYear.map((entry: { year: number; total: number }) => (
                                            <tr key={entry.year}>
                                                <td className="rm-cell-text whitespace-nowrap font-medium text-gray-700">{entry.year}</td>
                                                <td className="rm-cell-currency">{fmt(entry.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Purchases */}
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('dashboard.purchasesOverview', 'Purchases')}</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">{fmt(stats?.totalExpenses ?? 0)}</p>
                            <p className="text-xs text-gray-500 mt-0.5"> {t('expense.totalExpenses', 'Expenses')}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">{stats?.supplierInvoices ?? 0}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{t('nav.supplierInvoices', 'Supplier Inv.')}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">{stats?.totalSuppliers ?? 0}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{t('nav.suppliers', 'Suppliers')}</p>
                        </div>
                    </div>
                    {purchasesSummary?.purchasesByYear?.length ? (
                        <div className="mt-3 border-t border-gray-50 pt-2">
                            <p className="text-[11px] text-gray-400 mb-2">{t('dashboard.expensesByYear', 'Expenses by year')}</p>
                            <div className="rm-table-card border-gray-100 shadow-none overflow-x-auto">
                                <table className="rm-table">
                                    <colgroup>
                                        <col style={{ width: '40%' }} />
                                        <col style={{ width: '60%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th className="rm-th-id">{t('common.year', 'Year')}</th>
                                            <th className="rm-th-number">{t('expense.totalExpenses', 'Expenses')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {purchasesSummary.purchasesByYear.map((entry: { year: number; total: number }) => (
                                            <tr key={entry.year}>
                                                <td className="rm-cell-text whitespace-nowrap font-medium text-gray-700">{entry.year}</td>
                                                <td className="rm-cell-currency">{fmt(entry.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : null}
                    {stats && (
                        <div className={`mt-3 p-2.5 rounded-lg border text-center ${netResult >= 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                            <span className="text-xs text-gray-500 me-2">{t('dashboard.netResult', 'Net Result')}</span>
                            <span className={`text-sm font-bold ${netResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                {netResult >= 0 ? '+' : ''}{fmt(netResult)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Charts Row: Revenue vs Expenses (merged), Growth */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Merged Revenue vs Expenses Chart */}
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900">{t('dashboard.revenueVsExpenses', 'Revenue vs Expenses')}</h3>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.revenue }} />
                                <span className="text-[11px] text-gray-500">{t('dashboard.revenueLabel', 'Revenue')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.expenses }} />
                                <span className="text-[11px] text-gray-500">{t('expense.totalExpenses', 'Expenses')}</span>
                            </div>
                        </div>
                    </div>
                    {revenueExpenseChartData.length > 0 ? (
                        <div className="h-[280px] w-full min-h-[280px] min-w-full" style={{ position: 'relative' }}>
                            {isMounted && (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={revenueExpenseChartData} barGap={4}>
                                        <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                        <XAxis key="xaxis" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(value: string) => { const item = revenueExpenseChartData.find((d: { name: string }) => d.name === value); return item?.displayName || value; }} />
                                        <YAxis key="yaxis" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} width={80} tickFormatter={(v: number) => formatNumber(v)} />
                                        <RechartsTooltip key="tooltip" content={<ChartTooltipContent />} />
                                        <Bar key="bar-rev" dataKey="revenue" name={t('dashboard.revenueLabel', 'Revenue')} fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
                                        <Bar key="bar-exp" dataKey="expenses" name={t('expense.totalExpenses', 'Expenses')} fill={CHART_COLORS.expenses} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">{t('common.noData', 'No data')}</div>
                    )}
                </div>

                {/* Growth Trajectory Chart */}
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900">{t('dashboard.growthTrajectory', 'Growth')}</h3>
                        <span className={`text-xs font-semibold ${netResult >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {netResult >= 0 ? '+' : ''}{fmt(netResult)}
                        </span>
                    </div>
                    {growthTrajectoryChartData.filter((d: { revenue?: number; expenses?: number; net: number }) => (d.net !== undefined)).length > 0 ? (
                        <div className="h-[280px] w-full min-h-[280px] min-w-full" style={{ position: 'relative' }}>
                            {isMounted && (
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={growthTrajectoryChartData}>
                                        <defs>
                                            <linearGradient id="rm-gradNet" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={CHART_COLORS.net} stopOpacity={0.2} />
                                                <stop offset="95%" stopColor={CHART_COLORS.net} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                        <XAxis key="xaxis" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(value: string) => { const parts = value.split('_'); parts.pop(); return parts.join('_') || value; }} allowDuplicatedCategory={false} />
                                        <YAxis key="yaxis" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} width={80} tickFormatter={(v: number) => formatNumber(v)} />
                                        <RechartsTooltip key="tooltip" content={<ChartTooltipContent />} />
                                        <Area key="area-net" type="monotone" dataKey="net" name={t('dashboard.netLabel', 'Net')} stroke={CHART_COLORS.net} strokeWidth={2.5} fill="url(#rm-gradNet)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">{t('common.noData', 'No data')}</div>
                    )}
                </div>
            </div>

            {/* Product Performance: Top Sales + Top Purchases */}
            {stats && ((stats.mostSoldProducts?.length > 0) || (stats.mostBoughtProducts?.length > 0)) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Top Sold Products */}
                    <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">
                            {t('dashboard.topSoldProducts', 'Top Sold Products')}
                        </h3>
                        {stats.mostSoldProducts?.length > 0 ? (
                            <div className="rm-table-card border-gray-100 shadow-none overflow-x-auto">
                                <table className="rm-table">
                                    <colgroup>
                                        <col style={{ width: '8%' }} />
                                        <col style={{ width: '47%' }} />
                                        <col style={{ width: '18%' }} />
                                        <col style={{ width: '27%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th className="rm-th-id">#</th>
                                            <th>{t('common.description', 'Description')}</th>
                                            <th className="rm-th-number">{t('common.quantity', 'Qty')}</th>
                                            <th className="rm-th-number">{t('common.total', 'Total')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.mostSoldProducts.slice(0, 5).map((p: { description: string; totalQuantity: number; totalAmount: number }, idx: number) => (
                                            <tr key={`${p.description}-${idx}`}>
                                                <td className="rm-cell-text whitespace-nowrap font-semibold text-gray-500">{idx + 1}</td>
                                                <td className="rm-cell-text font-medium text-gray-900">{p.description}</td>
                                                <td className="rm-cell-number">{p.totalQuantity}</td>
                                                <td className="rm-cell-currency">{fmt(p.totalAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">{t('common.noData', 'No data')}</p>
                        )}
                    </div>

                    {/* Top Purchased Products */}
                    <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">
                            {t('dashboard.topPurchasedProducts', 'Top Purchased Products')}
                        </h3>
                        {stats.mostBoughtProducts?.length > 0 ? (
                            <div className="rm-table-card border-gray-100 shadow-none overflow-x-auto">
                                <table className="rm-table">
                                    <colgroup>
                                        <col style={{ width: '8%' }} />
                                        <col style={{ width: '47%' }} />
                                        <col style={{ width: '18%' }} />
                                        <col style={{ width: '27%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th className="rm-th-id">#</th>
                                            <th>{t('common.description', 'Description')}</th>
                                            <th className="rm-th-number">{t('common.quantity', 'Qty')}</th>
                                            <th className="rm-th-number">{t('common.total', 'Total')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.mostBoughtProducts.slice(0, 5).map((p: { description: string; totalQuantity: number; totalAmount: number }, idx: number) => (
                                            <tr key={`${p.description}-${idx}`}>
                                                <td className="rm-cell-text whitespace-nowrap font-semibold text-gray-500">{idx + 1}</td>
                                                <td className="rm-cell-text font-medium text-gray-900">{p.description}</td>
                                                <td className="rm-cell-number">{p.totalQuantity}</td>
                                                <td className="rm-cell-currency">{fmt(p.totalAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">{t('common.noData', 'No data')}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom Row: Status Breakdown + Top Clients */}
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                {/* Invoice Status Breakdown */}
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                        {t('dashboard.statusBreakdown', 'Invoice Status Breakdown')}
                    </h3>
                    {stats?.statusBreakdown && stats.statusBreakdown.length > 0 ? (
                        <div className="space-y-3">
                            {(() => {
                                const activeItems = stats.statusBreakdown.filter((item: { status: string }) => item.status !== 'Archived');
                                const totalCount = Math.max(1, activeItems.reduce((sum: number, item: { count: number }) => sum + item.count, 0));
                                return activeItems.map((item: { status: string; count: number; amount: number }) => {
                                    const pct = Math.round((item.count / totalCount) * 100);
                                    const barColor = statusBarColor[item.status] || CHART_COLORS.draft;
                                    return (
                                        <div key={item.status}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-700 font-medium">{t(`invoice.status.${item.status}`, item.status)}</span>
                                                <span className="text-gray-500 text-xs">{item.count} ({pct}%) — {fmt(item.amount)}</span>
                                            </div>
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                                                />
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm">{t('common.noData', 'No data')}</p>
                    )}
                </div>

                {/* Top Clients */}
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                        {t('dashboard.topClients', 'Top Clients by Revenue')}
                    </h3>
                    {stats?.topClients && stats.topClients.length > 0 ? (
                        <div className="rm-table-card border-gray-100 shadow-none overflow-x-auto">
                            <table className="rm-table">
                                <colgroup>
                                    <col style={{ width: '6%' }} />
                                    <col style={{ width: '34%' }} />
                                    <col style={{ width: '16%' }} />
                                    <col style={{ width: '30%' }} />
                                    <col style={{ width: '14%' }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th className="rm-th-id">#</th>
                                        <th>{t('invoice.client', 'Client')}</th>
                                        <th className="rm-th-number">{t('dashboard.invoicesLabel', 'Invoices')}</th>
                                        <th className="rm-th-number">{t('dashboard.revenueLabel', 'Revenue')}</th>
                                        <th className="rm-th-number">{t('dashboard.share', 'Share')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.topClients.map((client: { clientId: number; clientName: string; totalInvoices: number; totalAmount: number }, idx: number) => {
                                        const totalRevenueForYear = selectedYearRevenue || 1;
                                        const pct = Math.round((client.totalAmount / totalRevenueForYear) * 100);
                                        return (
                                            <tr key={client.clientId}>
                                                <td className="rm-cell-text whitespace-nowrap font-semibold text-gray-500">{idx + 1}</td>
                                                <td className="rm-cell-text font-medium text-gray-900">{client.clientName}</td>
                                                <td className="rm-cell-number">{client.totalInvoices}</td>
                                                <td className="rm-cell-currency">{fmt(client.totalAmount)}</td>
                                                <td className="rm-cell-number">{pct}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm">{t('common.noData', 'No data')}</p>
                    )}
                </div>
            </div>

            {/* Expense by Category */}
            {expenseSummary && expenseSummary.byCategory.length > 0 && (() => {
                const activeCur = cur || expenseSummary.defaultCurrency || DEFAULT_CURRENCY;
                const filtered = expenseSummary.byCategory.filter((c: { currency: string }) => c.currency === activeCur);
                const currencyTotal = filtered.reduce((s: number, c: { total: number }) => s + c.total, 0);
                if (filtered.length === 0) return null;
                return (
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                        {t('dashboard.expensesByCategory', 'Expenses by Category')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {filtered.map((cat: { category: string; currency: string; total: number }) => {
                            const pct = Math.round((cat.total / (currencyTotal || 1)) * 100);
                            return (
                                <div key={`${cat.category}-${cat.currency}`}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-700 font-medium">{(() => {
                                        const BASE_CATS = ['rent','utilities','office','travel','marketing','insurance','maintenance','subscription','salary','telecom','bankFees','other'];
                                        return BASE_CATS.includes(cat.category) ? t(`expense.categories.${cat.category}`, cat.category) : cat.category;
                                    })()}</span>
                                        <span className="text-gray-500 text-xs">{formatCurrency(cat.total, activeCur)} ({pct}%)</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${pct}%`, backgroundColor: CHART_COLORS.expenses }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                );
            })()}

            {/* Inventory Summary Widget */}
            {inventoryReport && (
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <Package size={16} className="text-[#065F46]" />
                            {t('inventory.title', 'Inventory Management')}
                        </h3>
                        {activeAlertCount > 0 && (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                                <AlertTriangle size={12} />
                                {activeAlertCount} {t('inventory.stockAlerts', 'alerts')}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-lg font-bold text-gray-900">{inventoryReport.totalProducts}</p>
                            <p className="text-[11px] text-gray-500">{t('inventory.totalProducts', 'Products')}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-lg font-bold text-amber-600">{inventoryReport.lowStockCount}</p>
                            <p className="text-[11px] text-gray-500">{t('inventory.lowStockItems', 'Low Stock')}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-lg font-bold text-red-600">{inventoryReport.outOfStockCount}</p>
                            <p className="text-[11px] text-gray-500">{t('inventory.outOfStockItems', 'Out of Stock')}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-lg font-bold text-gray-900">{inventoryReport.recentMovements?.reduce((sum: number, m: { count: number }) => sum + m.count, 0) ?? 0}</p>
                            <p className="text-[11px] text-gray-500">{t('inventory.recentMovements', 'Recent (30d)')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
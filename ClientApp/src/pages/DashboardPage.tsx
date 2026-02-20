import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, FileText, Users, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, X, Globe } from 'lucide-react';
import {
    BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CHART_COLORS, DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { formatCurrency, formatNumber } from '../lib/formatNumber';
import SuperAdminDashboard from '../components/SuperAdminDashboard';
import ErrorBoundary from '../components/ErrorBoundary';

/* ─── Types ─── */
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

interface ChartPoint {
    month: number;
    year?: number;
    label?: string;
    amount: number;
    count: number;
}

interface ExpenseChartPoint {
    month: number;
    year?: number;
    label?: string;
    amount: number;
    supplierCount: number;
}

interface ProductItem {
    description: string;
    totalQuantity: number;
    totalAmount: number;
}

interface DashboardStats {
    /* multi-currency metadata from backend */
    selectedCurrency: string;
    availableCurrencies: string[];
    availableYears?: number[];
    defaultCurrency: string;
    selectedYear: number | null;

    totalRevenue: number;
    pendingInvoicesCount: number;
    pendingInvoicesAmount: number;
    partiallyPaidCount: number;
    partiallyPaidAmount: number;
    pendingPaymentsCount: number;
    pendingPaymentsAmount: number;
    thisMonthRevenue: number;
    lastMonthRevenue: number;
    totalInvoiceCount: number;
    paidInvoiceCount: number;
    activeClients: number;
    totalSuppliers: number;
    supplierInvoices: number;
    totalExpenses: number;
    growthDisplay?: string;
    growthPercentage?: number;
    statusBreakdown: StatusBreakdown[];
    topClients: TopClient[];
    revenueChart: ChartPoint[];
    expenseChart: ExpenseChartPoint[];
    mostBoughtProducts: ProductItem[];
    mostSoldProducts: ProductItem[];
    isAllYearsMode: boolean;

    /* mixed-mode fields (only present when mode=mixed) */
    currencyBreakdownRevenue?: Record<string, number>;
    currencyBreakdownExpense?: Record<string, number>;
}

interface ExpenseSummary {
    totalAll: number;
    totalThisMonth: number;
    totalThisYear: number;
    byCategory: { category: string; total: number; count: number }[];
    count: number;
}

interface RevenueSummary {
    totalAllTime: number;
    selectedYearTotal: number;
    revenueByYear: { year: number; total: number }[];
}

interface PurchasesSummary {
    totalAllTime: number;
    selectedYearTotal: number;
    purchasesByYear: { year: number; total: number }[];
}

export default function DashboardPage() {
    const { t } = useTranslation();
    const { isManager, isSuperAdmin } = useAuth();

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
    const [revenueSummary, setRevenueSummary] = useState<RevenueSummary | null>(null);
    const [purchasesSummary, setPurchasesSummary] = useState<PurchasesSummary | null>(null);
    const [archivedInvoiceCount, setArchivedInvoiceCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeCurrency, setActiveCurrency] = useState<string | null>(null);
    const [recoveryStatus, setRecoveryStatus] = useState<{ type: 'running' | 'success' | 'warning' | 'error'; message: string } | null>(null);
    const recoveryRunRef = useRef(false);
    const initialFetchDoneRef = useRef(false);

    /* ─── Mixed-currency mode state ─── */
    const [dashboardMode, setDashboardMode] = useState<'single' | 'mixed'>('single');
    const [mixedTargetCurrency, setMixedTargetCurrency] = useState<string>('');
    const [mixedExchangeRate, setMixedExchangeRate] = useState<string>('');

    /* ─── Year filter state ─── */
    const currentYear = new Date().getFullYear();
    // null = "All Years" mode; number = specific year
    const [selectedYear, setSelectedYear] = useState<number | null>(currentYear);
    const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);

    /* ─── Data fetch (skipped for SuperAdmin) ─── */
    const fetchStats = async (currency?: string, mixedMode?: boolean, yearOverride?: number | null) => {
        if (isSuperAdmin) return;
        // null/undefined = All Years (omit year param); positive number = specific year
        const yearParam: number | null = yearOverride !== undefined ? yearOverride : selectedYear;
        const isAllYears = yearParam === null || yearParam === -1;
        try {
            let queryParam = '';
            const yearQs = isAllYears ? '' : `year=${yearParam}`;
            if (mixedMode && mixedTargetCurrency && parseFloat(mixedExchangeRate) > 0) {
                queryParam = `?mode=mixed&targetCurrency=${encodeURIComponent(mixedTargetCurrency)}&exchangeRate=${encodeURIComponent(mixedExchangeRate)}${yearQs ? '&' + yearQs : ''}`;
            } else if (currency) {
                queryParam = `?currency=${encodeURIComponent(currency)}${yearQs ? '&' + yearQs : ''}`;
            } else {
                queryParam = yearQs ? `?${yearQs}` : '';
            }
            const expenseYearQs = isAllYears ? '' : `?year=${yearParam}`;
            const archivedYearQs = isAllYears ? '' : `?year=${yearParam}`;
            const [dashRes, expensesRes, revenueRes, archivedRes, purchasesRes] = await Promise.allSettled([
                api.get(`/Dashboard/stats${queryParam}`),
                api.get(`/Expenses/summary${expenseYearQs}`),
                api.get(`/Dashboard/revenue-summary${queryParam}`),
                api.get(`/Invoices/archived/count${archivedYearQs}`),
                api.get(`/Dashboard/purchases-summary${queryParam}`)
            ]);

            let archivedCountFallback: number | null = null;
            setFetchError(null);  // Clear any previous error on new fetch

            if (dashRes.status === 'fulfilled') {
                const d = dashRes.value.data;
                const dynamicYears = Array.isArray(d.availableYears) && d.availableYears.length > 0
                    ? d.availableYears
                    : [currentYear];

                setAvailableYears(dynamicYears);
                // Backend returns null for "All Years" mode, or a specific year number
                const backendYear = d.selectedYear;
                setSelectedYear(backendYear == null ? null : backendYear);

                setStats({
                    selectedCurrency: d.selectedCurrency || DEFAULT_CURRENCY,
                    availableCurrencies: d.availableCurrencies || [],
                    availableYears: dynamicYears,
                    defaultCurrency: d.defaultCurrency || DEFAULT_CURRENCY,
                    selectedYear: d.selectedYear ?? currentYear,
                    totalRevenue: d.totalRevenue ?? 0,
                    pendingInvoicesCount: d.pendingInvoicesCount ?? 0,
                    pendingInvoicesAmount: d.pendingInvoicesAmount ?? 0,
                    partiallyPaidCount: d.partiallyPaidCount ?? 0,
                    partiallyPaidAmount: d.partiallyPaidAmount ?? 0,
                    pendingPaymentsCount: d.pendingPaymentsCount ?? 0,
                    pendingPaymentsAmount: d.pendingPaymentsAmount ?? 0,
                    thisMonthRevenue: d.thisMonthRevenue ?? 0,
                    lastMonthRevenue: d.lastMonthRevenue ?? 0,
                    totalInvoiceCount: d.totalInvoiceCount ?? 0,
                    paidInvoiceCount: d.paidInvoiceCount ?? 0,
                    activeClients: d.activeClients ?? 0,
                    totalSuppliers: d.totalSuppliers ?? 0,
                    supplierInvoices: d.supplierInvoices ?? 0,
                    totalExpenses: d.totalExpenses ?? 0,
                    growthDisplay: d.growthDisplay,
                    growthPercentage: d.growthPercentage,
                    statusBreakdown: d.statusBreakdown || [],
                    topClients: d.topClients || [],
                    revenueChart: d.revenueChart || [],
                    expenseChart: d.expenseChart || [],
                    mostBoughtProducts: d.mostBoughtProducts || [],
                    mostSoldProducts: d.mostSoldProducts || [],
                    isAllYearsMode: d.isAllYearsMode ?? false,
                    currencyBreakdownRevenue: d.currencyBreakdownRevenue ?? undefined,
                    currencyBreakdownExpense: d.currencyBreakdownExpense ?? undefined,
                });
                archivedCountFallback = d.paidInvoiceCount ?? 0;
                if (!activeCurrency) setActiveCurrency(d.selectedCurrency || d.defaultCurrency || DEFAULT_CURRENCY);
            }

            if (expensesRes.status === 'fulfilled') {
                const ed = expensesRes.value.data;
                setExpenseSummary({
                    totalAll: ed.totalAll ?? 0,
                    totalThisMonth: ed.totalThisMonth ?? 0,
                    totalThisYear: ed.totalThisYear ?? 0,
                    byCategory: (ed.byCategory || []).map((c: { category: string; total: number; count: number }) => ({ category: c.category, total: c.total, count: c.count })),
                    count: ed.count ?? 0,
                });
            }

            if (revenueRes.status === 'fulfilled') {
                const rd = revenueRes.value.data;
                setRevenueSummary({
                    totalAllTime: rd.totalAllTime ?? 0,
                    selectedYearTotal: rd.selectedYearTotal ?? 0,
                    revenueByYear: rd.revenueByYear || [],
                });
            }

            if (archivedRes.status === 'fulfilled') {
                const payload = archivedRes.value.data;
                setArchivedInvoiceCount(payload?.count ?? 0);
            } else if (archivedCountFallback !== null) {
                setArchivedInvoiceCount(archivedCountFallback);
            }

            if (purchasesRes.status === 'fulfilled') {
                const pd = purchasesRes.value.data;
                setPurchasesSummary({
                    totalAllTime: pd.totalAllTime ?? 0,
                    selectedYearTotal: pd.selectedYearTotal ?? 0,
                    purchasesByYear: pd.purchasesByYear || [],
                });
            }
        } catch (error) {
            console.error('Failed to fetch dashboard stats', error);
            setFetchError(t('dashboard.fetchError', 'Failed to load dashboard data. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        if (isSuperAdmin || initialFetchDoneRef.current) return;
        initialFetchDoneRef.current = true;
        fetchStats();
    }, [isSuperAdmin]);
    /* eslint-enable react-hooks/exhaustive-deps */

    /* Re-fetch when year changes */
    const handleYearChange = (rawValue: string) => {
        const yr = rawValue === 'all' ? null : Number(rawValue);
        setSelectedYear(yr);
        setLoading(true);
        fetchStats(activeCurrency || undefined, dashboardMode === 'mixed', yr);
    };

    /* Re-fetch when currency changes */
    const handleCurrencyChange = (cur: string) => {
        setActiveCurrency(cur);
        setLoading(true);
        fetchStats(cur);
    };

    /* Mixed-mode: apply conversion */
    const handleApplyMixedMode = useCallback(() => {
        if (!mixedTargetCurrency || !mixedExchangeRate || parseFloat(mixedExchangeRate) <= 0) return;
        setLoading(true);
        fetchStats(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mixedTargetCurrency, mixedExchangeRate]);

    /* Switch dashboard mode */
    const handleModeChange = useCallback((newMode: 'single' | 'mixed') => {
        setDashboardMode(newMode);
        if (newMode === 'single') {
            // Re-fetch in single-currency mode
            setLoading(true);
            fetchStats(activeCurrency || undefined);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCurrency]);

    /* ─── PDF recovery (manager only, existing logic) ─── */
    useEffect(() => {
        if (!isManager || isSuperAdmin) return;
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
                if (missingCount === 0) return;

                const missingFiles: Array<{ id: number; documentType: string; documentNumber: string; fileName: string }> = report.missingFileDetails || [];
                if (missingFiles.length === 0) return;

                const typeConfig: Record<string, { listEndpoint: string; pdfEndpoint: (id: number) => string }> = {
                    'Invoice': { listEndpoint: '/Invoices?page=1&size=9999', pdfEndpoint: (id) => `/Invoices/${id}/pdf` },
                    'Quote': { listEndpoint: '/Quotes?page=1&size=9999', pdfEndpoint: (id) => `/Quotes/${id}/pdf` },
                    'DeliveryNote': { listEndpoint: '/DeliveryNotes?page=1&size=9999', pdfEndpoint: (id) => `/DeliveryNotes/${id}/pdf` },
                };

                const regeneratable = missingFiles.filter(f => typeConfig[f.documentType]);
                const uploaded = missingFiles.filter(f => !typeConfig[f.documentType]);

                if (regeneratable.length === 0) {
                    if (uploaded.length > 0) {
                        setRecoveryStatus({ type: 'warning', message: t('dashboard.uploadedFilesMissing', '{{count}} uploaded file(s) missing — must be re-uploaded manually. Check Settings > PDF Storage.', { count: uploaded.length }) });
                        setTimeout(() => setRecoveryStatus(prev => prev?.type !== 'running' ? null : prev), 10000);
                    }
                    return;
                }

                setRecoveryStatus({ type: 'running', message: t('dashboard.regenerating', 'Regenerating {{count}} missing PDF(s)...', { count: regeneratable.length }) });

                let regenerated = 0;
                let failed = 0;

                const byType: Record<string, Array<{ id: number; documentType: string; documentNumber: string; fileName: string }>> = {};
                for (const f of regeneratable) {
                    if (!byType[f.documentType]) byType[f.documentType] = [];
                    byType[f.documentType].push(f);
                }

                for (const [docType, files] of Object.entries(byType)) {
                    const config = typeConfig[docType];
                    let entities: Array<Record<string, unknown>> = [];
                    try {
                        const listRes = await api.get(config.listEndpoint);
                        const data = listRes.data;
                        entities = Array.isArray(data) ? data : (data.data || data.Data || data.items || []);
                    } catch {
                        failed += files.length;
                        continue;
                    }

                    for (const missing of files) {
                        const entity = entities.find((e: Record<string, unknown>) => {
                            const num = e.number || e.Number || e.invoiceNumber || e.quoteNumber || '';
                            return num === missing.documentNumber;
                        });
                        if (!entity) { failed++; continue; }
                        try {
                            await api.delete(`/pdf-storage/files/${missing.id}`).catch(() => { });
                            await api.get(config.pdfEndpoint((entity.id || entity.Id) as number), { responseType: 'blob' });
                            regenerated++;
                        } catch { failed++; }
                    }
                }

                const parts: string[] = [];
                if (regenerated > 0) parts.push(t('dashboard.regeneratedPdf', { count: regenerated }));
                if (failed > 0) parts.push(t('dashboard.failedPdf', { count: failed }));
                if (uploaded.length > 0) parts.push(t('dashboard.manualUploadNeeded', { count: uploaded.length }));

                if (failed === 0 && regenerated > 0) {
                    setRecoveryStatus({ type: 'success', message: `${t('dashboard.autoRecoveryDone')}: ${parts.join(', ')}.` });
                } else if (regenerated > 0 && failed > 0) {
                    setRecoveryStatus({ type: 'warning', message: `${t('dashboard.partialRecovery')}: ${parts.join(', ')}.` });
                } else if (failed > 0 && regenerated === 0) {
                    setRecoveryStatus({ type: 'error', message: `${t('dashboard.autoRecoveryFailed')}: ${parts.join(', ')}. ${t('dashboard.checkSettings')}` });
                }

                setTimeout(() => setRecoveryStatus(prev => {
                    if (prev && prev.type !== 'running' && prev.type !== 'error') return null;
                    return prev;
                }), 10000);
            } catch { /* Silent failure - non-critical */ }
        };

        runConsistencyCheckAndRecover();
    }, [isManager, isSuperAdmin, t]);

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

    /* Growth Trajectory data — revenue minus expenses per period */
    const growthTrajectoryData = useMemo(() => {
        if (!stats) return [];
        const allYears = stats.isAllYearsMode;
        return stats.revenueChart.map((r) => {
            const exp = allYears
                ? stats.expenseChart.find(e => e.label === r.label)
                : stats.expenseChart.find(e => e.month === r.month);
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

    // In "All Years" mode, use totalAllTime for revenue; otherwise use selectedYearTotal
    const isAllYearsMode = selectedYear === null;
    const selectedYearRevenue = isAllYearsMode
        ? (revenueSummary?.totalAllTime ?? stats?.totalRevenue ?? 0)
        : (revenueSummary?.selectedYearTotal ?? stats?.totalRevenue ?? 0);
    const allTimeRevenue = revenueSummary?.totalAllTime ?? 0;
    const netResult = selectedYearRevenue - (stats?.totalExpenses ?? 0);

    /* Recharts chart data — dynamic labels: years for "All Years", months for specific year */
    const revenueExpenseChartData = useMemo(() => {
        if (!stats?.revenueChart) return [];
        const allYears = stats.isAllYearsMode;
        return stats.revenueChart.map((r) => {
            const exp = allYears
                ? stats.expenseChart?.find(e => e.label === r.label)
                : stats.expenseChart?.find(e => e.month === r.month);
            return {
                name: allYears ? (r.label || String(r.year)) : monthNames[r.month - 1],
                revenue: r.amount,
                expenses: exp?.amount ?? 0,
            };
        });
    }, [stats, monthNames]);

    const statCards = [
        {
            title: t('dashboard.totalRevenue'),
            value: stats ? fmt(selectedYearRevenue) : '-',
            subtitle: stats ? `${t('dashboard.allTime', 'All-time')}: ${fmt(allTimeRevenue)}` : undefined,
            icon: DollarSign,
            iconColor: CHART_COLORS.net,
        },
        {
            title: t('dashboard.pendingInvoices'),
            value: stats ? `${stats.pendingInvoicesCount}` : '-',
            subtitle: stats ? fmt(stats.pendingInvoicesAmount ?? 0) : undefined,
            icon: FileText,
            iconColor: CHART_COLORS.unpaid,
        },
        {
            title: t('dashboard.activeClients'),
            value: stats ? stats.activeClients : '-',
            subtitle: stats ? `${stats.totalSuppliers} ${t('dashboard.suppliersLabel', 'suppliers')}` : undefined,
            icon: Users,
            iconColor: CHART_COLORS.revenue,
        },
        {
            title: t('dashboard.growth'),
            value: calculateGrowth(),
            subtitle: stats ? `${t('dashboard.thisMonthLabel', 'This month')}: ${fmt(stats.thisMonthRevenue)}` : undefined,
            icon: TrendingUp,
            iconColor: CHART_COLORS.growth,
        },
    ];

    // SuperAdmin sees a completely different dashboard (placed after all hooks)
    if (isSuperAdmin) return (
        <ErrorBoundary scope="SuperAdminDashboard">
            <SuperAdminDashboard />
        </ErrorBoundary>
    );

    /* ─── Error state ─── */
    if (fetchError && !stats) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="text-red-600 bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-md">
                    <p className="font-medium mb-2">{fetchError}</p>
                    <button
                        onClick={() => { setFetchError(null); setLoading(true); fetchStats(); }}
                        className="mt-2 px-4 py-2 bg-[#065F46] text-white rounded-lg text-sm hover:bg-[#054E3B] transition-colors"
                    >
                        {t('common.retry', 'Retry')}
                    </button>
                </div>
            </div>
        );
    }

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

    /* Status bar colors — using CHART_COLORS tokens */
    const statusBarColor: Record<string, string> = {
        'Paid': CHART_COLORS.paid,
        'Pending': CHART_COLORS.unpaid,
        'PartiallyPaid': CHART_COLORS.partial,
        'Archived': CHART_COLORS.draft,
    };

    /* Custom tooltip for Recharts */
    const ChartTooltipContent = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                <p className="font-medium text-gray-900 mb-1">{label}</p>
                {payload.map((entry: { value: number; name: string; color: string }, i: number) => (
                    <p key={i} className="text-gray-600" style={{ color: entry.color }}>
                        {entry.name}: {fmt(entry.value)}
                    </p>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header with currency selector */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{t('dashboard.overview')}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Mode toggle */}
                    {stats && stats.availableCurrencies.length > 1 && (
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => handleModeChange('single')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${dashboardMode === 'single'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {t('dashboard.perCurrency', 'Per Currency')}
                            </button>
                            <button
                                onClick={() => handleModeChange('mixed')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${dashboardMode === 'mixed'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Globe size={12} />
                                {t('dashboard.mixed', 'Mixed')}
                            </button>
                        </div>
                    )}
                    {/* Single-mode currency tabs */}
                    {dashboardMode === 'single' && stats && stats.availableCurrencies.length > 1 && (
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                            {stats.availableCurrencies.map(c => (
                                <button
                                    key={c}
                                    onClick={() => handleCurrencyChange(c)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${cur === c
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    )}
                    {/* Year selector */}
                    <select
                        value={selectedYear === null ? 'all' : selectedYear}
                        onChange={e => handleYearChange(e.target.value)}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 border-0 text-gray-700 focus:ring-2 focus:ring-[#065F46] outline-none cursor-pointer"
                    >
                        <option value="all">{t('dashboard.allYears', 'All Years')}</option>
                        {availableYears.map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Mixed-mode controls */}
            {dashboardMode === 'mixed' && stats && stats.availableCurrencies.length > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs font-medium text-blue-800 mb-2">{t('dashboard.mixedModeDesc', 'Convert all currencies into one using your exchange rate')}</p>
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="block text-xs text-blue-700 mb-1">{t('dashboard.targetCurrency', 'Target Currency')}</label>
                            <select
                                value={mixedTargetCurrency}
                                onChange={e => setMixedTargetCurrency(e.target.value)}
                                className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-400"
                            >
                                <option value="">{t('common.select', 'Select...')}</option>
                                {stats.availableCurrencies.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-blue-700 mb-1">{t('dashboard.exchangeRate', 'Exchange Rate')}</label>
                            <input
                                type="number"
                                step="0.0001"
                                min="0.0001"
                                value={mixedExchangeRate}
                                onChange={e => setMixedExchangeRate(e.target.value)}
                                placeholder={t('settings.exchangeRatePlaceholder')}
                                className="px-3 py-2 border border-blue-200 rounded-lg text-sm w-32 bg-white focus:ring-2 focus:ring-blue-400"
                            />
                        </div>
                        <button
                            onClick={handleApplyMixedMode}
                            disabled={!mixedTargetCurrency || !mixedExchangeRate || parseFloat(mixedExchangeRate) <= 0}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {t('common.apply', 'Apply')}
                        </button>
                    </div>
                </div>
            )}

            {/* Currency breakdown (shown when mixed mode is active and data was fetched) */}
            {dashboardMode === 'mixed' && stats?.currencyBreakdownRevenue && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('dashboard.revenueBreakdown', 'Revenue by Original Currency')}</h4>
                        <div className="space-y-1.5">
                            {Object.entries(stats.currencyBreakdownRevenue).map(([ccy, amt]) => (
                                <div key={ccy} className="flex justify-between text-sm">
                                    <span className="text-gray-600">{ccy}</span>
                                    <span className="font-medium text-gray-900">{formatCurrency(amt, ccy)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('dashboard.expenseBreakdown', 'Expenses by Original Currency')}</h4>
                        <div className="space-y-1.5">
                            {Object.entries(stats.currencyBreakdownExpense ?? {}).map(([ccy, amt]) => (
                                <div key={ccy} className="flex justify-between text-sm">
                                    <span className="text-gray-600">{ccy}</span>
                                    <span className="font-medium text-gray-900">{formatCurrency(amt, ccy)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Auto-recovery status banner */}
            {recoveryStatus && (
                <div className={`p-3 rounded-lg flex items-center justify-between text-sm ${recoveryStatus.type === 'running' ? 'bg-blue-50 border border-blue-200 text-blue-800' :
                    recoveryStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
                        recoveryStatus.type === 'warning' ? 'bg-amber-50 border border-amber-200 text-amber-800' :
                            'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                    <div className="flex items-center gap-2">
                        {recoveryStatus.type === 'running' && <RefreshCw size={16} className="animate-spin" />}
                        {recoveryStatus.type === 'success' && <CheckCircle size={16} />}
                        {recoveryStatus.type === 'warning' && <AlertTriangle size={16} />}
                        {recoveryStatus.type === 'error' && <AlertTriangle size={16} />}
                        <span>{recoveryStatus.message}</span>
                    </div>
                    {recoveryStatus.type !== 'running' && (
                        <button onClick={() => setRecoveryStatus(null)} className="ms-2 p-1 rounded hover:bg-black/5"><X size={14} /></button>
                    )}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
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
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('dashboard.salesOverview', 'Sales')}</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">{fmt(selectedYearRevenue)}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.totalRevenueLabel', 'Revenue')}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">{Math.max(0, (stats?.totalInvoiceCount ?? 0) - archivedInvoiceCount)}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.invoicesLabel', 'Invoices')}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">{stats?.activeClients ?? 0}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.activeClients', 'Clients')}</p>
                        </div>
                    </div>
                    <div className="mt-3 flex justify-between text-xs text-gray-400 border-t border-gray-50 pt-2">
                        <span>{t('quote.archived', 'Archived')}: {archivedInvoiceCount}</span>
                        <span>{t('dashboard.thisMonthLabel', 'This month')}: {fmt(stats?.thisMonthRevenue ?? 0)}</span>
                    </div>
                    {revenueSummary?.revenueByYear?.length ? (
                        <div className="mt-3 border-t border-gray-50 pt-2">
                            <p className="text-[11px] text-gray-400 mb-2">{t('dashboard.revenueByYear', 'Revenue by year')}</p>
                            <div className="rm-table-card border-gray-100 shadow-none">
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
                                        {revenueSummary.revenueByYear.map((entry) => (
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
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
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
                            <div className="rm-table-card border-gray-100 shadow-none">
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
                                        {purchasesSummary.purchasesByYear.map((entry) => (
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
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
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
                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueExpenseChartData} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} width={80} tickFormatter={(v: number) => formatNumber(v)} />
                                    <RechartsTooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="revenue" name={t('dashboard.revenueLabel', 'Revenue')} fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expenses" name={t('expense.totalExpenses', 'Expenses')} fill={CHART_COLORS.expenses} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">{t('common.noData')}</div>
                    )}
                </div>

                {/* Growth Trajectory Chart */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900">{t('dashboard.growthTrajectory', 'Growth')}</h3>
                        <span className={`text-xs font-semibold ${netResult >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {netResult >= 0 ? '+' : ''}{fmt(netResult)}
                        </span>
                    </div>
                    {growthTrajectoryData.filter(d => d.revenue > 0 || d.expenses > 0).length > 0 ? (
                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={growthTrajectoryData.map(d => ({
                                    name: isAllYearsMode ? d.label : monthNames[d.month - 1],
                                    net: d.net
                                }))}>
                                    <defs>
                                        <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.net} stopOpacity={0.2} />
                                            <stop offset="95%" stopColor={CHART_COLORS.net} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} width={80} tickFormatter={(v: number) => formatNumber(v)} />
                                    <RechartsTooltip content={<ChartTooltipContent />} />
                                    <Area type="monotone" dataKey="net" name={t('dashboard.netLabel', 'Net')} stroke={CHART_COLORS.net} strokeWidth={2.5} fill="url(#gradNet)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">{t('common.noData')}</div>
                    )}
                </div>
            </div>

            {/* Product Performance: Top Sales + Top Purchases */}
            {stats && ((stats.mostSoldProducts?.length > 0) || (stats.mostBoughtProducts?.length > 0)) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Top Sold Products (from client invoices) */}
                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">
                            {t('dashboard.topSoldProducts', 'Top Sold Products')}
                        </h3>
                        {stats.mostSoldProducts?.length > 0 ? (
                            <div className="rm-table-card border-gray-100 shadow-none">
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
                                        {stats.mostSoldProducts.slice(0, 5).map((p, idx) => (
                                            <tr key={p.description}>
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
                            <p className="text-gray-400 text-sm">{t('common.noData')}</p>
                        )}
                    </div>

                    {/* Top Purchased Products (from supplier invoices) */}
                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">
                            {t('dashboard.topPurchasedProducts', 'Top Purchased Products')}
                        </h3>
                        {stats.mostBoughtProducts?.length > 0 ? (
                            <div className="rm-table-card border-gray-100 shadow-none">
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
                                        {stats.mostBoughtProducts.slice(0, 5).map((p, idx) => (
                                            <tr key={p.description}>
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
                            <p className="text-gray-400 text-sm">{t('common.noData')}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom Row: Status Breakdown + Top Clients */}
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                {/* Invoice Status Breakdown */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                        {t('dashboard.statusBreakdown', 'Invoice Status Breakdown')}
                    </h3>
                    {stats?.statusBreakdown && stats.statusBreakdown.length > 0 ? (
                        <div className="space-y-3">
                            {(() => {
                                const activeItems = stats.statusBreakdown.filter(item => item.status !== 'Archived');
                                const totalCount = Math.max(1, activeItems.reduce((sum, item) => sum + item.count, 0));
                                return activeItems.map((item) => {
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
                        <p className="text-gray-400 text-sm">{t('common.noData')}</p>
                    )}
                </div>

                {/* Top Clients */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                        {t('dashboard.topClients', 'Top Clients by Revenue')}
                    </h3>
                    {stats?.topClients && stats.topClients.length > 0 ? (
                        <div className="rm-table-card border-gray-100 shadow-none">
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
                                    {stats.topClients.map((client, idx) => {
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
                        <p className="text-gray-400 text-sm">{t('common.noData')}</p>
                    )}
                </div>
            </div>

            {/* Expense by Category */}
            {expenseSummary && expenseSummary.byCategory.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                        {t('dashboard.expensesByCategory', 'Expenses by Category')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {expenseSummary.byCategory.map((cat) => {
                            const pct = Math.round((cat.total / (expenseSummary.totalAll || 1)) * 100);
                            return (
                                <div key={cat.category}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-700 font-medium">{t(`expense.categories.${cat.category}`, cat.category)}</span>
                                        <span className="text-gray-500 text-xs">{fmt(cat.total)} ({pct}%)</span>
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
            )}
        </div>
    );
}

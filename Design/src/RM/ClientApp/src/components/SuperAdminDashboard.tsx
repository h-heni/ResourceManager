import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import ErrorBoundary from './ErrorBoundary';
import {
    Building2, Users, TrendingUp, TrendingDown, DollarSign,
    FileText, AlertTriangle, Globe, BarChart3, Briefcase,
    Activity, ScrollText, Shield, Wifi, RefreshCw,
    CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight,
    Filter
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// Types — Existing tenant data
// ═══════════════════════════════════════════════════════════
interface CurrencyBucket {
    currency: string;
    revenue: number;
    expenses: number;
    net: number;
    invoiceCount: number;
    unpaidCount: number;
    unpaidAmount: number;
}

interface CompanyStats {
    companyId: number;
    companyName: string;
    userCount: number;
    defaultCurrency: string;
    employeeLimit: number;
    currencyBuckets: CurrencyBucket[];
}

// ═══════════════════════════════════════════════════════════
// Types — Admin observability
// ═══════════════════════════════════════════════════════════
interface HealthData {
    status: string;
    uptimeSeconds: number;
    totalRequests: number;
    averageResponseTimeMs: number;
    errorRate: number;
    errors24h: number;
    databaseConnected: boolean;
    timestamp: string;
}

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    source: string;
    exceptionType: string | null;
}

interface PaginatedLogs {
    items: LogEntry[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}

interface CountryEntry {
    country: string;
    countryCode: string;
    count: number;
    percentage: number;
}

interface UsersByCountryData {
    countries: CountryEntry[];
    totalLogins: number;
}

interface LiveUser {
    userId: string;
    email: string;
    role: string;
    ipAddress: string;
    lastActivity: string;
    sessionDurationMinutes: number;
}

interface LiveUsersData {
    activeCount: number;
    users: LiveUser[];
    byRole: Record<string, number>;
}

interface SecurityAlert {
    id: string;
    type: string;
    severity: string;
    message: string;
    ipAddress: string;
    userId: string | null;
    timestamp: string;
}

interface PaginatedAlerts {
    items: SecurityAlert[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}

interface OverviewData {
    health: HealthData;
    liveUsers: LiveUsersData;
    recentLogs: LogEntry[];
    recentAlerts: SecurityAlert[];
    totalLogCount: number;
    totalAlertCount: number;
}

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════
const CARD_COLORS = [
    { bg: 'bg-emerald-50', border: 'border-emerald-200', accent: 'text-emerald-700', headerBg: 'bg-emerald-100' },
    { bg: 'bg-blue-50', border: 'border-blue-200', accent: 'text-blue-700', headerBg: 'bg-blue-100' },
    { bg: 'bg-purple-50', border: 'border-purple-200', accent: 'text-purple-700', headerBg: 'bg-purple-100' },
    { bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-700', headerBg: 'bg-amber-100' },
    { bg: 'bg-rose-50', border: 'border-rose-200', accent: 'text-rose-700', headerBg: 'bg-rose-100' },
    { bg: 'bg-cyan-50', border: 'border-cyan-200', accent: 'text-cyan-700', headerBg: 'bg-cyan-100' },
];

const TAB_LIST = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'health', label: 'Health', icon: Activity },
    { key: 'logs', label: 'Logs', icon: ScrollText },
    { key: 'countries', label: 'Users by Country', icon: Globe },
    { key: 'live', label: 'Live Users', icon: Wifi },
    { key: 'security', label: 'Security Alerts', icon: Shield },
] as const;

type TabKey = (typeof TAB_LIST)[number]['key'];

const AUTO_REFRESH_MS = 30_000;

function formatAmount(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency', currency,
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${amount.toFixed(2)} ${currency}`;
    }
}

function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function timeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
}

const SEVERITY_STYLES: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800 border-red-300',
    High: 'bg-orange-100 text-orange-800 border-orange-300',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Low: 'bg-blue-100 text-blue-800 border-blue-300',
};

const LOG_LEVEL_STYLES: Record<string, string> = {
    Error: 'bg-red-100 text-red-700',
    Warning: 'bg-yellow-100 text-yellow-700',
    Fatal: 'bg-red-200 text-red-900 font-semibold',
    Information: 'bg-blue-100 text-blue-700',
};

const countryFlagEmoji = (code: string): string => {
    if (!code || code.length !== 2) return '\u{1F30D}';
    return String.fromCodePoint(
        ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
    );
};

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════
export default function SuperAdminDashboard() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabKey>('overview');

    // Tenant data (existing)
    const [companies, setCompanies] = useState<CompanyStats[]>([]);
    const [tenantLoading, setTenantLoading] = useState(true);

    // Admin observability data
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [health, setHealth] = useState<HealthData | null>(null);
    const [logs, setLogs] = useState<PaginatedLogs | null>(null);
    const [countries, setCountries] = useState<UsersByCountryData | null>(null);
    const [liveUsers, setLiveUsers] = useState<LiveUsersData | null>(null);
    const [alerts, setAlerts] = useState<PaginatedAlerts | null>(null);

    // Filters / pagination
    const [logPage, setLogPage] = useState(1);
    const [logLevel, setLogLevel] = useState('');
    const [alertPage, setAlertPage] = useState(1);
    const [alertSeverity, setAlertSeverity] = useState('');

    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [refreshing, setRefreshing] = useState(false);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── Data fetchers ───
    const fetchTenantData = useCallback(async () => {
        try {
            const res = await api.get('/Dashboard/admin-stats');
            setCompanies(res.data || []);
        } catch {
            // non-critical
        } finally {
            setTenantLoading(false);
        }
    }, []);

    const fetchOverview = useCallback(async () => {
        try {
            const res = await api.get('/admin/overview');
            const raw = res.data;
            // Normalize health object fields to frontend HealthData interface
            const h = raw?.health ?? {};
            const normalizedHealth: HealthData = {
                status: h.status ?? 'Unknown',
                uptimeSeconds: h.uptimeSeconds ?? 0,
                totalRequests: h.totalRequests ?? 0,
                averageResponseTimeMs: h.averageResponseTimeMs ?? 0,
                errorRate: h.errorRate ?? h.errorRate24h ?? 0,
                errors24h: h.errors24h ?? h.errorCount24h ?? 0,
                databaseConnected: typeof h.databaseConnected === 'boolean' ? h.databaseConnected : h.databaseStatus === 'Healthy',
                timestamp: h.timestamp ?? h.serverStartedAt ?? new Date().toISOString()
            };
            // Normalize liveUsers
            const lu = raw?.liveUsers ?? {};
            const normalizedLive: LiveUsersData = {
                activeCount: lu.activeCount ?? lu.totalConnected ?? 0,
                users: Array.isArray(lu.users) ? lu.users : (Array.isArray(lu.sessions) ? lu.sessions : []),
                byRole: lu.byRole ?? {}
            };
            setOverview({
                health: normalizedHealth,
                liveUsers: normalizedLive,
                recentLogs: Array.isArray(raw?.recentLogs) ? raw.recentLogs : [],
                recentAlerts: Array.isArray(raw?.recentAlerts) ? raw.recentAlerts : [],
                totalLogCount: raw?.totalLogCount ?? 0,
                totalAlertCount: raw?.totalAlertCount ?? 0
            });
            setError(null);
        } catch {
            setError('Failed to fetch admin overview.');
        }
    }, []);

    const fetchHealth = useCallback(async () => {
        try {
            const res = await api.get('/admin/health');
            const h = res.data ?? {};
            setHealth({
                status: h.status ?? 'Unknown',
                uptimeSeconds: h.uptimeSeconds ?? 0,
                totalRequests: h.totalRequests ?? 0,
                averageResponseTimeMs: h.averageResponseTimeMs ?? 0,
                errorRate: h.errorRate ?? h.errorRate24h ?? 0,
                errors24h: h.errors24h ?? h.errorCount24h ?? 0,
                databaseConnected: typeof h.databaseConnected === 'boolean' ? h.databaseConnected : h.databaseStatus === 'Healthy',
                timestamp: h.timestamp ?? h.serverStartedAt ?? new Date().toISOString()
            });
        } catch { /* silent */ }
    }, []);

    const fetchLogs = useCallback(async () => {
        try {
            const params = new URLSearchParams({ page: String(logPage), pageSize: '20' });
            if (logLevel) params.set('level', logLevel);
            const res = await api.get(`/admin/logs?${params}`);
            const raw = res.data;
            // Normalize: backend may use 'data' or 'items' key
            setLogs({
                items: Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw?.data) ? raw.data : []),
                page: raw?.page ?? 1,
                pageSize: raw?.pageSize ?? 20,
                totalCount: raw?.totalCount ?? 0,
                totalPages: raw?.totalPages ?? 1
            });
        } catch { /* silent */ }
    }, [logPage, logLevel]);

    const fetchCountries = useCallback(async () => {
        try {
            const res = await api.get('/admin/users-by-country');
            const raw = res.data;
            // Normalize: backend should return { countries, totalLogins } but guard against plain array
            if (Array.isArray(raw)) {
                setCountries({ countries: raw, totalLogins: raw.reduce((s: number, c: CountryEntry) => s + (c.count ?? 0), 0) });
            } else {
                setCountries({
                    countries: Array.isArray(raw?.countries) ? raw.countries : [],
                    totalLogins: raw?.totalLogins ?? 0
                });
            }
        } catch { /* silent */ }
    }, []);

    const fetchLiveUsers = useCallback(async () => {
        try {
            const res = await api.get('/admin/live-users');
            const raw = res.data;
            // Normalize to LiveUsersData shape
            setLiveUsers({
                activeCount: raw?.activeCount ?? raw?.totalConnected ?? 0,
                users: Array.isArray(raw?.users) ? raw.users : (Array.isArray(raw?.sessions) ? raw.sessions : []),
                byRole: raw?.byRole ?? {}
            });
        } catch { /* silent */ }
    }, []);

    const fetchAlerts = useCallback(async () => {
        try {
            const params = new URLSearchParams({ page: String(alertPage), pageSize: '20' });
            if (alertSeverity) params.set('severity', alertSeverity);
            const res = await api.get(`/admin/security-alerts?${params}`);
            const raw = res.data;
            // Normalize: backend may use 'data' or 'items' key
            setAlerts({
                items: Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw?.data) ? raw.data : []),
                page: raw?.page ?? 1,
                pageSize: raw?.pageSize ?? 20,
                totalCount: raw?.totalCount ?? 0,
                totalPages: raw?.totalPages ?? 1
            });
        } catch { /* silent */ }
    }, [alertPage, alertSeverity]);

    // ─── Initial load ───
    useEffect(() => {
        fetchTenantData();
        fetchOverview();
    }, [fetchTenantData, fetchOverview]);

    // ─── Tab-specific fetching ───
    useEffect(() => {
        switch (activeTab) {
            case 'health': fetchHealth(); break;
            case 'logs': fetchLogs(); break;
            case 'countries': fetchCountries(); break;
            case 'live': fetchLiveUsers(); break;
            case 'security': fetchAlerts(); break;
        }
    }, [activeTab, fetchHealth, fetchLogs, fetchCountries, fetchLiveUsers, fetchAlerts]);

    // Re-fetch logs when page/level changes
    useEffect(() => { if (activeTab === 'logs') fetchLogs(); }, [logPage, logLevel, activeTab, fetchLogs]);
    useEffect(() => { if (activeTab === 'security') fetchAlerts(); }, [alertPage, alertSeverity, activeTab, fetchAlerts]);

    // ─── Auto-refresh ───
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setLastRefresh(new Date());
            if (activeTab === 'overview') fetchOverview();
            else if (activeTab === 'health') fetchHealth();
            else if (activeTab === 'live') fetchLiveUsers();
        }, AUTO_REFRESH_MS);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [activeTab, fetchOverview, fetchHealth, fetchLiveUsers]);

    const manualRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([fetchOverview(), fetchTenantData()]);
            switch (activeTab) {
                case 'health': await fetchHealth(); break;
                case 'logs': await fetchLogs(); break;
                case 'countries': await fetchCountries(); break;
                case 'live': await fetchLiveUsers(); break;
                case 'security': await fetchAlerts(); break;
            }
            setLastRefresh(new Date());
        } finally {
            setRefreshing(false);
        }
    };

    // ─── Computed totals ───
    const totalCompanies = companies.length;
    const totalUsers = companies.reduce((s, c) => s + c.userCount, 0);
    const totalInvoices = companies.reduce(
        (s, c) => s + c.currencyBuckets.reduce((ss, b) => ss + b.invoiceCount, 0), 0
    );
    const globalCurrencyMap = new Map<string, { revenue: number; expenses: number; net: number; unpaid: number }>();
    for (const company of companies) {
        for (const bucket of company.currencyBuckets) {
            const existing = globalCurrencyMap.get(bucket.currency) || { revenue: 0, expenses: 0, net: 0, unpaid: 0 };
            existing.revenue += bucket.revenue;
            existing.expenses += bucket.expenses;
            existing.net += bucket.net;
            existing.unpaid += bucket.unpaidAmount;
            globalCurrencyMap.set(bucket.currency, existing);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Render helpers
    // ═══════════════════════════════════════════════════════════

    const renderOverviewTab = () => {
        if (!overview) return <LoadingSkeleton />;
        const h = overview.health ?? {} as HealthData;
        return (
            <div className="space-y-6">
                {/* Quick health strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard icon={<Activity size={20} />} label="API Status"
                        value={h.databaseConnected ? 'Healthy' : 'Degraded'}
                        accent={h.databaseConnected ? 'emerald' : 'red'} />
                    <KpiCard icon={<Clock size={20} />} label="Uptime"
                        value={formatUptime(h.uptimeSeconds ?? 0)} accent="blue" />
                    <KpiCard icon={<BarChart3 size={20} />} label="Requests"
                        value={(h.totalRequests ?? 0).toLocaleString()} accent="purple" />
                    <KpiCard icon={<AlertTriangle size={20} />} label="Error Rate"
                        value={`${((h.errorRate ?? 0) * 100).toFixed(2)}%`}
                        accent={(h.errorRate ?? 0) > 0.05 ? 'red' : 'emerald'} />
                </div>

                {/* Live users strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard icon={<Wifi size={20} />} label="Live Users"
                        value={String(overview.liveUsers?.activeCount ?? 0)} accent="cyan" />
                    <KpiCard icon={<Shield size={20} />} label="Security Alerts"
                        value={String(overview.totalAlertCount ?? 0)} accent={(overview.totalAlertCount ?? 0) > 0 ? 'amber' : 'emerald'} />
                    <KpiCard icon={<ScrollText size={20} />} label="Log Entries"
                        value={String(overview.totalLogCount ?? 0)} accent="gray" />
                    <KpiCard icon={<Building2 size={20} />} label="Tenants"
                        value={String(totalCompanies)} accent="emerald" />
                </div>

                {/* Recent alerts */}
                {(overview.recentAlerts?.length ?? 0) > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Shield size={16} className="text-amber-600" /> Recent Security Alerts
                        </h3>
                        <div className="space-y-2">
                            {overview.recentAlerts.map(a => (
                                <div key={a.id} className={`rounded-lg border px-4 py-2 text-sm flex items-center justify-between ${SEVERITY_STYLES[a.severity] || 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{a.type}</span>
                                        <span className="opacity-75">{a.message}</span>
                                    </div>
                                    <span className="text-xs opacity-60">{timeAgo(a.timestamp)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent logs */}
                {(overview.recentLogs?.length ?? 0) > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <ScrollText size={16} className="text-gray-500" /> Recent Logs
                        </h3>
                        <div className="space-y-1">
                            {overview.recentLogs.map((l, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${LOG_LEVEL_STYLES[l.level] || 'bg-gray-100 text-gray-600'}`}>
                                        {l.level}
                                    </span>
                                    <span className="text-gray-400 shrink-0">{new Date(l.timestamp).toLocaleTimeString()}</span>
                                    <span className="text-gray-700 truncate">{l.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tenant overview (existing) */}
                {renderTenantOverview()}
            </div>
        );
    };

    const renderHealthTab = () => {
        const h = health || overview?.health;
        if (!h) return <LoadingSkeleton />;
        return (
            <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Activity size={20} className="text-emerald-600" /> Application Health
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <HealthMetric
                            label="API Status" value={h.databaseConnected ? 'Healthy' : 'Degraded'}
                            icon={h.databaseConnected ? <CheckCircle className="text-emerald-500" size={28} /> : <XCircle className="text-red-500" size={28} />} />
                        <HealthMetric label="Database" value={h.databaseConnected ? 'Connected' : 'Disconnected'}
                            icon={h.databaseConnected ? <CheckCircle className="text-emerald-500" size={28} /> : <XCircle className="text-red-500" size={28} />} />
                        <HealthMetric label="Uptime" value={formatUptime(h.uptimeSeconds ?? 0)}
                            icon={<Clock className="text-blue-500" size={28} />} />
                        <HealthMetric label="Total Requests" value={(h.totalRequests ?? 0).toLocaleString()}
                            icon={<BarChart3 className="text-purple-500" size={28} />} />
                        <HealthMetric label="Avg Response Time" value={`${(h.averageResponseTimeMs ?? 0).toFixed(1)} ms`}
                            icon={<Activity className="text-blue-500" size={28} />} />
                        <HealthMetric label="Error Rate (24h)" value={`${((h.errorRate ?? 0) * 100).toFixed(2)}%`}
                            subtitle={`${h.errors24h ?? 0} errors`}
                            icon={<AlertTriangle className={(h.errorRate ?? 0) > 0.05 ? 'text-red-500' : 'text-emerald-500'} size={28} />} />
                    </div>
                </div>
                <div className="text-xs text-gray-400 text-right">
                    Last checked: {h.timestamp ? new Date(h.timestamp).toLocaleString() : 'N/A'}
                </div>
            </div>
        );
    };

    const renderLogsTab = () => {
        if (!logs) return <LoadingSkeleton />;
        return (
            <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <ScrollText size={20} className="text-gray-600" /> Application Logs
                        </h3>
                        <div className="flex items-center gap-2">
                            <Filter size={14} className="text-gray-400" />
                            <select
                                value={logLevel}
                                onChange={e => { setLogLevel(e.target.value); setLogPage(1); }}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none"
                            >
                                <option value="">All Levels</option>
                                <option value="Warning">Warning</option>
                                <option value="Error">Error</option>
                                <option value="Fatal">Fatal</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-gray-500 text-xs">
                                    <th className="text-left py-2 px-2 w-20">Level</th>
                                    <th className="text-left py-2 px-2 w-44">Timestamp</th>
                                    <th className="text-left py-2 px-2 w-24">Source</th>
                                    <th className="text-left py-2 px-2">Message</th>
                                    <th className="text-left py-2 px-2 w-36">Exception</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.items.map((log, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="py-2 px-2">
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${LOG_LEVEL_STYLES[log.level] || 'bg-gray-100 text-gray-600'}`}>
                                                {log.level}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 text-gray-500 text-xs font-mono">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="py-2 px-2 text-gray-500 text-xs">{log.source}</td>
                                        <td className="py-2 px-2 text-gray-700 max-w-md truncate" title={log.message}>
                                            {log.message}
                                        </td>
                                        <td className="py-2 px-2 text-red-500 text-xs truncate" title={log.exceptionType || ''}>
                                            {log.exceptionType || '\u2014'}
                                        </td>
                                    </tr>
                                ))}
                                {logs.items.length === 0 && (
                                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No logs found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {logs.totalPages > 1 && (
                        <Pagination page={logPage} totalPages={logs.totalPages}
                            totalCount={logs.totalCount} onPageChange={setLogPage} />
                    )}
                </div>
            </div>
        );
    };

    const renderCountriesTab = () => {
        if (!countries) return <LoadingSkeleton />;
        const countryList = Array.isArray(countries.countries) ? countries.countries : [];
        const totalLogins = countries.totalLogins ?? 0;
        return (
            <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Globe size={20} className="text-[#065F46]" /> Users by Country
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Based on {totalLogins.toLocaleString()} login records (IP geolocation)
                    </p>

                    {countryList.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">No login records yet.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {countryList.map(c => (
                                <div key={c.countryCode || c.country}
                                    className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{countryFlagEmoji(c.countryCode)}</span>
                                        <div>
                                            <span className="text-sm font-medium text-gray-700">{c.country || 'Unknown'}</span>
                                            {c.countryCode && (
                                                <span className="text-xs text-gray-400 ml-1">({c.countryCode})</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="bg-[#065F46] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                            {c.count}
                                        </span>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{c.percentage.toFixed(1)}%</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderLiveUsersTab = () => {
        const data = liveUsers || overview?.liveUsers;
        if (!data) return <LoadingSkeleton />;
        const userList = Array.isArray(data.users) ? data.users : [];
        const roleEntries = data.byRole ? Object.entries(data.byRole) : [];
        return (
            <div className="space-y-4">
                {/* Role breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard icon={<Users size={20} />} label="Total Active"
                        value={String(data.activeCount ?? 0)} accent="cyan" />
                    {roleEntries.map(([role, count]) => (
                        <KpiCard key={role} icon={<Users size={20} />} label={role}
                            value={String(count ?? 0)} accent="blue" />
                    ))}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Wifi size={20} className="text-cyan-600" /> Active Sessions
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-gray-500 text-xs">
                                    <th className="text-left py-2 px-2">Email</th>
                                    <th className="text-left py-2 px-2">Role</th>
                                    <th className="text-left py-2 px-2">IP Address</th>
                                    <th className="text-left py-2 px-2">Session Duration</th>
                                    <th className="text-left py-2 px-2">Last Activity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userList.map(u => (
                                    <tr key={u.userId || u.email} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="py-2 px-2 text-gray-700 font-medium">{u.email}</td>
                                        <td className="py-2 px-2">
                                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-700">
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 text-gray-500 font-mono text-xs">{u.ipAddress ?? '—'}</td>
                                        <td className="py-2 px-2 text-gray-500">{(u.sessionDurationMinutes ?? 0).toFixed(0)}m</td>
                                        <td className="py-2 px-2 text-gray-400 text-xs">{u.lastActivity ? timeAgo(u.lastActivity) : '—'}</td>
                                    </tr>
                                ))}
                                {userList.length === 0 && (
                                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No active sessions.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderSecurityTab = () => {
        if (!alerts) return <LoadingSkeleton />;
        return (
            <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Shield size={20} className="text-amber-600" /> Security Alerts
                        </h3>
                        <div className="flex items-center gap-2">
                            <Filter size={14} className="text-gray-400" />
                            <select
                                value={alertSeverity}
                                onChange={e => { setAlertSeverity(e.target.value); setAlertPage(1); }}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                            >
                                <option value="">All Severities</option>
                                <option value="Critical">Critical</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {alerts.items.map(a => (
                            <div key={a.id}
                                className={`rounded-xl border px-5 py-3 flex items-start justify-between gap-4 ${SEVERITY_STYLES[a.severity] || 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-sm">{a.type}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 font-medium">{a.severity}</span>
                                    </div>
                                    <p className="text-sm opacity-80 truncate">{a.message}</p>
                                    <div className="flex items-center gap-3 mt-1 text-[11px] opacity-60">
                                        <span>IP: {a.ipAddress}</span>
                                        {a.userId && <span>User: {a.userId.substring(0, 8)}\u2026</span>}
                                    </div>
                                </div>
                                <span className="text-xs opacity-60 whitespace-nowrap">{timeAgo(a.timestamp)}</span>
                            </div>
                        ))}
                        {alerts.items.length === 0 && (
                            <div className="text-center py-10 text-gray-400">
                                <Shield size={40} className="mx-auto mb-2 text-emerald-300" />
                                <p>No security alerts. All clear!</p>
                            </div>
                        )}
                    </div>

                    {alerts.totalPages > 1 && (
                        <Pagination page={alertPage} totalPages={alerts.totalPages}
                            totalCount={alerts.totalCount} onPageChange={setAlertPage} />
                    )}
                </div>
            </div>
        );
    };

    const renderTenantOverview = () => {
        if (tenantLoading) return <LoadingSkeleton />;
        return (
            <>
                {/* Top-level KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <Building2 className="text-emerald-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('dashboard.totalCompanies', 'Total Companies')}</p>
                            <p className="text-2xl font-bold text-gray-900">{totalCompanies}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Users className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('dashboard.totalUsers', 'Total Users')}</p>
                            <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-purple-100 flex items-center justify-center">
                            <FileText className="text-purple-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('dashboard.totalInvoices', 'Total Invoices')}</p>
                            <p className="text-2xl font-bold text-gray-900">{totalInvoices}</p>
                        </div>
                    </div>
                </div>

                {/* Global Currency Summary */}
                {globalCurrencyMap.size > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <BarChart3 size={20} className="text-[#065F46]" />
                            {t('dashboard.globalSummary', 'Global Financial Summary')}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from(globalCurrencyMap.entries()).map(([currency, data]) => (
                                <div key={currency} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <DollarSign size={16} className="text-gray-500" />
                                        <span className="font-semibold text-gray-800 text-lg">{currency}</span>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">{t('dashboard.revenue', 'Revenue')}</span>
                                            <span className="font-medium text-emerald-600">{formatAmount(data.revenue, currency)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">{t('dashboard.expenses', 'Expenses')}</span>
                                            <span className="font-medium text-red-600">{formatAmount(data.expenses, currency)}</span>
                                        </div>
                                        <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
                                            <span className="text-gray-700">{t('dashboard.net', 'Net')}</span>
                                            <span className={data.net >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                                                {formatAmount(data.net, currency)}
                                            </span>
                                        </div>
                                        {data.unpaid > 0 && (
                                            <div className="flex justify-between text-amber-600">
                                                <span>{t('dashboard.pending', 'Pending')}</span>
                                                <span className="font-medium">{formatAmount(data.unpaid, currency)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Per-Company Breakdown */}
                <div>
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Briefcase size={20} className="text-[#065F46]" />
                        {t('dashboard.companyBreakdown', 'Per-Company Breakdown')}
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {companies.map((company, idx) => {
                            const color = CARD_COLORS[idx % CARD_COLORS.length];
                            return (
                                <div key={company.companyId}
                                    className={`rounded-2xl border ${color.border} ${color.bg} overflow-hidden shadow-sm`}>
                                    <div className={`${color.headerBg} px-6 py-4 flex items-center justify-between`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`size-10 rounded-lg bg-white/70 flex items-center justify-center ${color.accent} font-bold text-lg`}>
                                                {company.companyName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className={`font-semibold ${color.accent}`}>{company.companyName}</h3>
                                                <span className="text-xs text-gray-500">
                                                    {company.userCount} {t('dashboard.users', 'users')}
                                                    {company.employeeLimit > 0 ? ` / ${company.employeeLimit} max` : ''}
                                                    {' \u00B7 '}{t('dashboard.default', 'Default')}: {company.defaultCurrency}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {company.currencyBuckets.length === 0 ? (
                                            <p className="text-sm text-gray-400 italic text-center py-4">
                                                {t('dashboard.noData', 'No financial data yet.')}
                                            </p>
                                        ) : (
                                            company.currencyBuckets.map((bucket) => (
                                                <div key={bucket.currency} className="bg-white rounded-xl p-4 border border-gray-200 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-gray-700">{bucket.currency}</span>
                                                        <span className="text-xs text-gray-400">
                                                            {bucket.invoiceCount} {t('dashboard.invoices', 'invoices')}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                                        <div>
                                                            <span className="text-gray-400 text-xs block">{t('dashboard.revenue', 'Revenue')}</span>
                                                            <span className="font-medium text-emerald-600 flex items-center gap-1">
                                                                <TrendingUp size={14} />
                                                                {formatAmount(bucket.revenue, bucket.currency)}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 text-xs block">{t('dashboard.expenses', 'Expenses')}</span>
                                                            <span className="font-medium text-red-600 flex items-center gap-1">
                                                                <TrendingDown size={14} />
                                                                {formatAmount(bucket.expenses, bucket.currency)}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 text-xs block">{t('dashboard.net', 'Net')}</span>
                                                            <span className={`font-semibold ${bucket.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                {formatAmount(bucket.net, bucket.currency)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {bucket.unpaidCount > 0 && (
                                                        <div className="flex items-center gap-2 text-amber-600 text-xs pt-1 border-t border-gray-100">
                                                            <AlertTriangle size={14} />
                                                            <span>
                                                                {bucket.unpaidCount} {t('dashboard.pendingInvoices', 'pending')} \u00B7 {formatAmount(bucket.unpaidAmount, bucket.currency)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </>
        );
    };

    // ─── Tab content router ───
    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview': return renderOverviewTab();
            case 'health': return renderHealthTab();
            case 'logs': return renderLogsTab();
            case 'countries': return renderCountriesTab();
            case 'live': return renderLiveUsersTab();
            case 'security': return renderSecurityTab();
        }
    };

    if (error && !overview) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertTriangle size={48} className="text-red-400 mb-4" />
                <p className="text-red-600 font-medium">{error}</p>
                <button onClick={manualRefresh}
                    className="mt-4 px-4 py-2 bg-[#065F46] text-white rounded-xl hover:bg-[#047857]">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {t('dashboard.adminTitle', 'Platform Overview')}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {t('dashboard.adminSubtitle', 'Real-time observability & tenant management')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                        Last refresh: {lastRefresh.toLocaleTimeString()}
                    </span>
                    <button
                        onClick={manualRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-1 overflow-x-auto pb-px">
                    {TAB_LIST.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                                    ? 'border-[#065F46] text-[#065F46]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            <ErrorBoundary scope={`AdminTab:${activeTab}`} key={activeTab}>
                {renderTabContent()}
            </ErrorBoundary>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// Reusable sub-components
// ═══════════════════════════════════════════════════════════

function LoadingSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
            </div>
            <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
    );
}

function KpiCard({ icon, label, value, accent }: {
    icon: React.ReactNode; label: string; value: string;
    accent: 'emerald' | 'blue' | 'purple' | 'amber' | 'red' | 'cyan' | 'gray';
}) {
    const colorMap: Record<string, { bg: string; text: string }> = {
        emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
        blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
        purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
        amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
        red: { bg: 'bg-red-100', text: 'text-red-600' },
        cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600' },
        gray: { bg: 'bg-gray-100', text: 'text-gray-600' },
    };
    const c = colorMap[accent] || colorMap.gray;
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`size-10 rounded-xl ${c.bg} flex items-center justify-center ${c.text}`}>
                {icon}
            </div>
            <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
        </div>
    );
}

function HealthMetric({ label, value, icon, subtitle }: {
    label: string; value: string; icon: React.ReactNode; subtitle?: string;
}) {
    return (
        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 flex items-center gap-4">
            {icon}
            <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-lg font-bold text-gray-900">{value}</p>
                {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
        </div>
    );
}

function Pagination({ page, totalPages, totalCount, onPageChange }: {
    page: number; totalPages: number; totalCount: number;
    onPageChange: (p: number) => void;
}) {
    return (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">{totalCount} total entries</span>
            <div className="flex items-center gap-2">
                <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                </span>
                <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}

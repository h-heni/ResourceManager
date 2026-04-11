import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import api from '../services/api';
import {
    Building2, Users, Shield, RefreshCw,
    ChevronUp, ChevronDown, Search, Filter, CheckCircle,
    XCircle, AlertTriangle, Loader2, Save, X,
    Plus, Minus, Calendar
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════
interface CompanySubscription {
    id: number;
    name: string;
    email: string | null;
    employeeLimit: number;
    employeeCount: number;
    subscriptionExpiryDate: string | null;
    accountStatus: string;
    createdAt: string;
}

type StatusFilter = 'All' | 'Active' | 'Expired' | 'Suspended';

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════
function getStatusInfo(status: string, expiryDate: string | null): {
    label: string; color: string; bgColor: string; borderColor: string; icon: typeof CheckCircle;
} {
    if (status === 'Suspended') {
        return { label: 'Suspended', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: XCircle };
    }
    if (status === 'Expired') {
        return { label: 'Expired', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: XCircle };
    }
    // Active — check expiry proximity
    if (expiryDate) {
        const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
        if (days <= 0) {
            return { label: 'Expired', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: XCircle };
        }
        if (days <= 7) {
            return { label: `Expiring (${days}d)`, color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', icon: AlertTriangle };
        }
    }
    return { label: 'Active', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', icon: CheckCircle };
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════
export default function SubscriptionManagementPage() {
    const { t } = useTranslation();
    const { isSuperAdmin } = useAuth();

    const [companies, setCompanies] = useState<CompanySubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [sortField, setSortField] = useState<'name' | 'status' | 'expiry'>('name');
    const [sortAsc, setSortAsc] = useState(true);

    // Edit modal state
    const [editingCompany, setEditingCompany] = useState<CompanySubscription | null>(null);
    const [editForm, setEditForm] = useState({ employeeLimit: 0, expiryDate: '', accountStatus: '' });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');

    // Quick action states
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    // ─── Fetch ───
    const fetchCompanies = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/companies');
            setCompanies(res.data || []);
            setError(null);
        } catch {
            setError(t('subscription.fetchError', 'Failed to load companies.'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

    // Guard — SuperAdmin only
    if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

    // ─── Filter & Sort ───
    const filtered = companies
        .filter(c => {
            if (statusFilter !== 'All') {
                const info = getStatusInfo(c.accountStatus, c.subscriptionExpiryDate);
                // Match on the raw accountStatus for Suspended, or computed for Expired
                if (statusFilter === 'Suspended' && c.accountStatus !== 'Suspended') return false;
                if (statusFilter === 'Expired' && c.accountStatus !== 'Expired' && !info.label.startsWith('Expired')) return false;
                if (statusFilter === 'Active' && (c.accountStatus !== 'Active' || info.label.startsWith('Expired'))) return false;
            }
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return c.name.toLowerCase().includes(q) ||
                    (c.email?.toLowerCase().includes(q)) ||
                    String(c.id).includes(q);
            }
            return true;
        })
        .sort((a, b) => {
            let cmp = 0;
            if (sortField === 'name') cmp = a.name.localeCompare(b.name);
            else if (sortField === 'status') cmp = a.accountStatus.localeCompare(b.accountStatus);
            else if (sortField === 'expiry') {
                const da = a.subscriptionExpiryDate ? new Date(a.subscriptionExpiryDate).getTime() : Infinity;
                const db = b.subscriptionExpiryDate ? new Date(b.subscriptionExpiryDate).getTime() : Infinity;
                cmp = da - db;
            }
            return sortAsc ? cmp : -cmp;
        });

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortAsc(!sortAsc);
        else { setSortField(field); setSortAsc(true); }
    };

    const SortIcon = ({ field }: { field: typeof sortField }) => {
        if (sortField !== field) return null;
        return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
    };

    // ─── Quick Actions ───
    const handleQuickExtend = async (id: number, months: number) => {
        setActionLoading(id);
        try {
            const company = companies.find(c => c.id === id);
            const base = company?.subscriptionExpiryDate ? new Date(company.subscriptionExpiryDate) : new Date();
            if (base < new Date()) base.setTime(Date.now()); // if expired, extend from now
            base.setMonth(base.getMonth() + months);
            await api.put(`/admin/companies/${id}/subscription`, {
                subscriptionExpiryDate: base.toISOString(),
                accountStatus: 'Active'
            });
            await fetchCompanies();
        } catch {
            setError(t('subscription.actionError', 'Action failed.'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleSuspend = async (company: CompanySubscription) => {
        setActionLoading(company.id);
        try {
            if (company.accountStatus === 'Suspended') {
                await api.post(`/admin/companies/${company.id}/reactivate`);
            } else {
                await api.post(`/admin/companies/${company.id}/suspend`);
            }
            await fetchCompanies();
        } catch {
            setError(t('subscription.actionError', 'Action failed.'));
        } finally {
            setActionLoading(null);
        }
    };

    // ─── Edit Modal ───
    const openEdit = (company: CompanySubscription) => {
        setEditingCompany(company);
        setEditForm({
            employeeLimit: company.employeeLimit,
            expiryDate: company.subscriptionExpiryDate
                ? new Date(company.subscriptionExpiryDate).toISOString().slice(0, 10)
                : '',
            accountStatus: company.accountStatus
        });
        setSaveError('');
        setSaveSuccess('');
    };

    const handleSaveEdit = async () => {
        if (!editingCompany) return;
        setSaving(true);
        setSaveError('');
        setSaveSuccess('');
        try {
            const payload: Record<string, unknown> = {};
            if (editForm.expiryDate) payload.subscriptionExpiryDate = new Date(editForm.expiryDate).toISOString();
            if (editForm.accountStatus) payload.accountStatus = editForm.accountStatus;
            payload.employeeLimit = editForm.employeeLimit;

            await api.put(`/admin/companies/${editingCompany.id}/subscription`, payload);
            setSaveSuccess(t('subscription.saved', 'Saved successfully.'));
            await fetchCompanies();
            setTimeout(() => setEditingCompany(null), 800);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('subscription.saveFailed', 'Save failed.');
            setSaveError(msg);
        } finally {
            setSaving(false);
        }
    };

    // ─── Stats ───
    const totalCompanies = companies.length;
    const activeCount = companies.filter(c => c.accountStatus === 'Active' && (!c.subscriptionExpiryDate || new Date(c.subscriptionExpiryDate) > new Date())).length;
    const expiredCount = companies.filter(c => c.accountStatus === 'Expired' || (c.subscriptionExpiryDate && new Date(c.subscriptionExpiryDate) <= new Date())).length;
    const suspendedCount = companies.filter(c => c.accountStatus === 'Suspended').length;
    const expiringCount = companies.filter(c => {
        if (c.accountStatus !== 'Active' || !c.subscriptionExpiryDate) return false;
        const days = Math.ceil((new Date(c.subscriptionExpiryDate).getTime() - Date.now()) / 86400000);
        return days > 0 && days <= 7;
    }).length;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield size={24} className="text-[#065F46]" />
                        {t('subscription.title', 'Subscription Management')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {t('subscription.subtitle', 'Manage company subscriptions, capacity, and access.')}
                    </p>
                </div>
                <button
                    onClick={fetchCompanies}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#065F46] text-white hover:bg-[#047857] disabled:opacity-50 transition-colors"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    {t('common.refresh', 'Refresh')}
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                    label={t('subscription.stats.total', 'Total Companies')}
                    value={totalCompanies}
                    icon={Building2}
                    color="bg-blue-50 text-blue-700 border-blue-200"
                />
                <StatCard
                    label={t('subscription.stats.active', 'Active')}
                    value={activeCount}
                    icon={CheckCircle}
                    color="bg-emerald-50 text-emerald-700 border-emerald-200"
                />
                <StatCard
                    label={t('subscription.stats.expiring', 'Expiring Soon')}
                    value={expiringCount}
                    icon={AlertTriangle}
                    color="bg-orange-50 text-orange-700 border-orange-200"
                />
                <StatCard
                    label={t('subscription.stats.suspended', 'Suspended / Expired')}
                    value={suspendedCount + expiredCount}
                    icon={XCircle}
                    color="bg-red-50 text-red-700 border-red-200"
                />
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('subscription.search', 'Search by name, email, or ID...')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-400" />
                    {(['All', 'Active', 'Expired', 'Suspended'] as StatusFilter[]).map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                statusFilter === s
                                    ? 'bg-[#065F46] text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {t(`subscription.filter.${s.toLowerCase()}`, s)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                    <AlertTriangle size={18} className="text-red-500" />
                    <p className="text-sm text-red-700">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={16} /></button>
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="animate-spin h-8 w-8 text-[#065F46]" />
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none" onClick={() => toggleSort('name')}>
                                        <span className="flex items-center gap-1">{t('subscription.col.company', 'Company')} <SortIcon field="name" /></span>
                                    </th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer select-none" onClick={() => toggleSort('status')}>
                                        <span className="flex items-center justify-center gap-1">{t('subscription.col.status', 'Status')} <SortIcon field="status" /></span>
                                    </th>
                                    <th className="px-4 py-3 text-center whitespace-nowrap font-semibold text-gray-700 cursor-pointer select-none" onClick={() => toggleSort('expiry')}>
                                        <span className="flex items-center justify-center gap-1">{t('subscription.col.expiry', 'Expiry Date')} <SortIcon field="expiry" /></span>
                                    </th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-700">
                                        {t('subscription.col.capacity', 'Employees')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-700">
                                        {t('subscription.col.actions', 'Actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                                            {t('subscription.noResults', 'No companies found.')}
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(company => {
                                        const status = getStatusInfo(company.accountStatus, company.subscriptionExpiryDate);
                                        const StatusIcon = status.icon;
                                        const isLoading = actionLoading === company.id;
                                        const capacityDisplay = company.employeeLimit > 0
                                            ? `${company.employeeCount} / ${company.employeeLimit + 1}`
                                            : `${company.employeeCount} / ∞`;
                                        const capacityWarning = company.employeeLimit > 0 && company.employeeCount >= company.employeeLimit + 1;

                                        return (
                                            <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                                                {/* Company */}
                                                <td className="px-4 py-3 text-left">
                                                    <div>
                                                        <span className="font-semibold text-gray-900">{company.name}</span>
                                                        <span className="ml-2 text-xs text-gray-400">#{company.id}</span>
                                                    </div>
                                                    {company.email && (
                                                        <div className="text-xs text-gray-500 mt-0.5">{company.email}</div>
                                                    )}
                                                </td>

                                                {/* Status Badge */}
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.bgColor} ${status.color} ${status.borderColor}`}>
                                                        <StatusIcon size={13} />
                                                        {t(`subscription.status.${status.label.split(' ')[0].toLowerCase()}`, status.label)}
                                                    </span>
                                                </td>

                                                {/* Expiry */}
                                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                                    <span className="text-gray-700">{formatDate(company.subscriptionExpiryDate)}</span>
                                                    {company.subscriptionExpiryDate && (() => {
                                                        const days = Math.ceil((new Date(company.subscriptionExpiryDate).getTime() - Date.now()) / 86400000);
                                                        if (days > 0 && days <= 30) return (
                                                            <div className={`text-xs mt-0.5 ${days <= 7 ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                                                                {days} {t('subscription.daysLeft', 'days left')}
                                                            </div>
                                                        );
                                                        if (days <= 0) return (
                                                            <div className="text-xs mt-0.5 text-red-600 font-medium">
                                                                {t('subscription.expired', 'Expired')}
                                                            </div>
                                                        );
                                                        return null;
                                                    })()}
                                                </td>

                                                {/* Capacity */}
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 text-sm font-medium ${capacityWarning ? 'text-red-600' : 'text-gray-700'}`}>
                                                        <Users size={14} />
                                                        {capacityDisplay}
                                                    </span>
                                                    {capacityWarning && (
                                                        <div className="text-xs text-red-500 mt-0.5">{t('subscription.capacityFull', 'Full')}</div>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                        {isLoading ? (
                                                            <Loader2 size={16} className="animate-spin text-gray-400" />
                                                        ) : (
                                                            <>
                                                                {/* Quick Extend */}
                                                                <button
                                                                    onClick={() => handleQuickExtend(company.id, 1)}
                                                                    title={t('subscription.extend1m', '+1 Month')}
                                                                    className="px-2 py-1 text-xs rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                                                >
                                                                    +1M
                                                                </button>
                                                                <button
                                                                    onClick={() => handleQuickExtend(company.id, 12)}
                                                                    title={t('subscription.extend1y', '+1 Year')}
                                                                    className="px-2 py-1 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                                                                >
                                                                    +1Y
                                                                </button>

                                                                {/* Suspend/Reactivate Toggle */}
                                                                <button
                                                                    onClick={() => handleToggleSuspend(company)}
                                                                    title={company.accountStatus === 'Suspended'
                                                                        ? t('subscription.reactivate', 'Reactivate')
                                                                        : t('subscription.suspend', 'Suspend')}
                                                                    className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
                                                                        company.accountStatus === 'Suspended'
                                                                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                                                                            : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                                                                    }`}
                                                                >
                                                                    {company.accountStatus === 'Suspended'
                                                                        ? <CheckCircle size={13} />
                                                                        : <XCircle size={13} />}
                                                                </button>

                                                                {/* Edit */}
                                                                <button
                                                                    onClick={() => openEdit(company)}
                                                                    title={t('subscription.edit', 'Edit')}
                                                                    className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-colors font-medium"
                                                                >
                                                                    {t('common.edit', 'Edit')}
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── Edit Modal ─── */}
            {editingCompany && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditingCompany(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Building2 size={20} className="text-[#065F46]" />
                                    {editingCompany.name}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">ID: {editingCompany.id}</p>
                            </div>
                            <button onClick={() => setEditingCompany(null)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-5">
                            {/* Account Status */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                                    <Shield size={14} />
                                    {t('subscription.field.status', 'Account Status')}
                                </label>
                                <select
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none bg-white"
                                    value={editForm.accountStatus}
                                    onChange={e => setEditForm({ ...editForm, accountStatus: e.target.value })}
                                >
                                    <option value="Active">{t('subscription.status.active', 'Active')}</option>
                                    <option value="Suspended">{t('subscription.status.suspended', 'Suspended')}</option>
                                    <option value="Expired">{t('subscription.status.expired', 'Expired')}</option>
                                </select>
                            </div>

                            {/* Expiry Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                                    <Calendar size={14} />
                                    {t('subscription.field.expiry', 'Subscription Expiry Date')}
                                </label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                    value={editForm.expiryDate}
                                    onChange={e => setEditForm({ ...editForm, expiryDate: e.target.value })}
                                />
                                <div className="flex gap-2 mt-2">
                                    {[1, 3, 6, 12].map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => {
                                                const base = editForm.expiryDate ? new Date(editForm.expiryDate) : new Date();
                                                if (base < new Date()) base.setTime(Date.now());
                                                base.setMonth(base.getMonth() + m);
                                                setEditForm({ ...editForm, expiryDate: base.toISOString().slice(0, 10) });
                                            }}
                                            className="px-2.5 py-1 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                                        >
                                            +{m >= 12 ? `${m / 12}Y` : `${m}M`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Employee Limit */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                                    <Users size={14} />
                                    {t('subscription.field.capacity', 'Employee Capacity')}
                                </label>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditForm({ ...editForm, employeeLimit: Math.max(0, editForm.employeeLimit - 1) })}
                                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-24 text-center px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                        value={editForm.employeeLimit}
                                        onChange={e => setEditForm({ ...editForm, employeeLimit: Math.max(0, parseInt(e.target.value) || 0) })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setEditForm({ ...editForm, employeeLimit: editForm.employeeLimit + 1 })}
                                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200"
                                    >
                                        <Plus size={16} />
                                    </button>
                                    <span className="text-xs text-gray-400">
                                        {editForm.employeeLimit === 0
                                            ? t('subscription.unlimited', '0 = Unlimited')
                                            : `${t('subscription.maxEmployees', 'Max')}: ${editForm.employeeLimit + 1}`}
                                    </span>
                                </div>
                                {/* Capacity warning */}
                                {editForm.employeeLimit > 0 && editingCompany.employeeCount > editForm.employeeLimit + 1 && (
                                    <div className="mt-2 p-2.5 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
                                        <AlertTriangle size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-orange-700">
                                            {t('subscription.capacityWarning',
                                                'Current employees ({{count}}) exceed this limit. The manager won\'t be able to add new employees until some are removed.',
                                                { count: editingCompany.employeeCount }
                                            )}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Error / Success */}
                            {saveError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                                    <XCircle size={16} /> {saveError}
                                </div>
                            )}
                            {saveSuccess && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
                                    <CheckCircle size={16} /> {saveSuccess}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                            <button
                                onClick={() => setEditingCompany(null)}
                                className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-sm"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="px-5 py-2 rounded-xl bg-[#065F46] text-white hover:bg-[#047857] disabled:opacity-50 text-sm font-medium flex items-center gap-2 transition-colors"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {t('common.save', 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Stat Card Sub-Component ───
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Building2; color: string }) {
    return (
        <div className={`rounded-xl border p-4 ${color}`}>
            <div className="flex items-center justify-between">
                <Icon size={20} />
                <span className="text-2xl font-bold">{value}</span>
            </div>
            <p className="text-xs mt-1 opacity-80">{label}</p>
        </div>
    );
}

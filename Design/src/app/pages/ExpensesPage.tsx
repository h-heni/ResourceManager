import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Plus, Trash2, Edit2, Search, DollarSign, Calendar, X,
    TrendingUp, Loader2, FileText, Settings2, ChevronDown, ChevronRight
} from 'lucide-react';
import { useExpenses, useExpenseSummary, useSaveExpense, useDeleteExpense } from '../hooks/useExpenses';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../lib/formatNumber';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { logger } from '../lib/logger';
import Pagination from '../components/Pagination';

interface Expense {
    id: number;
    description: string;
    amount: number;
    date: string;
    category: string;
    notes?: string;
    isRecurring: boolean;
    createdAt: string;
    currency?: string;
    currencySymbol?: string;
}

interface CurrencyBreakdown {
    currency: string;
    currencySymbol: string;
    totalAll: number;
    totalThisMonth: number;
    totalThisYear: number;
    count: number;
}

interface ExpenseSummary {
    totalAll: number;
    totalThisMonth: number;
    totalThisYear: number;
    byCategory: { category: string; currency: string; total: number; count: number }[];
    count: number;
    currencyBreakdowns?: CurrencyBreakdown[];
    defaultCurrency?: string;
}

const BASE_CATEGORIES = [
    'rent', 'utilities', 'office', 'travel', 'marketing',
    'insurance', 'maintenance', 'subscription', 'salary', 'telecom',
    'bankFees', 'other'
];

const getCategoryLabel = (cat: string, t: (key: string) => string) => {
    if (BASE_CATEGORIES.includes(cat)) {
        return t(`expense.categories.${cat}`);
    }
    return cat;
};

interface CustomCategory {
    name: string;
    color: string;
}

const CUSTOM_COLOR_OPTIONS = [
    { bg: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
    { bg: 'bg-pink-100 text-pink-700', dot: 'bg-pink-500' },
    { bg: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
    { bg: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
    { bg: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
    { bg: 'bg-lime-100 text-lime-700', dot: 'bg-lime-500' },
    { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    { bg: 'bg-fuchsia-100 text-fuchsia-700', dot: 'bg-fuchsia-500' },
];

function getCustomCategories(): CustomCategory[] {
    try {
        const saved = localStorage.getItem('custom_expense_categories');
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
            return (parsed as string[]).map(name => ({ name, color: CUSTOM_COLOR_OPTIONS[0].bg }));
        }
        return parsed as CustomCategory[];
    } catch { return []; }
}

function saveCustomCategories(cats: CustomCategory[]) {
    localStorage.setItem('custom_expense_categories', JSON.stringify(cats));
}

export default function ExpensesPage() {
    const { t } = useTranslation();
    const { isManager } = useAuth();
    const { data: settingsData } = useSettings();
    const currencySymbol = settingsData?.currencySymbol || '$';
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(20);
    const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());

    // React Query hooks
    const { data: expensesData, isLoading: loading } = useExpenses(page, size);
    const { data: summaryRaw } = useExpenseSummary();
    const summary = summaryRaw as ExpenseSummary | undefined;
    const saveMutation = useSaveExpense();
    const deleteMutation = useDeleteExpense();
    const expenses = (expensesData?.data || []) as unknown as Expense[];
    const totalCount = expensesData?.totalCount || 0;
    const totalPages = expensesData?.totalPages || 0;

    // Custom categories
    const [customCategories, setCustomCategories] = useState<CustomCategory[]>(getCustomCategories());
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState(CUSTOM_COLOR_OPTIONS[0].bg);
    const allCategories = [...BASE_CATEGORIES, ...customCategories.map(c => c.name)];

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [form, setForm] = useState({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: 'other',
        notes: '',
        isRecurring: false,
        currency: '',
        currencySymbol: ''
    });

    const filteredExpenses = expenses.filter(e => {
        const matchesSearch = !search ||
            e.description.toLowerCase().includes(search.toLowerCase()) ||
            e.notes?.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = filterCategory === 'all' || e.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const openCreateModal = () => {
        setEditingExpense(null);
        setForm({
            description: '',
            amount: '',
            date: new Date().toISOString().split('T')[0],
            category: 'other',
            notes: '',
            isRecurring: false,
            currency: currencySymbol === '$' ? 'USD' : currencySymbol === '€' ? 'EUR' : currencySymbol === '£' ? 'GBP' : DEFAULT_CURRENCY,
            currencySymbol: currencySymbol
        });
        setShowModal(true);
    };

    const openEditModal = (expense: Expense) => {
        setEditingExpense(expense);
        setForm({
            description: expense.description,
            amount: expense.amount.toString(),
            date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : '',
            category: expense.category,
            notes: expense.notes || '',
            isRecurring: expense.isRecurring,
            currency: expense.currency || DEFAULT_CURRENCY,
            currencySymbol: expense.currencySymbol || currencySymbol
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.description.trim() || !form.amount) return;
        try {
            const payload = {
                description: form.description,
                amount: parseFloat(form.amount),
                date: form.date || undefined,
                category: form.category,
                notes: form.notes || undefined,
                isRecurring: form.isRecurring,
                currency: form.currency || undefined,
                currencySymbol: form.currencySymbol || undefined
            };

            await saveMutation.mutateAsync({ id: editingExpense?.id, data: payload });
            setShowModal(false);
        } catch (err) {
            logger.error('Failed to save expense:', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('expense.confirmDelete', 'Delete this expense?'))) return;
        try {
            await deleteMutation.mutateAsync(id);
        } catch (err) {
            logger.error('Failed to delete expense:', err);
        }
    };

    const getCategoryColor = (cat: string) => {
        const colors: Record<string, string> = {
            rent: 'bg-blue-100 text-blue-700',
            utilities: 'bg-yellow-100 text-yellow-700',
            office: 'bg-green-100 text-green-700',
            travel: 'bg-[#065F46]/10 text-[#065F46]',
            marketing: 'bg-[#14B8A6]/10 text-[#14B8A6]',
            insurance: 'bg-[#065F46]/10 text-[#065F46]',
            maintenance: 'bg-orange-100 text-orange-700',
            subscription: 'bg-cyan-100 text-cyan-700',
            salary: 'bg-emerald-100 text-emerald-700',
            telecom: 'bg-teal-100 text-teal-700',
            bankFees: 'bg-red-100 text-red-700',
            other: 'bg-gray-100 text-gray-700'
        };
        if (colors[cat]) return colors[cat];
        const custom = customCategories.find(c => c.name === cat);
        return custom?.color || 'bg-violet-100 text-violet-700';
    };

    const handleAddCustomCategory = () => {
        const name = newCategoryName.trim();
        if (!name || allCategories.includes(name)) return;
        const updated = [...customCategories, { name, color: newCategoryColor }];
        setCustomCategories(updated);
        saveCustomCategories(updated);
        setNewCategoryName('');
        setNewCategoryColor(CUSTOM_COLOR_OPTIONS[0].bg);
    };

    const handleRemoveCustomCategory = (catName: string) => {
        const updated = customCategories.filter(c => c.name !== catName);
        setCustomCategories(updated);
        saveCustomCategories(updated);
    };

    const handleChangeCategoryColor = (catName: string, color: string) => {
        const updated = customCategories.map(c => c.name === catName ? { ...c, color } : c);
        setCustomCategories(updated);
        saveCustomCategories(updated);
    };

    const toggleYearCollapse = (year: number) => {
        setCollapsedYears(prev => {
            const next = new Set(prev);
            if (next.has(year)) {
                next.delete(year);
            } else {
                next.add(year);
            }
            return next;
        });
    };

    const groupedExpenses = filteredExpenses.reduce((acc, expense) => {
        const year = new Date(expense.date).getFullYear();
        if (!acc[year]) {
            acc[year] = [];
        }
        acc[year].push(expense);
        return acc;
    }, {} as Record<number, Expense[]>);

    const sortedYears = Object.keys(groupedExpenses)
        .map(Number)
        .sort((a, b) => b - a);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-[#065F46]" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('expense.title', 'Expenses')}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {expenses.length} {t('expense.title', 'expenses').toLowerCase()}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#065F46] text-white rounded-xl hover:bg-[#047857] shadow-lg hover:shadow-xl transition-all font-medium"
                >
                    <Plus size={18} />
                    {t('expense.newExpense', 'New Expense')}
                </button>
                {isManager && (
                    <button
                        onClick={() => setShowCategoryModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 shadow-sm transition-all font-medium"
                        title={t('expense.manageCategories', 'Manage Categories')}
                    >
                        <Settings2 size={18} />
                        {t('expense.manageCategories', 'Manage Categories')}
                    </button>
                )}
                </div>
            </div>

            {/* Summary Cards - per-currency breakdown */}
            {summary && summary.currencyBreakdowns && summary.currencyBreakdowns.length > 0 && (
                <>
                {summary.currencyBreakdowns.map((cb) => (
                <div key={cb.currency} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#065F46]/10 rounded-lg">
                                <DollarSign size={20} className="text-[#065F46]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{t('expense.totalExpenses', 'Total Expenses')} ({cb.currencySymbol})</p>
                                <p className="text-xl font-bold text-gray-900">{formatCurrency(cb.totalAll, cb.currencySymbol)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                                <Calendar size={20} className="text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{t('expense.thisMonth', 'This Month')} ({cb.currencySymbol})</p>
                                <p className="text-xl font-bold text-gray-900">{formatCurrency(cb.totalThisMonth, cb.currencySymbol)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#065F46]/10 rounded-lg">
                                <TrendingUp size={20} className="text-[#065F46]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{t('expense.thisYear', 'This Year')} ({cb.currencySymbol})</p>
                                <p className="text-xl font-bold text-gray-900">{formatCurrency(cb.totalThisYear, cb.currencySymbol)}</p>
                            </div>
                        </div>
                    </div>
                </div>
                ))}
                </>
            )}

            {/* Search & Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('expense.searchPlaceholder', 'Search expenses...')}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46] transition"
                        />
                    </div>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46] transition bg-white"
                    >
                        <option value="all">{t('common.all', 'All')}</option>
                        {allCategories.map(cat => (
                            <option key={cat} value={cat}>
                                {getCategoryLabel(cat, t)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Expenses Table */}
            {filteredExpenses.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                    <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">{t('expense.noExpenses', 'No expenses found')}</p>
                </div>
            ) : (
                <div className="rm-table-card">
                    <table className="rm-table">
                        <colgroup>
                            <col style={{ width: '32%' }} />{/* Description */}
                            <col style={{ width: '18%' }} />{/* Category */}
                            <col style={{ width: '15%' }} />{/* Date */}
                            <col style={{ width: '20%' }} />{/* Amount */}
                            <col style={{ width: '15%' }} />{/* Actions */}
                        </colgroup>
                        <thead>
                            <tr>
                                <th>{t('expense.description', 'Description')}</th>
                                <th className="rm-th-status">{t('expense.category', 'Category')}</th>
                                <th className="rm-th-date">{t('expense.date', 'Date')}</th>
                                <th className="rm-th-number">{t('expense.amount', 'Amount')}</th>
                                <th className="rm-th-actions">{t('common.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedYears.map(year => {
                                const isCollapsed = collapsedYears.has(year);
                                const yearExpenses = groupedExpenses[year];
                                const yearTotalsByCurrency: Record<string, { total: number; symbol: string }> = {};
                                yearExpenses.forEach(e => {
                                    const sym = e.currencySymbol || currencySymbol;
                                    const cur = e.currency || 'DEFAULT';
                                    if (!yearTotalsByCurrency[cur]) {
                                        yearTotalsByCurrency[cur] = { total: 0, symbol: sym };
                                    }
                                    yearTotalsByCurrency[cur].total += e.amount;
                                });

                                return (
                                    <React.Fragment key={year}>
                                        {/* Year Header */}
                                        <tr className="rm-group-header cursor-pointer hover:bg-gray-50" onClick={() => toggleYearCollapse(year)}>
                                            <td colSpan={5} className="rm-cell-group-header">
                                                <div className="flex items-center gap-3">
                                                    <span className="p-1 text-gray-400">
                                                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                                    </span>
                                                    <span className="font-semibold text-gray-900">{year}</span>
                                                    <span className="text-sm text-gray-500">
                                                        ({yearExpenses.length} {yearExpenses.length === 1 ? t('expense.title', 'expense') : t('expense.title', 'expenses').toLowerCase()})
                                                    </span>
                                                    <div className="ml-auto flex gap-4">
                                                        {Object.values(yearTotalsByCurrency).map((total, i) => (
                                                            <span key={i} className="text-sm font-medium text-[#065F46]">
                                                                {formatCurrency(total.total, total.symbol)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Year Expenses */}
                                        {!isCollapsed && yearExpenses.map(expense => (
                                            <tr key={expense.id}>
                                                <td className="rm-cell-text">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-gray-900">{expense.description}</span>
                                                        {expense.isRecurring && (
                                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                                                                {t('expense.recurring', 'Recurring')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {expense.notes && (
                                                        <p className="text-xs text-gray-400 mt-0.5">{expense.notes}</p>
                                                    )}
                                                </td>
                                                <td className="rm-cell-status">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(expense.category)}`}>
                                                        {getCategoryLabel(expense.category, t)}
                                                    </span>
                                                </td>
                                                <td className="rm-cell-date">
                                                    {new Date(expense.date).toLocaleDateString()}
                                                </td>
                                                <td className="rm-cell-currency">
                                                    {formatCurrency(expense.amount, expense.currencySymbol || currencySymbol)}
                                                </td>
                                                <td className="rm-cell-actions">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openEditModal(expense); }}
                                                            className="p-2 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded-lg transition-colors"
                                                            title={t('common.edit', 'Edit')}
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(expense.id); }}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title={t('common.delete', 'Delete')}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Year Footer */}
                                        {!isCollapsed && (
                                            <tr className="rm-year-footer bg-[#065F46]/5">
                                                <td colSpan={3} className="rm-cell-number">
                                                    <span className="text-xs font-semibold text-gray-500 uppercase">{t('expense.yearTotal', 'Year Total')}</span>
                                                </td>
                                                <td colSpan={2}>
                                                    <div className="flex justify-end gap-4">
                                                        {Object.values(yearTotalsByCurrency).map((total, i) => (
                                                            <span key={i} className="text-sm font-bold text-[#065F46]">
                                                                {formatCurrency(total.total, total.symbol)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                            {(() => {
                                const byCur: Record<string, { total: number; symbol: string }> = {};
                                filteredExpenses.forEach(e => {
                                    const sym = e.currencySymbol || currencySymbol;
                                    const cur = e.currency || 'DEFAULT';
                                    if (!byCur[cur]) byCur[cur] = { total: 0, symbol: sym };
                                    byCur[cur].total += e.amount;
                                });
                                const entries = Object.values(byCur);
                                return entries.map((entry, i) => (
                                    <tr key={i}>
                                        <td colSpan={3} className="rm-cell-number">
                                            {i === 0 ? t('common.total', 'Total') : ''}
                                        </td>
                                        <td className="rm-cell-currency font-bold">
                                            {formatCurrency(entry.total, entry.symbol)}
                                        </td>
                                        <td></td>
                                    </tr>
                                ));
                            })()}
                        </tfoot>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {!search && filterCategory === 'all' && (
                <Pagination
                    page={page}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    size={size}
                    onPageChange={setPage}
                    onSizeChange={(s) => { setSize(s); setPage(1); }}
                />
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingExpense ? t('expense.editExpense', 'Edit Expense') : t('expense.newExpense', 'New Expense')}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.description', 'Description')} *</label>
                                <input
                                    type="text"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46]"
                                    placeholder={t('expense.description', 'Description')}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.amount', 'Amount')} *</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={form.amount}
                                        onChange={e => setForm({ ...form, amount: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46]"
                                        placeholder="0.000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.date', 'Date')}</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => setForm({ ...form, date: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46]"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.category', 'Category')}</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm({ ...form, category: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46] bg-white"
                                >
                                    {allCategories.map(cat => (
                                        <option key={cat} value={cat}>
                                            {getCategoryLabel(cat, t)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.currency', 'Currency')}</label>
                                <select
                                    value={form.currency}
                                    onChange={e => {
                                        const opt = CURRENCY_OPTIONS.find(o => o.code === e.target.value);
                                        setForm({ ...form, currency: e.target.value, currencySymbol: opt?.symbol || e.target.value });
                                    }}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46] bg-white"
                                >
                                    {CURRENCY_OPTIONS.map(opt => (
                                        <option key={opt.code} value={opt.code}>
                                            {opt.symbol} — {opt.code}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.notes', 'Notes')}</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    rows={2}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46]"
                                    placeholder={t('expense.notes', 'Notes')}
                                />
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isRecurring}
                                    onChange={e => setForm({ ...form, isRecurring: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 text-[#065F46] focus:ring-[#065F46]"
                                />
                                <span className="text-sm text-gray-700">{t('expense.recurring', 'Recurring')}</span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saveMutation.isPending || !form.description.trim() || !form.amount}
                                className="px-6 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#047857] disabled:opacity-50 font-medium flex items-center gap-2 transition-all"
                            >
                                {saveMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                                {t('common.save', 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Categories Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {t('expense.manageCategories', 'Manage Categories')}
                            </h2>
                            <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('expense.addCategory', 'Add Custom Category')}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddCustomCategory()}
                                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46]"
                                        placeholder={t('expense.categoryNamePlaceholder', 'e.g. Legal Fees')}
                                    />
                                    <button
                                        onClick={handleAddCustomCategory}
                                        disabled={!newCategoryName.trim()}
                                        className="px-4 py-2.5 bg-[#065F46] text-white rounded-lg hover:bg-[#047857] disabled:opacity-50 transition-colors"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                                <div className="flex gap-1.5 mt-2">
                                    {CUSTOM_COLOR_OPTIONS.map(opt => (
                                        <button
                                            key={opt.dot}
                                            type="button"
                                            onClick={() => setNewCategoryColor(opt.bg)}
                                            className={`w-6 h-6 rounded-full ${opt.dot} transition-all ${newCategoryColor === opt.bg ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-400 uppercase mb-2">{t('expense.builtInCategories', 'Built-in Categories')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {BASE_CATEGORIES.map(cat => (
                                        <span key={cat} className={`inline-flex px-3 py-1.5 rounded-full text-xs font-medium ${getCategoryColor(cat)}`}>
                                            {getCategoryLabel(cat, t)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {customCategories.length > 0 && (
                                <div>
                                    <p className="text-xs font-medium text-gray-400 uppercase mb-2">{t('expense.customCategories', 'Custom Categories')}</p>
                                    <div className="space-y-2">
                                        {customCategories.map(cat => (
                                            <div key={cat.name} className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${cat.color}`}>
                                                    {cat.name}
                                                    <button
                                                        onClick={() => handleRemoveCustomCategory(cat.name)}
                                                        className="ml-1 p-0.5 hover:bg-black/10 rounded-full transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                                <div className="flex gap-1">
                                                    {CUSTOM_COLOR_OPTIONS.map(opt => (
                                                        <button
                                                            key={opt.dot}
                                                            type="button"
                                                            onClick={() => handleChangeCategoryColor(cat.name, opt.bg)}
                                                            className={`w-4 h-4 rounded-full ${opt.dot} transition-all ${cat.color === opt.bg ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setShowCategoryModal(false)}
                                className="px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#047857] transition-colors font-medium"
                            >
                                {t('common.close', 'Close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

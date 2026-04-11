import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
    Plus, Trash2, Search, DollarSign, Calendar, X,
    TrendingUp, Loader2, FileText, Settings2, ChevronDown, ChevronRight, Check, Pencil
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
    { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
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
        // Backward compat: old format was string[]
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
    const { currencySymbol } = useSettings();
    const [search, setSearch] = useState('');
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
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
        if (!window.confirm(t('expense.confirmDelete'))) return;
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
            travel: 'bg-purple-600/10 text-purple-600',
            marketing: 'bg-purple-500/10 text-purple-500',
            insurance: 'bg-purple-600/10 text-purple-600',
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

    const toggleRow = (id: number) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-purple-600" size={32} />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('expense.title')}</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {expenses.length} {t('expense.title').toLowerCase()}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                <motion.button
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                    <Plus size={16} />
                    {t('expense.newExpense')}
                </motion.button>
                {isManager && (
                    <button
                        onClick={() => setShowCategoryModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-full hover:bg-slate-50 shadow-sm transition-all font-medium text-sm"
                        title={t('expense.manageCategories', 'Manage Categories')}
                    >
                        <Settings2 size={16} />
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
                            <div className="p-2 bg-purple-600/10 rounded-lg">
                                <DollarSign size={20} className="text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{t('expense.totalExpenses')} ({cb.currencySymbol})</p>
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
                                <p className="text-sm text-gray-500">{t('expense.thisMonth')} ({cb.currencySymbol})</p>
                                <p className="text-xl font-bold text-gray-900">{formatCurrency(cb.totalThisMonth, cb.currencySymbol)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-600/10 rounded-lg">
                                <TrendingUp size={20} className="text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{t('expense.thisYear')} ({cb.currencySymbol})</p>
                                <p className="text-xl font-bold text-gray-900">{formatCurrency(cb.totalThisYear, cb.currencySymbol)}</p>
                            </div>
                        </div>
                    </div>
                </div>
                ))}
                </>
            )}

            {/* Search & Filter + Action Bar */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col p-6">
                <div className="flex items-center justify-between mb-6 h-12">
                    <div className="flex-1 flex items-center gap-4">
                        {selectedRows.length > 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="flex items-center gap-1 p-1 bg-white rounded-full border border-slate-200 shadow-sm"
                            >
                                <div className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 rounded-full flex items-center gap-2 border border-purple-100/50">
                                    <span className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] shadow-inner">{selectedRows.length}</span>
                                    {t('common.selected', 'Selected')}
                                </div>
                                {selectedRows.length === 1 && (
                                    <button
                                        onClick={() => { const e = expenses.find(e => e.id === selectedRows[0]); if (e) openEditModal(e); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors"
                                    >
                                        <Pencil size={14} className="text-purple-500" /> {t('common.edit')}
                                    </button>
                                )}
                                <div className="w-px h-4 bg-slate-200 mx-1" />
                                <button
                                    onClick={() => { selectedRows.forEach(id => handleDelete(id)); setSelectedRows([]); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-full text-xs font-medium transition-colors"
                                >
                                    <Trash2 size={14} className="text-red-500" /> {t('common.delete')}
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 flex-1">
                                <div className="relative max-w-sm w-full">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder={t('expense.searchPlaceholder')}
                                        className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200/60 hover:border-purple-300 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 rounded-full text-sm font-medium outline-none transition-all placeholder:text-slate-400 text-slate-900 shadow-sm"
                                    />
                                </div>
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="px-4 py-2.5 border border-slate-200/60 rounded-full focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition bg-white text-sm font-medium text-slate-900 shadow-sm"
                                >
                                    <option value="all">{t('common.all')}</option>
                                    {allCategories.map(cat => (
                                        <option key={cat} value={cat}>
                                            {getCategoryLabel(cat, t)}
                                        </option>
                                    ))}
                                </select>
                            </motion.div>
                        )}
                    </div>
                </div>

            {/* Expenses Table */}
            {filteredExpenses.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-center mb-3">
                        <FileText className="text-slate-400" size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">{t('expense.noExpenses')}</h3>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left w-10">
                                    <div className="w-5 h-5" />
                                </th>
                                <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left">{t('expense.description')}</th>
                                <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left">{t('expense.category')}</th>
                                <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left">{t('expense.date')}</th>
                                <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-right">{t('expense.amount')}</th>
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
                                        <tr className="cursor-pointer hover:bg-slate-50/80" onClick={() => toggleYearCollapse(year)}>
                                            <td colSpan={5} className="py-3 px-4 border-b border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <span className="p-1 text-slate-400">
                                                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                                    </span>
                                                    <span className="font-semibold text-slate-900">{year}</span>
                                                    <span className="text-sm text-slate-500">
                                                        ({yearExpenses.length} {yearExpenses.length === 1 ? t('expense.title') : t('expense.title').toLowerCase()})
                                                    </span>
                                                    <div className="ml-auto flex gap-4">
                                                        {Object.values(yearTotalsByCurrency).map((total, i) => (
                                                            <span key={i} className="text-sm font-bold text-purple-600">
                                                                {formatCurrency(total.total, total.symbol)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        {!isCollapsed && yearExpenses.map((expense, idx) => {
                                            const isSelected = selectedRows.includes(expense.id);
                                            return (
                                                <motion.tr
                                                    key={expense.id}
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.03 }}
                                                    onClick={() => toggleRow(expense.id)}
                                                    className={`border-b border-slate-100 cursor-pointer transition-colors ${
                                                        isSelected ? 'bg-purple-50/50' : 'hover:bg-slate-50/80'
                                                    }`}
                                                >
                                                    <td className="py-3.5 px-4">
                                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                                            isSelected ? 'bg-purple-600 border-purple-600 text-white shadow-sm' : 'border-slate-300 bg-white text-transparent'
                                                        }`}>
                                                            <Check size={12} strokeWidth={3} />
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-slate-900">{expense.description}</span>
                                                            {expense.isRecurring && (
                                                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-full font-bold uppercase tracking-widest border border-blue-200">
                                                                    {t('expense.recurring')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {expense.notes && (
                                                            <p className="text-xs text-slate-400 mt-0.5">{expense.notes}</p>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${getCategoryColor(expense.category)}`}>
                                                            {getCategoryLabel(expense.category, t)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-sm text-slate-600">
                                                        {new Date(expense.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-sm font-semibold text-slate-900 text-right">
                                                        {formatCurrency(expense.amount, expense.currencySymbol || currencySymbol)}
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                        {!isCollapsed && (
                                            <tr className="bg-purple-50/30">
                                                <td colSpan={4} className="py-2 px-4 text-right">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('expense.yearTotal', 'Year Total')}</span>
                                                </td>
                                                <td className="py-2 px-4 text-right">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        {Object.values(yearTotalsByCurrency).map((total, i) => (
                                                            <span key={i} className="text-sm font-bold text-purple-600">
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
                        <tfoot className="border-t-2 border-slate-200">
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
                                        <td colSpan={4} className="py-3 px-4 text-right">
                                            {i === 0 ? <span className="text-sm font-bold text-slate-900">{t('common.total')}</span> : ''}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-purple-600">
                                            {formatCurrency(entry.total, entry.symbol)}
                                        </td>
                                    </tr>
                                ));
                            })()}
                        </tfoot>
                    </table>
                </div>
            )}
            </div>

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
                                {editingExpense ? t('expense.editExpense') : t('expense.newExpense')}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.description')} *</label>
                                <input
                                    type="text"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600"
                                    placeholder={t('expense.description')}
                                />
                            </div>

                            {/* Amount & Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.amount')} *</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={form.amount}
                                        onChange={e => setForm({ ...form, amount: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600"
                                        placeholder="0.000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.date')}</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => setForm({ ...form, date: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600"
                                    />
                                </div>
                            </div>

                            {/* Category & Currency */}
                            <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.category')}</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm({ ...form, category: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 bg-white"
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
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 bg-white"
                                >
                                    {CURRENCY_OPTIONS.map(opt => (
                                        <option key={opt.code} value={opt.code}>
                                            {opt.symbol} — {opt.code}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.notes')}</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    rows={2}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600"
                                    placeholder={t('expense.notes')}
                                />
                            </div>

                            {/* Recurring */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isRecurring}
                                    onChange={e => setForm({ ...form, isRecurring: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">{t('expense.recurring')}</span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saveMutation.isPending || !form.description.trim() || !form.amount}
                                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium flex items-center gap-2 transition-all"
                            >
                                {saveMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Categories Modal (Manager only) */}
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
                            {/* Add new category */}
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
                                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600"
                                        placeholder={t('expense.categoryNamePlaceholder', 'e.g. Legal Fees')}
                                    />
                                    <button
                                        onClick={handleAddCustomCategory}
                                        disabled={!newCategoryName.trim()}
                                        className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
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

                            {/* Built-in categories */}
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

                            {/* Custom categories */}
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
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                            >
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </motion.div>
    );
}

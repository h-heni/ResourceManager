import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Plus, Trash2, Edit2, Search, DollarSign, Calendar, X,
    TrendingUp, Loader2, FileText, Settings2
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../lib/formatNumber';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../lib/currencyUtils';

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
    byCategory: { category: string; total: number; count: number }[];
    count: number;
    currencyBreakdowns?: CurrencyBreakdown[];
    defaultCurrency?: string;
}

const BASE_CATEGORIES = [
    'rent', 'utilities', 'office', 'travel', 'marketing',
    'insurance', 'maintenance', 'subscription', 'salary', 'telecom',
    'bankFees', 'other'
];

function getCustomCategories(): string[] {
    try {
        const saved = localStorage.getItem('custom_expense_categories');
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
}

function saveCustomCategories(cats: string[]) {
    localStorage.setItem('custom_expense_categories', JSON.stringify(cats));
}

export default function ExpensesPage() {
    const { t } = useTranslation();
    const { isManager } = useAuth();
    const { currencySymbol } = useSettings();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [summary, setSummary] = useState<ExpenseSummary | null>(null);

    // Custom categories
    const [customCategories, setCustomCategories] = useState<string[]>(getCustomCategories());
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const allCategories = [...BASE_CATEGORIES, ...customCategories];

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [saving, setSaving] = useState(false);
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

    const fetchExpenses = useCallback(async () => {
        try {
            setLoading(true);
            const [expRes, sumRes] = await Promise.all([
                api.get('/Expenses'),
                api.get('/Expenses/summary')
            ]);
            setExpenses(expRes.data);
            setSummary(sumRes.data);
        } catch (err) {
            console.error('Failed to fetch expenses:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

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
        setSaving(true);
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

            if (editingExpense) {
                await api.put(`/Expenses/${editingExpense.id}`, payload);
            } else {
                await api.post('/Expenses', payload);
            }
            setShowModal(false);
            await fetchExpenses();
        } catch (err) {
            console.error('Failed to save expense:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('expense.confirmDelete'))) return;
        try {
            // Optimistic removal from UI
            setExpenses(prev => prev.filter(e => e.id !== id));
            await api.delete(`/Expenses/${id}`);
            await fetchExpenses();
        } catch (err) {
            console.error('Failed to delete expense:', err);
            await fetchExpenses(); // revert on error
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
        return colors[cat] || 'bg-violet-100 text-violet-700';
    };

    const handleAddCustomCategory = () => {
        const name = newCategoryName.trim();
        if (!name || allCategories.includes(name)) return;
        const updated = [...customCategories, name];
        setCustomCategories(updated);
        saveCustomCategories(updated);
        setNewCategoryName('');
    };

    const handleRemoveCustomCategory = (cat: string) => {
        const updated = customCategories.filter(c => c !== cat);
        setCustomCategories(updated);
        saveCustomCategories(updated);
    };

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
                    <h1 className="text-2xl font-bold text-gray-900">{t('expense.title')}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {expenses.length} {t('expense.title').toLowerCase()}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#065F46] text-white rounded-xl hover:bg-[#047857] shadow-lg hover:shadow-xl transition-all font-medium"
                >
                    <Plus size={18} />
                    {t('expense.newExpense')}
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
                            <div className="p-2 bg-[#065F46]/10 rounded-lg">
                                <TrendingUp size={20} className="text-[#065F46]" />
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

            {/* Search & Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('expense.searchPlaceholder')}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46] transition"
                        />
                    </div>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46] transition bg-white"
                    >
                        <option value="all">{t('common.all')}</option>
                        {allCategories.map(cat => (
                            <option key={cat} value={cat}>
                                {t(`expense.categories.${cat}`, cat)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Expenses Table */}
            {filteredExpenses.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                    <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">{t('expense.noExpenses')}</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('expense.description')}</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('expense.category')}</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('expense.date')}</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('expense.amount')}</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredExpenses.map(expense => (
                                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900">{expense.description}</span>
                                            {expense.isRecurring && (
                                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                                                    {t('expense.recurring')}
                                                </span>
                                            )}
                                        </div>
                                        {expense.notes && (
                                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{expense.notes}</p>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(expense.category)}`}>
                                            {t(`expense.categories.${expense.category}`, expense.category)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {new Date(expense.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                                        {formatCurrency(expense.amount, expense.currencySymbol || currencySymbol)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(expense)}
                                                className="p-2 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded-lg transition-colors"
                                                title={t('common.edit')}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(expense.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title={t('common.delete')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                            {(() => {
                                // Group filtered expenses by currency for the total row
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
                                        <td colSpan={3} className="px-6 py-3 text-sm font-semibold text-gray-700 text-right">
                                            {i === 0 ? t('common.total') : ''}
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-gray-900">
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
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46]"
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
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46]"
                                        placeholder="0.000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.date')}</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => setForm({ ...form, date: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46]"
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
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46] bg-white"
                                >
                                    {allCategories.map(cat => (
                                        <option key={cat} value={cat}>
                                            {t(`expense.categories.${cat}`, cat)}
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

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.notes')}</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    rows={2}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46]"
                                    placeholder={t('expense.notes')}
                                />
                            </div>

                            {/* Recurring */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isRecurring}
                                    onChange={e => setForm({ ...form, isRecurring: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 text-[#065F46] focus:ring-[#065F46]"
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
                                disabled={saving || !form.description.trim() || !form.amount}
                                className="px-6 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#047857] disabled:opacity-50 font-medium flex items-center gap-2 transition-all"
                            >
                                {saving && <Loader2 size={16} className="animate-spin" />}
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
                            </div>

                            {/* Built-in categories */}
                            <div>
                                <p className="text-xs font-medium text-gray-400 uppercase mb-2">{t('expense.builtInCategories', 'Built-in Categories')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {BASE_CATEGORIES.map(cat => (
                                        <span key={cat} className={`inline-flex px-3 py-1.5 rounded-full text-xs font-medium ${getCategoryColor(cat)}`}>
                                            {t(`expense.categories.${cat}`, cat)}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Custom categories */}
                            {customCategories.length > 0 && (
                                <div>
                                    <p className="text-xs font-medium text-gray-400 uppercase mb-2">{t('expense.customCategories', 'Custom Categories')}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {customCategories.map(cat => (
                                            <span key={cat} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                                                {cat}
                                                <button
                                                    onClick={() => handleRemoveCustomCategory(cat)}
                                                    className="ml-1 p-0.5 hover:bg-violet-200 rounded-full transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
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
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

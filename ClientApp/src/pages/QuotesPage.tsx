import { useEffect, useState } from 'react';
import { Plus, Search, FileText, Calendar, Download, Trash2, Filter, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/formatNumber';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';

interface DevisItem {
    id: number;
    description: string;
    quantity: number;
    price: number;
    tva: boolean;
    vatRate?: number;
    totalItemHT?: number;
    itemTaxAmount?: number;
}

interface Devis {
    id: number;
    number: string;
    date: string;
    totalAmount: number;
    subTotal: number;
    taxAmount: number;
    clientName: string;
    clientId: number;
    status: string;
    treated: boolean;
    devisItems?: DevisItem[];
    currency?: string;
    currencySymbol?: string;
}

export default function QuotesPage() {
    const [quotes, setQuotes] = useState<Devis[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const navigate = useNavigate();
    const { isManager } = useAuth();

    useEffect(() => {
        fetchQuotes();
    }, []);

    // Refetch when a payment is confirmed/extended via NotificationBell (cascade changes quote status)
    useEffect(() => {
        const handler = () => fetchQuotes();
        window.addEventListener('payment-status-changed', handler);
        return () => window.removeEventListener('payment-status-changed', handler);
    }, []);

    const fetchQuotes = async () => {
        try {
            const res = await api.get('/Devis');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            
            // Fetch full details for each quote to get items
            const quotesWithDetails = await Promise.all(
                data.filter((q: Devis) => q.status !== 'Rejected').map(async (q: Devis) => {
                    try {
                        const detailRes = await api.get(`/Devis/${q.id}`);
                        return { ...detailRes.data, clientName: q.clientName };
                    } catch {
                        return q;
                    }
                })
            );
            
            setQuotes(quotesWithDetails);
        } catch (error) {
            console.error("Error fetching quotes", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = async (id: number, number: string | number) => {
        try {
            const res = await api.get(`/Devis/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Devis_${number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Error downloading PDF", error);
            alert("Failed to download PDF");
        }
    };

    const handleDeleteQuote = async (id: number) => {
        if (!confirm("Are you sure you want to reject/delete this quote?")) return;
        try {
            await api.delete(`/Devis/${id}`);
            fetchQuotes();
        } catch (error) {
            console.error("Error deleting quote", error);
            alert("Failed to delete quote");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed':
                return 'bg-emerald-100 text-emerald-700';
            case 'Active':
                return 'bg-blue-100 text-blue-700';
            case 'Accepted':
                return 'bg-emerald-100 text-emerald-700';
            case 'Rejected':
                return 'bg-red-100 text-red-700';
            case 'Draft':
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const filteredQuotes = (quotes || []).filter(q => {
        const numMatch = q.number?.toString().includes(search) ?? false;
        const clientMatch = q.clientName?.toLowerCase().includes(search.toLowerCase()) ?? false;
        const searchMatch = numMatch || clientMatch;
        const isArchived = q.treated === true;
        if (viewMode === 'active') return searchMatch && !isArchived;
        return searchMatch && isArchived;
    });

    const activeCount = (quotes || []).filter(q => !q.treated).length;
    const archivedCount = (quotes || []).filter(q => q.treated === true).length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Quotes (Devis)</h1>
                    <p className="text-gray-500 mt-1">Manage your quotes and estimates</p>
                </div>
                <button
                    onClick={() => navigate('/quotes/create')}
                    className="flex items-center px-4 py-2 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all transform hover:scale-105"
                >
                    <Plus size={20} className="mr-2" />
                    Create Quote
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search quotes..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none transition-all"
                    />
                </div>
                {isManager && (
                    <div className="flex p-1 bg-gray-100 rounded-xl">
                        <button
                            onClick={() => setViewMode('active')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                viewMode === 'active' ? 'bg-white shadow-sm text-[#065F46]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Filter size={16} />
                            Active ({activeCount})
                        </button>
                        <button
                            onClick={() => setViewMode('archived')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                viewMode === 'archived' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Archive size={16} />
                            Archived ({archivedCount})
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">Loading quotes...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredQuotes.map((quote) => (
                        <div key={quote.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="h-12 w-12 bg-[#065F46]/5 rounded-xl flex items-center justify-center text-[#065F46] font-bold">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Quote #{quote.number}</h3>
                                        <p className="text-sm text-gray-500">{quote.clientName || "Unknown Client"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handleDownloadPdf(quote.id, quote.number)}
                                        className="p-2 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded-lg transition-colors"
                                        title="Download PDF"
                                    >
                                        <Download size={18} />
                                    </button>
                                    {/* Delete allowed for Draft and Active quotes (not Completed or Accepted) */}
                                    {(quote.status === 'Draft' || quote.status === 'Active') && (
                                        <button
                                            onClick={() => handleDeleteQuote(quote.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Quote"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(quote.status)}`}>
                                        {quote.status || 'Draft'}
                                    </span>
                                </div>
                            </div>

                            {/* Date and Total */}
                            <div className="flex items-center justify-between text-sm mb-4 pb-4 border-b border-gray-100">
                                <span className="text-gray-500 flex items-center">
                                    <Calendar size={16} className="mr-2" />
                                    {quote.date ? new Date(quote.date).toLocaleDateString() : 'N/A'}
                                </span>
                                <span className="font-bold text-[#065F46] text-lg">{formatCurrency(quote.totalAmount, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                            </div>

                            {/* Items Section - Always Visible */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Items</h4>
                                {quote.devisItems && quote.devisItems.length > 0 ? (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {quote.devisItems.map((item, idx) => (
                                            <div key={item.id || idx} className="bg-gray-50 p-3 rounded-lg text-sm">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-medium text-gray-800 flex-1">{item.description}</span>
                                                    <span className="text-[#065F46] font-semibold ml-2">
                                                        {formatCurrency((item.quantity || 0) * (item.price || 0), quote.currencySymbol || DEFAULT_CURRENCY)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                    <span>Qty: {item.quantity || 0}</span>
                                                    <span>Unit Price: {formatCurrency(item.price, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                                    {item.tva && <span className="text-orange-500">+TVA {((item.vatRate ?? 0.19) * 100).toFixed(0)}%</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">No items in this quote.</p>
                                )}

                                {/* Totals */}
                                {quote.devisItems && quote.devisItems.length > 0 && (
                                    <div className="pt-3 mt-3 border-t border-gray-200 space-y-1">
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>Subtotal:</span>
                                            <span>{formatCurrency(quote.subTotal, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>Tax:</span>
                                            <span>{formatCurrency(quote.taxAmount, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-bold text-[#065F46]">
                                            <span>Total:</span>
                                            <span>{formatCurrency(quote.totalAmount, quote.currencySymbol || DEFAULT_CURRENCY)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredQuotes.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-[#065F46]/5 rounded-2xl border border-dashed border-[#065F46]/20">
                            <FileText size={48} className="mx-auto text-[#065F46]/30 mb-4" />
                            <p className="text-gray-500 font-medium">No quotes found.</p>
                            <p className="text-sm text-gray-400 mt-1">Create your first quote to get started.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

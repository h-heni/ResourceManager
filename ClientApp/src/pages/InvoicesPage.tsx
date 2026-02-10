import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Download, Trash2, Eye, DollarSign, X, Mail, Send, Calendar, Clock, Edit2, Archive, Filter, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import InvoiceDetailView from '../components/InvoiceDetailView';
import { formatCurrency } from '../lib/formatNumber';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { getInvoiceStatusColor } from '../lib/utils';

interface Payment {
    id: number;
    amount: number;
    paymentDate: string;
    notes?: string;
    status?: string;
    isScheduled?: boolean;
}

interface Invoice {
    id: number;
    number: number;
    date: string;
    dueDate?: string;
    totalAmount: number;
    clientName: string;
    clientEmail?: string;
    status: string;
    isLocked: boolean;
    treated: boolean;
    devisId?: number;
    amountPaid: number;
    remainingAmount: number;
    payments: Payment[];
    currency?: string;
    currencySymbol?: string;
}

export default function InvoicesPage() {
    const { t } = useTranslation();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [isScheduledPayment, setIsScheduledPayment] = useState(false);
    const [scheduledDate, setScheduledDate] = useState('');
    
    // Email modal state
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailInvoice, setEmailInvoice] = useState<Invoice | null>(null);
    const [emailTo, setEmailTo] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    
    // Invoice detail view state
    const [showDetailView, setShowDetailView] = useState(false);
    const [detailInvoiceId, setDetailInvoiceId] = useState<number | null>(null);
    
    // Archive filter state
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    
    const navigate = useNavigate();
    const { user } = useAuth();

    const isManager = user?.roles?.includes('Manager') || user?.roles?.includes('SuperAdmin') || user?.roles?.includes('FreeUser');

    useEffect(() => {
        fetchInvoices();
    }, []);

    // Refetch when a payment is confirmed/extended via NotificationBell
    useEffect(() => {
        const handler = () => fetchInvoices();
        window.addEventListener('payment-status-changed', handler);
        return () => window.removeEventListener('payment-status-changed', handler);
    }, []);

    const fetchInvoices = async () => {
        try {
            const res = await api.get('/Invoices');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setInvoices(data);
        } catch (error) {
            console.error("Error fetching invoices", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!isManager) {
            alert("Only managers can delete invoices.");
            return;
        }
        if (!confirm("Are you sure you want to delete this invoice?")) return;
        try {
            await api.delete(`/Invoices/${id}`);
            fetchInvoices();
        } catch (error: any) {
            console.error("Error deleting invoice", error);
            alert(error.response?.data?.message || "Failed to delete invoice. Only managers can perform this action.");
        }
    };

    const handleDownloadPdf = async (id: number, number: string | number) => {
        try {
            const res = await api.get(`/Invoices/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Facture_${number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Error downloading PDF", error);
            alert("Failed to download PDF");
        }
    };

    // Show invoice detail view (replaces PDF view behavior)
    const handleViewDetails = (id: number) => {
        setDetailInvoiceId(id);
        setShowDetailView(true);
    };

    const openPaymentModal = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setPaymentAmount('');
        setPaymentNotes('');
        setIsScheduledPayment(false);
        setScheduledDate('');
        setShowPaymentModal(true);
    };

    // Email modal functions
    const openEmailModal = async (invoice: Invoice) => {
        setEmailInvoice(invoice);
        
        // Fetch email settings template and auto-fill with invoice data
        try {
            const res = await api.get('/Settings');
            const settingsData = res.data;
            
            // Build subject from settings template or fallback
            let subject = settingsData.emailSubjectTemplate || `${t('invoice.title')} #@InvoiceNumber - @ClientName`;
            let body = settingsData.defaultEmailBody || 
                `${t('email.greeting')} @ClientName,\n\n` +
                `${t('email.invoiceAttached')} #@InvoiceNumber ${t('email.forAmount')} @TotalAmount.\n\n` +
                `${t('email.regards')},\n@CompanyName`;
            
            // Replace @ placeholders with actual values
            const replacements: Record<string, string> = {
                '@ClientName': invoice.clientName || t('common.client'),
                '@InvoiceNumber': invoice.number.toLocaleString() || '',
                '@TotalAmount': `${invoice.totalAmount?.toLocaleString()} ${invoice.currencySymbol || settingsData.currencySymbol || DEFAULT_CURRENCY}`,
                '@DueDate': invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : (invoice.date ? new Date(invoice.date).toLocaleDateString() : 'N/A'),
                '@CompanyName': settingsData.companyName || t('common.company'),
                '@CompanyPhone': settingsData.companyPhone || '',
                '@CompanyEmail': settingsData.companyEmail || '',
                '@Date': new Date().toLocaleDateString()
            };
            
            for (const [key, value] of Object.entries(replacements)) {
                subject = subject.replace(new RegExp(key.replace('@', '@'), 'g'), value);
                body = body.replace(new RegExp(key.replace('@', '@'), 'g'), value);
            }
            
            // Auto-fill recipient from client email if available
            setEmailTo(invoice.clientEmail || '');
            setEmailSubject(subject);
            setEmailBody(body);
        } catch {
            // Fallback if settings fetch fails
            setEmailTo('');
            setEmailSubject(`${t('invoice.title')} #${invoice.number} - ${invoice.clientName || t('common.client')}`);
            setEmailBody(
                `${t('email.greeting')} ${invoice.clientName || t('common.client')},\n\n` +
                `${t('email.invoiceAttached')} #${invoice.number} ${t('email.forAmount')} ${invoice.totalAmount?.toLocaleString()} ${invoice.currencySymbol || DEFAULT_CURRENCY}.\n\n` +
                `${t('email.regards')},\n${t('common.company')}`
            );
        }
        
        setShowEmailModal(true);
    };

    const handleSendEmail = async () => {
        if (!emailInvoice || !emailTo) {
            alert(t('email.enterRecipient'));
            return;
        }

        setSendingEmail(true);
        try {
            await api.post(`/Invoices/${emailInvoice.id}/send-email`, {
                recipientEmail: emailTo,
                subject: emailSubject,
                body: emailBody,
                attachPdf: true
            });
            alert(`✅ ${t('email.sentSuccess')}`);
            setShowEmailModal(false);
        } catch (error: any) {
            console.error("Error sending email", error);
            alert(`❌ ${t('email.sendFailed')}: ${error.response?.data?.message || error.message}`);
        } finally {
            setSendingEmail(false);
        }
    };

    const handleAddPayment = async () => {
        if (!selectedInvoice || !paymentAmount) return;
        
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("Please enter a valid payment amount");
            return;
        }

        // If scheduled payment, validate date
        if (isScheduledPayment && !scheduledDate) {
            alert(t('payment.selectScheduledDate'));
            return;
        }

        try {
            const paymentDate = isScheduledPayment 
                ? new Date(scheduledDate).toISOString() 
                : new Date().toISOString();
            
            await api.post(`/Invoices/${selectedInvoice.id}/payment`, {
                amount,
                paymentDate,
                notes: paymentNotes || null,
                isScheduled: isScheduledPayment,
                status: isScheduledPayment ? 'Pending' : 'Completed'
            });
            setShowPaymentModal(false);
            fetchInvoices();
            
            if (isScheduledPayment) {
                alert(`✅ ${t('payment.scheduledSuccess')}`);
            }
        } catch (error) {
            console.error("Error adding payment", error);
            alert("Failed to add payment");
        }
    };



    const filteredInvoices = (invoices || []).filter(i => {
        const numMatch = i.number?.toString().includes(search) ?? false;
        const clientMatch = i.clientName?.toLowerCase().includes(search.toLowerCase()) ?? false;
        const searchMatch = numMatch || clientMatch;
        
        // Archive filter: active shows non-Paid, archived shows Paid
        if (viewMode === 'active') {
            return searchMatch && i.status !== 'Paid';
        } else {
            return searchMatch && i.status === 'Paid';
        }
    });
    
    const activeCount = (invoices || []).filter(i => i.status !== 'Paid').length;
    const archivedCount = (invoices || []).filter(i => i.status === 'Paid').length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">📋 {t('nav.invoices')}</h1>
                    <p className="text-gray-500 mt-1">{t('invoice.pageDescription')}</p>
                </div>
                <button
                    onClick={() => navigate('/invoices/create')}
                    className="flex items-center px-4 py-2 bg-[#065F46] text-white rounded-xl shadow-lg hover:bg-[#047857] transition-all transform hover:scale-105"
                >
                    <Plus size={20} className="mr-2" />
                    {t('invoice.create')}
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder={t('invoice.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent outline-none transition-all"
                />
            </div>

            {/* Active / Archived Toggle */}
            <div className="flex items-center gap-2">
                <div className="flex p-1 bg-gray-100 rounded-xl">
                    <button
                        onClick={() => setViewMode('active')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            viewMode === 'active'
                                ? 'bg-white shadow-sm text-[#065F46]'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Filter size={16} />
                        {t('invoice.active') || 'Active'} ({activeCount})
                    </button>
                    <button
                        onClick={() => setViewMode('archived')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            viewMode === 'archived'
                                ? 'bg-white shadow-sm text-emerald-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Archive size={16} />
                        {t('invoice.archived') || 'Paid / Archived'} ({archivedCount})
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">Loading invoices...</div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="p-4 font-semibold text-gray-600">ID</th>
                                    <th className="p-4 font-semibold text-gray-600">Client</th>
                                    <th className="p-4 font-semibold text-gray-600">Date</th>
                                    <th className="p-4 font-semibold text-gray-600 text-right">Total</th>
                                    <th className="p-4 font-semibold text-gray-600 text-right">Paid</th>
                                    <th className="p-4 font-semibold text-gray-600 text-right">Remaining</th>
                                    <th className="p-4 font-semibold text-gray-600">Status</th>
                                    <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredInvoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="p-4 font-medium text-[#065F46]">#{invoice.number}</td>
                                        <td className="p-4 text-gray-900">{invoice.clientName || "Unknown"}</td>
                                        <td className="p-4 text-gray-500">{invoice.date ? new Date(invoice.date).toLocaleDateString() : 'N/A'}</td>
                                        <td className="p-4 text-gray-900 font-bold text-right">{formatCurrency(invoice.totalAmount, invoice.currencySymbol || DEFAULT_CURRENCY)}</td>
                                        <td className="p-4 text-emerald-600 font-semibold text-right">
                                            {formatCurrency(invoice.amountPaid, invoice.currencySymbol || DEFAULT_CURRENCY)}
                                            {invoice.payments?.some(p => p.status === 'Pending') && (
                                                <div className="text-xs text-orange-500 font-normal mt-0.5">
                                                    ⏰ {formatCurrency(invoice.payments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.amount, 0), invoice.currencySymbol || DEFAULT_CURRENCY)} {t('payment.pending', 'pending')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-amber-600 font-semibold text-right">
                                            {invoice.remainingAmount > 0 ? formatCurrency(invoice.remainingAmount, invoice.currencySymbol || DEFAULT_CURRENCY) : '—'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`px-3 py-1 text-xs font-semibold rounded-full inline-block w-fit ${getInvoiceStatusColor(invoice.status)}`}>
                                                    {invoice.status}
                                                </span>
                                                {/* Payment History Indicators */}
                                                {invoice.payments && invoice.payments.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {invoice.payments.slice(0, 3).map((p, idx) => (
                                                            <span key={idx} className={`text-xs ${p.status === 'Pending' ? 'text-orange-500' : 'text-gray-500'}`} title={`${new Date(p.paymentDate).toLocaleDateString()}: ${p.amount} ${invoice.currencySymbol || DEFAULT_CURRENCY} (${p.status || 'Completed'})`}>
                                                                {p.status === 'Pending' ? '⏰' : '💵'} {p.amount.toLocaleString()}
                                                            </span>
                                                        ))}
                                                        {invoice.payments.length > 3 && (
                                                            <span className="text-xs text-gray-400">+{invoice.payments.length - 3} more</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end space-x-1">
                                                {/* Add Payment - Everyone can add payments if not fully paid */}
                                                {invoice.status !== 'Paid' && (
                                                    <button
                                                        onClick={() => openPaymentModal(invoice)}
                                                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        title={t('invoice.addPayment')}
                                                    >
                                                        <DollarSign size={18} />
                                                    </button>
                                                )}
                                                {/* Edit Invoice - Only if not locked/paid/partially paid (payments registered) */}
                                                {isManager && !invoice.isLocked && invoice.status !== 'Paid' && invoice.status !== 'PartiallyPaid' && (
                                                    <button
                                                        onClick={() => navigate(`/invoices/edit/${invoice.id}`)}
                                                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                        title={t('common.edit') || 'Edit'}
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                )}
                                                {/* Send Email */}
                                                <button
                                                    onClick={() => openEmailModal(invoice)}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title={t('email.sendInvoice')}
                                                >
                                                    <Mail size={18} />
                                                </button>
                                                {/* View Details (Eye icon now shows detail view, not PDF) */}
                                                <button
                                                    onClick={() => handleViewDetails(invoice.id)}
                                                    className="p-2 text-gray-400 hover:text-[#065F46] hover:bg-[#065F46]/5 rounded-lg transition-colors"
                                                    title={t('invoice.viewDetails')}
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                {/* Download PDF */}
                                                <button
                                                    onClick={() => handleDownloadPdf(invoice.id, invoice.number)}
                                                    className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    title={t('common.download')}
                                                >
                                                    <Download size={18} />
                                                </button>
                                                {/* Delete - Manager only */}
                                                {isManager && invoice.status !== 'Paid' && (
                                                    <button
                                                        onClick={() => handleDelete(invoice.id)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title={t('common.delete')}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredInvoices.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-gray-500">
                                            No invoices found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedInvoice && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-up">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">💵 {t('invoice.addPayment')}</h2>
                            <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                            <p className="text-sm text-gray-600">{t('invoice.title')}: <span className="font-bold">#{selectedInvoice.number}</span></p>
                            <p className="text-sm text-gray-600">{t('invoice.total')}: <span className="font-bold">{formatCurrency(selectedInvoice.totalAmount, selectedInvoice.currencySymbol || DEFAULT_CURRENCY)}</span></p>
                            <p className="text-sm text-gray-600">{t('invoice.alreadyPaid')}: <span className="font-bold text-emerald-600">{formatCurrency(selectedInvoice.amountPaid, selectedInvoice.currencySymbol || DEFAULT_CURRENCY)}</span></p>
                            <p className="text-sm text-gray-600">{t('invoice.remaining')}: <span className="font-bold text-amber-600">{formatCurrency(selectedInvoice.remainingAmount, selectedInvoice.currencySymbol || DEFAULT_CURRENCY)}</span></p>
                        </div>

                        <div className="space-y-4">
                            {/* Payment Timing Toggle */}
                            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setIsScheduledPayment(false)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                                        !isScheduledPayment 
                                            ? 'bg-white shadow-sm text-[#065F46] font-medium' 
                                            : 'text-gray-600 hover:text-gray-800'
                                    }`}
                                >
                                    <DollarSign size={16} />
                                    {t('payment.payNow')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsScheduledPayment(true)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                                        isScheduledPayment 
                                            ? 'bg-white shadow-sm text-[#065F46] font-medium' 
                                            : 'text-gray-600 hover:text-gray-800'
                                    }`}
                                >
                                    <Clock size={16} />
                                    {t('payment.scheduleLater')}
                                </button>
                            </div>

                            {/* Scheduled Date Picker */}
                            {isScheduledPayment && (
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                    <label className="block text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                                        <Calendar size={16} />
                                        {t('payment.scheduledDate')}
                                    </label>
                                    <input
                                        type="date"
                                        value={scheduledDate}
                                        onChange={(e) => setScheduledDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-3 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white outline-none"
                                    />
                                    <p className="text-xs text-amber-700 mt-2">
                                        ⏰ {t('payment.scheduledInfo')}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.paymentAmount')} ({selectedInvoice?.currencySymbol || DEFAULT_CURRENCY})</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    max={selectedInvoice.remainingAmount}
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                    placeholder={t('invoice.enterAmount')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.notes')} ({t('common.optional')})</label>
                                <input
                                    type="text"
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                    placeholder={t('invoice.paymentNotesPlaceholder')}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleAddPayment}
                                className={`px-6 py-2 text-white rounded-xl transition-colors flex items-center gap-2 ${
                                    isScheduledPayment 
                                        ? 'bg-amber-600 hover:bg-amber-700' 
                                        : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                            >
                                {isScheduledPayment ? (
                                    <>
                                        <Clock size={16} />
                                        {t('payment.schedulePayment')}
                                    </>
                                ) : (
                                    t('invoice.addPayment')
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Email Modal */}
            {showEmailModal && emailInvoice && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-scale-up max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Mail className="text-blue-600" size={24} />
                                {t('email.sendInvoice')}
                            </h2>
                            <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Auto-filled notice */}
                        <div className="mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                            <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                                <CheckCircle size={14} />
                                Auto-filled from your email template settings. Review and send.
                            </p>
                        </div>
                        
                        <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-sm text-blue-800">
                                📄 {t('invoice.title')} <span className="font-bold">#{emailInvoice.number}</span> - {emailInvoice.clientName || t('common.client')}
                            </p>
                            <p className="text-sm text-blue-700 mt-1">
                                💰 {t('invoice.total')}: <span className="font-bold">{formatCurrency(emailInvoice.totalAmount, emailInvoice.currencySymbol || DEFAULT_CURRENCY)}</span>
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    📧 {t('email.recipient')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={emailTo}
                                    onChange={(e) => setEmailTo(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="client@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    📝 {t('email.subject')}
                                </label>
                                <input
                                    type="text"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder={t('email.subjectPlaceholder')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    💬 {t('email.body')}
                                </label>
                                <textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    rows={8}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    placeholder={t('email.bodyPlaceholder')}
                                />
                                <div className="mt-1 text-xs text-gray-400 space-y-0.5">
                                    <p>Press <kbd className="px-1 py-0.5 bg-gray-100 border rounded text-[10px]">Enter</kbd> for new lines</p>
                                    <p>Formatting: <code className="text-[#065F46]">@strong(text)</code> <code className="text-[#065F46]">@underline(text)</code> <code className="text-[#065F46]">@italic(text)</code></p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <input type="checkbox" id="attachPdf" checked disabled className="rounded" />
                                <label htmlFor="attachPdf">📎 {t('email.attachPdf')}</label>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={() => setShowEmailModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                disabled={sendingEmail}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleSendEmail}
                                disabled={sendingEmail || !emailTo}
                                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sendingEmail ? (
                                    <>⏳ {t('email.sending')}...</>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        {t('email.send')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Detail View Modal */}
            {showDetailView && detailInvoiceId && (
                <InvoiceDetailView
                    invoiceId={detailInvoiceId}
                    onClose={() => {
                        setShowDetailView(false);
                        setDetailInvoiceId(null);
                    }}
                    onEdit={(id) => {
                        setShowDetailView(false);
                        navigate(`/invoices/edit/${id}`);
                    }}
                    onDownloadPdf={(id, number) => handleDownloadPdf(id, number)}
                    onSendEmail={(invoice) => {
                        setShowDetailView(false);
                        openEmailModal(invoice);
                    }}
                    isManager={isManager}
                />
            )}
        </div>
    );
}

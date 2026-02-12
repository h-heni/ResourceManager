import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Download, Trash2, Eye, DollarSign, X, Mail, Send, Calendar, Clock, Edit2, Archive, Filter, CheckCircle, FileWarning } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';
import { useAuth } from '../context/AuthContext';
import InvoiceDetailView from '../components/InvoiceDetailView';
import Pagination from '../components/Pagination';
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
    number?: string;
    Number?: string;
    invoiceNumber?: string;
    invoiceId?: number;
    source?: 'invoice' | 'historical';
    date: string;
    dueDate?: string;
    totalAmount: number;
    clientName: string;
    clientEmail?: string;
    status: string;
    isLocked?: boolean;
    treated?: boolean;
    devisId?: number;
    amountPaid: number;
    remainingAmount: number;
    payments?: Payment[];
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
    const activeDownloadIdsRef = useRef<Set<number>>(new Set());
    
    // Archive filter state
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [archivedInvoices, setArchivedInvoices] = useState<Invoice[]>([]);
    const [loadingArchive, setLoadingArchive] = useState(false);
    const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
    const [activePage, setActivePage] = useState(1);
    const [archivedPage, setArchivedPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [activeTotalCount, setActiveTotalCount] = useState(0);
    const [archivedTotalCount, setArchivedTotalCount] = useState(0);
    const [invoiceNumberSort, setInvoiceNumberSort] = useState<'asc' | 'desc'>('asc');
    
    const navigate = useNavigate();
    const { user } = useAuth();
    const activeTotalPages = Math.max(1, Math.ceil(activeTotalCount / pageSize));
    const archivedTotalPages = Math.max(1, Math.ceil(archivedTotalCount / pageSize));
    const currentPage = viewMode === 'archived' ? archivedPage : activePage;
    const currentTotalCount = viewMode === 'archived' ? archivedTotalCount : activeTotalCount;
    const currentTotalPages = viewMode === 'archived' ? archivedTotalPages : activeTotalPages;

    const isManager = user?.roles?.includes('Manager') || user?.roles?.includes('SuperAdmin') || user?.roles?.includes('FreeUser');

    useEffect(() => {
        fetchInvoices(1, pageSize);
        fetchAvailableYears();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Refetch when a payment is confirmed/extended via NotificationBell
    useEffect(() => {
        const handler = () => fetchInvoices(activePage, pageSize);
        window.addEventListener('payment-status-changed', handler);
        return () => window.removeEventListener('payment-status-changed', handler);
    }, [activePage, pageSize]);

    // Fetch archived invoices when year changes or switching to archived view
    useEffect(() => {
        if (viewMode === 'archived' && selectedYear) {
            fetchArchivedInvoices(selectedYear, archivedPage, pageSize);
        }
    }, [viewMode, selectedYear, archivedPage, pageSize]);

    // Fetch active invoices when active page/pageSize changes
    useEffect(() => {
        if (viewMode === 'active') {
            fetchInvoices(activePage, pageSize);
        }
    }, [viewMode, activePage, pageSize]);

    const fetchInvoices = async (page: number, size: number) => {
        try {
            const res = await api.get(`/Invoices?page=${page}&size=${size}&includePaid=false`);
            const payload = res.data || {};
            const items = payload.items || payload.data || [];
            const totalCount = payload.totalCount ?? payload.TotalCount ?? 0;

            setInvoices(items);
            setActiveTotalCount(totalCount);
        } catch (error) {
            console.error("Error fetching invoices", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableYears = async () => {
        try {
            const res = await api.get('/Archive/years');
            const years = res.data.years || [];
            setAvailableYears(years);
            // Set default to latest year
            if (years.length > 0 && res.data.latestYear) {
                setSelectedYear(res.data.latestYear);
            }
        } catch (error) {
            console.error("Error fetching available years", error);
        }
    };

    const fetchArchivedInvoices = async (year: number, page: number, size: number) => {
        setLoadingArchive(true);
        try {
            const res = await api.get(`/Archive/invoices?year=${year}&page=${page}&pageSize=${size}`);
            const payload = res.data || {};
            const items = payload.items || [];
            const totalCount = payload.totalCount ?? 0;

            setArchivedInvoices(items);
            setArchivedTotalCount(totalCount);
        } catch (error) {
            console.error("Error fetching archived invoices", error);
        } finally {
            setLoadingArchive(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!isManager) {
            alert(t('common.managerOnly'));
            return;
        }
        if (!confirm(t('invoice.messages.confirmDelete'))) return;
        try {
            await api.delete(`/Invoices/${id}`);
            fetchInvoices(activePage, pageSize);
        } catch (error: unknown) {
            console.error("Error deleting invoice", error);
            alert(getErrorMessage(error, t('invoice.messages.deleteFailed')));
        }
    };

    const resolveInvoiceNumber = (invoice?: Partial<Invoice> | null): string | null => {
        if (!invoice) return null;
        const rawNumber = invoice.number || invoice.Number || invoice.invoiceNumber;
        if (!rawNumber) return null;
        const normalized = String(rawNumber).trim();
        return normalized.length > 0 ? normalized : null;
    };

    const buildInvoiceFileName = (invoice: Partial<Invoice> | null, id: number): string => {
        const resolvedNumber = resolveInvoiceNumber(invoice);
        return `Facture_${resolvedNumber ?? id}.pdf`;
    };

    const resolveLinkedInvoiceNumber = (invoice?: Partial<Invoice> | null): string | null => {
        if (!invoice) return null;
        const linkedNumber = invoice.invoiceNumber;
        if (linkedNumber && String(linkedNumber).trim().length > 0) {
            return String(linkedNumber).trim();
        }

        if (invoice.source === 'historical') {
            return null;
        }

        return resolveInvoiceNumber(invoice);
    };

    const handleDownloadPdf = async (id: number, invoice?: Partial<Invoice> | null) => {
        if (loading || (viewMode === 'archived' && loadingArchive)) {
            return;
        }

        setDownloadingInvoiceId(id);
        try {
            const res = await api.get(`/Invoices/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', buildInvoiceFileName(invoice ?? null, id));
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading PDF", error);
            alert(t('common.downloadFailed'));
        } finally {
            setDownloadingInvoiceId(null);
        }
    };

    const handleDownloadRemainingPdf = async (id: number, invoice?: Partial<Invoice> | null) => {
        if (loading || (viewMode === 'archived' && loadingArchive)) {
            return;
        }
        if (activeDownloadIdsRef.current.has(id)) {
            return;
        }

        activeDownloadIdsRef.current.add(id);
        setDownloadingInvoiceId(id);
        try {
            const res = await api.get(`/Invoices/${id}/remaining-payment-pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            const num = resolveInvoiceNumber(invoice ?? null) ?? id;
            link.setAttribute('download', `Reste_a_payer_${num}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading remaining payment PDF', error);
            alert(t('common.downloadFailed'));
        } finally {
            activeDownloadIdsRef.current.delete(id);
            setDownloadingInvoiceId(null);
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
                '@InvoiceNumber': resolveInvoiceNumber(invoice) || String(invoice.id),
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
            setEmailSubject(`${t('invoice.title')} #${resolveInvoiceNumber(invoice) || invoice.id} - ${invoice.clientName || t('common.client')}`);
            setEmailBody(
                `${t('email.greeting')} ${invoice.clientName || t('common.client')},\n\n` +
                `${t('email.invoiceAttached')} #${resolveInvoiceNumber(invoice) || invoice.id} ${t('email.forAmount')} ${invoice.totalAmount?.toLocaleString()} ${invoice.currencySymbol || DEFAULT_CURRENCY}.\n\n` +
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
            alert(t('email.sentSuccess'));
            setShowEmailModal(false);
        } catch (error: unknown) {
            console.error("Error sending email", error);
            alert(`${t('email.sendFailed')}: ${getErrorMessage(error)}`);
        } finally {
            setSendingEmail(false);
        }
    };

    const handleAddPayment = async () => {
        if (!selectedInvoice || !paymentAmount) return;
        
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            alert(t('supplierInvoice.invalidPaymentAmount'));
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
            fetchInvoices(activePage, pageSize);
            
            if (isScheduledPayment) {
                alert(t('payment.scheduledSuccess'));
            }
        } catch (error) {
            console.error("Error adding payment", error);
            alert(t('supplierInvoice.paymentFailed'));
        }
    };



    const filteredInvoices = viewMode === 'archived' 
        ? archivedInvoices.filter(i => {
            const numMatch = i.number?.toString().includes(search) ?? false;
            const altNumMatch = i.invoiceNumber?.toString().includes(search) ?? false;
            const clientMatch = i.clientName?.toLowerCase().includes(search.toLowerCase()) ?? false;
            return numMatch || altNumMatch || clientMatch;
          })
        : (invoices || []).filter(i => {
            const numMatch = i.number?.toString().includes(search) ?? false;
            const altNumMatch = i.invoiceNumber?.toString().includes(search) ?? false;
            const clientMatch = i.clientName?.toLowerCase().includes(search.toLowerCase()) ?? false;
            const searchMatch = numMatch || altNumMatch || clientMatch;
            
            return searchMatch;
          });

    const sortedInvoices = [...filteredInvoices].sort((a, b) => {
        const aValue = (resolveLinkedInvoiceNumber(a) || '').toLowerCase();
        const bValue = (resolveLinkedInvoiceNumber(b) || '').toLowerCase();
        if (aValue === bValue) return 0;
        if (invoiceNumberSort === 'asc') {
            return aValue > bValue ? 1 : -1;
        }
        return aValue < bValue ? 1 : -1;
    });
    
            const activeCount = activeTotalCount;
            const archivedCount = archivedTotalCount;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('nav.invoices')}</h1>
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex p-1 bg-gray-100 rounded-xl">
                    <button
                        onClick={() => {
                            setViewMode('active');
                            setActivePage(1);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            viewMode === 'active'
                                ? 'bg-white shadow-sm text-[#065F46]'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Filter size={16} />
                        {t('supplierInvoice.activeInvoices')} ({activeCount})
                    </button>
                    <button
                        onClick={() => {
                            setViewMode('archived');
                            setArchivedPage(1);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            viewMode === 'archived'
                                ? 'bg-white shadow-sm text-emerald-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Archive size={16} />
                        {t('invoice.messages.archived')} ({archivedCount})
                    </button>
                </div>

                {/* Year filter dropdown - only show when archived view is active */}
                {viewMode === 'archived' && availableYears.length > 0 && (
                    <div className="flex items-center gap-2">
                        <label htmlFor="year-select" className="text-sm font-medium text-gray-600">
                            {t('common.year', 'Year')}:
                        </label>
                        <select
                            id="year-select"
                            value={selectedYear || ''}
                            onChange={(e) => {
                                setArchivedPage(1);
                                setSelectedYear(parseInt(e.target.value));
                            }}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {(loading || (viewMode === 'archived' && loadingArchive)) ? (
                <div className="text-center py-20 text-gray-500">{t('common.loadingData')}</div>
            ) : (
                <div className="rm-table-card overflow-x-auto">
                        <table className="rm-table">
                            <colgroup>
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '16%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '14%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '13%' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th
                                        className="cursor-pointer select-none"
                                        onClick={() => setInvoiceNumberSort(prev => prev === 'asc' ? 'desc' : 'asc')}
                                    >
                                        {t('invoice.invoiceNumber', 'Invoice #')} {invoiceNumberSort === 'asc' ? '↑' : '↓'}
                                    </th>
                                    <th>{t('invoice.client')}</th>
                                    <th>{t('invoice.date')}</th>
                                    <th className="rm-th-number">{t('invoice.total')}</th>
                                    <th className="rm-th-number">{t('invoice.amountPaid')}</th>
                                    <th className="rm-th-number">{t('invoice.remaining')}</th>
                                    <th>{t('common.status')}</th>
                                    <th className="rm-th-actions">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedInvoices.map((invoice) => (
                                    <tr key={invoice.id} className="group">
                                        <td className="rm-cell-text font-semibold text-[#065F46]">
                                            {invoice.source === 'historical' && invoice.invoiceId ? (
                                                <button
                                                    type="button"
                                                    className="hover:underline truncate block"
                                                    onClick={() => handleViewDetails(invoice.invoiceId!)}
                                                    title={resolveLinkedInvoiceNumber(invoice) || undefined}
                                                >
                                                    #{resolveLinkedInvoiceNumber(invoice) || invoice.id}
                                                </button>
                                            ) : (
                                                <span className="truncate block" title={resolveInvoiceNumber(invoice) || String(invoice.id)}>
                                                    #{resolveInvoiceNumber(invoice) || invoice.id}
                                                </span>
                                            )}
                                        </td>
                                        <td className="rm-cell-text text-gray-900">
                                            <span className="truncate block" title={invoice.clientName || undefined}>
                                                {invoice.clientName || t('common.unknown')}
                                            </span>
                                        </td>
                                        <td className="rm-cell-text text-gray-500">{invoice.date ? new Date(invoice.date).toLocaleDateString() : t('users.table.notAvailable')}</td>
                                        <td className="rm-cell-currency">{formatCurrency(invoice.totalAmount, invoice.currencySymbol || DEFAULT_CURRENCY)}</td>
                                        <td className="rm-cell-currency text-emerald-600">
                                            {formatCurrency(invoice.amountPaid, invoice.currencySymbol || DEFAULT_CURRENCY)}
                                            {invoice.payments?.some(p => p.status === 'Pending') && (
                                                <div className="text-xs text-orange-500 font-normal mt-0.5">
                                                    +{formatCurrency(invoice.payments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.amount, 0), invoice.currencySymbol || DEFAULT_CURRENCY)} {t('payment.pending')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="rm-cell-currency text-amber-600">
                                            {invoice.remainingAmount > 0 ? formatCurrency(invoice.remainingAmount, invoice.currencySymbol || DEFAULT_CURRENCY) : '—'}
                                        </td>
                                        <td className="rm-cell-text">
                                            <span className={`px-3 py-1 text-xs font-semibold rounded-full inline-block ${getInvoiceStatusColor(invoice.status)}`}>
                                                {invoice.status}
                                            </span>
                                            {viewMode === 'archived' && invoice.source === 'historical' && (
                                                <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full inline-block">
                                                    {t('common.imported', 'Imported')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="rm-cell-actions">
                                            <div className="flex items-center justify-end space-x-1">
                                                {/* Don't show action buttons for historical archived items */}
                                                {!(viewMode === 'archived' && invoice.source === 'historical') && (
                                                    <>
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
                                                                title={t('common.edit')}
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
                                                            onClick={() => handleDownloadPdf(invoice.id, invoice)}
                                                            disabled={loading || (viewMode === 'archived' && loadingArchive) || downloadingInvoiceId === invoice.id}
                                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title={t('invoice.downloadPdf')}
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                        {/* Remaining Payment PDF - only for partially paid / unpaid */}
                                                        {(invoice.status === 'PartiallyPaid' || (invoice.status === 'Unpaid' && invoice.remainingAmount > 0)) && (
                                                            <button
                                                                onClick={() => handleDownloadRemainingPdf(invoice.id, invoice)}
                                                                disabled={downloadingInvoiceId === invoice.id}
                                                                className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                                title={t('invoice.remainingPaymentPdf', 'Remaining Payment Notice')}
                                                            >
                                                                <FileWarning size={18} />
                                                            </button>
                                                        )}
                                                        {/* Delete button - Manager only, not locked, not paid */}
                                                        {isManager && !invoice.isLocked && invoice.status !== 'Paid' && (
                                                            <button
                                                                onClick={() => handleDelete(invoice.id)}
                                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title={t('common.delete')}
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                {/* For historical items, show a view-only indicator */}
                                                {viewMode === 'archived' && invoice.source === 'historical' && (
                                                    <span className="text-xs text-gray-400 italic">
                                                        {t('common.viewOnly', 'View only')}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sortedInvoices.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                                            {t('invoice.messages.empty')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    {!search && (
                        <Pagination
                            page={currentPage}
                            totalPages={currentTotalPages}
                            totalCount={currentTotalCount}
                            size={pageSize}
                            onPageChange={(p) => {
                                if (viewMode === 'archived') {
                                    setArchivedPage(p);
                                } else {
                                    setActivePage(p);
                                }
                            }}
                            onSizeChange={(s) => {
                                setPageSize(s);
                                setActivePage(1);
                                setArchivedPage(1);
                            }}
                        />
                    )}
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedInvoice && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-up">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">{t('invoice.addPayment')}</h2>
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
                                        {t('payment.scheduledInfo')}
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
                                {t('invoice.messages.emailAutofillNotice')}
                            </p>
                        </div>
                        
                        <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-sm text-blue-800">
                                📄 {t('invoice.title')} <span className="font-bold">#{resolveInvoiceNumber(emailInvoice) || emailInvoice.id}</span> - {emailInvoice.clientName || t('common.client')}
                            </p>
                            <p className="text-sm text-blue-700 mt-1">
                                💰 {t('invoice.total')}: <span className="font-bold">{formatCurrency(emailInvoice.totalAmount, emailInvoice.currencySymbol || DEFAULT_CURRENCY)}</span>
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('email.recipient')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={emailTo}
                                    onChange={(e) => setEmailTo(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder={t('email.recipient')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('email.subject')}
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
                                    {t('email.body')}
                                </label>
                                <textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    rows={8}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    placeholder={t('email.bodyPlaceholder')}
                                />
                                <div className="mt-1 text-xs text-gray-400 space-y-0.5">
                                    <p>{t('invoice.messages.enterNewLineHint')}</p>
                                    <p>{t('invoice.messages.formattingHint')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <input type="checkbox" id="attachPdf" checked disabled className="rounded" />
                                <label htmlFor="attachPdf">{t('email.attachPdf')}</label>
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
                                    <>{t('email.sending')}...</>
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
                    onDownloadPdf={(id, number) => handleDownloadPdf(id, { id, number: String(number) })}
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

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Plus, Search, Download, Eye, DollarSign, X, Mail, Send, Calendar, Clock, Archive, Filter, CheckCircle, FileWarning, AlertTriangle, Loader2, Check, Pencil, Trash2, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getErrorMessage, getAxiosResponseData } from '../utils/errorUtils';
import { useAuth } from '../context/AuthContext';
import { useInvoices as useInvoicesQuery, useArchivedInvoices, useAvailableYears, useDeleteInvoice } from '../hooks/useInvoices';
import { useQueryClient } from '@tanstack/react-query';
import InvoiceDetailView from '../components/InvoiceDetailView';
import Pagination from '../components/Pagination';
import { formatCurrency } from '../lib/formatNumber';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
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
    quoteId?: number;
    amountPaid: number;
    pendingAmount: number;
    remainingAmount: number;
    progress?: number;
    payments?: Payment[];
    currency?: string;
    currencySymbol?: string;
}

export default function InvoicesPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [isScheduledPayment, setIsScheduledPayment] = useState(false);
    const [scheduledDate, setScheduledDate] = useState('');
    const [submittingPayment, setSubmittingPayment] = useState(false);
    
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
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
    const [activePage, setActivePage] = useState(1);
    const [archivedPage, setArchivedPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [invoiceNumberSort, setInvoiceNumberSort] = useState<'asc' | 'desc'>('asc');
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    
    // Cascade delete warning state
    const [showDeleteWarning, setShowDeleteWarning] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const [linkedDocuments, setLinkedDocuments] = useState<{
        invoiceNumber?: string;
        status?: string;
        isLocked?: boolean;
        linkedQuotes?: { id: number; number: string; status: string }[];
        linkedDeliveryNotes?: { id: number; number: string }[];
        payments?: { id: number; amount: number; status: string }[];
        pdfFileCount?: number;
        hasLinkedDocuments?: boolean;
    } | null>(null);
    const [loadingLinkedDocs, setLoadingLinkedDocs] = useState(false);

    const navigate = useNavigate();
    const { notify, NotifyBanner } = useNotify();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const deleteMutation = useDeleteInvoice();

    // React Query: active invoices
    const { data: activeData, isLoading: loading } = useInvoicesQuery(activePage, pageSize, viewMode === 'active');
    const invoices = (activeData?.items ?? []) as Invoice[];
    const activeTotalCount = activeData?.totalCount ?? 0;

    // React Query: available years
    const { data: yearsData } = useAvailableYears();
    const availableYears = yearsData?.years ?? [];

    // Set default year when years load
    useEffect(() => {
        if (yearsData?.latestYear && selectedYear === null) {
            setSelectedYear(yearsData.latestYear);
        }
    }, [yearsData?.latestYear, selectedYear]);

    // React Query: archived invoices
    const { data: archivedData, isLoading: loadingArchive } = useArchivedInvoices(selectedYear, archivedPage, pageSize);
    const archivedInvoices = (archivedData?.items ?? []) as Invoice[];
    const archivedTotalCount = archivedData?.totalCount ?? 0;

    const activeTotalPages = Math.max(1, Math.ceil(activeTotalCount / pageSize));
    const archivedTotalPages = Math.max(1, Math.ceil(archivedTotalCount / pageSize));
    const currentPage = viewMode === 'archived' ? archivedPage : activePage;
    const currentTotalCount = viewMode === 'archived' ? archivedTotalCount : activeTotalCount;
    const currentTotalPages = viewMode === 'archived' ? archivedTotalPages : activeTotalPages;

    const isManager = user?.roles?.includes('Manager') || user?.roles?.includes('SuperAdmin') || user?.roles?.includes('FreeUser');

    // Refetch when a payment is confirmed/extended via NotificationBell
    useEffect(() => {
        const handler = () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        };
        window.addEventListener('payment-status-changed', handler);
        return () => window.removeEventListener('payment-status-changed', handler);
    }, [queryClient]);

    const handleDelete = async (id: number) => {
        if (!isManager) {
            notify('warning', t('common.managerOnly'));
            return;
        }
        // Fetch linked documents first to show cascade warning
        setDeleteTargetId(id);
        setLoadingLinkedDocs(true);
        try {
            const res = await api.get(`/Invoices/${id}/linked-documents`);
            setLinkedDocuments(res.data);
            setShowDeleteWarning(true);
        } catch {
            // If endpoint fails, fall back to simple confirm
            if (!confirm(t('invoice.messages.confirmDelete'))) return;
            await executeDelete(id);
        } finally {
            setLoadingLinkedDocs(false);
        }
    };

    const executeDelete = async (id: number) => {
        try {
            await deleteMutation.mutateAsync(id);
            setShowDeleteWarning(false);
            setDeleteTargetId(null);
            setLinkedDocuments(null);
        } catch (error: unknown) {
            logger.error("Error deleting invoice", error);
            notify('error', getErrorMessage(error, t('invoice.messages.deleteFailed')));
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
            logger.error("Error downloading PDF", error);
            notify('error', t('common.downloadFailed'));
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
            logger.error('Error downloading remaining payment PDF', error);
            notify('error', t('common.downloadFailed'));
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
            notify('warning', t('email.enterRecipient'));
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
            notify('success', t('email.sentSuccess'));
            setShowEmailModal(false);
        } catch (error: unknown) {
            logger.error("Error sending email", error);
            const responseData = getAxiosResponseData(error);
            const bounceType = responseData?.bounceType as string | undefined;
            const bounceStatus = responseData?.bounceStatus as string | undefined;

            if (bounceType === 'hard') {
                notify('error', `${getErrorMessage(error)}${bounceStatus ? ` (${bounceStatus})` : ''}`);
            } else {
                notify('error', `${t('email.sendFailed')}: ${getErrorMessage(error)}`);
            }
        } finally {
            setSendingEmail(false);
        }
    };

    const handleAddPayment = async () => {
        if (!selectedInvoice || !paymentAmount || submittingPayment) return;
        
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            notify('warning', t('supplierInvoice.invalidPaymentAmount'));
            return;
        }

        // If scheduled payment, validate date
        if (isScheduledPayment && !scheduledDate) {
            notify('warning', t('payment.selectScheduledDate'));
            return;
        }

        setSubmittingPayment(true);
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
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            
            if (isScheduledPayment) {
                notify('success', t('payment.scheduledSuccess'));
            }
        } catch (error: unknown) {
            logger.error("Error adding payment", error);
            const axErr = error as { response?: { data?: { message?: string; detail?: string } } };
            const serverMsg = axErr?.response?.data?.message || axErr?.response?.data?.detail;
            notify('error', serverMsg || t('supplierInvoice.paymentFailed'));
        } finally {
            setSubmittingPayment(false);
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

    const toggleRow = (id: number) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (selectedRows.length === sortedInvoices.length && sortedInvoices.length > 0) {
            setSelectedRows([]);
        } else {
            setSelectedRows(sortedInvoices.map(i => i.id));
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col gap-6">
            <NotifyBanner />

            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('nav.invoices')}</h1>
                    <p className="text-sm text-slate-500 mt-1">{t('invoice.pageDescription')}</p>
                </div>
            </div>

            {/* ── Table Container ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col p-6">

                {/* Action Bar / Search */}
                <div className="flex items-center justify-between mb-6 h-12">
                    <div className="flex-1 flex items-center gap-4">
                        {selectedRows.length > 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="flex items-center gap-1 p-1 bg-white rounded-full border border-slate-200 shadow-sm overflow-x-auto"
                            >
                                <div className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 rounded-full flex items-center gap-2 border border-purple-100/50 flex-shrink-0">
                                    <span className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] shadow-inner">{selectedRows.length}</span>
                                    {t('common.selected', 'Selected')}
                                </div>
                                {selectedRows.length === 1 && (() => {
                                    const inv = sortedInvoices.find(i => i.id === selectedRows[0]);
                                    return inv && isManager && !inv.isLocked && inv.status !== 'Paid' && inv.status !== 'PartiallyPaid' ? (
                                        <button
                                            onClick={() => navigate(`/invoices/edit/${inv.id}`)}
                                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors"
                                        >
                                            <Pencil size={14} className="text-purple-500" /> {t('common.edit')}
                                        </button>
                                    ) : null;
                                })()}
                                {selectedRows.length === 1 && (() => {
                                    const inv = sortedInvoices.find(i => i.id === selectedRows[0]);
                                    return inv && inv.status !== 'Paid' ? (
                                        <button
                                            onClick={() => { openPaymentModal(inv); }}
                                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-full text-xs font-medium transition-colors"
                                        >
                                            <Check size={14} className="text-emerald-500" /> {t('invoice.addPayment')}
                                        </button>
                                    ) : null;
                                })()}
                                <button
                                    onClick={() => {
                                        const inv = sortedInvoices.find(i => i.id === selectedRows[0]);
                                        if (inv) openEmailModal(inv);
                                    }}
                                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors"
                                >
                                    <Send size={14} className="text-purple-500" /> {t('email.sendInvoice')}
                                </button>
                                <button
                                    onClick={() => {
                                        selectedRows.forEach(id => {
                                            const inv = sortedInvoices.find(i => i.id === id);
                                            handleDownloadPdf(id, inv);
                                        });
                                    }}
                                    disabled={downloadingInvoiceId !== null}
                                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors disabled:opacity-50"
                                >
                                    <Download size={14} className="text-purple-500" /> {t('invoice.downloadPdf')}
                                </button>
                                {selectedRows.length === 1 && (
                                    <button
                                        onClick={() => handleViewDetails(selectedRows[0])}
                                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-full text-xs font-medium transition-colors"
                                    >
                                        <Eye size={14} className="text-purple-500" /> {t('invoice.viewDetails')}
                                    </button>
                                )}
                                {selectedRows.length === 1 && (() => {
                                    const inv = sortedInvoices.find(i => i.id === selectedRows[0]);
                                    return inv && (inv.status === 'PartiallyPaid' || (inv.status === 'Pending' && inv.remainingAmount > 0)) ? (
                                        <button
                                            onClick={() => handleDownloadRemainingPdf(inv.id, inv)}
                                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-orange-50 text-slate-600 hover:text-orange-700 rounded-full text-xs font-medium transition-colors"
                                        >
                                            <FileWarning size={14} className="text-orange-500" /> {t('invoice.remainingPaymentPdf', 'Remaining')}
                                        </button>
                                    ) : null;
                                })()}
                                <div className="w-px h-4 bg-slate-200 mx-1 flex-shrink-0" />
                                <button
                                    onClick={() => { selectedRows.forEach(id => handleDelete(id)); setSelectedRows([]); }}
                                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-full text-xs font-medium transition-colors"
                                >
                                    <Trash2 size={14} className="text-red-500" /> {t('common.delete')}
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative max-w-sm w-full">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder={t('invoice.searchPlaceholder')}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200/60 hover:border-purple-300 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 rounded-full text-sm font-medium outline-none transition-all placeholder:text-slate-400 text-slate-900 shadow-sm"
                                />
                            </motion.div>
                        )}
                    </div>
                    {!selectedRows.length && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            onClick={() => navigate('/invoices/create')}
                            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                            <Plus size={16} /> {t('invoice.create')}
                        </motion.button>
                    )}
                </div>

                {/* Active / Archived Toggle */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
                <div className="flex p-1 bg-gray-100 rounded-xl">
                    <button
                        onClick={() => {
                            setViewMode('active');
                            setActivePage(1);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            viewMode === 'active'
                                ? 'bg-white shadow-sm text-purple-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Filter size={16} />
                        {t('supplierInvoice.activeInvoices')} ({activeCount})
                    </button>
                    {isManager && (
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
                    )}
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
                <div className="text-center py-20 text-slate-400">{t('common.loadingData')}</div>
            ) : (
                <>
                <div className="flex-1 overflow-x-auto overflow-y-visible">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr>
                                <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest w-12">
                                    <button
                                        onClick={toggleAll}
                                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                            selectedRows.length > 0 && selectedRows.length === sortedInvoices.length
                                                ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                                                : 'border-slate-300 hover:border-purple-400 bg-white text-transparent'
                                        }`}
                                    >
                                        <Check size={12} strokeWidth={3} />
                                    </button>
                                </th>
                                <th
                                    className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest cursor-pointer select-none"
                                    onClick={() => setInvoiceNumberSort(prev => prev === 'asc' ? 'desc' : 'asc')}
                                >
                                    {t('invoice.invoiceNumber', 'Invoice #')} {invoiceNumberSort === 'asc' ? '↑' : '↓'}
                                </th>
                                <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest">{t('invoice.client')}</th>
                                <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest">{t('invoice.dates', 'Dates')}</th>
                                <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest">{t('common.status')}</th>
                                <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-right">{t('invoice.total')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedInvoices.length > 0 ? sortedInvoices.map((invoice, idx) => {
                                const isSelected = selectedRows.includes(invoice.id);
                                return (
                                    <motion.tr
                                        key={invoice.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        onClick={() => toggleRow(invoice.id)}
                                        className={`group border-b border-slate-100 cursor-pointer transition-colors ${
                                            isSelected ? 'bg-purple-50/50' : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <td className="py-4 px-4 align-top w-12">
                                            <div
                                                className={`w-5 h-5 mt-1 rounded-full border flex items-center justify-center transition-all ${
                                                    isSelected
                                                        ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                                                        : 'border-slate-300 bg-white text-transparent group-hover:border-purple-400'
                                                }`}
                                            >
                                                <Check size={12} strokeWidth={3} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-slate-800 text-sm">
                                                    {invoice.source === 'historical' && invoice.invoiceId ? (
                                                        <button
                                                            type="button"
                                                            className="hover:underline"
                                                            onClick={(e) => { e.stopPropagation(); handleViewDetails(invoice.invoiceId!); }}
                                                        >
                                                            #{resolveLinkedInvoiceNumber(invoice) || invoice.id}
                                                        </button>
                                                    ) : (
                                                        <span>#{resolveInvoiceNumber(invoice) || invoice.id}</span>
                                                    )}
                                                </span>
                                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                                    <CreditCard size={12} className="text-slate-400" />
                                                    {invoice.currency || DEFAULT_CURRENCY}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 align-top">
                                            <span className="font-medium text-slate-700 text-sm">{invoice.clientName || t('common.unknown')}</span>
                                        </td>
                                        <td className="py-4 px-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                                                    <Calendar size={12} className="text-slate-400" /> {invoice.date ? new Date(invoice.date).toLocaleDateString() : '-'}
                                                </span>
                                                {invoice.dueDate && (
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                        <Calendar size={12} className="text-red-300" /> {new Date(invoice.dueDate).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 align-top">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${getInvoiceStatusColor(invoice.status)}`}>
                                                {t(`invoice.status.${invoice.status}`, invoice.status)}
                                            </span>
                                            {viewMode === 'archived' && invoice.source === 'historical' && (
                                                <span className="ms-1 px-2 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                                                    {t('common.imported', 'Imported')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-4 align-top text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="font-bold text-slate-900 tracking-tight text-base">
                                                    {formatCurrency(invoice.totalAmount, invoice.currencySymbol || DEFAULT_CURRENCY)}
                                                </span>
                                                {invoice.amountPaid > 0 && (
                                                    <span className="text-xs text-emerald-600 font-medium">
                                                        {t('invoice.amountPaid')}: {formatCurrency(invoice.amountPaid, invoice.currencySymbol || DEFAULT_CURRENCY)}
                                                    </span>
                                                )}
                                                {invoice.remainingAmount > 0 && (
                                                    <span className="text-xs text-amber-600">
                                                        {t('invoice.remaining')}: {formatCurrency(invoice.remainingAmount, invoice.currencySymbol || DEFAULT_CURRENCY)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-center mb-3">
                                                <Search className="text-slate-400" size={20} />
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-800">{t('invoice.messages.empty')}</h3>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
                </>
            )}
            </div>

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
                            {(selectedInvoice.pendingAmount || 0) > 0 && (
                                <p className="text-sm text-gray-600">{t('invoice.pending', 'Pending')}: <span className="font-bold text-orange-500">{formatCurrency(selectedInvoice.pendingAmount, selectedInvoice.currencySymbol || DEFAULT_CURRENCY)}</span></p>
                            )}
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
                                            ? 'bg-white shadow-sm text-purple-600 font-medium' 
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
                                            ? 'bg-white shadow-sm text-purple-600 font-medium' 
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
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder={t('invoice.enterAmount')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.notes')} ({t('common.optional')})</label>
                                <input
                                    type="text"
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
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
                                disabled={submittingPayment}
                                className={`px-6 py-2 text-white rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 ${
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
                    onDelete={async (id) => {
                        setShowDetailView(false);
                        setDetailInvoiceId(null);
                        await handleDelete(id);
                    }}
                    isManager={isManager}
                />
            )}

            {/* Cascade Delete Warning Modal */}
            {showDeleteWarning && deleteTargetId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 rounded-full">
                                <AlertTriangle className="text-red-600" size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">{t('invoice.cascadeDelete.title')}</h3>
                        </div>

                        {loadingLinkedDocs ? (
                            <div className="flex justify-center py-6">
                                <Loader2 className="animate-spin text-gray-400" size={24} />
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-gray-600 mb-4">
                                    {t('invoice.cascadeDelete.warning', { number: linkedDocuments?.invoiceNumber || deleteTargetId })}
                                </p>

                                {linkedDocuments?.hasLinkedDocuments && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 space-y-2">
                                        {linkedDocuments.linkedQuotes && linkedDocuments.linkedQuotes.length > 0 && (
                                            <div className="text-sm text-amber-800">
                                                <div className="flex items-center gap-2">
                                                    <FileWarning size={14} />
                                                    <span>{t('invoice.cascadeDelete.linkedQuotes', { count: linkedDocuments.linkedQuotes.length })}</span>
                                                </div>
                                                <ul className="ml-6 mt-1 space-y-0.5">
                                                    {linkedDocuments.linkedQuotes.map(q => (
                                                        <li key={q.id} className="text-xs flex items-center gap-1">
                                                            {q.number}
                                                            {q.status && (
                                                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{q.status}</span>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {linkedDocuments.linkedDeliveryNotes && linkedDocuments.linkedDeliveryNotes.length > 0 && (
                                            <div className="text-sm text-amber-800">
                                                <div className="flex items-center gap-2">
                                                    <FileWarning size={14} />
                                                    <span>{t('invoice.cascadeDelete.linkedDeliveryNotes', { count: linkedDocuments.linkedDeliveryNotes.length })}</span>
                                                </div>
                                                <ul className="ml-6 mt-1 space-y-0.5">
                                                    {linkedDocuments.linkedDeliveryNotes.map(dn => (
                                                        <li key={dn.id} className="text-xs">
                                                            {dn.number}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {linkedDocuments.payments && linkedDocuments.payments.length > 0 && (
                                            <div className="flex items-center gap-2 text-sm text-amber-800">
                                                <DollarSign size={14} />
                                                <span>{t('invoice.cascadeDelete.linkedPayments', { count: linkedDocuments.payments.length })}</span>
                                            </div>
                                        )}
                                        {(linkedDocuments.pdfFileCount ?? 0) > 0 && (
                                            <div className="flex items-center gap-2 text-sm text-amber-800">
                                                <Download size={14} />
                                                <span>{t('invoice.cascadeDelete.linkedPdfs', { count: linkedDocuments.pdfFileCount })}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {linkedDocuments?.hasLinkedDocuments && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                        <p className="text-sm text-blue-800">
                                            {t('invoice.cascadeDelete.unlockWarning')}
                                        </p>
                                    </div>
                                )}

                                {linkedDocuments?.status && linkedDocuments.status !== 'Pending' && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                        <p className="text-sm text-red-800 font-medium">
                                            {t('invoice.cascadeDelete.notPending', { status: linkedDocuments.status })}
                                        </p>
                                    </div>
                                )}

                                <p className="text-sm text-red-600 font-medium mb-4">
                                    {t('invoice.cascadeDelete.confirmation')}
                                </p>
                            </>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setShowDeleteWarning(false); setDeleteTargetId(null); setLinkedDocuments(null); }}
                                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => executeDelete(deleteTargetId!)}
                                disabled={loadingLinkedDocs || (!!linkedDocuments?.status && linkedDocuments.status !== 'Pending')}
                                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('invoice.cascadeDelete.confirmButton')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

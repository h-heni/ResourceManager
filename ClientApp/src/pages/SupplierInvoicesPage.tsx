import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
    Upload, FileText, Loader2, CheckCircle, AlertTriangle, Trash2,
    Plus, Save, ArrowLeft, Eye, X, Edit2, Search, DollarSign, ShieldCheck, Calendar,
    Clock, Filter, Archive
} from 'lucide-react';
import api from '../services/api';
import { queryClient } from '../lib/queryClient';
import { useSupplierInvoices, useDeleteSupplierInvoice } from '../hooks/useSupplierInvoices';
import { useAvailableYears } from '../hooks/useInvoices';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/formatNumber';
import { DEFAULT_CURRENCY, CURRENCY_OPTIONS, getCurrencySymbol } from '../lib/currencyUtils';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { getErrorMessage } from '../utils/errorUtils';
import Pagination from '../components/Pagination'; // Make sure this path is correct
import { getInvoiceStatusColor } from '../lib/utils'; // Make sure this path is correct

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface LineItem {
    id: string; 
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    totalHT: number;
}

interface ExtractedData {
    supplierName: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalHT: number | null;
    totalTTC: number | null;
    tva: number | null;
    email: string;
    phone: string;
    address: string;
    taxId: string;
    currency: string;
    lineItems: LineItem[];
}

interface SupplierPayment {
    id: number;
    amount: number;
    paymentDate: string;
    notes?: string;
    status: string;
    isScheduled: boolean;
    createdAt: string;
    ConfirmedBy?: string;
    ConfirmedAt?: string;
    CreatedBy?: string;
}

interface SupplierInvoice {
    id: number;
    fileName: string;
    invoiceNumber: string;
    invoiceDate: string | null;
    dueDate: string | null;
    totalHT: number | null;
    totalTTC: number | null;
    tva: number | null;
    extractionStatus: string;
    confidenceScore: number | null;
    createdAt: string;
    supplierName: string | null;
    supplierId: number | null;
    itemCount: number;
    amountPaid: number;
    pendingAmount: number;
    remainingAmount: number;
    paymentStatus: string;
    paymentCount: number;
    filePath: string | null;
    isDeleted?: boolean;
    payments: SupplierPayment[];
    currency?: string;
    currencySymbol?: string;
    purchaseOrderId?: number | null;
    purchaseOrderNumber?: string | null;
}

interface ConsistencyIssue {
    invoiceId: number;
    invoiceNumber: string;
    supplierName: string;
    issueCount: number;
    issues: string[];
}

// localStorage key
const AUTOSAVE_KEY = 'supplier-invoice-draft';

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SupplierInvoicesPage() {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isManager = user?.roles?.includes('Manager') || user?.roles?.includes('SuperAdmin') || user?.roles?.includes('FreeUser');

    // View state
    const [view, setView] = useState<'list' | 'upload' | 'review'>('list');

    // Identical List & Archive State to InvoicesPage.tsx
    const[viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    
    const[search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [invoiceNumberSort, setInvoiceNumberSort] = useState<'asc' | 'desc'>('asc');

    // Pagination identical to InvoicesPage
    const [activePage, setActivePage] = useState(1);
    const [archivedPage, setArchivedPage] = useState(1);
    const[pageSize, setPageSize] = useState(20);

    // Archive/Year filter state
    const [selectedYear, setSelectedYear] = useState<number | null>(null);

    // React Query hooks for data fetching
    const { data: yearsData } = useAvailableYears();
    const availableYears = useMemo(() => yearsData?.years || [], [yearsData?.years]);
    const activeQuery = useSupplierInvoices(activePage, pageSize, 'Pending', debouncedSearch);
    const archivedQuery = useSupplierInvoices(archivedPage, pageSize, 'Paid', debouncedSearch, selectedYear, !!selectedYear);
    const deleteMutation = useDeleteSupplierInvoice();

    const loadingActive = activeQuery.isLoading;
    const loadingArchive = archivedQuery.isLoading;
    const activeTotalCount = activeQuery.data?.totalCount || 0;
    const archivedTotalCount = archivedQuery.data?.totalCount || 0;

    const activeTotalPages = Math.max(1, Math.ceil(activeTotalCount / pageSize));
    const archivedTotalPages = Math.max(1, Math.ceil(archivedTotalCount / pageSize));
    const currentPage = viewMode === 'archived' ? archivedPage : activePage;
    const currentTotalCount = viewMode === 'archived' ? archivedTotalCount : activeTotalCount;
    const currentTotalPages = viewMode === 'archived' ? archivedTotalPages : activeTotalPages;

    // Upload state
    const [uploading, setUploading] = useState(false);
    const[uploadProgress, setUploadProgress] = useState('');

    // Review/Edit state
    const [currentInvoiceId, setCurrentInvoiceId] = useState<number | null>(null);
    const [tempFilePath, setTempFilePath] = useState<string | null>(null);
    const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
    const[tempFileName, setTempFileName] = useState<string | null>(null);
    const [tempFileType, setTempFileType] = useState<string | null>(null);
    const [tempRawText, setTempRawText] = useState<string | null>(null);
    const [showDocPreview, setShowDocPreview] = useState(true);
    const [, setExtractedData] = useState<ExtractedData | null>(null);
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [headerData, setHeaderData] = useState({
        supplierName: '', invoiceNumber: '', invoiceDate: '', dueDate: '',
        totalHT: '', totalTTC: '', tva: '', supplierPhone: '', supplierAddress: ''
    });
    const [warnings, setWarnings] = useState<string[]>([]);
    const [confidenceScore, setConfidenceScore] = useState<number>(0);
    const[saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Supplier list for linking
    interface SupplierFull { id: number; name: string; address?: string; phone?: string; taxId?: string; email?: string; }
    const [suppliers, setSuppliers] = useState<SupplierFull[]>([]);
    const[selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
    const[selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<number | null>(null);
    interface PurchaseOrderOption { id: number; number: string; supplierName: string | null; supplierInvoiceId: number | null; }
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderOption[]>([]);

    // Currency state for supplier invoice
    const[supplierCurrency, setSupplierCurrency] = useState(DEFAULT_CURRENCY);
    const[supplierCurrencySymbol, setSupplierCurrencySymbol] = useState(DEFAULT_CURRENCY);

    // Payment state
    const[showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentSaving, setPaymentSaving] = useState(false);
    const[isScheduledPayment, setIsScheduledPayment] = useState(false);
    const [scheduledDate, setScheduledDate] = useState('');

    // Detail/History Modals
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailInvoice, setDetailInvoice] = useState<SupplierInvoice | null>(null);
    const [detailItems, setDetailItems] = useState<LineItem[]>([]);

    // Consistency check state
    const [showConsistencyModal, setShowConsistencyModal] = useState(false);
    const [consistencyLoading, setConsistencyLoading] = useState(false);
    const [consistencyResult, setConsistencyResult] = useState<{
        totalInvoices: number; invoicesWithIssues: number; cleanInvoices: number; issues: ConsistencyIssue[];
    } | null>(null);

    const replacePreviewFileUrl = useCallback((nextUrl: string | null) => {
        setPreviewFileUrl(prev => {
            if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
            return nextUrl;
        });
    },[]);

    // ═══════════════════════════════════════════════════════════════
    // FETCH DATA
    // ═══════════════════════════════════════════════════════════════

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
        
    }, [search]);

    // Reset pagination
    useEffect(() => {
        if (viewMode === 'archived') setArchivedPage(1);
        else setActivePage(1);
    },[debouncedSearch, viewMode, selectedYear]);

    // Counts are returned inline with the main fetch — no separate count request needed

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformInvoice = (item: any): SupplierInvoice => ({
        id: item.id,
        fileName: item.fileName || '',
        invoiceNumber: item.invoiceNumber || item.reference || '',
        invoiceDate: item.invoiceDate || item.date ? new Date(item.invoiceDate || item.date).toISOString() : null,
        dueDate: item.dueDate || null,
        totalHT: item.totalHT != null ? parseFloat(item.totalHT) : null,
        totalTTC: item.totalTTC != null ? parseFloat(item.totalTTC) : (item.amount != null ? parseFloat(item.amount) : 0),
        tva: item.tva != null ? parseFloat(item.tva) : null,
        amountPaid: item.amountPaid != null ? parseFloat(item.amountPaid) : 0,
        pendingAmount: item.pendingAmount != null ? parseFloat(item.pendingAmount) : 0,
        remainingAmount: item.remainingAmount != null ? parseFloat(item.remainingAmount) : 0,
        extractionStatus: item.extractionStatus || '',
        confidenceScore: item.confidenceScore || null,
        createdAt: item.createdAt || item.date || new Date().toISOString(),
        supplierName: item.supplierName || null,
        supplierId: item.supplierId || null,
        itemCount: item.itemCount || 0,
        paymentStatus: item.paymentStatus || 'Pending',
        paymentCount: item.paymentCount || 0,
        filePath: item.filePath || null,
        payments: item.payments ||[],
        currency: item.currency || DEFAULT_CURRENCY,
        currencySymbol: item.currencySymbol || DEFAULT_CURRENCY,
    });

    // Derive transformed data from React Query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoices = useMemo(() => (activeQuery.data?.data as any[] || []).map(transformInvoice), [activeQuery.data]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const archivedInvoices = useMemo(() => (archivedQuery.data?.data as any[] || []).map(transformInvoice), [archivedQuery.data]);

    // Auto-select latest year when years data loads
    useEffect(() => {
        if (availableYears.length > 0 && !selectedYear) {
            setSelectedYear(Math.max(...availableYears));
        }
    }, [availableYears, selectedYear]);

    useEffect(() => {
        // Fetch lookup data on mount (suppliers + purchase orders)
        Promise.all([
            api.get('/Suppliers?size=9999').then(res => {
                const data = Array.isArray(res.data) ? res.data : (res.data.data ||[]);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setSuppliers(data.map((s: any) => ({ id: s.id, name: s.name, address: s.address, phone: s.phone, taxId: s.taxId, email: s.email })));
            }).catch(() => { /* ignore */ }),
            api.get('/Inventory/purchase-orders?size=9999').then(res => {
                const data = res.data?.data || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setPurchaseOrders(data.map((po: any) => ({ id: po.id, number: po.number, supplierName: po.supplierName, supplierInvoiceId: po.supplierInvoiceId || null })));
            }).catch(() => { /* ignore */ })
        ]);
        
        // Restore Draft
        try {
            const saved = localStorage.getItem(AUTOSAVE_KEY);
            if (saved) {
                const draft = JSON.parse(saved);
                const hoursOld = (Date.now() - new Date(draft.savedAt).getTime()) / (1000 * 60 * 60);
                if (hoursOld < 24 && draft.lineItems?.length > 0) {
                    setCurrentInvoiceId(draft.currentInvoiceId);
                    setHeaderData(draft.headerData);
                    setLineItems(draft.lineItems);
                    setSelectedSupplierId(draft.selectedSupplierId);
                    setView('review');
                    setStatus({ type: 'success', message: t('supplierInvoice.draftRestored', 'Restored unsaved draft from previous session') });
                    setTimeout(() => setStatus(null), 4000);
                } else { localStorage.removeItem(AUTOSAVE_KEY); }
            }
        } catch { localStorage.removeItem(AUTOSAVE_KEY); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[]);

    // Refetch when a payment is confirmed/extended via NotificationBell
    useEffect(() => {
        const handler = () => { queryClient.invalidateQueries({ queryKey: ['supplierInvoices'] }); };
        window.addEventListener('payment-status-changed', handler);
        return () => window.removeEventListener('payment-status-changed', handler);
    },[]);

    useEffect(() => {
        return () => { if (previewFileUrl?.startsWith('blob:')) URL.revokeObjectURL(previewFileUrl); };
    }, [previewFileUrl]);

    const saveDraft = useCallback(() => {
        if (!currentInvoiceId && lineItems.length === 0) return;
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ currentInvoiceId, headerData, lineItems, selectedSupplierId, savedAt: new Date().toISOString() }));
    }, [currentInvoiceId, headerData, lineItems, selectedSupplierId]);

    useEffect(() => {
        if (view !== 'review') return;
        const timer = setTimeout(() => saveDraft(), 1000);
        return () => clearTimeout(timer);
    },[headerData, lineItems, selectedSupplierId, saveDraft, view]);

    // ═══════════════════════════════════════════════════════════════
    // UPLOAD & EXTRACT & REVIEW (unchanged robust logic)
    // ═══════════════════════════════════════════════════════════════

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedExts =['.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'];
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        if (!allowedExts.includes(ext)) { setStatus({ type: 'error', message: t('supplierInvoice.supportedFormats') }); return; }
        if (file.size > 15 * 1024 * 1024) { setStatus({ type: 'error', message: t('supplierInvoice.fileTooLarge') }); return; }

        setUploading(true);
        setUploadProgress(t('supplierInvoice.uploading'));
        setStatus(null);

        try {
            replacePreviewFileUrl(null);
            const formData = new FormData();
            formData.append('file', file);

            const isImage = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'].includes(ext);
            setUploadProgress(isImage ? t('supplierInvoice.runningOcr') : t('supplierInvoice.extracting'));

            const res = await api.post('/SupplierInvoices/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const data = res.data;
            
            setTempFilePath(data.tempFilePath);
            setTempFileName(data.fileName);
            setTempFileType(data.fileType);
            setTempRawText(data.rawExtractedText || null);

            if (data.tempFilePath) {
                try {
                    const previewRes = await api.get('/SupplierInvoices/temp-file', { params: { tempFilePath: data.tempFilePath }, responseType: 'blob' });
                    replacePreviewFileUrl(URL.createObjectURL(new Blob([previewRes.data], { type: data.fileType || 'application/pdf' })));
                } catch { replacePreviewFileUrl(null); }
            }

            setCurrentInvoiceId(null);
            setExtractedData(data.extractedData);
            setWarnings(data.warnings ||[]);
            setConfidenceScore(data.confidenceScore || 0);

            setHeaderData({
                supplierName: data.extractedData.supplierName || '',
                invoiceNumber: data.extractedData.invoiceNumber || '',
                invoiceDate: data.extractedData.invoiceDate ? new Date(data.extractedData.invoiceDate).toISOString().split('T')[0] : '',
                dueDate: data.extractedData.dueDate ? new Date(data.extractedData.dueDate).toISOString().split('T')[0] : '',
                totalHT: data.extractedData.totalHT?.toString() || '',
                totalTTC: data.extractedData.totalTTC?.toString() || '',
                tva: data.extractedData.tva?.toString() || '',
                supplierPhone: data.extractedData.phone || '',
                supplierAddress: data.extractedData.address || '',
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setLineItems((data.extractedData.lineItems ||[]).map((item: any, index: number) => ({
                id: `item-${Date.now()}-${index}`, description: item.description || '',
                quantity: item.quantity || 1, unitPrice: item.unitPrice || 0,
                taxRate: item.taxRate ?? 0.19, totalHT: item.totalHT || 0,
            })));

            setView('review');
            setStatus({ type: data.success ? 'success' : 'error', message: data.message });
        } catch (error: unknown) {
            logger.error('Upload error:', error);
            setStatus({ type: 'error', message: getErrorMessage(error, t('supplierInvoice.uploadFailed')) });
        } finally {
            setUploading(false);
            setUploadProgress('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const addLineItem = () => { setLineItems(prev =>[...prev, { id: `item-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, taxRate: 0.19, totalHT: 0 }]); };
    const updateLineItem = (id: string, field: keyof LineItem, value: string | number | boolean) => {
        setLineItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, [field]: value };
            if (field === 'quantity' || field === 'unitPrice') updated.totalHT = updated.quantity * updated.unitPrice;
            return updated;
        }));
    };
    const removeLineItem = (id: string) => { setLineItems(prev => prev.filter(item => item.id !== id)); };

    const handleConfirm = async () => {
        if (!currentInvoiceId && !tempFilePath) { setStatus({ type: 'error', message: t('supplierInvoice.noInvoiceToConfirm') }); return; }
        setSaving(true);
        setStatus(null);

        try {
            const items = lineItems.map(item => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate }));
            const finalTotalHT = headerData.totalHT ? parseFloat(headerData.totalHT) : undefined;
            const finalTVA = headerData.tva ? parseFloat(headerData.tva) : undefined;
            const finalTotalTTC = headerData.totalTTC ? parseFloat(headerData.totalTTC) : undefined;

            const payload = {
                invoiceNumber: headerData.invoiceNumber || undefined,
                invoiceDate: headerData.invoiceDate || undefined,
                dueDate: headerData.dueDate || undefined,
                totalHT: finalTotalHT, totalTTC: finalTotalTTC, tva: finalTVA,
                supplierId: selectedSupplierId || undefined,
                supplierName: !selectedSupplierId ? headerData.supplierName : undefined,
                supplierAddress: headerData.supplierAddress || undefined,
                supplierPhone: headerData.supplierPhone || undefined,
                currency: supplierCurrency || undefined,
                currencySymbol: supplierCurrencySymbol || undefined,
                purchaseOrderId: selectedPurchaseOrderId || undefined,
                items,
            };

            if (tempFilePath && !currentInvoiceId) {
                await api.post('/SupplierInvoices/confirm-new', { ...payload, tempFilePath, fileName: tempFileName, fileType: tempFileType, rawExtractedText: tempRawText, confidenceScore });
            } else {
                await api.put(`/SupplierInvoices/${currentInvoiceId}/confirm`, payload);
            }

            localStorage.removeItem(AUTOSAVE_KEY);
            setStatus({ type: 'success', message: t('supplierInvoice.confirmed', 'Supplier invoice saved!') });
            setTimeout(() => { setView('list'); resetReviewState(); }, 1500);
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['supplierInvoices'] });
        } catch (error: unknown) {
            setStatus({ type: 'error', message: getErrorMessage(error, t('supplierInvoice.saveFailed')) });
        } finally { setSaving(false); }
    };

    const handleDiscard = async () => {
        if (tempFilePath) try { await api.post('/SupplierInvoices/discard', { tempFilePath }); } catch { /* ignore */ }
        setView('list');
        resetReviewState();
        localStorage.removeItem(AUTOSAVE_KEY);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('supplierInvoice.confirmDelete'))) return;
        try {
            await deleteMutation.mutateAsync(id);
            notify('success', t('common.deleted'));
        } catch { notify('error', t('common.deleteError')); }
    };

    const resetReviewState = () => {
        setCurrentInvoiceId(null); setTempFilePath(null); replacePreviewFileUrl(null);
        setTempFileName(null); setTempFileType(null); setTempRawText(null);
        setExtractedData(null); setLineItems([]); setWarnings([]); setConfidenceScore(0);
        setSelectedSupplierId(null); setSelectedPurchaseOrderId(null); setStatus(null);
        setHeaderData({ supplierName: '', invoiceNumber: '', invoiceDate: '', dueDate: '', totalHT: '', totalTTC: '', tva: '', supplierPhone: '', supplierAddress: '' });
    };

    // ═══════════════════════════════════════════════════════════════
    // PAYMENTS & MODALS
    // ═══════════════════════════════════════════════════════════════

    const openPaymentModal = (inv: SupplierInvoice) => {
        setSelectedInvoice(inv);
        setPaymentAmount(inv.remainingAmount > 0 ? inv.remainingAmount.toFixed(3) : '');
        setPaymentNotes(''); setIsScheduledPayment(false); setScheduledDate(''); setShowPaymentModal(true);
    };

    const handleAddPayment = async () => {
        if (!selectedInvoice || !paymentAmount || paymentSaving) return;
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) { notify('warning', t('supplierInvoice.invalidPaymentAmount')); return; }
        if (isScheduledPayment && !scheduledDate) { notify('warning', t('payment.selectScheduledDate')); return; }

        setPaymentSaving(true);
        try {
            await api.post(`/SupplierInvoices/${selectedInvoice.id}/payments`, {
                amount,
                paymentDate: isScheduledPayment ? new Date(scheduledDate).toISOString() : new Date().toISOString(),
                notes: paymentNotes || undefined,
                status: isScheduledPayment ? 'Pending' : 'Completed',
            });
            setShowPaymentModal(false);
            queryClient.invalidateQueries({ queryKey: ['supplierInvoices'] });
            notify('success', isScheduledPayment ? t('payment.scheduledSuccess') : t('supplierInvoice.recordPayment'));
        } catch (error: unknown) { notify('error', getErrorMessage(error, t('supplierInvoice.paymentFailed'))); } 
        finally { setPaymentSaving(false); }
    };

    const runConsistencyCheck = async () => {
        setConsistencyLoading(true); setShowConsistencyModal(true);
        try {
            const res = await api.post('/SupplierInvoices/validate');
            setConsistencyResult(res.data);
        } catch (error: unknown) {
            setStatus({ type: 'error', message: getErrorMessage(error, t('supplierInvoice.consistencyFailed')) });
            setShowConsistencyModal(false); setConsistencyResult(null);
        } finally { setConsistencyLoading(false); }
    };

    const handleViewInvoice = async (id: number) => {
        try {
            const res = await api.get(`/SupplierInvoices/${id}`);
            const data = res.data;
            setCurrentInvoiceId(data.id);
            setHeaderData({
                supplierName: data.supplierName || '', invoiceNumber: data.invoiceNumber || '',
                invoiceDate: data.invoiceDate ? new Date(data.invoiceDate).toISOString().split('T')[0] : '',
                dueDate: data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : '',
                totalHT: data.totalHT?.toString() || '', totalTTC: data.totalTTC?.toString() || '', tva: data.tva?.toString() || '',
                supplierPhone: data.supplierPhone || '', supplierAddress: data.supplierAddress || ''
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setLineItems((data.items ||[]).map((item: any, i: number) => ({ id: `item-${Date.now()}-${i}`, ...item, taxRate: item.taxRate ?? 0.19 })));
            setSelectedSupplierId(data.supplierId); setConfidenceScore(data.confidenceScore || 0);
            setSelectedPurchaseOrderId(data.purchaseOrderId || null);
            
            replacePreviewFileUrl(null);
            if (data.filePath || data.fileName) {
                try {
                    const fileRes = await api.get(`/SupplierInvoices/${data.id}/file`, { responseType: 'blob' });
                    replacePreviewFileUrl(URL.createObjectURL(new Blob([fileRes.data], { type: data.fileType || 'application/pdf' })));
                    setTempFileName(data.fileName || 'invoice'); setTempFileType(data.fileType || 'application/pdf');
                } catch { replacePreviewFileUrl(null); }
            }
            setView('review');
        } catch { notify('error', t('supplierInvoice.loadFailed')); }
    };

    const handleViewDetail = async (id: number) => {
        try {
            const res = await api.get(`/SupplierInvoices/${id}`);
            const inv = viewMode === 'archived' ? archivedInvoices.find(i => i.id === id) : invoices.find(i => i.id === id);
            setDetailInvoice({ ...inv, ...res.data });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setDetailItems((res.data.items ||[]).map((item: any, i: number) => ({ id: `item-${Date.now()}-${i}`, ...item, taxRate: item.taxRate ?? 0.19 })));
            setShowDetailModal(true);
        } catch { notify('error', t('supplierInvoice.loadFailed')); }
    };

    // Table Filtering and Sorting Identical to InvoicesPage.tsx
    const currentList = viewMode === 'archived' ? archivedInvoices : invoices;
    const currentLoading = viewMode === 'archived' ? loadingArchive : loadingActive;

    const filteredInvoices = currentList.filter(i => {
        const numMatch = i.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ?? false;
        const fileMatch = i.fileName?.toLowerCase().includes(search.toLowerCase()) ?? false;
        const supplierMatch = i.supplierName?.toLowerCase().includes(search.toLowerCase()) ?? false;
        return numMatch || fileMatch || supplierMatch;
    });

    const sortedInvoices = [...filteredInvoices].sort((a, b) => {
        const aValue = (a.invoiceNumber || a.fileName || '').toLowerCase();
        const bValue = (b.invoiceNumber || b.fileName || '').toLowerCase();
        if (aValue === bValue) return 0;
        if (invoiceNumberSort === 'asc') return aValue > bValue ? 1 : -1;
        return aValue < bValue ? 1 : -1;
    });

    // ═══════════════════════════════════════════════════════════════
    // RENDER: LIST VIEW
    // ═══════════════════════════════════════════════════════════════

    if (view === 'list') {
        return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col gap-6">
                <NotifyBanner />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('supplierInvoice.title', 'Supplier Invoices')}</h1>
                        <p className="text-sm text-slate-500 mt-1">{t('supplierInvoice.subtitle', 'Upload PDFs or photos, extract data via OCR, and manage supplier invoices')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            onClick={runConsistencyCheck}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:bg-emerald-700 active:scale-95"
                        >
                            <ShieldCheck size={16} />
                            {t('supplierInvoice.consistencyCheck', 'Check')}
                        </motion.button>
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            onClick={() => { resetReviewState(); setView('upload'); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                            <Upload size={16} />
                            {t('supplierInvoice.upload', 'Upload Invoice')}
                        </motion.button>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute start-4 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('supplierInvoice.searchPlaceholder', 'Search by file name, invoice number, or supplier...')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full ps-11 pe-4 py-3 bg-white border border-slate-200 rounded-full focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all text-sm"
                    />
                </div>

                {/* Active / Archived Toggle */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex p-1 bg-slate-100 rounded-full">
                        <button
                            onClick={() => { setViewMode('active'); setActivePage(1); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                viewMode === 'active'
                                    ? 'bg-white shadow-sm text-purple-600'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Filter size={14} />
                            {t('supplierInvoice.activeInvoices', 'Active')} ({activeTotalCount})
                        </button>
                        {isManager && (
                            <button
                                onClick={() => { setViewMode('archived'); setArchivedPage(1); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                    viewMode === 'archived'
                                        ? 'bg-white shadow-sm text-emerald-600'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <Archive size={14} />
                                {t('quote.archived', 'Archived')} ({archivedTotalCount})
                            </button>
                        )}
                    </div>

                    {viewMode === 'archived' && availableYears.length > 0 && (
                        <div className="flex items-center gap-2">
                            <label htmlFor="year-select" className="text-sm font-medium text-slate-600">
                                {t('common.year', 'Year')}:
                            </label>
                            <select
                                id="year-select"
                                value={selectedYear || ''}
                                onChange={(e) => { setArchivedPage(1); setSelectedYear(parseInt(e.target.value)); }}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-full text-sm focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none"
                            >
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Table */}
                {currentLoading ? (
                    <div className="text-center py-20 text-slate-500">
                        <Loader2 className="animate-spin mx-auto mb-3" size={32} />
                        {t('common.loadingData', 'Loading...')}
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col p-6">
                        <div className="overflow-x-auto">
                        <table className="w-full min-w-[850px]">
                            <thead>
                                <tr>
                                    <th
                                        className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left cursor-pointer select-none"
                                        onClick={() => setInvoiceNumberSort(prev => prev === 'asc' ? 'desc' : 'asc')}
                                    >
                                        {t('supplierInvoice.invoiceNumber', 'Invoice #')} {invoiceNumberSort === 'asc' ? '↑' : '↓'}
                                    </th>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left">{t('supplierInvoice.supplier', 'Supplier')}</th>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-left">{t('invoice.date', 'Date')}</th>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-right">{t('invoice.total', 'Total TTC')}</th>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-right">{t('invoice.amountPaid', 'Paid')}</th>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-right">{t('invoice.remaining', 'Remaining')}</th>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-center">{t('common.status', 'Status')}</th>
                                    <th className="py-4 px-4 border-b border-purple-100/50 font-bold text-purple-900/50 text-[11px] uppercase tracking-widest text-right">{t('common.actions', 'Actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedInvoices.map((inv, idx) => (
                                    <motion.tr
                                        key={inv.id}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
                                    >
                                        <td className="py-3.5 px-4">
                                            <span className="font-semibold text-purple-600 whitespace-nowrap">
                                                #{inv.invoiceNumber || t('common.unknown', 'Unknown')}
                                            </span>
                                            {inv.fileName && <div className="text-xs text-slate-400 font-normal truncate max-w-[120px]">{inv.fileName}</div>}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className="text-sm text-slate-700" title={inv.supplierName || undefined}>
                                                {inv.supplierName || '—'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-sm text-slate-600">
                                            {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="py-3.5 px-4 text-right text-sm font-semibold text-slate-900">
                                            {formatCurrency(inv.totalTTC || 0, inv.currencySymbol || DEFAULT_CURRENCY)}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm text-emerald-600 font-medium">
                                                    {formatCurrency(inv.amountPaid, inv.currencySymbol || DEFAULT_CURRENCY)}
                                                </span>
                                                {(inv.pendingAmount || 0) > 0 && (
                                                    <span className="text-xs text-orange-500 flex items-center gap-1 mt-0.5" title={t('invoice.pending', 'Pending')}>
                                                        <Clock size={12} />
                                                        +{formatCurrency(inv.pendingAmount, inv.currencySymbol || DEFAULT_CURRENCY)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-right text-sm text-amber-600">
                                            {inv.remainingAmount > 0 ? formatCurrency(inv.remainingAmount, inv.currencySymbol || DEFAULT_CURRENCY) : '—'}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${getInvoiceStatusColor(inv.paymentStatus)}`}>
                                                {t(`supplierInvoice.paymentStatus.${inv.paymentStatus}`, inv.paymentStatus)}
                                            </span>
                                            {inv.paymentCount > 0 && (!inv.payments || inv.payments.length === 0) && (
                                                <div className="mt-1 text-[10px] text-slate-400 cursor-pointer hover:underline">
                                                    {inv.paymentCount} {t('supplierInvoice.payments', 'payment(s)')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center justify-end gap-0.5">
                                                {inv.paymentStatus !== 'Paid' && (
                                                    <button
                                                        onClick={() => openPaymentModal(inv)}
                                                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                                                        title={t('supplierInvoice.addPayment', 'Add Payment')}
                                                    >
                                                        <DollarSign size={15} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleViewDetail(inv.id)}
                                                    className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
                                                    title={t('common.viewDetails', 'View Details')}
                                                >
                                                    <Eye size={15} />
                                                </button>
                                                {(inv.paymentStatus === 'Pending' || inv.paymentStatus === 'Unpaid') && (
                                                    <button
                                                        onClick={() => handleViewInvoice(inv.id)}
                                                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
                                                        title={t('common.edit', 'Edit')}
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                )}
                                                {isManager && (
                                                    <button
                                                        onClick={() => handleDelete(inv.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                        title={t('common.delete', 'Delete')}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                                {sortedInvoices.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                                            {t('supplierInvoice.noInvoices', 'No supplier invoices found.')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-50/50 border-t-2 border-slate-200">
                                {(() => {
                                    const byCurrency: Record<string, { totalTTC: number; paid: number; remaining: number }> = {};
                                    currentList.forEach(inv => {
                                        const cur = inv.currencySymbol || DEFAULT_CURRENCY;
                                        if (!byCurrency[cur]) byCurrency[cur] = { totalTTC: 0, paid: 0, remaining: 0 };
                                        byCurrency[cur].totalTTC += (inv.totalTTC || 0);
                                        byCurrency[cur].paid += (inv.amountPaid || 0);
                                        byCurrency[cur].remaining += (inv.remainingAmount || 0);
                                    });
                                    const currencies = Object.keys(byCurrency);
                                    if (currencies.length === 0) return null;
                                    return currencies.map(cur => (
                                        <tr key={cur}>
                                            <td colSpan={3} className="py-3.5 px-4 font-semibold text-sm text-slate-700">
                                                {currencies.length > 1 ? `${t('common.total', 'Total')} (${cur})` : t('common.total', 'Total')}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-bold text-sm text-slate-900">
                                                {formatCurrency(byCurrency[cur].totalTTC, cur)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-semibold text-sm text-emerald-600">
                                                {formatCurrency(byCurrency[cur].paid, cur)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-semibold text-sm text-amber-600">
                                                {formatCurrency(byCurrency[cur].remaining, cur)}
                                            </td>
                                            <td className="px-4 py-3"></td>
                                            <td className="px-4 py-3"></td>
                                        </tr>
                                    ));
                                })()}
                            </tfoot>
                        </table>
                        </div>
                        
                        {!search && (
                            <Pagination
                                page={currentPage}
                                totalPages={currentTotalPages}
                                totalCount={currentTotalCount}
                                size={pageSize}
                                onPageChange={(p) => {
                                    if (viewMode === 'archived') setArchivedPage(p);
                                    else setActivePage(p);
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

                {/* Identical Payment Modal Structure */}
                {showPaymentModal && selectedInvoice && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-up">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">{t('supplierInvoice.addPayment', 'Add Payment')}</h2>
                                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                                <p className="text-sm text-gray-600">{t('supplierInvoice.supplier', 'Supplier')}: <span className="font-bold">{selectedInvoice.supplierName}</span></p>
                                <p className="text-sm text-gray-600">{t('supplierInvoice.invoiceNumber', 'Invoice #')}: <span className="font-bold">{selectedInvoice.invoiceNumber || selectedInvoice.fileName}</span></p>
                                <p className="text-sm text-gray-600 mt-2">{t('invoice.total', 'Total')}: <span className="font-bold">{formatCurrency(selectedInvoice.totalTTC || 0, selectedInvoice.currencySymbol || DEFAULT_CURRENCY)}</span></p>
                                <p className="text-sm text-gray-600">{t('invoice.alreadyPaid', 'Paid')}: <span className="font-bold text-emerald-600">{formatCurrency(selectedInvoice.amountPaid, selectedInvoice.currencySymbol || DEFAULT_CURRENCY)}</span></p>
                                {(selectedInvoice.pendingAmount || 0) > 0 && (
                                    <p className="text-sm text-gray-600">{t('invoice.pending', 'Pending')}: <span className="font-bold text-orange-500">{formatCurrency(selectedInvoice.pendingAmount, selectedInvoice.currencySymbol || DEFAULT_CURRENCY)}</span></p>
                                )}
                                <p className="text-sm text-gray-600">{t('invoice.remaining', 'Remaining')}: <span className="font-bold text-amber-600">{formatCurrency(selectedInvoice.remainingAmount, selectedInvoice.currencySymbol || DEFAULT_CURRENCY)}</span></p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setIsScheduledPayment(false)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                                            !isScheduledPayment ? 'bg-white shadow-sm text-purple-600 font-medium' : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                    >
                                        <DollarSign size={16} />
                                        {t('payment.payNow', 'Pay Now')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsScheduledPayment(true)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                                            isScheduledPayment ? 'bg-white shadow-sm text-purple-600 font-medium' : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                    >
                                        <Clock size={16} />
                                        {t('payment.scheduleLater', 'Schedule')}
                                    </button>
                                </div>

                                {isScheduledPayment && (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <label className="block text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                                            <Calendar size={16} />
                                            {t('payment.scheduledDate', 'Scheduled Date')}
                                        </label>
                                        <input
                                            type="date"
                                            value={scheduledDate}
                                            onChange={(e) => setScheduledDate(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full px-4 py-3 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white outline-none"
                                        />
                                        <p className="text-xs text-amber-700 mt-2">{t('payment.scheduledInfo', 'Payment will be marked as Pending.')}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.paymentAmount', 'Amount')} ({selectedInvoice?.currencySymbol || DEFAULT_CURRENCY})</label>
                                    <input
                                        type="number" step="0.001" min="0" max={selectedInvoice.remainingAmount}
                                        value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.notes', 'Notes')} ({t('common.optional', 'optional')})</label>
                                    <input
                                        type="text" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button
                                    onClick={handleAddPayment}
                                    disabled={paymentSaving}
                                    className={`px-6 py-2 text-white rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 ${
                                        isScheduledPayment ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                >
                                    {isScheduledPayment ? <><Clock size={16} />{t('payment.schedulePayment', 'Schedule Payment')}</> : t('invoice.addPayment', 'Add Payment')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Supplier Invoice Detail Modal (read-only) */}
                {showDetailModal && detailInvoice && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowDetailModal(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <FileText size={20} className="text-purple-600" />
                                    {t('supplierInvoice.invoiceDetails', 'Invoice Details')}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {(detailInvoice.paymentStatus === 'Pending' || detailInvoice.paymentStatus === 'Unpaid') && (
                                        <button
                                            onClick={() => { setShowDetailModal(false); handleViewInvoice(detailInvoice.id); }}
                                            className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 flex items-center gap-1"
                                        >
                                            <Edit2 size={14} /> {t('common.edit', 'Edit')}
                                        </button>
                                    )}
                                    <button onClick={() => setShowDetailModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Header info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">{t('supplierInvoice.invoiceNumber', 'Invoice #')}</p>
                                        <p className="font-semibold text-gray-900">{detailInvoice.invoiceNumber || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">{t('supplierInvoice.supplier', 'Supplier')}</p>
                                        <p className="font-semibold text-gray-900">{detailInvoice.supplierName || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">{t('common.date', 'Date')}</p>
                                        <p className="text-gray-700">{detailInvoice.invoiceDate ? new Date(detailInvoice.invoiceDate).toLocaleDateString() : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">{t('invoice.dueDate', 'Due Date')}</p>
                                        <p className="text-gray-700">{detailInvoice.dueDate ? new Date(detailInvoice.dueDate).toLocaleDateString() : '—'}</p>
                                    </div>
                                </div>
                                {/* Amounts */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-3 bg-gray-50 rounded-xl text-center">
                                        <p className="text-xs text-gray-500">{t('invoice.totalHT', 'Total HT')}</p>
                                        <p className="text-lg font-bold text-gray-900">{detailInvoice.totalHT != null ? `${detailInvoice.totalHT.toFixed(3)}` : '—'}</p>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-xl text-center">
                                        <p className="text-xs text-gray-500">{t('invoice.tax', 'TVA')}</p>
                                        <p className="text-lg font-bold text-gray-900">{detailInvoice.tva != null ? `${detailInvoice.tva.toFixed(3)}` : '—'}</p>
                                    </div>
                                    <div className="p-3 bg-purple-600/5 rounded-xl text-center">
                                        <p className="text-xs text-purple-600">{t('invoice.totalTTC', 'Total TTC')}</p>
                                        <p className="text-lg font-bold text-purple-600">{detailInvoice.totalTTC != null ? formatCurrency(detailInvoice.totalTTC, detailInvoice.currencySymbol || DEFAULT_CURRENCY) : '—'}</p>
                                    </div>
                                </div>
                                {/* Payment status */}
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getInvoiceStatusColor(detailInvoice.paymentStatus)}`}>
                                            {t(`supplierInvoice.paymentStatus.${detailInvoice.paymentStatus}`, detailInvoice.paymentStatus)}
                                        </span>
                                    </div>
                                    <div className="text-sm text-right">
                                        <span className="text-emerald-600 font-medium">{formatCurrency(detailInvoice.amountPaid, detailInvoice.currencySymbol || DEFAULT_CURRENCY)}</span>
                                        <span className="text-gray-400 mx-1">/</span>
                                        <span className="text-gray-600">{formatCurrency(detailInvoice.totalTTC || 0, detailInvoice.currencySymbol || DEFAULT_CURRENCY)}</span>
                                    </div>
                                </div>
                                {/* Linked Purchase Order */}
                                {detailInvoice.purchaseOrderNumber && (
                                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-blue-600" />
                                            <span className="text-sm font-medium text-blue-800">{t('inventory.linkedPurchaseOrder', 'Linked Purchase Order')}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-blue-700">{detailInvoice.purchaseOrderNumber}</span>
                                    </div>
                                )}
                                {/* Line items */}
                                {detailItems.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('invoice.items', 'Line Items')}</h4>
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs text-gray-500">{t('invoice.description', 'Description')}</th>
                                                    <th className="px-3 py-2 text-right text-xs text-gray-500">{t('invoice.qty', 'Qty')}</th>
                                                    <th className="px-3 py-2 text-right text-xs text-gray-500">{t('invoice.unitPrice', 'Unit Price')}</th>
                                                    <th className="px-3 py-2 text-right text-xs text-gray-500">{t('invoice.totalHT', 'Total HT')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {detailItems.map(item => (
                                                    <tr key={item.id}>
                                                        <td className="px-3 py-2 text-left text-gray-900">{item.description || '—'}</td>
                                                        <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                                                        <td className="px-3 py-2 text-right text-gray-600">{item.unitPrice.toFixed(3)}</td>
                                                        <td className="px-3 py-2 text-right font-medium text-gray-900">{item.totalHT.toFixed(3)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {/* Payments */}
                                {detailInvoice.payments && detailInvoice.payments.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('supplierInvoice.payments', 'Payments')}</h4>
                                        <div className="space-y-2">
                                            {detailInvoice.payments.map((p, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span>{p.status === 'Pending' ? '⏰' : '💵'}</span>
                                                        <div className="flex flex-col">
                                                            <span className="text-gray-600">{new Date(p.paymentDate).toLocaleDateString()}</span>
                                                            {p.ConfirmedBy && <span className="text-[10px] text-gray-500">{t('common.confirmedBy', 'Confirmed by')} {p.ConfirmedBy}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                                            {p.status}
                                                        </span>
                                                        <span className="font-medium text-gray-900">{formatCurrency(p.amount, detailInvoice.currencySymbol || DEFAULT_CURRENCY)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {/* Consistency Check Modal */}
                {showConsistencyModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConsistencyModal(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                        <ShieldCheck size={20} className="mr-2 text-amber-600" />
                                        {t('supplierInvoice.consistencyReport', 'Consistency Report')}
                                    </h3>
                                    <button onClick={() => setShowConsistencyModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                                {consistencyLoading ? (
                                    <div className="text-center py-12">
                                        <Loader2 size={32} className="animate-spin mx-auto text-purple-600 mb-3" />
                                        <p className="text-gray-500">{t('supplierInvoice.runningCheck', 'Running consistency check...')}</p>
                                    </div>
                                ) : consistencyResult ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                                <div className="text-2xl font-bold text-gray-900">{consistencyResult.totalInvoices}</div>
                                                <div className="text-xs text-gray-500">{t('supplierInvoice.totalInvoices', 'Total Invoices')}</div>
                                            </div>
                                            <div className="bg-emerald-50 rounded-xl p-4 text-center">
                                                <div className="text-2xl font-bold text-emerald-600">{consistencyResult.cleanInvoices}</div>
                                                <div className="text-xs text-emerald-600">{t('supplierInvoice.cleanInvoices', 'Clean')}</div>
                                            </div>
                                            <div className="bg-amber-50 rounded-xl p-4 text-center">
                                                <div className="text-2xl font-bold text-amber-600">{consistencyResult.invoicesWithIssues}</div>
                                                <div className="text-xs text-amber-600">{t('supplierInvoice.withIssues', 'With Issues')}</div>
                                            </div>
                                        </div>

                                        {consistencyResult.issues.length === 0 ? (
                                            <div className="text-center py-8 bg-emerald-50 rounded-xl">
                                                <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
                                                <p className="text-emerald-700 font-medium">{t('supplierInvoice.allClean', 'All invoices pass consistency checks!')}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {consistencyResult.issues.map((issue, i) => (
                                                    <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="font-medium text-gray-900">
                                                                {issue.invoiceNumber || `#${issue.invoiceId}`}
                                                                <span className="text-gray-500 text-sm ml-2">— {issue.supplierName}</span>
                                                            </span>
                                                            <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                                                                {issue.issueCount} {t('supplierInvoice.issues', 'issue(s)')}
                                                            </span>
                                                        </div>
                                                        <ul className="list-disc ml-5 text-sm text-amber-700 space-y-0.5">
                                                            {issue.issues.map((msg, j) => <li key={j}>{msg}</li>)}
                                                        </ul>
                                                        <button
                                                            onClick={() => { setShowConsistencyModal(false); handleViewInvoice(issue.invoiceId); }}
                                                            className="mt-2 text-xs text-purple-600 hover:text-purple-600 font-medium"
                                                        >
                                                            {t('supplierInvoice.fixNow', 'Fix now →')}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER: UPLOAD VIEW
    // ═══════════════════════════════════════════════════════════════

    if (view === 'upload') {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{t('supplierInvoice.uploadTitle', 'Upload Supplier Invoice')}</h1>
                        <p className="text-gray-500 mt-1">{t('supplierInvoice.uploadDesc', 'Upload a PDF to automatically extract invoice data')}</p>
                    </div>
                </div>

                {status && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${
                        status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                        {status.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                        <span>{status.message}</span>
                    </div>
                )}

                <div
                    className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                        uploading ? 'border-purple-600 bg-purple-600/5' : 'border-gray-300 hover:border-purple-600 hover:bg-purple-600/5 cursor-pointer'
                    }`}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                >
                    <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.bmp,.tiff,.tif,.webp,image/*" onChange={handleFileUpload} className="hidden" />

                    {uploading ? (
                        <div className="space-y-4">
                            <Loader2 size={48} className="mx-auto text-purple-600 animate-spin" />
                            <p className="text-lg font-medium text-purple-600">{uploadProgress}</p>
                            <div className="w-64 mx-auto bg-purple-600/20 rounded-full h-2">
                                <div className="bg-purple-600 h-2 rounded-full animate-pulse w-3/4"></div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="w-20 h-20 mx-auto bg-purple-600/10 rounded-2xl flex items-center justify-center">
                                <Upload size={40} className="text-purple-600" />
                            </div>
                            <div>
                                <p className="text-lg font-semibold text-gray-700">{t('supplierInvoice.dropHere', 'Drop your PDF or photo here, or click to browse')}</p>
                                <p className="text-sm text-gray-400 mt-1">{t('supplierInvoice.maxFileSize', 'Max file size: 15MB. Supported: PDF, JPG, PNG, BMP, TIFF, WebP')}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h3 className="font-semibold text-blue-800 mb-3">{t('supplierInvoice.howItWorks', 'How Smart Extraction Works')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex gap-3">
                            <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold flex-shrink-0">1</div>
                            <div>
                                <p className="font-medium text-blue-800">{t('supplierInvoice.step1Title', 'Upload PDF or Photo')}</p>
                                <p className="text-sm text-blue-600">{t('supplierInvoice.step1Desc', 'Upload a PDF or take a photo of the invoice')}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold flex-shrink-0">2</div>
                            <div>
                                <p className="font-medium text-blue-800">{t('supplierInvoice.step2Title', 'Review & Edit')}</p>
                                <p className="text-sm text-blue-600">{t('supplierInvoice.step2Desc', 'Verify extracted data, fix any errors')}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold flex-shrink-0">3</div>
                            <div>
                                <p className="font-medium text-blue-800">{t('supplierInvoice.step3Title', 'Confirm & Save')}</p>
                                <p className="text-sm text-blue-600">{t('supplierInvoice.step3Desc', 'Confirm to save invoice with line items')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER: REVIEW & EDIT VIEW
    // ═══════════════════════════════════════════════════════════════

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={handleDiscard} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{t('supplierInvoice.reviewTitle', 'Review Extracted Data')}</h1>
                        <p className="text-gray-500 mt-1">
                            {t('supplierInvoice.verifyExtracted', 'Verify and correct the extracted information before saving')}
                            {confidenceScore > 0 && (
                                <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                    confidenceScore >= 0.7 ? 'bg-emerald-100 text-emerald-700' :
                                    confidenceScore >= 0.4 ? 'bg-amber-100 text-amber-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    {Math.round(confidenceScore * 100)}% {t('supplierInvoice.confidence', 'confidence')}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleDiscard} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200">
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button onClick={handleConfirm} disabled={saving} className="flex items-center px-6 py-2 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50">
                        {saving ? <><Loader2 size={18} className="me-2 animate-spin" />{t('common.saving', 'Saving...')}</> : <><CheckCircle size={18} className="me-2" />{t('supplierInvoice.confirmSave', 'Confirm & Save')}</>}
                    </button>
                </div>
            </div>

            {status && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${
                    status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                    {status.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                    <span>{status.message}</span>
                    <button onClick={() => setStatus(null)} className="ml-auto"><X size={16} /></button>
                </div>
            )}

            {warnings.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="font-semibold text-amber-800">{t('supplierInvoice.warnings', 'Extraction Warnings')}</p>
                            <ul className="mt-1 list-disc ml-4 text-sm text-amber-700">
                                {warnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            <div className="text-xs text-gray-400 text-right">
                <Save size={12} className="inline me-1" />
                {t('supplierInvoice.autoSaved', 'Draft auto-saved to browser')}
            </div>

            <div className={`flex gap-6 ${previewFileUrl ? 'flex-col lg:flex-row' : ''}`}>
                {previewFileUrl && (
                    <div className={`${showDocPreview ? 'lg:w-1/2' : 'lg:w-auto'} flex-shrink-0`}>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-100">
                                <span className="text-sm font-medium text-gray-700 flex items-center">
                                    <Eye size={16} className="me-2 text-purple-600" />
                                    {t('supplierInvoice.documentPreview', 'Document Preview')}
                                </span>
                                <button onClick={() => setShowDocPreview(!showDocPreview)} className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300">
                                    {showDocPreview ? t('common.hide', 'Hide') : t('common.show', 'Show')}
                                </button>
                            </div>
                            {showDocPreview && (
                                <div className="p-2">
                                    {tempFileType?.startsWith('image/') ? (
                                        <img src={previewFileUrl || ''} alt={tempFileName || 'Uploaded document'} className="w-full rounded-lg object-contain max-h-[70vh]" />
                                    ) : (
                                        <iframe src={previewFileUrl || ''} className="w-full rounded-lg border-0" style={{ height: '70vh' }} title={tempFileName || 'PDF Preview'} />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex-1 space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <FileText size={20} className="me-2 text-purple-600" />
                            {t('supplierInvoice.invoiceDetails', 'Invoice Details')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplierInvoice.supplier', 'Supplier')}</label>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedSupplierId || ''}
                                        onChange={e => {
                                            const val = e.target.value ? parseInt(e.target.value) : null;
                                            setSelectedSupplierId(val);
                                            setSelectedPurchaseOrderId(null);
                                            if (val) {
                                                const s = suppliers.find(sup => sup.id === val);
                                                if (s) setHeaderData(prev => ({ ...prev, supplierName: s.name, supplierAddress: s.address || prev.supplierAddress, supplierPhone: s.phone || prev.supplierPhone }));
                                            }
                                        }}
                                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="">-- {t('supplierInvoice.selectSupplier', 'Select existing or create new')} --</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                {!selectedSupplierId && (
                                    <input
                                        type="text" value={headerData.supplierName} onChange={e => setHeaderData(prev => ({ ...prev, supplierName: e.target.value }))}
                                        placeholder={t('supplierInvoice.newSupplierName', 'Or type new supplier name')}
                                        className="w-full mt-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.linkPurchaseOrder', 'Link Purchase Order')}</label>
                                <select
                                    value={selectedPurchaseOrderId || ''}
                                    onChange={e => setSelectedPurchaseOrderId(e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                >
                                    <option value="">— {t('inventory.nonePO', 'None')} —</option>
                                    {purchaseOrders.filter(po => {
                                        // Always show the PO currently linked to this invoice
                                        if (currentInvoiceId && po.supplierInvoiceId === currentInvoiceId) return true;
                                        // Hide POs linked to other invoices
                                        if (po.supplierInvoiceId) return false;
                                        // Filter by selected supplier
                                        if (!selectedSupplierId) return true;
                                        const supplier = suppliers.find(s => s.id === selectedSupplierId);
                                        return supplier && po.supplierName === supplier.name;
                                    }).map(po => <option key={po.id} value={po.id}>{po.number} ({po.supplierName})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplierInvoice.invoiceNumber', 'Invoice Number')}</label>
                                <input type="text" value={headerData.invoiceNumber} onChange={e => setHeaderData(prev => ({ ...prev, invoiceNumber: e.target.value }))} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplierInvoice.invoiceDate', 'Invoice Date')}</label>
                                <input type="date" value={headerData.invoiceDate} onChange={e => setHeaderData(prev => ({ ...prev, invoiceDate: e.target.value }))} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                    <Calendar size={14} className="me-1 text-gray-400" />
                                    {t('supplierInvoice.dueDate', 'Due Date')}
                                </label>
                                <input type="date" value={headerData.dueDate} onChange={e => setHeaderData(prev => ({ ...prev, dueDate: e.target.value }))} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">📞 {t('common.phone', 'Phone')}</label>
                                <input type="text" value={headerData.supplierPhone} onChange={e => setHeaderData(prev => ({ ...prev, supplierPhone: e.target.value }))} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">📍 {t('common.address', 'Address')}</label>
                                <input type="text" value={headerData.supplierAddress} onChange={e => setHeaderData(prev => ({ ...prev, supplierAddress: e.target.value }))} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplierInvoice.documentCurrency', 'Document Currency')}</label>
                                <select
                                    value={supplierCurrency}
                                    onChange={e => { setSupplierCurrency(e.target.value); setSupplierCurrencySymbol(getCurrencySymbol(e.target.value)); }}
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                >
                                    {CURRENCY_OPTIONS.map(opt => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-blue-600 mb-1">{t('invoice.totalHT', 'Subtotal HT')}</label>
                                    <input type="number" step="0.001" value={headerData.totalHT} onChange={e => setHeaderData(prev => ({ ...prev, totalHT: e.target.value }))} className="w-full px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold text-blue-800 text-center" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-amber-600 mb-1">TVA</label>
                                    <input type="number" step="0.001" value={headerData.tva} onChange={e => setHeaderData(prev => ({ ...prev, tva: e.target.value }))} className="w-full px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-lg font-bold text-amber-800 text-center" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-emerald-600 mb-1">{t('invoice.totalTTC', 'Total TTC')}</label>
                                    <input type="number" step="0.001" value={headerData.totalTTC} onChange={e => setHeaderData(prev => ({ ...prev, totalTTC: e.target.value }))} className="w-full px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-bold text-emerald-800 text-center" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                <Edit2 size={20} className="me-2 text-purple-600" />
                                {t('supplierInvoice.lineItems', 'Line Items')}
                            </h3>
                            <button onClick={addLineItem} className="flex items-center px-3 py-1.5 bg-purple-600/5 text-purple-600 rounded-lg hover:bg-purple-600/10 transition-colors text-sm font-medium">
                                <Plus size={16} className="me-1" />
                                {t('supplierInvoice.addItem', 'Add Item')}
                            </button>
                        </div>

                        {lineItems.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <p className="text-gray-500">{t('supplierInvoice.noLineItems', 'No line items extracted.')}</p>
                                <button onClick={addLineItem} className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                                    {t('supplierInvoice.addFirstItem', 'Add First Item')}
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase w-2/5">{t('invoice.description', 'Description')}</th>
                                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-16">{t('invoice.qty', 'Qty')}</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-28">{t('invoice.unitPrice', 'Unit Price')}</th>
                                            <th className="px-3 py-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {lineItems.map(item => (
                                            <tr key={item.id} className="group hover:bg-gray-50">
                                                <td className="px-3 py-2 text-left">
                                                    <input type="text" value={item.description} onChange={e => updateLineItem(item.id, 'description', e.target.value)} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-gray-300 focus:border-purple-600 rounded focus:ring-1 focus:ring-purple-500 outline-none text-sm" />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <input type="number" min="1" value={item.quantity} onChange={e => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-gray-300 focus:border-purple-600 rounded focus:ring-1 focus:ring-purple-500 outline-none text-sm text-center" />
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <input type="number" step="0.001" value={item.unitPrice} onChange={e => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-gray-300 focus:border-purple-600 rounded focus:ring-1 focus:ring-purple-500 outline-none text-sm text-right" />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <button onClick={() => removeLineItem(item.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-6 px-6 rounded-b-2xl flex justify-between items-center shadow-lg">
                <div className="text-sm text-gray-500">
                    {lineItems.length} {t('supplierInvoice.itemsCount', 'item(s)')} | {t('common.total', 'Total')}: <span className="font-bold text-purple-600">{formatCurrency(parseFloat(headerData.totalTTC) || 0, supplierCurrencySymbol || DEFAULT_CURRENCY)}</span>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleDiscard} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200">{t('common.discard', 'Discard')}</button>
                    <button onClick={handleConfirm} disabled={saving} className="flex items-center px-6 py-2 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50">
                        {saving ? <><Loader2 size={18} className="me-2 animate-spin" />{t('common.saving', 'Saving...')}</> : <><CheckCircle size={18} className="me-2" />{t('supplierInvoice.confirmSave', 'Confirm & Save')}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

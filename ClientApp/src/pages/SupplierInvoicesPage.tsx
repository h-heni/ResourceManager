import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Upload, FileText, Loader2, CheckCircle, AlertTriangle, Trash2,
    Plus, Save, ArrowLeft, Eye, X, Edit2, Search, DollarSign, ShieldCheck, Calendar,
    Archive, Clock
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface LineItem {
    id: string; // client-side ID for keying
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    totalHT: number;
}

interface ExtractedData {
    fournisseurName: string;
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
    fournisseurName: string | null;
    fournisseurId: number | null;
    itemCount: number;
    amountPaid: number;
    pendingAmount: number;
    remainingAmount: number;
    paymentStatus: string;
    paymentCount: number;
    filePath: string | null;
    isDeleted?: boolean;
    payments: SupplierPayment[];
}

interface ConsistencyIssue {
    invoiceId: number;
    invoiceNumber: string;
    supplierName: string;
    issueCount: number;
    issues: string[];
}

interface Supplier {
    id: number;
    name: string;
}

// localStorage key
const AUTOSAVE_KEY = 'supplier-invoice-draft';

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SupplierInvoicesPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isManager = user?.roles?.includes('Manager') || user?.roles?.includes('SuperAdmin') || user?.roles?.includes('FreeUser');

    // View state
    const [view, setView] = useState<'list' | 'upload' | 'review'>('list');

    // List state
    const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

    // Review/Edit state
    const [currentInvoiceId, setCurrentInvoiceId] = useState<number | null>(null);
    const [tempFilePath, setTempFilePath] = useState<string | null>(null);
    const [tempFileName, setTempFileName] = useState<string | null>(null);
    const [tempFileType, setTempFileType] = useState<string | null>(null);
    const [tempRawText, setTempRawText] = useState<string | null>(null);
    const [showDocPreview, setShowDocPreview] = useState(true);
    const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [headerData, setHeaderData] = useState({
        fournisseurName: '',
        invoiceNumber: '',
        invoiceDate: '',
        dueDate: '',
        totalHT: '',
        totalTTC: '',
        tva: '',
        fournisseurPhone: '',
        fournisseurAddress: '',
    });
    const [warnings, setWarnings] = useState<string[]>([]);
    const [confidenceScore, setConfidenceScore] = useState<number>(0);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Supplier list for linking
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);

    // Payment state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentSaving, setPaymentSaving] = useState(false);
    const [isScheduledPayment, setIsScheduledPayment] = useState(false);
    const [scheduledDate, setScheduledDate] = useState('');

    // Payment history modal
    const [showPaymentHistory, setShowPaymentHistory] = useState(false);
    const [historyInvoice, setHistoryInvoice] = useState<SupplierInvoice | null>(null);

    // Consistency check state
    const [showConsistencyModal, setShowConsistencyModal] = useState(false);
    const [consistencyLoading, setConsistencyLoading] = useState(false);
    const [consistencyResult, setConsistencyResult] = useState<{
        totalInvoices: number;
        invoicesWithIssues: number;
        cleanInvoices: number;
        issues: ConsistencyIssue[];
    } | null>(null);

    // List view tab (active vs paid)
    const [activeTab, setActiveTab] = useState<'active' | 'paid'>('active');

    // ═══════════════════════════════════════════════════════════════
    // FETCH DATA
    // ═══════════════════════════════════════════════════════════════

    useEffect(() => {
        fetchInvoices();
        fetchSuppliers();
        restoreDraft();
    }, []);

    const fetchInvoices = async () => {
        try {
            const res = await api.get('/SupplierInvoices');
            const data = res.data.data || [];
            setInvoices(data);
        } catch (error) {
            console.error('Error fetching supplier invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const res = await api.get('/Fournisseurs');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setSuppliers(data.map((s: any) => ({ id: s.id, name: s.name })));
        } catch {
            // Non-critical
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // AUTO-SAVE (localStorage)
    // ═══════════════════════════════════════════════════════════════

    const saveDraft = useCallback(() => {
        if (!currentInvoiceId && lineItems.length === 0) return;
        const draft = {
            currentInvoiceId,
            headerData,
            lineItems,
            selectedSupplierId,
            savedAt: new Date().toISOString(),
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
    }, [currentInvoiceId, headerData, lineItems, selectedSupplierId]);

    const restoreDraft = () => {
        try {
            const saved = localStorage.getItem(AUTOSAVE_KEY);
            if (saved) {
                const draft = JSON.parse(saved);
                // Only restore if less than 24 hours old
                const savedAt = new Date(draft.savedAt);
                const hoursOld = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
                if (hoursOld < 24 && draft.lineItems?.length > 0) {
                    setCurrentInvoiceId(draft.currentInvoiceId);
                    setHeaderData(draft.headerData);
                    setLineItems(draft.lineItems);
                    setSelectedSupplierId(draft.selectedSupplierId);
                    setView('review');
                    setStatus({ type: 'success', message: t('supplierInvoice.draftRestored', 'Restored unsaved draft from previous session') });
                    setTimeout(() => setStatus(null), 4000);
                } else {
                    localStorage.removeItem(AUTOSAVE_KEY);
                }
            }
        } catch {
            localStorage.removeItem(AUTOSAVE_KEY);
        }
    };

    const clearDraft = () => {
        localStorage.removeItem(AUTOSAVE_KEY);
    };

    // Auto-save on changes (debounced)
    useEffect(() => {
        if (view !== 'review') return;
        const timer = setTimeout(() => saveDraft(), 1000);
        return () => clearTimeout(timer);
    }, [headerData, lineItems, selectedSupplierId, saveDraft, view]);

    // ═══════════════════════════════════════════════════════════════
    // UPLOAD & EXTRACT
    // ═══════════════════════════════════════════════════════════════

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'];
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        if (!allowedExts.includes(ext)) {
            setStatus({ type: 'error', message: t('supplierInvoice.supportedFormats', 'Supported formats: PDF, JPG, PNG, BMP, TIFF, WebP') });
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            setStatus({ type: 'error', message: t('supplierInvoice.fileTooLarge', 'File size exceeds 15MB limit') });
            return;
        }

        setUploading(true);
        setUploadProgress(t('supplierInvoice.uploading', 'Uploading PDF...'));
        setStatus(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const isImage = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'].includes(ext);
            setUploadProgress(isImage ? t('supplierInvoice.runningOcr', 'Running OCR on image...') : t('supplierInvoice.extracting', 'Extracting data from PDF...'));

            const res = await api.post('/SupplierInvoices/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const data = res.data;
            setTempFilePath(data.tempFilePath);
            setTempFileName(data.fileName);
            setTempFileType(data.fileType);
            setTempRawText(data.rawExtractedText || null);
            setCurrentInvoiceId(null); // Not persisted yet
            setExtractedData(data.extractedData);
            setWarnings(data.warnings || []);
            setConfidenceScore(data.confidenceScore || 0);

            // Populate header data
            setHeaderData({
                fournisseurName: data.extractedData.fournisseurName || '',
                invoiceNumber: data.extractedData.invoiceNumber || '',
                invoiceDate: data.extractedData.invoiceDate
                    ? new Date(data.extractedData.invoiceDate).toISOString().split('T')[0]
                    : '',
                dueDate: data.extractedData.dueDate
                    ? new Date(data.extractedData.dueDate).toISOString().split('T')[0]
                    : '',
                totalHT: data.extractedData.totalHT?.toString() || '',
                totalTTC: data.extractedData.totalTTC?.toString() || '',
                tva: data.extractedData.tva?.toString() || '',
                fournisseurPhone: data.extractedData.phone || '',
                fournisseurAddress: data.extractedData.address || '',
            });

            // Populate line items
            const items: LineItem[] = (data.extractedData.lineItems || []).map(
                (item: any, index: number) => ({
                    id: `item-${Date.now()}-${index}`,
                    description: item.description || '',
                    quantity: item.quantity || 1,
                    unitPrice: item.unitPrice || 0,
                    taxRate: item.taxRate ?? 0.19,
                    totalHT: item.totalHT || 0,
                })
            );
            setLineItems(items);

            setView('review');
            setStatus({
                type: data.success ? 'success' : 'error',
                message: data.message,
            });
        } catch (error: any) {
            console.error('Upload error:', error);
            setStatus({
                type: 'error',
                message: error.response?.data?.message || t('supplierInvoice.uploadFailed', 'Failed to upload and extract PDF'),
            });
        } finally {
            setUploading(false);
            setUploadProgress('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // LINE ITEM OPERATIONS
    // ═══════════════════════════════════════════════════════════════

    const addLineItem = () => {
        setLineItems(prev => [
            ...prev,
            {
                id: `item-${Date.now()}`,
                description: '',
                quantity: 1,
                unitPrice: 0,
                taxRate: 0.19,
                totalHT: 0,
            },
        ]);
    };

    const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
        setLineItems(prev =>
            prev.map(item => {
                if (item.id !== id) return item;
                const updated = { ...item, [field]: value };
                // Recalculate totalHT
                if (field === 'quantity' || field === 'unitPrice') {
                    updated.totalHT = updated.quantity * updated.unitPrice;
                }
                return updated;
            })
        );
    };

    const removeLineItem = (id: string) => {
        setLineItems(prev => prev.filter(item => item.id !== id));
    };

    // ═══════════════════════════════════════════════════════════════
    // CONFIRM & SAVE
    // ═══════════════════════════════════════════════════════════════

    const handleConfirm = async () => {
        if (!currentInvoiceId && !tempFilePath) {
            setStatus({ type: 'error', message: t('supplierInvoice.noInvoiceToConfirm', 'No invoice to confirm') });
            return;
        }

        setSaving(true);
        setStatus(null);

        try {
            const items = lineItems.map(item => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate,
            }));

            // Use computed totals from line items when items exist, otherwise fall back to header
            const finalTotalHT = items.length > 0 ? computedTotalHT : (headerData.totalHT ? parseFloat(headerData.totalHT) : undefined);
            const finalTVA = items.length > 0 ? computedTVA : (headerData.tva ? parseFloat(headerData.tva) : undefined);
            const finalTotalTTC = items.length > 0 ? computedTotalTTC : (headerData.totalTTC ? parseFloat(headerData.totalTTC) : undefined);

            if (tempFilePath && !currentInvoiceId) {
                // ── NEW upload: create record for the first time ──
                const payload = {
                    tempFilePath,
                    fileName: tempFileName,
                    fileType: tempFileType,
                    rawExtractedText: tempRawText,
                    confidenceScore,
                    invoiceNumber: headerData.invoiceNumber || undefined,
                    invoiceDate: headerData.invoiceDate || undefined,
                    dueDate: headerData.dueDate || undefined,
                    totalHT: finalTotalHT,
                    totalTTC: finalTotalTTC,
                    tva: finalTVA,
                    fournisseurId: selectedSupplierId || undefined,
                    fournisseurName: !selectedSupplierId ? headerData.fournisseurName : undefined,
                    fournisseurAddress: headerData.fournisseurAddress || undefined,
                    fournisseurPhone: headerData.fournisseurPhone || undefined,
                    items,
                };
                await api.post('/SupplierInvoices/confirm-new', payload);
            } else {
                // ── Existing invoice: update ──
                const payload = {
                    invoiceNumber: headerData.invoiceNumber || undefined,
                    invoiceDate: headerData.invoiceDate || undefined,
                    dueDate: headerData.dueDate || undefined,
                    totalHT: finalTotalHT,
                    totalTTC: finalTotalTTC,
                    tva: finalTVA,
                    fournisseurId: selectedSupplierId || undefined,
                    fournisseurName: !selectedSupplierId ? headerData.fournisseurName : undefined,
                    fournisseurAddress: headerData.fournisseurAddress || undefined,
                    fournisseurPhone: headerData.fournisseurPhone || undefined,
                    items,
                };
                await api.put(`/SupplierInvoices/${currentInvoiceId}/confirm`, payload);
            }

            clearDraft();
            setStatus({ type: 'success', message: t('supplierInvoice.confirmed', 'Supplier invoice confirmed and saved!') });

            // Refresh and go back to list after delay
            setTimeout(() => {
                setView('list');
                fetchInvoices();
                resetReviewState();
            }, 1500);
        } catch (error: any) {
            console.error('Confirm error:', error);
            setStatus({
                type: 'error',
                message: error.response?.data?.message || t('supplierInvoice.saveFailed', 'Failed to save supplier invoice'),
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = async () => {
        // If we have a temp file (new upload not yet confirmed), clean it up
        if (tempFilePath) {
            try {
                await api.post('/SupplierInvoices/discard', { tempFilePath });
            } catch {
                // Non-critical, file will be orphaned but that's OK
            }
        }
        setView('list');
        resetReviewState();
        clearDraft();
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('supplierInvoice.confirmDelete', 'Are you sure you want to delete this supplier invoice?'))) return;
        try {
            await api.delete(`/SupplierInvoices/${id}`);
            fetchInvoices();
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    const resetReviewState = () => {
        setCurrentInvoiceId(null);
        setTempFilePath(null);
        setTempFileName(null);
        setTempFileType(null);
        setTempRawText(null);
        setExtractedData(null);
        setLineItems([]);
        setHeaderData({
            fournisseurName: '',
            invoiceNumber: '',
            invoiceDate: '',
            dueDate: '',
            totalHT: '',
            totalTTC: '',
            tva: '',
            fournisseurPhone: '',
            fournisseurAddress: '',
        });
        setWarnings([]);
        setConfidenceScore(0);
        setSelectedSupplierId(null);
        setStatus(null);
    };

    // ═══════════════════════════════════════════════════════════════
    // PAYMENT HANDLERS
    // ═══════════════════════════════════════════════════════════════

    const openPaymentModal = (inv: SupplierInvoice) => {
        setSelectedInvoice(inv);
        setPaymentAmount(inv.remainingAmount > 0 ? inv.remainingAmount.toFixed(3) : '');
        setPaymentNotes('');
        setIsScheduledPayment(false);
        setScheduledDate('');
        setShowPaymentModal(true);
    };

    const handleAddPayment = async () => {
        if (!selectedInvoice) return;
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            setStatus({ type: 'error', message: t('supplierInvoice.invalidPaymentAmount', 'Enter a valid payment amount') });
            return;
        }

        if (isScheduledPayment && !scheduledDate) {
            alert(t('payment.selectScheduledDate', 'Please select a scheduled date'));
            return;
        }

        setPaymentSaving(true);
        try {
            const paymentDate = isScheduledPayment
                ? new Date(scheduledDate).toISOString()
                : new Date().toISOString();

            await api.post(`/SupplierInvoices/${selectedInvoice.id}/payments`, {
                amount,
                paymentDate,
                notes: paymentNotes || undefined,
                status: isScheduledPayment ? 'Pending' : 'Completed',
            });
            setShowPaymentModal(false);
            setSelectedInvoice(null);
            setPaymentAmount('');
            setPaymentNotes('');
            setIsScheduledPayment(false);
            setScheduledDate('');
            fetchInvoices();
            setStatus({ type: 'success', message: isScheduledPayment ? '⏰ Payment scheduled!' : '💵 Payment recorded!' });
            setTimeout(() => setStatus(null), 3000);
        } catch (error: any) {
            setStatus({
                type: 'error',
                message: error.response?.data?.message || t('supplierInvoice.paymentFailed', 'Failed to record payment'),
            });
        } finally {
            setPaymentSaving(false);
        }
    };

    const openPaymentHistory = (inv: SupplierInvoice) => {
        setHistoryInvoice(inv);
        setShowPaymentHistory(true);
    };

    const handleArchive = async (id: number) => {
        if (!confirm('Archive this invoice? It will be moved to the Paid tab.')) return;
        try {
            // Mark as fully paid to archive
            const inv = invoices.find(i => i.id === id);
            if (inv && inv.remainingAmount > 0) {
                await api.post(`/SupplierInvoices/${id}/payments`, {
                    amount: inv.remainingAmount,
                    paymentDate: new Date().toISOString(),
                    notes: 'Archived - marked as paid',
                    status: 'Completed',
                });
            }
            fetchInvoices();
            setStatus({ type: 'success', message: '📦 Invoice archived' });
            setTimeout(() => setStatus(null), 3000);
        } catch (error: any) {
            setStatus({ type: 'error', message: 'Failed to archive invoice' });
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // CONSISTENCY CHECK
    // ═══════════════════════════════════════════════════════════════

    const runConsistencyCheck = async () => {
        setConsistencyLoading(true);
        setShowConsistencyModal(true);
        try {
            const res = await api.post('/SupplierInvoices/validate');
            setConsistencyResult(res.data);
        } catch (error: any) {
            setStatus({
                type: 'error',
                message: error.response?.data?.message || t('supplierInvoice.consistencyFailed', 'Consistency check failed'),
            });
            setShowConsistencyModal(false);
        } finally {
            setConsistencyLoading(false);
        }
    };

    const getPaymentStatusColor = (status: string) => {
        switch (status) {
            case 'Paid': return 'bg-emerald-100 text-emerald-700';
            case 'PartiallyPaid': return 'bg-blue-100 text-blue-700';
            case 'Unpaid': return 'bg-amber-100 text-amber-700';
            case 'Pending': return 'bg-orange-100 text-orange-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getPaymentStatusEmoji = (status: string) => {
        switch (status) {
            case 'Paid': return '✅';
            case 'PartiallyPaid': return '🔶';
            case 'Unpaid': return '🔴';
            case 'Pending': return '⏳';
            default: return '❔';
        }
    };

    // Computed totals from line items
    const computedTotalHT = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const computedTVA = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice * item.taxRate, 0);
    const computedTotalTTC = computedTotalHT + computedTVA;

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = (inv.fileName?.toLowerCase() || '').includes(search.toLowerCase()) ||
            (inv.invoiceNumber?.toLowerCase() || '').includes(search.toLowerCase()) ||
            (inv.fournisseurName?.toLowerCase() || '').includes(search.toLowerCase());
        const matchesTab = activeTab === 'active'
            ? inv.paymentStatus !== 'Paid'
            : inv.paymentStatus === 'Paid';
        return matchesSearch && matchesTab;
    });

    // ═══════════════════════════════════════════════════════════════
    // VIEW EXISTING INVOICE (must be before list view return)
    // ═══════════════════════════════════════════════════════════════
    
    const handleViewInvoice = async (id: number) => {
        try {
            const res = await api.get(`/SupplierInvoices/${id}`);
            const data = res.data;
            setCurrentInvoiceId(data.id);
            setHeaderData({
                fournisseurName: data.fournisseurName || '',
                invoiceNumber: data.invoiceNumber || '',
                invoiceDate: data.invoiceDate ? new Date(data.invoiceDate).toISOString().split('T')[0] : '',
                dueDate: data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : '',
                totalHT: data.totalHT?.toString() || '',
                totalTTC: data.totalTTC?.toString() || '',
                tva: data.tva?.toString() || '',
                fournisseurPhone: data.fournisseurPhone || '',
                fournisseurAddress: data.fournisseurAddress || '',
            });
            setLineItems((data.items || []).map((item: any, i: number) => ({
                id: `item-${Date.now()}-${i}`,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate ?? 0.19,
                totalHT: item.totalHT,
            })));
            setSelectedSupplierId(data.fournisseurId);
            setConfidenceScore(data.confidenceScore || 0);
            setView('review');
        } catch (error) {
            console.error('Error loading invoice:', error);
            setStatus({ type: 'error', message: t('supplierInvoice.loadFailed', 'Failed to load invoice details') });
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // RENDER: LIST VIEW
    // ═══════════════════════════════════════════════════════════════

    if (view === 'list') {
        return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{t('supplierInvoice.title', 'Supplier Invoices')}</h1>
                        <p className="text-gray-500 mt-1">{t('supplierInvoice.subtitle', 'Upload PDFs or photos, extract data via OCR, and manage supplier invoices')}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={runConsistencyCheck}
                            className="flex items-center px-4 py-2 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-all border border-amber-200"
                        >
                            <ShieldCheck size={18} className="mr-2" />
                            {t('supplierInvoice.consistencyCheck', 'Check')}
                        </button>
                        <button
                            onClick={() => navigate('/suppliers')}
                            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all"
                        >
                            <ArrowLeft size={18} className="mr-2" />
                            {t('nav.suppliers', 'Suppliers')}
                        </button>
                        <button
                            onClick={() => { resetReviewState(); setView('upload'); }}
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-105"
                        >
                            <Upload size={20} className="mr-2" />
                            {t('supplierInvoice.upload', 'Upload Invoice')}
                        </button>
                    </div>
                </div>

                {/* Status */}
                {status && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${
                        status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                        {status.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                        <span>{status.message}</span>
                        <button onClick={() => setStatus(null)} className="ml-auto"><X size={16} /></button>
                    </div>
                )}

                {/* Active / Paid Tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t('supplierInvoice.activeInvoices', 'Active')}
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                            {invoices.filter(i => i.paymentStatus !== 'Paid').length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('paid')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'paid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t('supplierInvoice.paidInvoices', 'Paid')}
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">
                            {invoices.filter(i => i.paymentStatus === 'Paid').length}
                        </span>
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('supplierInvoice.searchPlaceholder', 'Search by file name, invoice number, or supplier...')}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                </div>

                {/* Invoices Table */}
                {loading ? (
                    <div className="text-center py-20 text-gray-500">
                        <Loader2 className="animate-spin mx-auto mb-3" size={32} />
                        {t('common.loading', 'Loading...')}
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg">{t('supplierInvoice.noInvoices', 'No supplier invoices yet')}</p>
                        <p className="text-gray-400 text-sm mt-1">{t('supplierInvoice.uploadToStart', 'Upload a PDF to get started')}</p>
                        <button
                            onClick={() => { resetReviewState(); setView('upload'); }}
                            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
                        >
                            {t('supplierInvoice.uploadFirst', 'Upload First Invoice')}
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('supplierInvoice.invoiceNumber', 'Invoice #')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('supplierInvoice.supplier', 'Supplier')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('common.date', 'Date')}</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('invoice.totalTTC', 'Total TTC')}</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('supplierInvoice.paid', 'Paid')}</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('supplierInvoice.remaining', 'Remaining')}</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">{t('common.status', 'Status')}</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions', 'Actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredInvoices.map(inv => (
                                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{inv.invoiceNumber || '—'}</div>
                                            <div className="text-xs text-gray-400">{inv.fileName}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{inv.fournisseurName || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                                            {inv.totalTTC != null ? `${inv.totalTTC.toFixed(3)} TND` : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm">
                                            {inv.amountPaid > 0 ? (
                                                <span className="text-emerald-600 font-medium">{inv.amountPaid.toFixed(3)}</span>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm">
                                            {inv.remainingAmount > 0 ? (
                                                <span className="text-amber-600 font-medium">{inv.remainingAmount.toFixed(3)}</span>
                                            ) : inv.totalTTC ? (
                                                <span className="text-emerald-600 font-medium">0.000</span>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(inv.paymentStatus)}`}>
                                                {getPaymentStatusEmoji(inv.paymentStatus)} {t(`supplierInvoice.paymentStatus.${inv.paymentStatus}`, inv.paymentStatus)}
                                            </span>
                                            {/* Payment History Indicators */}
                                            {inv.payments && inv.payments.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5 justify-center">
                                                    {inv.payments.slice(0, 3).map((p, idx) => (
                                                        <span key={idx} className="text-xs text-gray-500" title={`${new Date(p.paymentDate).toLocaleDateString()}: ${p.amount.toFixed(3)} TND${p.status === 'Pending' ? ' ⏰' : ''}`}>
                                                            {p.status === 'Pending' ? '⏰' : '💵'} {p.amount.toLocaleString()}
                                                        </span>
                                                    ))}
                                                    {inv.payments.length > 3 && (
                                                        <button
                                                            onClick={() => openPaymentHistory(inv)}
                                                            className="text-xs text-indigo-500 hover:text-indigo-700"
                                                        >
                                                            +{inv.payments.length - 3} more
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {inv.paymentCount > 0 && (!inv.payments || inv.payments.length === 0) && (
                                                <div className="mt-1 text-xs text-gray-400">
                                                    {inv.paymentCount} {t('supplierInvoice.payments', 'payment(s)')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                {inv.paymentStatus !== 'Paid' && (
                                                    <button
                                                        onClick={() => openPaymentModal(inv)}
                                                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                        title={t('supplierInvoice.addPayment', 'Add Payment')}
                                                    >
                                                        <DollarSign size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleViewInvoice(inv.id)}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title={t('common.edit', 'View / Edit')}
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                {/* Archive - manager only, not yet paid */}
                                                {isManager && inv.paymentStatus !== 'Paid' && (
                                                    <button
                                                        onClick={() => handleArchive(inv.id)}
                                                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                        title="Archive"
                                                    >
                                                        <Archive size={18} />
                                                    </button>
                                                )}
                                                {/* Delete - manager only */}
                                                {isManager && (
                                                    <button
                                                        onClick={() => handleDelete(inv.id)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title={t('common.delete', 'Delete')}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={3} className="px-6 py-3 text-sm font-semibold text-gray-700 text-right">
                                        {t('common.total', 'Total')}
                                    </td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900">
                                        {filteredInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0).toFixed(3)} TND
                                    </td>
                                    <td className="px-6 py-3 text-right font-semibold text-emerald-600">
                                        {filteredInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0).toFixed(3)}
                                    </td>
                                    <td className="px-6 py-3 text-right font-semibold text-amber-600">
                                        {filteredInvoices.reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0).toFixed(3)}
                                    </td>
                                    <td className="px-6 py-3"></td>
                                    <td className="px-6 py-3"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* Payment Modal */}
                {showPaymentModal && selectedInvoice && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-up" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold flex items-center">
                                        💵 {t('supplierInvoice.addPayment', 'Add Payment')}
                                    </h3>
                                    <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Invoice summary */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-sm text-gray-600">{t('supplierInvoice.supplier', 'Supplier')}: <span className="font-bold">{selectedInvoice.fournisseurName}</span></p>
                                    <p className="text-sm text-gray-600">{t('supplierInvoice.invoiceNumber', 'Invoice')}: <span className="font-bold">{selectedInvoice.invoiceNumber || selectedInvoice.fileName}</span></p>
                                    <div className="grid grid-cols-3 gap-2 mt-3">
                                        <div>
                                            <div className="text-xs text-gray-400">{t('invoice.totalTTC', 'Total')}</div>
                                            <div className="font-semibold text-gray-900">{(selectedInvoice.totalTTC || 0).toFixed(3)} TND</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-400">{t('supplierInvoice.paid', 'Paid')}</div>
                                            <div className="font-semibold text-emerald-600">{(selectedInvoice.amountPaid || 0).toFixed(3)} TND</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-400">{t('supplierInvoice.remaining', 'Remaining')}</div>
                                            <div className="font-semibold text-amber-600">{(selectedInvoice.remainingAmount || 0).toFixed(3)} TND</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Timing Toggle */}
                                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setIsScheduledPayment(false)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                                            !isScheduledPayment
                                                ? 'bg-white shadow-sm text-indigo-600 font-medium'
                                                : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                    >
                                        <DollarSign size={16} />
                                        {t('payment.payNow', 'Pay Now')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsScheduledPayment(true)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                                            isScheduledPayment
                                                ? 'bg-white shadow-sm text-indigo-600 font-medium'
                                                : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                    >
                                        <Clock size={16} />
                                        {t('payment.scheduleLater', 'Schedule')}
                                    </button>
                                </div>

                                {/* Scheduled Date Picker */}
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
                                        <p className="text-xs text-amber-700 mt-2">
                                            ⏰ {t('payment.scheduledInfo', 'Payment will be recorded with Pending status for the selected date.')}
                                        </p>
                                    </div>
                                )}

                                {/* Amount */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplierInvoice.paymentAmount', 'Amount')} (TND)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        min="0"
                                        max={selectedInvoice.remainingAmount}
                                        value={paymentAmount}
                                        onChange={e => setPaymentAmount(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="0.000"
                                        autoFocus
                                    />
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplierInvoice.paymentNotes', 'Notes')} ({t('common.optional', 'optional')})</label>
                                    <input
                                        type="text"
                                        value={paymentNotes}
                                        onChange={e => setPaymentNotes(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder={t('supplierInvoice.paymentNotesPlaceholder', 'Bank transfer ref, cheque number...')}
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button
                                    onClick={handleAddPayment}
                                    disabled={paymentSaving || !paymentAmount || parseFloat(paymentAmount) <= 0}
                                    className={`flex items-center px-6 py-2 text-white rounded-xl transition-colors disabled:opacity-50 ${
                                        isScheduledPayment
                                            ? 'bg-amber-600 hover:bg-amber-700'
                                            : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                >
                                    {paymentSaving ? (
                                        <Loader2 size={18} className="mr-2 animate-spin" />
                                    ) : isScheduledPayment ? (
                                        <>
                                            <Clock size={16} className="mr-2" />
                                            {t('payment.schedulePayment', 'Schedule Payment')}
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle size={18} className="mr-2" />
                                            {t('supplierInvoice.recordPayment', 'Record Payment')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment History Modal */}
                {showPaymentHistory && historyInvoice && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowPaymentHistory(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">💳 Payment History — {historyInvoice.invoiceNumber || historyInvoice.fileName}</h3>
                                    <button onClick={() => setShowPaymentHistory(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                                {historyInvoice.payments && historyInvoice.payments.length > 0 ? (
                                    historyInvoice.payments.map((p, idx) => (
                                        <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${
                                            p.status === 'Pending' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                                        }`}>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {p.status === 'Pending' ? '⏰' : '💵'} {p.amount.toFixed(3)} TND
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {new Date(p.paymentDate).toLocaleDateString()} {p.notes && `— ${p.notes}`}
                                                </div>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                p.status === 'Pending' ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'
                                            }`}>
                                                {p.status}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-center py-4">No payments recorded yet.</p>
                                )}
                                <div className="pt-3 border-t border-gray-200 flex justify-between text-sm">
                                    <span className="text-gray-600 font-medium">Total Paid:</span>
                                    <span className="font-bold text-emerald-600">{(historyInvoice.amountPaid || 0).toFixed(3)} TND</span>
                                </div>
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
                                        <Loader2 size={32} className="animate-spin mx-auto text-indigo-500 mb-3" />
                                        <p className="text-gray-500">{t('supplierInvoice.runningCheck', 'Running consistency check...')}</p>
                                    </div>
                                ) : consistencyResult ? (
                                    <div className="space-y-4">
                                        {/* Summary */}
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

                                        {/* Issue list */}
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
                                                            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
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
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER: UPLOAD VIEW
    // ═══════════════════════════════════════════════════════════════

    if (view === 'upload') {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setView('list')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{t('supplierInvoice.uploadTitle', 'Upload Supplier Invoice')}</h1>
                        <p className="text-gray-500 mt-1">{t('supplierInvoice.uploadDesc', 'Upload a PDF to automatically extract invoice data')}</p>
                    </div>
                </div>

                {/* Status */}
                {status && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${
                        status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                        {status.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                        <span>{status.message}</span>
                    </div>
                )}

                {/* Upload Zone */}
                <div
                    className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                        uploading ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer'
                    }`}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.bmp,.tiff,.tif,.webp,image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                    />

                    {uploading ? (
                        <div className="space-y-4">
                            <Loader2 size={48} className="mx-auto text-indigo-500 animate-spin" />
                            <p className="text-lg font-medium text-indigo-700">{uploadProgress}</p>
                            <div className="w-64 mx-auto bg-indigo-200 rounded-full h-2">
                                <div className="bg-indigo-600 h-2 rounded-full animate-pulse w-3/4"></div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="w-20 h-20 mx-auto bg-indigo-100 rounded-2xl flex items-center justify-center">
                                <Upload size={40} className="text-indigo-500" />
                            </div>
                            <div>
                                <p className="text-lg font-semibold text-gray-700">{t('supplierInvoice.dropHere', 'Drop your PDF or photo here, or click to browse')}</p>
                                <p className="text-sm text-gray-400 mt-1">{t('supplierInvoice.maxFileSize', 'Max file size: 15MB. Supported: PDF, JPG, PNG, BMP, TIFF, WebP')}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* How it works */}
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleDiscard}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{t('supplierInvoice.reviewTitle', 'Review Extracted Data')}</h1>
                        <p className="text-gray-500 mt-1">
                            Verify and correct the extracted information before saving
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
                    <button
                        onClick={handleDiscard}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={saving}
                        className="flex items-center px-6 py-2 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={18} className="mr-2 animate-spin" />
                                {t('common.saving', 'Saving...')}
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} className="mr-2" />
                                {t('supplierInvoice.confirmSave', 'Confirm & Save')}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Status */}
            {status && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${
                    status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                    {status.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                    <span>{status.message}</span>
                    <button onClick={() => setStatus(null)} className="ml-auto"><X size={16} /></button>
                </div>
            )}

            {/* Warnings */}
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

            {/* Auto-save indicator */}
            <div className="text-xs text-gray-400 text-right">
                <Save size={12} className="inline mr-1" />
                {t('supplierInvoice.autoSaved', 'Draft auto-saved to browser')}
            </div>

            {/* Split layout: Document Preview + Form */}
            <div className={`flex gap-6 ${tempFilePath ? 'flex-col lg:flex-row' : ''}`}>
                {/* Document Preview Panel */}
                {tempFilePath && (
                    <div className={`${showDocPreview ? 'lg:w-1/2' : 'lg:w-auto'} flex-shrink-0`}>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-100">
                                <span className="text-sm font-medium text-gray-700 flex items-center">
                                    <Eye size={16} className="mr-2 text-indigo-600" />
                                    {t('supplierInvoice.documentPreview', 'Document Preview')}
                                </span>
                                <button
                                    onClick={() => setShowDocPreview(!showDocPreview)}
                                    className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                                >
                                    {showDocPreview ? t('common.hide', 'Hide') : t('common.show', 'Show')}
                                </button>
                            </div>
                            {showDocPreview && (
                                <div className="p-2">
                                    {tempFileType?.startsWith('image/') ? (
                                        <img
                                            src={`${api.defaults.baseURL?.replace('/api', '')}${tempFilePath}`}
                                            alt={tempFileName || 'Uploaded document'}
                                            className="w-full rounded-lg object-contain max-h-[70vh]"
                                        />
                                    ) : (
                                        <iframe
                                            src={`${api.defaults.baseURL?.replace('/api', '')}${tempFilePath}`}
                                            className="w-full rounded-lg border-0"
                                            style={{ height: '70vh' }}
                                            title={tempFileName || 'PDF Preview'}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Form Fields */}
                <div className="flex-1 space-y-6">

            {/* Header Fields */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText size={20} className="mr-2 text-indigo-600" />
                    {t('supplierInvoice.invoiceDetails', 'Invoice Details')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Supplier Selection */}
                    <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplierInvoice.supplier', 'Supplier')}</label>
                        <div className="flex gap-2">
                            <select
                                value={selectedSupplierId || ''}
                                onChange={e => {
                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                    setSelectedSupplierId(val);
                                    if (val) {
                                        const s = suppliers.find(s => s.id === val);
                                        if (s) setHeaderData(prev => ({ ...prev, fournisseurName: s.name }));
                                    }
                                }}
                                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">-- {t('supplierInvoice.selectSupplier', 'Select existing or create new')} --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        {!selectedSupplierId && (
                            <input
                                type="text"
                                value={headerData.fournisseurName}
                                onChange={e => setHeaderData(prev => ({ ...prev, fournisseurName: e.target.value }))}
                                placeholder={t('supplierInvoice.newSupplierName', 'Or type new supplier name')}
                                className="w-full mt-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplierInvoice.invoiceNumber', 'Invoice Number')}</label>
                        <input
                            type="text"
                            value={headerData.invoiceNumber}
                            onChange={e => setHeaderData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="e.g. FACT-2025-001"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplierInvoice.invoiceDate', 'Invoice Date')}</label>
                        <input
                            type="date"
                            value={headerData.invoiceDate}
                            onChange={e => setHeaderData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            <Calendar size={14} className="mr-1 text-gray-400" />
                            {t('supplierInvoice.dueDate', 'Due Date')}
                        </label>
                        <input
                            type="date"
                            value={headerData.dueDate}
                            onChange={e => setHeaderData(prev => ({ ...prev, dueDate: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    {/* Supplier Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">📞 {t('common.phone', 'Phone')}</label>
                        <input
                            type="text"
                            value={headerData.fournisseurPhone}
                            onChange={e => setHeaderData(prev => ({ ...prev, fournisseurPhone: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="+216..."
                        />
                    </div>
                    {/* Supplier Address */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">📍 {t('common.address', 'Address')}</label>
                        <input
                            type="text"
                            value={headerData.fournisseurAddress}
                            onChange={e => setHeaderData(prev => ({ ...prev, fournisseurAddress: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Supplier address..."
                        />
                    </div>
                </div>

                {/* Computed Totals - read-only, from line items or extraction */}
                {(lineItems.length > 0 || headerData.totalHT || headerData.totalTTC) && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-blue-50 rounded-xl p-3 text-center">
                                <div className="text-xs text-blue-600 font-medium">{t('invoice.totalHT', 'Subtotal HT')}</div>
                                <div className="text-lg font-bold text-blue-800">
                                    {lineItems.length > 0
                                        ? computedTotalHT.toFixed(3)
                                        : (parseFloat(headerData.totalHT) || 0).toFixed(3)} TND
                                </div>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-3 text-center">
                                <div className="text-xs text-amber-600 font-medium">TVA</div>
                                <div className="text-lg font-bold text-amber-800">
                                    {lineItems.length > 0
                                        ? computedTVA.toFixed(3)
                                        : (parseFloat(headerData.tva) || 0).toFixed(3)} TND
                                </div>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-3 text-center">
                                <div className="text-xs text-emerald-600 font-medium">{t('invoice.totalTTC', 'Total TTC')}</div>
                                <div className="text-lg font-bold text-emerald-800">
                                    {lineItems.length > 0
                                        ? computedTotalTTC.toFixed(3)
                                        : (parseFloat(headerData.totalTTC) || 0).toFixed(3)} TND
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Line Items Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <Edit2 size={20} className="mr-2 text-indigo-600" />
                        {t('supplierInvoice.lineItems', 'Line Items')}
                    </h3>
                    <button
                        onClick={addLineItem}
                        className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                    >
                        <Plus size={16} className="mr-1" />
                        {t('supplierInvoice.addItem', 'Add Item')}
                    </button>
                </div>

                {lineItems.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-500">{t('supplierInvoice.noLineItems', 'No line items extracted.')}</p>
                        <button
                            onClick={addLineItem}
                            className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                        >
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
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-20">{t('invoice.taxRate', 'Tax %')}</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-28">{t('invoice.totalHT', 'Total HT')}</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-28">{t('invoice.totalTTC', 'Total TTC')}</th>
                                    <th className="px-3 py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lineItems.map(item => (
                                    <tr key={item.id} className="group hover:bg-gray-50">
                                        <td className="px-3 py-2">
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-400 rounded focus:ring-1 focus:ring-indigo-400 outline-none text-sm"
                                                placeholder={t('invoice.itemDescription', 'Item description')}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={e => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-400 rounded focus:ring-1 focus:ring-indigo-400 outline-none text-sm text-center"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                step="0.001"
                                                value={item.unitPrice}
                                                onChange={e => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-400 rounded focus:ring-1 focus:ring-indigo-400 outline-none text-sm text-right"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <select
                                                value={item.taxRate}
                                                onChange={e => updateLineItem(item.id, 'taxRate', parseFloat(e.target.value))}
                                                className="w-full px-1 py-1.5 bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-400 rounded focus:ring-1 focus:ring-indigo-400 outline-none text-sm text-right"
                                            >
                                                <option value={0}>0%</option>
                                                <option value={0.07}>7%</option>
                                                <option value={0.13}>13%</option>
                                                <option value={0.19}>19%</option>
                                            </select>
                                        </td>
                                        <td className="px-3 py-2 text-right text-sm font-medium text-gray-700">
                                            {(item.quantity * item.unitPrice).toFixed(3)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                                            {(item.quantity * item.unitPrice * (1 + item.taxRate)).toFixed(3)}
                                        </td>
                                        <td className="px-3 py-2">
                                            <button
                                                onClick={() => removeLineItem(item.id)}
                                                className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex justify-end">
                                <div className="w-72 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">{t('invoice.subtotal', 'Subtotal (HT)')}</span>
                                        <span className="font-medium">{computedTotalHT.toFixed(3)} TND</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">TVA</span>
                                        <span className="font-medium">{computedTVA.toFixed(3)} TND</span>
                                    </div>
                                    <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                                        <span className="font-semibold text-gray-900">{t('invoice.totalTTC', 'Total TTC')}</span>
                                        <span className="font-bold text-indigo-600">{computedTotalTTC.toFixed(3)} TND</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            </div>{/* end form fields */}
            </div>{/* end split layout */}

            {/* Bottom Action Bar */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-6 px-6 rounded-b-2xl flex justify-between items-center shadow-lg">
                <div className="text-sm text-gray-500">
                    {lineItems.length} {t('supplierInvoice.itemsCount', 'item(s)')} | {t('common.total', 'Total')}: <span className="font-bold text-indigo-600">{computedTotalTTC.toFixed(3)} TND</span>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleDiscard}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={saving}
                        className="flex items-center px-6 py-2 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={18} className="mr-2 animate-spin" />
                                {t('common.saving', 'Saving...')}
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} className="mr-2" />
                                {t('supplierInvoice.confirmSave', 'Confirm & Save')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Upload, Loader2, CheckCircle, AlertTriangle, FileText,
    ArrowLeft, RotateCcw, Sparkles, ChevronDown
} from 'lucide-react';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';
import { queryClient } from '../lib/queryClient';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { useSuppliers } from '../hooks/useSuppliers';

interface LineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    totalHT: number;
}

interface ReviewForm {
    supplierName: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalHT: string;
    totalTTC: string;
    tva: string;
    currency: string;
}

export default function SupplierInvoiceUploadPage() {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<'upload' | 'review'>('upload');
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [saving, setSaving] = useState(false);

    // Data carried from upload response to confirm call
    const [tempFilePath, setTempFilePath] = useState<string | null>(null);
    const [tempFileName, setTempFileName] = useState<string | null>(null);
    const [tempFileType, setTempFileType] = useState<string | null>(null);
    const [tempRawText, setTempRawText] = useState<string | null>(null);
    const [confidenceScore, setConfidenceScore] = useState<number>(0);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [lineItems, setLineItems] = useState<LineItem[]>([]);

    const [form, setForm] = useState<ReviewForm>({
        supplierName: '', invoiceNumber: '', invoiceDate: '',
        dueDate: '', totalHT: '', totalTTC: '', tva: '', currency: 'TND',
    });

    const [error, setError] = useState<string | null>(null);

    // Supplier dropdown state
    const { data: suppliersRaw } = useSuppliers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const suppliers = useMemo(() => (suppliersRaw as any[] || []).map((s: any) => ({ id: s.id as number, name: (s.name || s.companyName || '') as string })).filter(s => s.name), [suppliersRaw]);
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Auto-match supplier after extraction fills the form
    useEffect(() => {
        if (step === 'review' && form.supplierName && suppliers.length > 0 && selectedSupplierId === null) {
            const name = form.supplierName.toLowerCase().trim();
            const match = suppliers.find(s => s.name.toLowerCase().trim() === name)
                || suppliers.find(s => s.name.toLowerCase().includes(name) || name.includes(s.name.toLowerCase()));
            if (match) {
                setSelectedSupplierId(match.id);
                setField('supplierName', match.name);
            }
        }
    }, [step, form.supplierName, suppliers]); // eslint-disable-line react-hooks/exhaustive-deps

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowSupplierDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filteredSuppliers = useMemo(() => {
        const q = supplierSearch.toLowerCase();
        return q ? suppliers.filter(s => s.name.toLowerCase().includes(q)) : suppliers;
    }, [suppliers, supplierSearch]);

    // ─── helpers ──────────────────────────────────────────────────

    const setField = (field: keyof ReviewForm, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const toDateOnly = (iso: string | null | undefined): string => {
        if (!iso) return '';
        return iso.split('T')[0];
    };

    const reset = useCallback(async () => {
        if (tempFilePath) {
            try { await api.post('/SupplierInvoices/discard', { tempFilePath }); } catch { /* ignore */ }
        }
        setStep('upload');
        setTempFilePath(null); setTempFileName(null); setTempFileType(null); setTempRawText(null);
        setConfidenceScore(0); setWarnings([]); setLineItems([]);
        setForm({ supplierName: '', invoiceNumber: '', invoiceDate: '', dueDate: '', totalHT: '', totalTTC: '', tva: '', currency: 'TND' });
        setError(null); setSelectedSupplierId(null); setSupplierSearch('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [tempFilePath]);

    // ─── upload ───────────────────────────────────────────────────

    const processFile = async (file: File) => {
        const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'];
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        if (!allowedExts.includes(ext)) {
            setError(t('supplierInvoice.supportedFormats'));
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            setError(t('supplierInvoice.fileTooLarge'));
            return;
        }

        setUploading(true);
        setError(null);
        const isImage = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'].includes(ext);
        setUploadProgress(isImage ? t('supplierInvoice.runningOcr') : t('supplierInvoice.extracting'));

        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/SupplierInvoices/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const data = res.data;

            setTempFilePath(data.tempFilePath);
            setTempFileName(data.fileName);
            setTempFileType(data.fileType);
            setTempRawText(data.rawExtractedText || null);
            setConfidenceScore(data.confidenceScore || 0);
            setWarnings(data.warnings || []);

            const ed = data.extractedData || {};
            setForm({
                supplierName: ed.supplierName || '',
                invoiceNumber: ed.invoiceNumber || '',
                invoiceDate: toDateOnly(ed.invoiceDate),
                dueDate: toDateOnly(ed.dueDate),
                totalHT: ed.totalHT != null ? String(ed.totalHT) : '',
                totalTTC: ed.totalTTC != null ? String(ed.totalTTC) : '',
                tva: ed.tva != null ? String(ed.tva) : '',
                currency: ed.currency || 'TND',
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setLineItems((ed.lineItems || []).map((item: any) => ({
                description: item.description || '',
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || 0,
                taxRate: item.taxRate ?? 0,
                totalHT: item.totalHT || 0,
            })));

            setStep('review');
        } catch (err: unknown) {
            logger.error('Supplier upload error:', err);
            setError(getErrorMessage(err, t('supplierInvoice.uploadFailed')));
        } finally {
            setUploading(false);
            setUploadProgress('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    // ─── confirm ──────────────────────────────────────────────────

    const handleConfirm = async () => {
        if (!tempFilePath) { setError(t('supplierInvoice.noInvoiceToConfirm')); return; }
        setSaving(true);
        setError(null);

        try {
            const payload = {
                tempFilePath,
                fileName: tempFileName,
                fileType: tempFileType,
                rawExtractedText: tempRawText,
                confidenceScore,
                invoiceNumber: form.invoiceNumber || undefined,
                invoiceDate: form.invoiceDate || undefined,
                dueDate: form.dueDate || undefined,
                totalHT: form.totalHT ? parseFloat(form.totalHT) : undefined,
                totalTTC: form.totalTTC ? parseFloat(form.totalTTC) : undefined,
                tva: form.tva ? parseFloat(form.tva) : undefined,
                supplierName: !selectedSupplierId ? (form.supplierName || undefined) : undefined,
                supplierId: selectedSupplierId || undefined,
                currency: form.currency || undefined,
                items: lineItems.map(i => ({
                    description: i.description,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    taxRate: i.taxRate,
                })),
            };

            await api.post('/SupplierInvoices/confirm-new', payload);
            queryClient.invalidateQueries({ queryKey: ['supplierInvoices'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            notify('success', t('supplierInvoice.confirmed'));
            reset();
        } catch (err: unknown) {
            setError(getErrorMessage(err, t('supplierInvoice.saveFailed')));
        } finally {
            setSaving(false);
        }
    };

    // ─── confidence badge ─────────────────────────────────────────
    const confidenceBadge = () => {
        const pct = Math.round(confidenceScore * 100);
        const color = pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
        return <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>{pct}% {t('supplierInvoice.confidence')}</span>;
    };

    const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-600 outline-none transition-all';
    const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

    // ─────────────────────────────────────────────────────────────
    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <NotifyBanner />

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-emerald-500 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                    <Sparkles className="text-white" size={22} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">{t('supplierInvoice.uploadTitle')}</h1>
                    <p className="text-gray-500 text-sm">{t('supplierInvoice.subtitle')}</p>
                </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
                {(['upload', 'review'] as const).map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === s ? 'bg-purple-600 text-white' : step === 'review' && i === 0 ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            {step === 'review' && i === 0 ? <CheckCircle size={14} /> : i + 1}
                        </div>
                        <span className={`text-xs font-medium ${step === s ? 'text-purple-700' : 'text-gray-400'}`}>
                            {i === 0 ? t('supplierInvoice.step1Title') : t('supplierInvoice.step2Title')}
                        </span>
                        {i === 0 && <div className="w-8 h-px bg-gray-200 mx-1" />}
                    </div>
                ))}
            </div>

            {/* Error banner */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-sm text-red-700">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* ── STEP 1: UPLOAD ── */}
            {step === 'upload' && (
                <div
                    className={`bg-white rounded-2xl border-2 border-dashed transition-all ${dragging ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-400'} shadow-sm`}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                >
                    <div className="p-12 flex flex-col items-center text-center">
                        {uploading ? (
                            <>
                                <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
                                    <Loader2 size={32} className="text-purple-600 animate-spin" />
                                </div>
                                <p className="text-base font-semibold text-gray-800">{uploadProgress}</p>
                                <p className="text-sm text-gray-400 mt-1">{t('supplierInvoice.step2Desc')}</p>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-emerald-100 flex items-center justify-center mb-4">
                                    <FileText size={32} className="text-purple-600" />
                                </div>
                                <p className="text-base font-semibold text-gray-800">{t('supplierInvoice.dropHere')}</p>
                                <p className="text-sm text-gray-400 mt-1 mb-6">{t('supplierInvoice.maxFileSize')}</p>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-emerald-600 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                                >
                                    <Upload size={16} />
                                    {t('supplierInvoice.upload')}
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.bmp,.tiff,.tif,.webp"
                                    onChange={handleFileInput}
                                    className="hidden"
                                />
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── STEP 2: REVIEW ── */}
            {step === 'review' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Review header */}
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold text-gray-900">{t('supplierInvoice.reviewTitle')}</h2>
                            <p className="text-xs text-gray-500 mt-0.5">{t('supplierInvoice.verifyExtracted')}</p>
                        </div>
                        {confidenceBadge()}
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Warnings */}
                        {warnings.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 space-y-1">
                                <p className="font-medium flex items-center gap-1.5"><AlertTriangle size={14} />{t('supplierInvoice.warnings')}</p>
                                {warnings.map((w, i) => <p key={i} className="text-xs opacity-80">{w}</p>)}
                            </div>
                        )}

                        {/* Invoice details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div ref={dropdownRef} className="relative">
                                <label className={labelCls}>{t('supplierInvoice.supplier')}</label>
                                <div
                                    className={`${inputCls} cursor-pointer flex items-center justify-between gap-2 ${selectedSupplierId ? 'border-emerald-300 bg-emerald-50/30' : ''}`}
                                    onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                                >
                                    <span className={`truncate ${form.supplierName ? 'text-gray-800' : 'text-gray-400'}`}>
                                        {form.supplierName || t('supplierInvoice.selectSupplier')}
                                    </span>
                                    <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                                </div>
                                {selectedSupplierId && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                        <CheckCircle size={10} className="text-white" />
                                    </span>
                                )}
                                {showSupplierDropdown && (
                                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-hidden flex flex-col">
                                        <div className="p-2 border-b border-gray-100">
                                            <input
                                                autoFocus
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-400"
                                                placeholder={t('supplierInvoice.searchPlaceholder')}
                                                value={supplierSearch}
                                                onChange={e => setSupplierSearch(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        </div>
                                        <div className="overflow-y-auto flex-1">
                                            {/* New supplier option */}
                                            <button
                                                type="button"
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-purple-600 font-medium border-b border-gray-50"
                                                onClick={() => { setSelectedSupplierId(null); setShowSupplierDropdown(false); setSupplierSearch(''); }}
                                            >
                                                + {t('supplierInvoice.newSupplierName')}
                                            </button>
                                            {filteredSuppliers.map(s => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-purple-50 truncate transition-colors ${
                                                        selectedSupplierId === s.id ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700'
                                                    }`}
                                                    onClick={() => { setSelectedSupplierId(s.id); setField('supplierName', s.name); setShowSupplierDropdown(false); setSupplierSearch(''); }}
                                                >
                                                    {s.name}
                                                    {selectedSupplierId === s.id && <CheckCircle size={12} className="inline ml-2 text-emerald-500" />}
                                                </button>
                                            ))}
                                            {filteredSuppliers.length === 0 && (
                                                <div className="px-3 py-4 text-xs text-gray-400 text-center">{t('common.noResults', 'No results')}</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {/* Manual input when no supplier selected */}
                                {!selectedSupplierId && (
                                    <input
                                        className={`${inputCls} mt-1.5`}
                                        value={form.supplierName}
                                        onChange={e => setField('supplierName', e.target.value)}
                                        placeholder={t('supplierInvoice.newSupplierName')}
                                    />
                                )}
                            </div>
                            <div>
                                <label className={labelCls}>{t('supplierInvoice.invoiceNumber')}</label>
                                <input className={inputCls} value={form.invoiceNumber} onChange={e => setField('invoiceNumber', e.target.value)} placeholder={t('supplierInvoice.invoiceNumberPlaceholder')} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('supplierInvoice.invoiceDate')}</label>
                                <input type="date" className={inputCls} value={form.invoiceDate} onChange={e => setField('invoiceDate', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('supplierInvoice.dueDate')}</label>
                                <input type="date" className={inputCls} value={form.dueDate} onChange={e => setField('dueDate', e.target.value)} />
                            </div>
                        </div>

                        {/* Amounts */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className={labelCls}>{t('supplierInvoice.totalHT')}</label>
                                <input type="number" step="0.001" min="0" className={inputCls} value={form.totalHT} onChange={e => setField('totalHT', e.target.value)} placeholder="0.000" />
                            </div>
                            <div>
                                <label className={labelCls}>{t('supplierInvoice.tva')}</label>
                                <input type="number" step="0.001" min="0" className={inputCls} value={form.tva} onChange={e => setField('tva', e.target.value)} placeholder="0.000" />
                            </div>
                            <div>
                                <label className={labelCls}>{t('supplierInvoice.totalTTC')}</label>
                                <input type="number" step="0.001" min="0" className={inputCls} value={form.totalTTC} onChange={e => setField('totalTTC', e.target.value)} placeholder="0.000" />
                            </div>
                        </div>

                        {/* Currency */}
                        <div className="w-1/3">
                            <label className={labelCls}>{t('supplierInvoice.documentCurrency')}</label>
                            <input className={inputCls} value={form.currency} onChange={e => setField('currency', e.target.value)} />
                        </div>

                        {/* Line items (read-only table) */}
                        {lineItems.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-gray-600 mb-2">{t('supplierInvoice.lineItems')} ({lineItems.length})</p>
                                <div className="rounded-xl border border-gray-100 overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium text-gray-500">{t('common.description', 'Description')}</th>
                                                <th className="px-3 py-2 text-right font-medium text-gray-500">{t('common.qty', 'Qty')}</th>
                                                <th className="px-3 py-2 text-right font-medium text-gray-500">{t('common.unitPrice', 'Unit Price')}</th>
                                                <th className="px-3 py-2 text-right font-medium text-gray-500">{t('supplierInvoice.totalHT')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {lineItems.map((item, i) => (
                                                <tr key={i} className="hover:bg-gray-50/50">
                                                    <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate">{item.description || '—'}</td>
                                                    <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                                                    <td className="px-3 py-2 text-right text-gray-600">{item.unitPrice.toFixed(3)}</td>
                                                    <td className="px-3 py-2 text-right font-medium text-gray-800">{item.totalHT.toFixed(3)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="px-6 pb-6 flex gap-3">
                        <button
                            type="button"
                            onClick={reset}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all disabled:opacity-40"
                        >
                            <ArrowLeft size={15} />
                            {t('supplierInvoice.startOver')}
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-emerald-600 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            {saving ? t('common.saving', 'Saving…') : t('supplierInvoice.confirmSave')}
                        </button>
                    </div>
                </div>
            )}

            {/* How it works (only on upload step) */}
            {step === 'upload' && !uploading && (
                <div className="mt-6 grid grid-cols-3 gap-3">
                    {([
                        { icon: <FileText size={18} />, title: t('supplierInvoice.step1Title'), desc: t('supplierInvoice.step1Desc') },
                        { icon: <Sparkles size={18} />, title: t('supplierInvoice.step2Title'), desc: t('supplierInvoice.step2Desc') },
                        { icon: <CheckCircle size={18} />, title: t('supplierInvoice.step3Title'), desc: t('supplierInvoice.step3Desc') },
                    ] as const).map((card, i) => (
                        <div key={i} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm text-center">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center mx-auto mb-2 text-purple-600">{card.icon}</div>
                            <p className="text-xs font-semibold text-gray-800 mb-0.5">{card.title}</p>
                            <p className="text-xs text-gray-400 leading-relaxed">{card.desc}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Start over link */}
            {step === 'review' && (
                <div className="mt-3 text-center">
                    <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto transition-colors">
                        <RotateCcw size={12} /> {t('supplierInvoice.startOver')}
                    </button>
                </div>
            )}
        </div>
    );
}

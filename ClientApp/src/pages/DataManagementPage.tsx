import { useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle,
    FileText, Users, Package, DollarSign, Truck, Receipt
} from 'lucide-react';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';
import { logger } from '../lib/logger';
import { useAuth } from '../context/AuthContext';

/* ─── Types ─── */
type DataType = 'revenues' | 'expenses' | 'clients' | 'products' | 'suppliers' | 'otherExpenses';
type ImportStep = 'upload' | 'preview' | 'result';

interface ValidationError {
    row: number;
    message: string;
}

interface ImportConflict {
    identifier: string;
    existingId: number;
    existingData: Record<string, string>;
    newData: Record<string, string>;
    rowIndex: number;
}

interface ValidationResult {
    errors: ValidationError[];
    validRows: Record<string, string>[];
    conflicts: ImportConflict[];
    totalRows: number;
    validCount: number;
    errorCount: number;
    conflictCount: number;
}

const SOURCE_ROW_NUMBER_KEY = '__SourceRowNumber';

const DATA_TYPE_CONFIG: Record<DataType, {
    labelKey: string;
    icon: typeof DollarSign;
    requiredColumns: string[];
    optionalColumns: string[];
    exampleRow: Record<string, string>;
}> = {
    revenues: {
        labelKey: 'dataManagement.exportRevenues',
        icon: DollarSign,
        requiredColumns: ['Date', 'Client Name', 'Amount Paid', 'Currency', 'InvoiceNumber'],
        optionalColumns: ['Payment Method'],
        exampleRow: { Date: '2023-05-10', 'Client Name': 'Client A', 'Amount Paid': '1200', Currency: 'EUR', 'Payment Method': 'Bank Transfer', InvoiceNumber: 'FA26-001' },
    },
    expenses: {
        labelKey: 'dataManagement.exportExpenses',
        icon: FileText,
        requiredColumns: ['Date', 'Supplier', 'Amount Paid', 'Currency', 'InvoiceNumber'],
        optionalColumns: ['Reference'],
        exampleRow: { Date: '2023-04-02', Supplier: 'Supplier X', 'Amount Paid': '500', Currency: 'USD', Reference: 'EXP-001', InvoiceNumber: 'SUP-2024-001' },
    },
    clients: {
        labelKey: 'dataManagement.exportClients',
        icon: Users,
        requiredColumns: ['Name'],
        optionalColumns: ['Matricule Fiscal', 'Phone Number', 'Address', 'Email'],
        exampleRow: { Name: 'Client A', 'Matricule Fiscal': 'MF123456', 'Phone Number': '+21699123456', Address: 'Tunis, Centre Urbain', Email: 'a@email.com' },
    },
    products: {
        labelKey: 'dataManagement.exportProducts',
        icon: Package,
        requiredColumns: ['Name', 'Price', 'Currency', 'TVA Rate'],
        optionalColumns: ['Description'],
        exampleRow: { Name: 'Product A', Description: 'Annual subscription', Price: '100', Currency: 'EUR', 'TVA Rate': '19' },
    },
    suppliers: {
        labelKey: 'dataManagement.exportSuppliers',
        icon: Truck,
        requiredColumns: ['Name'],
        optionalColumns: ['Matricule Fiscal', 'Phone Number', 'Address'],
        exampleRow: { Name: 'Supplier X', 'Matricule Fiscal': 'MF789012', 'Phone Number': '+21699654321', Address: 'Sfax, Zone Industrielle' },
    },
    otherExpenses: {
        labelKey: 'dataManagement.exportOtherExpenses',
        icon: Receipt,
        requiredColumns: ['Description', 'Amount', 'Date'],
        optionalColumns: ['Currency', 'Notes', 'Recurring'],
        exampleRow: { Description: 'Office Supplies', Amount: '150.00', Date: '2025-01-15', Currency: 'TND', Notes: 'Monthly stationery', Recurring: 'No' },
    },
};

export default function DataManagementPage() {
    const { t, i18n } = useTranslation();
    const { isManager } = useAuth();

    // ═══ EXPORT STATE ═══
    const [exportDateFrom, setExportDateFrom] = useState('');
    const [exportDateTo, setExportDateTo] = useState('');
    const [exportLoading, setExportLoading] = useState<string | null>(null);

    // ═══ IMPORT STATE ═══
    const [importType, setImportType] = useState<DataType>('revenues');
    const [importStep, setImportStep] = useState<ImportStep>('upload');
    const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [importLoading, setImportLoading] = useState(false);
    const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [resolutions, setResolutions] = useState<Record<number, 'update' | 'keep_original'>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ═══ EXPORT HANDLERS ═══
    const handleExport = useCallback(async (type: string) => {
        setExportLoading(type);
        try {
            const params = new URLSearchParams();
            if (exportDateFrom) params.set('from', exportDateFrom);
            if (exportDateTo) params.set('to', exportDateTo);
            params.set('format', 'xlsx');
            const query = `?${params.toString()}`;

            const response = await api.get(`/DataManagement/export/${type}${query}`, {
                responseType: 'blob',
            });

            // Download the file
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            logger.error('Export failed:', error);
        } finally {
            setExportLoading(null);
        }
    }, [exportDateFrom, exportDateTo]);

    // ═══ CSV PARSING ═══

    const parseCsvLineWith = (line: string, delimiter: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    };

    const parseCsv = useCallback((text: string): Record<string, string>[] => {
        // Strip BOM
        const clean = text.replace(/^\uFEFF/, '');
        const lines = clean.split(/\r?\n/);
        const headerIndex = lines.findIndex(l => l.trim().length > 0);
        if (headerIndex < 0 || headerIndex >= lines.length - 1) return [];

        // Auto-detect delimiter from the header row (inlined to satisfy exhaustive-deps)
        const detectDelim = (headerLine: string): string => {
            const hClean = headerLine.replace(/^\uFEFF/, '');
            for (const delim of [';', ',', '\t']) {
                if (parseCsvLineWith(hClean, delim).length >= 2) return delim;
            }
            return ',';
        };
        const delimiter = detectDelim(lines[headerIndex]);

        // Parse header
        const headers = parseCsvLineWith(lines[headerIndex].replace(/^\uFEFF/, ''), delimiter);
        const rows: Record<string, string>[] = [];

        for (let lineIndex = headerIndex + 1; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            if (line.trim().length === 0) continue;

            const values = parseCsvLineWith(line, delimiter);
            const row: Record<string, string> = {
                [SOURCE_ROW_NUMBER_KEY]: String(lineIndex + 1),
            };

            headers.forEach((h, idx) => {
                const header = h.trim();
                if (header.length === 0) return;
                row[header] = (values[idx] ?? '').trim();
            });

            rows.push(row);
        }

        return rows;
    }, []);

    // ═══ FILE UPLOAD (CSV and XLSX) ═══
    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        let rows: Record<string, string>[] = [];

        if (isExcel) {
            // Parse Excel server-side for robust header-based reading
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await api.post('/DataManagement/import/parse-excel', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                rows = res.data.rows ?? [];
            } catch (error: unknown) {
                const msg = getErrorMessage(error, 'Failed to parse Excel file');
                setImportResult({ success: false, message: msg });
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
        } else {
            // Parse CSV client-side
            const text = await file.text();
            rows = parseCsv(text);
        }

        if (rows.length === 0) {
            setImportResult({ success: false, message: 'File is empty or has invalid format' });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setParsedRows(rows);
        setImportStep('preview');
        setImportResult(null);

        // Validate via backend (dry run)
        setImportLoading(true);
        try {
            const res = await api.post('/DataManagement/import/validate', {
                dataType: importType,
                rows: rows,
            });
            setValidationResult(res.data);
        } catch (error: unknown) {
            const msg = getErrorMessage(error, 'Validation failed');
            setValidationResult({
                errors: [{ row: 0, message: msg }],
                validRows: [],
                conflicts: [],
                totalRows: rows.length,
                validCount: 0,
                errorCount: rows.length,
                conflictCount: 0,
            });
        } finally {
            setImportLoading(false);
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [importType, parseCsv]);

    // ═══ CONFIRM IMPORT ═══
    const handleConfirmImport = useCallback(async () => {
        if (!validationResult || validationResult.validRows.length === 0) return;

        // Check if there are conflicts that haven't been resolved yet
        if (validationResult.conflicts.length > 0 && !showConflictModal) {
            // Initialize resolutions (default to keep_original if not set)
            const initialResolutions: Record<number, 'update' | 'keep_original'> = {};
            validationResult.conflicts.forEach(c => {
                initialResolutions[c.existingId] = 'keep_original';
            });
            setResolutions(initialResolutions);
            setShowConflictModal(true);
            return;
        }

        setImportLoading(true);
        try {
            const res = await api.post('/DataManagement/import/confirm', {
                dataType: importType,
                rows: validationResult.validRows,
            });

            const { imported, updated, skipped } = res.data;
            const message = t('dataManagement.importDetailedSummary', {
                new: imported || 0,
                updated: updated || 0,
                skipped: skipped || 0
            });

            setImportResult({ success: true, message });
            setImportStep('result');
            setValidationResult(null);
        } catch (error: unknown) {
            const msg = getErrorMessage(error, 'Import failed');
            setImportResult({ success: false, message: msg });
        } finally {
            setImportLoading(false);
        }
    }, [importType, validationResult, showConflictModal, t]);

    const handleApplyAllNew = useCallback(() => {
        if (!validationResult) return;
        const newResolutions = { ...resolutions };
        validationResult.conflicts.forEach(c => {
            newResolutions[c.existingId] = 'update';
        });
        setResolutions(newResolutions);
    }, [validationResult, resolutions]);

    const handleResolveConflicts = useCallback(async () => {
        if (!validationResult) return;

        setImportLoading(true);
        try {
            // Step 1: Send conflict resolutions to backend
            const resolutionsPayload = validationResult.conflicts.map(c => ({
                existingId: c.existingId,
                choice: resolutions[c.existingId] || 'keep_original',
                newData: c.newData
            }));

            const resolveRes = await api.post('/DataManagement/import/resolve-conflicts', {
                dataType: importType,
                resolutions: resolutionsPayload
            });

            const rData = resolveRes.data;

            // Step 2: Find rows that were NOT involved in any conflict
            const conflictRowIndices = new Set(
                validationResult.conflicts
                    .map(c => c.rowIndex)
                    .filter(rowIndex => Number.isFinite(rowIndex) && rowIndex > 0)
            );

            const nonConflictingRows = validationResult.validRows.filter((row, rowIdxZeroBased) => {
                const fallbackRowNumber = rowIdxZeroBased + 2;
                const rowIdx = Number.parseInt(
                    row['__RowNumber'] ?? row[SOURCE_ROW_NUMBER_KEY] ?? String(fallbackRowNumber),
                    10
                );
                return !conflictRowIndices.has(rowIdx);
            });

            // Step 3: Only call ConfirmImport if there are genuinely new rows
            let cData = { imported: 0, updated: 0, skipped: 0 };
            if (nonConflictingRows.length > 0) {
                const confirmRes = await api.post('/DataManagement/import/confirm', {
                    dataType: importType,
                    rows: nonConflictingRows,
                });
                cData = confirmRes.data;
            }

            // Unify results: Total = Resolve + Confirm
            const totalNew = (cData.imported || 0);
            const totalUpdated = (rData.updated || 0) + (cData.updated || 0);
            const totalSkipped = (rData.skipped || 0) + (cData.skipped || 0);

            const finalMessage = t('dataManagement.importDetailedSummary', {
                new: totalNew,
                updated: totalUpdated,
                skipped: totalSkipped
            });

            setImportResult({ success: true, message: finalMessage });
            setImportStep('result');
            setShowConflictModal(false);
        } catch (error: unknown) {
            console.error('Resolution failed:', error);
            const message = error instanceof Error ? error.message : t('dataManagement.importError');
            setImportResult({ success: false, message });
            setImportStep('result');
        } finally {
            setImportLoading(false);
        }
    }, [validationResult, resolutions, importType, t]);

    // ═══ RESET ═══
    const resetImport = useCallback(() => {
        setImportStep('upload');
        setParsedRows([]);
        setValidationResult(null);
        setImportResult(null);
    }, []);

    // ═══ TEMPLATE DOWNLOAD ═══
    const downloadTemplate = useCallback(async (type: DataType) => {
        try {
            const lang = i18n.language || 'en';
            const response = await api.get(`/DataManagement/template/${type}?lang=${lang}`, {
                responseType: 'blob',
            });
            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${type}_template_${lang}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch {
            // Fallback: generate client-side with semicolons
            const config = DATA_TYPE_CONFIG[type];
            const allColumns = [...config.requiredColumns, ...config.optionalColumns];
            const headerLine = allColumns.join(';');
            const exampleLine = allColumns.map(col => config.exampleRow[col] ?? '').join(';');
            const csv = `${headerLine}\n${exampleLine}`;
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${type}_template.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }
    }, [i18n.language]);

    const config = DATA_TYPE_CONFIG[importType];
    const exportTypes = [
        { key: 'revenues', label: t('dataManagement.exportRevenues', 'Paid Revenues'), icon: DollarSign, needsDate: true },
        { key: 'expenses', label: t('dataManagement.exportExpenses', 'Paid Expenses'), icon: FileText, needsDate: true },
        { key: 'clients', label: t('dataManagement.exportClients', 'Clients'), icon: Users, needsDate: false },
        { key: 'products', label: t('dataManagement.exportProducts', 'Products'), icon: Package, needsDate: false },
        { key: 'suppliers', label: t('dataManagement.exportSuppliers', 'Suppliers'), icon: Truck, needsDate: false },
        { key: 'otherExpenses', label: t('dataManagement.exportOtherExpenses', 'Other Expenses'), icon: Receipt, needsDate: true },
    ];

    const getConflictFieldLabel = useCallback((fieldKey: string) => {
        const normalized = fieldKey.trim().toLowerCase();
        const explicitMap: Record<string, string> = {
            date: 'common.date',
            name: 'common.name',
            address: 'common.address',
            email: 'common.email',
            supplier: 'common.supplier',
            category: 'common.category',
            description: 'common.description',
            amount: 'common.amount',
            notes: 'common.notes',
            recurring: 'expense.recurring',
            reference: 'common.reference',
            currency: 'common.currency',
            'client name': 'common.client name',
            'amount paid': 'common.amount paid',
            'payment method': 'common.payment method',
            taxid: 'detail.taxId',
            'tax id': 'detail.taxId',
            'matricule fiscal': 'detail.taxId',
            'phone number': 'common.phone',
            phone: 'common.phone',
            'invoice number': 'common.invoicenumber',
        };

        const translationKey = explicitMap[normalized] ?? `common.${normalized}`;
        return t(translationKey, fieldKey);
    }, [t]);

    // Column info for preview table
    const previewColumns = useMemo(() => {
        if (parsedRows.length === 0) return [];
        return Object.keys(parsedRows[0]).filter(col => !col.startsWith('__'));
    }, [parsedRows]);

    if (!isManager) {
        return (
            <div className="text-center py-20 text-gray-500">
                <p>{t('common.managerOnly')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('dataManagement.title', 'Data Management')}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{t('dataManagement.subtitle', 'Export data and import historical records')}</p>
            </div>

            {/* ═══════ DATA EXPORT SECTION ═══════ */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <Download size={18} className="text-emerald-600" />
                        <h2 className="text-lg font-semibold text-gray-900">{t('dataManagement.export', 'Data Export')}</h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t('dataManagement.exportDesc', 'Export clean, well-formatted Excel files with payment-based data')}</p>
                </div>

                <div className="p-5 space-y-4">
                    {/* Date range */}
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.from', 'From')}</label>
                            <input
                                type="date"
                                value={exportDateFrom}
                                onChange={e => setExportDateFrom(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.to', 'To')}</label>
                            <input
                                type="date"
                                value={exportDateTo}
                                onChange={e => setExportDateTo(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Export buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {exportTypes.map(exp => (
                            <button
                                key={exp.key}
                                onClick={() => handleExport(exp.key)}
                                disabled={exportLoading !== null}
                                className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 transition-colors group disabled:opacity-50"
                            >
                                <div className="p-2 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                                    <exp.icon size={18} className="text-emerald-600" />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-medium text-gray-900">{exp.label}</p>
                                    <p className="text-xs text-gray-500">
                                        {exportLoading === exp.key ? t('common.downloading', 'Downloading...') : 'Excel (.xlsx)'}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══════ HISTORICAL DATA IMPORT SECTION ═══════ */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <Upload size={18} className="text-blue-600" />
                        <h2 className="text-lg font-semibold text-gray-900">{t('dataManagement.import', 'Historical Data Import')}</h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t('dataManagement.importDesc', 'Import previous data. Marked as historical and included in dashboard calculations.')}</p>
                </div>

                <div className="p-5 space-y-4">
                    {/* Data type selector */}
                    <div className="flex flex-wrap gap-2">
                        {(Object.keys(DATA_TYPE_CONFIG) as DataType[]).map(type => {
                            const cfg = DATA_TYPE_CONFIG[type];
                            return (
                                <button
                                    key={type}
                                    onClick={() => { setImportType(type); resetImport(); }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${importType === type
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <cfg.icon size={16} />
                                    {t(cfg.labelKey)}
                                </button>
                            );
                        })}
                    </div>

                    {/* Required columns info */}
                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                        <p className="text-xs font-semibold text-blue-800 mb-1">{t('dataManagement.requiredColumns')}</p>
                        <div className="flex flex-wrap gap-1">
                            {config.requiredColumns.map(col => (
                                <span key={col} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">{col}</span>
                            ))}
                        </div>
                        {config.optionalColumns.length > 0 && (
                            <>
                                <p className="text-xs font-semibold text-blue-800 mt-2 mb-1">{t('dataManagement.optionalColumns')}</p>
                                <div className="flex flex-wrap gap-1">
                                    {config.optionalColumns.map(col => (
                                        <span key={col} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{col}</span>
                                    ))}
                                </div>
                            </>
                        )}
                        <button
                            onClick={() => downloadTemplate(importType)}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                        >
                            <Download size={12} />
                            {t('dataManagement.downloadTemplateCsv')}
                        </button>
                    </div>

                    {/* Step: Upload */}
                    {importStep === 'upload' && (
                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors">
                            <FileSpreadsheet size={40} className="mx-auto mb-3 text-gray-300" />
                            <p className="text-sm text-gray-600 mb-3">{t('dataManagement.dropOrSelect', 'Select a CSV or Excel (.xlsx) file to import')}</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {t('dataManagement.selectFile')}
                            </button>
                        </div>
                    )}

                    {/* Step: Preview */}
                    {importStep === 'preview' && (
                        <div className="space-y-4">
                            {/* Validation summary */}
                            {validationResult && (
                                <div className={`p-3 rounded-lg border ${validationResult.errorCount === 0
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : 'bg-amber-50 border-amber-200'
                                    }`}>
                                    <div className="flex items-center gap-2 text-sm">
                                        {validationResult.errorCount === 0 ? (
                                            <CheckCircle size={16} className="text-emerald-600" />
                                        ) : (
                                            <AlertTriangle size={16} className="text-amber-600" />
                                        )}
                                        <span className={validationResult.errorCount === 0 ? 'text-emerald-800' : 'text-amber-800'}>
                                            {t('dataManagement.validRows', { count: validationResult.validCount })}
                                            {validationResult.errorCount > 0 && `, ${t('dataManagement.invalidRows', { count: validationResult.errorCount })}`}
                                        </span>
                                    </div>
                                    {/* Show errors */}
                                    {validationResult.errors.length > 0 && (
                                        <div className="mt-2 max-h-32 overflow-y-auto">
                                            {validationResult.errors.map((err, i) => (
                                                <p key={i} className="text-xs text-red-700">
                                                    {err.row > 0 ? `${t('common.row', 'Row')} ${err.row}: ` : ''}{err.message}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Data preview table */}
                            {parsedRows.length > 0 && (
                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                                                {previewColumns.map(col => (
                                                    <th key={col} className={`px-3 py-2 text-left text-xs font-medium ${config.requiredColumns.includes(col) ? 'text-blue-700' : 'text-gray-500'
                                                        }`}>
                                                        {col}
                                                        {config.requiredColumns.includes(col) && <span className="text-red-500">*</span>}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {parsedRows.slice(0, 20).map((row, i) => {
                                                const parsedRowNumber = Number.parseInt(row[SOURCE_ROW_NUMBER_KEY] ?? '', 10);
                                                const rowNumber = Number.isFinite(parsedRowNumber) ? parsedRowNumber : i + 2;
                                                const hasError = validationResult?.errors.some(e => e.row === rowNumber);
                                                return (
                                                    <tr key={i} className={hasError ? 'bg-red-50' : ''}>
                                                        <td className="px-3 py-2 text-xs text-gray-400">{rowNumber}</td>
                                                        {previewColumns.map(col => (
                                                            <td key={col} className="px-3 py-2 text-xs text-gray-700">{row[col] ?? ''}</td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {parsedRows.length > 20 && (
                                        <p className="text-xs text-gray-500 p-2 text-center border-t">
                                            {t('common.showingRows', { count: Math.min(20, parsedRows.length), total: parsedRows.length })}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={resetImport}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleConfirmImport}
                                    disabled={importLoading || !validationResult || validationResult.validCount === 0}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {importLoading ? (
                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                    ) : (
                                        <Upload size={16} />
                                    )}
                                    {validationResult?.conflictCount && validationResult.conflictCount > 0
                                        ? t('dataManagement.resolveConflicts', { count: validationResult.conflictCount })
                                        : t('dataManagement.importRecords', { count: validationResult?.validCount ?? 0 })}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Result */}
                    {importStep === 'result' && importResult && (
                        <div className={`p-4 rounded-lg border ${importResult.success
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-red-50 border-red-200'
                            }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {importResult.success ? (
                                    <CheckCircle size={20} className="text-emerald-600" />
                                ) : (
                                    <AlertTriangle size={20} className="text-red-600" />
                                )}
                                <p className={`text-sm font-medium ${importResult.success ? 'text-emerald-800' : 'text-red-800'
                                    }`}>
                                    {importResult.message}
                                </p>
                            </div>
                            <button
                                onClick={resetImport}
                                className="mt-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-50"
                            >
                                {t('dataManagement.importMore')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {/* ═══════ CONFLICT RESOLUTION MODAL ═══════ */}
            {showConflictModal && validationResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-amber-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                    <AlertTriangle className="text-amber-600" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{t('dataManagement.conflictResolution')}</h3>
                                    <p className="text-xs text-amber-700">{t('dataManagement.conflictResolutionDesc', { count: validationResult.conflicts.length })}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleApplyAllNew}
                                    className="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 shadow-sm transition-all flex items-center gap-2"
                                >
                                    <CheckCircle size={16} />
                                    {t('dataManagement.applyAllNew')}
                                </button>
                                <button onClick={() => setShowConflictModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none">
                                    &times;
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {validationResult.conflicts.map((conflict, idx) => (
                                <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                        <span className="text-sm font-semibold text-gray-700">{t('dataManagement.conflict')} #{idx + 1}: {conflict.identifier}</span>
                                        <span className="text-xs text-gray-500">{t('dataManagement.sourceRow')}: {conflict.rowIndex}</span>
                                    </div>
                                    <div className="grid grid-cols-2 divide-x divide-gray-200">
                                        {/* Existing Data */}
                                        <div className={`p-4 transition-colors ${resolutions[conflict.existingId] === 'keep_original' ? 'bg-blue-50/50' : 'bg-white'}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('dataManagement.currentInDatabase')}</h4>
                                                <button
                                                    onClick={() => setResolutions(prev => ({ ...prev, [conflict.existingId]: 'keep_original' }))}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${resolutions[conflict.existingId] === 'keep_original'
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400'
                                                        }`}
                                                >
                                                    {t('dataManagement.keepOriginal')}
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {Object.entries(conflict.existingData).map(([key, val]) => (
                                                    <div key={key} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                                                        <span className="text-gray-500">{getConflictFieldLabel(key)}:</span>
                                                        <span className="font-medium text-gray-900">{val}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* New Data */}
                                        <div className={`p-4 transition-colors ${resolutions[conflict.existingId] === 'update' ? 'bg-amber-50/50' : 'bg-white'}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('dataManagement.newFromFile')}</h4>
                                                <button
                                                    onClick={() => setResolutions(prev => ({ ...prev, [conflict.existingId]: 'update' }))}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${resolutions[conflict.existingId] === 'update'
                                                        ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:border-amber-400'
                                                        }`}
                                                >
                                                    {t('dataManagement.updateWithNew')}
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {Object.entries(conflict.existingData).map(([key]) => (
                                                    <div key={key} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                                                        <span className="text-gray-500">{getConflictFieldLabel(key)}:</span>
                                                        <span className={`font-medium ${conflict.newData[key] !== conflict.existingData[key] ? 'text-amber-700' : 'text-gray-900'}`}>
                                                            {conflict.newData[key] || '-'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowConflictModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
                            >
                                {t('dataManagement.cancelImport')}
                            </button>
                            <button
                                onClick={handleResolveConflicts}
                                disabled={importLoading}
                                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center gap-2"
                            >
                                {importLoading ? (
                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                ) : (
                                    <CheckCircle size={18} />
                                )}
                                {t('dataManagement.applyResolutions')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

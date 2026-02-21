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

interface ValidationResult {
    errors: ValidationError[];
    validRows: Record<string, string>[];
    totalRows: number;
    validCount: number;
    errorCount: number;
}

const DATA_TYPE_CONFIG: Record<DataType, {
    label: string;
    icon: typeof DollarSign;
    requiredColumns: string[];
    optionalColumns: string[];
    exampleRow: Record<string, string>;
}> = {
    revenues: {
        label: 'Revenue',
        icon: DollarSign,
        requiredColumns: ['Date', 'Client Name', 'Amount Paid', 'Currency', 'InvoiceNumber'],
        optionalColumns: ['Payment Method'],
        exampleRow: { Date: '2023-05-10', 'Client Name': 'Client A', 'Amount Paid': '1200', Currency: 'EUR', 'Payment Method': 'Bank Transfer', InvoiceNumber: 'FA26-001' },
    },
    expenses: {
        label: 'Expense',
        icon: FileText,
        requiredColumns: ['Date', 'Supplier', 'Amount Paid', 'Currency'],
        optionalColumns: ['Category', 'Reference'],
        exampleRow: { Date: '2023-04-02', Supplier: 'Supplier X', 'Amount Paid': '500', Currency: 'USD', Category: 'Office', Reference: 'EXP-001' },
    },
    clients: {
        label: 'Client',
        icon: Users,
        requiredColumns: ['Name'],
        optionalColumns: ['Matricule Fiscal', 'Phone Number', 'Address', 'Email'],
        exampleRow: { Name: 'Client A', 'Matricule Fiscal': 'MF123456', 'Phone Number': '+21699123456', Address: 'Tunis, Centre Urbain', Email: 'a@email.com' },
    },
    products: {
        label: 'Product',
        icon: Package,
        requiredColumns: ['Name', 'Price', 'Currency', 'TVA Rate'],
        optionalColumns: ['Description'],
        exampleRow: { Name: 'Product A', Description: 'Annual subscription', Price: '100', Currency: 'EUR', 'TVA Rate': '19' },
    },
    suppliers: {
        label: 'Supplier',
        icon: Truck,
        requiredColumns: ['Name'],
        optionalColumns: ['Matricule Fiscal', 'Phone Number', 'Address'],
        exampleRow: { Name: 'Supplier X', 'Matricule Fiscal': 'MF789012', 'Phone Number': '+21699654321', Address: 'Sfax, Zone Industrielle' },
    },
    otherExpenses: {
        label: 'Other Expense',
        icon: Receipt,
        requiredColumns: ['Description', 'Amount', 'Date'],
        optionalColumns: ['Category', 'Currency', 'Notes', 'Recurring'],
        exampleRow: { Description: 'Office Supplies', Amount: '150.00', Date: '2025-01-15', Category: 'office', Currency: 'TND', Notes: 'Monthly stationery', Recurring: 'No' },
    },
};

export default function DataManagementPage() {
    const { t } = useTranslation();
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
        const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) return [];

        // Auto-detect delimiter from the header row (inlined to satisfy exhaustive-deps)
        const detectDelim = (headerLine: string): string => {
            const hClean = headerLine.replace(/^\uFEFF/, '');
            for (const delim of [';', ',', '\t']) {
                if (parseCsvLineWith(hClean, delim).length >= 2) return delim;
            }
            return ',';
        };
        const delimiter = detectDelim(lines[0]);

        // Parse header
        const headers = parseCsvLineWith(lines[0], delimiter);
        const rows: Record<string, string>[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLineWith(lines[i], delimiter);
            const row: Record<string, string> = {};
            headers.forEach((h, idx) => {
                row[h.trim()] = (values[idx] ?? '').trim();
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
                totalRows: rows.length,
                validCount: 0,
                errorCount: rows.length,
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

        setImportLoading(true);
        try {
            const res = await api.post('/DataManagement/import/confirm', {
                dataType: importType,
                rows: validationResult.validRows,
            });
            setImportResult({ success: true, message: res.data.message });
            setImportStep('result');
        } catch (error: unknown) {
            const msg = getErrorMessage(error, 'Import failed');
            setImportResult({ success: false, message: msg });
        } finally {
            setImportLoading(false);
        }
    }, [importType, validationResult]);

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
            const response = await api.get(`/DataManagement/template/${type}`, {
                responseType: 'blob',
            });
            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${type}_template.csv`;
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
    }, []);

    const config = DATA_TYPE_CONFIG[importType];
    const exportTypes = [
        { key: 'revenues', label: t('dataManagement.exportRevenues', 'Paid Revenues'), icon: DollarSign, needsDate: true },
        { key: 'expenses', label: t('dataManagement.exportExpenses', 'Paid Expenses'), icon: FileText, needsDate: true },
        { key: 'clients', label: t('dataManagement.exportClients', 'Clients'), icon: Users, needsDate: false },
        { key: 'products', label: t('dataManagement.exportProducts', 'Products'), icon: Package, needsDate: false },
        { key: 'suppliers', label: t('dataManagement.exportSuppliers', 'Suppliers'), icon: Truck, needsDate: false },
        { key: 'otherExpenses', label: t('dataManagement.exportOtherExpenses', 'Other Expenses'), icon: Receipt, needsDate: true },
    ];

    // Column info for preview table
    const previewColumns = useMemo(() => {
        if (parsedRows.length === 0) return [];
        return Object.keys(parsedRows[0]);
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
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        importType === type
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    <cfg.icon size={16} />
                                    {cfg.label}s
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
                                {t('dataManagement.selectFile', 'Select File (CSV or XLSX)')}
                            </button>
                        </div>
                    )}

                    {/* Step: Preview */}
                    {importStep === 'preview' && (
                        <div className="space-y-4">
                            {/* Validation summary */}
                            {validationResult && (
                                <div className={`p-3 rounded-lg border ${
                                    validationResult.errorCount === 0
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
                                            {validationResult.validCount} valid row(s)
                                            {validationResult.errorCount > 0 && `, ${validationResult.errorCount} invalid`}
                                        </span>
                                    </div>
                                    {/* Show errors */}
                                    {validationResult.errors.length > 0 && (
                                        <div className="mt-2 max-h-32 overflow-y-auto">
                                            {validationResult.errors.map((err, i) => (
                                                <p key={i} className="text-xs text-red-700">
                                                    {err.row > 0 ? `Row ${err.row}: ` : ''}{err.message}
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
                                                    <th key={col} className={`px-3 py-2 text-left text-xs font-medium ${
                                                        config.requiredColumns.includes(col) ? 'text-blue-700' : 'text-gray-500'
                                                    }`}>
                                                        {col}
                                                        {config.requiredColumns.includes(col) && <span className="text-red-500">*</span>}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {parsedRows.slice(0, 20).map((row, i) => {
                                                const hasError = validationResult?.errors.some(e => e.row === i + 1);
                                                return (
                                                    <tr key={i} className={hasError ? 'bg-red-50' : ''}>
                                                        <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
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
                                            Showing 20 of {parsedRows.length} rows
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
                                    Cancel
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
                                    Import {validationResult?.validCount ?? 0} Record(s)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Result */}
                    {importStep === 'result' && importResult && (
                        <div className={`p-4 rounded-lg border ${
                            importResult.success
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-red-50 border-red-200'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {importResult.success ? (
                                    <CheckCircle size={20} className="text-emerald-600" />
                                ) : (
                                    <AlertTriangle size={20} className="text-red-600" />
                                )}
                                <p className={`text-sm font-medium ${
                                    importResult.success ? 'text-emerald-800' : 'text-red-800'
                                }`}>
                                    {importResult.message}
                                </p>
                            </div>
                            <button
                                onClick={resetImport}
                                className="mt-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-50"
                            >
                                Import more data
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

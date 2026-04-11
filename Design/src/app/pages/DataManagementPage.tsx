import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle,
    FileText, Users, Package, DollarSign, Truck, Receipt
} from 'lucide-react';
import api from '../services/api';
import { logger } from '../lib/logger';
import { useAuth } from '../context/AuthContext';
import { USE_DUMMY_DATA } from '../config/useDummyData';

type DataType = 'revenues' | 'expenses' | 'clients' | 'products' | 'suppliers' | 'otherExpenses';

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
        optionalColumns: [],
        exampleRow: { Date: '2023-04-02', Supplier: 'Supplier X', 'Amount Paid': '500', Currency: 'USD', InvoiceNumber: 'SUP-2024-001' },
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
        optionalColumns: ['Description', 'Stock', 'Limit'],
        exampleRow: { Name: 'Product A', Description: 'Annual subscription', Price: '100', Currency: 'EUR', 'TVA Rate': '19', Stock: '50', Limit: '10' },
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
        requiredColumns: ['Date', 'Description', 'Amount', 'Category'],
        optionalColumns: ['Currency', 'Notes', 'Recurring'],
        exampleRow: { Date: '2025-01-15', Description: 'Office Supplies', Amount: '150.00', Category: 'office', Currency: 'TND', Notes: 'Monthly stationery', Recurring: 'No' },
    },
};

export default function DataManagementPage() {
    const { t } = useTranslation();
    const { isManager } = useAuth();

    const [exportDateFrom, setExportDateFrom] = useState('');
    const [exportDateTo, setExportDateTo] = useState('');
    const [exportLoading, setExportLoading] = useState<string | null>(null);
    const [importType, setImportType] = useState<DataType>('revenues');
    const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
    const [importLoading, setImportLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = useCallback(async (type: string) => {
        setExportLoading(type);
        try {
            if (USE_DUMMY_DATA) {
                await new Promise(r => setTimeout(r, 1000));
                // Simulate a download in dummy mode
                const blob = new Blob(['Dummy CSV data for ' + type], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${type}_${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } else {
                const params = new URLSearchParams();
                if (exportDateFrom) params.set('from', exportDateFrom);
                if (exportDateTo) params.set('to', exportDateTo);
                params.set('format', 'xlsx');
                const response = await api.get(`/DataManagement/export/${type}?${params.toString()}`, { responseType: 'blob' });
                const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            logger.error('Export failed:', error);
        } finally {
            setExportLoading(null);
        }
    }, [exportDateFrom, exportDateTo]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportLoading(true);
        setImportResult(null);
        try {
            if (USE_DUMMY_DATA) {
                await new Promise(r => setTimeout(r, 1500));
                setImportResult({ success: true, message: t('dataManagement.importSuccess', 'Data imported successfully! (Demo mode)') });
            } else {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('type', importType);
                await api.post('/DataManagement/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                setImportResult({ success: true, message: t('dataManagement.importSuccess', 'Data imported successfully!') });
            }
        } catch (error) {
            logger.error('Import failed:', error);
            setImportResult({ success: false, message: t('dataManagement.importFailed', 'Import failed. Please check the file format.') });
        } finally {
            setImportLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const config = DATA_TYPE_CONFIG[importType];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileSpreadsheet className="text-[#065F46]" />
                    {t('dataManagement.title', 'Data Management')}
                </h1>
                <p className="text-sm text-gray-500 mt-1">{t('dataManagement.subtitle', 'Import and export your business data')}</p>
            </div>

            {/* Export Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Download size={20} className="text-[#065F46]" />
                        {t('dataManagement.export', 'Export Data')}
                    </h2>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dataManagement.dateFrom', 'From Date')}</label>
                            <input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dataManagement.dateTo', 'To Date')}</label>
                            <input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46]" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {(Object.keys(DATA_TYPE_CONFIG) as DataType[]).map(type => {
                            const cfg = DATA_TYPE_CONFIG[type];
                            const Icon = cfg.icon;
                            return (
                                <button
                                    key={type}
                                    onClick={() => handleExport(type)}
                                    disabled={exportLoading !== null}
                                    className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-[#065F46]/5 hover:border-[#065F46]/30 transition-all disabled:opacity-50 text-sm font-medium text-gray-700"
                                >
                                    <Icon size={16} className="text-[#065F46]" />
                                    {exportLoading === type ? t('dataManagement.exporting', 'Exporting...') : t(cfg.labelKey, type)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Import Section */}
            {isManager && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Upload size={20} className="text-[#065F46]" />
                            {t('dataManagement.import', 'Import Data')}
                        </h2>
                    </div>
                    <div className="p-6 space-y-4">
                        {importResult && (
                            <div className={`p-4 rounded-xl flex items-start gap-3 ${importResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                                {importResult.success ? <CheckCircle size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />}
                                <p className="font-medium">{importResult.message}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dataManagement.dataType', 'Data Type')}</label>
                            <select value={importType} onChange={e => setImportType(e.target.value as DataType)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-[#065F46] bg-white">
                                {(Object.keys(DATA_TYPE_CONFIG) as DataType[]).map(type => (
                                    <option key={type} value={type}>{t(DATA_TYPE_CONFIG[type].labelKey, type)}</option>
                                ))}
                            </select>
                        </div>

                        {/* Column info */}
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">{t('dataManagement.requiredColumns', 'Required Columns')}:</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {config.requiredColumns.map(col => (
                                    <span key={col} className="px-2 py-1 bg-[#065F46]/10 text-[#065F46] text-xs rounded-md font-medium">{col}</span>
                                ))}
                            </div>
                            {config.optionalColumns.length > 0 && (
                                <>
                                    <p className="text-sm font-medium text-gray-700 mb-2">{t('dataManagement.optionalColumns', 'Optional Columns')}:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {config.optionalColumns.map(col => (
                                            <span key={col} className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-md font-medium">{col}</span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Example row */}
                        <div className="overflow-x-auto">
                            <p className="text-sm font-medium text-gray-700 mb-2">{t('dataManagement.exampleRow', 'Example Row')}:</p>
                            <table className="text-xs border border-gray-200 rounded-lg overflow-hidden">
                                <thead className="bg-gray-100">
                                    <tr>{Object.keys(config.exampleRow).map(col => <th key={col} className="px-3 py-2 text-left font-medium text-gray-600">{col}</th>)}</tr>
                                </thead>
                                <tbody>
                                    <tr>{Object.values(config.exampleRow).map((val, i) => <td key={i} className="px-3 py-2 text-gray-700 border-t border-gray-200">{val}</td>)}</tr>
                                </tbody>
                            </table>
                        </div>

                        {/* File Upload */}
                        <label className="block w-full p-6 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#065F46]/40 hover:bg-[#065F46]/5 transition-all text-center">
                            <input type="file" ref={fileInputRef} accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" disabled={importLoading} />
                            <Upload size={28} className="mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600 font-medium">
                                {importLoading ? t('dataManagement.importing', 'Importing...') : t('dataManagement.selectFile', 'Click to select a CSV or Excel file')}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{t('dataManagement.supportedFormats', 'Supported: .csv, .xlsx, .xls')}</p>
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}

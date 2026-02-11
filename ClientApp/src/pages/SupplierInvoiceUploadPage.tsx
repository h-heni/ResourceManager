import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Loader2, CheckCircle, AlertTriangle, FileText, Calendar, DollarSign, Building2 } from 'lucide-react';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';

export default function SupplierInvoiceUploadPage() {
    const { t } = useTranslation();
    const [supplierName, setSupplierName] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string; details?: string } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            if (selected.type !== 'application/pdf') {
                setStatus({ type: 'error', message: t('upload.onlyPdf', 'Only PDF files are accepted.') });
                return;
            }
            if (selected.size > 10 * 1024 * 1024) {
                setStatus({ type: 'error', message: t('upload.tooLarge', 'File too large. Maximum 10MB.') });
                return;
            }
            setFile(selected);
            setStatus(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !supplierName.trim() || !date || !amount) return;

        setUploading(true);
        setStatus(null);

        try {
            const formData = new FormData();
            formData.append('supplierName', supplierName.trim());
            formData.append('date', date);
            formData.append('amount', amount);
            formData.append('file', file);

            const res = await api.post('/PendingInvoices/upload-supplier', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const data = res.data;
            setStatus({
                type: 'success',
                message: t('upload.success', 'Invoice uploaded successfully!'),
                details: `${t('upload.compressed', 'Compressed')}: ${data.compressionRatio}% ${t('upload.saved', 'saved')}`
            });

            // Reset form
            setSupplierName('');
            setAmount('');
            setFile(null);
            setDate(new Date().toISOString().split('T')[0]);

            // Reset file input
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        } catch (err: unknown) {
            const msg = getErrorMessage(err, t('upload.failed', 'Upload failed. Please try again.'));
            setStatus({ type: 'error', message: msg });
        } finally {
            setUploading(false);
        }
    };

    const isValid = supplierName.trim() && date && amount && file && !uploading;

    return (
        <div className="max-w-lg mx-auto px-4 py-6">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-[#065F46] to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Upload className="text-white" size={28} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                    {t('upload.title', 'Upload Supplier Invoice')}
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                    {t('upload.subtitle', 'Upload a PDF invoice from your supplier')}
                </p>
            </div>

            {/* Status Alert */}
            {status && (
                <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top ${status.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                    {status.type === 'success'
                        ? <CheckCircle size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                        : <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    }
                    <div>
                        <p className="font-medium">{status.message}</p>
                        {status.details && <p className="text-sm opacity-75 mt-0.5">{status.details}</p>}
                    </div>
                </div>
            )}

            {/* Upload Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 space-y-5">
                    {/* Supplier Name */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                            <Building2 size={16} className="text-[#065F46]" />
                            {t('upload.supplierName', 'Supplier Name')}
                        </label>
                        <input
                            type="text"
                            value={supplierName}
                            onChange={e => setSupplierName(e.target.value)}
                            placeholder={t('upload.supplierPlaceholder', 'e.g. ABC Electronics')}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#065F46]/30 focus:border-[#065F46] outline-none transition-all"
                            required
                        />
                    </div>

                    {/* Date and Amount - Side by side */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <Calendar size={16} className="text-[#065F46]" />
                                {t('upload.date', 'Date')}
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#065F46]/30 focus:border-[#065F46] outline-none transition-all"
                                required
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <DollarSign size={16} className="text-[#065F46]" />
                                {t('upload.amount', 'Amount')}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#065F46]/30 focus:border-[#065F46] outline-none transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* File Upload Area */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                            <FileText size={16} className="text-[#065F46]" />
                            {t('upload.pdfFile', 'PDF File')}
                        </label>
                        <label className={`block w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center ${file
                                ? 'border-emerald-300 bg-emerald-50/50'
                                : 'border-gray-200 bg-gray-50 hover:border-[#065F46]/40 hover:bg-[#065F46]/5'
                            }`}>
                            <input
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {file ? (
                                <div className="flex items-center justify-center gap-3">
                                    <FileText size={24} className="text-emerald-600" />
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-emerald-800 truncate max-w-[200px]">{file.name}</p>
                                        <p className="text-xs text-emerald-600">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <Upload size={28} className="mx-auto text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-600 font-medium">
                                        {t('upload.tapToSelect', 'Tap to select a PDF file')}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {t('upload.maxSize', 'Maximum 10 MB')}
                                    </p>
                                </div>
                            )}
                        </label>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="px-6 pb-6">
                    <button
                        type="submit"
                        disabled={!isValid}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-[#065F46] to-emerald-600 text-white rounded-xl font-semibold text-base shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                {t('upload.uploading', 'Uploading & Compressing...')}
                            </>
                        ) : (
                            <>
                                <Upload size={20} />
                                {t('upload.submit', 'Upload Invoice')}
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Info Note */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs text-blue-700 text-center">
                    {t('upload.info', 'Files are compressed and stored securely. Your manager will sync them to the local file system.')}
                </p>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import api from '../services/api';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';

interface InvoiceDetails {
    id: number;
    number?: string;
    Number?: string;
    invoiceNumber?: string;
    date: string;
    dueDate?: string;
    totalAmount: number;
    clientName: string;
    status: string;
    [key: string]: unknown;
}

interface Props {
    invoiceId: number;
    onClose: () => void;
    onEdit?: (id: number) => void;
    onDownloadPdf?: (id: number, number: string) => void;
    onSendEmail?: (invoice: InvoiceDetails) => void;
    onDelete?: (id: number) => void;
    isManager?: boolean;
}

export default function InvoiceDetailView({
    invoiceId,
    onClose,
    onEdit,
    onDownloadPdf,
    onSendEmail,
    onDelete,
    isManager = false
}: Props) {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvoiceDetails = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/Invoices/${invoiceId}/details`);
                setInvoice(res.data);
            } catch (err: unknown) {
                logger.error('Error fetching invoice details:', err);
                // Fallback to basic invoice data
                try {
                    const basicRes = await api.get(`/Invoices/${invoiceId}`);
                    setInvoice(basicRes.data);
                } catch {
                    setError('Failed to load invoice details');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchInvoiceDetails();
    }, [invoiceId]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#065F46] mx-auto"></div>
                </div>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-8 max-w-md">
                    <p className="text-red-600 mb-4">{error || 'Invoice not found'}</p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <NotifyBanner />
                
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {t('invoice.title')} #{invoice.number || invoice.Number || invoice.invoiceNumber || invoice.id}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">{t('invoice.client')}</p>
                            <p className="font-semibold">{invoice.clientName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">{t('invoice.date')}</p>
                            <p className="font-semibold">
                                {invoice.date ? new Date(invoice.date).toLocaleDateString() : 'N/A'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">{t('invoice.total')}</p>
                            <p className="font-semibold">${invoice.totalAmount.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">{t('common.status')}</p>
                            <p className="font-semibold">{invoice.status}</p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                        {isManager && onEdit && (
                            <button
                                onClick={() => onEdit(invoice.id)}
                                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                            >
                                {t('common.edit')}
                            </button>
                        )}
                        {onDownloadPdf && (
                            <button
                                onClick={() => onDownloadPdf(invoice.id, String(invoice.number || invoice.Number || invoice.invoiceNumber || invoice.id))}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            >
                                {t('invoice.downloadPdf', 'Download PDF')}
                            </button>
                        )}
                        {onSendEmail && (
                            <button
                                onClick={() => onSendEmail(invoice)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                {t('email.sendInvoice', 'Send Email')}
                            </button>
                        )}
                        {isManager && onDelete && (
                            <button
                                onClick={() => onDelete(invoice.id)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 ml-auto"
                            >
                                {t('common.delete')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useState } from 'react';
import Modal from './Modal';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number;
  documentNumber: string;
  contactPhone: string;
  contactName: string;
  apiEndpoint: string; // e.g. "/Invoices/123/send-whatsapp"
  showPaymentReminder?: boolean; // Only for invoices
}

interface WhatsAppSendResponse {
  success: boolean;
  messageId: string;
  phoneNumber: string;
  error?: string;
}

export const WhatsAppIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function WhatsAppShareModal({
  isOpen,
  onClose,
  documentId,
  documentNumber,
  contactPhone,
  contactName,
  apiEndpoint,
  showPaymentReminder = false,
}: WhatsAppShareModalProps) {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [sendReminder, setSendReminder] = useState(false);

  const handleSend = async () => {
    setSending(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { customMessage: customMessage || undefined };
      if (showPaymentReminder) {
        body.sendPaymentReminder = sendReminder;
      }
      const { data } = await api.post<WhatsAppSendResponse>(apiEndpoint, body);

      if (data.success) {
        setSent(true);
      } else {
        setError(data.error || t('whatsapp.errorGeneric'));
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || t('whatsapp.errorGeneric'));
    } finally {
      setSending(false);
    }
  };

  const handleModalClose = () => {
    setSent(false);
    setError(null);
    setCustomMessage('');
    setSendReminder(false);
    onClose();
  };

  if (!isOpen) return null;

  const hasValidPhone = contactPhone && contactPhone !== 'N/A' && contactPhone.trim() !== '';
  void documentId; // used by caller to build apiEndpoint

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title={t('whatsapp.sendDocument')}>
      <div className="space-y-4">
        {/* Contact Info */}
        <div className={`p-3 rounded-lg ${hasValidPhone ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <p className="text-sm text-gray-600">
            <span className="font-medium">{t('whatsapp.recipient')}:</span> {contactName}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">{t('whatsapp.phoneNumber')}:</span> {contactPhone || 'N/A'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium">#</span> {documentNumber}
          </p>
          {!hasValidPhone && (
            <p className="text-sm text-yellow-700 mt-2">
              {t('whatsapp.errorNoPhone')}
            </p>
          )}
        </div>

        {!sent ? (
          <>
            {/* Custom Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('whatsapp.customMessage')} ({t('whatsapp.optional')})
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={t('whatsapp.messagePlaceholder')}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366]"
                disabled={(showPaymentReminder && sendReminder) || sending}
              />
            </div>

            {/* Send Reminder Checkbox - only for invoices */}
            {showPaymentReminder && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sendReminder"
                  checked={sendReminder}
                  onChange={(e) => {
                    setSendReminder(e.target.checked);
                    if (e.target.checked) setCustomMessage('');
                  }}
                  disabled={sending}
                  className="w-4 h-4 text-[#25D366] border-gray-300 rounded focus:ring-[#25D366]"
                />
                <label htmlFor="sendReminder" className="ml-2 text-sm font-medium text-gray-700">
                  {t('whatsapp.sendReminder')}
                </label>
              </div>
            )}

            {/* Info: PDF will be attached */}
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('whatsapp.pdfAttached')}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle size={18} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={sending || !hasValidPhone}
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <WhatsAppIcon className="w-5 h-5" />
              )}
              {sending ? t('whatsapp.sending') : t('whatsapp.sendDirectly')}
            </button>
          </>
        ) : (
          /* Success State */
          <div className="text-center py-6 space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 size={48} className="text-[#25D366]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('whatsapp.sent')}</h3>
              <p className="text-sm text-gray-500 mt-1">{t('whatsapp.sentDescription')}</p>
            </div>
            <button
              onClick={handleModalClose}
              className="w-full bg-[#065F46] hover:bg-[#047857] text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Send, X, Loader2, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { logger } from '../lib/logger';

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiEndpoint: string; // e.g. "/Quotes/123/send-email"
  documentNumber: string;
  contactName: string;
  contactEmail: string;
  defaultSubject?: string;
  defaultBody?: string;
  onSuccess?: () => void;
}

export default function SendEmailModal({
  isOpen,
  onClose,
  apiEndpoint,
  documentNumber,
  contactName,
  contactEmail,
  defaultSubject = '',
  defaultBody = '',
  onSuccess,
}: SendEmailModalProps) {
  const { t } = useTranslation();
  const [emailTo, setEmailTo] = useState(contactEmail);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!emailTo) return;
    setSending(true);
    setError(null);
    try {
      await api.post(apiEndpoint, {
        recipientEmail: emailTo,
        subject,
        body,
        attachPdf: true,
      });
      setSent(true);
      onSuccess?.();
    } catch (err: unknown) {
      logger.error('Error sending email', err);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || t('email.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setError(null);
    setEmailTo(contactEmail);
    setSubject(defaultSubject);
    setBody(defaultBody);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-scale-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Mail className="text-blue-600" size={24} />
            {t('documentSend.sendByEmail')}
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-8 space-y-4">
            <CheckCircle size={48} className="mx-auto text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900">{t('email.sentSuccess')}</h3>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-[#065F46] text-white rounded-xl hover:bg-[#047857] transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm text-blue-800">
                📄 #{documentNumber} - {contactName}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

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
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('email.body')}
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <input type="checkbox" checked disabled className="rounded" />
                <label>{t('email.attachPdf')}</label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={sending}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !emailTo}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <><Loader2 size={16} className="animate-spin" /> {t('email.sending')}...</>
                ) : (
                  <><Send size={16} /> {t('email.send')}</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

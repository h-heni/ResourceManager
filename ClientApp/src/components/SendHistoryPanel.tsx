import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Mail, MessageSquare, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import api from '../services/api';

interface SendRecord {
  id: number;
  channel: string;
  recipientEmail?: string;
  recipientPhone?: string;
  subject?: string;
  sentAt: string;
  sentByName: string;
  status: string;
}

interface SendHistoryPanelProps {
  apiEndpoint: string; // e.g. "/Quotes/123/send-history"
  refreshKey?: number; // increment to trigger refresh
}

export default function SendHistoryPanel({ apiEndpoint, refreshKey }: SendHistoryPanelProps) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<SendRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchHistory = async () => {
      try {
        const res = await api.get(apiEndpoint);
        if (!cancelled) setRecords(res.data);
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchHistory();
    return () => { cancelled = true; };
  }, [apiEndpoint, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-gray-400 italic">
        {t('documentSend.noHistory')}
      </div>
    );
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'Sent': return <CheckCircle2 size={14} className="text-green-500" />;
      case 'Failed': return <AlertCircle size={14} className="text-red-500" />;
      default: return <Clock size={14} className="text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
        <History size={14} />
        {t('documentSend.sendHistory')}
      </h4>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {records.map(r => (
          <div key={r.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg text-xs">
            {r.channel === 'Email' ? (
              <Mail size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
            ) : (
              <MessageSquare size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {statusIcon(r.status)}
                <span className="font-medium text-gray-700">{r.channel}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500 truncate">{r.recipientEmail || r.recipientPhone}</span>
              </div>
              <div className="text-gray-400 mt-0.5">
                {r.sentByName} · {new Date(r.sentAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

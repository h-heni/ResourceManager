import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Loader2, Bell } from 'lucide-react';
import { useStockAlerts, useResolveAlert, type StockAlert } from '../hooks/useInventory';

export default function StockAlertsPage() {
  const { t } = useTranslation();
  const { data: alerts, isLoading } = useStockAlerts();
  const resolveMut = useResolveAlert();

  const activeAlerts = alerts?.filter(a => !a.isResolved) || [];
  const resolvedAlerts = alerts?.filter(a => a.isResolved) || [];

  const alertTypeIcon = (type: string) => {
    if (type === 'OutOfStock') return <AlertTriangle size={16} className="text-red-500" />;
    if (type === 'LowStock') return <AlertTriangle size={16} className="text-amber-500" />;
    return <Bell size={16} className="text-blue-500" />;
  };

  const alertBadge = (type: string) => {
    const colors: Record<string, string> = {
      'OutOfStock': 'bg-red-100 text-red-800',
      'LowStock': 'bg-amber-100 text-amber-800',
      'Overstock': 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
        {t(`inventory.alertType.${type}`, type)}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bell className="text-purple-600" />
          {t('inventory.stockAlerts', 'Stock Alerts')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t('inventory.alertsSubtitle', 'Monitor low stock and out of stock products')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle size={20} className="text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{activeAlerts.filter(a => a.alertType === 'OutOfStock').length}</p>
              <p className="text-xs text-slate-500">{t('inventory.status.OutOfStock', 'Out of Stock')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle size={20} className="text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{activeAlerts.filter(a => a.alertType === 'LowStock').length}</p>
              <p className="text-xs text-slate-500">{t('inventory.status.LowStock', 'Low Stock')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg"><CheckCircle2 size={20} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{resolvedAlerts.length}</p>
              <p className="text-xs text-slate-500">{t('inventory.resolved', 'Resolved')}</p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-purple-600" size={32} /></div>
      ) : !activeAlerts.length ? (
        <div className="text-center py-12 text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200">
          <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-400" />
          <p className="font-medium">{t('inventory.noActiveAlerts', 'No active alerts')}</p>
          <p className="text-sm mt-1">{t('inventory.allGood', 'All products are well-stocked')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeAlerts.map((alert: StockAlert) => (
            <div key={alert.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4">
              <div className="flex-shrink-0">{alertTypeIcon(alert.alertType)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-900">{alert.productName}</span>
                  {alertBadge(alert.alertType)}
                </div>
                <div className="text-sm text-slate-500">
                  {t('inventory.currentQty', 'Current qty')}: <strong className={alert.currentQuantity <= 0 ? 'text-red-600' : 'text-amber-600'}>{alert.currentQuantity}</strong>
                  {' · '}
                  {t('inventory.threshold', 'Threshold')}: <strong>{alert.threshold}</strong>
                  {' · '}
                  {t('inventory.created', 'Created')}: {new Date(alert.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => resolveMut.mutateAsync(alert.id)}
                disabled={resolveMut.isPending}
                className="flex-shrink-0 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCircle2 size={12} />
                {t('inventory.resolve', 'Resolve')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Resolved alerts */}
      {resolvedAlerts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">{t('inventory.resolvedAlerts', 'Resolved Alerts')}</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-start px-4 py-2.5 font-medium text-slate-600">{t('inventory.product', 'Product')}</th>
                  <th className="text-center px-4 py-2.5 font-medium text-slate-600">{t('inventory.type', 'Type')}</th>
                  <th className="text-start px-4 py-2.5 font-medium text-slate-600">{t('inventory.resolvedAt', 'Resolved At')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resolvedAlerts.slice(0, 20).map((alert: StockAlert) => (
                  <tr key={alert.id} className="text-slate-500">
                    <td className="px-4 py-2.5">{alert.productName}</td>
                    <td className="px-4 py-2.5 text-center">{alertBadge(alert.alertType)}</td>
                    <td className="px-4 py-2.5">{alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

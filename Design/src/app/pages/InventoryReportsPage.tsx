import { useTranslation } from 'react-i18next';
import {
  BarChart3, Loader2, Package, DollarSign, AlertTriangle,
  TrendingUp, ArrowUpDown, ShoppingCart
} from 'lucide-react';
import { useInventoryReport, useInventoryValuation, type StockLevel } from '../hooks/useInventory';
import { useSettings } from '../hooks/useSettings';

export default function InventoryReportsPage() {
  const { t } = useTranslation();
  const { data: settingsData } = useSettings();
  const currencySymbol = settingsData?.currencySymbol || '$';
  const { data: report, isLoading: loadingReport } = useInventoryReport();
  const { data: valuation, isLoading: loadingVal } = useInventoryValuation();

  const fmtNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loadingReport || loadingVal) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-[#065F46]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="text-[#065F46]" />
          {t('inventory.reports', 'Inventory Reports')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t('inventory.reportsSubtitle', 'Valuation, stock health, and insights')}</p>
      </div>

      {/* ═══ SUMMARY CARDS ═══ */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#ECFDF5] rounded-lg"><Package size={20} className="text-[#065F46]" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{report.totalProducts}</p>
                <p className="text-xs text-slate-500">{t('inventory.totalProducts', 'Total Products')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><DollarSign size={20} className="text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{currencySymbol} {fmtNum(report.totalStockValue)}</p>
                <p className="text-xs text-slate-500">{t('inventory.stockValue', 'Stock Value')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle size={20} className="text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{report.lowStockCount}</p>
                <p className="text-xs text-slate-500">{t('inventory.lowStockItems', 'Low Stock Items')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><Package size={20} className="text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{report.outOfStockCount}</p>
                <p className="text-xs text-slate-500">{t('inventory.outOfStockItems', 'Out of Stock')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Additional indicators row */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><TrendingUp size={20} className="text-purple-600" /></div>
            <div>
              <p className="text-lg font-bold text-slate-900">{currencySymbol} {fmtNum(report.totalRetailValue)}</p>
              <p className="text-xs text-slate-500">{t('inventory.retailValue', 'Retail Value')}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg"><ArrowUpDown size={20} className="text-cyan-600" /></div>
            <div>
              <p className="text-lg font-bold text-slate-900">{report.recentMovements?.reduce((sum: number, m: { count: number }) => sum + m.count, 0) ?? 0}</p>
              <p className="text-xs text-slate-500">{t('inventory.recentMovements', 'Recent Movements (30d)')}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg"><ShoppingCart size={20} className="text-orange-600" /></div>
            <div>
              <p className="text-lg font-bold text-slate-900">{report.pendingPurchaseOrders}</p>
              <p className="text-xs text-slate-500">{t('inventory.pendingPOs', 'Pending Purchase Orders')}</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ VALUATION TABLE ═══ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-base font-semibold text-slate-900">{t('inventory.valuationBreakdown', 'Valuation Breakdown')}</h2>
        </div>
        {!valuation?.items?.length ? (
          <div className="text-center py-8 text-slate-500">
            <Package size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm">{t('inventory.noValuationData', 'No valuation data available')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t('inventory.product', 'Product')}</th>
                  <th className="text-end px-4 py-3 font-medium text-slate-600">{t('inventory.currentStock', 'Stock')}</th>
                  <th className="text-end px-4 py-3 font-medium text-slate-600">{t('inventory.sellingPrice', 'Selling Price')}</th>
                  <th className="text-end px-4 py-3 font-medium text-slate-600">{t('inventory.costValue', 'Cost Value')}</th>
                  <th className="text-end px-4 py-3 font-medium text-slate-600">{t('inventory.retailValue', 'Retail Value')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {valuation!.items.map((v: StockLevel) => {
                  const costValue = v.currentStock * (v.costPrice ?? v.defaultUnitPrice);
                  const retailValue = v.currentStock * v.defaultUnitPrice;
                  return (
                  <tr key={v.productServiceId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{v.productName}</td>
                    <td className="px-4 py-3 text-end">{v.currentStock}</td>
                    <td className="px-4 py-3 text-end text-slate-700">{currencySymbol} {fmtNum(v.defaultUnitPrice)}</td>
                    <td className="px-4 py-3 text-end font-medium">{currencySymbol} {fmtNum(costValue)}</td>
                    <td className="px-4 py-3 text-end font-medium">{currencySymbol} {fmtNum(retailValue)}</td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 font-semibold text-slate-900">{t('common.total', 'Total')}</td>
                  <td className="px-4 py-3 text-end font-bold text-slate-900">
                    {currencySymbol} {fmtNum(valuation!.totalStockValue)}
                  </td>
                  <td className="px-4 py-3 text-end font-bold text-slate-900">
                    {currencySymbol} {fmtNum(valuation!.totalRetailValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

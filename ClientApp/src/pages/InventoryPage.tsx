import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package, Search, ArrowUpDown, ArrowDown, ArrowUp,
  RotateCcw, Loader2, Filter, ChevronDown, ChevronUp, ChevronRight
} from 'lucide-react';
import {
  useStockLevels, useStockMovements, useAdjustStock,
  useRecordMovement, useProductServiceOptions,
  type StockLevel, type StockMovement
} from '../hooks/useInventory';
import { useSettings } from '../hooks/useSettings';
import Pagination from '../components/Pagination';

export default function InventoryPage() {
  const { t } = useTranslation();
  const { currencySymbol } = useSettings();

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock');

  // ── Stock levels state ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stockPage, setStockPage] = useState(1);
  const stockPageSize = 20;
  const { data: stockData, isLoading: loadingStock } = useStockLevels({ search, status: statusFilter, page: stockPage, size: stockPageSize });
  const stockLevels = stockData?.data || [];

  // ── Movements state ──
  const [movPage, setMovPage] = useState(1);
  const [movType, setMovType] = useState('');
  const { data: movementsData, isLoading: loadingMov } = useStockMovements({ type: movType, page: movPage, size: 20 });

  // ── Adjust modal ──
  const [adjustModal, setAdjustModal] = useState<StockLevel | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const adjustMutation = useAdjustStock();

  // ── Manual movement modal ──
  const [movModal, setMovModal] = useState(false);
  const [movForm, setMovForm] = useState({ productServiceId: '', movementType: 'In', quantity: '', unitCost: '', notes: '' });
  const movMutation = useRecordMovement();
  const { data: productOptions } = useProductServiceOptions();
  const [productSearch, setProductSearch] = useState('');

  // ── Detail row expand ──
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // ── Year grouping for movements ──
  const [collapsedMovYears, setCollapsedMovYears] = useState<Set<number>>(new Set());
  const toggleMovYearCollapse = (year: number) => {
    setCollapsedMovYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  const handleAdjust = async () => {
    if (!adjustModal || !adjustQty) return;
    await adjustMutation.mutateAsync({
      productServiceId: adjustModal.productServiceId,
      newQuantity: Number(adjustQty),
      reason: adjustReason || 'Manual adjustment',
    });
    setAdjustModal(null);
    setAdjustQty('');
    setAdjustReason('');
  };

  const handleRecordMovement = async () => {
    if (!movForm.productServiceId || !movForm.quantity) return;
    await movMutation.mutateAsync({
      productServiceId: Number(movForm.productServiceId),
      movementType: movForm.movementType,
      quantity: Number(movForm.quantity),
      unitCost: movForm.unitCost ? Number(movForm.unitCost) : undefined,
      notes: movForm.notes || undefined,
    });
    setMovModal(false);
    setMovForm({ productServiceId: '', movementType: 'In', quantity: '', unitCost: '', notes: '' });
    setProductSearch('');
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'InStock': 'bg-emerald-100 text-emerald-800',
      'LowStock': 'bg-amber-100 text-amber-800',
      'OutOfStock': 'bg-red-100 text-red-800',
      'Overstock': 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {t(`inventory.status.${status}`, status)}
      </span>
    );
  };

  const movementIcon = (type: string) => {
    if (type === 'In' || type === 'Return') return <ArrowDown size={14} className="text-emerald-600" />;
    if (type === 'Out') return <ArrowUp size={14} className="text-red-600" />;
    return <ArrowUpDown size={14} className="text-blue-600" />;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="text-[#065F46]" />
            {t('inventory.title', 'Inventory Management')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('inventory.subtitle', 'Track stock levels, movements, and alerts')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMovModal(true)}
            className="px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#064E3B] transition-colors text-sm font-medium"
          >
            {t('inventory.recordMovement', 'Record Movement')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-4">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('stock')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'stock' ? 'border-[#065F46] text-[#065F46]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t('inventory.stockLevels', 'Stock Levels')}
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'movements' ? 'border-[#065F46] text-[#065F46]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t('inventory.movements', 'Movements')}
          </button>
        </nav>
      </div>

      {/* ═══ STOCK LEVELS TAB ═══ */}
      {activeTab === 'stock' && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t('common.search', 'Search...')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#065F46] focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-[#065F46]"
              >
                <option value="">{t('common.all', 'All')}</option>
                <option value="InStock">{t('inventory.status.InStock', 'In Stock')}</option>
                <option value="LowStock">{t('inventory.status.LowStock', 'Low Stock')}</option>
                <option value="OutOfStock">{t('inventory.status.OutOfStock', 'Out of Stock')}</option>
                <option value="Overstock">{t('inventory.status.Overstock', 'Overstock')}</option>
              </select>
            </div>
          </div>

          {loadingStock ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#065F46]" size={32} /></div>
          ) : !stockLevels.length ? (
            <div className="text-center py-12 text-slate-500">
              <Package size={48} className="mx-auto mb-3 text-slate-300" />
              <p>{t('inventory.noStockItems', 'No stock-tracked products found')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-start px-4 py-3 font-medium text-slate-600">{t('inventory.product', 'Product')}</th>
                      <th className="text-end px-4 py-3 font-medium text-slate-600">{t('inventory.currentStock', 'Current Stock')}</th>
                      <th className="text-end px-4 py-3 font-medium text-slate-600">{t('inventory.reorderPoint', 'Reorder Point')}</th>
                      <th className="text-end px-4 py-3 font-medium text-slate-600">{t('inventory.stockValue', 'Stock Value')}</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">{t('common.status', 'Status')}</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">{t('common.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockLevels.map(item => (
                      <>
                        <tr
                          key={item.productServiceId}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => setExpandedRow(expandedRow === item.productServiceId ? null : item.productServiceId)}
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              {expandedRow === item.productServiceId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              {item.productName}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-end font-semibold">
                            <span className={item.currentStock <= 0 ? 'text-red-600' : item.stockStatus === 'LowStock' ? 'text-amber-600' : 'text-slate-900'}>
                              {item.currentStock}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-end text-slate-500">{item.reorderPoint ?? '—'}</td>
                          <td className="px-4 py-3 text-end text-slate-700">
                            {currencySymbol} {item.stockValue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">{statusBadge(item.stockStatus)}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={e => { e.stopPropagation(); setAdjustModal(item); setAdjustQty(String(item.currentStock)); }}
                              className="text-[#065F46] hover:text-[#064E3B] text-xs font-medium"
                              title={t('inventory.adjustStock', 'Adjust Stock')}
                            >
                              <RotateCcw size={16} />
                            </button>
                          </td>
                        </tr>
                        {expandedRow === item.productServiceId && (
                          <tr key={`${item.productServiceId}-detail`}>
                            <td colSpan={6} className="bg-slate-50 px-6 py-3 text-xs text-slate-600">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div><span className="font-medium">{t('inventory.sellingPrice', 'Selling Price')}:</span> {currencySymbol} {item.defaultUnitPrice.toFixed(2)}</div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {stockData && stockData.totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                page={stockPage}
                totalPages={stockData.totalPages}
                totalCount={stockData.totalCount}
                size={stockPageSize}
                onPageChange={setStockPage}
              />
            </div>
          )}
        </>
      )}

      {/* ═══ MOVEMENTS TAB ═══ */}
      {activeTab === 'movements' && (
        <>
          <div className="flex gap-3 mb-4">
            <select
              value={movType}
              onChange={e => { setMovType(e.target.value); setMovPage(1); }}
              className="border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-[#065F46]"
            >
              <option value="">{t('common.all', 'All')}</option>
              <option value="In">{t('inventory.movType.In', 'Stock In')}</option>
              <option value="Out">{t('inventory.movType.Out', 'Stock Out')}</option>
              <option value="Adjustment">{t('inventory.movType.Adjustment', 'Adjustment')}</option>
              <option value="Transfer">{t('inventory.movType.Transfer', 'Transfer')}</option>
              <option value="Return">{t('inventory.movType.Return', 'Return')}</option>
            </select>
          </div>

          {loadingMov ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#065F46]" size={32} /></div>
          ) : !movementsData?.data?.length ? (
            <div className="text-center py-12 text-slate-500">
              <ArrowUpDown size={48} className="mx-auto mb-3 text-slate-300" />
              <p>{t('inventory.noMovements', 'No stock movements recorded yet')}</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-start px-4 py-3 font-medium text-slate-600">{t('inventory.date', 'Date')}</th>
                        <th className="text-start px-4 py-3 font-medium text-slate-600">{t('inventory.product', 'Product')}</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">{t('inventory.type', 'Type')}</th>
                        <th className="text-end px-4 py-3 font-medium text-slate-600">{t('inventory.quantity', 'Qty')}</th>
                        <th className="text-end px-4 py-3 font-medium text-slate-600">{t('inventory.stockAfter', 'Stock After')}</th>
                        <th className="text-start px-4 py-3 font-medium text-slate-600">{t('inventory.reference', 'Reference')}</th>
                        <th className="text-start px-4 py-3 font-medium text-slate-600">{t('inventory.notes', 'Notes')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const movements = movementsData.data as StockMovement[];
                        const grouped = movements.reduce((acc, mov) => {
                          const year = new Date(mov.date).getFullYear();
                          if (!acc[year]) acc[year] = [];
                          acc[year].push(mov);
                          return acc;
                        }, {} as Record<number, StockMovement[]>);
                        const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);
                        return years.map(year => {
                          const isCollapsed = collapsedMovYears.has(year);
                          const yearMovements = grouped[year];
                          return (
                            <React.Fragment key={year}>
                              <tr className="bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => toggleMovYearCollapse(year)}>
                                <td colSpan={7} className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    {isCollapsed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                    <span className="font-semibold text-slate-900">{year}</span>
                                    <span className="text-xs text-slate-500">({yearMovements.length})</span>
                                  </div>
                                </td>
                              </tr>
                              {!isCollapsed && yearMovements.map((mov: StockMovement) => (
                        <tr key={mov.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {new Date(mov.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{mov.productName}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1">
                              {movementIcon(mov.movementType)}
                              <span className="text-xs">{t(`inventory.movType.${mov.movementType}`, mov.movementType)}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-end font-semibold">
                            <span className={mov.movementType === 'Out' ? 'text-red-600' : 'text-emerald-600'}>
                              {mov.movementType === 'Out' ? '-' : '+'}{mov.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-end text-slate-700">{mov.stockAfter}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{mov.referenceNumber || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{mov.notes || '—'}</td>
                        </tr>
                      ))}
                            </React.Fragment>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
              {movementsData.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    page={movPage}
                    totalPages={movementsData.totalPages}
                    totalCount={movementsData.totalCount}
                    size={20}
                    onPageChange={setMovPage}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══ ADJUST STOCK MODAL ═══ */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <RotateCcw size={18} className="text-[#065F46]" />
              {t('inventory.adjustStock', 'Adjust Stock')}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {t('inventory.adjustingFor', 'Adjusting stock for')}: <strong>{adjustModal.productName}</strong>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('inventory.newQuantity', 'New Quantity')}
                </label>
                <input
                  type="number"
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('inventory.reason', 'Reason')}
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder={t('inventory.reasonPlaceholder', 'e.g. Physical count correction')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setAdjustModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleAdjust}
                disabled={adjustMutation.isPending}
                className="px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#064E3B] text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {adjustMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RECORD MOVEMENT MODAL ═══ */}
      {movModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ArrowUpDown size={18} className="text-[#065F46]" />
              {t('inventory.recordMovement', 'Record Movement')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('inventory.product', 'Product')} *
                </label>
                <input
                  type="text"
                  placeholder={t('inventory.searchProduct', 'Search products...')}
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46] mb-1"
                />
                <select
                  value={movForm.productServiceId}
                  onChange={e => setMovForm(f => ({ ...f, productServiceId: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                >
                  <option value="">{t('inventory.selectProduct', '-- Select a product --')}</option>
                  {(productOptions || [])
                    .filter(p => p.isStockTracked)
                    .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                    .map(p => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} ({currencySymbol}{p.defaultUnitPrice.toFixed(2)})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('inventory.movementType', 'Movement Type')}
                </label>
                <select
                  value={movForm.movementType}
                  onChange={e => setMovForm(f => ({ ...f, movementType: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                >
                  <option value="In">{t('inventory.movType.In', 'Stock In')}</option>
                  <option value="Out">{t('inventory.movType.Out', 'Stock Out')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('inventory.quantity', 'Quantity')}
                </label>
                <input
                  type="number"
                  value={movForm.quantity}
                  onChange={e => setMovForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('inventory.unitCost', 'Unit Cost')} ({t('common.optional', 'optional')})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={movForm.unitCost}
                  onChange={e => setMovForm(f => ({ ...f, unitCost: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('inventory.notes', 'Notes')}
                </label>
                <textarea
                  value={movForm.notes}
                  onChange={e => setMovForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setMovModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleRecordMovement}
                disabled={movMutation.isPending}
                className="px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#064E3B] text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {movMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

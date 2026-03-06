import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShoppingCart, Plus, Eye, Loader2, Trash2, Check, X,
  Package, ChevronDown, ChevronRight, CheckCircle2, Clock, AlertCircle, Search, Download, FileText, Globe
} from 'lucide-react';
import { CURRENCY_OPTIONS, getCurrencySymbol } from '../lib/currencyUtils';
import {
  usePurchaseOrders, usePurchaseOrder, useCreatePurchaseOrder,
  useUpdatePurchaseOrderStatus, useReceivePurchaseOrder, useDeletePurchaseOrder,
  useProductServiceOptions, useSupplierOptions,
  type PurchaseOrderList, type PurchaseOrderItem
} from '../hooks/useInventory';
import { useSettings } from '../hooks/useSettings';
import api from '../services/api';

export default function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const { currencySymbol } = useSettings();
  const { data: ordersData, isLoading } = usePurchaseOrders();
  const orders = ordersData?.data || [];
  const deleteMut = useDeletePurchaseOrder();
  const statusMut = useUpdatePurchaseOrderStatus();
  const receiveMut = useReceivePurchaseOrder();

  const [viewId, setViewId] = useState<number | null>(null);
  const { data: viewOrder, isLoading: loadingDetail } = usePurchaseOrder(viewId);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    supplierId: '',
    expectedDeliveryDate: '',
    notes: '',
    currency: '',
    pdfLanguage: '',
    items: [{ productServiceId: '', quantity: '', unitPrice: '' }],
  });
  const createMut = useCreatePurchaseOrder();
  const { data: productOptions } = useProductServiceOptions();
  const { data: supplierOptions } = useSupplierOptions();
  const [productSearch, setProductSearch] = useState('');

  const [receiveModal, setReceiveModal] = useState<number | null>(null);
  const [receiveItems, setReceiveItems] = useState<{ purchaseOrderItemId: number; receivedQuantity: string }[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null);
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());

  const handleDownloadPdf = async (poId: number, poNumber: string) => {
    setDownloadingPdf(poId);
    try {
      const res = await api.get(`/Inventory/purchase-orders/${poId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `PO_${poNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setDownloadingPdf(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { icon: typeof Clock; color: string }> = {
      'Draft': { icon: Clock, color: 'bg-slate-100 text-slate-700' },
      'Sent': { icon: ChevronDown, color: 'bg-blue-100 text-blue-700' },
      'PartiallyReceived': { icon: Package, color: 'bg-amber-100 text-amber-700' },
      'Received': { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
      'Cancelled': { icon: AlertCircle, color: 'bg-red-100 text-red-700' },
    };
    const s = map[status] || map['Draft'];
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
        <Icon size={12} />
        {t(`inventory.poStatus.${status}`, status)}
      </span>
    );
  };

  const addItem = () => {
    setCreateForm(f => ({ ...f, items: [...f.items, { productServiceId: '', quantity: '', unitPrice: '' }] }));
  };

  const removeItem = (idx: number) => {
    setCreateForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const handleCreate = async () => {
    if (!createForm.supplierId) return;
    const items = createForm.items
      .filter(i => i.productServiceId && i.quantity)
      .map(i => ({ productServiceId: Number(i.productServiceId), quantity: Number(i.quantity), unitPrice: Number(i.unitPrice || 0) }));
    if (!items.length) return;

    await createMut.mutateAsync({
      supplierId: Number(createForm.supplierId),
      expectedDeliveryDate: createForm.expectedDeliveryDate || undefined,
      notes: createForm.notes || undefined,
      currency: createForm.currency || undefined,
      currencySymbol: createForm.currency ? getCurrencySymbol(createForm.currency) : undefined,
      pdfLanguage: createForm.pdfLanguage || undefined,
      items,
    });
    setShowCreate(false);
    setCreateForm({ supplierId: '', expectedDeliveryDate: '', notes: '', currency: '', pdfLanguage: '', items: [{ productServiceId: '', quantity: '', unitPrice: '' }] });
    setProductSearch('');
  };

  const openReceive = (order: PurchaseOrderList) => {
    setViewId(order.id);
    setReceiveModal(order.id);
    // Pre-populate will happen via useEffect when viewOrder loads
  };

  // Pre-populate receive items with remaining quantities when viewOrder loads and receive modal is open
  const prefillReceiveItems = () => {
    if (!viewOrder || !receiveModal) return;
    setReceiveItems(
      viewOrder.items
        .filter((item: PurchaseOrderItem) => item.quantity - item.receivedQuantity > 0)
        .map((item: PurchaseOrderItem) => ({
          purchaseOrderItemId: item.id,
          receivedQuantity: String(item.quantity - item.receivedQuantity),
        }))
    );
  };

  // Auto-prefill when viewOrder loads and receive modal is open
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (receiveModal && viewOrder && receiveItems.length === 0) {
      prefillReceiveItems();
    }
  }, [receiveModal, viewOrder]);

  const handleReceive = async () => {
    if (!receiveModal) return;
    const items = receiveItems
      .filter(i => Number(i.receivedQuantity) > 0)
      .map(i => ({ purchaseOrderItemId: i.purchaseOrderItemId, receivedQuantity: Number(i.receivedQuantity) }));
    if (!items.length) return;
    await receiveMut.mutateAsync({ id: receiveModal, items });
    setReceiveModal(null);
    setReceiveItems([]);
    setViewId(null);
  };

  const handleDelete = async (id: number) => {
    await deleteMut.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const toggleYearCollapse = (year: number) => {
    setCollapsedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  const groupedOrders = orders.reduce((acc, po) => {
    const year = new Date(po.date).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(po);
    return acc;
  }, {} as Record<number, PurchaseOrderList[]>);

  const sortedYears = Object.keys(groupedOrders).map(Number).sort((a, b) => b - a);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="text-[#065F46]" />
            {t('inventory.purchaseOrders', 'Purchase Orders')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('inventory.poSubtitle', 'Manage purchase orders to restock inventory')}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#064E3B] text-sm font-medium flex items-center gap-2">
          <Plus size={16} /> {t('inventory.createPO', 'Create PO')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#065F46]" size={32} /></div>
      ) : !orders.length ? (
        <div className="text-center py-12 text-slate-500">
          <ShoppingCart size={48} className="mx-auto mb-3 text-slate-300" />
          <p>{t('inventory.noPO', 'No purchase orders yet')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t('inventory.poNumber', 'PO #')}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t('inventory.supplier', 'Supplier')}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t('inventory.orderDate', 'Order Date')}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t('inventory.expectedDelivery', 'Expected Delivery')}</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">{t('common.status', 'Status')}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t('inventory.supplierInvoice', 'Supplier Invoice')}</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">{t('common.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedYears.map(year => {
                  const isCollapsed = collapsedYears.has(year);
                  const yearOrders = groupedOrders[year];
                  return (
                    <React.Fragment key={year}>
                      <tr className="bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => toggleYearCollapse(year)}>
                        <td colSpan={7} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            <span className="font-semibold text-slate-900">{year}</span>
                            <span className="text-xs text-slate-500">({yearOrders.length})</span>
                          </div>
                        </td>
                      </tr>
                      {!isCollapsed && yearOrders.map(po => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-[#065F46]">{po.number}</td>
                    <td className="px-4 py-3 text-slate-900">{po.supplierName}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(po.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-500">{po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(po.status)}</td>
                    <td className="px-4 py-3">
                      {po.supplierInvoiceNumber ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          <FileText size={12} />
                          {po.supplierInvoiceNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setViewId(po.id)} className="p-1.5 text-slate-400 hover:text-[#065F46]" title={t('common.view', 'View')}>
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(po.id, po.number)}
                          disabled={downloadingPdf === po.id}
                          className="p-1.5 text-slate-400 hover:text-[#065F46] disabled:opacity-50"
                          title={t('inventory.downloadPdf', 'Download PDF')}
                        >
                          {downloadingPdf === po.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                        </button>
                        {(po.status === 'Sent' || po.status === 'PartiallyReceived') && (
                          <button onClick={() => openReceive(po)} className="p-1.5 text-slate-400 hover:text-emerald-600" title={t('inventory.receive', 'Receive')}>
                            <Package size={15} />
                          </button>
                        )}
                        {po.status === 'Draft' && (
                          <>
                            <button
                              onClick={() => openReceive(po)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600"
                              title={t('inventory.confirmAndReceive', 'Confirm & Receive')}
                            >
                              <Package size={15} />
                            </button>
                            <button
                              onClick={() => statusMut.mutateAsync({ id: po.id, status: 'Sent' })}
                              className="p-1.5 text-slate-400 hover:text-blue-600"
                              title={t('inventory.submit', 'Submit')}
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(po.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600"
                              title={t('common.delete', 'Delete')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                      {deleteConfirm === po.id && (
                        <div className="flex items-center gap-1 mt-1 justify-center">
                          <button onClick={() => handleDelete(po.id)} className="text-xs text-red-600 hover:underline">{t('common.yes', 'Yes')}</button>
                          <span className="text-xs text-slate-400">/</span>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs text-slate-500 hover:underline">{t('common.no', 'No')}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ VIEW DETAIL MODAL ═══ */}
      {viewId && !receiveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('inventory.poDetails', 'Purchase Order Details')}</h3>
              <button onClick={() => setViewId(null)} className="p-1 text-slate-400 hover:text-slate-900"><X size={18} /></button>
            </div>
            {loadingDetail ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#065F46]" size={24} /></div>
            ) : viewOrder && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div><span className="text-slate-500">{t('inventory.poNumber', 'PO #')}:</span> <strong>{viewOrder.number}</strong></div>
                  <div><span className="text-slate-500">{t('inventory.supplier', 'Supplier')}:</span> <strong>{viewOrder.supplierName}</strong></div>
                  <div><span className="text-slate-500">{t('common.status', 'Status')}:</span> {statusBadge(viewOrder.status)}</div>
                  {viewOrder.supplierInvoiceNumber && (
                    <div>
                      <span className="text-slate-500">{t('inventory.supplierInvoice', 'Supplier Invoice')}:</span>{' '}
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        <FileText size={12} />
                        {viewOrder.supplierInvoiceNumber}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => handleDownloadPdf(viewOrder.id, viewOrder.number)}
                    disabled={downloadingPdf === viewOrder.id}
                    className="px-3 py-1.5 text-sm text-[#065F46] border border-[#065F46] rounded-lg hover:bg-[#065F46]/5 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {downloadingPdf === viewOrder.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {t('inventory.downloadPdf', 'Download PDF')}
                  </button>
                </div>
                {viewOrder.notes && <p className="text-sm text-slate-500 mb-4">{viewOrder.notes}</p>}
                <table className="w-full text-sm border-t border-slate-200">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="text-start py-2">{t('inventory.product', 'Product')}</th>
                      <th className="text-end py-2">{t('inventory.quantity', 'Qty')}</th>
                      <th className="text-end py-2">{t('inventory.unitCost', 'Unit Cost')}</th>
                      <th className="text-end py-2">{t('inventory.received', 'Received')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewOrder.items.map((item: PurchaseOrderItem) => (
                      <tr key={item.id}>
                        <td className="py-2">{item.productName}</td>
                        <td className="py-2 text-end">{item.quantity}</td>
                        <td className="py-2 text-end">{currencySymbol} {item.unitPrice.toFixed(2)}</td>
                        <td className="py-2 text-end">
                          <span className={item.receivedQuantity >= item.quantity ? 'text-emerald-600' : 'text-amber-600'}>
                            {item.receivedQuantity}/{item.quantity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ RECEIVE MODAL ═══ */}
      {receiveModal && viewOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">{t('inventory.receiveGoods', 'Receive Goods')}</h3>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">{t('inventory.receiveDesc', 'Enter received quantities for each item')}</p>
              <button
                onClick={prefillReceiveItems}
                className="text-xs text-[#065F46] hover:underline font-medium"
              >
                {t('inventory.receiveAll', 'Receive All')}
              </button>
            </div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-slate-500 border-b">
                  <th className="text-start py-2">{t('inventory.product', 'Product')}</th>
                  <th className="text-end py-2">{t('inventory.ordered', 'Ordered')}</th>
                  <th className="text-end py-2">{t('inventory.alreadyReceived', 'Already Received')}</th>
                  <th className="text-end py-2">{t('inventory.receiveNow', 'Receive Now')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewOrder.items.map((item: PurchaseOrderItem) => {
                  const receiveItem = receiveItems.find(r => r.purchaseOrderItemId === item.id);
                  return (
                    <tr key={item.id}>
                      <td className="py-2">{item.productName}</td>
                      <td className="py-2 text-end">{item.quantity}</td>
                      <td className="py-2 text-end">{item.receivedQuantity}</td>
                      <td className="py-2 text-end">
                        <input
                          type="number"
                          min="0"
                          max={item.quantity - item.receivedQuantity}
                          value={receiveItem?.receivedQuantity || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setReceiveItems(prev => {
                              const existing = prev.find(r => r.purchaseOrderItemId === item.id);
                              if (existing) {
                                return prev.map(r => r.purchaseOrderItemId === item.id ? { ...r, receivedQuantity: val } : r);
                              }
                              return [...prev, { purchaseOrderItemId: item.id, receivedQuantity: val }];
                            });
                          }}
                          className="w-20 border border-slate-300 rounded px-2 py-1 text-sm text-end focus:ring-2 focus:ring-[#065F46]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setReceiveModal(null); setReceiveItems([]); setViewId(null); }} className="px-4 py-2 text-sm text-slate-600">
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleReceive}
                disabled={receiveMut.isPending}
                className="px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#064E3B] text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {receiveMut.isPending && <Loader2 size={14} className="animate-spin" />}
                {t('inventory.confirmReceive', 'Confirm Receipt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE PO MODAL ═══ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{t('inventory.createPO', 'Create Purchase Order')}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('inventory.supplier', 'Supplier')} *</label>
                  <select
                    value={createForm.supplierId}
                    onChange={e => setCreateForm(f => ({ ...f, supplierId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                  >
                    <option value="">{t('inventory.selectSupplier', '-- Select a supplier --')}</option>
                    {(supplierOptions || []).map(s => (
                      <option key={s.id} value={String(s.id)}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('inventory.expectedDelivery', 'Expected Delivery')}</label>
                  <input
                    type="date"
                    value={createForm.expectedDeliveryDate}
                    onChange={e => setCreateForm(f => ({ ...f, expectedDeliveryDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <span className="flex items-center gap-1">{t('createPage.documentCurrency', 'Document Currency')}</span>
                  </label>
                  <select
                    value={createForm.currency}
                    onChange={e => setCreateForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                  >
                    <option value="">{t('createPage.currencyHelp', 'Company default')}</option>
                    {CURRENCY_OPTIONS.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <span className="flex items-center gap-1"><Globe size={14} /> {t('createPage.pdfLanguage', 'PDF Language')}</span>
                  </label>
                  <select
                    value={createForm.pdfLanguage}
                    onChange={e => setCreateForm(f => ({ ...f, pdfLanguage: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                  >
                    <option value="">{t('createPage.languageHelp', 'Company default')}</option>
                    <option value="fr">{t('language.fr', 'Français')}</option>
                    <option value="en">{t('language.en', 'English')}</option>
                    <option value="de">{t('language.de', 'Deutsch')}</option>
                    <option value="ar">{t('language.ar', 'العربية')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('inventory.notes', 'Notes')}</label>
                <textarea
                  value={createForm.notes}
                  onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t('inventory.items', 'Items')}</label>
                <div className="mb-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={t('inventory.searchProduct', 'Search products...')}
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#065F46]"
                    />
                  </div>
                </div>
                {createForm.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 items-end">
                    <div className="flex-1">
                      {idx === 0 && <label className="text-xs text-slate-500">{t('inventory.product', 'Product')}</label>}
                      <select
                        value={item.productServiceId}
                        onChange={e => {
                          const val = e.target.value;
                          const selectedProduct = productOptions?.find(p => String(p.id) === val);
                          setCreateForm(f => ({
                            ...f,
                            items: f.items.map((it, i) => i === idx
                              ? { ...it, productServiceId: val, unitPrice: it.unitPrice || String(selectedProduct?.defaultUnitPrice ?? '') }
                              : it)
                          }));
                        }}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                      >
                        <option value="">{t('inventory.selectProduct', '-- Select --')}</option>
                        {(productOptions || [])
                          .filter(p => p.isStockTracked)
                          .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                          .map(p => (
                            <option key={p.id} value={String(p.id)}>{p.name}</option>
                          ))}
                      </select>
                    </div>
                    <div className="w-24">
                      {idx === 0 && <label className="text-xs text-slate-500">{t('inventory.quantity', 'Qty')}</label>}
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => {
                          const val = e.target.value;
                          setCreateForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, quantity: val } : it) }));
                        }}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                      />
                    </div>
                    <div className="w-28">
                      {idx === 0 && <label className="text-xs text-slate-500">{t('inventory.unitCost', 'Unit Cost')}</label>}
                      <input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={e => {
                          const val = e.target.value;
                          setCreateForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, unitPrice: val } : it) }));
                        }}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#065F46]"
                      />
                    </div>
                    {createForm.items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="p-2 text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
                <button onClick={addItem} className="text-sm text-[#065F46] hover:underline flex items-center gap-1 mt-1">
                  <Plus size={14} /> {t('inventory.addLine', 'Add line')}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600">
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={createMut.isPending}
                className="px-4 py-2 bg-[#065F46] text-white rounded-lg hover:bg-[#064E3B] text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {createMut.isPending && <Loader2 size={14} className="animate-spin" />}
                {t('common.create', 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

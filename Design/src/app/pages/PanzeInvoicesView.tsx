import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Pencil, Trash, Download, Send, RefreshCcw, 
  Check, X, FileText, Calendar, DollarSign, Users, ExternalLink,
  CreditCard, Tag, MoreHorizontal
} from 'lucide-react';

/* ── Dummy Data ── */
const DUMMY_INVOICES = [
  { id: 1, invoiceNumber: 'INV-2023-001', clientName: 'Acme Corp', amount: 4500.00, issueDate: 'Oct 15, 2023', dueDate: 'Nov 14, 2023', status: 'Paid', method: 'Bank Transfer' },
  { id: 2, invoiceNumber: 'INV-2023-002', clientName: 'TechFlow Inc.', amount: 1250.50, issueDate: 'Oct 18, 2023', dueDate: 'Nov 17, 2023', status: 'Pending', method: 'Credit Card' },
  { id: 3, invoiceNumber: 'INV-2023-003', clientName: 'Global Goods', amount: 8900.00, issueDate: 'Oct 20, 2023', dueDate: 'Nov 19, 2023', status: 'Overdue', method: 'Wire Transfer' },
  { id: 4, invoiceNumber: 'INV-2023-004', clientName: 'Nexus Solutions', amount: 340.00, issueDate: 'Oct 22, 2023', dueDate: 'Nov 21, 2023', status: 'Draft', method: '-' },
  { id: 5, invoiceNumber: 'INV-2023-005', clientName: 'Bright Ideas LLC', amount: 5600.00, issueDate: 'Oct 25, 2023', dueDate: 'Nov 24, 2023', status: 'Paid', method: 'Stripe' },
  { id: 6, invoiceNumber: 'INV-2023-006', clientName: 'Cyberdyne Systems', amount: 12500.00, issueDate: 'Oct 28, 2023', dueDate: 'Nov 27, 2023', status: 'Pending', method: 'Bank Transfer' },
];

const STATUS_COLORS: Record<string, string> = {
  'Draft': 'bg-slate-100 text-slate-600 border-slate-200',
  'Pending': 'bg-amber-50 text-amber-600 border-amber-200',
  'Paid': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  'Overdue': 'bg-red-50 text-red-600 border-red-200',
};

export default function PanzeInvoicesView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredInvoices = DUMMY_INVOICES.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleRow = (id: number) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedRows.length === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredInvoices.map(inv => inv.id));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex flex-col gap-6"
    >
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Invoices</h2>
          <p className="text-sm text-slate-500 mt-1">Manage billing statements, track payments, and follow up on overdue accounts.</p>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col p-6">
        
        {/* Table Header / Action Bar */}
        <div className="flex items-center justify-between mb-6 h-12">
          <div className="flex-1 flex items-center gap-4">
            {selectedRows.length > 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                className="flex items-center gap-1 p-1 bg-white rounded-full border border-slate-200 shadow-sm overflow-x-auto"
              >
                <div className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-full flex items-center gap-2 border border-indigo-100/50 flex-shrink-0">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] shadow-inner">{selectedRows.length}</span>
                  Selected
                </div>
                {selectedRows.length === 1 && (
                  <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-full text-xs font-medium transition-colors">
                    <Pencil size={14} className="text-indigo-500" /> Edit
                  </button>
                )}
                {selectedRows.length === 1 && (
                  <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-full text-xs font-medium transition-colors">
                    <Check size={14} className="text-emerald-500" /> Mark Paid
                  </button>
                )}
                <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-full text-xs font-medium transition-colors">
                  <Send size={14} className="text-indigo-500" /> Send Email
                </button>
                <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-full text-xs font-medium transition-colors">
                  <RefreshCcw size={14} className="text-slate-500" /> Resend
                </button>
                <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-full text-xs font-medium transition-colors">
                  <Download size={14} className="text-indigo-500" /> Export PDF
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1 flex-shrink-0" />
                <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-full text-xs font-medium transition-colors">
                  <Trash size={14} className="text-red-500" /> Delete
                </button>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative max-w-sm w-full flex items-center gap-3">
                <div className="relative w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search invoices..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-full text-sm font-medium outline-none transition-all placeholder:text-slate-400 text-slate-900 shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </motion.div>
            )}
          </div>
          
          {!selectedRows.length && (
            <motion.button 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              onClick={() => setIsModalOpen(true)}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              <Plus size={16} /> Create Invoice
            </motion.button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr>
                <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest w-12">
                  <button 
                    onClick={toggleAll}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      selectedRows.length > 0 && selectedRows.length === filteredInvoices.length 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                        : 'border-slate-300 hover:border-indigo-400 bg-white text-transparent'
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>
                </th>
                <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Invoice Details</th>
                <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Client</th>
                <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Dates</th>
                <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Status</th>
                <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length > 0 ? (
                  filteredInvoices.map((inv, idx) => {
                    const isSelected = selectedRows.includes(inv.id);
                    return (
                      <motion.tr 
                        key={inv.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => toggleRow(inv.id)}
                        className={`group border-b border-slate-100 cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-4 px-4 align-top w-12">
                          <div 
                            className={`w-5 h-5 mt-1 rounded-full border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                                : 'border-slate-300 bg-white text-transparent group-hover:border-indigo-400'
                            }`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <CreditCard size={12} className="text-slate-400" />
                              {inv.method}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700 text-sm">{inv.clientName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                              <Calendar size={12} className="text-slate-400" /> Issued: {inv.issueDate}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar size={12} className="text-red-300" /> Due: {inv.dueDate}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${STATUS_COLORS[inv.status]}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 align-top text-right">
                          <span className="font-bold text-slate-900 tracking-tight text-base">
                            {formatCurrency(inv.amount)}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <motion.tr 
                    key="empty-state"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-center mb-3">
                          <Search className="text-slate-400" size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">No invoices found</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-[250px] mx-auto">
                          No records match your search query. Try adjusting your filters.
                        </p>
                      </div>
                    </td>
                  </motion.tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Slide-over Modal for New Invoice ── */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            key="modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-slate-900/50 z-50"
          />
        )}
        {isModalOpen && (
          <motion.div
            key="modal-panel"
            initial={{ x: '100%', opacity: 0.5 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                <h3 className="text-lg font-bold text-slate-900">Create Invoice</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
                
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Users size={14} className="text-slate-400"/> Bill To Client
                  </label>
                  <select defaultValue="" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none">
                    <option value="" disabled>Select a client...</option>
                    <option value="1">Acme Corp</option>
                    <option value="2">TechFlow Inc.</option>
                    <option value="3">Global Goods</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400"/> Issue Date
                    </label>
                    <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400"/> Due Date
                    </label>
                    <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <FileText size={14} className="text-slate-400"/> Notes / Terms
                  </label>
                  <textarea rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none" placeholder="Enter payment terms..."></textarea>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <DollarSign size={14} className="text-slate-400"/> Invoice Total Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                    <input type="number" step="0.01" min="0" className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="0.00" />
                  </div>
                </div>

              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-white transition-colors shadow-sm">
                  Cancel
                </button>
                <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                  Create Invoice
                </button>
              </div>
            </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

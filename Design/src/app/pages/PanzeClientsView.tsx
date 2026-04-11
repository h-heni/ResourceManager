import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Pencil, Trash, Mail, Phone, FileText, MapPin, Building, ChevronDown, Check, X, Download } from 'lucide-react';

/* ── Dummy Data ── */
const DUMMY_CLIENTS = [
  { id: 1, name: 'Acme Corp', taxId: 'US-12345678', phone: '+1 555-0101', email: 'billing@acmecorp.com', address: '123 Innovation Dr, Tech City' },
  { id: 2, name: 'TechFlow Inc.', taxId: 'US-87654321', phone: '+1 555-0102', email: 'accounts@techflow.io', address: '456 Startup Way, Valley Hub' },
  { id: 3, name: 'Global Goods', taxId: 'UK-99988877', phone: '+44 20 7123 4567', email: 'finance@globalgoods.co.uk', address: '78 Commerce St, London' },
  { id: 4, name: 'Nexus Solutions', taxId: 'CA-44455566', phone: '+1 416-555-0104', email: 'payables@nexus.ca', address: '900 Data Ave, Toronto' },
  { id: 5, name: 'Bright Ideas LLC', taxId: 'US-22233344', phone: '+1 555-0105', email: 'info@brightideas.com', address: '300 Creative Blvd, Austin' },
  { id: 6, name: 'Cyberdyne Systems', taxId: 'US-66677788', phone: '+1 555-0106', email: 'ap@cyberdyne.net', address: '101 Skynet Rd, Silicon Valley' },
];

export default function PanzeClientsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredClients = DUMMY_CLIENTS.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.taxId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleRow = (id: number) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedRows.length === filteredClients.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredClients.map(c => c.id));
    }
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
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Clients</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your client directory, contact information, and billing details.</p>
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
                className="flex items-center gap-1 p-1 bg-white rounded-full border border-slate-200 shadow-sm"
              >
                <div className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-full flex items-center gap-2 border border-indigo-100/50">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] shadow-inner">{selectedRows.length}</span>
                  Selected
                </div>
                {selectedRows.length === 1 && (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-full text-xs font-medium transition-colors">
                    <Pencil size={14} className="text-indigo-500" /> Edit
                  </button>
                )}
                <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-full text-xs font-medium transition-colors">
                  <Download size={14} className="text-indigo-500" /> Export
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1" />
                <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-full text-xs font-medium transition-colors">
                  <Trash size={14} className="text-red-500" /> Delete
                </button>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative max-w-sm w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search clients by name, tax ID, or email..." 
                  className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200/60 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-full text-sm font-medium outline-none transition-all placeholder:text-slate-400 text-slate-900 shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </motion.div>
            )}
          </div>
          
          {!selectedRows.length && (
            <motion.button 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              <Plus size={16} /> Add Client
            </motion.button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest w-12">
                  <button 
                    onClick={toggleAll}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      selectedRows.length > 0 && selectedRows.length === filteredClients.length 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                        : 'border-slate-300 hover:border-indigo-400 bg-white text-transparent'
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>
                </th>
                <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Client</th>
                <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Contact</th>
                <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Tax ID</th>
                <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Address</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const isSelected = selectedRows.includes(client.id);
                return (
                  <tr 
                    key={client.id} 
                    className={`group transition-all duration-200 border-b border-slate-100/50 last:border-0 hover:bg-white/60 cursor-pointer ${isSelected ? 'bg-indigo-50/50' : ''}`}
                    onClick={() => toggleRow(client.id)}
                  >
                    <td className="py-4 px-4">
                      <div 
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                            : 'border-slate-300 bg-white text-transparent group-hover:border-indigo-400'
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shadow-sm">
                          {client.name.charAt(0)}
                        </div>
                        <div className="font-semibold text-slate-800 text-sm">{client.name}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="text-sm font-medium text-slate-700">{client.email}</div>
                        <div className="text-xs text-slate-500">{client.phone}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-500 text-sm">
                      {client.taxId}
                    </td>
                    <td className="py-4 px-4 text-slate-500 text-sm truncate max-w-[200px]">
                      {client.address}
                    </td>
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm font-medium">
                    No records found for "{searchQuery}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Slide-over / Modal for New Client (Dummy) ── */}
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
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">New Client</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Building size={14} className="text-slate-400"/> Company Name
                  </label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="e.g. Acme Corp" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <FileText size={14} className="text-slate-400"/> Tax ID / Fiscal ID
                  </label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="e.g. US-12345678" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Mail size={14} className="text-slate-400"/> Email
                    </label>
                    <input type="email" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="contact@company.com" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Phone size={14} className="text-slate-400"/> Phone
                    </label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="+1 555-0100" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400"/> Billing Address
                  </label>
                  <textarea rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none" placeholder="Enter full address..."></textarea>
                </div>

              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-white transition-colors shadow-sm">
                  Cancel
                </button>
                <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                  Save Client
                </button>
              </div>
            </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
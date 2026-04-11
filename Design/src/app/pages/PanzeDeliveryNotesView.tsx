import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Pencil, Trash, Download, Check, X, 
  Calendar, Users, Archive, RefreshCcw, Truck, Package, MapPin
} from 'lucide-react';

/* ── Dummy Data ── */
const DUMMY_DELIVERY_NOTES = [
  { id: 1, noteNumber: 'DN-2023-001', clientName: 'Acme Corp', issueDate: 'Oct 16, 2023', deliveryDate: 'Oct 18, 2023', itemsCount: 12, status: 'Delivered', archived: false },
  { id: 2, noteNumber: 'DN-2023-002', clientName: 'TechFlow Inc.', issueDate: 'Oct 18, 2023', deliveryDate: 'Oct 20, 2023', itemsCount: 3, status: 'Dispatched', archived: false },
  { id: 3, noteNumber: 'DN-2023-003', clientName: 'Global Goods', issueDate: 'Oct 19, 2023', deliveryDate: 'Oct 21, 2023', itemsCount: 45, status: 'Draft', archived: false },
  { id: 4, noteNumber: 'DN-2023-004', clientName: 'Nexus Solutions', issueDate: 'Oct 20, 2023', deliveryDate: 'Oct 22, 2023', itemsCount: 1, status: 'Cancelled', archived: false },
  { id: 5, noteNumber: 'DN-2023-005', clientName: 'Bright Ideas LLC', issueDate: 'Oct 22, 2023', deliveryDate: 'Oct 24, 2023', itemsCount: 8, status: 'Delivered', archived: false },
  { id: 6, noteNumber: 'DN-2023-006', clientName: 'Cyberdyne Systems', issueDate: 'Oct 23, 2023', deliveryDate: 'Oct 25, 2023', itemsCount: 24, status: 'Dispatched', archived: false },
  { id: 7, noteNumber: 'DN-2022-099', clientName: 'Wayne Enterprises', issueDate: 'Jan 10, 2022', deliveryDate: 'Jan 12, 2022', itemsCount: 50, status: 'Cancelled', archived: true },
  { id: 8, noteNumber: 'DN-2022-042', clientName: 'Stark Industries', issueDate: 'Mar 05, 2022', deliveryDate: 'Mar 08, 2022', itemsCount: 120, status: 'Delivered', archived: true },
];

const STATUS_COLORS: Record<string, string> = {
  'Draft': 'bg-slate-100 text-slate-600 border-slate-200',
  'Dispatched': 'bg-amber-50 text-amber-600 border-amber-200',
  'Delivered': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  'Cancelled': 'bg-red-50 text-red-600 border-red-200',
};

export default function PanzeDeliveryNotesView() {
  const [activeTab, setActiveTab] = useState<'Active' | 'Archived'>('Active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredNotes = DUMMY_DELIVERY_NOTES.filter(n => {
    const matchesTab = activeTab === 'Active' ? !n.archived : n.archived;
    const matchesSearch = n.noteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.status.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const toggleRow = (id: number) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedRows.length === filteredNotes.length && filteredNotes.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredNotes.map(n => n.id));
    }
  };

  const handleTabChange = (tab: 'Active' | 'Archived') => {
    setActiveTab(tab);
    setSelectedRows([]);
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
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Delivery Notes</h2>
          <p className="text-sm text-slate-500 mt-1">Manage dispatch records, track shipments, and generate delivery proofs.</p>
        </div>
      </div>

      {/* ── Main Container ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col p-6">
        
        {/* Tabs */}
        <div className="flex gap-6 border-b border-slate-200 mb-6">
          <button 
            onClick={() => handleTabChange('Active')}
            className={`pb-3 text-sm font-semibold transition-colors relative ${
              activeTab === 'Active' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Active Deliveries
            {activeTab === 'Active' && (
              <motion.div layoutId="activeDeliveryTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
            )}
          </button>
          <button 
            onClick={() => handleTabChange('Archived')}
            className={`pb-3 text-sm font-semibold transition-colors relative ${
              activeTab === 'Archived' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Archived
            {activeTab === 'Archived' && (
              <motion.div layoutId="activeDeliveryTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
            )}
          </button>
        </div>

        {/* Action Bar */}
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
                {activeTab === 'Active' ? (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-full text-xs font-medium transition-colors">
                    <Archive size={14} className="text-slate-500" /> Archive
                  </button>
                ) : (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-full text-xs font-medium transition-colors">
                    <RefreshCcw size={14} className="text-slate-500" /> Restore
                  </button>
                )}
                <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-full text-xs font-medium transition-colors">
                  <Trash size={14} className="text-red-500" /> Delete
                </button>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative max-w-sm w-full flex items-center gap-3">
                <div className="relative w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search delivery notes..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-full text-sm font-medium outline-none transition-all placeholder:text-slate-400 text-slate-900 shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  onClick={toggleAll}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-full text-[11px] font-bold uppercase tracking-widest transition-colors"
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    selectedRows.length > 0 && selectedRows.length === filteredNotes.length 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                      : 'border-slate-300 bg-white text-transparent'
                  }`}>
                    <Check size={10} strokeWidth={3} />
                  </div>
                  Select All
                </button>
              </motion.div>
            )}
          </div>
          
          {!selectedRows.length && activeTab === 'Active' && (
            <motion.button 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              <Plus size={16} /> Create Note
            </motion.button>
          )}
        </div>

        {/* ── Cards Grid ── */}
        {filteredNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <AnimatePresence mode="popLayout">
              {filteredNotes.map((note) => {
                const isSelected = selectedRows.includes(note.id);
                return (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => toggleRow(note.id)}
                    className={`group relative flex flex-col bg-white border rounded-xl p-5 transition-all duration-200 cursor-pointer overflow-hidden ${
                      isSelected 
                        ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                        : 'border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                         <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{note.noteNumber}</span>
                         <span className="text-base font-bold text-slate-800 mt-1">{note.clientName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${STATUS_COLORS[note.status]}`}>
                           {note.status}
                         </span>
                         <div 
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                                : 'border-slate-300 bg-white text-transparent group-hover:border-indigo-400'
                            }`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </div>
                      </div>
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-end justify-between">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Truck size={12} /> Expected Delivery
                        </span>
                        <span className="text-sm font-semibold text-slate-600">{note.deliveryDate}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Package size={12} /> Total Items
                        </span>
                        <span className="text-xl font-bold text-slate-900 tracking-tight">{note.itemsCount}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-center mb-3">
              <Search className="text-slate-400" size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No delivery notes found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-[250px]">
              No records match your search in the {activeTab.toLowerCase()} folder.
            </p>
          </div>
        )}
      </div>

      {/* ── Slide-over Modal for New Delivery Note ── */}
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
                <h3 className="text-lg font-bold text-slate-900">Create Delivery Note</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Users size={14} className="text-slate-400"/> Recipient Client
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
                      <Truck size={14} className="text-slate-400"/> Expected Delivery
                    </label>
                    <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400"/> Delivery Address
                  </label>
                  <textarea rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none" placeholder="Enter full shipping address..."></textarea>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Package size={14} className="text-slate-400"/> Number of Items
                  </label>
                  <input type="number" min="1" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="e.g. 12" />
                </div>

              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-white transition-colors shadow-sm">
                  Cancel
                </button>
                <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                  Create Note
                </button>
              </div>
            </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

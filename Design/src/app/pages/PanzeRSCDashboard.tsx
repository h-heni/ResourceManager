import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip
} from 'recharts';
import {
  Activity, Zap, Clock, Truck, ShieldAlert,
  ArrowUpRight, Target, Database, CheckCircle2,
  AlertCircle, ChevronRight, Layers, Users
} from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

/* ── RSC Dashboard Data ── */

const capacityData = [
  { name: 'Deployed', value: 65, color: 'var(--color-indigo-600, #4F46E5)' },
  { name: 'In Transit', value: 20, color: 'var(--color-blue-500, #3B82F6)' },
  { name: 'Maintenance', value: 10, color: 'var(--color-slate-400, #94A3B8)' },
  { name: 'Standby', value: 5, color: 'var(--color-indigo-300, #93C5FD)' },
];

const timelineData = [
  { time: '08:00', load: 45 },
  { time: '10:00', load: 68 },
  { time: '12:00', load: 85 },
  { time: '14:00', load: 92 },
  { time: '16:00', load: 78 },
  { time: '18:00', load: 55 },
  { time: '20:00', load: 30 },
];

const activeDeployments = [
  { id: 'DEP-1042', client: 'Nexus Logistics', location: 'Sector 7G', status: 'Optimal', health: 98, time: '2h 15m' },
  { id: 'DEP-1043', client: 'Global Goods Inc.', location: 'Port Alpha', status: 'Warning', health: 65, time: '45m' },
  { id: 'DEP-1044', client: 'Aegis Defense', location: 'Site Beta', status: 'Optimal', health: 100, time: '5h 30m' },
  { id: 'DEP-1045', client: 'Stark Industries', location: 'HQ Node', status: 'Critical', health: 22, time: '12m' },
  { id: 'DEP-1046', client: 'Cyberdyne Systems', location: 'Grid Delta', status: 'Optimal', health: 95, time: '1h 10m' },
];

const systemLogs = [
  { id: 1, type: 'success', text: 'Fleet rerouted for optimal fuel efficiency.', time: 'Just now' },
  { id: 2, type: 'warning', text: 'Maintenance due for Unit #8042 in 48 hours.', time: '12m ago' },
  { id: 3, type: 'info', text: 'Supply chain sequence initiated for Sector 4.', time: '1h ago' },
  { id: 4, type: 'error', text: 'Telemetry lost on Transport 9. Attempting reconnect.', time: '2h ago' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function PanzeRSCDashboard() {
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-7xl mx-auto space-y-6"
    >
      {/* HEADER BANNER - Strict Solid Colors, Minimalist */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl bg-indigo-50 border border-indigo-100 text-slate-900 p-8 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-200 rounded-full opacity-50 -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-indigo-200 mb-5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-700">RSC Core Active</span>
            </div>
            <h2 className="text-4xl font-extrabold mb-3 tracking-tight text-slate-900">Resource Command Center</h2>
            <p className="text-slate-600 text-sm leading-relaxed font-medium">
              Live telemetry and deployment tracking. 94% of network capacity is currently utilized. System health is optimal.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-white border border-indigo-100 rounded-xl p-4 min-w-[140px] shadow-sm">
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Assets</div>
              <div className="text-3xl font-extrabold text-slate-900">1,204</div>
            </div>
            <div className="bg-white border border-indigo-100 rounded-xl p-4 min-w-[140px] shadow-sm">
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Uptime</div>
              <div className="text-3xl font-extrabold text-emerald-600">99.9%</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* PRIMARY KPI ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div variants={itemVariants} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100">
              <Activity className="text-indigo-600 w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 flex items-center gap-1">
              <ArrowUpRight w={12} h={12} /> 4.2%
            </span>
          </div>
          <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Throughput</div>
          <div className="text-3xl font-extrabold text-slate-900">482.5 <span className="text-lg text-slate-400">TB/s</span></div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100">
              <Users className="text-blue-600 w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 flex items-center gap-1">
              <ArrowUpRight w={12} h={12} /> 1.1%
            </span>
          </div>
          <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Active Personnel</div>
          <div className="text-3xl font-extrabold text-slate-900">842</div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center border border-amber-100">
              <Zap className="text-amber-600 w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100 flex items-center gap-1">
              Stable
            </span>
          </div>
          <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Power Draw</div>
          <div className="text-3xl font-extrabold text-slate-900">12.4 <span className="text-lg text-slate-400">MW</span></div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center border border-rose-100">
              <ShieldAlert className="text-rose-600 w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100 flex items-center gap-1">
              Requires Action
            </span>
          </div>
          <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Anomalies</div>
          <div className="text-3xl font-extrabold text-slate-900">3</div>
        </motion.div>
      </div>

      {/* COMPLEX BENTO ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Capacity Distribution */}
        <motion.div variants={itemVariants} className="lg:col-span-1 bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-slate-900">Asset Distribution</h3>
            <button className="text-indigo-600 text-sm font-semibold hover:underline">Details</button>
          </div>
          <div className="flex-1 min-h-[220px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={capacityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {capacityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-2xl font-extrabold text-slate-900">100%</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Allocated</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {capacityData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm shadow-inner" style={{ backgroundColor: item.color }} />
                <span className="text-xs font-semibold text-slate-600">{item.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* System Load Timeline */}
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Network Load Timeline</h3>
              <p className="text-xs text-slate-500 font-medium">Hourly utilization across all managed sectors</p>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-md border border-slate-200 hover:bg-slate-200 transition-colors">24h</button>
              <button className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-md border border-indigo-200 shadow-sm">7d</button>
            </div>
          </div>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600 }}
                />
                <Bar dataKey="load" radius={[4, 4, 0, 0]}>
                  {timelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.load > 80 ? 'var(--color-indigo-600, #4f46e5)' : 'var(--color-slate-300, #cbd5e1)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* DEPLOYMENT TABLE & LOGS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Deployments Table */}
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" />
              Active Deployments
            </h3>
            <button className="text-xs font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-1 transition-colors">
              View All <ChevronRight w={14} h={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4 pl-6">ID</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeDeployments.map((dep) => (
                  <tr 
                    key={dep.id} 
                    onClick={() => setSelectedRow(dep.id)}
                    className={`cursor-pointer transition-colors ${selectedRow === dep.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="p-4 pl-6 font-bold text-slate-900 text-sm">{dep.id}</td>
                    <td className="p-4 font-semibold text-slate-700 text-sm">{dep.client}</td>
                    <td className="p-4 text-slate-500 text-sm font-medium flex items-center gap-1.5">
                      <Target w={14} h={14} className="text-slate-400" />
                      {dep.location}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                        dep.status === 'Optimal' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        dep.status === 'Warning' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {dep.status === 'Optimal' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        {dep.status === 'Warning' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        {dep.status === 'Critical' && <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                        {dep.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm font-bold text-slate-900">{dep.health}%</span>
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${dep.health > 80 ? 'bg-emerald-500' : dep.health > 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                            style={{ width: `${dep.health}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Live System Log */}
        <motion.div variants={itemVariants} className="lg:col-span-1 bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              System Feed
            </h3>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              LIVE
            </div>
          </div>
          
          <div className="flex-1 space-y-5">
            {systemLogs.map((log) => (
              <div key={log.id} className="flex gap-3 items-start group">
                <div className="mt-0.5">
                  {log.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {log.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-500" />}
                  {log.type === 'info' && <Activity className="w-4 h-4 text-blue-500" />}
                  {log.type === 'error' && <ShieldAlert className="w-4 h-4 text-rose-500" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 leading-snug group-hover:text-slate-900 transition-colors">{log.text}</p>
                  <p className="text-xs font-medium text-slate-400 mt-1 flex items-center gap-1">
                    <Clock w={10} h={10} /> {log.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-sm rounded-lg transition-colors border border-slate-200">
            View Full Log
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

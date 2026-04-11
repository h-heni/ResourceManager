import { useNavigate } from 'react-router';
import { useEffect, useState, useRef } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  FileText, Database, GitMerge, Percent,
  Zap, DollarSign, TrendingUp,
  ShieldAlert, ArrowLeft, Bell, Settings,
  ChevronRight, ChevronDown, ChevronsLeft, ChevronsRight,
  Sparkles, Home, ArrowUpRight, Activity, Users,
  CircleCheck, Clock, Wallet, Receipt, Truck,
  Search, Plus, Pencil, Trash, Download, Check, X, MoreHorizontal, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import PanzeRSCDashboard from './PanzeRSCDashboard';
import PanzeClientsView from './PanzeClientsView';
import PanzeQuotesView from './PanzeQuotesView';
import PanzeDeliveryNotesView from './PanzeDeliveryNotesView';
import PanzeInvoicesView from './PanzeInvoicesView';
import '../styles/panze-dashboard.css';
import FormShowcase from '../components/panze/FormShowcase';

/* ====================================================================
   BILLFLOW — PREMIUM BILLING AUTOMATION DASHBOARD
   ==================================================================== */

/* ── Client / Profile images ── */
const profileImages = [
  'https://images.unsplash.com/photo-1576558656222-ba66febe3dec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWlsaW5nJTIwcHJvZmVzc2lvbmFsJTIwaGVhZHNob3R8ZW58MXx8fHwxNzczNjU1OTI1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  'https://images.unsplash.com/photo-1561518658-db43bb106aeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3Jwb3JhdGUlMjBidWlsZGluZyUyMGFic3RyYWN0fGVufDF8fHx8MTc3MzY2MDczMHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzM2NjAyMjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  'https://images.unsplash.com/photo-1648161235886-32b6764917e6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVkaXQlMjBjYXJkJTIwbW9uZXl8ZW58MXx8fHwxNzczNjYwNzMwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  'https://images.unsplash.com/photo-1762279389020-eeeb69c25813?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNlJTIwY2hhcnQlMjBhYnN0cmFjdHxlbnwxfHx8fDE3NzM2NjA3MzB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
];

/* ── Sparkline helper ── */
function sparklinePath(values: number[], w: number, h: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => ({
    x: i * step,
    y: h - ((v - min) / range) * (h - 6) - 3,
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { line, area };
}

/* ── Automation data ── */
const recentBills = [
  { id: 1, name: 'Acme Corp', sub: 'Invoice #INV-2903', img: profileImages[0], trend: 'Paid', statusColor: 'text-blue-500' },
  { id: 2, name: 'TechFlow Inc.', sub: 'Invoice #INV-2902', img: profileImages[1], trend: 'Pending', statusColor: 'text-indigo-400' },
  { id: 3, name: 'Global Goods', sub: 'Invoice #INV-2901', img: profileImages[2], trend: 'Paid', statusColor: 'text-blue-500' },
  { id: 4, name: 'Nexus Solutions', sub: 'Invoice #INV-2899', img: profileImages[3], trend: 'Overdue', statusColor: 'text-blue-600' },
  { id: 5, name: 'Bright Ideas LLC', sub: 'Invoice #INV-2895', img: profileImages[4], trend: 'Paid', statusColor: 'text-blue-500' },
  { id: 6, name: 'Cyberdyne', sub: 'Invoice #INV-2892', img: profileImages[0], trend: 'Paid', statusColor: 'text-blue-500' },
];

/* ── Pie chart data ── */
const pieData = [
  { name: 'Retainer Services', value: 35, color: 'var(--color-indigo-600, #4F46E5)' },
  { name: 'Software Subs', value: 25, color: 'var(--color-blue-500, #3B82F6)' },
  { name: 'One-off Projects', value: 20, color: 'var(--color-indigo-400, #818CF8)' },
  { name: 'Late Fees', value: 10, color: 'var(--color-blue-300, #93C5FD)' },
  { name: 'Other Services', value: 10, color: 'var(--color-slate-400, #A0AEC0)' },
];

/* ── Bar Chart Data ── */
const revenueData = [
  { month: 'Jan', revenue: 4000, expenses: 2400 },
  { month: 'Feb', revenue: 3000, expenses: 1398 },
  { month: 'Mar', revenue: 2000, expenses: 9800 },
  { month: 'Apr', revenue: 2780, expenses: 3908 },
  { month: 'May', revenue: 1890, expenses: 4800 },
  { month: 'Jun', revenue: 2390, expenses: 3800 },
  { month: 'Jul', revenue: 3490, expenses: 4300 },
];

/* ── Agent Live Feed ── */
const agentFeed = [
  { id: 1, icon: CircleCheck, text: 'Auto-billed Acme Corp for monthly retainer', time: 'Just now', color: 'text-blue-500' },
  { id: 2, icon: Receipt, text: 'Generated batch of 45 invoices for Q1', time: '2m ago', color: 'text-indigo-500' },
  { id: 3, icon: Clock, text: 'Sent payment reminder to Nexus Solutions', time: '15m ago', color: 'text-indigo-400' },
  { id: 4, icon: Wallet, text: 'Reconciled successful stripe payments', time: '1h ago', color: 'text-blue-500' },
];

/* ── Billing Table Mock Data ── */
const billingData = [
  { id: 101, client: 'Acme Corp', invoice: 'INV-2903', amount: '$4,500.00', date: 'Oct 12, 2023', status: 'Paid' },
  { id: 102, client: 'TechFlow Inc.', invoice: 'INV-2902', amount: '$1,250.00', date: 'Oct 11, 2023', status: 'Pending' },
  { id: 103, client: 'Global Goods', invoice: 'INV-2901', amount: '$8,900.00', date: 'Oct 10, 2023', status: 'Paid' },
  { id: 104, client: 'Nexus Solutions', invoice: 'INV-2899', amount: '$3,200.00', date: 'Oct 08, 2023', status: 'Overdue' },
  { id: 105, client: 'Bright Ideas LLC', invoice: 'INV-2895', amount: '$950.00', date: 'Oct 05, 2023', status: 'Paid' },
  { id: 106, client: 'Cyberdyne Systems', invoice: 'INV-2892', amount: '$12,400.00', date: 'Oct 02, 2023', status: 'Paid' },
  { id: 107, client: 'Wayne Enterprises', invoice: 'INV-2890', amount: '$2,100.00', date: 'Sep 29, 2023', status: 'Pending' },
  { id: 108, client: 'Stark Industries', invoice: 'INV-2888', amount: '$15,000.00', date: 'Sep 25, 2023', status: 'Overdue' },
];

/* ── Full Width Directory Data ── */
const directoryData = [
  { id: 201, employee: 'Sarah Jenkins', role: 'Senior Designer', department: 'Design', status: 'Active', utilization: '85%', location: 'New York' },
  { id: 202, employee: 'Marcus Chen', role: 'Frontend Engineer', department: 'Engineering', status: 'Active', utilization: '92%', location: 'San Francisco' },
  { id: 203, employee: 'Aisha Patel', role: 'Product Manager', department: 'Product', status: 'On Leave', utilization: '0%', location: 'London' },
  { id: 204, employee: 'David Kim', role: 'Backend Engineer', department: 'Engineering', status: 'Active', utilization: '100%', location: 'Remote' },
  { id: 205, employee: 'Elena Rodriguez', role: 'UX Researcher', department: 'Design', status: 'Active', utilization: '75%', location: 'Madrid' },
  { id: 206, employee: 'James Wilson', role: 'Data Scientist', department: 'Engineering', status: 'Active', utilization: '88%', location: 'Toronto' },
  { id: 207, employee: 'Chloe Smith', role: 'Marketing Lead', department: 'Marketing', status: 'Active', utilization: '60%', location: 'New York' },
];

/* ── Navigation ── */
type NavItem = { id?: string; icon: any; label: string; active: boolean; path: string; dot?: boolean; children?: { id?: string; icon: any; label: string; path: string }[] };
type NavSection = { section: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    section: 'SALES',
    items: [
      {
        id: 'sales-group',
        icon: DollarSign,
        label: 'Sales',
        active: false,
        path: '',
        children: [
          { id: 'clients', icon: Users, label: 'Clients', path: '' },
          { id: 'quotes', icon: FileText, label: 'Quotes', path: '' },
          { id: 'delivery-notes', icon: Truck, label: 'Delivery Notes', path: '' },
          { id: 'invoices', icon: Receipt, label: 'Invoices', path: '' }
        ]
      },
    ]
  },
  {
    section: 'CONFIG',
    items: [
      { 
        icon: FileText,           
        label: 'Templates',        
        active: false, 
        path: '',
        children: [
          { icon: FileText, label: 'Invoice Templates', path: '' },
          { icon: FileText, label: 'Receipts', path: '' }
        ]
      },
      { icon: Database,           label: 'Data Sources',     active: false, path: '' },
      { icon: GitMerge,           label: 'Workflows',        active: false, path: '' },
      { icon: Percent,            label: 'Tax Rules',        active: false, path: '' },
    ],
  },
  {
    section: 'AUTOMATION',
    items: [
      { 
        icon: Zap,                
        label: 'Triggers & Rules', 
        active: false, 
        path: '',
        children: [
          { icon: Activity, label: 'Active Rules', path: '' },
          { icon: Clock, label: 'Schedules', path: '' }
        ]
      },
    ],
  },
  {
    section: 'INSIGHTS',
    items: [
      { icon: DollarSign,         label: 'Revenue Streams',  active: false, path: '' },
      { icon: TrendingUp,         label: 'Billing Analytics',active: true,  path: '/new-dashboard' },
    ],
  },
  {
    section: 'SUPPORT',
    items: [
      { icon: ShieldAlert,        label: 'Dispute Center',   active: false, path: '/landing', dot: true },
    ],
  },
];

/* ── Gauge component ── */
function CollectionsGauge({ value }: { value: number }) {
  const r = 60;
  const cx = 70;
  const cy = 70;
  const startAngle = Math.PI;
  const endAngle = 0;
  const totalAngle = startAngle - endAngle;
  const filledAngle = startAngle - (value / 100) * totalAngle;

  const describeArc = (start: number, end: number) => {
    const x1 = cx + r * Math.cos(start);
    const y1 = cy - r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy - r * Math.sin(end);
    const large = Math.abs(start - end) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center py-2 relative group">
      <svg width={140} height={80} viewBox="0 0 140 80" className="transition-transform duration-500 group-hover:scale-105">
        <defs>
          <linearGradient id="gaugeGradPremium" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-indigo-600, #4F46E5)" />
            <stop offset="100%" stopColor="var(--color-indigo-400, #818CF8)" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path d={describeArc(startAngle, endAngle)} fill="none" stroke="#F1F5F9" strokeWidth={12} strokeLinecap="round" />
        {/* Filled */}
        <motion.path 
          d={describeArc(startAngle, filledAngle)} 
          fill="none" 
          stroke="url(#gaugeGradPremium)" 
          strokeWidth={12} 
          strokeLinecap="round" 
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="text-3xl font-bold text-slate-900 -mt-6 tracking-tight">{value}%</div>
      <div className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-widest">Collection Rate</div>
    </div>
  );
}

/* ── PALETTES ────────────────────────────────────────── */
const THEME_PALETTES = {
  classic: {
    id: 'classic',
    name: 'Classic BillFlow',
    primary: '#4F46E5', // Indigo 600
    secondary: '#3B82F6', // Blue 500
    css: `
      /* Default Tailwind Indigo and Blue */
    `
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Blue',
    primary: '#0284c7', // Sky 600
    secondary: '#2563eb', // Blue 600
    css: `
      .panze-shell {
        --color-indigo-50: #f0f9ff;
        --color-indigo-100: #e0f2fe;
        --color-indigo-200: #bae6fd;
        --color-indigo-300: #7dd3fc;
        --color-indigo-400: #38bdf8;
        --color-indigo-500: #0ea5e9;
        --color-indigo-600: #0284c7;
        --color-indigo-700: #0369a1;
        --color-indigo-800: #075985;
        --color-indigo-900: #0c4a6e;
        --color-indigo-950: #082f49;
        
        --color-blue-50: #eff6ff;
        --color-blue-100: #dbeafe;
        --color-blue-200: #bfdbfe;
        --color-blue-300: #93c5fd;
        --color-blue-400: #60a5fa;
        --color-blue-500: #3b82f6;
        --color-blue-600: #2563eb;
        --color-blue-700: #1d4ed8;
        --color-blue-800: #1e40af;
        --color-blue-900: #1e3a8a;
        --color-blue-950: #172554;
      }
    `
  },
  cobalt: {
    id: 'cobalt',
    name: 'Cobalt & Slate',
    primary: '#2563eb', // Blue 600
    secondary: '#475569', // Slate 600
    css: `
      .panze-shell {
        --color-indigo-50: #eff6ff;
        --color-indigo-100: #dbeafe;
        --color-indigo-200: #bfdbfe;
        --color-indigo-300: #93c5fd;
        --color-indigo-400: #60a5fa;
        --color-indigo-500: #3b82f6;
        --color-indigo-600: #2563eb;
        --color-indigo-700: #1d4ed8;
        --color-indigo-800: #1e40af;
        --color-indigo-900: #1e3a8a;
        --color-indigo-950: #172554;
        
        --color-blue-50: #f8fafc;
        --color-blue-100: #f1f5f9;
        --color-blue-200: #e2e8f0;
        --color-blue-300: #cbd5e1;
        --color-blue-400: #94a3b8;
        --color-blue-500: #64748b;
        --color-blue-600: #475569;
        --color-blue-700: #334155;
        --color-blue-800: #1e293b;
        --color-blue-900: #0f172a;
        --color-blue-950: #020617;
      }
    `
  },
  royal: {
    id: 'royal',
    name: 'Royal Blue',
    primary: '#1D4ED8', // Blue 700
    secondary: '#4338CA', // Indigo 700
    css: `
      .panze-shell {
        --color-indigo-50: #e0e7ff;
        --color-indigo-100: #c7d2fe;
        --color-indigo-200: #a5b4fc;
        --color-indigo-300: #818cf8;
        --color-indigo-400: #6366f1;
        --color-indigo-500: #4f46e5;
        --color-indigo-600: #4338ca;
        --color-indigo-700: #3730a3;
        --color-indigo-800: #312e81;
        --color-indigo-900: #312e81;
        --color-indigo-950: #1e1b4b;

        --color-blue-50: #eff6ff;
        --color-blue-100: #dbeafe;
        --color-blue-200: #bfdbfe;
        --color-blue-300: #93c5fd;
        --color-blue-400: #60a5fa;
        --color-blue-500: #3b82f6;
        --color-blue-600: #2563eb;
        --color-blue-700: #1d4ed8;
        --color-blue-800: #1e40af;
        --color-blue-900: #1e3a8a;
        --color-blue-950: #172554;
      }
    `
  },
  frost: {
    id: 'frost',
    name: 'Arctic Frost',
    primary: '#0369A1', // Sky 700
    secondary: '#0F172A', // Slate 900
    css: `
      .panze-shell {
        --color-indigo-50: #f0f9ff;
        --color-indigo-100: #e0f2fe;
        --color-indigo-200: #bae6fd;
        --color-indigo-300: #7dd3fc;
        --color-indigo-400: #38bdf8;
        --color-indigo-500: #0ea5e9;
        --color-indigo-600: #0284c7;
        --color-indigo-700: #0369a1;
        --color-indigo-800: #075985;
        --color-indigo-900: #0c4a6e;
        --color-indigo-950: #082f49;

        --color-blue-50: #f8fafc;
        --color-blue-100: #f1f5f9;
        --color-blue-200: #e2e8f0;
        --color-blue-300: #cbd5e1;
        --color-blue-400: #94a3b8;
        --color-blue-500: #64748b;
        --color-blue-600: #475569;
        --color-blue-700: #334155;
        --color-blue-800: #1e293b;
        --color-blue-900: #0f172a;
        --color-blue-950: #020617;
      }
    `
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Green',
    primary: '#10B981', // Emerald 500
    secondary: '#059669', // Emerald 600
    css: `
      .panze-shell {
        --color-indigo-50: #ecfdf5;
        --color-indigo-100: #d1fae5;
        --color-indigo-200: #a7f3d0;
        --color-indigo-300: #6ee7b7;
        --color-indigo-400: #34d399;
        --color-indigo-500: #10b981;
        --color-indigo-600: #059669;
        --color-indigo-700: #047857;
        --color-indigo-800: #065f46;
        --color-indigo-900: #064e3b;
        --color-indigo-950: #022c22;
        
        --color-blue-50: #f0fdf4;
        --color-blue-100: #dcfce7;
        --color-blue-200: #bbf7d0;
        --color-blue-300: #86efac;
        --color-blue-400: #4ade80;
        --color-blue-500: #22c55e;
        --color-blue-600: #16a34a;
        --color-blue-700: #15803d;
        --color-blue-800: #166534;
        --color-blue-900: #14532d;
        --color-blue-950: #052e16;
      }
    `
  },
  amethyst: {
    id: 'amethyst',
    name: 'Amethyst Purple',
    primary: '#8B5CF6', // Violet 500
    secondary: '#7C3AED', // Violet 600
    css: `
      .panze-shell {
        --color-indigo-50: #f5f3ff;
        --color-indigo-100: #ede9fe;
        --color-indigo-200: #ddd6fe;
        --color-indigo-300: #c4b5fd;
        --color-indigo-400: #a78bfa;
        --color-indigo-500: #8b5cf6;
        --color-indigo-600: #7c3aed;
        --color-indigo-700: #6d28d9;
        --color-indigo-800: #5b21b6;
        --color-indigo-900: #4c1d95;
        --color-indigo-950: #2e1065;
        
        --color-blue-50: #faf5ff;
        --color-blue-100: #f3e8ff;
        --color-blue-200: #e9d5ff;
        --color-blue-300: #d8b4fe;
        --color-blue-400: #c084fc;
        --color-blue-500: #a855f7;
        --color-blue-600: #9333ea;
        --color-blue-700: #7e22ce;
        --color-blue-800: #6b21a8;
        --color-blue-900: #581c87;
        --color-blue-950: #3b0764;
      }
    `
  },
  rose: {
    id: 'rose',
    name: 'Rose Quartz',
    primary: '#F43F5E', // Rose 500
    secondary: '#E11D48', // Rose 600
    css: `
      .panze-shell {
        --color-indigo-50: #fff1f2;
        --color-indigo-100: #ffe4e6;
        --color-indigo-200: #fecdd3;
        --color-indigo-300: #fda4af;
        --color-indigo-400: #fb7185;
        --color-indigo-500: #f43f5e;
        --color-indigo-600: #e11d48;
        --color-indigo-700: #be123c;
        --color-indigo-800: #9f1239;
        --color-indigo-900: #881337;
        --color-indigo-950: #4c0519;
        
        --color-blue-50: #fdf2f8;
        --color-blue-100: #fae8ff;
        --color-blue-200: #f3ccff;
        --color-blue-300: #e8a0ff;
        --color-blue-400: #d946ef;
        --color-blue-500: #c026d3;
        --color-blue-600: #a21caf;
        --color-blue-700: #86198f;
        --color-blue-800: #701a75;
        --color-blue-900: #5e1a60;
        --color-blue-950: #3b0764;
      }
    `
  },
  amber: {
    id: 'amber',
    name: 'Amber Glow',
    primary: '#F59E0B', // Amber 500
    secondary: '#D97706', // Amber 600
    css: `
      .panze-shell {
        --color-indigo-50: #fffbeb;
        --color-indigo-100: #fef3c7;
        --color-indigo-200: #fde68a;
        --color-indigo-300: #fcd34d;
        --color-indigo-400: #fbbf24;
        --color-indigo-500: #f59e0b;
        --color-indigo-600: #d97706;
        --color-indigo-700: #b45309;
        --color-indigo-800: #92400e;
        --color-indigo-900: #78350f;
        --color-indigo-950: #451a03;
        
        --color-blue-50: #ffedd5;
        --color-blue-100: #ffedd5;
        --color-blue-200: #fed7aa;
        --color-blue-300: #fdba74;
        --color-blue-400: #fb923c;
        --color-blue-500: #f97316;
        --color-blue-600: #ea580c;
        --color-blue-700: #c2410c;
        --color-blue-800: #9a3412;
        --color-blue-900: #7c2d12;
        --color-blue-950: #431407;
      }
    `
  },
  grey: {
    id: 'grey',
    name: 'Slate Grey',
    primary: '#64748B', // Slate 500
    secondary: '#475569', // Slate 600
    css: `
      .panze-shell {
        --color-indigo-50: #f8fafc;
        --color-indigo-100: #f1f5f9;
        --color-indigo-200: #e2e8f0;
        --color-indigo-300: #cbd5e1;
        --color-indigo-400: #94a3b8;
        --color-indigo-500: #64748b;
        --color-indigo-600: #475569;
        --color-indigo-700: #334155;
        --color-indigo-800: #1e293b;
        --color-indigo-900: #0f172a;
        --color-indigo-950: #020617;
        
        --color-blue-50: #f8fafc;
        --color-blue-100: #f1f5f9;
        --color-blue-200: #e2e8f0;
        --color-blue-300: #cbd5e1;
        --color-blue-400: #94a3b8;
        --color-blue-500: #64748b;
        --color-blue-600: #475569;
        --color-blue-700: #334155;
        --color-blue-800: #1e293b;
        --color-blue-900: #0f172a;
        --color-blue-950: #020617;
      }
    `
  },
  black: {
    id: 'black',
    name: 'Obsidian Black',
    primary: '#18181B', // Zinc 900
    secondary: '#09090B', // Zinc 950
    css: `
      .panze-shell {
        --color-indigo-50: #fafafa;
        --color-indigo-100: #f4f4f5;
        --color-indigo-200: #e4e4e7;
        --color-indigo-300: #d4d4d8;
        --color-indigo-400: #a1a1aa;
        --color-indigo-500: #71717a;
        --color-indigo-600: #52525b;
        --color-indigo-700: #3f3f46;
        --color-indigo-800: #27272a;
        --color-indigo-900: #18181b;
        --color-indigo-950: #09090b;
        
        --color-blue-50: #fafafa;
        --color-blue-100: #f4f4f5;
        --color-blue-200: #e4e4e7;
        --color-blue-300: #d4d4d8;
        --color-blue-400: #a1a1aa;
        --color-blue-500: #71717a;
        --color-blue-600: #52525b;
        --color-blue-700: #3f3f46;
        --color-blue-800: #27272a;
        --color-blue-900: #18181b;
        --color-blue-950: #09090b;
      }
    `
  },
  pastel: {
    id: 'pastel',
    name: 'Pastel Dream',
    primary: '#A78BFA', // Violet 400
    secondary: '#F472B6', // Pink 400
    css: `
      .panze-shell {
        --color-indigo-50: #faf5ff;
        --color-indigo-100: #f3e8ff;
        --color-indigo-200: #e9d5ff;
        --color-indigo-300: #d8b4fe;
        --color-indigo-400: #c084fc;
        --color-indigo-500: #a855f7;
        --color-indigo-600: #9333ea;
        --color-indigo-700: #7e22ce;
        --color-indigo-800: #6b21a8;
        --color-indigo-900: #581c87;
        --color-indigo-950: #3b0764;
        
        --color-blue-50: #fdf2f8;
        --color-blue-100: #fce7f3;
        --color-blue-200: #fbcfe8;
        --color-blue-300: #f9a8d4;
        --color-blue-400: #f472b6;
        --color-blue-500: #ec4899;
        --color-blue-600: #db2777;
        --color-blue-700: #be185d;
        --color-blue-800: #9d174d;
        --color-blue-900: #831843;
        --color-blue-950: #500724;
      }
    `
  },
  mint: {
    id: 'mint',
    name: 'Soft Mint',
    primary: '#34D399', // Emerald 400
    secondary: '#2DD4BF', // Teal 400
    css: `
      .panze-shell {
        --color-indigo-50: #ecfdf5;
        --color-indigo-100: #d1fae5;
        --color-indigo-200: #a7f3d0;
        --color-indigo-300: #6ee7b7;
        --color-indigo-400: #34d399;
        --color-indigo-500: #10b981;
        --color-indigo-600: #059669;
        --color-indigo-700: #047857;
        --color-indigo-800: #065f46;
        --color-indigo-900: #064e3b;
        --color-indigo-950: #022c22;
        
        --color-blue-50: #f0fdfa;
        --color-blue-100: #ccfbf1;
        --color-blue-200: #99f6e4;
        --color-blue-300: #5eead4;
        --color-blue-400: #2dd4bf;
        --color-blue-500: #14b8a6;
        --color-blue-600: #0d9488;
        --color-blue-700: #0f766e;
        --color-blue-800: #115e59;
        --color-blue-900: #134e4a;
        --color-blue-950: #042f2e;
      }
    `
  },
  peach: {
    id: 'peach',
    name: 'Peach Bliss',
    primary: '#FB923C', // Orange 400
    secondary: '#F87171', // Red 400
    css: `
      .panze-shell {
        --color-indigo-50: #fff7ed;
        --color-indigo-100: #ffedd5;
        --color-indigo-200: #fed7aa;
        --color-indigo-300: #fdba74;
        --color-indigo-400: #fb923c;
        --color-indigo-500: #f97316;
        --color-indigo-600: #ea580c;
        --color-indigo-700: #c2410c;
        --color-indigo-800: #9a3412;
        --color-indigo-900: #7c2d12;
        --color-indigo-950: #431407;
        
        --color-blue-50: #fef2f2;
        --color-blue-100: #fee2e2;
        --color-blue-200: #fecaca;
        --color-blue-300: #fca5a5;
        --color-blue-400: #f87171;
        --color-blue-500: #ef4444;
        --color-blue-600: #dc2626;
        --color-blue-700: #b91c1c;
        --color-blue-800: #991b1b;
        --color-blue-900: #7f1d1d;
        --color-blue-950: #450a0a;
      }
    `
  },
  lavender: {
    id: 'lavender',
    name: 'Lavender',
    primary: '#818CF8', // Indigo 400
    secondary: '#A78BFA', // Violet 400
    css: `
      .panze-shell {
        --color-indigo-50: #f5f3ff;
        --color-indigo-100: #ede9fe;
        --color-indigo-200: #ddd6fe;
        --color-indigo-300: #c4b5fd;
        --color-indigo-400: #a78bfa;
        --color-indigo-500: #8b5cf6;
        --color-indigo-600: #7c3aed;
        --color-indigo-700: #6d28d9;
        --color-indigo-800: #5b21b6;
        --color-indigo-900: #4c1d95;
        --color-indigo-950: #2e1065;
        
        --color-blue-50: #eef2ff;
        --color-blue-100: #e0e7ff;
        --color-blue-200: #c7d2fe;
        --color-blue-300: #a5b4fc;
        --color-blue-400: #818cf8;
        --color-blue-500: #6366f1;
        --color-blue-600: #4f46e5;
        --color-blue-700: #4338ca;
        --color-blue-800: #3730a3;
        --color-blue-900: #312e81;
        --color-blue-950: #1e1b4b;
      }
    `
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Red',
    primary: '#DC2626', // Red 600
    secondary: '#B91C1C', // Red 700
    css: `
      .panze-shell {
        --color-indigo-50: #fef2f2;
        --color-indigo-100: #fee2e2;
        --color-indigo-200: #fecaca;
        --color-indigo-300: #fca5a5;
        --color-indigo-400: #f87171;
        --color-indigo-500: #ef4444;
        --color-indigo-600: #dc2626;
        --color-indigo-700: #b91c1c;
        --color-indigo-800: #991b1b;
        --color-indigo-900: #7f1d1d;
        --color-indigo-950: #450a0a;
        
        --color-blue-50: #fff1f2;
        --color-blue-100: #ffe4e6;
        --color-blue-200: #fecdd3;
        --color-blue-300: #fda4af;
        --color-blue-400: #fb7185;
        --color-blue-500: #f43f5e;
        --color-blue-600: #e11d48;
        --color-blue-700: #be123c;
        --color-blue-800: #9f1239;
        --color-blue-900: #881337;
        --color-blue-950: #4c0519;
      }
    `
  },
  forest: {
    id: 'forest',
    name: 'Deep Forest',
    primary: '#15803D', // Green 700
    secondary: '#166534', // Green 800
    css: `
      .panze-shell {
        --color-indigo-50: #f0fdf4;
        --color-indigo-100: #dcfce7;
        --color-indigo-200: #bbf7d0;
        --color-indigo-300: #86efac;
        --color-indigo-400: #4ade80;
        --color-indigo-500: #22c55e;
        --color-indigo-600: #16a34a;
        --color-indigo-700: #15803d;
        --color-indigo-800: #166534;
        --color-indigo-900: #14532d;
        --color-indigo-950: #052e16;
        
        --color-blue-50: #ecfdf5;
        --color-blue-100: #d1fae5;
        --color-blue-200: #a7f3d0;
        --color-blue-300: #6ee7b7;
        --color-blue-400: #34d399;
        --color-blue-500: #10b981;
        --color-blue-600: #059669;
        --color-blue-700: #047857;
        --color-blue-800: #065f46;
        --color-blue-900: #064e3b;
        --color-blue-950: #022c22;
      }
    `
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Orange',
    primary: '#EA580C', // Orange 600
    secondary: '#C2410C', // Orange 700
    css: `
      .panze-shell {
        --color-indigo-50: #ffedd5;
        --color-indigo-100: #ffedd5;
        --color-indigo-200: #fed7aa;
        --color-indigo-300: #fdba74;
        --color-indigo-400: #fb923c;
        --color-indigo-500: #f97316;
        --color-indigo-600: #ea580c;
        --color-indigo-700: #c2410c;
        --color-indigo-800: #9a3412;
        --color-indigo-900: #7c2d12;
        --color-indigo-950: #431407;
        
        --color-blue-50: #fef2f2;
        --color-blue-100: #fee2e2;
        --color-blue-200: #fecaca;
        --color-blue-300: #fca5a5;
        --color-blue-400: #f87171;
        --color-blue-500: #ef4444;
        --color-blue-600: #dc2626;
        --color-blue-700: #b91c1c;
        --color-blue-800: #991b1b;
        --color-blue-900: #7f1d1d;
        --color-blue-950: #450a0a;
      }
    `
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    primary: '#334155', // Slate 700
    secondary: '#1E293B', // Slate 800
    css: `
      .panze-shell {
        --color-indigo-50: #f8fafc;
        --color-indigo-100: #f1f5f9;
        --color-indigo-200: #e2e8f0;
        --color-indigo-300: #cbd5e1;
        --color-indigo-400: #94a3b8;
        --color-indigo-500: #64748b;
        --color-indigo-600: #475569;
        --color-indigo-700: #334155;
        --color-indigo-800: #1e293b;
        --color-indigo-900: #0f172a;
        --color-indigo-950: #020617;
        
        --color-blue-50: #f1f5f9;
        --color-blue-100: #e2e8f0;
        --color-blue-200: #cbd5e1;
        --color-blue-300: #94a3b8;
        --color-blue-400: #64748b;
        --color-blue-500: #475569;
        --color-blue-600: #334155;
        --color-blue-700: #1e293b;
        --color-blue-800: #0f172a;
        --color-blue-900: #020617;
        --color-blue-950: #000000;
      }
    `
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Neon',
    primary: '#06B6D4', // Teal 500
    secondary: '#8B5CF6', // Violet 500
    css: `
      .panze-shell {
        --color-indigo-50: #f0fdfa;
        --color-indigo-100: #ccfbf1;
        --color-indigo-200: #99f6e4;
        --color-indigo-300: #5eead4;
        --color-indigo-400: #2dd4bf;
        --color-indigo-500: #14b8a6;
        --color-indigo-600: #0d9488;
        --color-indigo-700: #0f766e;
        --color-indigo-800: #115e59;
        --color-indigo-900: #134e4a;
        --color-indigo-950: #042f2e;
        
        --color-blue-50: #f5f3ff;
        --color-blue-100: #ede9fe;
        --color-blue-200: #ddd6fe;
        --color-blue-300: #c4b5fd;
        --color-blue-400: #a78bfa;
        --color-blue-500: #8b5cf6;
        --color-blue-600: #7c3aed;
        --color-blue-700: #6d28d9;
        --color-blue-800: #5b21b6;
        --color-blue-900: #4c1d95;
        --color-blue-950: #2e1065;
      }
    `
  },
  grape: {
    id: 'grape',
    name: 'Grape Purple',
    primary: '#9333EA', // Purple 600
    secondary: '#7E22CE', // Purple 700
    css: `
      .panze-shell {
        --color-indigo-50: #faf5ff;
        --color-indigo-100: #f3e8ff;
        --color-indigo-200: #e9d5ff;
        --color-indigo-300: #d8b4fe;
        --color-indigo-400: #c084fc;
        --color-indigo-500: #a855f7;
        --color-indigo-600: #9333ea;
        --color-indigo-700: #7e22ce;
        --color-indigo-800: #6b21a8;
        --color-indigo-900: #581c87;
        --color-indigo-950: #3b0764;
        
        --color-blue-50: #fdf2f8;
        --color-blue-100: #fce7f3;
        --color-blue-200: #fbcfe8;
        --color-blue-300: #f9a8d4;
        --color-blue-400: #f472b6;
        --color-blue-500: #ec4899;
        --color-blue-600: #db2777;
        --color-blue-700: #be185d;
        --color-blue-800: #9d174d;
        --color-blue-900: #831843;
        --color-blue-950: #500724;
      }
    `
  },
  teal: {
    id: 'teal',
    name: 'Deep Teal',
    primary: '#0D9488', // Teal 600
    secondary: '#0F766E', // Teal 700
    css: `
      .panze-shell {
        --color-indigo-50: #f0fdfa;
        --color-indigo-100: #ccfbf1;
        --color-indigo-200: #99f6e4;
        --color-indigo-300: #5eead4;
        --color-indigo-400: #2dd4bf;
        --color-indigo-500: #14b8a6;
        --color-indigo-600: #0d9488;
        --color-indigo-700: #0f766e;
        --color-indigo-800: #115e59;
        --color-indigo-900: #134e4a;
        --color-indigo-950: #042f2e;
        
        --color-blue-50: #ecfdf5;
        --color-blue-100: #d1fae5;
        --color-blue-200: #a7f3d0;
        --color-blue-300: #6ee7b7;
        --color-blue-400: #34d399;
        --color-blue-500: #10b981;
        --color-blue-600: #059669;
        --color-blue-700: #047857;
        --color-blue-800: #065f46;
        --color-blue-900: #064e3b;
        --color-blue-950: #022c22;
      }
    `
  },
  coffee: {
    id: 'coffee',
    name: 'Coffee Brown',
    primary: '#78350F', // Amber 900
    secondary: '#451A03', // Amber 950
    css: `
      .panze-shell {
        --color-indigo-50: #fffbeb;
        --color-indigo-100: #fef3c7;
        --color-indigo-200: #fde68a;
        --color-indigo-300: #fcd34d;
        --color-indigo-400: #fbbf24;
        --color-indigo-500: #f59e0b;
        --color-indigo-600: #d97706;
        --color-indigo-700: #b45309;
        --color-indigo-800: #92400e;
        --color-indigo-900: #78350f;
        --color-indigo-950: #451a03;
        
        --color-blue-50: #fafaf9;
        --color-blue-100: #f5f5f4;
        --color-blue-200: #e7e5e4;
        --color-blue-300: #d6d3d1;
        --color-blue-400: #a8a29e;
        --color-blue-500: #78716c;
        --color-blue-600: #57534e;
        --color-blue-700: #44403c;
        --color-blue-800: #292524;
        --color-blue-900: #1c1917;
        --color-blue-950: #0c0a09;
      }
    `
  },
  gold: {
    id: 'gold',
    name: 'Rich Gold',
    primary: '#EAB308', // Amber 500
    secondary: '#CA8A04', // Amber 600
    css: `
      .panze-shell {
        --color-indigo-50: #fefce8;
        --color-indigo-100: #fef9c3;
        --color-indigo-200: #fef08a;
        --color-indigo-300: #fde047;
        --color-indigo-400: #facc15;
        --color-indigo-500: #eab308;
        --color-indigo-600: #ca8a04;
        --color-indigo-700: #a16207;
        --color-indigo-800: #854d0e;
        --color-indigo-900: #713f12;
        --color-indigo-950: #422006;
        
        --color-blue-50: #fffbeb;
        --color-blue-100: #fef3c7;
        --color-blue-200: #fde68a;
        --color-blue-300: #fcd34d;
        --color-blue-400: #fbbf24;
        --color-blue-500: #f59e0b;
        --color-blue-600: #d97706;
        --color-blue-700: #b45309;
        --color-blue-800: #92400e;
        --color-blue-900: #78350f;
        --color-blue-950: #451a03;
      }
    `
  },
  matcha: {
    id: 'matcha',
    name: 'Matcha Green',
    primary: '#65A30D', // Lime 600
    secondary: '#4D7C0F', // Lime 700
    css: `
      .panze-shell {
        --color-indigo-50: #f7fee7;
        --color-indigo-100: #ecfccb;
        --color-indigo-200: #d9f99d;
        --color-indigo-300: #bef264;
        --color-indigo-400: #a3e635;
        --color-indigo-500: #84cc16;
        --color-indigo-600: #65a30d;
        --color-indigo-700: #4d7c0f;
        --color-indigo-800: #3f6212;
        --color-indigo-900: #365314;
        --color-indigo-950: #1a2e05;
        
        --color-blue-50: #f0fdf4;
        --color-blue-100: #dcfce7;
        --color-blue-200: #bbf7d0;
        --color-blue-300: #86efac;
        --color-blue-400: #4ade80;
        --color-blue-500: #22c55e;
        --color-blue-600: #16a34a;
        --color-blue-700: #15803d;
        --color-blue-800: #166534;
        --color-blue-900: #14532d;
        --color-blue-950: #052e16;
      }
    `
  }
};

/* ── MAIN COMPONENT ────────────────────────────────────────── */

export default function PanzeDashboard() {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [expandedNav, setExpandedNav] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<string>('dashboard');
  const submenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Theme Palette State
  const [activePalette, setActivePalette] = useState<keyof typeof THEME_PALETTES>('classic');
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);

  // Table State
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDirRows, setSelectedDirRows] = useState<number[]>([]);
  const [dirSearchQuery, setDirSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const toggleRow = (id: number) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedRows.length === billingData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(billingData.map(d => d.id));
    }
  };

  const toggleDirRow = (id: number) => {
    setSelectedDirRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const toggleAllDir = () => {
    if (selectedDirRows.length === directoryData.length) {
      setSelectedDirRows([]);
    } else {
      setSelectedDirRows(directoryData.map(d => d.id));
    }
  };

  const filteredData = billingData.filter(item => 
    item.client.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.invoice.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDirData = directoryData.filter(item => 
    item.employee.toLowerCase().includes(dirSearchQuery.toLowerCase()) || 
    item.department.toLowerCase().includes(dirSearchQuery.toLowerCase()) ||
    item.role.toLowerCase().includes(dirSearchQuery.toLowerCase())
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = '';
    };
  }, []);

  const sparkIndigo = [30, 45, 35, 50, 42, 55, 48, 62, 56, 80];
  const sparkBlue = [20, 28, 35, 32, 45, 42, 52, 48, 55, 68];
  const sparkOrange = [10, 15, 22, 18, 25, 30, 28, 35, 40, 45];

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className={`panze-shell ${sidebarCollapsed ? 'panze-sidebar-collapsed' : ''}`}>
      <style>{THEME_PALETTES[activePalette].css}</style>

      {/* ══════════════ MAIN WHITE CONTAINER ══════════════ */}
      <div className="panze-container relative">

        {/* ══════════════ SIDEBAR ══════════════ */}
        <nav className="panze-sidebar relative z-20" ref={sidebarRef}>
          {/* Logo */}
          <div className="panze-sidebar-top">
            <div className="panze-logo">
              <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center text-white">
                <Sparkles size={16} />
              </div>
              {!sidebarCollapsed && <span className="font-bold tracking-tight text-slate-800">billflow.ai</span>}
            </div>
          </div>

          {/* Nav */}
          <div className="panze-nav">
            {!sidebarCollapsed && (
              <button 
                className={`panze-nav-item ${activeView === 'dashboard' ? 'active' : ''}`} 
                style={{ marginBottom: 4 }}
                onClick={() => setActiveView('dashboard')}
              >
                <span className="panze-nav-icon"><Target size={18} /></span>
                <span className="panze-nav-label">Command Center</span>
              </button>
            )}
            {sidebarCollapsed && (
              <button 
                className={`panze-nav-item ${activeView === 'dashboard' ? 'active' : ''}`} 
                title="Command Center"
                onClick={() => setActiveView('dashboard')}
              >
                <span className="panze-nav-icon"><Target size={20} /></span>
              </button>
            )}

            {navSections.map((section) => (
              <div key={section.section} className="flex flex-col gap-1.5 mb-2">
                {!sidebarCollapsed && (
                  <div className="panze-nav-section">{section.section}</div>
                )}
                {section.items.map((item) => {
                  const hasChildren = !!item.children && item.children.length > 0;
                  const isExpanded = expandedNav === item.label || (hasChildren && item.children!.some(c => c.id === activeView));
                  const isActive = activeView === item.id || item.active || (hasChildren && isExpanded && sidebarCollapsed);
                  return (
                    <div key={item.label} className="panze-nav-group">
                      <button
                        className={`panze-nav-item ${isActive ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => {
                          if (hasChildren && !sidebarCollapsed) {
                            setExpandedNav(isExpanded ? null : item.label);
                          } else if (item.id) {
                            setActiveView(item.id);
                          } else if (item.path) {
                            navigate(item.path);
                          }
                        }}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <span className="panze-nav-icon">
                          <item.icon size={sidebarCollapsed ? 20 : 18} />
                        </span>
                        {!sidebarCollapsed && (
                          <>
                            <span className="panze-nav-label">{item.label}</span>
                            {item.dot && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />}
                            {hasChildren && (
                              <ChevronDown
                                size={14}
                                className={`panze-nav-chevron-toggle ${isExpanded ? 'rotated' : ''}`}
                              />
                            )}
                          </>
                        )}
                      </button>
                      <AnimatePresence initial={false}>
                        {hasChildren && !sidebarCollapsed && isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="panze-nav-submenu-inner">
                              {item.children!.map((child) => (
                                <button
                                  key={child.label}
                                  className={`panze-nav-subitem ${activeView === child.id ? 'active' : ''}`}
                                  onClick={() => {
                                    if (child.id) {
                                      setActiveView(child.id);
                                    } else if (child.path) {
                                      navigate(child.path);
                                    }
                                  }}
                                >
                                  <child.icon size={15} className="panze-nav-subitem-icon" />
                                  <span>{child.label}</span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Collapse Toggle */}
          <button
            className="panze-sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>

          {/* User */}
          <div className="panze-sidebar-user">
            <div className="panze-sidebar-avatar ring-2 ring-indigo-100/50 shadow-sm">C</div>
            {!sidebarCollapsed && (
              <div className="panze-sidebar-user-info">
                <div className="panze-sidebar-user-name">Chris@shop.com</div>
              </div>
            )}
          </div>
        </nav>

        {/* ══════════════ RIGHT CONTENT (PREMIUM REDESIGN) ══════════════ */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#FAFAFA]">
          
          {/* Header row */}
          <header className="px-8 pt-8 pb-4 flex-shrink-0 z-40 relative bg-white border-b border-slate-200 sticky top-0">
            <div className="flex items-start justify-between w-full">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight m-0 leading-tight">Billing Overview</h1>
                  <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-blue-700 bg-blue-100 rounded-full border border-blue-200 uppercase">Live</span>
                </div>
                <p className="text-sm text-slate-500 m-0">BillFlow AI is currently managing your automated invoicing.</p>
              </div>
              <div className="flex items-center gap-3">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-all relative">
                  <Bell size={18} />
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-white/80" />
                </motion.button>
                <div className="relative">
                  <motion.button 
                    whileHover={{ scale: 1.05 }} 
                    whileTap={{ scale: 0.95 }} 
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-all"
                    onClick={() => setShowPaletteMenu(!showPaletteMenu)}
                  >
                    <Settings size={18} />
                  </motion.button>

                  <AnimatePresence>
                    {showPaletteMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-[calc(100%+8px)] w-[520px] bg-white border border-slate-200 rounded-xl shadow-xl p-5 z-50 origin-top-right"
                      >
                        <div className="flex items-center justify-between mb-4 px-1">
                          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Appearance</div>
                          <div className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Beta</div>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {Object.entries(THEME_PALETTES).map(([key, palette]) => (
                            <button
                              key={key}
                              onClick={() => { setActivePalette(key as keyof typeof THEME_PALETTES); setShowPaletteMenu(false); }}
                              className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-all group relative border ${
                                activePalette === key 
                                  ? 'bg-indigo-50/50 border-indigo-100 shadow-inner' 
                                  : 'border-transparent hover:bg-slate-50 hover:border-slate-100'
                              }`}
                            >
                              <div 
                                className="w-8 h-8 rounded-full shadow-sm flex-shrink-0 relative overflow-hidden transition-all duration-300"
                                style={{ 
                                  background: `linear-gradient(135deg, ${palette.primary} 50%, ${palette.secondary} 50%)`,
                                  boxShadow: activePalette === key ? `0 0 0 2px white, 0 0 0 4px ${palette.primary}` : ''
                                }}
                              >
                                <AnimatePresence>
                                  {activePalette === key && (
                                    <motion.div 
                                      initial={{ opacity: 0, scale: 0.5 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.5 }}
                                      className="absolute inset-0 flex items-center justify-center bg-black/10"
                                    >
                                      <Check size={14} strokeWidth={3} className="text-white" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                              <span className={`text-[9px] font-semibold text-center leading-tight tracking-tight ${activePalette === key ? 'text-indigo-900' : 'text-slate-500 group-hover:text-slate-700'}`}>
                                {palette.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-900 text-white text-sm font-semibold hover:bg-indigo-800 transition-all shadow-md ml-2" 
                  onClick={() => navigate('/dashboard')}
                >
                  <ArrowLeft size={16} />
                  Back to RM
                </motion.button>
              </div>
            </div>
          </header>

          {/* Main scrollable area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-8 z-10 relative scroll-smooth">
            {activeView === 'dashboard' && (
              <PanzeRSCDashboard />
            )}
            
            {/* Deprecated Dashboard View */}
            {false && (
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="max-w-7xl mx-auto space-y-6"
              >
                {/* HERO BANNER */}
                <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl bg-indigo-50 border border-indigo-100 text-slate-900 p-8">
                
                <div className="relative z-10 flex items-center justify-between">
                  <div className="max-w-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-indigo-200 mb-4 shadow-sm">
                      <Zap size={14} className="text-indigo-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Engine Status: Active</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-2">Auto-Billing saved you <span className="text-indigo-600">42 hours</span> this week.</h2>
                    <p className="text-slate-600 text-sm leading-relaxed">Your automation engine generated 3,298 invoices and processed 482 auto-payments, resulting in a 15% increase in on-time collections.</p>
                  </div>
                  <div className="hidden md:flex gap-4">
                    <div className="bg-white rounded-2xl p-4 border border-indigo-100 text-center min-w-[120px] shadow-sm">
                      <div className="text-3xl font-bold text-slate-900 mb-1">99%</div>
                      <div className="text-xs text-slate-500 font-medium">Delivery Rate</div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-indigo-100 text-center min-w-[120px] shadow-sm">
                      <div className="text-3xl font-bold text-slate-900 mb-1">&lt;1d</div>
                      <div className="text-xs text-slate-500 font-medium">Avg Payment</div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* BENTO GRID ROW 1 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Main KPI Sparklines (Col 8) */}
                <motion.div variants={itemVariants} className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* Conversations */}
                  <div className="bg-white border border-slate-200 rounded-xl px-8 py-6 group transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-md">
                    
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="text-sm font-semibold text-slate-600 mb-1 flex items-center gap-2">
                          <FileText size={16} className="text-indigo-500" />
                          Invoices Generated
                        </div>
                        <div className="text-4xl font-extrabold text-slate-900 tracking-tight">3,298</div>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                        <ArrowUpRight size={14} /> +12.5%
                      </div>
                    </div>
                    
                    <div className="h-[80px] w-full mt-4">
                      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 200 80">
                        {(() => {
                          const { line, area } = sparklinePath(sparkIndigo, 200, 80);
                          return (
                            <>
                              <defs>
                                <linearGradient id="indigoArea" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--color-indigo-600, #4f46e5)" stopOpacity="0.2" />
                                  <stop offset="100%" stopColor="var(--color-indigo-600, #4f46e5)" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <path d={area} fill="url(#indigoArea)" />
                              <motion.path 
                                d={line} fill="none" stroke="var(--color-indigo-600, #4f46e5)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut" }}
                              />
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>

                  {/* Products Clicked */}
                  <div className="bg-white border border-slate-200 rounded-xl px-8 py-6 group transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-md">
                    
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="text-sm font-semibold text-slate-600 mb-1 flex items-center gap-2">
                          <DollarSign size={16} className="text-blue-500" />
                          Payments Collected
                        </div>
                        <div className="text-4xl font-extrabold text-slate-900 tracking-tight">1,543</div>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                        <ArrowUpRight size={14} /> +8.3%
                      </div>
                    </div>
                    
                    <div className="h-[80px] w-full mt-4">
                      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 200 80">
                        {(() => {
                          const { line, area } = sparklinePath(sparkBlue, 200, 80);
                          return (
                            <>
                              <defs>
                                <linearGradient id="blueArea" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--color-blue-500, #3B82F6)" stopOpacity="0.2" />
                                  <stop offset="100%" stopColor="var(--color-blue-500, #3B82F6)" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <path d={area} fill="url(#blueArea)" />
                              <motion.path 
                                d={line} fill="none" stroke="var(--color-blue-500, #3B82F6)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                              />
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>

                </motion.div>

                {/* Gauge Card (Col 4) */}
                <motion.div variants={itemVariants} className="md:col-span-4 bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col items-center justify-center relative">
                  <div className="absolute top-6 left-6 text-sm font-semibold text-slate-800">Health Score</div>
                  <button className="absolute top-5 right-5 text-slate-400 hover:text-indigo-600 bg-slate-50/50 hover:bg-indigo-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors"><Settings size={16} /></button>
                  <div className="mt-8">
                    <CollectionsGauge value={84} />
                  </div>
                  <div className="mt-6 w-full bg-slate-50/50 rounded-full p-3 flex items-center justify-between border border-slate-100/50 px-5 shadow-sm">
                    <div className="text-xs font-medium text-slate-500">vs last month</div>
                    <div className="text-xs font-bold text-blue-600 bg-blue-100/80 px-3 py-1 rounded-full border border-blue-200/50">+4.2%</div>
                  </div>
                </motion.div>

              </div>

              {/* BENTO GRID ROW 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                  {/* Table Component Replaces Recent Bills */}
                <motion.div variants={itemVariants} className="lg:col-span-7 bg-white border border-slate-200 shadow-sm rounded-xl px-8 py-6 flex flex-col">
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
                            placeholder="Search client or invoice..." 
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
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
                      >
                        <Plus size={16} /> Add Bill
                      </motion.button>
                    )}
                  </div>
                  
                  {/* The Table */}
                  <div className="flex-1 overflow-x-auto overflow-y-visible">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr>
                          <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest w-12">
                            <button 
                              onClick={toggleAll}
                              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                selectedRows.length === billingData.length ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'border-slate-300 hover:border-indigo-400 bg-white text-transparent'
                              }`}
                            >
                              <Check size={12} strokeWidth={3} />
                            </button>
                          </th>
                          <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Client</th>
                          <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Invoice</th>
                          <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Amount</th>
                          <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((row) => {
                          const isSelected = selectedRows.includes(row.id);
                          return (
                            <tr 
                              key={row.id} 
                              className={`group transition-all duration-200 border-b border-slate-100/50 last:border-0 hover:bg-white/60 cursor-pointer ${isSelected ? 'bg-indigo-50/50' : ''}`}
                              onClick={() => toggleRow(row.id)}
                            >
                              <td className="py-4 px-4">
                                <div 
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'border-slate-300 bg-white text-transparent group-hover:border-indigo-400'
                                  }`}
                                >
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              </td>
                              <td className="py-4 px-4 font-semibold text-slate-800 text-sm">{row.client}</td>
                              <td className="py-4 px-4 font-medium text-slate-500 text-sm">{row.invoice}</td>
                              <td className="py-4 px-4 font-bold text-slate-900 text-sm">{row.amount}</td>
                              <td className="py-4 px-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                                  row.status === 'Paid' ? 'bg-blue-100/80 text-blue-700 border border-blue-200/50' :
                                  row.status === 'Pending' ? 'bg-indigo-100/80 text-indigo-700 border border-indigo-200/50' :
                                  'bg-slate-100/80 text-slate-700 border border-slate-200/50'
                                }`}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredData.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 text-sm font-medium">
                              No records found for "{searchQuery}"
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>

                {/* Left Column combo: Categories & Live Feed (Col 5) */}
                <motion.div variants={itemVariants} className="lg:col-span-5 flex flex-col gap-6">
                  
                  {/* Category Donut */}
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-8">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Revenue Distribution</h3>
                    <div className="flex items-center gap-6">
                      <div className="relative w-[120px] h-[120px] flex-shrink-0 min-h-[120px] min-w-[120px]">
                        {isMounted && (
                            <PieChart key="pie-chart" width={120} height={120} id="revenue-pie-chart">
                              <Pie
                                key="pie"
                                data={pieData}
                                cx="50%" cy="50%"
                                innerRadius={40} outerRadius={60}
                                paddingAngle={5}
                                dataKey="value"
                                nameKey="name"
                                stroke="none"
                                cornerRadius={6}
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity" />
                                ))}
                              </Pie>
                              <Tooltip 
                                key="pie-tooltip"
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', fontWeight: 600 }}
                                itemStyle={{ color: '#111827' }}
                              />
                            </PieChart>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-slate-900">100<span className="text-sm">%</span></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-2.5">
                        {pieData.slice(0, 4).map((d) => (
                          <div key={d.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="text-slate-600 font-medium truncate max-w-[90px]" title={d.name}>{d.name}</span>
                            </div>
                            <span className="font-bold text-slate-900">{d.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Agent Live Feed */}
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-8 flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">Automation Feed</h3>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                    </div>
                    
                    <div className="space-y-4">
                      {agentFeed.map((item, idx) => (
                        <motion.div 
                          key={item.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 + idx * 0.1 }}
                          className="flex items-start gap-3"
                        >
                          <div className={`mt-0.5 w-7 h-7 rounded-full bg-slate-50/80 flex items-center justify-center flex-shrink-0 border border-slate-100 shadow-sm ${item.color}`}>
                            <item.icon size={12} />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-800">{item.text}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{item.time}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                </motion.div>
              </div>

              {/* BENTO GRID ROW 3: Financials */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                
                {/* Revenue Overview Chart (Col 8) */}
                <motion.div variants={itemVariants} className="lg:col-span-8 bg-white border border-slate-200 shadow-sm rounded-xl p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Revenue vs. Expenses</h3>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-indigo-500, #6366f1)' }} />
                        <span className="text-slate-600">Revenue</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-slate-300, #cbd5e1)' }} />
                        <span className="text-slate-600">Expenses</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 w-full" style={{ position: 'relative', minHeight: 250, height: 250 }}>
                    {isMounted && (
                      <ResponsiveContainer key="resp-container-bar" width="100%" height={250}>
                        <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid key="grid" strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis 
                            key="xaxis"
                            dataKey="month" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fill: '#64748b' }} 
                            dy={10} 
                          />
                          <YAxis 
                            key="yaxis"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fill: '#64748b' }} 
                            tickFormatter={(value) => "$" + (value/1000) + "k"}
                          />
                          <Tooltip 
                            key="tooltip"
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', fontWeight: 500 }}
                          />
                          <Bar key="bar-rev" dataKey="revenue" fill="var(--color-indigo-500, #6366f1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                          <Bar key="bar-exp" dataKey="expenses" fill="var(--color-slate-300, #cbd5e1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </motion.div>

                {/* Quick Actions / Summary (Col 4) */}
                <motion.div variants={itemVariants} className="lg:col-span-4 flex flex-col gap-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-8 relative overflow-hidden shadow-sm">
                    <h3 className="text-slate-500 text-sm font-medium mb-1">Total Outstanding</h3>
                    <div className="text-4xl font-bold mb-6 text-slate-900">$42,850</div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="text-sm font-medium text-slate-700">Overdue (3)</div>
                        <div className="text-sm font-bold text-rose-600">$18,200</div>
                      </div>
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="text-sm font-medium text-slate-700">Due this week</div>
                        <div className="text-sm font-bold text-indigo-600">$12,400</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <Database size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Sync Accounting</div>
                        <div className="text-xs text-slate-500">Last sync: 2h ago</div>
                      </div>
                    </div>
                    <ArrowUpRight className="text-slate-400 group-hover:text-indigo-600 transition-colors" size={20} />
                  </div>
                </motion.div>

              </div>

              {/* FULL WIDTH DIRECTORY TABLE */}
              <motion.div variants={itemVariants} className="mt-6 bg-white border border-slate-200 shadow-sm rounded-xl px-8 py-6 flex flex-col">
                <div className="flex items-center justify-between mb-6 h-12">
                  <div className="flex-1 flex items-center gap-4">
                    {selectedDirRows.length > 0 ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        className="flex items-center gap-1 p-1 bg-white rounded-full border border-slate-200 shadow-sm"
                      >
                        <div className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-full flex items-center gap-2 border border-indigo-100/50">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] shadow-inner">{selectedDirRows.length}</span>
                          Selected
                        </div>
                        {selectedDirRows.length === 1 && (
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
                          placeholder="Search directory..." 
                          className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200/60 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-full text-sm font-medium outline-none transition-all placeholder:text-slate-400 text-slate-900 shadow-sm"
                          value={dirSearchQuery}
                          onChange={(e) => setDirSearchQuery(e.target.value)}
                        />
                      </motion.div>
                    )}
                  </div>
                  
                  {!selectedDirRows.length && (
                    <motion.button 
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
                    >
                      <Plus size={16} /> Add Member
                    </motion.button>
                  )}
                </div>

                {/* Directory Table */}
                <div className="flex-1 overflow-x-auto overflow-y-visible">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr>
                        <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest w-12">
                          <button 
                            onClick={toggleAllDir}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                              selectedDirRows.length === directoryData.length ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'border-slate-300 hover:border-indigo-400 bg-white text-transparent'
                            }`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </button>
                        </th>
                        <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Employee</th>
                        <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Role</th>
                        <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Department</th>
                        <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Location</th>
                        <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Utilization</th>
                        <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest">Status</th>
                        <th className="py-4 px-4 border-b border-indigo-100/50 font-bold text-indigo-900/50 text-[11px] uppercase tracking-widest w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDirData.map((row) => {
                        const isSelected = selectedDirRows.includes(row.id);
                        return (
                          <tr 
                            key={row.id} 
                            className={`group transition-all duration-200 border-b border-slate-100/50 last:border-0 hover:bg-white/60 cursor-pointer ${isSelected ? 'bg-indigo-50/50' : ''}`}
                            onClick={() => toggleDirRow(row.id)}
                          >
                            <td className="py-4 px-4">
                              <div 
                                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                  isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'border-slate-300 bg-white text-transparent group-hover:border-indigo-400'
                                }`}
                              >
                                <Check size={12} strokeWidth={3} />
                              </div>
                            </td>
                            <td className="py-4 px-4 font-semibold text-slate-800 text-sm">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs">
                                  {row.employee.charAt(0)}
                                </div>
                                {row.employee}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-slate-600 text-sm font-medium">{row.role}</td>
                            <td className="py-4 px-4 text-slate-500 text-sm">{row.department}</td>
                            <td className="py-4 px-4 text-slate-500 text-sm">{row.location}</td>
                            <td className="py-4 px-4 font-bold text-slate-900 text-sm">{row.utilization}</td>
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                                row.status === 'Active' ? 'bg-indigo-100/80 text-indigo-700 border border-indigo-200/50' :
                                'bg-slate-100/80 text-slate-700 border border-slate-200/50'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100">
                                <MoreHorizontal size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredDirData.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 text-sm font-medium">
                            No records found for "{dirSearchQuery}"
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* ── Section Divider ── */}
              <motion.div variants={itemVariants} className="flex items-center gap-4 py-6">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs font-bold tracking-widest uppercase text-slate-500 bg-white px-4 py-1 rounded-full border border-slate-200">Component Library</span>
                <div className="flex-1 h-px bg-slate-200" />
              </motion.div>

              {/* ��─ Form Showcase ── */}
              <motion.div variants={itemVariants}>
                <FormShowcase />
              </motion.div>
            </motion.div>
            )}

            {activeView === 'clients' && (
              <div className="max-w-7xl mx-auto">
                <PanzeClientsView />
              </div>
            )}

            {activeView === 'quotes' && (
              <div className="max-w-7xl mx-auto">
                <PanzeQuotesView />
              </div>
            )}

            {activeView === 'delivery-notes' && (
              <div className="max-w-7xl mx-auto">
                <PanzeDeliveryNotesView />
              </div>
            )}

            {activeView === 'invoices' && (
              <div className="max-w-7xl mx-auto">
                <PanzeInvoicesView />
              </div>
            )}
            
          </main>
        </div>
      </div>
    </div>
  );
}

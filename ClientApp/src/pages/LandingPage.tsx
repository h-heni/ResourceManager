import { Link, Navigate } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  ShoppingCart,
  TrendingUp,
  Users,
  Shield,
  Globe,
  Zap,
  CheckCircle,
  ArrowRight,
  Star,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Menu,
  X,
  Download,
  Upload,
  ArrowUpRight,
  DollarSign,
  Package,
  Truck,
  CreditCard,
  Building2,
  RefreshCw,
  MessageSquare,
  Mail,
  Phone,
  MapPin,
  Printer,
  FileSpreadsheet,
  Filter,
  Search,
  Calendar,
  PiggyBank,
  Receipt,
  Layers,
  HardDrive,
  Settings,
  PieChart,
  LineChart,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import LanguageSelector from '../components/LanguageSelector';
import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS } from '../lib/currencyUtils';
import { formatNumber } from '../lib/formatNumber';

// ============================================
// FEATURE PREVIEW COMPONENTS
// ============================================

const fmt = (value: number) => `$${formatNumber(value)}`;

const ChartTooltipContent = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-gray-600" style={{ color: entry.color }}>
          {entry.name}: {fmt(entry.value)}
        </p>
      ))}
    </div>
  );
};

// Dashboard Preview - Real UI Mockup (Non-clickable)
const DashboardPreview = ({ t }: { t: TFunction }) => {
  const revenueExpenseChartData = [
    { name: 'Jul', revenue: 48200, expenses: 28600 },
    { name: 'Aug', revenue: 51700, expenses: 30100 },
    { name: 'Sep', revenue: 49500, expenses: 31200 },
    { name: 'Oct', revenue: 56300, expenses: 32900 },
    { name: 'Nov', revenue: 60700, expenses: 35100 },
    { name: 'Dec', revenue: 65100, expenses: 36800 },
  ];

  const growthTrajectoryData = revenueExpenseChartData.map((point) => ({
    name: point.name,
    net: point.revenue - point.expenses,
  }));

  const netResult = growthTrajectoryData[growthTrajectoryData.length - 1]?.net ?? 0;

  return (
    <div className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 pointer-events-none select-none">
    <div className="bg-gradient-to-r from-[#065F46] to-[#10B981] px-4 py-3 flex items-center gap-2 border-b border-gray-200">
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>
      <span className="text-xs text-white ml-2 font-mono">dashboard.resourcemanager.com</span>
    </div>

    {/* Dashboard Content */}
    <div className="bg-gray-50 p-4 space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t('landing.dashboardPreview.totalRevenue'), value: '$124,500', change: '+12%', color: 'emerald' },
          { label: t('landing.dashboardPreview.totalInvoices'), value: '156', change: '+8%', color: 'blue' },
          { label: t('landing.dashboardPreview.pendingPayments'), value: '$12,400', change: '-5%', color: 'orange' },
          { label: t('landing.dashboardPreview.activeCustomers'), value: '89', change: '+15%', color: 'purple' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 font-medium mb-1">{stat.label}</p>
            <p className="text-lg font-bold text-gray-900 mb-1">{stat.value}</p>
            <div className={`inline-flex items-center gap-1 text-xs font-medium ${stat.change.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>
              {stat.change.startsWith('+') ? <TrendingUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {stat.change} {t('landing.stats.changeFromLastMonth')}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">{t('dashboard.revenueVsExpenses', 'Revenue vs Expenses')}</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.revenue }} />
                <span className="text-[11px] text-gray-500">{t('dashboard.revenueLabel', 'Revenue')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.expenses }} />
                <span className="text-[11px] text-gray-500">{t('expense.totalExpenses', 'Expenses')}</span>
              </div>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueExpenseChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} width={80} tickFormatter={(v: number) => formatNumber(v)} />
                <RechartsTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" name={t('dashboard.revenueLabel', 'Revenue')} fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name={t('expense.totalExpenses', 'Expenses')} fill={CHART_COLORS.expenses} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">{t('dashboard.growthTrajectory', 'Growth')}</h3>
            <span className={`text-xs font-semibold ${netResult >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {netResult >= 0 ? '+' : ''}{fmt(netResult)}
            </span>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthTrajectoryData}>
                <defs>
                  <linearGradient id="gradNetLanding" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.net} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_COLORS.net} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} width={80} tickFormatter={(v: number) => formatNumber(v)} />
                <RechartsTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="net" name={t('dashboard.netLabel', 'Net')} stroke={CHART_COLORS.net} strokeWidth={2.5} fill="url(#gradNetLanding)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('landing.dashboardPreview.recentInvoices')}</h3>
        <div className="space-y-2">
          {[
            { client: 'Acme Corp', amount: '$2,500', status: t('landing.invoicesPreview.paid'), date: t('landing.dashboardPreview.today') },
            { client: 'Tech Solutions', amount: '$4,200', status: t('landing.invoicesPreview.pending'), date: t('landing.dashboardPreview.yesterday') },
            { client: 'Global Industries', amount: '$1,800', status: t('landing.invoicesPreview.paid'), date: 'Dec 20' },
          ].map((invoice, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{invoice.client}</p>
                <p className="text-xs text-gray-500">{invoice.date}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{invoice.amount}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  invoice.status === t('landing.invoicesPreview.paid') ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {invoice.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
};

// Invoices Preview - Real UI Mockup (Non-clickable)
const InvoicesPreview = ({ t }: { t: TFunction }) => (
  <div className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 pointer-events-none select-none">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>
      <span className="text-xs text-white ml-2 font-mono">invoices.resourcemanager.com</span>
    </div>

    {/* Invoices Content */}
    <div className="bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('landing.invoicesPreview.searchInvoices')}
            className="text-sm text-gray-700 outline-none w-40 bg-transparent"
            readOnly
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs bg-[#065F46] text-white px-3 py-1.5 rounded-lg font-medium">
            {t('landing.invoicesPreview.newInvoice')}
          </span>
        </div>
      </div>

      {/* Year Header */}
      <div className="bg-[#ECFDF5] px-4 py-2 border-b border-emerald-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChevronDown className="w-4 h-4 text-[#065F46]" />
          <span className="text-sm font-semibold text-[#065F46]">2024</span>
        </div>
        <span className="text-xs text-gray-600">156 {t('landing.invoicesPreview.invoicesTotal')} $124,500</span>
      </div>

      {/* Invoice Table */}
      <div className="bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t('landing.invoicesPreview.invoice')}</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t('landing.invoicesPreview.client')}</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t('landing.invoicesPreview.amount')}</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t('landing.invoicesPreview.status')}</th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: 'INV-001', client: 'Acme Corporation', amount: '$2,500.00', status: t('landing.invoicesPreview.paid') },
              { id: 'INV-002', client: 'Tech Solutions Ltd', amount: '$4,200.00', status: t('landing.invoicesPreview.pending') },
              { id: 'INV-003', client: 'Global Industries', amount: '$1,850.00', status: t('landing.invoicesPreview.paid') },
              { id: 'INV-004', client: 'Metro Services', amount: '$3,100.00', status: t('landing.invoicesPreview.overdue') },
              { id: 'INV-005', client: 'Digital Ventures', amount: '$5,750.00', status: t('landing.invoicesPreview.paid') },
            ].map((invoice, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900 font-medium">{invoice.id}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{invoice.client}</td>
                <td className="px-4 py-3 text-sm text-gray-900 font-semibold text-right">{invoice.amount}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium ${
                    invoice.status === t('landing.invoicesPreview.paid') ? 'bg-emerald-100 text-emerald-700' :
                    invoice.status === t('landing.invoicesPreview.pending') ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {invoice.status === t('landing.invoicesPreview.paid') && <CheckCircle className="w-3 h-3 mr-1" />}
                    {invoice.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <span className="text-xs text-gray-500">{t('landing.invoicesPreview.showing')} 1-5 {t('landing.invoicesPreview.of')} 156</span>
          <div className="flex gap-1">
            <span className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-400">
              <ChevronLeft className="w-4 h-4" />
            </span>
            <span className="w-8 h-8 flex items-center justify-center rounded bg-[#065F46] text-white text-sm font-medium">1</span>
            <span className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-600 text-sm">2</span>
            <span className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-600 text-sm">3</span>
            <span className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-600">
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Data Management Preview - Real UI Mockup (Non-clickable)
const DataManagementPreview = ({ t }: { t: TFunction }) => (
  <div className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 pointer-events-none select-none">
    <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>
      <span className="text-xs text-white ml-2 font-mono">data.resourcemanager.com</span>
    </div>

    {/* Data Management Content */}
    <div className="bg-gray-50 p-4 space-y-4">
      {/* Import Section */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Download className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t('landing.dataManagementPreview.importData')}</h3>
            <p className="text-xs text-gray-500">{t('landing.dataManagementPreview.importDesc')}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('landing.dataManagementPreview.customers'), icon: <Users />, count: '89' },
            { label: t('landing.dataManagementPreview.products'), icon: <Package />, count: '156' },
            { label: t('landing.dataManagementPreview.invoices'), icon: <FileText />, count: '42' },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                {item.icon}
              </div>
              <span className="text-xs font-medium text-gray-700">{item.label}</span>
              <span className="text-xs text-gray-400">{item.count}</span>
            </div>
          ))}
        </div>
        <span className="w-full mt-4 flex items-center justify-center gap-2 bg-[#065F46] text-white py-2.5 rounded-lg text-sm font-medium">
          <FileSpreadsheet className="w-4 h-4" />
          {t('landing.dataManagementPreview.importFromExcel')}
        </span>
      </div>

      {/* Export Section */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Upload className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t('landing.dataManagementPreview.exportData')}</h3>
            <p className="text-xs text-gray-500">{t('landing.dataManagementPreview.exportDesc')}</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: t('landing.dataManagementPreview.allInvoices'), date: `${t('landing.dataManagementPreview.lastExport')} 2 ${t('landing.dataManagementPreview.daysAgo')}` },
            { label: t('landing.dataManagementPreview.customerList'), date: `${t('landing.dataManagementPreview.lastExport')} 1 ${t('landing.dataManagementPreview.weeksAgo')}` },
            { label: t('landing.dataManagementPreview.financialReport'), date: `${t('landing.dataManagementPreview.lastExport')} 3 ${t('landing.dataManagementPreview.daysAgo')}` },
          ].map((export_, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{export_.label}</p>
                  <p className="text-xs text-gray-500">{export_.date}</p>
                </div>
              </div>
              <span className="text-xs text-blue-600 font-medium">{t('landing.dataManagementPreview.export')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Archive Section */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t('landing.dataManagementPreview.dataArchive')}</h3>
            <p className="text-xs text-gray-500">{t('landing.dataManagementPreview.archiveDesc')}</p>
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-gray-700">{t('landing.dataManagementPreview.archive2023')}</span>
            </div>
            <span className="text-xs text-orange-600 font-medium">42 {t('landing.dataManagementPreview.invoices')}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">{t('landing.dataManagementPreview.lastArchived')} Jan 15, 2024</p>
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// FEATURE DATA
// ============================================

const mainFeatures = [
  {
    icon: <FileText className="w-6 h-6" />,
    titleKey: 'smartInvoicing',
    descriptionKey: 'smartInvoicingDesc',
    color: 'emerald',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    titleKey: 'realtimeAnalytics',
    descriptionKey: 'realtimeAnalyticsDesc',
    color: 'blue',
  },
  {
    icon: <ShoppingCart className="w-6 h-6" />,
    titleKey: 'purchaseManagement',
    descriptionKey: 'purchaseManagementDesc',
    color: 'purple',
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    titleKey: 'financialLedger',
    descriptionKey: 'financialLedgerDesc',
    color: 'orange',
  },
  {
    icon: <Globe className="w-6 h-6" />,
    titleKey: 'multiCurrency',
    descriptionKey: 'multiCurrencyDesc',
    color: 'teal',
  },
  {
    icon: <Users className="w-6 h-6" />,
    titleKey: 'teamCollaboration',
    descriptionKey: 'teamCollaborationDesc',
    color: 'indigo',
  },
];

const salesFeatures = [
  { icon: <FileText />, titleKey: 'customerManagement', descriptionKey: 'customerManagementDesc' },
  { icon: <Package />, titleKey: 'productCatalog', descriptionKey: 'productCatalogDesc' },
  { icon: <TrendingUp />, titleKey: 'salesAnalytics', descriptionKey: 'salesAnalyticsDesc' },
  { icon: <Printer />, titleKey: 'pdfGeneration', descriptionKey: 'pdfGenerationDesc' },
  { icon: <Mail />, titleKey: 'emailIntegration', descriptionKey: 'emailIntegrationDesc' },
];

const purchaseFeatures = [
  { icon: <Building2 />, titleKey: 'supplierDatabase', descriptionKey: 'supplierDatabaseDesc' },
  { icon: <Truck />, titleKey: 'purchaseOrders', descriptionKey: 'purchaseOrdersDesc' },
  { icon: <Receipt />, titleKey: 'supplierInvoices', descriptionKey: 'supplierInvoicesDesc' },
  { icon: <Filter />, titleKey: 'yearBasedGrouping', descriptionKey: 'yearBasedGroupingDesc' },
];

const financialFeatures = [
  { icon: <PiggyBank />, titleKey: 'expenseTracking', descriptionKey: 'expenseTrackingDesc' },
  { icon: <CreditCard />, titleKey: 'paymentManagement', descriptionKey: 'paymentManagementDesc' },
  { icon: <LineChart />, titleKey: 'financialReports', descriptionKey: 'financialReportsDesc' },
  { icon: <PieChart />, titleKey: 'categoryAnalysis', descriptionKey: 'categoryAnalysisDesc' },
];

const advancedFeatures = [
  { icon: <Globe />, titleKey: 'multiLanguage', descriptionKey: 'multiLanguageDesc' },
  { icon: <FileSpreadsheet />, titleKey: 'excelIntegration', descriptionKey: 'excelIntegrationDesc' },
  { icon: <HardDrive />, titleKey: 'dataArchival', descriptionKey: 'dataArchivalDesc' },
  { icon: <Shield />, titleKey: 'enterpriseSecurity', descriptionKey: 'enterpriseSecurityDesc' },
  { icon: <Settings />, titleKey: 'customizable', descriptionKey: 'customizableDesc' },
  { icon: <Zap />, titleKey: 'lightningFast', descriptionKey: 'lightningFastDesc' },
];

const benefits = [
  {
    icon: <Clock />,
    titleKey: 'saveTimeWeekly',
    descriptionKey: 'saveTimeDesc',
  },
  {
    icon: <TrendingUp />,
    titleKey: 'boostRevenue',
    descriptionKey: 'boostRevenueDesc',
  },
  {
    icon: <CheckCircle />,
    titleKey: 'eliminateErrors',
    descriptionKey: 'eliminateErrorsDesc',
  },
  {
    icon: <Shield />,
    titleKey: 'stayCompliant',
    descriptionKey: 'stayCompliantDesc',
  },
];

const testimonials = [
  {
    nameKey: 'testimonial1Name',
    roleKey: 'testimonial1Role',
    contentKey: 'testimonial1Content',
    rating: 5,
  },
  {
    nameKey: 'testimonial2Name',
    roleKey: 'testimonial2Role',
    contentKey: 'testimonial2Content',
    rating: 5,
  },
  {
    nameKey: 'testimonial3Name',
    roleKey: 'testimonial3Role',
    contentKey: 'testimonial3Content',
    rating: 5,
  },
];

const faqs = [
  {
    questionKey: 'isDataSecure',
    answerKey: 'dataSecureAnswer',
  },
  {
    questionKey: 'importExistingData',
    answerKey: 'importExistingDataAnswer',
  },
  {
    questionKey: 'multiCurrencyWorks',
    answerKey: 'multiCurrencyWorksAnswer',
  },
  {
    questionKey: 'customizeInvoices',
    answerKey: 'customizeInvoicesAnswer',
  },
  {
    questionKey: 'cancelData',
    answerKey: 'cancelDataAnswer',
  },
  {
    questionKey: 'customerSupport',
    answerKey: 'customerSupportAnswer',
  },
];

const trustIndicators = [
  { icon: <Shield />, textKey: 'bankLevelSecurity' },
  { icon: <RefreshCw />, textKey: 'uptimeSla' },
  { icon: <Globe />, textKey: 'countries' },
  { icon: <Users />, textKey: 'activeUsers' },
];

// ============================================
// MAIN LANDING PAGE COMPONENT
// ============================================

export default function LandingPage() {
  const { isAuthenticated, isEmployee, loading } = useAuth();
  const { t, i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const colorClasses = {
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    teal: 'bg-teal-100 text-teal-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };

  const colorBgClasses = {
    emerald: 'hover:bg-emerald-50 hover:border-emerald-200',
    blue: 'hover:bg-blue-50 hover:border-blue-200',
    purple: 'hover:bg-purple-50 hover:border-purple-200',
    orange: 'hover:bg-orange-50 hover:border-orange-200',
    teal: 'hover:bg-teal-50 hover:border-teal-200',
    indigo: 'hover:bg-indigo-50 hover:border-indigo-200',
  };

  const direction = i18n.language === 'ar' ? 'rtl' : 'ltr';

  // Update document title and meta tags
  useEffect(() => {
    document.title = `${t('landing.heroTitle')} ${t('landing.heroHighlight')} | ${t('common.appName')}`;
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = direction;
  }, [i18n.language, direction, t]);

  // Redirect authenticated users to their dashboard
  if (!loading && isAuthenticated) {
    return <Navigate to={isEmployee ? '/invoices' : '/dashboard'} replace />;
  }

  return (
    <div className="min-h-screen bg-white font-sans" dir={direction}>

      {/* ========================================
          NAVBAR
      ======================================== */}
      <header className="fixed inset-x-0 top-0 z-[70] border-b border-gray-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#065F46] to-[#10B981] shadow-lg shadow-emerald-200">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">{t('common.appName')}</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
              {t('landing.features')}
            </a>
            <a href="#benefits" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
              {t('landing.benefits')}
            </a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
              {t('landing.pricing')}
            </a>
            <a href="#faq" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
              {t('landing.faq')}
            </a>
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector />
            <Link
              to="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 sm:inline-flex"
            >
              {t('auth.login')}
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-gradient-to-r from-[#065F46] to-[#10B981] px-3 py-2 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-emerald-200 sm:px-4"
            >
              {t('auth.signup')}
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4">
            <nav className="flex flex-col gap-3">
              <a href="#features" className="text-sm font-medium text-gray-600 py-2">{t('landing.features')}</a>
              <a href="#benefits" className="text-sm font-medium text-gray-600 py-2">{t('landing.benefits')}</a>
              <a href="#pricing" className="text-sm font-medium text-gray-600 py-2">{t('landing.pricing')}</a>
              <a href="#faq" className="text-sm font-medium text-gray-600 py-2">{t('landing.faq')}</a>
              <Link to="/login" className="text-sm font-medium text-gray-600 py-2">{t('auth.login')}</Link>
            </nav>
          </div>
        )}
      </header>

      {/* ========================================
          HERO SECTION
      ======================================== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#ECFDF5]/30 to-white pt-36 pb-20 px-4 sm:px-6 lg:px-8">
        {/* Decorative Elements */}
        <div className="absolute top-20 left-0 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl -translate-x-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-200/20 rounded-full blur-3xl translate-x-1/2" />

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium mb-8 shadow-sm">
              <div className="flex -space-x-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-white" />
                ))}
              </div>
              <span className="text-gray-700">{t('landing.trustedBy')}</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
              {t('landing.heroTitle')}{' '}
              <span className="bg-gradient-to-r from-[#065F46] via-emerald-600 to-[#10B981] bg-clip-text text-transparent">
                {t('landing.heroHighlight')}
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              {t('landing.heroSubtitle')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link
                to="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#065F46] to-[#10B981] px-8 py-4 text-base font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:shadow-xl hover:shadow-emerald-300 hover:-translate-y-0.5"
              >
                {t('landing.startFreeTrial')}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 px-8 py-4 text-base font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                {t('landing.seeHowItWorks')}
                <ChevronRight className="w-5 h-5" />
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mb-16">
              {trustIndicators.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <div className="text-emerald-600">{item.icon}</div>
                  {t(`landing.${item.textKey}`)}
                </div>
              ))}
            </div>
          </div>

          {/* Hero Image Preview */}
          <div className="mt-12">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
              <DashboardPreview t={t} />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          LOGOS / SOCIAL PROOF
      ======================================== */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-y border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm font-semibold text-gray-500 mb-8 uppercase tracking-wider">
            {t('landing.trustedByBusinesses')}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12 opacity-60">
            {[t('landing.technology'), t('landing.retail'), t('landing.services'), t('landing.manufacturing'), t('landing.healthcare'), t('landing.education')].map((industry) => (
              <div key={industry} className="text-gray-400 font-semibold text-lg">
                {industry}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          MAIN FEATURES SECTION
      ======================================== */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#065F46]/10 text-[#065F46] px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />
              <span>{t('landing.powerfulFeatures')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('landing.everythingNeedToRunBusiness')}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t('landing.comprehensiveTools')}
            </p>
          </div>

          {/* Main Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mainFeatures.map((feature, index) => (
              <div
                key={index}
                className={`group p-6 rounded-2xl border border-gray-100 bg-white transition-all duration-300 ${colorBgClasses[feature.color as keyof typeof colorBgClasses]} hover:shadow-lg`}
              >
                <div className={`w-12 h-12 ${colorClasses[feature.color as keyof typeof colorClasses]} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t(`landing.${feature.titleKey}`)}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{t(`landing.${feature.descriptionKey}`)}</p>
              </div>
            ))}
          </div>

          {/* Feature Categories */}
          <div className="mt-20 space-y-16">
            {/* Sales Management */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  <TrendingUp className="w-4 h-4" />
                  {t('landing.sales')}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{t('landing.completeSalesControl')}</h3>
                <p className="text-gray-600 mb-6">
                  {t('landing.salesDescription')}
                </p>
                <div className="space-y-3">
                  {salesFeatures.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{t(`landing.${feature.titleKey}`)}</h4>
                        <p className="text-sm text-gray-600">{t(`landing.${feature.descriptionKey}`)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-200 to-transparent rounded-3xl blur-2xl opacity-30" />
                <InvoicesPreview t={t} />
              </div>
            </div>

            {/* Purchase Management */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 relative">
                <div className="absolute inset-0 bg-gradient-to-l from-purple-200 to-transparent rounded-3xl blur-2xl opacity-30" />
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{t('landing.purchaseManagement')}</h4>
                      <p className="text-sm text-gray-500">{t('landing.streamlinedPurchasing')}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {purchaseFeatures.map((feature, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        {feature.icon}
                        <div>
                          <h5 className="font-semibold text-gray-900 text-sm">{t(`landing.${feature.titleKey}`)}</h5>
                          <p className="text-xs text-gray-600">{t(`landing.${feature.descriptionKey}`)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  <ShoppingCart className="w-4 h-4" />
                  {t('landing.purchases')}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{t('landing.streamlinedPurchasing')}</h3>
                <p className="text-gray-600 mb-6">
                  {t('landing.purchaseDescription')}
                </p>
                <div className="space-y-3">
                  {purchaseFeatures.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{t(`landing.${feature.titleKey}`)}</h4>
                        <p className="text-sm text-gray-600">{t(`landing.${feature.descriptionKey}`)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Financial Management */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  <PiggyBank className="w-4 h-4" />
                  {t('landing.financials')}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{t('landing.completeFinancialVisibility')}</h3>
                <p className="text-gray-600 mb-6">
                  {t('landing.financialDescription')}
                </p>
                <div className="space-y-3">
                  {financialFeatures.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{t(`landing.${feature.titleKey}`)}</h4>
                        <p className="text-sm text-gray-600">{t(`landing.${feature.descriptionKey}`)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: t('landing.dashboardPreview.totalRevenue'), value: '$124,500', change: '+12%', up: true },
                  { label: t('common.total') + ' ' + t('landing.invoicesPreview.pending'), value: '$45,200', change: '-3%', up: true },
                  { label: t('landing.netProfit'), value: '$79,300', change: '+18%', up: true },
                  { label: t('landing.dashboardPreview.pendingPayments'), value: '$12,400', change: '-8%', up: true },
                ].map((stat, index) => (
                  <div key={index} className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-100">
                    <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
                    <div className={`flex items-center gap-1 text-sm font-medium ${stat.up ? 'text-emerald-600' : 'text-red-500'}`}>
                      {stat.up ? <TrendingUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {stat.change}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          BENEFITS SECTION
      ======================================== */}
      <section id="benefits" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#065F46] to-[#10B981] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t('landing.whyChooseUs')}
            </h2>
            <p className="text-xl text-emerald-100 max-w-2xl mx-auto">
              {t('landing.customerReviews')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-4">
                  <div className="text-[#065F46]">{benefit.icon}</div>
                </div>
                <h3 className="text-lg font-bold mb-2">{t(`landing.${benefit.titleKey}`)}</h3>
                <p className="text-emerald-100 text-sm">{t(`landing.${benefit.descriptionKey}`)}</p>
              </div>
            ))}
          </div>

          {/* Stats Banner */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '10,000+', labelKey: 'activeUsers' },
              { value: '$2B+', labelKey: 'transactionsProcessed' },
              { value: '60+', labelKey: 'countries' },
              { value: '99.9%', labelKey: 'uptimeSla' },
            ].map((stat, index) => (
              <div key={index}>
                <p className="text-3xl sm:text-4xl font-bold mb-1">{stat.value}</p>
                <p className="text-emerald-200">{t(`landing.${stat.labelKey}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          HOW IT WORKS
      ======================================== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#065F46]/10 text-[#065F46] px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />
              <span>{t('landing.getStartedFast')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('landing.upAndRunningMinutes')}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t('landing.threeSimpleSteps')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                titleKey: 'createAccount',
                descriptionKey: 'createAccountDesc',
                icon: <Users />,
              },
              {
                step: '02',
                titleKey: 'importData',
                descriptionKey: 'importDataDesc',
                icon: <Download />,
              },
              {
                step: '03',
                titleKey: 'startInvoicing',
                descriptionKey: 'startInvoicingDesc',
                icon: <FileText />,
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-gray-50 rounded-2xl p-8 h-full">
                  <div className="text-6xl font-bold text-gray-200 mb-4">{item.step}</div>
                  <div className="w-12 h-12 bg-[#065F46] rounded-xl flex items-center justify-center text-white mb-4">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{t(`landing.${item.titleKey}`)}</h3>
                  <p className="text-gray-600">{t(`landing.${item.descriptionKey}`)}</p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                    <ChevronRight className="w-8 h-8 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          TESTIMONIALS
      ======================================== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Star className="w-4 h-4 fill-current" />
              <span>{t('landing.customerReviews')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('landing.lovedByBusinesses')}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t('landing.gotQuestions')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed">"{t(`landing.${testimonial.contentKey}`)}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                    {t(`landing.${testimonial.nameKey}`).charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{t(`landing.${testimonial.nameKey}`)}</p>
                    <p className="text-sm text-gray-500">{t(`landing.${testimonial.roleKey}`)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          APP PREVIEW SECTION
      ======================================== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Layers className="w-4 h-4" />
              <span>{t('landing.explorePlatform')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              {t('common.appName')} {t('landing.inAction')}
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('landing.explorePlatformDesc')}
            </p>
          </div>

          {/* Additional Features Grid */}
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {advancedFeatures.map((feature, index) => (
              <div key={index} className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="text-emerald-400">{feature.icon}</div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{t(`landing.${feature.titleKey}`)}</h4>
                    <p className="text-xs text-gray-400">{t(`landing.${feature.descriptionKey}`)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          PRICING SECTION
      ======================================== */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#065F46]/10 text-[#065F46] px-4 py-2 rounded-full text-sm font-medium mb-4">
              <DollarSign className="w-4 h-4" />
              <span>{t('landing.pricing')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('landing.simpleTransparentPricing')}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t('landing.noHiddenFees')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                nameKey: 'starter',
                price: 0,
                descriptionKey: 'starterDesc',
                ctaKey: 'getStarted',
                features: [{ label: t('landing.starterFeature1') }, { label: t('landing.starterFeature2') }],
                popular: false,
              },
              {
                nameKey: 'professional',
                price: 29,
                descriptionKey: 'professionalDesc',
                ctaKey: 'startFreeTrialPro',
                features: [
                  { label: t('landing.proFeature1') },
                  { label: t('landing.proFeature2') },
                  { label: t('landing.proFeature3') },
                  { label: t('landing.proFeature4') },
                  { label: t('landing.proFeature5') },
                  { label: t('landing.proFeature6') },
                  { label: t('landing.proFeature7') },
                  { label: t('landing.proFeature8') },
                  { label: t('landing.proFeature9') },
                ],
                popular: true,
              },
              {
                nameKey: 'enterprise',
                price: 79,
                descriptionKey: 'enterpriseDesc',
                ctaKey: 'contactSales',
                features: [{ label: t('landing.enterpriseFeature1') }, { label: t('landing.enterpriseFeature2') }],
                popular: false,
              },
            ].map((plan, index) => (
              <div
                key={index}
                className={`relative bg-white rounded-2xl p-8 border ${
                  plan.popular
                    ? 'border-[#065F46] shadow-xl shadow-emerald-100 scale-105'
                    : 'border-gray-200 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#065F46] to-[#10B981] text-white px-4 py-1 rounded-full text-sm font-semibold">
                    {t('landing.mostPopular')}
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t(`landing.${plan.nameKey}`)}</h3>
                <p className="text-gray-500 mb-6 text-sm">{t(`landing.${plan.descriptionKey}`)}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.price === 0 ? t('landing.free') : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-gray-500"> {t('landing.perMonth')}</span>}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                      <span>{feature.label}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`block text-center py-3 px-6 rounded-xl font-semibold transition-colors ${
                    plan.popular
                      ? 'bg-gradient-to-r from-[#065F46] to-[#10B981] text-white hover:shadow-lg'
                      : 'border-2 border-gray-200 text-gray-700 hover:border-[#065F46] hover:text-[#065F46]'
                  }`}
                >
                  {t(`landing.${plan.ctaKey}`)}
                </Link>
              </div>
            ))}
          </div>

          {/* Trust Badges */}
          <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>{t('landing.noCreditCard')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>{t('landing.dayFreeTrial')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>{t('landing.cancelAnytime')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          FAQ SECTION
      ======================================== */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#065F46]/10 text-[#065F46] px-4 py-2 rounded-full text-sm font-medium mb-4">
              <MessageSquare className="w-4 h-4" />
              <span>{t('landing.faq')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('landing.frequentlyAskedQuestions')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('landing.gotQuestions')}
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900">{t(`landing.${faq.questionKey}`)}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-6 pt-0 border-t border-gray-100">
                    <p className="text-gray-600">{t(`landing.${faq.answerKey}`)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Contact CTA */}
          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">{t('landing.stillHaveQuestions')}</p>
            <a
              href="mailto:support@resourcemanager.com"
              className="inline-flex items-center gap-2 text-[#065F46] font-semibold hover:underline"
            >
              <Mail className="w-4 h-4" />
              {t('landing.contactSupportTeam')}
            </a>
          </div>
        </div>
      </section>

      {/* ========================================
          FINAL CTA
      ======================================== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#065F46] via-emerald-700 to-[#10B981] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            {t('landing.readyToTransform')}
          </h2>
          <p className="text-xl text-emerald-100 mb-10 max-w-2xl mx-auto">
            {t('landing.readyToTransformDesc')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-[#065F46] shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
            >
              {t('landing.startFreeTrial')}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/30 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/10"
            >
              {t('landing.learnMore')}
              <ArrowUpRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* ========================================
          FOOTER
      ======================================== */}
      <footer className="bg-gray-900 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            {/* Brand Column */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-[#065F46] to-[#10B981] rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">{t('common.appName')}</span>
              </div>
              <p className="text-gray-400 text-sm mb-6 max-w-sm">
                {t('landing.completeBusinessSolution')}
              </p>
              <div className="flex gap-4">
                {[
                  { icon: <Twitter className="w-5 h-5" />, name: 'Twitter' },
                  { icon: <Linkedin className="w-5 h-5" />, name: 'LinkedIn' },
                  { icon: <Github className="w-5 h-5" />, name: 'GitHub' },
                ].map((social, index) => (
                  <a
                    key={index}
                    href="#"
                    className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:bg-[#065F46] hover:text-white transition-colors"
                    aria-label={social.name}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-semibold mb-4">{t('common.product')}</h4>
              <ul className="space-y-3 text-gray-400 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">{t('landing.features')}</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">{t('landing.pricing')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.integrations')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.api')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.changelog')}</a></li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="font-semibold mb-4">{t('common.company')}</h4>
              <ul className="space-y-3 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.aboutUs')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.blog')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.careers')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.press')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.partners')}</a></li>
              </ul>
            </div>

            {/* Support Links */}
            <div>
              <h4 className="font-semibold mb-4">{t('landing.support')}</h4>
              <ul className="space-y-3 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.helpCenter')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.documentation')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.contactUs')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.status')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('landing.community')}</a></li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-semibold mb-4">{t('landing.contact')}</h4>
              <ul className="space-y-3 text-gray-400 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${t('landing.supportEmail')}`} className="hover:text-white transition-colors">
                    {t('landing.supportEmail')}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>{t('landing.phone')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{t('landing.location')}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
            <p>© 2024 {t('common.appName')}. {t('landing.allRightsReserved')}</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">{t('landing.privacyPolicy')}</a>
              <a href="#" className="hover:text-white transition-colors">{t('landing.termsOfService')}</a>
              <a href="#" className="hover:text-white transition-colors">{t('landing.cookiePolicy')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Social media icons
const Twitter = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.214-6.817H9.351l7.73-8.835V2.25h-3.554l-7.73 8.835V2.25z" />
  </svg>
);

const Linkedin = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-1.136.92-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 1.637-1.85 3.601 3.601 4.267-1.089 4.267-2.939V9h3.564v11.452zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.064-2.063 1.14 0 2.064.925 2.064 2.063zM1.782 13.019c0-1.138.92-2.063 2.064-2.063h20.451C23.2 15.426 24 12.022 24 10.436c0-1.138-.92-2.063-2.064-2.063z" />
  </svg>
);

const Github = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261 793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.089.745-1.083 1.237 1.083 1.237 1.07 1.834 2.807 1.304 3.492 1.304 3.601 0 4.267-1.089 4.267-2.939v-6.286c-6.627-5.373-12-5.373-12z" />
  </svg>
);

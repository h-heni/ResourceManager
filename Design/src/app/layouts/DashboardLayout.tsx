import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSelector from '../components/LanguageSelector';
import NotificationBell from '../components/NotificationBell';
import {
  LayoutDashboard,
  Users,
  FileText,
  Truck,
  Settings,
  LogOut,
  Menu,
  X,
  DollarSign,
  Package,
  ChevronDown,
  ChevronRight,
  Building2,
  Boxes,
  UserPlus,
  ShoppingCart,
  AlertTriangle,
  BarChart3,
  Upload,
  FileSpreadsheet,
  Palette,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface NavItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  path: string;
}

interface NavSection {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  key: string;
  children: NavItem[];
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, displayName, isManager } = useAuth();
  const { t } = useTranslation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sales: true,
    purchases: false,
    inventory: false,
    settings: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const navSections: NavSection[] = [
    {
      icon: DollarSign,
      label: t('sales'),
      key: 'sales',
      children: [
        { icon: Users, label: t('clients'), path: '/clients' },
        { icon: FileText, label: t('invoices'), path: '/invoices' },
        { icon: FileText, label: t('quotes'), path: '/quotes' },
        { icon: Truck, label: t('delivery_notes'), path: '/delivery-notes' },
        { icon: Package, label: t('products'), path: '/products' },
      ],
    },
    {
      icon: Building2,
      label: t('purchases'),
      key: 'purchases',
      children: [
        { icon: Users, label: t('suppliers'), path: '/suppliers' },
        { icon: FileText, label: 'Supplier Invoices', path: '/supplier-invoices' },
        { icon: Upload, label: t('nav.uploadSupplier', 'Upload Invoice'), path: '/upload-supplier' },
        { icon: DollarSign, label: t('expenses'), path: '/expenses' },
      ],
    },
    {
      icon: Boxes,
      label: t('inventory'),
      key: 'inventory',
      children: [
        { icon: Package, label: t('inventory'), path: '/inventory' },
        { icon: ShoppingCart, label: t('nav.purchaseOrders', 'Purchase Orders'), path: '/inventory/purchase-orders' },
        { icon: AlertTriangle, label: t('nav.stockAlerts', 'Stock Alerts'), path: '/inventory/alerts' },
        { icon: BarChart3, label: t('nav.inventoryReports', 'Reports'), path: '/inventory/reports' },
      ],
    },
  ];

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.path;
    return (
      <button
        key={item.path}
        onClick={() => {
          navigate(item.path);
          setDrawerOpen(false);
        }}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-left',
          isActive
            ? 'bg-[#065F46] text-white'
            : 'text-gray-700 hover:bg-gray-100'
        )}
      >
        <item.icon size={18} />
        <span className="text-sm">{item.label}</span>
      </button>
    );
  };

  const renderSection = (section: NavSection) => {
    const isExpanded = expandedSections[section.key];
    return (
      <div key={section.key} className="mb-2">
        <button
          onClick={() => toggleSection(section.key)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-gray-100 text-gray-700"
        >
          <div className="flex items-center gap-3">
            <section.icon size={18} />
            <span className="text-sm font-medium">{section.label}</span>
          </div>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {isExpanded && (
          <div className="ml-4 mt-1 space-y-1">
            {section.children.map(renderNavItem)}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-[#065F46]">{t('app_name')}</h1>
        <p className="text-sm text-gray-600 mt-1">{displayName}</p>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <button
          onClick={() => {
            navigate('/dashboard');
            setDrawerOpen(false);
          }}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-left mb-4',
            location.pathname === '/dashboard'
              ? 'bg-[#065F46] text-white'
              : 'text-gray-700 hover:bg-gray-100'
          )}
        >
          <LayoutDashboard size={18} />
          <span className="text-sm">{t('dashboard')}</span>
        </button>

        <div className="space-y-1">
          {navSections.map(renderSection)}
        </div>

        {isManager && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                navigate('/users');
                setDrawerOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-left mb-2',
                location.pathname === '/users'
                  ? 'bg-[#065F46] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <UserPlus size={18} />
              <span className="text-sm">{t('users')}</span>
            </button>
            <button
              onClick={() => {
                navigate('/settings');
                setDrawerOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-left',
                location.pathname === '/settings'
                  ? 'bg-[#065F46] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Settings size={18} />
              <span className="text-sm">{t('settings')}</span>
            </button>
            <button
              onClick={() => {
                navigate('/data-management');
                setDrawerOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-left mt-2',
                location.pathname === '/data-management'
                  ? 'bg-[#065F46] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <FileSpreadsheet size={18} />
              <span className="text-sm">{t('nav.dataManagement', 'Data Management')}</span>
            </button>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => {
            navigate('/new-dashboard');
            setDrawerOpen(false);
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[#7C3AED] hover:bg-purple-50 transition-colors mb-2"
        >
          <Palette size={18} />
          <span className="text-sm font-semibold">RSC Manager</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm">{t('logout')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:w-64 bg-white border-r border-gray-200 flex-col">
        {sidebarContent}
      </aside>

      {/* Sidebar - Mobile Drawer */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform lg:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-[#065F46]">{t('app_name')}</h1>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <div className="flex-1"></div>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <NotificationBell />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
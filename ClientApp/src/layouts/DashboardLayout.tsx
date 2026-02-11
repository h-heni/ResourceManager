import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSelector from '../components/LanguageSelector';
import NotificationBell from '../components/NotificationBell';
import api from '../services/api';
import {
    LayoutDashboard,
    Users,
    FileText,
    Truck,
    Settings,
    LogOut,
    Menu,
    X,
    CreditCard,
    UserPlus,
    FileUp,
    DollarSign,
    Package,
    ChevronDown,
    ChevronRight,
    Building2,
    Database
} from 'lucide-react';
import { cn } from '../lib/utils';

// Sub-navigation section type
interface NavSection {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    key: string;
    children: NavItem[];
}

interface NavItem {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    path: string;
}

export default function DashboardLayout() {
    // Hooks must be called before any derived values that depend on them
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, canManageUsers, canManageSettings, displayName, isSuperAdmin, isManager } = useAuth();
    const { t } = useTranslation();

    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [companyName, setCompanyName] = useState<string>('');
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const prevPathRef = useRef(location.pathname);
    const userName = displayName || '';

    // Determine active section and auto-expand it when route changes
    useEffect(() => {
        if (prevPathRef.current === location.pathname) return;
        prevPathRef.current = location.pathname;

        const path = location.pathname;
        const newExpanded: Record<string, boolean> = {};

        if (['/clients', '/invoices', '/quotes', '/delivery-notes', '/products'].some(p => path.startsWith(p))) {
            newExpanded['sales'] = true;
        }
        if (['/suppliers', '/supplier-invoices', '/expenses'].some(p => path.startsWith(p))) {
            newExpanded['purchases'] = true;
        }
        if (path.startsWith('/settings') || path.startsWith('/data-management')) {
            newExpanded['settings'] = true;
        }

        if (Object.keys(newExpanded).length > 0) {
            setExpandedSections(prev => ({ ...prev, ...newExpanded }));
        }
    }, [location.pathname]);

    // Fetch company branding on mount
    useEffect(() => {
        let logoUrlToCleanup: string | null = null;

        const fetchCompanyBranding = async () => {
            try {
                const res = await api.get('/Settings');
                if (res.data) {
                    setCompanyName(res.data.companyName || 'Resource Manager');
                }

                // Only fetch logo blob if the backend confirms one exists
                if (res.data?.hasLogoData) {
                    try {
                        const logoRes = await api.get('/Settings/logo', { responseType: 'blob' });
                        if (logoRes.data && logoRes.data.size > 0) {
                            const url = URL.createObjectURL(logoRes.data);
                            logoUrlToCleanup = url;
                            setCompanyLogo(url);
                        }
                    } catch {
                        // Logo fetch failed — non-critical
                    }
                }

            } catch (error) {
                console.error('Error fetching company branding:', error);
                setCompanyName('Resource Manager');
            }
        };

        fetchCompanyBranding();

        return () => {
            if (logoUrlToCleanup) {
                URL.revokeObjectURL(logoUrlToCleanup);
            }
        };
    }, []);

    // userName is derived directly from displayName (no sync effect needed)

    // Dynamic browser tab: title + favicon from company branding
    useEffect(() => {
        document.title = companyName ? `Resource Manager — ${companyName}` : 'Resource Manager';
    }, [companyName]);

    useEffect(() => {
        const defaultFavicon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📄</text></svg>";
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = companyLogo || defaultFavicon;

        return () => {
            // Restore default favicon on unmount (logout / company switch)
            const el = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
            if (el) el.href = defaultFavicon;
        };
    }, [companyLogo]);

    const handleLogout = () => {
        logout();
    };

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // ════════════════════════════════════════════════════════
    // NAVIGATION STRUCTURE
    // ════════════════════════════════════════════════════════

    const topNavItems: NavItem[] = [
        { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/dashboard' },
    ];

    const navSections: NavSection[] = [
        {
            icon: Building2,
            label: t('nav.salesSection'),
            key: 'sales',
            children: [
                { icon: Users, label: t('nav.clients'), path: '/clients' },
                { icon: CreditCard, label: t('nav.quotes'), path: '/quotes' },
                { icon: Truck, label: t('nav.deliveryNotes'), path: '/delivery-notes' },
                { icon: FileText, label: t('nav.invoices'), path: '/invoices' },
                { icon: Package, label: t('nav.products'), path: '/products' },
            ]
        },
        {
            icon: DollarSign,
            label: t('nav.purchasesSection'),
            key: 'purchases',
            children: [
                { icon: Truck, label: t('nav.suppliers'), path: '/suppliers' },
                { icon: FileUp, label: t('nav.supplierInvoices'), path: '/supplier-invoices' },
                { icon: DollarSign, label: t('nav.expenses'), path: '/expenses' },
            ]
        },
    ];

    const bottomNavItems: NavItem[] = [
        ...(isManager ? [{ icon: Database, label: t('nav.dataManagement', 'Data Management'), path: '/data-management' }] : []),
        ...(canManageUsers ? [{ icon: UserPlus, label: t('nav.users'), path: '/users' }] : []),

        ...(canManageSettings ? [{ icon: Settings, label: t('nav.settings'), path: '/settings' }] : []),
    ];

    // ════════════════════════════════════════════════════════
    // RENDER HELPERS
    // ════════════════════════════════════════════════════════

    const isActivePath = (path: string) => {
        if (path === '/dashboard') return location.pathname === '/dashboard';
        return location.pathname.startsWith(path);
    };

    const renderNavItem = (item: NavItem, indent = false) => {
        const active = isActivePath(item.path);
        return (
            <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group text-left text-sm",
                    indent && sidebarOpen && "pl-11",
                    active
                        ? "bg-[#065F46] text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100"
                )}
            >
                <item.icon size={18} className="flex-shrink-0" />
                <span className={cn(
                    "font-medium transition-all duration-200 overflow-hidden whitespace-nowrap",
                    sidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
                )}>
                    {item.label}
                </span>
            </button>
        );
    };

    const renderSection = (section: NavSection) => {
        const isExpanded = expandedSections[section.key] || false;
        const hasActiveChild = section.children.some(c => isActivePath(c.path));

        return (
            <div key={section.key} className="space-y-0.5">
                <button
                    onClick={() => toggleSection(section.key)}
                    className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-left text-sm",
                        hasActiveChild
                            ? "text-[#065F46] font-semibold bg-[#065F46]/5"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                >
                    <section.icon size={18} className="flex-shrink-0" />
                    <span className={cn(
                        "font-medium transition-all duration-200 overflow-hidden whitespace-nowrap flex-1",
                        sidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
                    )}>
                        {section.label}
                    </span>
                    {sidebarOpen && (
                        <span className="flex-shrink-0 text-slate-400">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                    )}
                </button>
                {isExpanded && sidebarOpen && (
                    <div className="space-y-0.5">
                        {section.children.map(child => renderNavItem(child, true))}
                    </div>
                )}
                {/* When sidebar collapsed, show children as direct icons */}
                {!sidebarOpen && (
                    <div className="space-y-0.5">
                        {section.children.map(child => renderNavItem(child, false))}
                    </div>
                )}
            </div>
        );
    };

    // ════════════════════════════════════════════════════════
    // MAIN RENDER
    // ════════════════════════════════════════════════════════

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Sidebar — Professional Green: white bg, green active states */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out flex flex-col",
                    "bg-white border-r border-slate-200",
                    sidebarOpen ? "w-72" : "w-20"
                )}
            >
                {/* Company Header */}
                <div className="h-[72px] flex items-center justify-between px-4 border-b border-slate-200">
                    {sidebarOpen ? (
                        <div className="flex items-center gap-3 overflow-hidden">
                            {companyLogo ? (
                                <img
                                    src={companyLogo}
                                    alt="Company Logo"
                                    className="h-10 w-10 object-contain rounded-lg flex-shrink-0"
                                />
                            ) : (
                                <div className="size-10 rounded-lg bg-[#065F46] flex items-center justify-center flex-shrink-0">
                                    <LayoutDashboard className="size-6 text-white" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="text-base font-semibold text-slate-900 truncate">
                                    {companyName || t('common.appName')}
                                </div>
                                <div className="text-xs text-slate-500">{t('common.appName')}</div>
                            </div>
                        </div>
                    ) : (
                        companyLogo ? (
                            <img
                                src={companyLogo}
                                alt="Logo"
                                className="h-10 w-10 object-contain rounded-lg mx-auto"
                            />
                        ) : (
                            <div className="size-10 rounded-lg bg-[#065F46] flex items-center justify-center mx-auto">
                                <LayoutDashboard className="size-5 text-white" />
                            </div>
                        )
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0"
                    >
                        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-1">
                    {/* Dashboard */}
                    {topNavItems.map(item => renderNavItem(item))}

                    {/* Separator */}
                    <div className="border-t border-slate-200 my-2" />

                    {/* Contextual Sections: Sales & Purchases */}
                    {navSections.map(section => renderSection(section))}

                    {/* Separator */}
                    <div className="border-t border-slate-200 my-2" />

                    {/* Management items */}
                    {bottomNavItems.map(item => renderNavItem(item))}
                </nav>

                {/* User info + Logout */}
                <div className="p-3 border-t border-slate-200">
                    {sidebarOpen && userName && (
                        <div className="text-xs text-slate-500 mb-2 truncate px-4">
                            {userName}
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all text-sm",
                            !sidebarOpen && "justify-center"
                        )}
                    >
                        <LogOut size={18} />
                        <span className={cn("font-medium transition-all duration-200 overflow-hidden", sidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0")}>
                            {t('nav.signOut')}
                        </span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={cn(
                "flex-1 transition-all duration-300 min-h-screen",
                sidebarOpen ? "ml-72" : "ml-20"
            )}>
                {/* Topbar */}
                <div className="bg-white border-b border-slate-200 px-8 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {companyLogo && (
                            <img src={companyLogo} alt="" className="h-7 w-7 object-contain rounded" />
                        )}
                        <span className="text-sm font-medium text-slate-600 hidden md:inline">
                            {companyName}
                        </span>
                        {userName && (
                            <>
                                <div className="w-px h-5 bg-slate-200 hidden md:block" />
                                <span className="text-sm text-slate-500 hidden md:inline">{userName}</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {!isSuperAdmin && <NotificationBell />}
                        <div className="w-px h-6 bg-slate-200"></div>
                        <LanguageSelector />
                    </div>
                </div>

                {/* Page Content */}
                <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

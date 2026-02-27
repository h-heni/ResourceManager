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
    Database,
    Shield
} from 'lucide-react';
import { cn } from '../lib/utils';
import { logger } from '../lib/logger';

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
    badge?: number;
}

export default function DashboardLayout() {
    // Hooks must be called before any derived values that depend on them
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, canManageUsers, canManageSettings, displayName, isSuperAdmin, isManager, isEmployee, isAuthenticated } = useAuth();
    const { t } = useTranslation();

    // Below lg (1024 px) → mobile/tablet (drawer); lg+ → sidebar always visible
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [companyName, setCompanyName] = useState<string>('');
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const prevPathRef = useRef(location.pathname);
    const userName = displayName || '';

    // Determine active section and auto-expand it when route changes
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (prevPathRef.current === location.pathname) return;
        prevPathRef.current = location.pathname;

        const path = location.pathname;
        const newExpanded: Record<string, boolean> = {};

        const matches = (basePath: string) => path === basePath || path.startsWith(`${basePath}/`);

        if (['/clients', '/invoices', '/quotes', '/delivery-notes', '/products'].some(matches)) {
            newExpanded['sales'] = true;
        }
        if (['/suppliers', '/supplier-invoices', '/expenses'].some(matches)) {
            newExpanded['purchases'] = true;
        }
        if (matches('/settings') || matches('/data-management')) {
            newExpanded['settings'] = true;
        }

        if (Object.keys(newExpanded).length > 0) {
            setExpandedSections(prev => ({ ...prev, ...newExpanded }));
        }
    }, [location.pathname]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Fetch company branding on mount (only if authenticated)
    useEffect(() => {
        if (!isAuthenticated) return;
        
        let logoUrlToCleanup: string | null = null;

        const fetchCompanyBranding = async () => {
            try {
                // Use /branding endpoint for all roles (works for Employee too)
                const res = await api.get('/Settings/branding');
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
                logger.error('Error fetching company branding:', error);
                setCompanyName('Resource Manager');
            }
        };

        fetchCompanyBranding();

        return () => {
            if (logoUrlToCleanup) {
                URL.revokeObjectURL(logoUrlToCleanup);
            }
        };
    }, [isAuthenticated]);

    // userName is derived directly from displayName (no sync effect needed)

    // Handle window resize for responsive sidebar
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (!mobile) setDrawerOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    // Dashboard is hidden from Employee role
    const topNavItems: NavItem[] = isEmployee
        ? []
        : [{ icon: LayoutDashboard, label: t('nav.dashboard'), path: '/dashboard' }];

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
        ...(isSuperAdmin ? [{ icon: Shield, label: t('nav.subscriptions', 'Subscriptions'), path: '/subscriptions' }] : []),
        ...(canManageSettings ? [{ icon: Settings, label: t('nav.settings'), path: '/settings' }] : []),
    ];

    // ════════════════════════════════════════════════════════
    // RENDER HELPERS
    // ════════════════════════════════════════════════════════

    const isActivePath = (path: string) => {
        const normalizedPath = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
        const currentPath = location.pathname.length > 1 && location.pathname.endsWith('/')
            ? location.pathname.slice(0, -1)
            : location.pathname;

        if (normalizedPath === '/dashboard') {
            return currentPath === '/dashboard';
        }

        return currentPath === normalizedPath || currentPath.startsWith(`${normalizedPath}/`);
    };

    const renderNavItem = (item: NavItem, indent = false) => {
        const active = isActivePath(item.path);
        return (
            <button
                key={item.path}
                onClick={() => {
                    navigate(item.path);
                    if (isMobile) setDrawerOpen(false);
                }}
                className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-200 group text-start text-sm",
                    indent && "ps-11",
                    active
                        ? "bg-[#065F46] text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100"
                )}
            >
                <item.icon size={18} className="flex-shrink-0" />
                <span className="font-medium truncate">{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                        className={cn(
                            'ms-auto rounded-full px-2 py-0.5 text-xs font-semibold leading-none',
                            active ? 'bg-white/20 text-white' : 'bg-[#ECFDF5] text-[#065F46]'
                        )}
                    >
                        {item.badge}
                    </span>
                )}
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
                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-200 text-start text-sm",
                        hasActiveChild
                            ? "text-[#065F46] font-semibold bg-[#065F46]/5"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                >
                    <section.icon size={18} className="flex-shrink-0" />
                    <span className="font-medium truncate flex-1">{section.label}</span>
                    <span className="flex-shrink-0 text-slate-400">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                </button>
                {isExpanded && (
                    <div className="space-y-0.5">
                        {section.children.map(child => renderNavItem(child, true))}
                    </div>
                )}
            </div>
        );
    };

    // ════════════════════════════════════════════════════════
    // SIDEBAR CONTENT (shared by desktop sidebar & mobile drawer)
    // ════════════════════════════════════════════════════════

    const sidebarContent = (
        <>
            {/* Company Header */}
            <div className="h-[72px] flex items-center gap-3 px-4 border-b border-slate-200">
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
                <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-slate-900 truncate">
                        {companyName || t('common.appName')}
                    </div>
                    <div className="text-xs text-slate-500">{t('common.appName')}</div>
                </div>
                {isMobile && (
                    <button
                        onClick={() => setDrawerOpen(false)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-1">
                {topNavItems.map(item => renderNavItem(item))}
                {!isSuperAdmin && (
                    <>
                        <div className="border-t border-slate-200 my-2" />
                        {navSections.map(section => renderSection(section))}
                    </>
                )}
                <div className="border-t border-slate-200 my-2" />
                {bottomNavItems.map(item => renderNavItem(item))}
            </nav>

            {/* User info + Logout */}
            <div className="p-3 border-t border-slate-200">
                {userName && (
                    <div className="text-xs text-slate-500 mb-2 truncate px-4">
                        {userName}
                    </div>
                )}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors text-sm"
                >
                    <LogOut size={18} />
                    <span className="font-medium">{t('nav.signOut')}</span>
                </button>
            </div>
        </>
    );

    // ════════════════════════════════════════════════════════
    // MAIN RENDER
    // ════════════════════════════════════════════════════════

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Mobile overlay — strictly conditional to avoid ghost shadow */}
            {isMobile && drawerOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={() => setDrawerOpen(false)}
                />
            )}

            {/* Sidebar: desktop = always visible; mobile = conditional drawer */}
            {(!isMobile || drawerOpen) && (
                <aside
                    className={cn(
                        "fixed inset-y-0 start-0 z-50 w-72 flex flex-col",
                        "bg-white border-e border-slate-200",
                        isMobile && "shadow-xl"
                    )}
                >
                    {sidebarContent}
                </aside>
            )}

            {/* Main Content */}
            <main className={cn(
                "min-h-screen min-w-0 w-full",
                !isMobile && "ms-72"
            )}>
                {/* Topbar */}
                <div className="bg-white border-b border-slate-200 px-4 lg:px-8 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {isMobile && (
                            <button
                                onClick={() => setDrawerOpen(true)}
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                                aria-label={t('nav.openMenu', 'Open menu')}
                            >
                                <Menu size={20} />
                            </button>
                        )}
                        {companyLogo && (
                            <img src={companyLogo} alt="" className="h-7 w-7 object-contain rounded" />
                        )}
                        <span className="text-sm font-medium text-slate-600 hidden lg:inline">
                            {companyName}
                        </span>
                        {userName && (
                            <>
                                <div className="w-px h-5 bg-slate-200 hidden lg:block" />
                                <span className="text-sm text-slate-500 hidden lg:inline">{userName}</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {!isSuperAdmin && <NotificationBell />}
                        <div className="w-px h-6 bg-slate-200" />
                        <LanguageSelector />
                    </div>
                </div>

                {/* Page Content */}
                <div className="rm-content-shell space-y-8 animate-fade-in">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

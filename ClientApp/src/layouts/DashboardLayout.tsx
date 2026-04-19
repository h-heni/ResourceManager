import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSelector from '../components/LanguageSelector';
import NotificationBell from '../components/NotificationBell';
import api from '../services/api';
import { seedSettingsCache } from '../hooks/useSettings';
import { setAppLanguage } from '../i18n/index';
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
    Building2,
    Database,
    Shield,
    Boxes,
    ShoppingCart,
    AlertTriangle,
    BarChart3
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
        if (matches('/inventory')) {
            newExpanded['inventory'] = true;
        }
        if (matches('/settings') || matches('/data-management')) {
            newExpanded['settings'] = true;
        }

        if (Object.keys(newExpanded).length > 0) {
            setExpandedSections(newExpanded);
        }
    }, [location.pathname]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Fetch company branding on mount (only if authenticated)
    useEffect(() => {
        if (!isAuthenticated) return;
        
        // Check sessionStorage cache first
        const cachedBranding = sessionStorage.getItem('company_branding');
        if (cachedBranding) {
            try {
                const cached = JSON.parse(cachedBranding);
                // Use queueMicrotask to avoid synchronous setState in effect
                queueMicrotask(() => setCompanyName(cached.companyName || 'Resource Manager'));
                // Seed currency settings from cached branding
                if (cached.currency) seedSettingsCache(cached.currency, cached.currencySymbol);
                if (cached.invoiceLanguage) setAppLanguage(cached.invoiceLanguage);
                // Still fetch logo if needed
                if (cached.hasLogoData) {
                    api.get('/Settings/logo', { responseType: 'blob' }).then(logoRes => {
                        if (logoRes.data?.size > 0) setCompanyLogo(URL.createObjectURL(logoRes.data));
                    }).catch(() => {});
                }
                return;
            } catch { /* fall through to fetch */ }
        }

        let logoUrlToCleanup: string | null = null;

        const fetchCompanyBranding = async () => {
            try {
                const res = await api.get('/Settings/branding');
                if (res.data) {
                    setCompanyName(res.data.companyName || 'Resource Manager');
                    // Cache branding data in sessionStorage
                    sessionStorage.setItem('company_branding', JSON.stringify({
                        companyName: res.data.companyName,
                        hasLogoData: res.data.hasLogoData,
                        currency: res.data.currency,
                        currencySymbol: res.data.currencySymbol,
                        invoiceLanguage: res.data.invoiceLanguage
                    }));
                    // Seed useSettings cache so it doesn't need a separate /Settings call
                    if (res.data.currency) seedSettingsCache(res.data.currency, res.data.currencySymbol);
                    // Sync language from branding response
                    if (res.data.invoiceLanguage) setAppLanguage(res.data.invoiceLanguage);
                }

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
        setExpandedSections(prev => {
            const isCurrentlyOpen = prev[key];
            // Close all sections, then toggle the clicked one
            const next: Record<string, boolean> = {};
            for (const k of Object.keys(prev)) next[k] = false;
            next[key] = !isCurrentlyOpen;
            return next;
        });
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
        {
            icon: Boxes,
            label: t('nav.inventorySection', 'Inventory'),
            key: 'inventory',
            children: [
                { icon: Package, label: t('nav.stockLevels', 'Stock Levels'), path: '/inventory' },
                { icon: ShoppingCart, label: t('nav.purchaseOrders', 'Purchase Orders'), path: '/inventory/purchase-orders' },
                { icon: AlertTriangle, label: t('nav.stockAlerts', 'Stock Alerts'), path: '/inventory/alerts' },
                { icon: BarChart3, label: t('nav.inventoryReports', 'Reports'), path: '/inventory/reports' },
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

        if (normalizedPath === '/dashboard' || normalizedPath === '/inventory') {
            return currentPath === normalizedPath;
        }

        return currentPath === normalizedPath || currentPath.startsWith(`${normalizedPath}/`);
    };

    const renderNavItem = (item: NavItem, isSubItem = false) => {
        const active = isActivePath(item.path);
        return (
            <NavLink
                key={item.path}
                to={item.path}
                onClick={() => { if (isMobile) setDrawerOpen(false); }}
                className={cn(
                    isSubItem ? 'panze-nav-subitem' : 'panze-nav-item',
                    active && 'active'
                )}
            >
                <span className="panze-nav-icon">
                    <item.icon size={isSubItem ? 16 : 18} />
                </span>
                <span className={isSubItem ? undefined : 'panze-nav-label'}>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="panze-nav-badge">{item.badge}</span>
                )}
            </NavLink>
        );
    };

    const renderSection = (section: NavSection) => {
        const isExpanded = expandedSections[section.key] || false;
        const hasActiveChild = section.children.some(c => isActivePath(c.path));

        // Check if ANY section has an active child (for dimming others)
        const anyGroupActive = navSections.some(s => s.children.some(c => isActivePath(c.path)));
        const isDimmed = anyGroupActive && !hasActiveChild;

        return (
            <div key={section.key} className={cn('panze-nav-group', hasActiveChild && 'section-active', isDimmed && 'section-dimmed')}>
                <button
                    onClick={() => toggleSection(section.key)}
                    className={cn(
                        'panze-nav-item',
                        isExpanded && 'expanded',
                        hasActiveChild && !isExpanded && 'active'
                    )}
                >
                    <span className="panze-nav-icon">
                        <section.icon size={18} />
                    </span>
                    <span className="panze-nav-label">{section.label}</span>
                    <ChevronDown
                        size={14}
                        className={cn('panze-nav-chevron-toggle', isExpanded && 'rotated')}
                    />
                </button>
                <div
                    className="panze-nav-submenu"
                    style={{ maxHeight: isExpanded ? `${section.children.length * 44}px` : '0px' }}
                >
                    <div className="panze-nav-submenu-inner">
                        {section.children.map(child => renderNavItem(child, true))}
                    </div>
                </div>
            </div>
        );
    };

    // ════════════════════════════════════════════════════════
    // SIDEBAR CONTENT (shared by desktop sidebar & mobile drawer)
    // ════════════════════════════════════════════════════════

    const sidebarContent = (
        <>
            {/* Panze Logo / Company Header */}
            <div className="panze-sidebar-top">
                {companyLogo ? (
                    <img
                        src={companyLogo}
                        alt="Company Logo"
                        className="h-[30px] w-[30px] object-contain rounded-full flex-shrink-0"
                    />
                ) : (
                    <div className="panze-logo-icon">
                        <LayoutDashboard size={16} />
                    </div>
                )}
                <span className="panze-logo truncate">
                    {companyName || t('common.appName')}
                </span>
                {isMobile && (
                    <button
                        onClick={() => setDrawerOpen(false)}
                        className="ml-auto p-1.5 rounded-full hover:bg-[#F4F4F5] text-[#71717A] transition-colors flex-shrink-0"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="panze-nav">
                {/* Top-level items (Dashboard) */}
                {topNavItems.map(item => renderNavItem(item))}

                {!isSuperAdmin && (
                    <>
                        {navSections.map(section => renderSection(section))}
                    </>
                )}

                {bottomNavItems.length > 0 && (
                    <>
                        <div className="panze-nav-section">{t('nav.settings', 'Config')}</div>
                        {bottomNavItems.map(item => renderNavItem(item))}
                    </>
                )}
            </nav>

            {/* User info + Logout */}
            <div className="panze-sidebar-user">
                <div className="panze-sidebar-avatar">
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                </div>
                {userName && (
                    <div className="panze-sidebar-user-info">
                        <div className="panze-sidebar-user-name">{userName}</div>
                    </div>
                )}
                <button onClick={handleLogout} className="panze-sidebar-logout-btn">
                    <LogOut size={14} />
                    <span>{t('nav.signOut', 'Déconnexion')}</span>
                </button>
            </div>
        </>
    );

    // ════════════════════════════════════════════════════════
    // MAIN RENDER
    // ════════════════════════════════════════════════════════

    return (
        <div className="panze-shell">
            {/* Mobile overlay */}
            {isMobile && drawerOpen && (
                <div
                    className="panze-mobile-overlay visible"
                    onClick={() => setDrawerOpen(false)}
                />
            )}

            {/* Mobile hamburger button */}
            {isMobile && !drawerOpen && (
                <button
                    onClick={() => setDrawerOpen(true)}
                    className="panze-mobile-menu-btn"
                    style={{ display: 'flex' }}
                    aria-label={t('nav.openMenu', 'Open menu')}
                >
                    <Menu size={20} />
                </button>
            )}

            {/* Sidebar */}
            <aside className={cn('panze-sidebar', isMobile && (drawerOpen ? 'mobile-open' : ''))}>
                {sidebarContent}
            </aside>

            {/* Right content area */}
            <div className="panze-right">
                {/* Header bar */}
                <div className="panze-header">
                    <div className="flex items-center justify-between">
                        <div className="panze-header-left">
                            {/* Page title injected by child pages or left empty */}
                        </div>
                        <div className="panze-header-right">
                            {!isSuperAdmin && (
                                <div className="panze-header-action" style={{ position: 'relative' }}>
                                    <NotificationBell />
                                </div>
                            )}
                            <LanguageSelector />
                        </div>
                    </div>
                </div>

                {/* Main scrollable content */}
                <div className="panze-main">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}

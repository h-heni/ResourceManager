import { useState, useEffect } from 'react';
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
    User,
    UserPlus,
    FileUp,
    DollarSign,
    Package,
    ChevronDown,
    ChevronRight,
    Building2
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
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [companyName, setCompanyName] = useState<string>('');
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, canManageUsers, canManageSettings } = useAuth();
    const { t } = useTranslation();

    // Determine active section and auto-expand it
    useEffect(() => {
        const path = location.pathname;
        const newExpanded: Record<string, boolean> = {};
        
        if (['/clients', '/invoices', '/quotes', '/delivery-notes', '/products'].some(p => path.startsWith(p))) {
            newExpanded['sales'] = true;
        }
        if (['/suppliers', '/supplier-invoices', '/expenses'].some(p => path.startsWith(p))) {
            newExpanded['purchases'] = true;
        }
        if (path.startsWith('/settings')) {
            newExpanded['settings'] = true;
        }
        
        setExpandedSections(prev => ({ ...prev, ...newExpanded }));
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
                
                try {
                    const logoRes = await api.get('/Settings/logo', { responseType: 'blob' });
                    if (logoRes.data && logoRes.data.size > 0) {
                        const url = URL.createObjectURL(logoRes.data);
                        logoUrlToCleanup = url;
                        setCompanyLogo(url);
                    }
                } catch {
                    // No logo uploaded
                }

                // Fetch user profile name
                try {
                    const profileRes = await api.get('/user/profile');
                    if (profileRes.data) {
                        setUserName(profileRes.data.firstName 
                            ? `${profileRes.data.firstName} ${profileRes.data.lastName || ''}`.trim()
                            : profileRes.data.email || ''
                        );
                    }
                } catch {
                    // Profile not available
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
        ...(canManageUsers ? [{ icon: UserPlus, label: t('nav.users'), path: '/users' }] : []),
        { icon: User, label: t('nav.profile'), path: '/profile' },
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
                    "w-full flex items-center p-2.5 rounded-xl transition-all duration-200 group text-left",
                    indent && sidebarOpen && "pl-10",
                    active
                        ? "bg-white text-[#764ba2] shadow-lg font-bold"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
            >
                <item.icon size={20} className={cn("flex-shrink-0 transition-colors", active ? "text-[#764ba2]" : "text-white/80")} />
                <span className={cn(
                    "ml-3 text-sm font-medium transition-all duration-200 overflow-hidden whitespace-nowrap",
                    sidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
                )}>
                    {item.label}
                </span>
                {active && sidebarOpen && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#764ba2] flex-shrink-0" />
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
                        "w-full flex items-center p-2.5 rounded-xl transition-all duration-200 text-left",
                        hasActiveChild
                            ? "text-white font-bold bg-white/15"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                >
                    <section.icon size={20} className="flex-shrink-0" />
                    <span className={cn(
                        "ml-3 text-sm font-medium transition-all duration-200 overflow-hidden whitespace-nowrap flex-1",
                        sidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
                    )}>
                        {section.label}
                    </span>
                    {sidebarOpen && (
                        <span className="flex-shrink-0 text-white/50">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                    )}
                </button>
                {isExpanded && sidebarOpen && (
                    <div className="space-y-0.5 ml-1">
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
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out flex flex-col shadow-2xl",
                    sidebarOpen ? "w-64" : "w-20",
                    "bg-gradient-to-b from-[#667eea] to-[#764ba2]"
                )}
            >
                {/* Company Header */}
                <div className="h-20 flex items-center justify-between px-4 border-b border-white/20">
                    {sidebarOpen ? (
                        <div className="flex items-center gap-3 overflow-hidden">
                            {companyLogo && (
                                <img 
                                    src={companyLogo} 
                                    alt="Company Logo" 
                                    className="h-10 w-10 object-contain rounded-lg bg-white/10 p-1 flex-shrink-0"
                                />
                            )}
                            <span className="text-lg font-bold text-white tracking-wide truncate">
                                {companyName || 'Resource Manager'}
                            </span>
                        </div>
                    ) : (
                        companyLogo ? (
                            <img 
                                src={companyLogo} 
                                alt="Logo" 
                                className="h-10 w-10 object-contain rounded-lg bg-white/10 p-1 mx-auto"
                            />
                        ) : (
                            <span className="text-2xl font-bold text-white mx-auto">
                                {companyName ? companyName.charAt(0).toUpperCase() : 'M'}
                            </span>
                        )
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors flex-shrink-0"
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto mt-2">
                    {/* Dashboard */}
                    {topNavItems.map(item => renderNavItem(item))}
                    
                    {/* Separator */}
                    <div className="border-t border-white/15 my-2" />

                    {/* Contextual Sections: Sales & Purchases */}
                    {navSections.map(section => renderSection(section))}

                    {/* Separator */}
                    <div className="border-t border-white/15 my-2" />

                    {/* Management items */}
                    {bottomNavItems.map(item => renderNavItem(item))}
                </nav>

                {/* User info + Logout */}
                <div className="p-4 border-t border-white/20">
                    {sidebarOpen && userName && (
                        <div className="text-xs text-white/60 mb-2 truncate px-3">
                            {userName}
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className={cn(
                            "w-full flex items-center p-2.5 rounded-xl text-white hover:bg-red-500/20 transition-all",
                            !sidebarOpen && "justify-center"
                        )}
                    >
                        <LogOut size={20} />
                        <span className={cn("ml-3 text-sm font-medium transition-all duration-200 overflow-hidden", sidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0")}>
                            {t('nav.signOut')}
                        </span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={cn(
                "flex-1 transition-all duration-300 min-h-screen bg-[#eef2f5]",
                sidebarOpen ? "ml-64" : "ml-20"
            )}>
                {/* Topbar with company/user info + Language + Notifications */}
                <div className="bg-white shadow-sm border-b border-gray-200 px-8 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {companyLogo && (
                            <img src={companyLogo} alt="" className="h-7 w-7 object-contain rounded" />
                        )}
                        <span className="text-sm font-medium text-gray-600 hidden md:inline">
                            {companyName}
                        </span>
                        {userName && (
                            <>
                                <div className="w-px h-5 bg-gray-200 hidden md:block" />
                                <span className="text-sm text-gray-500 hidden md:inline">{userName}</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <NotificationBell />
                        <div className="w-px h-6 bg-gray-200"></div>
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

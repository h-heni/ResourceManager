import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Blocks Employee role from accessing protected routes (like Dashboard).
 * Redirects Employees to /invoices instead.
 */
export default function EmployeeGuard() {
    const { isEmployee, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F9FAFB]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    // If Employee tries to access Dashboard, redirect to invoices
    if (isEmployee && location.pathname === '/dashboard') {
        return <Navigate to="/invoices" replace />;
    }

    return <Outlet />;
}

/**
 * RoleBasedHome - Redirects to appropriate home page based on role.
 * Employee → /invoices
 * Others → /dashboard
 */
export function RoleBasedHome() {
    const { isEmployee, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    // Employees go to invoices, others go to dashboard
    return <Navigate to={isEmployee ? '/invoices' : '/dashboard'} replace />;
}

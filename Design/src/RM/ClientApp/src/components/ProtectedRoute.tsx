import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { lazy, Suspense } from 'react';

const AccountLockedPage = lazy(() => import('../pages/AccountLockedPage'));

export default function ProtectedRoute() {
    const { isAuthenticated, loading, accountLocked, isSuperAdmin } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F9FAFB]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#065F46]"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // SuperAdmin is ALWAYS exempt from account lockout — they manage subscriptions
    if (accountLocked && !isSuperAdmin) {
        return (
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#065F46]"></div></div>}>
                <AccountLockedPage reason={accountLocked.reason} expiryDate={accountLocked.expiryDate} />
            </Suspense>
        );
    }

    return <Outlet />;
}

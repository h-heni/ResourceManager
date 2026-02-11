import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SettingsGuard() {
    const { user, isManager, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#065F46]"></div>
            </div>
        );
    }

    // Only enforce for Managers
    if (isManager && user && !user.isProfileComplete) {
        // If already on settings or init page, allow it
        if (location.pathname.startsWith('/settings') || location.pathname.startsWith('/company-init')) {
            return <Outlet />;
        }

        // Redirect to the dedicated initialization wizard
        return <Navigate to="/company-init" replace />;
    }

    return <Outlet />;
}

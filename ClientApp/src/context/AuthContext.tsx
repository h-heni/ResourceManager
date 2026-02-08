import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
    email: string;
    roles: string[];
    firstName: string;
    lastName: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, token: string, roles: string[], firstName?: string, lastName?: string) => void;
    logout: () => void;
    loading: boolean;
    displayName: string; // Computed display name (firstName lastName or email)
    // Role-based permission helpers
    isManager: boolean;
    isEmployee: boolean;
    isSuperAdmin: boolean;
    canManageUsers: boolean;
    canManageSettings: boolean;
    canCreateInvoices: boolean;
    canDeleteInvoices: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        const savedEmail = localStorage.getItem('user_email');
        const savedRoles = localStorage.getItem('user_roles');
        const savedFirstName = localStorage.getItem('user_firstName');
        const savedLastName = localStorage.getItem('user_lastName');

        if (token && savedEmail) {
            setUser({
                email: savedEmail,
                roles: savedRoles ? JSON.parse(savedRoles) : [],
                firstName: savedFirstName || '',
                lastName: savedLastName || ''
            });
        }
        setLoading(false);
    }, []);

    const login = (email: string, token: string, roles: string[], firstName?: string, lastName?: string) => {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_roles', JSON.stringify(roles));
        localStorage.setItem('user_firstName', firstName || '');
        localStorage.setItem('user_lastName', lastName || '');
        setUser({ email, roles, firstName: firstName || '', lastName: lastName || '' });
        navigate('/dashboard');
    };

    const logout = () => {
        localStorage.clear();
        setUser(null);
        navigate('/login');
    };

    // Compute display name: prefer "FirstName LastName", fallback to email
    const displayName = user 
        ? (user.firstName || user.lastName 
            ? `${user.firstName} ${user.lastName}`.trim() 
            : user.email)
        : '';

    // Role-based permission helpers
    const hasRole = (role: string) => user?.roles?.some(r => r.toLowerCase() === role.toLowerCase()) ?? false;
    
    const isSuperAdmin = hasRole('SuperAdmin');
    const isManager = hasRole('Manager') || isSuperAdmin;
    const isEmployee = hasRole('Employee');
    
    // Permission flags
    const canManageUsers = isManager; // Manager and SuperAdmin can manage users
    const canManageSettings = isManager; // Manager and SuperAdmin can manage settings
    const canCreateInvoices = isManager || isEmployee; // Both can create
    const canDeleteInvoices = isManager; // Only Manager can delete

    return (
        <AuthContext.Provider value={{ 
            user, 
            isAuthenticated: !!user, 
            login, 
            logout, 
            loading, 
            displayName,
            isManager,
            isEmployee,
            isSuperAdmin,
            canManageUsers,
            canManageSettings,
            canCreateInvoices,
            canDeleteInvoices
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

import React from 'react';
import { useAuth } from '../hooks/useAuth';

interface RoleGuardProps {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const { user } = useAuth();
  const userRoles = user?.roles ?? [];
  const hasAccess = roles.some((r) => userRoles.includes(r));
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

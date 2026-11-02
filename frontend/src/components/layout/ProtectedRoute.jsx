import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';
import Card from '../common/Card';
import Badge from '../common/Badge';
import { ShieldAlert } from 'lucide-react';

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-app-bg)]">
        <LoadingSpinner size="lg" message="Validating security credentials..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-500 mt-1">
              Your account role ({user?.role}) does not have permission to access this operational area.
            </p>
          </div>
          <div className="pt-2">
            <Badge variant="danger">Role Authorization Required: {allowedRoles.join(' or ')}</Badge>
          </div>
        </Card>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;


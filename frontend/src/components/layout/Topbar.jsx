import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, MapPin, UserCheck, Shield } from 'lucide-react';
import Badge from '../common/Badge';
import { NotificationBell } from '../notifications/NotificationBell';
import { useAuth } from '../../hooks/useAuth';

export function Topbar({ onToggleSidebar, pageTitle = 'Dashboard' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const roleBadgeVariant = user?.role === 'ADMIN' ? 'navy' : 'success';

  return (
    <header className="h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer focus:outline-none shrink-0"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-[var(--color-text-main)] leading-none truncate max-w-[190px] xs:max-w-[240px] sm:max-w-none">
            {pageTitle}
          </h2>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 hidden sm:block">
            Industrial Safety Surveillance Console
          </p>
        </div>
      </div>

      {/* Right: Site, Role Badge & User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
        {/* Site Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium">Plant 1 (Primary)</span>
        </div>

        {/* User Role Badge */}
        {user?.role && (
          <Badge variant={roleBadgeVariant} size="sm" dot>
            <span className="xs:hidden">{user.role === 'ADMIN' ? 'ADMIN' : 'OPERATOR'}</span>
            <span className="hidden xs:inline">{user.role === 'ADMIN' ? 'ADMINISTRATOR' : 'SAFETY OPERATOR'}</span>
          </Badge>
        )}

        {/* Batch 3: Real-Time Notification & Escalation Bell */}
        <NotificationBell />

        {/* User Profile Chip */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 pl-1.5 sm:pl-2 border-l border-slate-200">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-[var(--color-primary)] font-semibold text-xs shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-[var(--color-text-main)] leading-tight">
              {user?.name || 'Operator'}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">
              {user?.email || 'Logged In'}
            </p>
          </div>

          {/* Topbar Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out of console"
            className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Topbar;

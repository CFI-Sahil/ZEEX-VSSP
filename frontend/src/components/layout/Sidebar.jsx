import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  HardHat,
  AlertTriangle,
  FolderArchive,
  Activity,
  Radio,
  X,
  LogOut,
  GraduationCap,
  BookOpen,
  Clock,
  SlidersHorizontal,
  ClipboardList,
  Send,
  Inbox,
  History as HistoryIcon,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../hooks/useAuth';
import logoTransparent from '../../assets/logo-transparent.png';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Cameras', path: '/cameras', icon: Video },
  { name: 'Work Fronts', path: '/work-fronts', icon: HardHat },
  { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
  { name: 'Evidence', path: '/evidence', icon: FolderArchive },
  { name: 'Event Intake', path: '/event-intake', icon: Activity },
];

export function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-[#10243D] text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header with Transparent Logo */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900/80 p-1 flex items-center justify-center border border-slate-700/60 shrink-0">
              <img
                src={logoTransparent}
                alt="VSSP Logo"
                className="w-full h-full object-contain filter drop-shadow"
              />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-none">
                VSSP Console
              </h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-1">
                Visual Safety Surveillance
              </p>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#183653] cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Operational Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group select-none',
                    isActive
                      ? 'bg-[#183653] text-white shadow-xs border-l-2 border-[var(--color-primary)] font-semibold'
                      : 'text-slate-300 hover:bg-[#183653]/60 hover:text-white'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-[var(--color-primary)]' : 'text-slate-400 group-hover:text-slate-200'
                      )}
                    />
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
          <div className="pt-4 px-3 pb-2 text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center justify-between">
            <span>Training Sandbox</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">SIM</span>
          </div>
          <NavLink
            to="/training"
            end
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group select-none',
                isActive
                  ? 'bg-[#183653] text-white shadow-xs border-l-2 border-amber-400 font-semibold'
                  : 'text-slate-300 hover:bg-[#183653]/60 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <GraduationCap
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>Overview</span>
              </>
            )}
          </NavLink>
          <NavLink
            to="/training/scenarios"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group select-none',
                isActive
                  ? 'bg-[#183653] text-white shadow-xs border-l-2 border-amber-400 font-semibold'
                  : 'text-slate-300 hover:bg-[#183653]/60 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <BookOpen
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>Scenarios</span>
              </>
            )}
          </NavLink>
          <NavLink
            to="/training/history"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group select-none',
                isActive
                  ? 'bg-[#183653] text-white shadow-xs border-l-2 border-amber-400 font-semibold'
                  : 'text-slate-300 hover:bg-[#183653]/60 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Clock
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>History</span>
              </>
            )}
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink
              to="/training/admin/scenarios"
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group select-none',
                  isActive
                    ? 'bg-[#183653] text-white shadow-xs border-l-2 border-purple-400 font-semibold'
                    : 'text-slate-300 hover:bg-[#183653]/60 hover:text-white'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <SlidersHorizontal
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors',
                      isActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-slate-200'
                    )}
                  />
                  <span>Scenario Admin</span>
                </>
              )}
            </NavLink>
          )}

          {/* Shift Handover Section (Phase 3 Batch 6) */}
          <div className="pt-4 px-3 pb-2 text-[10px] font-semibold text-sky-400 uppercase tracking-wider flex items-center justify-between">
            <span>Shift Handover</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">OPS</span>
          </div>
          <NavLink
            to="/handovers"
            end
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group select-none',
                isActive
                  ? 'bg-[#183653] text-white shadow-xs border-l-2 border-sky-400 font-semibold'
                  : 'text-slate-300 hover:bg-[#183653]/60 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <ClipboardList
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>Overview</span>
              </>
            )}
          </NavLink>
          <NavLink
            to="/handovers/create"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group select-none',
                isActive
                  ? 'bg-[#183653] text-white shadow-xs border-l-2 border-sky-400 font-semibold'
                  : 'text-slate-300 hover:bg-[#183653]/60 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Send
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>Create Handover</span>
              </>
            )}
          </NavLink>
          <NavLink
            to="/handovers/inbox"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group select-none',
                isActive
                  ? 'bg-[#183653] text-white shadow-xs border-l-2 border-sky-400 font-semibold'
                  : 'text-slate-300 hover:bg-[#183653]/60 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Inbox
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>Incoming Inbox</span>
              </>
            )}
          </NavLink>
          <NavLink
            to="/handovers/history"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group select-none',
                isActive
                  ? 'bg-[#183653] text-white shadow-xs border-l-2 border-sky-400 font-semibold'
                  : 'text-slate-300 hover:bg-[#183653]/60 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <HistoryIcon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>History & Archive</span>
              </>
            )}
          </NavLink>
        </nav>

        {/* System Health Status & User Logout Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-[#0d1d31] space-y-2">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-800">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-slate-200 truncate">
                Monitoring Active
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                Role: {user?.role || 'Guest'}
              </p>
            </div>
          </div>

          {/* Quick Logout Button */}
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-white bg-rose-950/30 hover:bg-rose-900/50 border border-rose-900/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;

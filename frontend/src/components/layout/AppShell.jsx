import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const pageTitleMap = {
  '/': 'Dashboard Overview',
  '/cameras': 'Camera Registry & Feeds',
  '/work-fronts': 'Work-Front Registry',
  '/alerts': 'Safety Alert Management',
  '/evidence': 'Evidence & Snapshots',
};

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentTitle = pageTitleMap[location.pathname] || 'Surveillance Console';

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] flex flex-col lg:flex-row antialiased overflow-x-hidden">
      {/* Dark Navy Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          pageTitle={currentTitle}
        />

        {/* Page Content Viewport */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-5 sm:space-y-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppShell;


import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CamerasPage from './pages/CamerasPage';
import WorkFrontsPage from './pages/WorkFrontsPage';
import AlertsPage from './pages/AlertsPage';
import EvidencePage from './pages/EvidencePage';
import EventIntakePage from './pages/EventIntakePage';
import TrainingDashboardPage from './pages/training/TrainingDashboardPage';
import ScenarioLibraryPage from './pages/training/ScenarioLibraryPage';
import TrainingWorkspacePage from './pages/training/TrainingWorkspacePage';
import TrainingHistoryPage from './pages/training/TrainingHistoryPage';
import AdminScenarioManagementPage from './pages/training/AdminScenarioManagementPage';
import ShiftHandoverDashboardPage from './pages/handover/ShiftHandoverDashboardPage';
import CreateHandoverPage from './pages/handover/CreateHandoverPage';
import HandoverInboxPage from './pages/handover/HandoverInboxPage';
import HandoverDetailPage from './pages/handover/HandoverDetailPage';
import HandoverHistoryPage from './pages/handover/HandoverHistoryPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="cameras" element={<CamerasPage />} />
            <Route path="work-fronts" element={<WorkFrontsPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="evidence" element={<EvidencePage />} />
            <Route path="event-intake" element={<EventIntakePage />} />

            {/* Training Sandbox Routes (Phase 3 Batch 5) */}
            <Route path="training" element={<TrainingDashboardPage />} />
            <Route path="training/scenarios" element={<ScenarioLibraryPage />} />
            <Route path="training/session/:id" element={<TrainingWorkspacePage />} />
            <Route path="training/history" element={<TrainingHistoryPage />} />
            <Route
              path="training/admin/scenarios"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminScenarioManagementPage />
                </ProtectedRoute>
              }
            />
            {/* Shift Handover Routes (Phase 3 Batch 6) */}
            <Route path="handovers" element={<ShiftHandoverDashboardPage />} />
            <Route path="handovers/create" element={<CreateHandoverPage />} />
            <Route path="handovers/inbox" element={<HandoverInboxPage />} />
            <Route path="handovers/history" element={<HandoverHistoryPage />} />
            <Route path="handovers/:id" element={<HandoverDetailPage />} />
          </Route>

          {/* Catch-all Wildcard Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

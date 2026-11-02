import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Filter,
  Search,
  Eye,
  CheckCircle,
  ShieldCheck,
  RefreshCw,
  Plus,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import alertService from '../services/alertService';
import cameraService from '../services/cameraService';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Table, {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/common/Table';
import AlertDetailModal from '../components/alerts/AlertDetailModal';
import CloseAlertModal from '../components/alerts/CloseAlertModal';
import DemoIngestModal from '../components/alerts/DemoIngestModal';

export function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  // Modals
  const [inspectAlert, setInspectAlert] = useState(null);
  const [closingAlert, setClosingAlert] = useState(null);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch cameras for demo modal
  useEffect(() => {
    cameraService
      .getCameras({ limit: 50 })
      .then((res) => setCameras(res?.data?.cameras || []))
      .catch(() => {});
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(
    async (pageToLoad = pagination.page) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await alertService.getAlerts({
          page: pageToLoad,
          limit: pagination.limit,
          search: debouncedSearch,
          status: statusFilter,
          severity: severityFilter,
        });

        if (response?.data?.alerts) {
          setAlerts(response.data.alerts);
          if (response.meta) {
            setPagination(response.meta);
          }
        } else {
          setAlerts([]);
        }
      } catch (err) {
        setError(err.message || 'Failed to retrieve safety alerts from server');
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.limit, debouncedSearch, statusFilter, severityFilter]
  );

  useEffect(() => {
    fetchAlerts(pagination.page);
  }, [fetchAlerts, pagination.page]);

  // Action handlers
  const handleAcknowledge = async (alertId) => {
    setIsActionLoading(true);
    try {
      await alertService.acknowledgeAlert(alertId);
      if (inspectAlert?._id === alertId) {
        setInspectAlert((prev) => (prev ? { ...prev, status: 'ACKNOWLEDGED' } : null));
      }
      await fetchAlerts(pagination.page);
    } catch (err) {
      alert(err.message || 'Failed to acknowledge alert');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmClose = async (remarks) => {
    if (!closingAlert) return;
    setIsActionLoading(true);
    try {
      await alertService.closeAlert(closingAlert._id, remarks);
      setClosingAlert(null);
      if (inspectAlert?._id === closingAlert._id) {
        setInspectAlert(null);
      }
      await fetchAlerts(pagination.page);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSimulateEvent = async (payload) => {
    setIsActionLoading(true);
    try {
      await alertService.simulateDemoEvent(payload);
      await fetchAlerts(1);
    } finally {
      setIsActionLoading(false);
    }
  };

  const pendingCount = alerts.filter((a) => a.status === 'PENDING').length;

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
      case 'HIGH':
        return <Badge variant="danger">{sev}</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning">{sev}</Badge>;
      case 'LOW':
      default:
        return <Badge variant="neutral">{sev}</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CLOSED':
        return <Badge variant="success" dot>CLOSED</Badge>;
      case 'ACKNOWLEDGED':
        return <Badge variant="info" dot>ACKNOWLEDGED</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="warning" dot>PENDING</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-main)] tracking-tight">
            Safety Violations & Alerts
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Review incoming safety incidents, inspect snapshot evidence, and manage acknowledgment lifecycle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge variant="warning" dot>
              {pendingCount} Pending Review
            </Badge>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={Sparkles}
            onClick={() => setIsDemoModalOpen(true)}
            data-testid="simulate-event-btn"
          >
            Simulate Violation Event
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div className="p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search alert code, event ID, violation or camera..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              data-testid="alert-search-input"
            />
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-end">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-medium hidden sm:inline">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-[var(--color-border)] rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                data-testid="status-filter-select"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-medium hidden sm:inline">Severity:</span>
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-[var(--color-border)] rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                data-testid="severity-filter-select"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => fetchAlerts(pagination.page)}
              isLoading={isLoading}
              title="Refresh alerts"
            >
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-xs text-rose-800"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load safety alerts</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchAlerts(pagination.page)}>
            Retry
          </Button>
        </div>
      )}

      {/* Alerts Table Card */}
      <Card>
        {isLoading ? (
          <LoadingSpinner message="Loading safety violation alerts..." className="py-16" />
        ) : alerts.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={AlertTriangle}
              title={
                debouncedSearch || statusFilter !== 'ALL' || severityFilter !== 'ALL'
                  ? 'No alerts match criteria'
                  : 'No safety violations detected'
              }
              description={
                debouncedSearch || statusFilter !== 'ALL' || severityFilter !== 'ALL'
                  ? 'Try clearing filters or search terms to inspect other alerts.'
                  : 'All monitoring zones are compliant. When AI detection events occur, alerts will appear here.'
              }
              action={
                !debouncedSearch && statusFilter === 'ALL' && severityFilter === 'ALL' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Sparkles}
                    onClick={() => setIsDemoModalOpen(true)}
                  >
                    Simulate Demo Incident
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            <div className="sm:hidden px-3.5 py-1.5 bg-slate-50/80 border-b border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Swipe horizontally to view full table & actions</span>
              <span>&rarr;</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alert Code</TableHead>
                  <TableHead>Violation Type</TableHead>
                  <TableHead>Camera Location</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Lifecycle Status</TableHead>
                  <TableHead>Detected Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert._id} data-testid={`alert-row-${alert.alertCode}`}>
                    <TableCell className="font-mono text-xs font-semibold text-[var(--color-primary)]">
                      {alert.alertCode}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {alert.eventId}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-900 block">
                        {alert.violationName}
                      </span>
                      {alert.description && (
                        <span className="text-[11px] text-[var(--color-text-muted)] line-clamp-1">
                          {alert.description}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-slate-800 block">{alert.cameraCode}</span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {alert.location}
                      </span>
                    </TableCell>
                    <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-slate-700">
                      {(alert.confidence * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell>{getStatusBadge(alert.status)}</TableCell>
                    <TableCell className="text-xs text-[var(--color-text-muted)]">
                      {alert.detectedAt ? new Date(alert.detectedAt).toLocaleTimeString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() => setInspectAlert(alert)}
                          data-testid={`inspect-alert-${alert.alertCode}`}
                        >
                          Inspect
                        </Button>

                        {alert.status === 'PENDING' && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={CheckCircle}
                            onClick={() => handleAcknowledge(alert._id)}
                            isLoading={isActionLoading}
                            data-testid={`ack-alert-${alert.alertCode}`}
                          >
                            Acknowledge
                          </Button>
                        )}

                        {alert.status === 'ACKNOWLEDGED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            icon={ShieldCheck}
                            onClick={() => setClosingAlert(alert)}
                            data-testid={`close-alert-${alert.alertCode}`}
                          >
                            Close
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            <div className="p-3.5 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
              <div>
                Showing <span className="font-semibold text-slate-800">{alerts.length}</span> of{' '}
                <span className="font-semibold text-slate-800">{pagination.total}</span> alert(s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fetchAlerts(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isLoading}
                >
                  Previous
                </Button>
                <span className="px-2 font-medium">
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fetchAlerts(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Inspect Alert Modal */}
      <AlertDetailModal
        isOpen={Boolean(inspectAlert)}
        onClose={() => setInspectAlert(null)}
        alert={inspectAlert}
        onAcknowledge={handleAcknowledge}
        onOpenCloseModal={(alertToClose) => setClosingAlert(alertToClose)}
        isActionLoading={isActionLoading}
      />

      {/* Close Alert Modal */}
      <CloseAlertModal
        isOpen={Boolean(closingAlert)}
        onClose={() => setClosingAlert(null)}
        onConfirm={handleConfirmClose}
        alert={closingAlert}
        isLoading={isActionLoading}
      />

      {/* Demo Event Trigger Modal */}
      <DemoIngestModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onSimulate={handleSimulateEvent}
        isLoading={isActionLoading}
        cameras={cameras}
      />
    </div>
  );
}

export default AlertsPage;

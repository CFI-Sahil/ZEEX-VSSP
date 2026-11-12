import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Camera,
  Layers,
  Inbox,
  AlertCircle,
  Sparkles,
  Play,
  Cpu,
  ExternalLink,
  Clock,
} from 'lucide-react';
import eventService from '../services/eventService';
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
import EventDetailModal from '../components/events/EventDetailModal';
import SubmitEventIntakeModal from '../components/events/SubmitEventIntakeModal';

export function EventIntakePage() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    accepted: 0,
    rejected: 0,
    failed: 0,
    acceptanceRate: 100,
    uniqueCamerasCount: 0,
  });
  const [queueStats, setQueueStats] = useState({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalAccepted: 0,
  });
  const [cameras, setCameras] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [processingEventId, setProcessingEventId] = useState(null);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Search query parameter from navigation (e.g. from alerts page)
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  // Filters
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');

  // Modals
  const [inspectEvent, setInspectEvent] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load cameras for simulator dropdown
  useEffect(() => {
    cameraService
      .getCameras({ limit: 50 })
      .then((res) => setCameras(res?.data?.cameras || []))
      .catch(() => {});
  }, []);

  // Fetch statistics & queue metrics
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const [statsRes, queueRes] = await Promise.all([
        eventService.getIntakeStats(),
        eventService.getProcessingQueueStats().catch(() => null),
      ]);

      if (statsRes?.data?.stats) {
        setStats(statsRes.data.stats);
      }
      if (queueRes?.data?.stats) {
        setQueueStats(queueRes.data.stats);
      }
    } catch (_) {
      // Non-blocking for stats
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Fetch paginated events
  const fetchEvents = useCallback(
    async (pageToLoad = pagination.page) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await eventService.getIntakeEvents({
          page: pageToLoad,
          limit: pagination.limit,
          search: debouncedSearch,
          status: statusFilter,
          source: sourceFilter,
        });

        if (response?.data?.events) {
          setEvents(response.data.events);
          if (response.meta) {
            setPagination(response.meta);
          }
        } else {
          setEvents([]);
        }
      } catch (err) {
        setError(err.message || 'Failed to retrieve detection intake records from server');
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.limit, debouncedSearch, statusFilter, sourceFilter]
  );

  useEffect(() => {
    fetchEvents(pagination.page);
    fetchStats();
  }, [fetchEvents, fetchStats, pagination.page]);

  // Auto-open matching event modal when navigated via query param
  useEffect(() => {
    if (initialSearch && events.length > 0 && !inspectEvent) {
      const queryUpper = initialSearch.trim().toUpperCase();
      const match = events.find((e) => e.eventId === queryUpper);
      if (match) {
        setInspectEvent(match);
      }
    }
  }, [initialSearch, events, inspectEvent]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleSimulateSubmit = async (payload) => {
    setIsSubmitting(true);
    try {
      const res = await eventService.submitIntakeEvent(payload);
      await Promise.all([fetchEvents(1), fetchStats()]);
      setPagination((prev) => ({ ...prev, page: 1 }));
      return res;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessSingleEvent = async (event) => {
    const targetId = event._id || event.id;
    setProcessingEventId(targetId);
    setActionFeedback(null);
    try {
      const res = await eventService.processEventById(targetId);
      const alertCode = res?.data?.alert?.alertCode || 'ALT-CREATED';
      setActionFeedback({
        type: 'success',
        message: `Event '${event.eventId}' successfully evaluated. Alert '${alertCode}' generated!`,
      });
      await Promise.all([fetchEvents(pagination.page), fetchStats()]);

      if (inspectEvent && (inspectEvent._id === targetId || inspectEvent.id === targetId)) {
        const refreshed = await eventService.getIntakeEventById(targetId);
        if (refreshed?.data?.event) {
          setInspectEvent(refreshed.data.event);
        }
      }
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Processing failed',
      });
    } finally {
      setProcessingEventId(null);
    }
  };

  const handleProcessBatchQueue = async () => {
    setIsProcessingQueue(true);
    setActionFeedback(null);
    try {
      const res = await eventService.processBatchQueue(10);
      const metrics = res?.data || {};
      setActionFeedback({
        type: 'success',
        message: `Queue processed: ${metrics.processedCount || 0} event(s) evaluated, ${metrics.alertsCreated || 0} alert(s) generated.`,
      });
      await Promise.all([fetchEvents(pagination.page), fetchStats()]);
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Batch processing failed',
      });
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const severityVariant = (sev) => {
    switch (sev) {
      case 'CRITICAL':
      case 'HIGH':
        return 'danger';
      case 'MEDIUM':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--color-text-main)] tracking-tight">
              Detection Event Intake & Processing
            </h1>
            <Badge variant="navy" size="sm">
              Phase 3 · Batch 2
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Traceable intake queue for safety violation events, camera validation, rule engine evaluation, and operational alert generation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={Play}
            onClick={handleProcessBatchQueue}
            isLoading={isProcessingQueue}
            disabled={queueStats.pending === 0}
            title={queueStats.pending > 0 ? `Process ${queueStats.pending} pending events` : 'No pending events in queue'}
            data-testid="process-queue-btn"
          >
            Process Queue ({queueStats.pending})
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsSubmitModalOpen(true)}
            data-testid="open-submit-intake-modal-btn"
          >
            Submit Test Event
          </Button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-lg border flex items-center justify-between gap-2 text-xs ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-[11px] underline font-medium hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Ingested */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Ingested
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {isStatsLoading ? '...' : stats.total}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Recorded across pipelines</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </Card>

        {/* Accepted Events */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Accepted Intake
              </p>
              <Badge variant="success" size="sm">
                {stats.acceptanceRate}%
              </Badge>
            </div>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {isStatsLoading ? '...' : stats.accepted}
            </p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Passed fleet checks</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
        </Card>

        {/* Pending Processing Queue */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
              Pending Processing
            </p>
            <p className="text-2xl font-bold text-amber-800 mt-1">
              {isStatsLoading ? '...' : queueStats.pending}
            </p>
            <p className="text-[11px] text-amber-600 mt-0.5">Awaiting rule evaluation</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
        </Card>

        {/* Rejected Events */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Rejected Events
            </p>
            <p className="text-2xl font-bold text-rose-700 mt-1">
              {isStatsLoading ? '...' : stats.rejected}
            </p>
            <p className="text-[11px] text-rose-600 mt-0.5">Schema or camera failure</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </Card>

        {/* Fleet Cameras */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Fleet Cameras
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {isStatsLoading ? '...' : stats.uniqueCamerasCount}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Active monitoring points</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Filter & Action Toolbar */}
      <Card>
        <div className="p-3 sm:p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event ID, camera code, or violation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-[var(--color-border)] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="search-intake-events-input"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-[var(--color-border)] rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                data-testid="filter-intake-status-select"
              >
                <option value="ALL">All Outcomes</option>
                <option value="ACCEPTED">Accepted Only</option>
                <option value="REJECTED">Rejected Only</option>
                <option value="FAILED">Failed Only</option>
              </select>
            </div>

            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-[var(--color-border)] rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              data-testid="filter-intake-source-select"
            >
              <option value="ALL">All Pipelines</option>
              <option value="DEMO">Demo Simulator</option>
              <option value="EXTERNAL_CV">External CV (Boundary)</option>
            </select>

            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => {
                fetchEvents(pagination.page);
                fetchStats();
              }}
              isLoading={isLoading}
              title="Refresh intake queue"
            >
              Refresh
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
              <p className="font-semibold">Unable to load intake records</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchEvents(pagination.page)}>
            Retry
          </Button>
        </div>
      )}

      {/* Event Intake & Processing Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Retrieving detection event intake queue..." className="py-20" />
        ) : events.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Inbox}
              title={
                debouncedSearch || statusFilter !== 'ALL'
                  ? 'No matching intake events'
                  : 'No detection events received yet'
              }
              description={
                debouncedSearch || statusFilter !== 'ALL'
                  ? 'Try modifying your search query or reset the outcome filter.'
                  : 'Submit a simulated detection event to test camera validation, registry matching, and intake logging.'
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event ID</TableHead>
                    <TableHead>Source Pipeline</TableHead>
                    <TableHead>Camera & Location</TableHead>
                    <TableHead>Detection Category</TableHead>
                    <TableHead>Severity & Conf</TableHead>
                    <TableHead>Intake & Processing Status</TableHead>
                    <TableHead>Received Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => {
                    const isAccepted = ev.status === 'ACCEPTED';
                    const isRejected = ev.status === 'REJECTED';
                    const isProcessed = Boolean(ev.processedByRuleEngine);
                    const associatedAlertCode = ev.associatedAlert?.alertCode || null;

                    return (
                      <TableRow key={ev._id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Event ID */}
                        <TableCell>
                          <div className="font-mono text-xs font-semibold text-slate-900">
                            {ev.eventId}
                          </div>
                          {isProcessed && associatedAlertCode ? (
                            <a
                              href={`/alerts?search=${associatedAlertCode}`}
                              className="font-mono text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5 font-medium"
                              title={`View generated Alert ${associatedAlertCode}`}
                            >
                              <span>{associatedAlertCode}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : isAccepted ? (
                            <span className="text-[10px] text-amber-600 font-medium">Pending Engine</span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Rejected at Gate</span>
                          )}
                        </TableCell>

                        {/* Source */}
                        <TableCell>
                          <Badge variant={ev.source === 'DEMO' ? 'navy' : 'warning'} size="sm">
                            {ev.source === 'DEMO' ? 'SIMULATION' : 'EXT CV'}
                          </Badge>
                        </TableCell>

                        {/* Camera */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-medium text-slate-900 text-xs">
                            <Camera className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{ev.cameraCode}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {ev.camera?.site || 'Unassigned Site'}{' '}
                            {ev.camera?.location ? `· ${ev.camera.location}` : ''}
                          </div>
                        </TableCell>

                        {/* Detection */}
                        <TableCell>
                          <div className="font-medium text-slate-900 text-xs">
                            {ev.violationName || ev.violationType || 'Unspecified'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {ev.violationType || 'NONE'}
                          </div>
                        </TableCell>

                        {/* Severity & Confidence */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {ev.severity ? (
                              <Badge variant={severityVariant(ev.severity)} size="sm">
                                {ev.severity}
                              </Badge>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                            {ev.confidence != null && (
                              <span className="text-[11px] font-mono text-slate-600">
                                {(ev.confidence * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Intake & Processing Status */}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant={isAccepted ? 'success' : isRejected ? 'danger' : 'neutral'}
                                dot
                                size="sm"
                              >
                                {ev.status}
                              </Badge>
                            </div>
                            {isAccepted && (
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant={
                                    isProcessed
                                      ? 'success'
                                      : ev.processingStatus === 'FAILED'
                                      ? 'danger'
                                      : 'warning'
                                  }
                                  size="sm"
                                >
                                  {isProcessed
                                    ? 'RULE COMPLETED'
                                    : ev.processingStatus === 'FAILED'
                                    ? 'RULE FAILED'
                                    : 'UNPROCESSED'}
                                </Badge>
                              </div>
                            )}
                            {isRejected && ev.rejectionReason && (
                              <p
                                className="text-[10px] text-rose-600 truncate max-w-[160px]"
                                title={ev.rejectionReason}
                              >
                                {ev.rejectionReason}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* Received Time */}
                        <TableCell>
                          <div className="text-xs text-slate-800">
                            {ev.receivedAt ? new Date(ev.receivedAt).toLocaleTimeString() : 'N/A'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {ev.receivedAt ? new Date(ev.receivedAt).toLocaleDateString() : ''}
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAccepted && !isProcessed && (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={Play}
                                onClick={() => handleProcessSingleEvent(ev)}
                                isLoading={processingEventId === (ev._id || ev.id)}
                                title="Evaluate and process with Rule Engine"
                                className="text-xs px-2 py-1"
                              >
                                Process
                              </Button>
                            )}

                            {isProcessed && associatedAlertCode && (
                              <a
                                href={`/alerts?search=${associatedAlertCode}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                                title={`Open Alert ${associatedAlertCode}`}
                              >
                                <span>Alert</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              icon={Eye}
                              onClick={() => setInspectEvent(ev)}
                              className="hover:border-blue-300 text-xs px-2 py-1"
                              title="Inspect intake diagnostics"
                            >
                              Inspect
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="px-4 py-3 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Showing <span className="font-semibold text-slate-900">{events.length}</span> of{' '}
                <span className="font-semibold text-slate-900">{pagination.total}</span> intake event(s)
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </Button>
                <span className="text-xs font-medium text-slate-700 px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Inspect Event Detail Modal */}
      {inspectEvent && (
        <EventDetailModal
          isOpen={Boolean(inspectEvent)}
          onClose={() => setInspectEvent(null)}
          event={inspectEvent}
          onProcessEvent={handleProcessSingleEvent}
          isProcessing={processingEventId === (inspectEvent._id || inspectEvent.id)}
        />
      )}

      {/* Submit Test Event Modal */}
      {isSubmitModalOpen && (
        <SubmitEventIntakeModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          onSubmit={handleSimulateSubmit}
          cameras={cameras}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}

export default EventIntakePage;

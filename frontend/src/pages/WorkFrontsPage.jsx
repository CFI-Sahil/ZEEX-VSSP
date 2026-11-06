import React, { useState, useEffect, useCallback } from 'react';
import {
  HardHat,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Edit,
  Eye,
  Building2,
  AlertTriangle,
  Video,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import workFrontService from '../services/workFrontService';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import StatCard from '../components/common/StatCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Table, {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/common/Table';
import WorkFrontModal from '../components/workfronts/WorkFrontModal';
import WorkFrontDetailModal from '../components/workfronts/WorkFrontDetailModal';

const formatActivity = (type) => {
  const map = {
    WORKING_AT_HEIGHT: 'Work at Height',
    HOT_WORK: 'Hot Work',
    EXCAVATION: 'Excavation',
    CONFINED_SPACE: 'Confined Space',
    HEAVY_LIFTING: 'Heavy Lifting',
    ELECTRICAL: 'Electrical',
    GENERAL_CONSTRUCTION: 'General Construction',
    OTHER: 'Other',
  };
  return map[type] || type || 'General';
};

const formatShift = (shift) => {
  const map = {
    MORNING: 'Morning',
    AFTERNOON: 'Afternoon',
    NIGHT: 'Night',
    GENERAL_24X7: '24×7',
  };
  return map[shift] || shift || 'General';
};

export function WorkFrontsPage() {
  const { isAdmin } = useAuth();

  // Data states
  const [workFronts, setWorkFronts] = useState([]);
  const [kpis, setKpis] = useState({
    totalWorkFronts: 0,
    activeWorkFronts: 0,
    highRiskFronts: 0,
    activeContractors: 0,
    assignedCamerasCount: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [activityFilter, setActivityFilter] = useState('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkFront, setEditingWorkFront] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [inspectingWorkFront, setInspectingWorkFront] = useState(null);
  const [inspectingAuditLogs, setInspectingAuditLogs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load Work-Fronts
  const fetchWorkFronts = useCallback(
    async (pageToLoad = pagination.page) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await workFrontService.getWorkFronts({
          page: pageToLoad,
          limit: pagination.limit,
          search: debouncedSearch,
          status: statusFilter,
          riskLevel: riskFilter,
          activityType: activityFilter,
        });

        if (response?.data?.workFronts) {
          setWorkFronts(response.data.workFronts);
          if (response.data.kpis) {
            setKpis(response.data.kpis);
          }
          if (response.meta) {
            setPagination(response.meta);
          }
        } else {
          setWorkFronts([]);
        }
      } catch (err) {
        setError(err.message || 'Failed to load operational work-fronts');
        setWorkFronts([]);
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.limit, debouncedSearch, statusFilter, riskFilter, activityFilter]
  );

  useEffect(() => {
    fetchWorkFronts(1);
  }, [debouncedSearch, statusFilter, riskFilter, activityFilter]);

  // Handle Save (Create or Update)
  const handleSave = async (formData) => {
    setIsSubmitting(true);
    try {
      if (editingWorkFront?._id) {
        await workFrontService.updateWorkFront(editingWorkFront._id, formData);
      } else {
        await workFrontService.createWorkFront(formData);
      }
      setIsModalOpen(false);
      setEditingWorkFront(null);
      await fetchWorkFronts(pagination.page);
    } catch (err) {
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inspect Work-Front Details
  const handleInspect = async (wf) => {
    try {
      const res = await workFrontService.getWorkFrontById(wf._id);
      if (res?.data?.workFront) {
        setInspectingWorkFront(res.data.workFront);
        setInspectingAuditLogs(res.data.auditLogs || []);
      } else {
        setInspectingWorkFront(wf);
        setInspectingAuditLogs([]);
      }
    } catch (_) {
      setInspectingWorkFront(wf);
      setInspectingAuditLogs([]);
    }
    setIsDetailOpen(true);
  };

  const handleUpdateWorkFront = async (updatedWf) => {
    setInspectingWorkFront(updatedWf);
    await fetchWorkFronts(pagination.page);
    if (updatedWf?._id) {
      try {
        const res = await workFrontService.getWorkFrontById(updatedWf._id);
        if (res?.data?.auditLogs) {
          setInspectingAuditLogs(res.data.auditLogs);
        }
      } catch (_) {}
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      ACTIVE: { variant: 'success', text: 'Active' },
      PLANNING: { variant: 'warning', text: 'Planning' },
      SUSPENDED: { variant: 'danger', text: 'Suspended' },
      COMPLETED: { variant: 'neutral', text: 'Completed' },
    };
    const item = map[status] || { variant: 'neutral', text: status };
    return (
      <Badge variant={item.variant} size="sm" dot>
        {item.text}
      </Badge>
    );
  };

  const getRiskBadge = (risk) => {
    const map = {
      CRITICAL: 'danger',
      HIGH: 'warning',
      MEDIUM: 'info',
      LOW: 'success',
    };
    return (
      <Badge variant={map[risk] || 'neutral'} size="sm">
        {risk}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HardHat className="w-6 h-6 text-[var(--color-primary)] shrink-0" />
            <span>Work-Front Registry</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage operational work-front perimeters, contractor supervision, hazard categories, and camera assignments.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchWorkFronts(pagination.page)}
            isLoading={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingWorkFront(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Register Work-Front</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          title="Active Work-Fronts"
          value={kpis.activeWorkFronts}
          subtitle="Currently underway"
          icon={HardHat}
          statusColor="emerald"
        />

        <StatCard
          title="High / Critical Risk"
          value={kpis.highRiskFronts}
          subtitle="Height, hot work, confined"
          icon={AlertTriangle}
          statusColor={kpis.highRiskFronts > 0 ? 'amber' : 'emerald'}
        />

        <StatCard
          title="Assigned Cameras"
          value={kpis.assignedCamerasCount || 0}
          subtitle="Batch 2 camera mapping"
          icon={Video}
          statusColor="blue"
        />

        <StatCard
          title="Active Contractors"
          value={kpis.activeContractors}
          subtitle="Under current oversight"
          icon={Building2}
          statusColor="indigo"
        />
      </div>

      {/* Main Content Card */}
      <Card>
        {/* Filters and Search Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-full sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search code, name, contractor, zone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="workfront-search-input"
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* Dropdowns wrapper */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  data-testid="workfront-status-filter"
                  className="w-full sm:w-auto px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PLANNING">Planning</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              {/* Risk Level Filter */}
              <div>
                <select
                  value={riskFilter}
                  onChange={(e) => {
                    setRiskFilter(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  data-testid="workfront-risk-filter"
                  className="w-full sm:w-auto px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
                >
                  <option value="ALL">All Risk Levels</option>
                  <option value="CRITICAL">Critical Risk</option>
                  <option value="HIGH">High Risk</option>
                  <option value="MEDIUM">Medium Risk</option>
                  <option value="LOW">Low Risk</option>
                </select>
              </div>

              {/* Activity Type Filter */}
              <div className="col-span-2 sm:col-span-1">
                <select
                  value={activityFilter}
                  onChange={(e) => {
                    setActivityFilter(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  data-testid="workfront-activity-filter"
                  className="w-full sm:w-auto px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
                >
                  <option value="ALL">All Activities</option>
                  <option value="WORKING_AT_HEIGHT">Work at Height</option>
                  <option value="HOT_WORK">Hot Work</option>
                  <option value="EXCAVATION">Excavation</option>
                  <option value="CONFINED_SPACE">Confined Space</option>
                  <option value="HEAVY_LIFTING">Heavy Lifting</option>
                  <option value="ELECTRICAL">Electrical</option>
                  <option value="GENERAL_CONSTRUCTION">General Construction</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>

          {(search || statusFilter !== 'ALL' || riskFilter !== 'ALL' || activityFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setRiskFilter('ALL');
                setActivityFilter('ALL');
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              data-testid="workfront-reset-filters"
              className="text-xs text-[var(--color-primary)] hover:underline font-medium self-end sm:self-center cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="m-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchWorkFronts(pagination.page)}
              className="font-medium underline hover:text-rose-900 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table & Content */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs text-slate-400 font-medium">Loading work-front registry...</p>
          </div>
        ) : workFronts.length === 0 ? (
          <EmptyState
            icon={HardHat}
            title={
              search || statusFilter !== 'ALL' || riskFilter !== 'ALL' || activityFilter !== 'ALL'
                ? 'No Work-Fronts Match Filters'
                : 'No Work-Fronts Found'
            }
            description={
              search || statusFilter !== 'ALL' || riskFilter !== 'ALL' || activityFilter !== 'ALL'
                ? 'No operational work-fronts match the active search or filter criteria. Try adjusting your query or resetting filters.'
                : 'No work-fronts are currently registered. Register an operational work-front to establish safety context.'
            }
            action={
              search || statusFilter !== 'ALL' || riskFilter !== 'ALL' || activityFilter !== 'ALL' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('ALL');
                    setRiskFilter('ALL');
                    setActivityFilter('ALL');
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  data-testid="workfront-empty-reset-btn"
                >
                  Clear Filters & Search
                </Button>
              ) : isAdmin ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingWorkFront(null);
                    setIsModalOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Register First Work-Front
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            {/* Mobile Cards (< lg) */}
            <div className="lg:hidden divide-y divide-slate-100">
              {workFronts.map((wf) => (
                <div
                  key={wf._id}
                  className="p-3.5 space-y-2.5 hover:bg-slate-50/60 transition-colors"
                  data-testid={`workfront-card-${wf.workFrontCode}`}
                >
                  {/* Card Top: Code + Status Badge + Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {wf.workFrontCode}
                      </span>
                      {getStatusBadge(wf.status)}
                      {getRiskBadge(wf.riskLevel)}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleInspect(wf)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="View Full Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWorkFront(wf);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--color-primary)] hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit Work-Front"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Name & Zone */}
                  <div>
                    <h4 className="font-semibold text-slate-900 text-xs sm:text-sm">{wf.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {wf.site} · {wf.zone}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Contractor</span>
                      <span className="font-medium text-slate-800 truncate block">{wf.contractor}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Supervisor</span>
                      <span className="font-medium text-slate-800 truncate block">
                        {wf.supervisor?.name || 'Unassigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Activity</span>
                      <span className="font-medium text-slate-800 truncate block">
                        {formatActivity(wf.activityType)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Shift & Cameras</span>
                      <span className="font-medium text-slate-800 flex items-center gap-1">
                        <span>{formatShift(wf.shift)}</span>
                        <span>·</span>
                        <Video className="w-3 h-3 text-slate-400 inline" />
                        <span>{wf.cameras?.length || 0}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= lg) */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Work-Front Name & Zone</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Contractor & Supervisor</TableHead>
                    <TableHead>Activity & Risk</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Cameras</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workFronts.map((wf) => (
                    <TableRow key={wf._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Code */}
                      <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {wf.workFrontCode}
                        </span>
                      </TableCell>

                      {/* Name & Zone */}
                      <TableCell>
                        <div className="min-w-[180px]">
                          <p className="font-semibold text-slate-900 text-xs">{wf.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{wf.zone}</p>
                        </div>
                      </TableCell>

                      {/* Site */}
                      <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                        {wf.site}
                      </TableCell>

                      {/* Contractor & Supervisor */}
                      <TableCell>
                        <div className="min-w-[160px]">
                          <p className="font-medium text-slate-900 text-xs">{wf.contractor}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Sup: {wf.supervisor?.name || 'Unassigned'}
                          </p>
                        </div>
                      </TableCell>

                      {/* Activity & Risk */}
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-[11px] font-medium text-slate-700">
                            {formatActivity(wf.activityType)}
                          </p>
                          {getRiskBadge(wf.riskLevel)}
                        </div>
                      </TableCell>

                      {/* Shift */}
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {formatShift(wf.shift)}
                      </TableCell>

                      {/* Cameras */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-800 text-xs">
                            {wf.cameras?.length || 0}
                          </span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="whitespace-nowrap">
                        {getStatusBadge(wf.status)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleInspect(wf)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="View Full Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingWorkFront(wf);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--color-primary)] hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit Work-Front"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="p-4 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
                <div>
                  Showing{' '}
                  <span className="font-semibold text-slate-900">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-slate-900">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-900">{pagination.total}</span> records
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const prevPage = pagination.page - 1;
                      setPagination((prev) => ({ ...prev, page: prevPage }));
                      fetchWorkFronts(prevPage);
                    }}
                    disabled={pagination.page <= 1 || isLoading}
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-medium text-slate-700 px-1">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const nextPage = pagination.page + 1;
                      setPagination((prev) => ({ ...prev, page: nextPage }));
                      fetchWorkFronts(nextPage);
                    }}
                    disabled={pagination.page >= pagination.totalPages || isLoading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Register / Edit Modal */}
      <WorkFrontModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingWorkFront(null);
        }}
        onSave={handleSave}
        workFront={editingWorkFront}
        isLoading={isSubmitting}
      />

      {/* Inspect Detail Modal */}
      <WorkFrontDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setInspectingWorkFront(null);
          setInspectingAuditLogs([]);
        }}
        workFront={inspectingWorkFront}
        auditLogs={inspectingAuditLogs}
        onUpdateWorkFront={handleUpdateWorkFront}
      />
    </div>
  );
}

export default WorkFrontsPage;


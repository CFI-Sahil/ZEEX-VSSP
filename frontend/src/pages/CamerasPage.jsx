import React, { useState, useEffect, useCallback } from 'react';
import { Video, Plus, Search, Filter, RefreshCw, AlertCircle, Edit, Eye, HardHat } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
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
import CameraModal from '../components/cameras/CameraModal';
import CameraDetailModal from '../components/cameras/CameraDetailModal';

export function CamerasPage() {
  const { isAdmin } = useAuth();

  // Data states
  const [cameras, setCameras] = useState([]);
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

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [inspectingCamera, setInspectingCamera] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load cameras
  const fetchCameras = useCallback(
    async (pageToLoad = pagination.page) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await cameraService.getCameras({
          page: pageToLoad,
          limit: pagination.limit,
          search: debouncedSearch,
          status: statusFilter,
        });

        if (response?.data?.cameras) {
          setCameras(response.data.cameras);
          if (response.meta) {
            setPagination(response.meta);
          }
        } else {
          setCameras([]);
        }
      } catch (err) {
        setError(err.message || 'Failed to load cameras from backend');
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.limit, debouncedSearch, statusFilter]
  );

  useEffect(() => {
    fetchCameras(pagination.page);
  }, [fetchCameras, pagination.page]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingCamera(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cam) => {
    setEditingCamera(cam);
    setIsModalOpen(true);
  };

  const handleOpenDetail = (cam) => {
    setInspectingCamera(cam);
    setIsDetailOpen(true);
  };

  const handleSaveCamera = async (formData) => {
    setIsSubmitting(true);
    try {
      if (editingCamera) {
        await cameraService.updateCamera(editingCamera._id, formData);
      } else {
        await cameraService.createCamera(formData);
      }
      setIsModalOpen(false);
      setEditingCamera(null);
      await fetchCameras(pagination.page);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ONLINE':
        return <Badge variant="success" dot>ONLINE</Badge>;
      case 'OFFLINE':
        return <Badge variant="danger" dot>OFFLINE</Badge>;
      case 'UNKNOWN':
      default:
        return <Badge variant="warning" dot>UNKNOWN</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-main)] tracking-tight">
            Registered Cameras
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Manage site cameras, configure monitoring parameters, and inspect status.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={handleOpenAdd}
            data-testid="add-camera-btn"
            className="w-full sm:w-auto justify-center"
          >
            Add Camera
          </Button>
        )}
      </div>

      {/* Filter and Search Toolbar */}
      <Card>
        <div className="p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search camera code, name or zone..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              data-testid="camera-search-input"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Status:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="flex-1 sm:flex-none px-2.5 py-1.5 text-xs bg-slate-50 border border-[var(--color-border)] rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              data-testid="status-filter-select"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNKNOWN">UNKNOWN (Default)</option>
              <option value="ONLINE">ONLINE (Active)</option>
              <option value="OFFLINE">OFFLINE (Disconnected)</option>
            </select>

            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => fetchCameras(pagination.page)}
              isLoading={isLoading}
              title="Refresh list"
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
              <p className="font-semibold">Unable to fetch camera records</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchCameras(pagination.page)}>
            Retry
          </Button>
        </div>
      )}

      {/* Camera Registry Content */}
      <Card>
        {isLoading ? (
          <LoadingSpinner message="Loading camera registry..." className="py-16" />
        ) : cameras.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Video}
              title={
                debouncedSearch || statusFilter !== 'ALL'
                  ? 'No matching cameras found'
                  : 'No surveillance cameras registered'
              }
              description={
                debouncedSearch || statusFilter !== 'ALL'
                  ? 'Try clearing the search term or resetting the status filter.'
                  : 'Get started by registering cameras into the surveillance monitoring registry.'
              }
              action={
                isAdmin && !debouncedSearch && statusFilter === 'ALL' ? (
                  <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenAdd}>
                    Register First Camera
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile Cards (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {cameras.map((cam) => (
                <div
                  key={cam._id}
                  className="p-3.5 space-y-2.5 hover:bg-slate-50/60 transition-colors"
                  data-testid={`camera-card-${cam.cameraCode}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--color-primary)] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {cam.cameraCode}
                        </span>
                        <span className="font-semibold text-slate-900 text-xs sm:text-sm">{cam.name}</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {cam.site} · {cam.location}
                      </p>
                    </div>
                    <div className="shrink-0">{getStatusBadge(cam.status)}</div>
                  </div>

                  {/* Work-Front & Stream Status Row */}
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0 flex items-center gap-1.5">
                      <HardHat className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        {cam.workFront ? (
                          <span className="font-semibold text-slate-800 truncate block text-[11px] sm:text-xs">
                            {cam.workFront.workFrontCode} ({cam.workFront.name})
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="neutral" size="sm">
                      Stream: {cam.streamStatus || 'UNAVAILABLE'}
                    </Badge>
                  </div>

                  {/* Heartbeat & Actions Footer */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-400">
                      Heartbeat: {cam.lastSeenAt ? new Date(cam.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => handleOpenDetail(cam)}
                        data-testid={`inspect-btn-${cam.cameraCode}`}
                      >
                        Inspect
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Edit}
                          onClick={() => handleOpenEdit(cam)}
                          data-testid={`edit-btn-${cam.cameraCode}`}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Camera Code</TableHead>
                    <TableHead>Camera Name</TableHead>
                    <TableHead>Site Location</TableHead>
                    <TableHead>Work-Front</TableHead>
                    <TableHead>Admin Status</TableHead>
                    <TableHead>Stream Connectivity</TableHead>
                    <TableHead>Last Heartbeat</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cameras.map((cam) => (
                    <TableRow key={cam._id} data-testid={`camera-row-${cam.cameraCode}`}>
                      <TableCell className="font-mono text-xs font-semibold text-[var(--color-primary)]">
                        {cam.cameraCode}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-slate-900 block">{cam.name}</span>
                        {cam.description && (
                          <span className="text-[11px] text-[var(--color-text-muted)] line-clamp-1">
                            {cam.description}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-[var(--color-text-muted)]">
                        {cam.site} · {cam.location}
                      </TableCell>
                      <TableCell>
                        {cam.workFront ? (
                          <div className="flex items-center gap-1.5">
                            <HardHat className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <div>
                              <span className="font-mono text-xs font-bold text-slate-800">
                                {cam.workFront.workFrontCode}
                              </span>
                              <span className="text-[10px] text-slate-500 block truncate max-w-[120px]">
                                {cam.workFront.name}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(cam.status)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral">
                          {cam.streamStatus || 'UNAVAILABLE'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--color-text-muted)]">
                        {cam.lastSeenAt ? new Date(cam.lastSeenAt).toLocaleString() : 'Never (Null)'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleOpenDetail(cam)}
                            data-testid={`inspect-btn-${cam.cameraCode}`}
                          >
                            Inspect
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Edit}
                              onClick={() => handleOpenEdit(cam)}
                              data-testid={`edit-btn-${cam.cameraCode}`}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination footer */}
            <div className="p-3.5 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
              <div>
                Showing <span className="font-semibold text-slate-800">{cameras.length}</span> of{' '}
                <span className="font-semibold text-slate-800">{pagination.total}</span> registered camera(s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
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
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Camera Add / Edit Modal (Admin Only) */}
      {isAdmin && (
        <CameraModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingCamera(null);
          }}
          onSave={handleSaveCamera}
          camera={editingCamera}
          isLoading={isSubmitting}
        />
      )}

      {/* Camera Inspection Detail Modal */}
      <CameraDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setInspectingCamera(null);
        }}
        camera={inspectingCamera}
      />
    </div>
  );
}

export default CamerasPage;

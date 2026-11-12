import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderArchive,
  Image as ImageIcon,
  Search,
  Filter,
  Eye,
  Download,
  RefreshCw,
  AlertCircle,
  Camera,
  LayoutGrid,
  List,
  Cloud,
  HardDrive,
  AlertTriangle,
  ShieldCheck,
  HelpCircle,
  Building2,
  Calendar,
  X,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';
import evidenceService from '../services/evidenceService';
import cameraService from '../services/cameraService';
import Card, { CardContent } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/common/Table';
import EvidenceDetailModal from '../components/evidence/EvidenceDetailModal';

export function EvidencePage() {
  const [evidenceList, setEvidenceList] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    cloudinaryCount: 0,
    localCount: 0,
    cloudinaryPercentage: 0,
    formattedSize: '0 KB',
    distinctAlerts: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // View Mode: 'grid' | 'table'
  const [viewMode, setViewMode] = useState('grid');

  // Search & Filters State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cameraFilter, setCameraFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [violationFilter, setViolationFilter] = useState('ALL');
  const [storageFilter, setStorageFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('capturedAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modal inspection target
  const [inspectItem, setInspectItem] = useState(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch camera list for filter dropdown
  useEffect(() => {
    cameraService
      .getCameras({ limit: 50 })
      .then((res) => setCameras(res?.data?.cameras || []))
      .catch((err) => console.warn('Failed to load camera registry for filter:', err.message));
  }, []);

  // Fetch repository statistics for KPI ribbon
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const res = await evidenceService.getEvidenceStats();
      if (res?.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.warn('[EvidencePage] Failed to fetch vault stats:', err.message);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Fetch evidence records with active filters and pagination
  const fetchEvidence = useCallback(
    async (pageToLoad = pagination.page) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await evidenceService.getEvidence({
          page: pageToLoad,
          limit: pagination.limit,
          search: debouncedSearch,
          cameraCode: cameraFilter,
          severity: severityFilter,
          violationType: violationFilter,
          storageDriver: storageFilter,
          sortBy,
          sortOrder,
        });

        if (response?.data?.evidence) {
          setEvidenceList(response.data.evidence);
          if (response.meta) {
            setPagination(response.meta);
          }
        } else {
          setEvidenceList([]);
        }
      } catch (err) {
        setError(err.message || 'Failed to retrieve evidence snapshots from server');
      } finally {
        setIsLoading(false);
      }
    },
    [
      pagination.limit,
      debouncedSearch,
      cameraFilter,
      severityFilter,
      violationFilter,
      storageFilter,
      sortBy,
      sortOrder,
    ]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchEvidence(pagination.page);
  }, [fetchEvidence, pagination.page]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({ ...prev, limit: Number(newLimit), page: 1 }));
  };

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setCameraFilter('');
    setSeverityFilter('ALL');
    setViolationFilter('ALL');
    setStorageFilter('ALL');
    setSortBy('capturedAt');
    setSortOrder('desc');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const isFilterActive = useMemo(() => {
    return (
      Boolean(search.trim()) ||
      Boolean(cameraFilter) ||
      severityFilter !== 'ALL' ||
      violationFilter !== 'ALL' ||
      storageFilter !== 'ALL' ||
      sortBy !== 'capturedAt' ||
      sortOrder !== 'desc'
    );
  }, [search, cameraFilter, severityFilter, violationFilter, storageFilter, sortBy, sortOrder]);

  const handleDownloadItem = async (e, ev) => {
    e.stopPropagation();
    try {
      const fileName = ev.fileName || `${ev.evidenceCode}.jpg`;
      await evidenceService.downloadEvidence(ev._id, fileName);
    } catch (err) {
      console.error('[EvidencePage] Download failed:', err);
    }
  };

  const getSeverityBadge = (sev) => {
    const s = (sev || 'MEDIUM').toUpperCase();
    switch (s) {
      case 'CRITICAL':
        return <Badge variant="danger" size="sm" dot>CRITICAL</Badge>;
      case 'HIGH':
        return <Badge variant="warning" size="sm" dot>HIGH</Badge>;
      case 'LOW':
        return <Badge variant="neutral" size="sm" dot>LOW</Badge>;
      default:
        return <Badge variant="info" size="sm" dot>MEDIUM</Badge>;
    }
  };

  const getDriverBadge = (driver) => {
    if (driver === 'cloudinary') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Cloud className="w-3 h-3 text-emerald-600" />
          Cloudinary
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <HardDrive className="w-3 h-3 text-slate-500" />
        Local
      </span>
    );
  };

  const getIntegrityBadge = (status) => {
    if (status === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          Verified
        </span>
      );
    }
    if (status === 'INTEGRITY_MISMATCH') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          Mismatch
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-300">
        <HelpCircle className="w-3 h-3 text-amber-600" />
        Legacy
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Vault Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-main)] tracking-tight">
            Evidence Vault
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Centralized repository for safety incident snapshots, forensic metadata, and cryptographic verification.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Badge variant="navy" className="self-start sm:self-auto font-mono text-[11px]">
            {stats.totalCount} Preserved Records
          </Badge>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => {
              fetchStats();
              fetchEvidence(pagination.page);
            }}
            isLoading={isLoading || isStatsLoading}
            title="Refresh evidence vault and statistics"
          >
            <span className="hidden sm:inline">Refresh Vault</span>
          </Button>
        </div>
      </div>

      {/* KPI Summary Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <StatCard
          title="Total Evidence"
          value={stats.totalCount}
          subtitle="Cryptographically tracked files"
          icon={FolderArchive}
          colorVariant="blue"
        />
        <StatCard
          title="Cloudinary Assets"
          value={stats.cloudinaryCount}
          subtitle={`${stats.cloudinaryPercentage}% cloud durability`}
          icon={Cloud}
          colorVariant="emerald"
        />
        <StatCard
          title="Recorded Storage"
          value={stats.formattedSize}
          subtitle="Cumulative file volume"
          icon={HardDrive}
          colorVariant="amber"
        />
        <StatCard
          title="Associated Incidents"
          value={stats.distinctAlerts}
          subtitle="Linked safety violation alerts"
          icon={AlertTriangle}
          colorVariant="rose"
        />
      </div>

      {/* Advanced Search & Filtering Toolbar */}
      <Card>
        <div className="p-3.5 space-y-3">
          {/* Top Row: Search Input + View Mode Toggle */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            {/* Omnisearch Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by evidence code, alert code, camera code, or file name..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-[var(--color-border)] rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="evidence-search-input"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center gap-1.5 shrink-0 justify-end">
              <span className="text-xs text-slate-500 font-medium hidden sm:inline mr-1">View:</span>
              <div className="p-0.5 bg-slate-100 rounded-lg border border-slate-200 flex items-center">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Switch to Grid View"
                  data-testid="evidence-view-grid-btn"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Switch to Compliance Table View"
                  data-testid="evidence-view-table-btn"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Facets Row */}
          <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
            {/* Camera Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Camera:</span>
              <select
                value={cameraFilter}
                onChange={(e) => {
                  setCameraFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-[var(--color-border)] rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                data-testid="evidence-camera-filter"
              >
                <option value="">All Cameras</option>
                {cameras.map((c) => (
                  <option key={c._id} value={c.cameraCode}>
                    {c.cameraCode} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Severity:</span>
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-[var(--color-border)] rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                data-testid="evidence-severity-filter"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            {/* Violation Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Violation:</span>
              <select
                value={violationFilter}
                onChange={(e) => {
                  setViolationFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-[var(--color-border)] rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                data-testid="evidence-violation-filter"
              >
                <option value="ALL">All Violations</option>
                <option value="NO_HELMET">Missing Helmet</option>
                <option value="NO_VEST">Missing Vest</option>
                <option value="UNAUTHORIZED_ZONE">Unauthorized Zone</option>
                <option value="NO_SAFETY_BOOTS">Missing Boots</option>
                <option value="RESTRICTED_ACCESS">Restricted Access</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Storage Driver Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Storage:</span>
              <select
                value={storageFilter}
                onChange={(e) => {
                  setStorageFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-[var(--color-border)] rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                data-testid="evidence-driver-filter"
              >
                <option value="ALL">All Storage</option>
                <option value="cloudinary">Cloudinary</option>
                <option value="local">Local Disk</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Sort:</span>
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split(':');
                  setSortBy(field);
                  setSortOrder(order);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-[var(--color-border)] rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                data-testid="evidence-sort-select"
              >
                <option value="capturedAt:desc">Newest First</option>
                <option value="capturedAt:asc">Oldest First</option>
                <option value="fileSize:desc">Largest File</option>
                <option value="fileSize:asc">Smallest File</option>
                <option value="alertCode:asc">Alert Code (A-Z)</option>
                <option value="alertCode:desc">Alert Code (Z-A)</option>
              </select>
            </div>

            {/* Reset Filter Button */}
            {isFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                icon={RotateCcw}
                onClick={handleResetFilters}
                className="text-[11px] py-1 text-blue-600 hover:text-blue-800"
                data-testid="evidence-reset-filters-btn"
              >
                Reset Filters
              </Button>
            )}
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
              <p className="font-semibold">Unable to load evidence vault records</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchEvidence(pagination.page)}>
            Retry
          </Button>
        </div>
      )}

      {/* Evidence Content Area */}
      {isLoading ? (
        <LoadingSpinner message="Retrieving snapshot evidence records from vault..." className="py-20" />
      ) : evidenceList.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={FolderArchive}
            title={isFilterActive ? 'No evidence snapshots match criteria' : 'No evidence snapshots preserved'}
            description={
              isFilterActive
                ? 'Try broadening your search terms or clearing active filters.'
                : 'When safety detection events are ingested, associated image snapshots will be cryptographically preserved here.'
            }
            action={
              isFilterActive ? (
                <Button variant="secondary" size="sm" icon={RotateCcw} onClick={handleResetFilters}>
                  Clear All Filters
                </Button>
              ) : null
            }
          />
        </Card>
      ) : viewMode === 'grid' ? (
        /* Visual Gallery Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {evidenceList.map((ev) => (
            <Card
              key={ev._id}
              className="overflow-hidden flex flex-col hover:border-blue-300 transition-all shadow-2xs hover:shadow-xs group"
              data-testid={`evidence-card-${ev.evidenceCode}`}
            >
              {/* Snapshot Thumbnail Canvas */}
              <div
                className="h-44 sm:h-48 bg-slate-950 relative flex flex-col items-center justify-center overflow-hidden cursor-pointer"
                onClick={() => setInspectItem(ev)}
              >
                <img
                  src={evidenceService.getEvidenceFileUrl(ev._id)}
                  alt={ev.fileName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  crossOrigin="use-credentials"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden absolute inset-0 flex-col items-center justify-center p-4 bg-slate-900 text-slate-400">
                  <ImageIcon className="w-10 h-10 text-slate-600 mb-2" />
                  <span className="text-xs font-medium truncate max-w-[90%]">{ev.fileName}</span>
                </div>

                {/* Overlaid Badges */}
                <div className="absolute top-2 left-2">
                  {getSeverityBadge(ev.alert?.severity)}
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <Badge variant="navy" size="sm" className="font-mono text-[9px] uppercase">
                    {ev.fileType.replace('image/', '')}
                  </Badge>
                </div>
                <div className="absolute bottom-2 left-2">
                  {getDriverBadge(ev.storageDriver)}
                </div>
              </div>

              {/* Card Metadata Content */}
              <CardContent className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-blue-700">
                      {ev.evidenceCode}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {ev.alertCode}
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-1" title={ev.alert?.violationName || ev.description}>
                    {ev.alert?.violationName || ev.description || 'Safety Detection'}
                  </h4>

                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-0.5">
                    <div className="flex items-center justify-between">
                      <span>Camera: <strong className="text-slate-700">{ev.cameraCode}</strong></span>
                      <span>{(ev.fileSize / 1024).toFixed(1)} KB</span>
                    </div>
                    {ev.alert?.contractor && (
                      <div className="flex items-center gap-1 text-slate-600 truncate">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{ev.alert.contractor}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400">
                    {ev.capturedAt ? new Date(ev.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => handleDownloadItem(e, ev)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer transition-colors"
                      title="Download original snapshot"
                      aria-label="Download snapshot"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Eye}
                      onClick={() => setInspectItem(ev)}
                      data-testid={`inspect-evidence-${ev.evidenceCode}`}
                    >
                      Inspect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Audited Table View */
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Preview</TableHead>
                <TableHead>Evidence Code</TableHead>
                <TableHead>Alert Code</TableHead>
                <TableHead>Violation Detected</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Camera Point</TableHead>
                <TableHead>Contractor</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>File Size</TableHead>
                <TableHead>Captured At</TableHead>
                <TableHead>Integrity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidenceList.map((ev) => (
                <TableRow
                  key={ev._id}
                  className="cursor-pointer"
                  onClick={() => setInspectItem(ev)}
                  data-testid={`evidence-table-row-${ev.evidenceCode}`}
                >
                  <TableCell>
                    <div className="w-10 h-10 rounded bg-slate-900 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                      <img
                        src={evidenceService.getEvidenceFileUrl(ev._id)}
                        alt={ev.evidenceCode}
                        className="w-full h-full object-cover"
                        crossOrigin="use-credentials"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-blue-700">
                    {ev.evidenceCode}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {ev.alertCode}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900 text-xs max-w-[160px] truncate">
                    {ev.alert?.violationName || ev.description || 'Safety Violation'}
                  </TableCell>
                  <TableCell>{getSeverityBadge(ev.alert?.severity)}</TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {ev.cameraCode}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 max-w-[130px] truncate">
                    {ev.alert?.contractor || '—'}
                  </TableCell>
                  <TableCell>{getDriverBadge(ev.storageDriver)}</TableCell>
                  <TableCell className="text-xs font-mono text-slate-600">
                    {(ev.fileSize / 1024).toFixed(1)} KB
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                    {ev.capturedAt ? new Date(ev.capturedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </TableCell>
                  <TableCell>{getIntegrityBadge(ev.integrityStatus || ev.lastIntegrityStatus)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleDownloadItem(e, ev)}
                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer transition-colors"
                        title="Download snapshot"
                        aria-label="Download snapshot"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => setInspectItem(ev)}
                        data-testid={`inspect-evidence-btn-${ev.evidenceCode}`}
                      >
                        Inspect
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination Controls */}
      {evidenceList.length > 0 && (
        <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
          <div className="flex items-center gap-3">
            <span>
              Showing <span className="font-semibold text-slate-800">{evidenceList.length}</span> of{' '}
              <span className="font-semibold text-slate-800">{pagination.total}</span> record(s)
            </span>
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pagination.limit}
                onChange={(e) => handleLimitChange(e.target.value)}
                className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-700 cursor-pointer"
                data-testid="evidence-page-limit-select"
              >
                <option value="12">12</option>
                <option value="24">24</option>
                <option value="48">48</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
              data-testid="evidence-prev-page-btn"
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
              data-testid="evidence-next-page-btn"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Forensic Detail & Inspection Modal */}
      <EvidenceDetailModal
        isOpen={Boolean(inspectItem)}
        onClose={() => setInspectItem(null)}
        evidence={inspectItem}
      />
    </div>
  );
}

export default EvidencePage;

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import evidenceService from '../services/evidenceService';
import cameraService from '../services/cameraService';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import EvidenceDetailModal from '../components/evidence/EvidenceDetailModal';

export function EvidencePage() {
  const [evidenceList, setEvidenceList] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 9,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [cameraFilter, setCameraFilter] = useState('');
  const [inspectItem, setInspectItem] = useState(null);

  // Fetch camera list for dropdown
  useEffect(() => {
    cameraService
      .getCameras({ limit: 50 })
      .then((res) => setCameras(res?.data?.cameras || []))
      .catch(() => {});
  }, []);

  // Fetch evidence list
  const fetchEvidence = useCallback(
    async (pageToLoad = pagination.page) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await evidenceService.getEvidence({
          page: pageToLoad,
          limit: pagination.limit,
          cameraCode: cameraFilter,
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
    [pagination.limit, cameraFilter]
  );

  useEffect(() => {
    fetchEvidence(pagination.page);
  }, [fetchEvidence, pagination.page]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-main)] tracking-tight">
            Evidence Vault & Snapshots
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Authorised inspection of safety violation snapshots with cryptographic verification.
          </p>
        </div>
        <Badge variant="navy" className="self-start sm:self-auto">
          Images Only (JPEG / PNG / WebP)
        </Badge>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Camera className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={cameraFilter}
              onChange={(e) => {
                setCameraFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full sm:w-auto px-3 py-1.5 text-xs bg-slate-50 border border-[var(--color-border)] rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              data-testid="evidence-camera-filter"
            >
              <option value="">All Camera Points</option>
              {cameras.map((c) => (
                <option key={c._id} value={c.cameraCode}>
                  {c.cameraCode} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => fetchEvidence(pagination.page)}
              isLoading={isLoading}
              title="Refresh evidence list"
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
              <p className="font-semibold">Unable to load evidence vault</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchEvidence(pagination.page)}>
            Retry
          </Button>
        </div>
      )}

      {/* Evidence Gallery Grid */}
      {isLoading ? (
        <LoadingSpinner message="Retrieving snapshot evidence records..." className="py-20" />
      ) : evidenceList.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={FolderArchive}
            title={cameraFilter ? 'No evidence for selected camera' : 'No evidence snapshots preserved'}
            description={
              cameraFilter
                ? 'Try selecting a different camera or reset the filter.'
                : 'When safety detection events are ingested, associated image snapshots will be preserved here.'
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
            {evidenceList.map((ev) => (
              <Card
                key={ev._id}
                className="overflow-hidden flex flex-col hover:border-blue-300 transition-colors shadow-2xs"
                data-testid={`evidence-card-${ev.evidenceCode}`}
              >
                {/* Snapshot Image Container */}
                <div
                  className="h-40 sm:h-48 bg-slate-950 relative flex flex-col items-center justify-center text-center overflow-hidden cursor-pointer group"
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
                    <span className="text-xs font-medium">{ev.fileName}</span>
                  </div>

                  <div className="absolute top-2.5 right-2.5">
                    <Badge variant="navy" size="sm">
                      {ev.fileType.replace('image/', '').toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-3 sm:p-4 space-y-2.5 sm:space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-[var(--color-primary)]">
                        {ev.alertCode || 'INCIDENT'}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {ev.capturedAt ? new Date(ev.capturedAt).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-semibold text-[var(--color-text-main)] mt-1 line-clamp-1">
                      {ev.alert?.violationName || ev.description || 'Safety Detection'}
                    </h4>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Camera: <span className="font-semibold text-slate-700">{ev.cameraCode}</span> · {ev.camera?.site || 'Plant 1'}
                    </p>
                  </div>

                  <div className="pt-2.5 sm:pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
                      Size: {(ev.fileSize / 1024).toFixed(1)} KB
                    </span>
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
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
            <div>
              Showing <span className="font-semibold text-slate-800">{evidenceList.length}</span> of{' '}
              <span className="font-semibold text-slate-800">{pagination.total}</span> snapshot(s)
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

      {/* Evidence Full Inspection Modal */}
      <EvidenceDetailModal
        isOpen={Boolean(inspectItem)}
        onClose={() => setInspectItem(null)}
        evidence={inspectItem}
      />
    </div>
  );
}

export default EvidencePage;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import {
  Image as ImageIcon,
  Camera,
  AlertTriangle,
  Clock,
  HardDrive,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Copy,
  Check,
  Building2,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import evidenceService from '../../services/evidenceService';

export function EvidenceDetailModal({ isOpen, onClose, evidence = null }) {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(evidence?.integrityStatus || 'NOT_YET_VERIFIED');
  const [verificationFeedback, setVerificationFeedback] = useState(null);

  // Reset zoom, verification, and error states when opening or changing evidence
  useEffect(() => {
    setZoom(1);
    setIsFullscreen(false);
    setImageError(false);
    setImageLoading(true);
    setCopiedHash(false);
    setIsVerifying(false);
    setCurrentStatus(evidence?.integrityStatus || (evidence?.checksumSha256 ? 'NOT_YET_VERIFIED' : 'NOT_YET_VERIFIED'));
    setVerificationFeedback(null);
  }, [evidence?._id, isOpen]);

  if (!evidence) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoom(1);

  const handleCopyHash = () => {
    if (evidence.checksumSha256) {
      navigator.clipboard.writeText(evidence.checksumSha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!evidence?._id || !evidence?.checksumSha256) return;
    setIsVerifying(true);
    setVerificationFeedback(null);
    try {
      const res = await evidenceService.verifyEvidence(evidence._id);
      const newStatus = res?.data?.integrityStatus || 'NOT_YET_VERIFIED';
      setCurrentStatus(newStatus);
      if (newStatus === 'VERIFIED') {
        setVerificationFeedback({
          type: 'success',
          text: 'Cryptographic hash recomputed and verified against stored baseline.',
        });
      } else if (newStatus === 'INTEGRITY_MISMATCH') {
        setVerificationFeedback({
          type: 'error',
          text: 'INTEGRITY MISMATCH: Current file bytes differ from the stored baseline checksum!',
        });
      } else if (newStatus === 'UNABLE_TO_VERIFY') {
        setVerificationFeedback({
          type: 'warning',
          text: 'Temporary storage retrieval failure: Integrity verification deferred.',
        });
      }
    } catch (err) {
      console.error('[EvidenceDetailModal] Verification failed:', err);
      setVerificationFeedback({
        type: 'error',
        text: 'Integrity verification request failed: ' + (err.message || 'Network error'),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const fileName = evidence.fileName || `${evidence.evidenceCode}.jpg`;
      await evidenceService.downloadEvidence(evidence._id, fileName);
    } catch (err) {
      console.error('[EvidenceDetailModal] Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleInspectAlert = () => {
    const alertId = evidence.alert?._id || evidence.alert;
    if (alertId) {
      onClose();
      navigate(`/alerts?alertId=${alertId}`);
    }
  };

  const getSeverityBadge = (sev) => {
    const severity = (sev || evidence.alert?.severity || 'MEDIUM').toUpperCase();
    switch (severity) {
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Cloudinary Secure Vault
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        Local Disk Storage
      </span>
    );
  };

  const getIntegrityBadge = () => {
    if (currentStatus === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          SHA-256 Verified
        </span>
      );
    }
    if (currentStatus === 'INTEGRITY_MISMATCH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          Integrity Mismatch
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-300">
        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
        Not yet verified (Legacy)
      </span>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Evidence Snapshot: ${evidence.evidenceCode}`}
      description="Cryptographically preserved forensic snapshot associated with safety incident detection."
      size={isFullscreen ? 'xl' : 'lg'}
      footer={
        <div className="flex flex-col-reverse xs:flex-row items-stretch xs:items-center justify-between gap-2.5 w-full">
          <Button variant="secondary" size="sm" onClick={onClose} className="justify-center">
            Close
          </Button>
          <div className="flex items-center gap-2 justify-end">
            {(evidence.alert?._id || evidence.alert) && (
              <Button
                variant="outline"
                size="sm"
                icon={ExternalLink}
                onClick={handleInspectAlert}
                title="Open associated incident alert details"
                className="justify-center"
              >
                <span className="hidden sm:inline">Inspect Linked Alert</span>
                <span className="sm:hidden">Linked Alert</span>
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={Download}
              onClick={handleDownload}
              isLoading={isDownloading}
              title="Download authenticated image attachment"
              className="justify-center"
              data-testid="evidence-modal-download-btn"
            >
              Download Snapshot
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Interactive Image Inspection Viewer */}
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-950 flex flex-col relative group">
          {/* Zoom & Inspection Controls Toolbar */}
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 bg-slate-900/80 backdrop-blur-xs p-1 rounded-lg border border-slate-700/60 shadow-md opacity-90 hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.75}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              title="Zoom Out (-25%)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-slate-300 px-1 select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              title="Zoom In (+25%)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              title="Reset Zoom to 100%"
              aria-label="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              title={isFullscreen ? 'Exit Full Screen' : 'Expand Full Screen'}
              aria-label="Toggle Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Canvas Viewport */}
          <div
            className={`w-full flex items-center justify-center overflow-auto p-4 transition-all duration-200 ${
              isFullscreen ? 'min-h-[500px] max-h-[70vh]' : 'min-h-64 max-h-96'
            }`}
          >
            {imageLoading && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mb-2" />
              </div>
            )}

            {!imageError ? (
              <img
                src={evidenceService.getEvidenceFileUrl(evidence._id)}
                alt={`Snapshot ${evidence.evidenceCode}`}
                className="object-contain transition-transform duration-150 origin-center select-none"
                style={{ transform: `scale(${zoom})` }}
                crossOrigin="use-credentials"
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
              />
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-center text-slate-400">
                <ImageIcon className="w-12 h-12 text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-300">Snapshot Image Currently Unavailable</p>
                <p className="text-[11px] text-slate-500 max-w-sm mt-1">
                  The binary file could not be streamed from primary storage. It may be pending background recovery or permanently removed.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Operational Incident Context Card */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                Associated Safety Incident
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {getSeverityBadge(evidence.alert?.severity)}
              {evidence.alert?.status && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                  {evidence.alert.status}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 block">Alert Code:</span>
              <span className="font-mono font-bold text-slate-900 text-xs">
                {evidence.alertCode || evidence.alert?.alertCode || 'N/A'}
              </span>
              {evidence.alert?.eventId && (
                <span className="font-mono text-[10px] text-blue-600 block">
                  Event: {evidence.alert.eventId}
                </span>
              )}
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Violation Detected:</span>
              <span className="font-semibold text-slate-800">
                {evidence.alert?.violationName || evidence.description || 'Safety Detection'}
              </span>
            </div>
          </div>

          {/* Enriched Work-Front and Contractor Details if available */}
          {(evidence.alert?.workFrontCode || evidence.alert?.contractor) && (
            <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-start gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Work-Front / Contractor</span>
                  <span className="font-mono font-semibold text-blue-700">
                    {evidence.alert.workFrontCode || 'UNASSIGNED'}
                  </span>
                  <span className="text-slate-600 block text-[11px] truncate">
                    {evidence.alert.contractor || 'General Facility'}
                  </span>
                </div>
              </div>
              {evidence.alert?.riskLevel && (
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Site Risk Level</span>
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase mt-0.5 ${
                      evidence.alert.riskLevel === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800'
                        : evidence.alert.riskLevel === 'HIGH'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {evidence.alert.riskLevel}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Camera Point & Physical Location Card */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white grid grid-cols-1 xs:grid-cols-2 gap-2.5 text-xs">
          <div className="flex items-start gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0 mt-0.5">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Monitoring Camera</span>
              <span className="font-semibold text-slate-900 block">{evidence.cameraCode}</span>
              <span className="text-[11px] text-slate-500 truncate block">
                {evidence.camera?.name || 'Surveillance Feed'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Incident Location</span>
              <span className="font-semibold text-slate-900 block truncate">
                {evidence.camera?.location || evidence.camera?.site || 'Plant 1'}
              </span>
              <span className="text-[11px] text-slate-500 block">Site: {evidence.camera?.site || 'Main Plant'}</span>
            </div>
          </div>
        </div>

        {/* Forensic Storage & Cryptographic Checksum Card */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-slate-500" />
              <span className="font-bold text-slate-900 uppercase tracking-wide text-xs">
                Forensic Storage & Integrity
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {getDriverBadge(evidence.storageDriver)}
              {getIntegrityBadge()}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-600">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">File Name</span>
              <span className="font-mono text-slate-900 truncate block" title={evidence.fileName}>
                {evidence.fileName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Format / MIME</span>
              <span className="font-mono text-slate-900">{evidence.fileType}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">File Size</span>
              <span className="font-mono text-slate-900">
                {evidence.fileSize ? `${(evidence.fileSize / 1024).toFixed(1)} KB` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Captured At</span>
              <span className="text-slate-900 block truncate">
                {evidence.capturedAt ? new Date(evidence.capturedAt).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* SHA-256 Checksum Display */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                SHA-256 Checksum Fingerprint
              </span>
              {evidence.checksumSha256 ? (
                <span className="font-mono text-[11px] text-slate-800 break-all select-all block">
                  {evidence.checksumSha256}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 italic block">
                  Historical baseline checksum not recorded at ingestion
                </span>
              )}
            </div>
            {evidence.checksumSha256 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleVerifyIntegrity}
                  disabled={isVerifying}
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 cursor-pointer shrink-0 transition-colors disabled:opacity-50"
                  title="Retrieve current bytes and re-verify SHA-256 checksum"
                  data-testid="evidence-modal-verify-btn"
                >
                  <RefreshCw className={`w-3 h-3 ${isVerifying ? 'animate-spin' : ''}`} />
                  <span>{isVerifying ? 'Verifying...' : 'Verify Hash'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 cursor-pointer shrink-0 transition-colors"
                  title="Copy SHA-256 hash to clipboard"
                >
                  {copiedHash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Verification Feedback Banner */}
          {verificationFeedback && (
            <div
              className={`p-2 rounded text-[11px] flex items-center gap-1.5 ${
                verificationFeedback.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200 font-semibold'
                  : verificationFeedback.type === 'warning'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {verificationFeedback.type === 'error' ? (
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              ) : verificationFeedback.type === 'warning' ? (
                <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
              <span>{verificationFeedback.text}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default EvidenceDetailModal;

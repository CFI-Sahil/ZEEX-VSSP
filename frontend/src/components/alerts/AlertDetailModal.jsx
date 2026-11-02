import React from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import {
  AlertTriangle,
  Camera,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Image as ImageIcon,
  User,
} from 'lucide-react';
import evidenceService from '../../services/evidenceService';

export function AlertDetailModal({
  isOpen,
  onClose,
  alert,
  onAcknowledge,
  onOpenCloseModal,
  isActionLoading = false,
}) {
  if (!alert) return null;

  const severityVariant =
    alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
      ? 'danger'
      : alert.severity === 'MEDIUM'
      ? 'warning'
      : 'neutral';

  const statusVariant =
    alert.status === 'CLOSED'
      ? 'success'
      : alert.status === 'ACKNOWLEDGED'
      ? 'info'
      : 'warning';

  const evidenceId = alert.evidence?._id || alert.evidence;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Violation Alert: ${alert.alertCode}`}
      description="Inspect computer vision detection parameters, snapshot evidence, and audited lifecycle state."
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Dismiss
          </Button>
          <div className="flex items-center gap-2">
            {alert.status === 'PENDING' && (
              <Button
                variant="primary"
                size="sm"
                icon={CheckCircle2}
                onClick={() => onAcknowledge(alert._id)}
                isLoading={isActionLoading}
                data-testid="modal-ack-btn"
              >
                Acknowledge Alert
              </Button>
            )}
            {alert.status === 'ACKNOWLEDGED' && (
              <Button
                variant="outline"
                size="sm"
                icon={ShieldCheck}
                onClick={() => {
                  onClose();
                  onOpenCloseModal(alert);
                }}
                data-testid="modal-close-btn"
              >
                Close Alert
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Top Highlight Banner */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-500">{alert.eventId}</span>
              <Badge variant={severityVariant} size="sm">
                {alert.severity} SEVERITY
              </Badge>
              <Badge variant={statusVariant} size="sm" dot>
                {alert.status}
              </Badge>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">{alert.violationName}</h3>
            {alert.description && (
              <p className="text-xs text-slate-600 mt-0.5">{alert.description}</p>
            )}
          </div>
          <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
            <span className="text-[11px] text-slate-400 block">AI Confidence</span>
            <span className="text-xl font-bold font-mono text-blue-600">
              {(alert.confidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Evidence Snapshot Preview */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Captured Snapshot Evidence</span>
          </label>
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-950 flex flex-col items-center justify-center relative min-h-52">
            {evidenceId ? (
              <img
                src={evidenceService.getEvidenceFileUrl(evidenceId)}
                alt={`Evidence snapshot for ${alert.alertCode}`}
                className="max-h-64 w-full object-contain"
                crossOrigin="use-credentials"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={`p-6 flex-col items-center justify-center text-center text-slate-400 ${
                evidenceId ? 'hidden' : 'flex'
              }`}
            >
              <ImageIcon className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-xs font-medium">No Snapshot Image Associated</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Snapshot metadata was not linked to this detection event.
              </p>
            </div>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <Camera className="w-3.5 h-3.5" />
              <span>Camera Point</span>
            </div>
            <p className="font-semibold text-slate-900">{alert.cameraCode}</p>
            <p className="text-slate-500">{alert.camera?.name || 'Monitoring Point'}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>Incident Location</span>
            </div>
            <p className="font-semibold text-slate-900">{alert.location}</p>
            <p className="text-slate-500">{alert.camera?.site || 'Site Facility'}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Detection Timestamp</span>
            </div>
            <p className="font-semibold text-slate-900">
              {alert.detectedAt ? new Date(alert.detectedAt).toLocaleString() : 'N/A'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <User className="w-3.5 h-3.5" />
              <span>Lifecycle State</span>
            </div>
            <p className="font-semibold text-slate-900">{alert.status}</p>
            <p className="text-slate-500">
              {alert.status === 'PENDING'
                ? 'Awaiting review'
                : alert.status === 'ACKNOWLEDGED'
                ? 'Acknowledged by operator'
                : 'Resolved & closed'}
            </p>
          </div>
        </div>

        {/* Resolution Remarks & Audit Trail if Closed */}
        {alert.status === 'CLOSED' && alert.closureRemarks && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-1">
            <div className="flex items-center justify-between text-emerald-800 font-semibold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Audited Closure Remarks:</span>
              </span>
              <span className="text-[11px] text-emerald-700 font-normal">
                Closed by {alert.closedBy?.name || 'Operator'} on{' '}
                {alert.closedAt ? new Date(alert.closedAt).toLocaleDateString() : ''}
              </span>
            </div>
            <p className="text-emerald-900 pl-5 leading-relaxed">{alert.closureRemarks}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default AlertDetailModal;


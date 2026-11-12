import React, { useState, useEffect } from 'react';
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
  HardHat,
  ExternalLink,
  Bell,
  Mail,
  MessageSquare,
  ShieldAlert,
  Send,
  RefreshCw,
} from 'lucide-react';
import evidenceService from '../../services/evidenceService';
import notificationService from '../../services/notificationService';

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

const getRiskBadge = (risk) => {
  const map = {
    CRITICAL: 'danger',
    HIGH: 'warning',
    MEDIUM: 'info',
    LOW: 'success',
  };
  return (
    <Badge variant={map[risk] || 'neutral'} size="sm">
      {risk || 'UNSPECIFIED'}
    </Badge>
  );
};

export function AlertDetailModal({
  isOpen,
  onClose,
  alert,
  onAcknowledge,
  onOpenCloseModal,
  isActionLoading = false,
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [notifications, setNotifications] = useState([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  useEffect(() => {
    if (isOpen && alert?._id) {
      setIsLoadingNotifications(true);
      notificationService
        .getAlertNotifications(alert._id)
        .then((res) => {
          if (res?.data?.notifications) {
            setNotifications(res.data.notifications);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingNotifications(false));
    }
  }, [isOpen, alert?._id]);

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

  const getEscalationBadge = (level) => {
    switch (level) {
      case 3:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            L3 CRITICAL
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            L2 SUPERVISOR
          </span>
        );
      case 1:
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            L1 NORMAL
          </span>
        );
    }
  };

  const getEvidenceStatusBadge = () => {
    const status = alert.metadata?.evidenceStatus;
    if (evidenceId || status === 'EVIDENCE_AVAILABLE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          Available
        </span>
      );
    }
    if (status === 'EVIDENCE_RECOVERY_PENDING') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
          Recovery Pending
        </span>
      );
    }
    if (status === 'EVIDENCE_INCOMPLETE_UNRECOVERABLE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
          Snapshot Unavailable
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
        No Snapshot
      </span>
    );
  };

  const getChannelBadge = (channel) => {
    switch (channel) {
      case 'IN_APP':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Bell className="w-3 h-3" />
            <span>IN_APP</span>
          </span>
        );
      case 'SIMULATED_EMAIL':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Mail className="w-3 h-3" />
            <span>EMAIL (Simulated)</span>
          </span>
        );
      case 'SIMULATED_SMS':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <MessageSquare className="w-3 h-3" />
            <span>SMS (Simulated)</span>
          </span>
        );
      default:
        return <span className="text-[10px] text-slate-500">{channel}</span>;
    }
  };

  const getDeliveryStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED_IN_APP':
      case 'DISPATCHED_SIMULATED':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
            DISPATCHED
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
            PENDING
          </span>
        );
      case 'FAILED':
      case 'PERMANENTLY_FAILED':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
            {status}
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
            CANCELLED
          </span>
        );
      default:
        return <span className="text-[10px] text-slate-500">{status}</span>;
    }
  };

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
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`/event-intake?search=${alert.eventId}`}
                className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                title="Trace back to originating intake event"
              >
                <span>{alert.eventId}</span>
                <ExternalLink className="w-3 h-3 inline" />
              </a>
              <Badge variant={severityVariant} size="sm">
                {alert.severity} SEVERITY
              </Badge>
              <Badge variant={statusVariant} size="sm" dot>
                {alert.status}
              </Badge>
              {getEscalationBadge(alert.escalationLevel || 1)}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">{alert.violationName}</h3>
            {alert.description && (
              <p className="text-xs text-slate-600 mt-0.5">{alert.description}</p>
            )}
          </div>
          <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4 shrink-0">
            <span className="text-[11px] text-slate-400 block">AI Confidence</span>
            <span className="text-xl font-bold font-mono text-blue-600">
              {(alert.confidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 text-xs font-semibold gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2 transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Incident Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`pb-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'notifications'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Notification & Dispatch Logs</span>
            {notifications.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                {notifications.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'overview' ? (
          <div className="space-y-4">
            {/* SLA Escalation Milestone Timeline */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                    SLA Escalation Timeline
                  </span>
                </div>
                {getEscalationBadge(alert.escalationLevel || 1)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                {/* Milestone 1: L1 Detected */}
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="text-[10px] font-semibold text-blue-700 block uppercase">
                    Level 1: Detected
                  </span>
                  <span className="font-semibold text-slate-900 block mt-0.5">
                    {alert.detectedAt ? new Date(alert.detectedAt).toLocaleTimeString() : '—'}
                  </span>
                  <span className="text-[10px] text-slate-400">Initial operator intake</span>
                </div>

                {/* Milestone 2: L2 Escalated */}
                <div
                  className={`p-2.5 rounded-lg border ${
                    alert.escalationLevel >= 2
                      ? 'bg-amber-50/60 border-amber-300'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <span
                    className={`text-[10px] font-semibold block uppercase ${
                      alert.escalationLevel >= 2 ? 'text-amber-800' : 'text-slate-500'
                    }`}
                  >
                    Level 2: Supervisor
                  </span>
                  <span className="font-semibold text-slate-900 block mt-0.5">
                    {alert.escalatedAtL2
                      ? new Date(alert.escalatedAtL2).toLocaleTimeString()
                      : alert.escalationLevel >= 2
                      ? 'Escalated'
                      : 'Not reached'}
                  </span>
                  <span className="text-[10px] text-slate-400">Supervisor SMS/Email</span>
                </div>

                {/* Milestone 3: L3 Escalated */}
                <div
                  className={`p-2.5 rounded-lg border ${
                    alert.escalationLevel >= 3
                      ? 'bg-rose-50/60 border-rose-300'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <span
                    className={`text-[10px] font-semibold block uppercase ${
                      alert.escalationLevel >= 3 ? 'text-rose-800' : 'text-slate-500'
                    }`}
                  >
                    Level 3: Management
                  </span>
                  <span className="font-semibold text-slate-900 block mt-0.5">
                    {alert.escalatedAtL3
                      ? new Date(alert.escalatedAtL3).toLocaleTimeString()
                      : alert.escalationLevel >= 3
                      ? 'Escalated'
                      : 'Not reached'}
                  </span>
                  <span className="text-[10px] text-slate-400">Plant safety breach</span>
                </div>
              </div>
            </div>

            {/* Evidence Snapshot Preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Captured Snapshot Evidence</span>
                </label>
                {getEvidenceStatusBadge()}
              </div>

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
                    {alert.metadata?.evidenceStatus === 'EVIDENCE_RECOVERY_PENDING'
                      ? 'Snapshot upload recovery is currently pending in background scheduler.'
                      : alert.metadata?.evidenceStatus === 'EVIDENCE_INCOMPLETE_UNRECOVERABLE'
                      ? 'Snapshot was permanently unavailable from cloud storage.'
                      : 'Snapshot metadata was not linked to this detection event.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Metadata Details Grid */}
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
              <div className="p-2.5 sm:p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Camera Point</span>
                </div>
                <p className="font-semibold text-slate-900">{alert.cameraCode}</p>
                <p className="text-slate-500 truncate">{alert.camera?.name || 'Monitoring Point'}</p>
              </div>

              <div className="p-2.5 sm:p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Incident Location</span>
                </div>
                <p className="font-semibold text-slate-900 truncate">{alert.location}</p>
                <p className="text-slate-500 truncate">{alert.camera?.site || 'Site Facility'}</p>
              </div>

              <div className="p-2.5 sm:p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Detection Timestamp</span>
                </div>
                <p className="font-semibold text-slate-900 truncate">
                  {alert.detectedAt ? new Date(alert.detectedAt).toLocaleString() : 'N/A'}
                </p>
              </div>

              <div className="p-2.5 sm:p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
                  <User className="w-3.5 h-3.5" />
                  <span>Lifecycle State</span>
                </div>
                <p className="font-semibold text-slate-900">{alert.status}</p>
                <p className="text-slate-500 truncate">
                  {alert.status === 'PENDING'
                    ? 'Awaiting operator review'
                    : alert.status === 'ACKNOWLEDGED'
                    ? 'Acknowledged by operator'
                    : 'Resolved & closed'}
                </p>
              </div>
            </div>

            {/* Operational Context & Work-Front Attribution Card */}
            {alert.workFrontCode || alert.workFront ? (
              <div className="p-4 rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-slate-50 to-indigo-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center text-blue-700">
                      <HardHat className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                      Work-Front & Operational Context
                    </span>
                  </div>
                  <span className="inline-flex items-center font-mono text-xs font-bold text-blue-800 bg-blue-100/80 border border-blue-300/80 px-2.5 py-0.5 rounded shadow-2xs">
                    {alert.workFrontCode || alert.workFront?.workFrontCode}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Work-Front Name</span>
                    <span className="font-semibold text-slate-800">
                      {alert.workFrontName || alert.workFront?.name || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Contractor</span>
                    <span className="font-semibold text-slate-800">
                      {alert.contractor || alert.workFront?.contractor || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Zone / Perimeter</span>
                    <span className="font-semibold text-slate-800">
                      {alert.zone || alert.workFront?.zone || alert.location || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Activity Classification</span>
                    <div className="mt-1">
                      <Badge variant="neutral" size="sm">
                        {formatActivity(alert.activityType || alert.workFront?.activityType)}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Risk Level</span>
                    <div className="mt-1">
                      {getRiskBadge(alert.riskLevel || alert.workFront?.riskLevel)}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Operational Shift</span>
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700 text-xs">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatShift(alert.shift || alert.workFront?.shift)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Supervisor Info if present */}
                {alert.workFront?.supervisor?.name && (
                  <div className="pt-2 border-t border-blue-200/50 flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2">
                    <span>
                      Site Supervisor:{' '}
                      <strong className="text-slate-800">{alert.workFront.supervisor.name}</strong>
                    </span>
                    {alert.workFront.supervisor.phone && (
                      <span className="font-mono text-slate-500">
                        {alert.workFront.supervisor.phone}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : null}

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
        ) : (
          /* Notifications Tab */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Audited notification dispatch records for this alert:</span>
              <span className="font-semibold text-slate-700">
                {notifications.length} {notifications.length === 1 ? 'record' : 'records'}
              </span>
            </div>

            {isLoadingNotifications ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mb-2" />
                <p className="text-xs">Loading delivery logs...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Bell className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No Notifications Generated</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Notification logs are automatically created as alerts age past SLA thresholds.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-80 overflow-y-auto">
                {notifications.map((notif) => (
                  <div key={notif._id} className="p-3 hover:bg-slate-50 transition-colors text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getEscalationBadge(notif.escalationLevel)}
                        {getChannelBadge(notif.channel)}
                        {getDeliveryStatusBadge(notif.deliveryStatus)}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString() : ''}
                      </span>
                    </div>

                    <div className="mt-1">
                      <span className="font-semibold text-slate-800">{notif.title}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">{notif.message}</p>
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>
                        Recipient:{' '}
                        <strong className="text-slate-600">
                          {notif.recipientName || notif.recipientRole} ({notif.recipientContact || 'In-App'})
                        </strong>
                      </span>
                      {notif.retryCount > 0 && (
                        <span>
                          Retries: <strong className="text-slate-600">{notif.retryCount}/3</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default AlertDetailModal;

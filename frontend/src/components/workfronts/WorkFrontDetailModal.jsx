import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { useAuth } from '../../hooks/useAuth';
import workFrontService from '../../services/workFrontService';
import AssignCameraModal from './AssignCameraModal';
import RelocateCameraModal from './RelocateCameraModal';
import {
  HardHat,
  MapPin,
  Building2,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  ShieldAlert,
  Video,
  History,
  Plus,
  Trash2,
  ArrowRightLeft,
  AlertCircle,
} from 'lucide-react';

const formatActivityName = (type) => {
  const map = {
    WORKING_AT_HEIGHT: 'Working at Height',
    HOT_WORK: 'Hot Work / Welding',
    EXCAVATION: 'Excavation & Trenching',
    CONFINED_SPACE: 'Confined Space',
    HEAVY_LIFTING: 'Heavy Lifting / Crane Ops',
    ELECTRICAL: 'Electrical Installation',
    GENERAL_CONSTRUCTION: 'General Construction',
    OTHER: 'Other Activity',
  };
  return map[type] || type || 'General';
};

const formatShiftName = (shift) => {
  const map = {
    MORNING: 'Morning Shift (06:00 – 14:00)',
    AFTERNOON: 'Afternoon Shift (14:00 – 22:00)',
    NIGHT: 'Night Shift (22:00 – 06:00)',
    GENERAL_24X7: 'General 24×7 Coverage',
  };
  return map[shift] || shift || 'General';
};

export function WorkFrontDetailModal({
  isOpen,
  onClose,
  workFront,
  auditLogs = [],
  onUpdateWorkFront,
}) {
  const { isAdmin } = useAuth();

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [relocatingCamera, setRelocatingCamera] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (!workFront) return null;

  const isCompleted = workFront.status === 'COMPLETED';

  const statusVariant =
    workFront.status === 'ACTIVE'
      ? 'success'
      : workFront.status === 'SUSPENDED'
      ? 'danger'
      : workFront.status === 'COMPLETED'
      ? 'neutral'
      : 'warning';

  const riskVariant =
    workFront.riskLevel === 'CRITICAL'
      ? 'danger'
      : workFront.riskLevel === 'HIGH'
      ? 'warning'
      : workFront.riskLevel === 'MEDIUM'
      ? 'info'
      : 'success';

  // Handle Remove Camera
  const handleRemoveCamera = async (camera) => {
    if (!window.confirm(`Are you sure you want to unassign camera '${camera.cameraCode}' from this work-front?`)) {
      return;
    }

    setActionError(null);
    setIsActionLoading(true);

    try {
      const res = await workFrontService.removeCamera(workFront._id, camera._id);
      if (onUpdateWorkFront && res?.data?.workFront) {
        onUpdateWorkFront(res.data.workFront);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to remove camera assignment');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Callback when camera is assigned
  const handleCameraAssigned = (updatedWf) => {
    if (onUpdateWorkFront && updatedWf) {
      onUpdateWorkFront(updatedWf);
    }
  };

  // Callback when camera is relocated
  const handleCameraRelocated = (data) => {
    if (onUpdateWorkFront && data?.sourceWorkFront) {
      onUpdateWorkFront(data.sourceWorkFront);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Work-Front Details: ${workFront.workFrontCode}`}
        description="Inspect operational configuration, contractor oversight, hazard categorization, and camera mapping."
        footer={
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="font-medium flex-1">{actionError}</div>
            </div>
          )}

          {/* Top Header Card */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <HardHat className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                    {workFront.workFrontCode}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-300 font-medium">{workFront.site}</span>
                </div>
                <h3 className="text-sm font-bold text-white mt-0.5">{workFront.name}</h3>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusVariant} size="sm" dot>
                {workFront.status}
              </Badge>
              <Badge variant={riskVariant} size="sm">
                {workFront.riskLevel} RISK
              </Badge>
            </div>
          </div>

          {/* Operational Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Location & Perimeter */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>Location & Site Zone</span>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Site Facility</p>
                <p className="font-semibold text-slate-800 text-xs mt-0.5">{workFront.site}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Zone / Operational Perimeter</p>
                <p className="font-semibold text-slate-800 text-xs mt-0.5">{workFront.zone}</p>
              </div>
            </div>

            {/* Activity & Hazard */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                <span>Activity & Hazard Profile</span>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Primary Activity</p>
                <p className="font-semibold text-slate-800 text-xs mt-0.5">
                  {formatActivityName(workFront.activityType)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Shift Coverage</p>
                <p className="font-semibold text-slate-800 text-xs mt-0.5">
                  {formatShiftName(workFront.shift)}
                </p>
              </div>
            </div>
          </div>

          {/* Contractor Attribution & Supervision */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Contractor Attribution</span>
              </div>
              <span className="font-semibold text-slate-900 text-xs">{workFront.contractor}</span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">Site Supervisor</p>
                  <p className="font-medium text-slate-800">{workFront.supervisor?.name || 'Unassigned'}</p>
                </div>
              </div>

              {workFront.supervisor?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500">Contact Phone</p>
                    <a
                      href={`tel:${workFront.supervisor.phone}`}
                      className="font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {workFront.supervisor.phone}
                    </a>
                  </div>
                </div>
              )}

              {workFront.supervisor?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500">Email Address</p>
                    <a
                      href={`mailto:${workFront.supervisor.email}`}
                      className="font-medium text-[var(--color-primary)] hover:underline truncate block max-w-[140px]"
                      title={workFront.supervisor.email}
                    >
                      {workFront.supervisor.email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Schedule & Description */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold uppercase">Start Date</span>
                </div>
                <p className="font-medium text-slate-800">
                  {workFront.startDate
                    ? new Date(workFront.startDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Immediate'}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold uppercase">End Date</span>
                </div>
                <p className="font-medium text-slate-800">
                  {workFront.endDate
                    ? new Date(workFront.endDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Open-ended / Ongoing'}
                </p>
              </div>
            </div>

            {workFront.description && (
              <div className="pt-2 border-t border-slate-200/60">
                <p className="text-[10px] text-slate-500 font-semibold uppercase mb-0.5">Scope Description</p>
                <p className="text-slate-700 leading-relaxed">{workFront.description}</p>
              </div>
            )}
          </div>

          {/* Assigned Surveillance Cameras Section (Batch 2) */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-[var(--color-primary)]" />
                <span className="font-bold text-slate-800 text-xs">
                  Assigned Surveillance Cameras ({workFront.cameras?.length || 0})
                </span>
              </div>

              {isAdmin && !isCompleted && (
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Camera</span>
                </button>
              )}
            </div>

            {/* Cameras Table or Empty State */}
            {(!workFront.cameras || workFront.cameras.length === 0) ? (
              <div className="p-4 rounded-lg bg-white border border-slate-200 text-center text-xs text-slate-500">
                <Video className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="font-medium text-slate-700">No Cameras Currently Assigned</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isAdmin && !isCompleted
                    ? 'Click "+ Assign Camera" above to associate an available camera point.'
                    : 'No camera surveillance points are linked to this work-front perimeter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {workFront.cameras.map((cam) => {
                  const cameraObj = typeof cam === 'object' ? cam : { _id: cam, cameraCode: 'CAMERA' };
                  const statusVariant =
                    cameraObj.status === 'ONLINE'
                      ? 'success'
                      : cameraObj.status === 'OFFLINE'
                      ? 'danger'
                      : 'warning';

                  return (
                    <div
                      key={cameraObj._id}
                      className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                          {cameraObj.cameraCode}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-xs truncate">
                            {cameraObj.name || cameraObj.cameraCode}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {cameraObj.location ? `${cameraObj.site} · ${cameraObj.location}` : cameraObj.site || 'Site'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Badge variant={statusVariant} size="sm" dot>
                          {cameraObj.status || 'UNKNOWN'}
                        </Badge>

                        {isAdmin && (
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              type="button"
                              onClick={() => setRelocatingCamera(cameraObj)}
                              disabled={isActionLoading}
                              className="p-1 text-slate-500 hover:text-[var(--color-primary)] hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Relocate Camera to another Work-Front"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCamera(cameraObj)}
                              disabled={isActionLoading}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Unassign Camera"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Operational Audit History */}
          {auditLogs.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase tracking-wider text-[10px] mb-2">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Operational Audit Trail ({auditLogs.length})</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div
                    key={log._id || log.timestamp}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-800">{log.action}</span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-slate-600">{log.performedByEmail || 'system'}</span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-[10px] text-slate-500 font-medium">({log.performedByRole})</span>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Assign Camera Modal */}
      {isAssignOpen && (
        <AssignCameraModal
          isOpen={isAssignOpen}
          onClose={() => setIsAssignOpen(false)}
          workFront={workFront}
          onCameraAssigned={handleCameraAssigned}
        />
      )}

      {/* Relocate Camera Modal */}
      {relocatingCamera && (
        <RelocateCameraModal
          isOpen={Boolean(relocatingCamera)}
          onClose={() => setRelocatingCamera(null)}
          camera={relocatingCamera}
          sourceWorkFront={workFront}
          onCameraRelocated={handleCameraRelocated}
        />
      )}
    </>
  );
}

export default WorkFrontDetailModal;

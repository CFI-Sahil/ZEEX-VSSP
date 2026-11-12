import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Send,
  Camera,
  HardHat,
  ArrowLeft,
  Flame,
  Plus,
  RefreshCw,
  Layers,
  History,
  ShieldAlert,
  Info,
  Calendar,
  Lock,
} from 'lucide-react';
import shiftHandoverService from '../../services/shiftHandoverService';
import { useAuth } from '../../hooks/useAuth';

export default function HandoverDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [handover, setHandover] = useState(null);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(location.state?.message || null);

  // Acknowledgement form state
  const [ackRemarks, setAckRemarks] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);

  // Complete handover state
  const [completing, setCompleting] = useState(false);

  // Follow-up form state
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [followUpDescription, setFollowUpDescription] = useState('');
  const [followUpPriority, setFollowUpPriority] = useState('MEDIUM');
  const [followUpAlertCode, setFollowUpAlertCode] = useState('');
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const [updatingFollowUpId, setUpdatingFollowUpId] = useState(null);

  useEffect(() => {
    fetchHandover();
  }, [id]);

  const fetchHandover = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await shiftHandoverService.getHandoverById(id);
      if (res.success && res.data) {
        setHandover(res.data.handover || res.data);
        setActivities(res.data.activities || []);
      }
    } catch (err) {
      console.error('Failed to load handover details:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load handover record.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (e) => {
    e.preventDefault();
    try {
      setAcknowledging(true);
      setError(null);
      const res = await shiftHandoverService.acknowledgeHandover(id, { remarks: ackRemarks });
      if (res.success) {
        setSuccessMessage('Shift handover successfully acknowledged! You are now the active on-duty operator.');
        fetchHandover();
      }
    } catch (err) {
      console.error('Failed to acknowledge handover:', err);
      setError(err.response?.data?.message || err.message || 'Failed to acknowledge handover.');
    } finally {
      setAcknowledging(false);
    }
  };

  const handleCompleteHandover = async () => {
    try {
      setCompleting(true);
      setError(null);
      const res = await shiftHandoverService.completeHandover(id);
      if (res.success) {
        setSuccessMessage('Shift handover marked as COMPLETED.');
        fetchHandover();
      }
    } catch (err) {
      console.error('Failed to complete handover:', err);
      setError(err.response?.data?.message || err.message || 'Failed to complete handover.');
    } finally {
      setCompleting(false);
    }
  };

  const handleCreateFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpDescription.trim()) return;

    try {
      setAddingFollowUp(true);
      setError(null);
      const res = await shiftHandoverService.createFollowUp(id, {
        description: followUpDescription.trim(),
        priority: followUpPriority,
        relatedAlertCode: followUpAlertCode.trim() || undefined,
      });

      if (res.success) {
        setFollowUpDescription('');
        setFollowUpAlertCode('');
        setShowAddFollowUp(false);
        fetchHandover();
      }
    } catch (err) {
      console.error('Failed to create follow-up item:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create follow-up item.');
    } finally {
      setAddingFollowUp(false);
    }
  };

  const handleUpdateFollowUpStatus = async (followUpId, newStatus) => {
    try {
      setUpdatingFollowUpId(followUpId);
      setError(null);
      const res = await shiftHandoverService.updateFollowUp(id, followUpId, {
        status: newStatus,
      });
      if (res.success) {
        fetchHandover();
      }
    } catch (err) {
      console.error('Failed to update follow-up status:', err);
      setError(err.response?.data?.message || err.message || 'Failed to update follow-up item.');
    } finally {
      setUpdatingFollowUpId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
      case 'SUBMITTED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'ACKNOWLEDGED':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'CANCELLED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'MEDIUM':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getFollowUpStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      case 'IN_PROGRESS':
        return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'BLOCKED':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
    }
  };

  if (loading && !handover) {
    return (
      <div className="py-24 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
        <span>Loading shift handover record...</span>
      </div>
    );
  }

  if (!handover) {
    return (
      <div className="p-8 rounded-xl bg-[#10243D] border border-slate-800 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="text-base font-semibold text-white">Handover Not Found</h3>
        <p className="text-xs text-slate-400">The requested shift handover does not exist or has been deleted.</p>
        <button
          onClick={() => navigate('/handovers')}
          className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
        >
          Return to Overview
        </button>
      </div>
    );
  }

  // Determine which data to display: submittedSnapshot if submitted/acknowledged/completed, or live fields if draft
  const isSnapshotFrozen = ['SUBMITTED', 'ACKNOWLEDGED', 'COMPLETED'].includes(handover.status);
  const snapshot = handover.submittedSnapshot || {};
  const summary = isSnapshotFrozen && snapshot.operationalSummary ? snapshot.operationalSummary : handover.operationalSummary;
  const incidents = isSnapshotFrozen && snapshot.selectedIncidents ? snapshot.selectedIncidents : handover.selectedIncidents || [];
  const cameras = isSnapshotFrozen && snapshot.cameraIssues ? snapshot.cameraIssues : handover.cameraIssues || [];
  const workFronts = isSnapshotFrozen && snapshot.workFrontObservations ? snapshot.workFrontObservations : handover.workFrontObservations || [];
  const notes = isSnapshotFrozen && snapshot.manualNotes ? snapshot.manualNotes : handover.manualNotes || [];
  const remarks = isSnapshotFrozen && snapshot.outgoingRemarks !== undefined ? snapshot.outgoingRemarks : handover.outgoingRemarks;

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/handovers')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Handover Overview</span>
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="font-mono">{handover.handoverCode}</span>
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(
                handover.status
              )}`}
            >
              {handover.status}
            </span>
            {isSnapshotFrozen && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-medium">
                <Lock className="w-3 h-3" />
                <span>Frozen Snapshot</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {handover.shiftLabel} | Shift Date:{' '}
            <span className="text-slate-300 font-medium">
              {new Date(handover.shiftDate).toLocaleDateString()}
            </span>{' '}
            | Shift Type: <span className="text-slate-300 font-medium">{handover.shiftType}</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {handover.status === 'ACKNOWLEDGED' && (
            <>
              {handover.followUps?.some(
                (f) => f.status === 'OPEN' || f.status === 'IN_PROGRESS' || f.status === 'BLOCKED'
              ) && user?.role !== 'ADMIN' ? (
                <span className="text-[11px] text-amber-300 bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-800/50">
                  Resolve all follow-up action items before completing
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleCompleteHandover}
                  disabled={completing}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{completing ? 'Completing...' : 'Mark Handover Completed'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Operator Ownership Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Outgoing Operator Card */}
        <div className="p-4 rounded-xl bg-[#10243D] border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Outgoing Author
            </span>
            {handover.submittedAt && (
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(handover.submittedAt).toLocaleString()}
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-white">
            {handover.outgoingOperator?.fullName || handover.outgoingOperator?.username || 'System Admin'}
          </div>
          <p className="text-xs text-slate-400">
            Role: <span className="text-sky-300">{handover.outgoingOperator?.role || 'OPERATOR'}</span> |
            Email: <span className="text-slate-300">{handover.outgoingOperator?.email || 'N/A'}</span>
          </p>
        </div>

        {/* Incoming Operator / Acknowledged By Card */}
        <div className="p-4 rounded-xl bg-[#10243D] border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Incoming Operator / Receiver
            </span>
            {handover.acknowledgement?.acknowledgedAt ? (
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {new Date(handover.acknowledgement.acknowledgedAt).toLocaleString()}
              </span>
            ) : handover.incomingOperator ? (
              <span className="text-[10px] text-sky-400 font-medium">Assigned</span>
            ) : (
              <span className="text-[10px] text-amber-400 font-medium">Unassigned</span>
            )}
          </div>
          <div className="text-sm font-bold text-white">
            {handover.acknowledgement?.acknowledgedBy?.fullName ||
              handover.acknowledgement?.acknowledgedBy?.username ||
              handover.incomingOperator?.fullName ||
              handover.incomingOperator?.username ||
              'Unassigned (Awaiting On-Duty Operator)'}
          </div>
          <p className="text-xs text-slate-400">
            Status:{' '}
            <span
              className={
                handover.status === 'COMPLETED'
                  ? 'text-emerald-400 font-semibold'
                  : handover.acknowledgement?.acknowledgedAt
                  ? 'text-sky-300 font-semibold'
                  : handover.incomingOperator
                  ? 'text-amber-300 font-medium'
                  : 'text-slate-400'
              }
            >
              {handover.status === 'COMPLETED'
                ? 'Handover Completed & Closed'
                : handover.acknowledgement?.acknowledgedAt
                ? 'Acknowledged & On-Duty'
                : handover.incomingOperator
                ? 'Assigned — Awaiting Acknowledgement'
                : 'Unassigned — Available for Claim'}
            </span>
          </p>
        </div>
      </div>

      {/* Prominent Acknowledgement Box (Visible when SUBMITTED) */}
      {handover.status === 'SUBMITTED' && (
        <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-md space-y-3">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Incoming Operator Review & Official Acknowledgement
            </h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Please carefully review the frozen operational intelligence, flagged safety incidents, and
            work-front observations recorded below. Submitting your acknowledgement formally accepts operational
            responsibility for safety surveillance during the next shift.
          </p>

          {/* Validation note if author or assigned mismatch */}
          {user?.role !== 'ADMIN' && handover.outgoingOperator?._id === user?.id && (
            <div className="p-3 rounded-lg bg-slate-900/80 border border-amber-800/40 text-amber-300 text-xs">
              Note: You authored this handover. Official acknowledgement must be submitted by an incoming operator or administrator.
            </div>
          )}

          {user?.role !== 'ADMIN' &&
            handover.incomingOperator &&
            handover.incomingOperator._id !== user?.id &&
            handover.outgoingOperator?._id !== user?.id && (
              <div className="p-3 rounded-lg bg-slate-900/80 border border-rose-800/40 text-rose-300 text-xs">
                This handover is assigned specifically to {handover.incomingOperator.fullName || handover.incomingOperator.username}.
              </div>
            )}

          <form onSubmit={handleAcknowledge} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Incoming Acknowledgement Remarks / Transition Notes:
              </label>
              <textarea
                rows={2}
                value={ackRemarks}
                onChange={(e) => setAckRemarks(e.target.value)}
                placeholder="e.g. Briefing received and verified. Station cameras and active work fronts in Sector 4 confirmed..."
                className="w-full p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-white text-xs focus:outline-hidden focus:border-amber-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={acknowledging}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {acknowledging ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Confirming Handover...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>Acknowledge & Accept Shift Transfer</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Acknowledgement Remarks Display (If already acknowledged) */}
      {handover.acknowledgement?.remarks && (
        <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-800/40 text-xs space-y-1">
          <span className="font-semibold text-sky-300 uppercase tracking-wider text-[10px] block">
            Incoming Operator Remarks:
          </span>
          <p className="text-slate-200 italic">"{handover.acknowledgement.remarks}"</p>
        </div>
      )}

      {/* Outgoing Shift Remarks Display */}
      {remarks && (
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs space-y-1">
          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block">
            Outgoing Operator Briefing:
          </span>
          <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{remarks}</p>
        </div>
      )}

      {/* Operational Intelligence Snapshot Ribbon */}
      <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              {isSnapshotFrozen ? 'Frozen Operational Summary Snapshot' : 'Current Operational Summary'}
            </h2>
          </div>
          {summary?.collectedAt && (
            <span className="text-[10px] text-slate-400 font-mono">
              Captured: {new Date(summary.collectedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Pending Alerts</span>
            <p className="text-lg font-bold text-white mt-1">{summary?.pendingAlertsCount ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
            <span className="text-[10px] text-rose-400 uppercase tracking-wider block">Critical</span>
            <p className="text-lg font-bold text-rose-400 mt-1">{summary?.criticalCount ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
            <span className="text-[10px] text-amber-400 uppercase tracking-wider block">High Priority</span>
            <p className="text-lg font-bold text-amber-400 mt-1">{summary?.highPriorityCount ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
            <span className="text-[10px] text-purple-400 uppercase tracking-wider block">Escalated</span>
            <p className="text-lg font-bold text-purple-400 mt-1">{summary?.escalationsCount ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
            <span className="text-[10px] text-amber-300 uppercase tracking-wider block">Offline Cameras</span>
            <p className="text-lg font-bold text-amber-300 mt-1">{summary?.offlineCamerasCount ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">Active Fronts</span>
            <p className="text-lg font-bold text-emerald-400 mt-1">{summary?.activeWorkFrontsCount ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Flagged Incidents Table */}
      <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-400" />
          <span>Flagged Safety Incidents ({incidents.length})</span>
        </h2>

        {incidents.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800 text-center text-xs text-slate-400">
            No specific incidents flagged in this handover package.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0b1726] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Alert Code</th>
                  <th className="p-3">Title / Category</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Work Front</th>
                  <th className="p-3">Camera</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Escalation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {incidents.map((incident, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-semibold text-white">{incident.alertCode}</td>
                    <td className="p-3">
                      <div className="font-medium text-slate-200">{incident.title}</div>
                      <div className="text-[10px] text-slate-400">{incident.category}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getSeverityBadge(
                          incident.severity
                        )}`}
                      >
                        {incident.severity}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">
                      {incident.workFrontName || incident.workFrontCode || 'N/A'}
                    </td>
                    <td className="p-3 font-mono text-slate-400">{incident.cameraCode || 'N/A'}</td>
                    <td className="p-3">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {incident.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                          incident.escalationLevel > 1
                            ? 'bg-purple-950/60 text-purple-300 border border-purple-800/50'
                            : 'text-slate-400'
                        }`}
                      >
                        Level {incident.escalationLevel || 1}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two-Column Grid: Hardware & Work-Fronts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hardware Status */}
        <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Camera className="w-4 h-4 text-amber-400" />
            <span>Camera & Hardware Issues ({cameras.length})</span>
          </h2>
          {cameras.length === 0 ? (
            <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>All surveillance cameras verified operational during transfer.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {cameras.map((cam, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-semibold text-white font-mono">{cam.cameraCode}</span>
                    <span className="text-xs text-slate-400 ml-2">{cam.name}</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">Location: {cam.location || 'N/A'}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    {cam.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Work Fronts */}
        <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <HardHat className="w-4 h-4 text-emerald-400" />
            <span>Active Work-Front Observations ({workFronts.length})</span>
          </h2>
          {workFronts.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800 text-center text-xs text-slate-400">
              No active work fronts logged.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {workFronts.map((wf, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{wf.name}</div>
                    <div className="text-[10px] text-slate-400">
                      Contractor: <span className="text-slate-300">{wf.contractor}</span> | Supervisor:{' '}
                      <span className="text-slate-300">{wf.supervisorName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-400 border border-sky-800/40">
                      {wf.riskLevel} Risk
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">{wf.activeAlertsCount} active alerts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Structured Field Observations / Notes */}
      {notes.length > 0 && (
        <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Structured Operator Field Notes ({notes.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {notes.map((note, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 font-mono">
                    {note.category}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${getSeverityBadge(
                      note.priority
                    )}`}
                  >
                    {note.priority}
                  </span>
                </div>
                <p className="text-xs text-slate-200">{note.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up Action Items Tracker (Post-Handover Operations) */}
      <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Shift Follow-Up Action Items ({handover.followUps?.length || 0})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Track operational tasks assigned to the incoming shift without modifying live alert records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddFollowUp(!showAddFollowUp)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddFollowUp ? 'Cancel' : 'Add Follow-Up Item'}</span>
          </button>
        </div>

        {/* Add Follow-Up Form */}
        {showAddFollowUp && (
          <form
            onSubmit={handleCreateFollowUp}
            className="p-4 rounded-lg bg-slate-900/80 border border-emerald-900/40 space-y-3"
          >
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">New Action Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Task Description *
                </label>
                <input
                  type="text"
                  required
                  value={followUpDescription}
                  onChange={(e) => setFollowUpDescription(e.target.value)}
                  placeholder="e.g. Verify scaffolding tag in Sector 3 with contractor supervisor"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Priority</label>
                <select
                  value={followUpPriority}
                  onChange={(e) => setFollowUpPriority(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Related Alert Code (Optional)
                </label>
                <input
                  type="text"
                  value={followUpAlertCode}
                  onChange={(e) => setFollowUpAlertCode(e.target.value)}
                  placeholder="e.g. ALT-20261109-001"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddFollowUp(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingFollowUp || !followUpDescription.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
              >
                {addingFollowUp ? 'Saving...' : 'Save Follow-Up'}
              </button>
            </div>
          </form>
        )}

        {/* Follow-up Items Table */}
        {!handover.followUps || handover.followUps.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800 text-center text-xs text-slate-400">
            No follow-up action items created yet. Use the button above to log actionable handover tasks.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0b1726] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Description</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Related Alert</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {handover.followUps.map((fu) => (
                  <tr key={fu._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-medium text-white">{fu.description}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getSeverityBadge(
                          fu.priority
                        )}`}
                      >
                        {fu.priority}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400">
                      {fu.relatedAlertCode || 'None'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getFollowUpStatusBadge(
                          fu.status
                        )}`}
                      >
                        {fu.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <select
                        disabled={updatingFollowUpId === fu._id}
                        value={fu.status}
                        onChange={(e) => handleUpdateFollowUpStatus(fu._id, e.target.value)}
                        className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-[11px] focus:outline-hidden cursor-pointer"
                      >
                        <option value="OPEN">Mark Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity Timeline / Audit Trail */}
      {activities.length > 0 && (
        <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            <span>Shift Handover Audit & Activity Trail ({activities.length})</span>
          </h2>
          <div className="space-y-2">
            {activities.map((act) => (
              <div
                key={act._id}
                className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{act.activityType}</span>
                    <span className="text-[10px] text-slate-400">
                      by <strong className="text-slate-300">{act.performedBy?.fullName || act.performedBy?.username || 'System'}</strong>
                    </span>
                  </div>
                  {act.details?.remarks && (
                    <p className="text-[11px] text-slate-400 italic">"{act.details.remarks}"</p>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


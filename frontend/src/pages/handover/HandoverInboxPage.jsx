import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  Clock,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Flame,
  ShieldCheck,
  Calendar,
  Layers,
} from 'lucide-react';
import shiftHandoverService from '../../services/shiftHandoverService';
import { useAuth } from '../../hooks/useAuth';

export default function HandoverInboxPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [inboxHandovers, setInboxHandovers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInbox();
  }, []);

  const fetchInbox = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await shiftHandoverService.getInbox();
      if (res.success && res.data) {
        setInboxHandovers(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load handover inbox:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch incoming handover inbox.');
    } finally {
      setLoading(false);
    }
  };

  const getShiftTypeBadge = (type) => {
    switch (type) {
      case 'DAY':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      case 'NIGHT':
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
      case 'SWING':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Inbox className="w-6 h-6 text-amber-400" />
              <span>Incoming Handover Inbox</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {inboxHandovers.length} Awaiting Review
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review and officially acknowledge incoming shift handovers submitted by previous shift operators.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchInbox}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Inbox</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && inboxHandovers.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <span>Loading submitted shift handovers...</span>
        </div>
      ) : inboxHandovers.length === 0 ? (
        <div className="p-12 rounded-xl bg-[#10243D] border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-900 mx-auto flex items-center justify-center border border-slate-800 text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">All Clear! No Pending Handovers</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            There are currently no shift handovers awaiting your review or acknowledgement. When an outgoing
            operator submits a shift package, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {inboxHandovers.map((handover) => {
            const summary = handover.submittedSnapshot?.operationalSummary || handover.operationalSummary;
            const criticalCount = summary?.criticalCount || 0;
            const highCount = summary?.highPriorityCount || 0;
            const pendingCount = summary?.pendingAlertsCount || 0;
            const offlineCameras = summary?.offlineCamerasCount || 0;

            return (
              <div
                key={handover._id}
                className="p-5 rounded-xl bg-[#10243D] border border-slate-800 hover:border-slate-700 transition-all shadow-md flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Bar with Code & Shift Type */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white bg-slate-900/80 px-2.5 py-1 rounded border border-slate-700/80">
                      {handover.handoverCode}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getShiftTypeBadge(
                        handover.shiftType
                      )}`}
                    >
                      {handover.shiftType} SHIFT
                    </span>
                  </div>

                  {/* Title and Date */}
                  <div>
                    <h3 className="text-sm font-bold text-white">{handover.shiftLabel}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(handover.shiftDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Submitted {new Date(handover.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Outgoing Operator Info */}
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs flex items-center justify-between">
                    <span className="text-slate-400">Outgoing Operator:</span>
                    <span className="font-semibold text-slate-200">
                      {handover.outgoingOperator?.fullName || handover.outgoingOperator?.username || 'Unknown'}
                    </span>
                  </div>

                  {/* Snapshot Counts */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded bg-slate-900/40 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">Pending</span>
                      <span className="text-xs font-bold text-white">{pendingCount}</span>
                    </div>
                    <div className="p-2 rounded bg-rose-950/20 border border-rose-900/40">
                      <span className="text-[10px] text-rose-400 block">Critical</span>
                      <span className="text-xs font-bold text-rose-400">{criticalCount}</span>
                    </div>
                    <div className="p-2 rounded bg-amber-950/20 border border-amber-900/40">
                      <span className="text-[10px] text-amber-400 block">High</span>
                      <span className="text-xs font-bold text-amber-400">{highCount}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900/40 border border-slate-800/80">
                      <span className="text-[10px] text-amber-300 block">Offline Cam</span>
                      <span className="text-xs font-bold text-amber-300">{offlineCameras}</span>
                    </div>
                  </div>

                  {/* Remarks Excerpt if present */}
                  {handover.outgoingRemarks && (
                    <div className="text-xs text-slate-300 bg-slate-900/30 p-2.5 rounded-lg border border-slate-800/60 italic line-clamp-2">
                      "{handover.outgoingRemarks}"
                    </div>
                  )}
                </div>

                {/* Bottom Action */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Awaiting Acknowledgment</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/handovers/${handover._id}`)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-colors cursor-pointer"
                  >
                    <span>Review & Acknowledge</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Search,
  Filter,
  ArrowRight,
  Clock,
  Calendar,
  User,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Flame,
} from 'lucide-react';
import shiftHandoverService from '../../services/shiftHandoverService';

export default function HandoverHistoryPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [handovers, setHandovers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [error, setError] = useState(null);

  // Filter State
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shiftTypeFilter, setShiftTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchHandovers(1);
  }, [statusFilter, shiftTypeFilter, debouncedSearch]);

  const fetchHandovers = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await shiftHandoverService.getHandovers({
        page,
        limit: 10,
        status: statusFilter,
        shiftType: shiftTypeFilter,
        search: debouncedSearch,
      });

      if (res.success && res.data) {
        setHandovers(res.data.handovers || []);
        setPagination(
          res.data.pagination || { page: 1, limit: 10, total: res.data.handovers?.length || 0, pages: 1 }
        );
      }
    } catch (err) {
      console.error('Failed to load handover history:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load shift handover history.');
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-sky-600" />
            <span>Shift Handover Archive & History</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete immutable audit log and historical record of all visual safety shift handovers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchHandovers(pagination.page)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, shift label, or operator..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/80 text-white text-xs focus:outline-hidden focus:border-sky-500"
            />
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/80 text-white text-xs focus:outline-hidden focus:border-sky-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted (Pending Review)</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Shift Type Filter */}
          <div className="md:col-span-3">
            <select
              value={shiftTypeFilter}
              onChange={(e) => setShiftTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/80 text-white text-xs focus:outline-hidden focus:border-sky-500"
            >
              <option value="ALL">All Shift Types</option>
              <option value="DAY">Day Shift</option>
              <option value="SWING">Swing Shift</option>
              <option value="NIGHT">Night Shift</option>
              <option value="CUSTOM">Custom Shift</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="md:col-span-1 flex items-center">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setShiftTypeFilter('ALL');
                setSearchQuery('');
              }}
              className="w-full py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 transition-colors cursor-pointer text-center"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Handovers Table */}
      <div className="rounded-xl bg-[#10243D] border border-slate-800 shadow-sm overflow-hidden">
        {loading && handovers.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
            <span>Loading shift handover archives...</span>
          </div>
        ) : handovers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <ShieldCheck className="w-8 h-8 text-slate-500 mx-auto mb-1" />
            <p className="text-sm font-semibold text-white">No Handover Records Found</p>
            <p className="text-slate-400">
              No shift handovers match the selected filter criteria or search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0b1726] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Shift Label / Date</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Author (Outgoing)</th>
                  <th className="p-3.5">Receiver (Incoming)</th>
                  <th className="p-3.5 text-center">Incidents</th>
                  <th className="p-3.5">Submitted At</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {handovers.map((h) => {
                  const summary = h.submittedSnapshot?.operationalSummary || h.operationalSummary;
                  const incidentCount =
                    h.submittedSnapshot?.selectedIncidents?.length ||
                    h.selectedIncidents?.length ||
                    0;

                  return (
                    <tr key={h._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-white whitespace-nowrap">
                        {h.handoverCode}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-200">{h.shiftLabel}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{new Date(h.shiftDate).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getShiftTypeBadge(
                            h.shiftType
                          )}`}
                        >
                          {h.shiftType}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadge(
                            h.status
                          )}`}
                        >
                          {h.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-200">
                        {h.outgoingOperator?.fullName || h.outgoingOperator?.username || 'Unknown'}
                      </td>
                      <td className="p-3.5 text-slate-200">
                        {h.acknowledgement?.acknowledgedBy?.fullName ||
                          h.acknowledgement?.acknowledgedBy?.username ||
                          h.incomingOperator?.fullName ||
                          h.incomingOperator?.username || (
                            <span className="text-slate-500 italic">Unclaimed</span>
                          )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                          {incidentCount}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 whitespace-nowrap">
                        {h.submittedAt ? (
                          <div className="space-y-0.5">
                            <div>{new Date(h.submittedAt).toLocaleDateString()}</div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(h.submittedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Not submitted</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => navigate(`/handovers/${h._id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-400 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/60 transition-colors cursor-pointer"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        {pagination.pages > 1 && (
          <div className="p-4 bg-[#0b1726] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing Page <span className="font-semibold text-white">{pagination.page}</span> of{' '}
              <span className="font-semibold text-white">{pagination.pages}</span> ({pagination.total}{' '}
              total records)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchHandovers(pagination.page - 1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages || loading}
                onClick={() => fetchHandovers(pagination.page + 1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


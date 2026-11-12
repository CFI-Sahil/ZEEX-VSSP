import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Search,
  Filter,
  Eye,
  Award,
  BookOpen,
  Calendar,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  ArrowUpDown,
} from 'lucide-react';
import trainingService from '../../services/trainingService';
import Card, { CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/common/Table';
import TrainingModeBanner from '../../components/training/TrainingModeBanner';
import TrainingResultsModal from '../../components/training/TrainingResultsModal';
import { useAuth } from '../../hooks/useAuth';

export function TrainingHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSessionForModal, setSelectedSessionForModal] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await trainingService.getHistory({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter,
        search: debouncedSearch,
        sortBy: 'startedAt',
        sortOrder: 'desc',
      });

      if (res && res.data) {
        setSessions(res.data);
        if (res.meta) {
          setPagination(res.meta);
        }
      }
    } catch (err) {
      console.error('Failed to load training history:', err);
      setError('Failed to load training history.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success" dot size="sm">Completed</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning" dot size="sm">In Progress</Badge>;
      case 'ABANDONED':
        return <Badge variant="danger" dot size="sm">Abandoned</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const getScoreBadge = (session) => {
    if (session.status !== 'COMPLETED') {
      return <span className="text-slate-400 text-xs">—</span>;
    }

    const score = session.evaluationResult?.totalScore ?? 0;
    const band = session.evaluationResult?.performanceBand;

    let color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score < 70) color = 'text-amber-700 bg-amber-50 border-amber-200';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${color}`}>
        {score} / 100
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <TrainingModeBanner />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Training Session History
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {user?.role === 'ADMIN'
              ? 'Comprehensive audit log of all operator training sessions across the platform.'
              : 'Permanent record of your past simulated training sessions, evaluations, and scores.'}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/training/scenarios')}
          className="flex items-center gap-1.5 self-start sm:self-auto bg-[var(--color-primary)] text-white hover:opacity-90"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Launch Scenario</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search history by session code, scenario title, or user email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ABANDONED">Abandoned</option>
              </select>

              {(statusFilter !== 'ALL' || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setSearch('');
                  }}
                  className="text-xs text-slate-500"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner size="lg" message="Loading training history..." />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-rose-600 text-sm">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={fetchHistory} className="mt-2">
                Retry
              </Button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="No Training Records Found"
                description="No training sessions match your selected filter criteria."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStatusFilter('ALL');
                      setSearch('');
                    }}
                  >
                    Reset Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session Code</TableHead>
                    <TableHead>Scenario</TableHead>
                    {user?.role === 'ADMIN' && <TableHead>Operator</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => {
                    const durationMin = Math.floor((session.durationSeconds || 0) / 60);
                    const durationSec = (session.durationSeconds || 0) % 60;

                    return (
                      <TableRow key={session._id} className="hover:bg-slate-50/70">
                        <TableCell className="font-mono text-xs font-bold text-slate-900">
                          {session.sessionCode}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-800 text-xs">
                            {session.scenarioSnapshot?.title || session.scenario?.title || 'Safety Scenario'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {session.scenarioSnapshot?.violationType || session.scenario?.violationType}
                          </div>
                        </TableCell>
                        {user?.role === 'ADMIN' && (
                          <TableCell className="text-xs text-slate-600">
                            {session.userEmail}
                          </TableCell>
                        )}
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell>{getScoreBadge(session)}</TableCell>
                        <TableCell className="text-xs text-slate-500 font-mono">
                          {session.status === 'COMPLETED'
                            ? `${durationMin}m ${durationSec}s`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {new Date(session.startedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {session.status === 'COMPLETED' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedSessionForModal(session)}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                View Results
                              </Button>
                            ) : session.status === 'IN_PROGRESS' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/training/session/${session._id}`)}
                                className="text-xs text-amber-700 border-amber-300 bg-amber-50"
                              >
                                Resume
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/training/session/${session._id}`)}
                                className="text-xs text-slate-500"
                              >
                                Details
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Footer */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total sessions)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Detail Modal */}
      {selectedSessionForModal && (
        <TrainingResultsModal
          isOpen={Boolean(selectedSessionForModal)}
          onClose={() => setSelectedSessionForModal(null)}
          session={selectedSessionForModal}
          onNavigateDashboard={() => {
            setSelectedSessionForModal(null);
            navigate('/training');
          }}
          onNavigateHistory={() => setSelectedSessionForModal(null)}
        />
      )}
    </div>
  );
}

export default TrainingHistoryPage;


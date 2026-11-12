import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Award,
  Activity,
  ArrowRight,
  ShieldAlert,
  Play,
  RotateCcw,
  BarChart3,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';
import trainingService from '../../services/trainingService';
import Card, { CardContent } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
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
import { useAuth } from '../../hooks/useAuth';

export function TrainingDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await trainingService.getStats();
      if (res && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to load training stats:', err);
      setError('Unable to load training analytics. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const kpis = stats?.kpis || {
    availableScenarios: 0,
    completedSessions: 0,
    inProgressSessions: 0,
    averageScore: 0,
    completionRate: 0,
  };

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Simulation Identity Banner */}
      <TrainingModeBanner />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Safety Operator Training Sandbox
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {user?.role === 'ADMIN'
              ? 'Platform-wide training metrics, scenario performance, and operator session audits.'
              : 'Interactive simulated safety scenarios and personal incident-handling performance.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/training/history')}
            className="flex items-center gap-1.5"
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Training History</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/training/scenarios')}
            className="flex items-center gap-1.5 bg-[var(--color-primary)] text-white hover:opacity-90"
          >
            <BookOpen className="w-4 h-4" />
            <span>Scenario Library</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" message="Loading training analytics..." />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchStats}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {/* KPI Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <StatCard
              title="Available Scenarios"
              value={kpis.availableScenarios}
              subtitle="Published Library"
              icon={BookOpen}
              colorVariant="blue"
              onClick={() => navigate('/training/scenarios')}
            />
            <StatCard
              title="Completed Sessions"
              value={kpis.completedSessions}
              subtitle="Full Incident Cycles"
              icon={CheckCircle2}
              colorVariant="emerald"
            />
            <StatCard
              title="In Progress"
              value={kpis.inProgressSessions}
              subtitle="Active Sandboxes"
              icon={Clock}
              colorVariant="amber"
            />
            <StatCard
              title="Average Score"
              value={`${kpis.averageScore}%`}
              subtitle="Evaluated Benchmarks"
              icon={Award}
              colorVariant="indigo"
            />
            <StatCard
              title="Completion Rate"
              value={`${kpis.completionRate}%`}
              subtitle="Initiated vs Finished"
              icon={Activity}
              colorVariant="emerald"
            />
          </div>

          {/* Performance Overview & Bands */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Performance by Violation Type */}
            <Card className="lg:col-span-2">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Performance by Violation Category
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Average evaluation scores across canonical safety hazard types
                    </p>
                  </div>
                  <BarChart3 className="w-4 h-4 text-slate-400" />
                </div>

                {stats?.performanceByViolation && stats.performanceByViolation.length > 0 ? (
                  <div className="space-y-3.5">
                    {stats.performanceByViolation.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">
                            {item.violationType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-slate-500">
                            <strong className="text-slate-900">{item.averageScore}%</strong> avg ({item.completedCount} completed)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.averageScore >= 80
                                ? 'bg-emerald-500'
                                : item.averageScore >= 65
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, item.averageScore))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-slate-400 text-xs">
                    No completed sessions yet. Start a scenario to build your performance profile.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Bands Distribution */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Evaluation Ratings
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Session assessment breakdown</p>
                  </div>
                  <Award className="w-4 h-4 text-slate-400" />
                </div>

                <div className="space-y-2.5">
                  <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-emerald-900">Excellent (≥ 85%)</div>
                      <div className="text-[10px] text-emerald-700">Exceptional response fidelity</div>
                    </div>
                    <span className="text-lg font-extrabold text-emerald-800">
                      {stats?.performanceBands?.EXCELLENT || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-blue-900">Good (70 - 84%)</div>
                      <div className="text-[10px] text-blue-700">Satisfactory protocol compliance</div>
                    </div>
                    <span className="text-lg font-extrabold text-blue-800">
                      {stats?.performanceBands?.GOOD || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-amber-900">Needs Review (&lt; 70%)</div>
                      <div className="text-[10px] text-amber-700">Procedural criteria missed</div>
                    </div>
                    <span className="text-lg font-extrabold text-amber-800">
                      {stats?.performanceBands?.NEEDS_IMPROVEMENT || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Incomplete</div>
                      <div className="text-[10px] text-slate-500">Abandoned sessions</div>
                    </div>
                    <span className="text-lg font-extrabold text-slate-700">
                      {stats?.performanceBands?.INCOMPLETE || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Training Sessions Table */}
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Recent Training Sessions
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Latest simulated incident handling activity
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/training/history')}
                  className="flex items-center gap-1 text-xs"
                >
                  <span>View All History</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>

              {stats?.recentSessions && stats.recentSessions.length > 0 ? (
                <div className="overflow-x-auto -mx-5 px-5">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session Code</TableHead>
                        <TableHead>Scenario</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recentSessions.map((session) => (
                        <TableRow key={session._id}>
                          <TableCell className="font-mono text-xs font-bold text-slate-900">
                            {session.sessionCode}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-800 text-xs">
                              {session.scenarioSnapshot?.title || session.scenario?.title || 'Safety Scenario'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {session.scenarioSnapshot?.violationType || session.scenario?.violationType}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(session.status)}</TableCell>
                          <TableCell>
                            {session.status === 'COMPLETED' ? (
                              <span className="font-bold text-slate-900 text-xs">
                                {session.evaluationResult?.totalScore ?? 0} / 100
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {new Date(session.startedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/training/session/${session._id}`)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              {session.status === 'IN_PROGRESS' ? 'Resume' : 'Review'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <EmptyState
                    title="No Training Sessions Yet"
                    description="You haven't attempted any simulated scenarios yet. Browse the library to launch your first session."
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate('/training/scenarios')}
                        className="bg-[var(--color-primary)] text-white mt-2"
                      >
                        Launch First Scenario
                      </Button>
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default TrainingDashboardPage;


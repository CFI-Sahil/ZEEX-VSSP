import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Inbox,
  Calendar,
  Layers,
  ChevronRight,
  ShieldAlert,
  Activity,
  UserCheck,
  Check,
} from 'lucide-react';
import shiftHandoverService from '../../services/shiftHandoverService';
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
import { useAuth } from '../../hooks/useAuth';

export function ShiftHandoverDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dashboardData, setDashboardData] = useState(null);
  const [inboxHandovers, setInboxHandovers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dashRes, inboxRes] = await Promise.all([
        shiftHandoverService.getDashboard(),
        shiftHandoverService.getInbox(),
      ]);

      if (dashRes && dashRes.data) {
        setDashboardData(dashRes.data);
      }
      if (inboxRes && inboxRes.data) {
        setInboxHandovers(inboxRes.data);
      }
    } catch (err) {
      console.error('Failed to load handover dashboard:', err);
      setError('Unable to load shift handover data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const kpis = dashboardData?.kpis || {
    totalHandovers: 0,
    awaitingAckCount: 0,
    acknowledgedCount: 0,
    openFollowUpsCount: 0,
    criticalUnresolvedCount: 0,
    completedCount: 0,
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral" size="sm">Draft</Badge>;
      case 'SUBMITTED':
        return <Badge variant="warning" dot size="sm">Awaiting Ack</Badge>;
      case 'ACKNOWLEDGED':
        return <Badge variant="info" dot size="sm">Acknowledged</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" dot size="sm">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger" size="sm">Cancelled</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
              OPERATIONAL LOGISTICS
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Shift Handover Console
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Structured operational transfer between outgoing and incoming safety operators.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/handovers/inbox')}
            className="flex items-center gap-1.5 relative text-slate-700"
          >
            <Inbox className="w-4 h-4 text-slate-500" />
            <span>Incoming Inbox</span>
            {inboxHandovers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {inboxHandovers.length}
              </span>
            )}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/handovers/create')}
            className="flex items-center gap-1.5 bg-[var(--color-primary)] text-white hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            <span>Create Handover</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" message="Loading handover console..." />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {/* KPI Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              title="Total Handovers"
              value={kpis.totalHandovers}
              subtitle="All Recorded Shifts"
              icon={FileText}
              colorVariant="blue"
              onClick={() => navigate('/handovers/history')}
            />
            <StatCard
              title="Awaiting Ack"
              value={kpis.awaitingAckCount}
              subtitle="Incoming Review"
              icon={Clock}
              colorVariant="amber"
              onClick={() => navigate('/handovers/inbox')}
            />
            <StatCard
              title="Acknowledged"
              value={kpis.acknowledgedCount}
              subtitle="Shift Accepted"
              icon={UserCheck}
              colorVariant="indigo"
            />
            <StatCard
              title="Open Follow-ups"
              value={kpis.openFollowUpsCount}
              subtitle="Pending Actions"
              icon={Activity}
              colorVariant="rose"
            />
            <StatCard
              title="Critical Items"
              value={kpis.criticalUnresolvedCount}
              subtitle="High Risk Handover"
              icon={ShieldAlert}
              colorVariant="rose"
            />
            <StatCard
              title="Completed"
              value={kpis.completedCount}
              subtitle="Closed Handover Cycles"
              icon={CheckCircle2}
              colorVariant="emerald"
            />
          </div>

          {/* Pending Incoming Inbox Highlight (if any waiting for review) */}
          {inboxHandovers.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                      Incoming Handovers Awaiting Your Acknowledgement ({inboxHandovers.length})
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/handovers/inbox')}
                    className="text-xs text-amber-800 hover:text-amber-950"
                  >
                    View All in Inbox &rarr;
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {inboxHandovers.slice(0, 3).map((h) => (
                    <div
                      key={h._id}
                      onClick={() => navigate(`/handovers/${h._id}`)}
                      className="p-3 bg-white rounded-lg border border-amber-200/80 hover:border-amber-400 shadow-2xs cursor-pointer transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {h.handoverCode}
                        </span>
                        <Badge variant="warning" size="sm">Awaiting Review</Badge>
                      </div>
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {h.shiftLabel}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>From: {h.outgoingOperatorName || h.outgoingOperatorEmail}</span>
                        <span className="text-rose-600 font-bold">
                          {h.operationalSummary?.criticalCount || 0} Critical
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Grid: Recent Handovers & Activity Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Recent Handovers Table (8 cols) */}
            <Card className="lg:col-span-8">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Recent Shift Handovers
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Latest recorded shift transfer reports
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/handovers/history')}
                    className="text-xs text-slate-600"
                  >
                    <span>Full History</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {dashboardData?.recentHandovers && dashboardData.recentHandovers.length > 0 ? (
                  <div className="overflow-x-auto -mx-5 px-5">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Shift</TableHead>
                          <TableHead>Outgoing Operator</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboardData.recentHandovers.map((h) => (
                          <TableRow key={h._id} className="hover:bg-slate-50/70">
                            <TableCell className="font-mono text-xs font-bold text-slate-900">
                              {h.handoverCode}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-xs text-slate-800">{h.shiftLabel}</div>
                              <div className="text-[10px] text-slate-400">{h.shiftType} Shift</div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {h.outgoingOperatorName || h.outgoingOperatorEmail}
                            </TableCell>
                            <TableCell>{getStatusBadge(h.status)}</TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {new Date(h.shiftDate || h.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/handovers/${h._id}`)}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                {h.status === 'DRAFT' ? 'Edit Draft' : 'Inspect'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <EmptyState
                    title="No Handovers Recorded"
                    description="No shift handovers have been initiated yet. Create the first handover to establish shift continuity."
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate('/handovers/create')}
                        className="bg-[var(--color-primary)] text-white mt-2"
                      >
                        Create First Handover
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>

            {/* Handover Activity Feed (4 cols) */}
            <Card className="lg:col-span-4">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Handover Audit Activity
                  </h3>
                  <Clock className="w-4 h-4 text-slate-400" />
                </div>

                {dashboardData?.recentActivities && dashboardData.recentActivities.length > 0 ? (
                  <div className="space-y-3 divide-y divide-slate-100">
                    {dashboardData.recentActivities.map((act) => (
                      <div key={act._id} className="pt-2.5 first:pt-0 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">
                            {act.action.replace('HANDOVER_', '').replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] truncate">
                          {act.details?.handoverCode ? `Ref: ${act.details.handoverCode} • ` : ''}
                          By: {act.userEmail}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No recent activity records.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default ShiftHandoverDashboardPage;


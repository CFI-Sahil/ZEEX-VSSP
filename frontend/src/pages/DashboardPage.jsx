import React, { useState, useEffect } from 'react';
import {
  Video,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Radio,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import dashboardService from '../services/dashboardService';
import StatCard from '../components/common/StatCard';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Table, {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/common/Table';

export function DashboardPage() {
  const [data, setData] = useState({
    kpis: {
      totalCameras: 0,
      onlineCameras: 0,
      offlineCameras: 0,
      unknownCameras: 0,
      totalViolations: 0,
      pendingAlerts: 0,
      acknowledgedAlerts: 0,
      resolvedAlerts: 0,
    },
    recentCameras: [],
    recentAlerts: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await dashboardService.getSummary();
      if (response?.data) {
        setData({
          kpis: {
            totalCameras: response.data.kpis?.totalCameras || 0,
            onlineCameras: response.data.kpis?.onlineCameras || 0,
            offlineCameras: response.data.kpis?.offlineCameras || 0,
            unknownCameras: response.data.kpis?.unknownCameras || 0,
            totalViolations: response.data.kpis?.totalViolations || 0,
            pendingAlerts: response.data.kpis?.pendingAlerts || 0,
            acknowledgedAlerts: response.data.kpis?.acknowledgedAlerts || 0,
            resolvedAlerts: response.data.kpis?.resolvedAlerts || 0,
          },
          recentCameras: response.data.recentCameras || [],
          recentAlerts: response.data.recentAlerts || [],
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const getCameraStatusBadge = (status) => {
    switch (status) {
      case 'ONLINE':
        return <Badge variant="success" size="sm" dot>ONLINE</Badge>;
      case 'OFFLINE':
        return <Badge variant="danger" size="sm" dot>OFFLINE</Badge>;
      case 'UNKNOWN':
      default:
        return <Badge variant="warning" size="sm" dot>UNKNOWN</Badge>;
    }
  };

  const getAlertStatusBadge = (status) => {
    switch (status) {
      case 'CLOSED':
        return <Badge variant="success" size="sm" dot>CLOSED</Badge>;
      case 'ACKNOWLEDGED':
        return <Badge variant="info" size="sm" dot>ACKNOWLEDGED</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="warning" size="sm" dot>PENDING</Badge>;
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
      case 'HIGH':
        return <Badge variant="danger" size="sm">{sev}</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning" size="sm">{sev}</Badge>;
      case 'LOW':
      default:
        return <Badge variant="neutral" size="sm">{sev}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-main)] tracking-tight">
            Safety Dashboard
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Dynamic operational overview across registered cameras and detected safety violations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={fetchSummary}
            isLoading={isLoading}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-xs text-rose-800"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to fetch dashboard metrics</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSummary}>
            Retry
          </Button>
        </div>
      )}

      {/* Dynamic Operational KPI Indicators */}
      <div className="space-y-4">
        {/* Fleet Connectivity Indicators */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-slate-400" />
              Camera Fleet Telemetry
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">4 Fleet Indicators</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            <StatCard
              title="Total Cameras"
              value={isLoading ? '...' : String(data.kpis.totalCameras)}
              subtitle="All registered endpoints"
              icon={Video}
              colorVariant="blue"
              badge="Registry"
              data-testid="stat-total-cameras"
            />
            <StatCard
              title="Online Cameras"
              value={isLoading ? '...' : String(data.kpis.onlineCameras)}
              subtitle="Admin marked Online"
              icon={Radio}
              colorVariant="emerald"
              badge="Admin Online"
              data-testid="stat-online-cameras"
            />
            <StatCard
              title="Offline Cameras"
              value={isLoading ? '...' : String(data.kpis.offlineCameras)}
              subtitle="Admin marked Offline"
              icon={AlertTriangle}
              colorVariant="rose"
              badge="Admin Offline"
              data-testid="stat-offline-cameras"
            />
            <StatCard
              title="Unknown Cameras"
              value={isLoading ? '...' : String(data.kpis.unknownCameras)}
              subtitle="Unverified telemetry"
              icon={Clock}
              colorVariant="amber"
              badge="Default"
              data-testid="stat-unknown-cameras"
            />
          </div>
        </div>

        {/* Safety Incident & Lifecycle Indicators */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
              Safety Incidents & Resolution
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">3 Lifecycle Indicators</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
            <StatCard
              title="Total Violations"
              value={isLoading ? '...' : String(data.kpis.totalViolations)}
              subtitle="All detected events"
              icon={AlertTriangle}
              colorVariant="rose"
              badge="Audit Trail"
              data-testid="stat-total-violations"
            />
            <StatCard
              title="Pending Alerts"
              value={isLoading ? '...' : String(data.kpis.pendingAlerts)}
              subtitle="Awaiting operator review"
              icon={Clock}
              colorVariant="amber"
              badge="Action Needed"
              data-testid="stat-pending-alerts"
            />
            <StatCard
              title="Resolved Alerts"
              value={isLoading ? '...' : String(data.kpis.resolvedAlerts)}
              subtitle="Closed with remarks"
              icon={CheckCircle2}
              colorVariant="emerald"
              badge="Audited"
              className="col-span-2 sm:col-span-1"
              data-testid="stat-resolved-alerts"
            />
          </div>
        </div>
      </div>

      {/* Camera Monitoring Points Panel */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Camera Monitoring Points</CardTitle>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Registered camera points showing administrative status and honest stream state (UNAVAILABLE).
            </p>
          </div>
          <Link to="/cameras">
            <Button variant="ghost" size="sm" icon={ExternalLink}>
              Manage Cameras
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner message="Loading registered camera points..." className="py-12" />
          ) : data.recentCameras.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={Video}
                title="No surveillance cameras registered"
                description="Cameras added to the registry will appear here with honest stream connection state."
                action={
                  <Link to="/cameras">
                    <Button variant="primary" size="sm">
                      Go to Camera Registry
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.recentCameras.map((cam) => (
                <div
                  key={cam._id}
                  className="rounded-lg border border-[var(--color-border)] overflow-hidden bg-slate-900 text-white flex flex-col shadow-2xs"
                  data-testid={`camera-tile-${cam.cameraCode}`}
                >
                  <div className="h-36 sm:h-44 bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-4 relative text-center">
                    <Video className="w-7 h-7 sm:w-8 sm:h-8 text-slate-600 mb-1.5" />
                    <p className="text-xs font-semibold text-slate-300 truncate max-w-[80%]">{cam.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Stream: <span className="text-slate-300 font-medium">{cam.streamStatus || 'UNAVAILABLE'}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">
                      No live RTSP integration in 20% MVP
                    </p>
                    <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 flex items-center gap-1 sm:gap-1.5">
                      <Badge variant="neutral" size="sm">
                        Stream: {cam.streamStatus || 'UNAVAILABLE'}
                      </Badge>
                      {getCameraStatusBadge(cam.status)}
                    </div>
                  </div>
                  <div className="p-2.5 sm:p-3 bg-slate-900 flex items-center justify-between text-xs border-t border-slate-800">
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold text-white font-mono">{cam.cameraCode}</span>
                      <span className="text-slate-400 ml-2 truncate">
                        {cam.site} · {cam.location}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {cam.lastSeenAt ? new Date(cam.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'null (No telemetry)'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Safety Alerts Table */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recent Safety Alerts</CardTitle>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Live detection events awaiting review or audit closure.
            </p>
          </div>
          <Link to="/alerts">
            <Button variant="outline" size="sm" icon={ExternalLink} data-testid="view-all-alerts-btn">
              View All Alerts
            </Button>
          </Link>
        </CardHeader>
        {isLoading ? (
          <LoadingSpinner message="Loading recent safety alerts..." className="py-12" />
        ) : data.recentAlerts.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={AlertTriangle}
              title="No safety alerts detected"
              description="When detection events occur, recent safety violations will appear here."
              action={
                <Link to="/alerts">
                  <Button variant="primary" size="sm">
                    Open Alerts Console
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div>
            {/* Mobile Card View (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {data.recentAlerts.map((alert) => (
                <div
                  key={alert._id}
                  className="p-3.5 space-y-2 hover:bg-slate-50/60 transition-colors"
                  data-testid={`dashboard-recent-alert-${alert.alertCode}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--color-primary)]">
                      {alert.alertCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {getSeverityBadge(alert.severity)}
                      {getAlertStatusBadge(alert.status)}
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-900 text-xs block">
                      {alert.violationName}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)] mt-0.5 block">
                      {alert.camera?.cameraCode || alert.cameraCode} · {alert.camera?.name || alert.location}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                    <span>
                      Confidence: <strong className="font-mono text-slate-700">{(alert.confidence * 100).toFixed(1)}%</strong>
                    </span>
                    <span>
                      {alert.detectedAt ? new Date(alert.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alert ID</TableHead>
                    <TableHead>Violation Type</TableHead>
                    <TableHead>Camera / Zone</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detected Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentAlerts.map((alert) => (
                    <TableRow key={alert._id} data-testid={`dashboard-recent-alert-table-${alert.alertCode}`}>
                      <TableCell className="font-mono text-xs font-semibold text-[var(--color-primary)]">
                        {alert.alertCode}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-slate-900 block">{alert.violationName}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-slate-800">{alert.camera?.cameraCode || alert.cameraCode}</span>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          {alert.camera?.name || alert.location}
                        </p>
                      </TableCell>
                      <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {(alert.confidence * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell>{getAlertStatusBadge(alert.status)}</TableCell>
                      <TableCell className="text-xs text-[var(--color-text-muted)]">
                        {alert.detectedAt ? new Date(alert.detectedAt).toLocaleTimeString() : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default DashboardPage;

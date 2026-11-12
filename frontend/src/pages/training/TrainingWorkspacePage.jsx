import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Camera,
  MapPin,
  Building2,
  HardHat,
  ChevronRight,
  ArrowLeft,
  Award,
  Play,
  RotateCcw,
  ZoomIn,
  Send,
  Save,
  XCircle,
  FileText,
  HelpCircle,
} from 'lucide-react';
import trainingService from '../../services/trainingService';
import Card, { CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import TrainingModeBanner from '../../components/training/TrainingModeBanner';
import TrainingResultsModal from '../../components/training/TrainingResultsModal';
import { useAuth } from '../../hooks/useAuth';

export function TrainingWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Workflow Action Form States
  const [ackRemarks, setAckRemarks] = useState('');
  const [assessedViolation, setAssessedViolation] = useState('');
  const [assessedSeverity, setAssessedSeverity] = useState('');
  const [immediateResponse, setImmediateResponse] = useState('');
  const [correctiveCategory, setCorrectiveCategory] = useState('');
  const [correctiveRemarks, setCorrectiveRemarks] = useState('');
  const [resolutionRemarks, setResolutionRemarks] = useState('');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  // Live Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const fetchSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await trainingService.getSessionById(id);
      if (res && res.data) {
        const s = res.data;
        setSession(s);

        // Populate form if previously saved
        if (s.simulatedAlert?.acknowledgedRemarks) {
          setAckRemarks(s.simulatedAlert.acknowledgedRemarks);
        }
        if (s.operatorAssessment) {
          setAssessedViolation(s.operatorAssessment.assessedViolationType || '');
          setAssessedSeverity(s.operatorAssessment.assessedSeverity || '');
          setImmediateResponse(s.operatorAssessment.selectedImmediateResponse || '');
          setCorrectiveCategory(s.operatorAssessment.correctiveActionCategory || '');
          setCorrectiveRemarks(s.operatorAssessment.correctiveActionRemarks || '');
        }
        if (s.simulatedAlert?.resolutionRemarks) {
          setResolutionRemarks(s.simulatedAlert.resolutionRemarks);
        }

        if (s.status === 'COMPLETED') {
          setElapsedSeconds(s.durationSeconds || 0);
          setShowResultsModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to load training session:', err);
      setError(err.response?.data?.message || 'Failed to load training session');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [id]);

  // Elapsed Timer Effect for active sessions
  useEffect(() => {
    if (!session || session.status !== 'IN_PROGRESS') return;

    const startTime = new Date(session.startedAt).getTime();
    const updateTimer = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - startTime) / 1000)));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const showFeedback = (msg) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  // 1. Acknowledge Action
  const handleAcknowledge = async () => {
    setIsSubmitting(true);
    try {
      const res = await trainingService.acknowledgeSession(id, ackRemarks);
      if (res && res.data) {
        setSession(res.data);
        showFeedback('Simulated alert acknowledged successfully.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to acknowledge alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Assess Action
  const handleSaveAssessment = async () => {
    if (!assessedViolation || !assessedSeverity || !immediateResponse) {
      alert('Please select violation type, severity level, and immediate response protocol.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await trainingService.assessSession(id, {
        assessedViolationType: assessedViolation,
        assessedSeverity,
        selectedImmediateResponse: immediateResponse,
        correctiveActionCategory: correctiveCategory || 'PPE_COMPLIANCE_ISSUANCE',
        correctiveActionRemarks: correctiveRemarks,
      });
      if (res && res.data) {
        setSession(res.data);
        showFeedback('Operator assessment saved.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save assessment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Corrective Action
  const handleSaveCorrective = async () => {
    if (!correctiveCategory) {
      alert('Please select a corrective action category.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await trainingService.recordCorrectiveAction(id, {
        correctiveActionCategory: correctiveCategory,
        correctiveActionRemarks: correctiveRemarks,
      });
      if (res && res.data) {
        setSession(res.data);
        showFeedback('Corrective action plan saved.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save corrective action');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Complete Session & Evaluate
  const handleCompleteSession = async () => {
    if (!resolutionRemarks || resolutionRemarks.trim().length < 5) {
      alert('Resolution remarks must be at least 5 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await trainingService.completeSession(id, resolutionRemarks);
      if (res && res.data) {
        setSession(res.data);
        setShowResultsModal(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete training session');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Abandon Session
  const handleAbandonSession = async () => {
    setIsSubmitting(true);
    try {
      const res = await trainingService.abandonSession(id);
      if (res && res.data) {
        setSession(res.data);
        setShowAbandonModal(false);
        navigate('/training/history');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to abandon session');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" message="Loading simulated incident environment..." />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold">Unable to Access Training Session</h2>
          <p className="text-xs text-rose-700">{error || 'Session not found or inaccessible.'}</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/training/scenarios')}>
            Return to Scenarios
          </Button>
        </div>
      </div>
    );
  }

  const scenario = session.scenarioSnapshot || session.scenario || {};
  const alertCtx = scenario.simulatedAlertContext || {};
  const evidence = scenario.simulatedEvidence || {};
  const isCompleted = session.status === 'COMPLETED';
  const isAbandoned = session.status === 'ABANDONED';
  const isAcknowledged = Boolean(session.simulatedAlert?.acknowledgedAt);

  const durationMin = Math.floor(elapsedSeconds / 60);
  const durationSec = elapsedSeconds % 60;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Simulation Banner */}
      <TrainingModeBanner />

      {/* Top Workspace Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/training/scenarios')}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            aria-label="Back to scenarios"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-500">
                {session.sessionCode}
              </span>
              {session.status === 'COMPLETED' ? (
                <Badge variant="success" size="sm" dot>Completed</Badge>
              ) : session.status === 'ABANDONED' ? (
                <Badge variant="danger" size="sm">Abandoned</Badge>
              ) : (
                <Badge variant="warning" size="sm" dot>In Progress</Badge>
              )}
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-0.5">
              {scenario.title || 'Simulated Incident Handling'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          {/* Elapsed Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {String(durationMin).padStart(2, '0')}:{String(durationSec).padStart(2, '0')}
            </span>
          </div>

          {isCompleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResultsModal(true)}
              className="flex items-center gap-1.5 text-xs text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
            >
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              <span>Score: {session.evaluationResult?.totalScore ?? 0}/100</span>
            </Button>
          )}

          {!isCompleted && !isAbandoned && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAbandonModal(true)}
              className="text-xs text-rose-600 hover:bg-rose-50"
            >
              Abandon
            </Button>
          )}
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Incident Context & Evidence (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Simulated CCTV Snapshot Preview */}
          <Card className="overflow-hidden">
            <div className="bg-slate-900 text-white px-3.5 py-2 flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                SIMULATED CCTV FEED
              </span>
              <span className="text-slate-400">{alertCtx.cameraCode || 'CAM-01'}</span>
            </div>

            <div className="relative bg-slate-950 aspect-video flex items-center justify-center overflow-hidden group">
              <img
                src={evidence.fileUrl || '/api/v1/training/evidence-sample/sample-helmet-violation.jpg'}
                alt="Simulated Evidence Snapshot"
                className="w-full h-full object-cover transition-transform group-hover:scale-102"
              />

              <button
                type="button"
                onClick={() => setIsImageZoomed(true)}
                className="absolute bottom-2 right-2 p-1.5 rounded bg-slate-900/80 text-white hover:bg-slate-900 transition-opacity cursor-pointer flex items-center gap-1 text-[11px] px-2"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Zoom</span>
              </button>
            </div>

            <CardContent className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              <p className="italic">
                "{evidence.caption || 'Simulated snapshot captured at work-front boundary.'}"
              </p>
            </CardContent>
          </Card>

          {/* Incident Telemetry Card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Incident Information
                </h3>
                <span className="font-mono text-[11px] text-slate-500 font-bold">
                  {session.simulatedAlert?.alertCode || 'ALT-SIM-001'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase block">Location</span>
                  <span className="font-semibold text-slate-800">{alertCtx.location || 'Bay 1'}</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase block">Camera</span>
                  <span className="font-semibold text-slate-800">{alertCtx.cameraName || alertCtx.cameraCode}</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase block">Work Front</span>
                  <span className="font-semibold text-slate-800">{alertCtx.workFrontName || 'Main Area'}</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase block">Contractor</span>
                  <span className="font-semibold text-slate-800">{alertCtx.contractor || 'General Works'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                <p><strong>Scenario Objective:</strong> {scenario.objective}</p>
              </div>
            </CardContent>
          </Card>

          {/* Scenario Instructions Checklist */}
          {scenario.instructions && scenario.instructions.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Exercise Instructions
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {scenario.instructions.map((inst, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{inst}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Step-by-Step Operator Action Workflow (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Step 1: Acknowledgment Section */}
          <Card className={isAcknowledged ? 'border-emerald-200 bg-emerald-50/20' : ''}>
            <CardContent className="p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    isAcknowledged ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {isAcknowledged ? '✓' : '1'}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Step 1: Operational Acknowledgment
                  </h3>
                </div>
                {isAcknowledged && (
                  <Badge variant="success" size="sm">Acknowledged</Badge>
                )}
              </div>

              <p className="text-xs text-slate-600">
                Acknowledge that you have received this safety alert and initiated investigation.
              </p>

              {!isAcknowledged && !isCompleted && !isAbandoned ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Optional acknowledgment note (e.g. Alert noted, dispatching field supervisor)..."
                    value={ackRemarks}
                    onChange={(e) => setAckRemarks(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={handleAcknowledge}
                    className="flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 text-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Acknowledge Incident Alert</span>
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 bg-white p-2.5 rounded border border-slate-200">
                  <span>Acknowledged at: {session.simulatedAlert?.acknowledgedAt ? new Date(session.simulatedAlert.acknowledgedAt).toLocaleTimeString() : 'N/A'}</span>
                  {session.simulatedAlert?.acknowledgedRemarks && (
                    <p className="text-slate-700 mt-1 italic">"{session.simulatedAlert.acknowledgedRemarks}"</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Assessment Section */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Step 2: Incident Assessment & Immediate Protocol
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Violation Category
                  </label>
                  <select
                    disabled={isCompleted || isAbandoned}
                    value={assessedViolation}
                    onChange={(e) => setAssessedViolation(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select violation...</option>
                    <option value="NO_HELMET">Missing Helmet (PPE)</option>
                    <option value="NO_VEST">Missing Vest (PPE)</option>
                    <option value="UNAUTHORIZED_ZONE">Unauthorized Zone</option>
                    <option value="NO_SAFETY_BOOTS">Footwear Non-Compliance</option>
                    <option value="RESTRICTED_ACCESS">Restricted Access Breach</option>
                    <option value="OTHER">Other Safety Violation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assessed Severity Level
                  </label>
                  <select
                    disabled={isCompleted || isAbandoned}
                    value={assessedSeverity}
                    onChange={(e) => setAssessedSeverity(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select severity...</option>
                    <option value="LOW">LOW — Minor Hazard</option>
                    <option value="MEDIUM">MEDIUM — Moderate Consequence</option>
                    <option value="HIGH">HIGH — High Risk Hazard</option>
                    <option value="CRITICAL">CRITICAL — Imminent Life Safety Threat</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Immediate Response Action
                  </label>
                  <select
                    disabled={isCompleted || isAbandoned}
                    value={immediateResponse}
                    onChange={(e) => setImmediateResponse(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select immediate response...</option>
                    <option value="ISSUE_VERBAL_WARNING">ISSUE_VERBAL_WARNING — Issue direct reminder</option>
                    <option value="STOP_WORK">STOP_WORK — Invoke Stop Work Authority immediately</option>
                    <option value="NOTIFY_SUPERVISOR">NOTIFY_SUPERVISOR — Dispatch area safety supervisor</option>
                    <option value="EVACUATE_ZONE">EVACUATE_ZONE — Order clearance of affected zone</option>
                  </select>
                </div>
              </div>

              {!isCompleted && !isAbandoned && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={handleSaveAssessment}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Assessment</span>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Corrective Action Plan */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Step 3: Corrective Action Plan
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Corrective Action Category
                  </label>
                  <select
                    disabled={isCompleted || isAbandoned}
                    value={correctiveCategory}
                    onChange={(e) => setCorrectiveCategory(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select corrective category...</option>
                    <option value="PPE_COMPLIANCE_ISSUANCE">PPE_COMPLIANCE_ISSUANCE — Issue mandatory PPE equipment</option>
                    <option value="RESTRICT_ACCESS_BARRICADE">RESTRICT_ACCESS_BARRICADE — Lockout or barricade perimeter</option>
                    <option value="TOOLBOX_TALK">TOOLBOX_TALK — Deliver field safety briefing</option>
                    <option value="CONTRACTOR_PENALTY">CONTRACTOR_PENALTY — Enforce contractor compliance penalty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Corrective Action Remarks / Implementation Notes
                  </label>
                  <textarea
                    rows={2}
                    disabled={isCompleted || isAbandoned}
                    placeholder="Document root cause mitigation (min 10 characters recommended)..."
                    value={correctiveRemarks}
                    onChange={(e) => setCorrectiveRemarks(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {!isCompleted && !isAbandoned && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={handleSaveCorrective}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Corrective Plan</span>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Step 4: Resolution & Evaluation Submission */}
          <Card className="border-blue-200 bg-blue-50/15">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-bold">
                    4
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Step 4: Incident Resolution & Completion
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Resolution Handover Remarks <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    disabled={isCompleted || isAbandoned}
                    placeholder="Provide formal closure remarks detailing verification, field confirmation and handover (minimum 5 chars, 15+ recommended)..."
                    value={resolutionRemarks}
                    onChange={(e) => setResolutionRemarks(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <div className="text-[10px] text-slate-500 flex justify-between mt-1">
                    <span>Target length: ≥ 15 characters</span>
                    <span>Length: {resolutionRemarks.length} chars</span>
                  </div>
                </div>

                {!isCompleted && !isAbandoned ? (
                  <Button
                    variant="primary"
                    size="md"
                    disabled={isSubmitting || resolutionRemarks.trim().length < 5}
                    onClick={handleCompleteSession}
                    className="w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white font-bold text-sm py-2.5 hover:opacity-90 shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span>Complete Incident & Calculate Score</span>
                  </Button>
                ) : (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">Training Session Concluded</span>
                      <p className="text-[11px] text-slate-500">Evaluation results are permanently archived.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowResultsModal(true)}
                      className="text-xs text-blue-600"
                    >
                      View Results Modal
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Evaluation Results Modal */}
      <TrainingResultsModal
        isOpen={showResultsModal}
        onClose={() => setShowResultsModal(false)}
        session={session}
        onRestartScenario={() => {
          setShowResultsModal(false);
          trainingService.startSession(scenario._id).then((res) => {
            if (res?.data?._id) navigate(`/training/session/${res.data._id}`);
          });
        }}
        onNavigateDashboard={() => navigate('/training')}
        onNavigateHistory={() => navigate('/training/history')}
      />

      {/* Image Zoom Modal */}
      {isImageZoomed && (
        <Modal
          isOpen={isImageZoomed}
          onClose={() => setIsImageZoomed(false)}
          title="Simulated CCTV Evidence Detail"
          size="xl"
        >
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
              <img
                src={evidence.fileUrl || '/api/v1/training/evidence-sample/sample-helmet-violation.jpg'}
                alt="Enlarged Evidence"
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
            <div className="text-xs text-slate-600 flex items-center justify-between px-1">
              <span>{evidence.caption || 'Simulated snapshot'}</span>
              <span className="font-mono text-slate-400">{alertCtx.cameraCode}</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Abandon Confirmation Modal */}
      {showAbandonModal && (
        <Modal
          isOpen={showAbandonModal}
          onClose={() => setShowAbandonModal(false)}
          title="Abandon Training Session?"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to abandon this training exercise? The session will be marked as INCOMPLETE and archived in your training history.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAbandonModal(false)}
              >
                Continue Training
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isSubmitting}
                onClick={handleAbandonSession}
              >
                Yes, Abandon Session
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default TrainingWorkspacePage;


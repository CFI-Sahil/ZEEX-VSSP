import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Clock,
  ArrowRight,
  RotateCcw,
  BookOpen,
  LayoutDashboard,
  Check,
} from 'lucide-react';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { cn } from '../../utils/cn';

export function TrainingResultsModal({
  isOpen,
  onClose,
  session,
  onRestartScenario,
  onNavigateDashboard,
  onNavigateHistory,
}) {
  if (!session) return null;

  const evaluation = session.evaluationResult || {};
  const breakdown = evaluation.scoreBreakdown || {};
  const totalScore = evaluation.totalScore ?? 0;
  const passed = evaluation.passed;
  const band = evaluation.performanceBand || 'NEEDS_IMPROVEMENT';

  const bandConfigs = {
    EXCELLENT: {
      label: 'Excellent Response',
      color: 'emerald',
      badgeVariant: 'success',
      bgClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      icon: Award,
    },
    GOOD: {
      label: 'Good Response',
      color: 'blue',
      badgeVariant: 'info',
      bgClass: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: Award,
    },
    NEEDS_IMPROVEMENT: {
      label: 'Needs Improvement',
      color: 'amber',
      badgeVariant: 'warning',
      bgClass: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: AlertTriangle,
    },
    INCOMPLETE: {
      label: 'Incomplete Session',
      color: 'rose',
      badgeVariant: 'danger',
      bgClass: 'bg-rose-50 border-rose-200 text-rose-800',
      icon: XCircle,
    },
  };

  const currentBand = bandConfigs[band] || bandConfigs.NEEDS_IMPROVEMENT;
  const BandIcon = currentBand.icon;

  const criteriaItems = [
    {
      title: 'Violation Identification',
      earned: breakdown.violationScore ?? 0,
      max: session.scenarioSnapshot?.expectedEvaluation?.weights?.violationId ?? 20,
      description: 'Accurately recognized canonical hazard category',
    },
    {
      title: 'Severity Assessment',
      earned: breakdown.severityScore ?? 0,
      max: session.scenarioSnapshot?.expectedEvaluation?.weights?.severity ?? 20,
      description: 'Matched incident consequence level',
    },
    {
      title: 'Operational Acknowledgment',
      earned: breakdown.ackScore ?? 0,
      max: session.scenarioSnapshot?.expectedEvaluation?.weights?.acknowledgment ?? 15,
      description: 'Acknowledged incident prior to closure',
    },
    {
      title: 'Immediate Response Protocol',
      earned: breakdown.responseScore ?? 0,
      max: session.scenarioSnapshot?.expectedEvaluation?.weights?.immediateResponse ?? 15,
      description: 'Selected scenario-appropriate initial action',
    },
    {
      title: 'Corrective Action Plan',
      earned: breakdown.correctiveScore ?? 0,
      max: session.scenarioSnapshot?.expectedEvaluation?.weights?.correctiveAction ?? 20,
      description: 'Recorded root-cause mitigation and documentation',
    },
    {
      title: 'Resolution Remarks',
      earned: breakdown.remarksScore ?? 0,
      max: session.scenarioSnapshot?.expectedEvaluation?.weights?.resolutionRemarks ?? 10,
      description: 'Detailed handover and closure documentation',
    },
  ];

  const durationMin = Math.floor((session.durationSeconds || 0) / 60);
  const durationSec = (session.durationSeconds || 0) % 60;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Training Session Evaluation Results"
      size="xl"
    >
      <div className="space-y-6">
        {/* Score Summary Ribbon */}
        <div
          className={cn(
            'p-5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4',
            currentBand.bgClass
          )}
        >
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-14 h-14 rounded-full bg-white/90 shadow-sm flex items-center justify-center shrink-0">
              <BandIcon className="w-7 h-7 text-current" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-xl font-bold tracking-tight">
                  {currentBand.label}
                </span>
                <Badge variant={currentBand.badgeVariant} size="sm">
                  {passed ? 'Passed' : 'Review Required'}
                </Badge>
              </div>
              <p className="text-xs opacity-90 mt-0.5">
                Scenario: {session.scenarioSnapshot?.title || 'Simulated Safety Incident'}
              </p>
              <div className="flex items-center gap-3 text-xs opacity-80 mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Duration: {durationMin}m {durationSec}s
                </span>
                <span>•</span>
                <span>Session: {session.sessionCode}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center sm:items-end bg-white/80 px-5 py-3 rounded-xl border border-current/20 shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Score
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-3xl font-extrabold text-slate-900 leading-none">
                {totalScore}
              </span>
              <span className="text-sm font-semibold text-slate-500">/ 100</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Passing Grade: 70 pts</span>
          </div>
        </div>

        {/* Score Breakdown Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Performance Criteria Breakdown
            </h4>
          </div>
          <div className="divide-y divide-slate-100">
            {criteriaItems.map((item, idx) => {
              const pct = item.max > 0 ? Math.round((item.earned / item.max) * 100) : 0;
              const isFull = item.earned === item.max;
              const isZero = item.earned === 0;

              return (
                <div
                  key={idx}
                  className="px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {item.title}
                      </span>
                      {isFull ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Full Points
                        </span>
                      ) : isZero ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                          Missed
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          Partial
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <div className="w-24 bg-slate-100 rounded-full h-2 hidden sm:block overflow-hidden border border-slate-200">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          isFull
                            ? 'bg-emerald-500'
                            : isZero
                            ? 'bg-rose-400'
                            : 'bg-amber-500'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-900 w-16 text-right">
                      {item.earned} <span className="text-xs text-slate-400">/ {item.max}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Feedback & Missed Criteria */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Positive Feedback */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider mb-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Correct Actions & Commendations</span>
            </div>
            {evaluation.feedback && evaluation.feedback.length > 0 ? (
              <ul className="space-y-1.5 text-xs text-slate-700">
                {evaluation.feedback.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">No positive actions recorded.</p>
            )}
          </div>

          {/* Missed Criteria / Areas to Improve */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider mb-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Areas for Improvement</span>
            </div>
            {evaluation.missedCriteria && evaluation.missedCriteria.length > 0 ? (
              <ul className="space-y-1.5 text-xs text-slate-700">
                {evaluation.missedCriteria.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                <Check className="w-4 h-4" /> All benchmark criteria successfully fulfilled!
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateDashboard}
              className="flex items-center gap-1.5 text-slate-700"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateHistory}
              className="flex items-center gap-1.5 text-slate-700"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>History</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {onRestartScenario && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRestartScenario}
                className="flex items-center gap-1.5 text-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
              className="flex items-center gap-1.5 bg-[var(--color-primary)] text-white hover:opacity-90"
            >
              <span>Close Evaluation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default TrainingResultsModal;


import React, { useState } from 'react';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import Button from '../common/Button';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Camera,
  Calendar,
  Clock,
  Shield,
  Layers,
  FileCode,
  Copy,
  Check,
  User,
  Cpu,
  ExternalLink,
  Play,
} from 'lucide-react';

export function EventDetailModal({
  isOpen,
  onClose,
  event,
  onProcessEvent,
  isProcessing = false,
}) {
  const [copied, setCopied] = useState(false);

  if (!event) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(event.payload || {}, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAccepted = event.status === 'ACCEPTED';
  const isRejected = event.status === 'REJECTED';
  const isProcessed = Boolean(event.processedByRuleEngine);
  const isFailed = event.processingStatus === 'FAILED';

  const severityVariant = {
    LOW: 'neutral',
    MEDIUM: 'warning',
    HIGH: 'danger',
    CRITICAL: 'danger',
  }[event.severity] || 'neutral';

  const associatedAlertCode =
    event.associatedAlert?.alertCode ||
    (typeof event.associatedAlert === 'string' ? event.associatedAlert : null);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detection Event: ${event.eventId}`}
      description="Traceable inspection of incoming safety detection event, camera validation, and rule processing."
      maxWidth="max-w-2xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3">
          <div className="flex items-center gap-2">
            <Badge
              variant={isAccepted ? 'success' : isRejected ? 'danger' : 'neutral'}
              dot
            >
              Intake: {event.status}
            </Badge>
            <span className="text-[11px] text-slate-500">
              {event.source === 'DEMO' ? 'Simulation / Demo Pipeline' : 'Future External Integration Boundary'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAccepted && !isProcessed && onProcessEvent && (
              <Button
                variant="primary"
                size="sm"
                icon={Play}
                onClick={() => onProcessEvent(event)}
                isLoading={isProcessing}
                data-testid="modal-process-event-btn"
              >
                Process Event Now
              </Button>
            )}

            {isProcessed && associatedAlertCode && (
              <a
                href={`/alerts?search=${associatedAlertCode}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Alert {associatedAlertCode}</span>
              </a>
            )}

            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Status & Outcome Banner */}
        {isAccepted ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-800">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Event Accepted by Intake Gate</p>
              <p className="mt-0.5 text-emerald-700">
                Payload validated against active registered camera fleet and canonical detection registry.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="w-full">
              <p className="font-semibold">Event Rejected at Intake Gate</p>
              <p className="mt-0.5 text-rose-700 font-medium">
                {event.rejectionReason || 'Payload failed schema or camera fleet validation.'}
              </p>
              {event.validationErrors && event.validationErrors.length > 0 && (
                <div className="mt-2 space-y-1 bg-white/70 p-2 rounded border border-rose-200/60">
                  <p className="text-[10px] font-semibold text-rose-900 uppercase tracking-wider">
                    Validation Diagnostics:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700">
                    {event.validationErrors.map((err, idx) => (
                      <li key={idx}>
                        <span className="font-medium">{err.field}:</span> {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing Failure Diagnostic */}
        {isFailed && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Rule Processing Error</p>
              <p className="mt-0.5 text-rose-700 font-mono text-[11px]">
                {event.processingError || 'An error occurred during rule engine execution.'}
              </p>
            </div>
          </div>
        )}

        {/* Batch 2: Rule Engine Processing & Alert Link Card */}
        {isAccepted && (
          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-blue-200/60 pb-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-blue-900">
                <Cpu className="w-3.5 h-3.5 text-blue-600" />
                <span>Phase 3 Batch 2 · Rule Engine Evaluation</span>
              </div>
              <Badge
                variant={isProcessed ? 'success' : isFailed ? 'danger' : 'warning'}
                size="sm"
                dot
              >
                {isProcessed
                  ? 'COMPLETED'
                  : isFailed
                  ? 'FAILED'
                  : 'PENDING PROCESSING'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 pt-0.5">
              <div>
                <span className="text-slate-500">Processing Status:</span>{' '}
                <span className="font-semibold text-slate-900">
                  {event.processingStatus || (isProcessed ? 'COMPLETED' : 'PENDING')}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Processed At:</span>{' '}
                <span className="font-medium text-slate-800">
                  {event.processedAt ? new Date(event.processedAt).toLocaleString() : 'Not yet processed'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Assigned Severity:</span>{' '}
                <span className="font-semibold text-slate-900">
                  {event.ruleEvaluation?.severityAssigned || event.severity || 'N/A'}
                </span>{' '}
                {event.ruleEvaluation?.severitySource && (
                  <span className="text-[10px] text-slate-500">
                    ({event.ruleEvaluation.severitySource === 'ASSIGNED_FROM_PAYLOAD' ? 'From Payload' : 'Registry Default'})
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500">Operational Enrichment:</span>{' '}
                <span className="font-medium text-slate-800">
                  {event.ruleEvaluation?.isEnriched ? 'Enriched with WorkFront' : 'Unassigned / Default Fallback'}
                </span>
              </div>
              <div className="sm:col-span-2 flex items-center justify-between pt-1 border-t border-blue-100">
                <span className="text-slate-500">Associated Alert:</span>
                {associatedAlertCode ? (
                  <a
                    href={`/alerts?search=${associatedAlertCode}`}
                    className="font-mono font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <span>{associatedAlertCode}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400 italic">No alert generated yet</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Camera Info */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 border-b border-slate-200/80 pb-1.5">
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              <span>Camera Fleet Details</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Camera Code:</span>
                <span className="font-mono font-semibold text-slate-900">{event.cameraCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Camera Name:</span>
                <span className="font-medium text-slate-800">{event.camera?.name || 'Registered Camera'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="text-slate-700">{event.camera?.location || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Stream Status:</span>
                <Badge variant={event.camera?.streamStatus === 'LIVE' ? 'success' : 'neutral'} size="sm">
                  {event.camera?.streamStatus || 'LIVE'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Detection Info */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 border-b border-slate-200/80 pb-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Detection Metadata</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Violation:</span>
                <span className="font-medium text-slate-900">{event.violationName || event.violationType || 'Unspecified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Severity:</span>
                {event.severity ? (
                  <Badge variant={severityVariant} size="sm">
                    {event.severity}
                  </Badge>
                ) : (
                  <span className="text-slate-400">Default (Registry)</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">AI Confidence:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {event.confidence != null ? `${(event.confidence * 100).toFixed(1)}%` : '92.0%'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pipeline Source:</span>
                <span className="text-slate-600 font-medium">
                  {event.source === 'DEMO' ? 'Demo Simulator' : 'External CV (Boundary)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Timestamps & Audit Information */}
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 border-b border-slate-200/80 pb-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Audit & Reception Traceability</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-slate-600">
            <div>
              <span className="text-slate-500">Received Time:</span>{' '}
              <span className="font-medium text-slate-800">
                {event.receivedAt ? new Date(event.receivedAt).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Occurred Time:</span>{' '}
              <span className="font-medium text-slate-800">
                {event.occurredAt ? new Date(event.occurredAt).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Submitted By:</span>{' '}
              <span className="font-medium text-slate-800">
                {event.submittedBy?.name || event.submittedBy?.email || 'System / Simulator'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Client IP:</span>{' '}
              <span className="font-mono text-slate-700">{event.ipAddress || '127.0.0.1'}</span>
            </div>
          </div>
        </div>

        {/* Sanitized Payload Viewer */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-slate-500" />
              Sanitized Raw Payload Snapshot
            </span>
            <button
              type="button"
              onClick={handleCopyJson}
              className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-[11px] font-mono overflow-x-auto max-h-40 leading-relaxed">
            {JSON.stringify(event.payload || {}, null, 2)}
          </pre>
        </div>
      </div>
    </Modal>
  );
}

export default EventDetailModal;

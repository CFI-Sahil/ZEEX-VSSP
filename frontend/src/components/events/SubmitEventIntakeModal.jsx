import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { Send, AlertCircle, Sparkles, CheckCircle, RefreshCw } from 'lucide-react';

const CANONICAL_VIOLATIONS = [
  { value: 'NO_HELMET', label: 'Missing Safety Helmet (PPE)' },
  { value: 'NO_VEST', label: 'Missing High-Vis Vest (PPE)' },
  { value: 'UNAUTHORIZED_ZONE', label: 'Unauthorized Zone Entry (Perimeter)' },
  { value: 'NO_SAFETY_BOOTS', label: 'Missing Protective Footwear (PPE)' },
  { value: 'RESTRICTED_ACCESS', label: 'Restricted Facility Breach (Access)' },
  { value: 'OTHER', label: 'General Safety Non-Compliance (General)' },
];

export function SubmitEventIntakeModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  cameras = [],
}) {
  const [formData, setFormData] = useState({
    eventId: '',
    cameraCode: cameras[0]?.cameraCode || 'CAM-001',
    violationType: 'NO_HELMET',
    severity: 'HIGH',
    confidence: 0.94,
    description: 'Autonomous vision inference: Worker detected without mandated PPE helmet.',
  });

  const [submissionFeedback, setSubmissionFeedback] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'confidence' ? parseFloat(value) : value,
    }));
  };

  const applyPreset = (presetType) => {
    setError(null);
    setSubmissionFeedback(null);

    switch (presetType) {
      case 'VALID':
        setFormData({
          eventId: '',
          cameraCode: cameras[0]?.cameraCode || 'CAM-001',
          violationType: 'NO_HELMET',
          severity: 'HIGH',
          confidence: 0.94,
          description: 'Standard valid detection event across active monitoring point.',
        });
        break;
      case 'INVALID_CAMERA':
        setFormData((prev) => ({
          ...prev,
          cameraCode: 'CAM-NON-EXISTENT-999',
          description: 'Simulation probe testing rejection handling for non-existent camera.',
        }));
        break;
      case 'UNSUPPORTED_TYPE':
        setFormData((prev) => ({
          ...prev,
          violationType: 'MAGIC_UNSUPPORTED_TYPE_XYZ',
          description: 'Simulation probe testing canonical registry rejection for unapproved violation type.',
        }));
        break;
      case 'DUPLICATE_ID':
        setFormData((prev) => ({
          ...prev,
          eventId: 'EVT-DUP-TEST-001',
          description: 'Simulation probe testing 409 conflict replay defense.',
        }));
        break;
      default:
        break;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmissionFeedback(null);

    try {
      const payload = {
        ...formData,
        cameraCode: formData.cameraCode.trim().toUpperCase(),
      };
      if (!payload.eventId.trim()) {
        delete payload.eventId;
      }

      const res = await onSubmit(payload);
      setSubmissionFeedback({
        type: 'SUCCESS',
        message: res?.message || 'Event accepted and persisted in intake registry.',
        eventId: res?.data?.eventId || res?.data?.event?.eventId,
      });

      // Keep modal open briefly to show accepted feedback, then allow close
    } catch (err) {
      setError(err.message || 'Intake submission rejected');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Detection Event (Intake Simulator)"
      description="Inject an event payload into the Batch 1 intake pipeline to test schema validation, camera verification, and rejection handling."
      maxWidth="max-w-xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="submit-intake-form"
            icon={Send}
            isLoading={isLoading}
            data-testid="submit-intake-event-btn"
          >
            Submit to Intake
          </Button>
        </div>
      }
    >
      <form id="submit-intake-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Banner Alert */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-xs text-blue-800">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Phase 3 Batch 1 Scope Boundary Active</p>
            <p className="mt-0.5 text-blue-700">
              Accepted events are recorded in the intake collection only. No safety alerts or evidence snapshots are generated during Batch 1.
            </p>
          </div>
        </div>

        {/* Error Feedback */}
        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Event Intake Rejection</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* Success Feedback */}
        {submissionFeedback && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Intake Accepted (Status: ACCEPTED)</p>
              <p className="mt-0.5 text-emerald-700">{submissionFeedback.message}</p>
              {submissionFeedback.eventId && (
                <p className="mt-1 font-mono text-[11px] text-emerald-900 font-semibold">
                  Event ID: {submissionFeedback.eventId}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Quick Test Presets */}
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
            Verification Test Presets
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset('VALID')}
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
            >
              Normal Valid Event
            </button>
            <button
              type="button"
              onClick={() => applyPreset('INVALID_CAMERA')}
              className="px-2.5 py-1 text-xs bg-white border border-amber-300 rounded hover:bg-amber-50 text-amber-800 cursor-pointer transition-colors"
            >
              Test Invalid Camera (422)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('UNSUPPORTED_TYPE')}
              className="px-2.5 py-1 text-xs bg-white border border-rose-300 rounded hover:bg-rose-50 text-rose-800 cursor-pointer transition-colors"
            >
              Test Invalid Type (400)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('DUPLICATE_ID')}
              className="px-2.5 py-1 text-xs bg-white border border-purple-300 rounded hover:bg-purple-50 text-purple-800 cursor-pointer transition-colors"
            >
              Test Duplicate Event ID (409)
            </button>
          </div>
        </div>

        {/* Camera Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-800">
            Camera Source <span className="text-rose-500">*</span>
          </label>
          <div className="mt-1 flex gap-2">
            <select
              name="cameraCode"
              value={formData.cameraCode}
              onChange={handleChange}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {cameras.map((c) => (
                <option key={c._id} value={c.cameraCode}>
                  {c.cameraCode} — {c.name} ({c.site} / {c.location}) [{c.streamStatus}]
                </option>
              ))}
              <option value="CAM-NON-EXISTENT-999">CAM-NON-EXISTENT-999 (Probe Testing)</option>
            </select>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Registered active cameras are accepted regardless of live stream connectivity status.
          </p>
        </div>

        {/* Violation Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-800">
              Violation Type <span className="text-rose-500">*</span>
            </label>
            <select
              name="violationType"
              value={formData.violationType}
              onChange={handleChange}
              className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {CANONICAL_VIOLATIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
              <option value="MAGIC_UNSUPPORTED_TYPE_XYZ">MAGIC_UNSUPPORTED_TYPE_XYZ (Registry Test)</option>
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-semibold text-slate-800">
              Severity Level <span className="text-rose-500">*</span>
            </label>
            <select
              name="severity"
              value={formData.severity}
              onChange={handleChange}
              className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>
        </div>

        {/* Optional Custom Event ID & Confidence */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-800">
              Custom Event ID <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              name="eventId"
              value={formData.eventId}
              onChange={handleChange}
              placeholder="e.g. EVT-CUSTOM-001 (Blank = Auto)"
              className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-800">Inference Confidence</label>
              <span className="text-xs font-mono font-medium text-slate-700">
                {(formData.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              name="confidence"
              min="0.50"
              max="1.00"
              step="0.01"
              value={formData.confidence}
              onChange={handleChange}
              className="mt-2 w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-800">Incident Description</label>
          <textarea
            name="description"
            rows="2"
            value={formData.description}
            onChange={handleChange}
            className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}

export default SubmitEventIntakeModal;


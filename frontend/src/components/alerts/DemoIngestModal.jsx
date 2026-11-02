import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { Play, AlertCircle, Sparkles } from 'lucide-react';

export function DemoIngestModal({ isOpen, onClose, onSimulate, isLoading = false, cameras = [] }) {
  const [formData, setFormData] = useState({
    cameraCode: cameras[0]?.cameraCode || 'CAM-001',
    violationType: 'NO_HELMET',
    severity: 'HIGH',
    confidence: 0.94,
    description: 'Worker in assembly line detected without mandated safety helmet',
  });
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'confidence' ? parseFloat(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await onSimulate(formData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to simulate detection event');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Simulate Detection Event (Dev Tool)"
      description="Inject an automated AI/CV detection event into the alert pipeline to verify ingestion and review workflows."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="demo-ingest-form"
            icon={Play}
            isLoading={isLoading}
            data-testid="submit-simulate-event-btn"
          >
            Trigger Event
          </Button>
        </>
      }
    >
      <form id="demo-ingest-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-xs text-blue-800">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            This demo simulator simulates the external AI/CV event contract boundary. This endpoint is disabled in production.
          </p>
        </div>

        {/* Camera Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-800">Camera Source</label>
          <select
            name="cameraCode"
            value={formData.cameraCode}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            data-testid="simulate-camera-select"
          >
            {cameras.length > 0 ? (
              cameras.map((c) => (
                <option key={c._id} value={c.cameraCode}>
                  {c.cameraCode} — {c.name} ({c.site})
                </option>
              ))
            ) : (
              <option value="CAM-001">CAM-001 — Primary Monitoring Point</option>
            )}
          </select>
        </div>

        {/* Violation Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-800">Violation Type</label>
            <select
              name="violationType"
              value={formData.violationType}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              data-testid="simulate-type-select"
            >
              <option value="NO_HELMET">Missing Safety Helmet</option>
              <option value="NO_VEST">Missing High-Vis Vest</option>
              <option value="UNAUTHORIZED_ZONE">Unauthorized Zone Entry</option>
              <option value="NO_SAFETY_BOOTS">Missing Safety Boots</option>
              <option value="RESTRICTED_ACCESS">Restricted Area Breach</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800">Severity</label>
            <select
              name="severity"
              value={formData.severity}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              data-testid="simulate-severity-select"
            >
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>

        {/* AI Confidence */}
        <div>
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-800">AI Confidence Score</span>
            <span className="font-mono text-blue-600 font-bold">
              {(formData.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            name="confidence"
            min="0.5"
            max="1.0"
            step="0.01"
            value={formData.confidence}
            onChange={handleChange}
            className="mt-1 w-full accent-blue-600 cursor-pointer"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-800">Detection Notes</label>
          <input
            type="text"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Incident contextual notes..."
            className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          />
        </div>
      </form>
    </Modal>
  );
}

export default DemoIngestModal;


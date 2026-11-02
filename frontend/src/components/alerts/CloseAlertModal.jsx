import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function CloseAlertModal({ isOpen, onClose, onConfirm, alert = null, isLoading = false }) {
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    setRemarks('');
    setError(null);
  }, [isOpen, alert]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!remarks.trim() || remarks.trim().length < 3) {
      setError('Closure remarks are mandatory and must be at least 3 characters.');
      return;
    }

    try {
      await onConfirm(remarks.trim());
    } catch (err) {
      setError(err.message || 'Failed to close alert');
    }
  };

  if (!alert) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Close Safety Alert: ${alert.alertCode}`}
      description="Record audited resolution remarks before marking this violation as closed."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="close-alert-form"
            icon={CheckCircle2}
            isLoading={isLoading}
            data-testid="submit-close-alert-btn"
          >
            Confirm & Close Alert
          </Button>
        </>
      }
    >
      <form id="close-alert-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
          <p className="font-semibold text-slate-800">{alert.violationName}</p>
          <p className="text-slate-500">
            Event ID: <span className="font-mono text-slate-700">{alert.eventId}</span> · Camera: <span className="font-medium text-slate-700">{alert.cameraCode}</span>
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-800">
            Resolution Remarks & Corrective Actions <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Document corrective action taken, PPE issued, or supervisor clearance details..."
            className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            data-testid="close-remarks-input"
            required
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Mandatory audit trail requirement. Minimum 3 characters.
          </p>
        </div>
      </form>
    </Modal>
  );
}

export default CloseAlertModal;


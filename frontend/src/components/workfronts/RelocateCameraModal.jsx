import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import LoadingSpinner from '../common/LoadingSpinner';
import workFrontService from '../../services/workFrontService';
import { Video, ArrowRight, AlertCircle, Building2, HardHat, ShieldAlert } from 'lucide-react';

export function RelocateCameraModal({
  isOpen,
  onClose,
  camera,
  sourceWorkFront,
  onCameraRelocated,
}) {
  const [destinationWorkFronts, setDestinationWorkFronts] = useState([]);
  const [selectedDestId, setSelectedDestId] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (isOpen && camera && sourceWorkFront) {
      setSelectedDestId('');
      setReason('');
      setErrorMessage(null);
      setIsLoading(true);

      workFrontService
        .getWorkFronts({ limit: 50 })
        .then((res) => {
          if (res?.data?.workFronts) {
            // Eligible destination fronts: active/planning/suspended, NOT completed, NOT source front
            const eligible = res.data.workFronts.filter(
              (wf) =>
                wf._id !== sourceWorkFront._id &&
                wf.status !== 'COMPLETED' &&
                wf.isActive !== false
            );
            setDestinationWorkFronts(eligible);
            if (eligible.length > 0) {
              setSelectedDestId(eligible[0]._id);
            }
          } else {
            setDestinationWorkFronts([]);
          }
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Failed to retrieve eligible destination work-fronts');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, camera, sourceWorkFront]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDestId) {
      setErrorMessage('Please select a destination work-front');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await workFrontService.relocateCamera(
        sourceWorkFront._id,
        camera._id,
        selectedDestId,
        reason.trim()
      );
      if (onCameraRelocated) {
        onCameraRelocated(res?.data);
      }
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to relocate camera');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDest = destinationWorkFronts.find((wf) => wf._id === selectedDestId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Relocate Camera: ${camera?.cameraCode || ''}`}
      description="Transfer camera monitoring assignment from its current work-front to an eligible destination front."
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="relocate-camera-form"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isLoading || destinationWorkFronts.length === 0 || !selectedDestId}
          >
            Confirm Relocation
          </Button>
        </div>
      }
    >
      <form id="relocate-camera-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="font-medium flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Relocation Transfer Visualizer */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-amber-400" />
              <span className="font-mono font-bold text-amber-400">{camera?.cameraCode}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-300 font-medium">{camera?.name}</span>
            </div>
            <Badge variant="success" size="sm" dot>
              {camera?.status || 'ONLINE'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            {/* Source Front */}
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Current Source Front</p>
              <p className="font-mono font-bold text-amber-400 text-xs mt-0.5">
                {sourceWorkFront?.workFrontCode}
              </p>
              <p className="text-slate-200 font-medium truncate mt-0.5">{sourceWorkFront?.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{sourceWorkFront?.zone}</p>
            </div>

            {/* Destination Preview */}
            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/50">
              <p className="text-[10px] text-indigo-300 uppercase font-semibold">New Destination Front</p>
              {selectedDest ? (
                <>
                  <p className="font-mono font-bold text-emerald-400 text-xs mt-0.5">
                    {selectedDest.workFrontCode}
                  </p>
                  <p className="text-white font-medium truncate mt-0.5">{selectedDest.name}</p>
                  <p className="text-[10px] text-indigo-200 truncate">{selectedDest.zone}</p>
                </>
              ) : (
                <p className="text-xs text-slate-400 italic mt-1">Select destination below</p>
              )}
            </div>
          </div>
        </div>

        {/* Destination Work-Front Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Select Eligible Destination Work-Front <span className="text-rose-500">*</span>
          </label>

          {isLoading ? (
            <div className="py-6 flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              <span className="text-xs text-slate-400">Loading eligible work-fronts...</span>
            </div>
          ) : destinationWorkFronts.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-center text-amber-800">
              <ShieldAlert className="w-6 h-6 text-amber-600 mx-auto mb-1" />
              <p className="font-semibold">No Other Eligible Work-Fronts Available</p>
              <p className="text-[11px] mt-0.5">
                All other work-fronts are either completed or unconfigured. Register an active work-front first.
              </p>
            </div>
          ) : (
            <select
              value={selectedDestId}
              onChange={(e) => setSelectedDestId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
              required
            >
              {destinationWorkFronts.map((wf) => (
                <option key={wf._id} value={wf._id}>
                  [{wf.workFrontCode}] {wf.name} — {wf.site} ({wf.zone}) · {wf.status}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Relocation Justification / Remarks */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Relocation Reason / Scope Remarks
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Scaffolding works finished at turbine bay; camera relocated to cover boiler deck erection."
            maxLength={300}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}

export default RelocateCameraModal;


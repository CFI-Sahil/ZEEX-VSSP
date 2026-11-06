import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import LoadingSpinner from '../common/LoadingSpinner';
import cameraService from '../../services/cameraService';
import workFrontService from '../../services/workFrontService';
import { Video, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

export function AssignCameraModal({ isOpen, onClose, workFront, onCameraAssigned }) {
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (isOpen && workFront) {
      setSelectedCameraId('');
      setErrorMessage(null);
      setIsLoading(true);

      cameraService
        .getAvailableCameras()
        .then((res) => {
          if (res?.data?.cameras) {
            setAvailableCameras(res.data.cameras);
            if (res.data.cameras.length > 0) {
              setSelectedCameraId(res.data.cameras[0]._id);
            }
          } else {
            setAvailableCameras([]);
          }
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Failed to retrieve available unassigned cameras');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, workFront]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCameraId) {
      setErrorMessage('Please select a camera to assign');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await workFrontService.assignCamera(workFront._id, selectedCameraId);
      if (onCameraAssigned) {
        onCameraAssigned(res?.data?.workFront);
      }
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to assign camera to work-front');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const variant = status === 'ONLINE' ? 'success' : status === 'OFFLINE' ? 'danger' : 'warning';
    return (
      <Badge variant={variant} size="sm" dot>
        {status}
      </Badge>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Camera: ${workFront?.workFrontCode || ''}`}
      description={`Select an available, unassigned camera to monitor "${workFront?.name || 'this work-front'}".`}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="assign-camera-form"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isLoading || availableCameras.length === 0 || !selectedCameraId}
          >
            Assign Camera
          </Button>
        </div>
      }
    >
      <form id="assign-camera-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="font-medium flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Work-Front Summary Banner */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Target Work-Front:</span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {workFront?.workFrontCode}
            </span>
          </div>
          <p className="font-medium text-slate-800 mt-1">{workFront?.name}</p>
          <p className="text-[11px] text-slate-500">
            {workFront?.site} · {workFront?.zone} · {workFront?.contractor}
          </p>
        </div>

        {/* Camera Selection List */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Available Unassigned Cameras ({availableCameras.length})
          </label>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <LoadingSpinner size="md" />
              <p className="text-xs text-slate-400">Querying available camera inventory...</p>
            </div>
          ) : availableCameras.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2">
              <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="font-semibold text-amber-900">No Unassigned Cameras Available</p>
              <p className="text-amber-800 text-[11px] max-w-sm mx-auto">
                All registered surveillance cameras are currently mapped to operational work-fronts. To assign a camera,
                either relocate an existing camera from another front or register a new camera in the Cameras registry.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {availableCameras.map((cam) => {
                const isSelected = selectedCameraId === cam._id;
                return (
                  <div
                    key={cam._id}
                    onClick={() => setSelectedCameraId(cam._id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-[var(--color-primary)] bg-indigo-50/50 ring-1 ring-[var(--color-primary)]'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{cam.cameraCode}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-medium text-slate-800 truncate">{cam.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {cam.site} — {cam.location}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">{getStatusBadge(cam.status)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default AssignCameraModal;


import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { AlertCircle } from 'lucide-react';

export function CameraModal({ isOpen, onClose, onSave, camera = null, isLoading = false }) {
  const isEditing = Boolean(camera?._id);

  const [formData, setFormData] = useState({
    cameraCode: '',
    name: '',
    site: 'Plant 1',
    location: '',
    description: '',
    status: 'UNKNOWN',
  });
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (camera) {
      setFormData({
        cameraCode: camera.cameraCode || '',
        name: camera.name || '',
        site: camera.site || 'Plant 1',
        location: camera.location || '',
        description: camera.description || '',
        status: camera.status || 'UNKNOWN',
      });
    } else {
      setFormData({
        cameraCode: '',
        name: '',
        site: 'Plant 1',
        location: '',
        description: '',
        status: 'UNKNOWN',
      });
    }
    setErrorMessage(null);
  }, [camera, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'cameraCode' ? value.toUpperCase().trim() : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isEditing && !formData.cameraCode) {
      setErrorMessage('Camera identifier code is required');
      return;
    }

    if (!formData.name.trim()) {
      setErrorMessage('Camera name is required');
      return;
    }

    if (!formData.site.trim()) {
      setErrorMessage('Site location name is required');
      return;
    }

    if (!formData.location.trim()) {
      setErrorMessage('Zone/area location is required');
      return;
    }

    try {
      await onSave(formData);
    } catch (err) {
      setErrorMessage(err.message || 'Operation failed. Please review input.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Camera: ${camera.cameraCode}` : 'Register New Surveillance Camera'}
      description={
        isEditing
          ? 'Update camera configuration parameters and connection status.'
          : 'Add a new camera to the registry. New cameras strictly default to UNKNOWN status.'
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="camera-form"
            isLoading={isLoading}
          >
            {isEditing ? 'Save Changes' : 'Register Camera'}
          </Button>
        </>
      }
    >
      <form id="camera-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Camera Identifier Code */}
        <div>
          <label className="block text-xs font-semibold text-slate-800">
            Camera Code {isEditing && <span className="text-[10px] text-slate-400 font-normal">(Immutable)</span>}
          </label>
          <input
            type="text"
            name="cameraCode"
            value={formData.cameraCode}
            onChange={handleChange}
            disabled={isEditing}
            placeholder="e.g. CAM-001"
            className="mt-1 block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500 font-mono"
            required
          />
        </div>

        {/* Camera Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-800">Camera Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Main Assembly Line Bay 1"
            className="mt-1 block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Site and Location Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-800">Site Facility</label>
            <input
              type="text"
              name="site"
              value={formData.site}
              onChange={handleChange}
              placeholder="e.g. Plant 1"
              className="mt-1 block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800">Zone / Area Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g. Bay 2 - Loading Dock"
              className="mt-1 block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Status Dropdown (Editing Only) */}
        {isEditing && (
          <div>
            <label className="block text-xs font-semibold text-slate-800">
              Operational Status (Admin Registry)
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="UNKNOWN">UNKNOWN (Default / Unverified)</option>
              <option value="ONLINE">ONLINE (Administrative Provision)</option>
              <option value="OFFLINE">OFFLINE (Decommissioned / Disconnected)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Administrative status only. Does not connect to or simulate a live video stream.
            </p>
          </div>
        )}

        {/* Description / Operational Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-800">
            Description & Notes <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            name="description"
            rows={2}
            value={formData.description}
            onChange={handleChange}
            placeholder="Operational coverage details, field of view, or safety hazards monitored..."
            className="mt-1 block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </form>
    </Modal>
  );
}

export default CameraModal;


import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { AlertCircle } from 'lucide-react';

const ACTIVITY_OPTIONS = [
  { value: 'GENERAL_CONSTRUCTION', label: 'General Construction' },
  { value: 'WORKING_AT_HEIGHT', label: 'Working at Height' },
  { value: 'HOT_WORK', label: 'Hot Work / Welding' },
  { value: 'EXCAVATION', label: 'Excavation & Trenching' },
  { value: 'CONFINED_SPACE', label: 'Confined Space' },
  { value: 'HEAVY_LIFTING', label: 'Heavy Lifting / Crane Ops' },
  { value: 'ELECTRICAL', label: 'Electrical Installation' },
  { value: 'OTHER', label: 'Other Activity' },
];

const RISK_OPTIONS = [
  { value: 'LOW', label: 'Low Risk' },
  { value: 'MEDIUM', label: 'Medium Risk' },
  { value: 'HIGH', label: 'High Risk' },
  { value: 'CRITICAL', label: 'Critical Risk' },
];

const SHIFT_OPTIONS = [
  { value: 'GENERAL_24X7', label: 'General (24×7 Coverage)' },
  { value: 'MORNING', label: 'Morning Shift (06:00 – 14:00)' },
  { value: 'AFTERNOON', label: 'Afternoon Shift (14:00 – 22:00)' },
  { value: 'NIGHT', label: 'Night Shift (22:00 – 06:00)' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'COMPLETED', label: 'Completed' },
];

export function WorkFrontModal({
  isOpen,
  onClose,
  onSave,
  workFront = null,
  isLoading = false,
}) {
  const isEditing = Boolean(workFront?._id);

  const [formData, setFormData] = useState({
    workFrontCode: '',
    name: '',
    site: 'Plant 1',
    zone: '',
    contractor: '',
    supervisorName: '',
    supervisorPhone: '',
    supervisorEmail: '',
    activityType: 'GENERAL_CONSTRUCTION',
    riskLevel: 'MEDIUM',
    shift: 'GENERAL_24X7',
    status: 'ACTIVE',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    description: '',
  });

  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (workFront) {
      setFormData({
        workFrontCode: workFront.workFrontCode || '',
        name: workFront.name || '',
        site: workFront.site || 'Plant 1',
        zone: workFront.zone || '',
        contractor: workFront.contractor || '',
        supervisorName: workFront.supervisor?.name || '',
        supervisorPhone: workFront.supervisor?.phone || '',
        supervisorEmail: workFront.supervisor?.email || '',
        activityType: workFront.activityType || 'GENERAL_CONSTRUCTION',
        riskLevel: workFront.riskLevel || 'MEDIUM',
        shift: workFront.shift || 'GENERAL_24X7',
        status: workFront.status || 'ACTIVE',
        startDate: workFront.startDate
          ? new Date(workFront.startDate).toISOString().split('T')[0]
          : '',
        endDate: workFront.endDate
          ? new Date(workFront.endDate).toISOString().split('T')[0]
          : '',
        description: workFront.description || '',
      });
    } else {
      setFormData({
        workFrontCode: '',
        name: '',
        site: 'Plant 1',
        zone: '',
        contractor: '',
        supervisorName: '',
        supervisorPhone: '',
        supervisorEmail: '',
        activityType: 'GENERAL_CONSTRUCTION',
        riskLevel: 'MEDIUM',
        shift: 'GENERAL_24X7',
        status: 'ACTIVE',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        description: '',
      });
    }
    setErrorMessage(null);
  }, [workFront, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'workFrontCode' ? value.toUpperCase().trim() : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isEditing && !formData.workFrontCode) {
      setErrorMessage('Work-front identifier code is required');
      return;
    }

    if (!formData.name.trim()) {
      setErrorMessage('Work-front name is required');
      return;
    }

    if (!formData.site.trim()) {
      setErrorMessage('Site location name is required');
      return;
    }

    if (!formData.zone.trim()) {
      setErrorMessage('Zone location description is required');
      return;
    }

    if (!formData.contractor.trim()) {
      setErrorMessage('Responsible contractor name is required');
      return;
    }

    if (!formData.supervisorName.trim()) {
      setErrorMessage('Supervisor name is required');
      return;
    }

    const payload = {
      workFrontCode: formData.workFrontCode,
      name: formData.name.trim(),
      site: formData.site.trim(),
      zone: formData.zone.trim(),
      contractor: formData.contractor.trim(),
      supervisor: {
        name: formData.supervisorName.trim(),
        phone: formData.supervisorPhone.trim(),
        email: formData.supervisorEmail.trim(),
      },
      activityType: formData.activityType,
      riskLevel: formData.riskLevel,
      shift: formData.shift,
      status: formData.status,
      startDate: formData.startDate ? new Date(formData.startDate) : undefined,
      endDate: formData.endDate ? new Date(formData.endDate) : null,
      description: formData.description.trim(),
    };

    try {
      await onSave(payload);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save work-front record');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Work-Front: ${workFront?.workFrontCode}` : 'Register New Work-Front'}
      description={
        isEditing
          ? 'Update operational context, contractor supervision, activity or lifecycle status.'
          : 'Create a new operational work-front and define its location, contractor, and risk profile.'
      }
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="workfront-modal-form"
            variant="primary"
            size="md"
            isLoading={isLoading}
          >
            {isEditing ? 'Save Changes' : 'Register Work-Front'}
          </Button>
        </div>
      }
    >
      <form id="workfront-modal-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Identity & Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Work-Front Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="workFrontCode"
              value={formData.workFrontCode}
              onChange={handleChange}
              disabled={isEditing}
              placeholder="e.g. WF-101 or WF-CRANE-01"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed uppercase font-mono"
              required
            />
            {isEditing && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Code identifier is immutable once registered.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Work-Front Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Turbine Hall Structural Erection"
              maxLength={120}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              required
            />
          </div>
        </div>

        {/* Location (Site & Zone) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Site <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="site"
              value={formData.site}
              onChange={handleChange}
              placeholder="e.g. Plant 1 or North Refinery"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Zone / Area <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="zone"
              value={formData.zone}
              onChange={handleChange}
              placeholder="e.g. Zone B - Main Assembly"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              required
            />
          </div>
        </div>

        {/* Contractor & Supervision */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Contractor Attribution & Supervision
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Responsible Contractor / Agency <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="contractor"
              value={formData.contractor}
              onChange={handleChange}
              placeholder="e.g. Larsen & Toubro, Tata Projects, Apex Rigging"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supervisor Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="supervisorName"
                value={formData.supervisorName}
                onChange={handleChange}
                placeholder="e.g. Rajesh Sharma"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supervisor Phone
              </label>
              <input
                type="tel"
                name="supervisorPhone"
                value={formData.supervisorPhone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supervisor Email
              </label>
              <input
                type="email"
                name="supervisorEmail"
                value={formData.supervisorEmail}
                onChange={handleChange}
                placeholder="supervisor@example.com"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Activity, Risk & Shift Classification */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Activity Category <span className="text-rose-500">*</span>
            </label>
            <select
              name="activityType"
              value={formData.activityType}
              onChange={handleChange}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
            >
              {ACTIVITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Risk Level <span className="text-rose-500">*</span>
            </label>
            <select
              name="riskLevel"
              value={formData.riskLevel}
              onChange={handleChange}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer font-medium"
            >
              {RISK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operational Shift <span className="text-rose-500">*</span>
            </label>
            <select
              name="shift"
              value={formData.shift}
              onChange={handleChange}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
            >
              {SHIFT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status & Schedule Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lifecycle Status <span className="text-rose-500">*</span>
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              End Date (Optional)
            </label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Work-Front Description
          </label>
          <textarea
            name="description"
            rows={2}
            value={formData.description}
            onChange={handleChange}
            placeholder="Brief scope of works, perimeter boundaries, or specific safety precautions..."
            maxLength={500}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}

export default WorkFrontModal;


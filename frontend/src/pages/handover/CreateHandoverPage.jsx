import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  Camera,
  HardHat,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  Send,
  ArrowLeft,
  ShieldAlert,
  Flame,
  Clock,
  Info,
} from 'lucide-react';
import shiftHandoverService from '../../services/shiftHandoverService';
import { useAuth } from '../../hooks/useAuth';

export default function CreateHandoverPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form State
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shiftType, setShiftType] = useState('DAY');
  const [shiftLabel, setShiftLabel] = useState(
    `Day Shift - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  );
  const [outgoingRemarks, setOutgoingRemarks] = useState('');
  const [selectedAlertIds, setSelectedAlertIds] = useState([]);
  const [manualNotes, setManualNotes] = useState([]);

  // Operational Context from Live Engine
  const [operationalSummary, setOperationalSummary] = useState(null);
  const [candidateIncidents, setCandidateIncidents] = useState([]);
  const [cameraIssues, setCameraIssues] = useState([]);
  const [workFrontObservations, setWorkFrontObservations] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Manual Note Input Draft
  const [noteCategory, setNoteCategory] = useState('GENERAL');
  const [notePriority, setNotePriority] = useState('MEDIUM');
  const [noteContent, setNoteContent] = useState('');

  // Submit Modal Confirmation
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [draftId, setDraftId] = useState(null);

  useEffect(() => {
    fetchOperationalSummary();
  }, []);

  const fetchOperationalSummary = async () => {
    try {
      setLoadingSummary(true);
      setError(null);
      const res = await shiftHandoverService.getOperationalSummary();
      if (res.success && res.data) {
        setOperationalSummary(res.data.operationalSummary || null);
        setCandidateIncidents(res.data.candidateIncidents || []);
        setCameraIssues(res.data.cameraIssues || []);
        setWorkFrontObservations(res.data.workFrontObservations || []);
        setLastRefreshed(new Date().toLocaleTimeString());

        // Pre-select CRITICAL and HIGH severity alerts by default
        const criticalOrHigh = (res.data.candidateIncidents || [])
          .filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH')
          .map((i) => String(i.alertId));
        setSelectedAlertIds((prev) => (prev.length === 0 ? criticalOrHigh : prev));
      }
    } catch (err) {
      console.error('Failed to load operational summary:', err);
      setError(err.response?.data?.message || err.message || 'Failed to pull live operational intelligence.');
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleShiftTypeChange = (type) => {
    setShiftType(type);
    const dateFormatted = new Date(shiftDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const labelPrefix =
      type === 'DAY' ? 'Day Shift' : type === 'NIGHT' ? 'Night Shift' : type === 'SWING' ? 'Swing Shift' : 'Custom Shift';
    setShiftLabel(`${labelPrefix} - ${dateFormatted}`);
  };

  const toggleSelectAlert = (id) => {
    const sId = String(id);
    setSelectedAlertIds((prev) =>
      prev.includes(sId) ? prev.filter((item) => item !== sId) : [...prev, sId]
    );
  };

  const selectAllAlerts = () => {
    if (selectedAlertIds.length === candidateIncidents.length) {
      setSelectedAlertIds([]);
    } else {
      setSelectedAlertIds(candidateIncidents.map((i) => String(i.alertId)));
    }
  };

  const selectCriticalHighOnly = () => {
    const filtered = candidateIncidents
      .filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH')
      .map((i) => String(i.alertId));
    setSelectedAlertIds(filtered);
  };

  const handleAddManualNote = (e) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setManualNotes((prev) => [
      ...prev,
      {
        category: noteCategory,
        priority: notePriority,
        note: noteContent.trim(),
      },
    ]);
    setNoteContent('');
  };

  const handleRemoveManualNote = (index) => {
    setManualNotes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);
      setError(null);
      setSuccessMessage(null);

      const payload = {
        shiftDate,
        shiftType,
        shiftLabel,
        outgoingRemarks,
        selectedAlertIds,
        manualNotes,
      };

      let res;
      if (draftId) {
        res = await shiftHandoverService.updateDraftHandover(draftId, payload);
      } else {
        res = await shiftHandoverService.createHandover(payload);
        if (res.success && res.data?._id) {
          setDraftId(res.data._id);
        }
      }

      setSuccessMessage(`Handover draft saved successfully (${res.data?.handoverCode || 'Saved'}).`);
    } catch (err) {
      console.error('Failed to save draft:', err);
      setError(err.response?.data?.message || err.message || 'Failed to save handover draft.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleConfirmSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setShowConfirmModal(false);

      let targetId = draftId;
      if (!targetId) {
        // Create draft first
        const payload = {
          shiftDate,
          shiftType,
          shiftLabel,
          outgoingRemarks,
          selectedAlertIds,
          manualNotes,
        };
        const resDraft = await shiftHandoverService.createHandover(payload);
        if (!resDraft.success || !resDraft.data?._id) {
          throw new Error('Failed to create handover record prior to submission.');
        }
        targetId = resDraft.data._id;
      } else {
        // Update draft with latest state before submitting
        await shiftHandoverService.updateDraftHandover(targetId, {
          shiftDate,
          shiftType,
          shiftLabel,
          outgoingRemarks,
          manualNotes,
        });
      }

      // Submit and permanently freeze snapshot
      const resSubmit = await shiftHandoverService.submitHandover(targetId, { outgoingRemarks });
      if (resSubmit.success) {
        navigate(`/handovers/${targetId}`, {
          state: { message: `Handover ${resSubmit.data?.handoverCode} submitted successfully!` },
        });
      }
    } catch (err) {
      console.error('Failed to submit handover:', err);
      setError(err.response?.data?.message || err.message || 'Failed to submit shift handover.');
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'MEDIUM':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/handovers')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Handover Overview</span>
          </button>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-sky-400" />
            <span>Initiate Shift Handover</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Author: <span className="text-slate-200 font-semibold">{user?.fullName || user?.username}</span> | Role:{' '}
            <span className="text-sky-300 font-medium">{user?.role}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft || submitting}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-slate-300" />
            <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={submitting || savingDraft}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-900/40 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Submit Handover</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Shift Parameters Card */}
      <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-400" />
          <span>1. Shift Parameters & Metadata</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Shift Date</label>
            <input
              type="date"
              value={shiftDate}
              onChange={(e) => {
                setShiftDate(e.target.value);
                const d = new Date(e.target.value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                setShiftLabel(`${shiftType === 'DAY' ? 'Day' : shiftType === 'NIGHT' ? 'Night' : 'Swing'} Shift - ${d}`);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/80 text-white text-xs focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Shift Type</label>
            <select
              value={shiftType}
              onChange={(e) => handleShiftTypeChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/80 text-white text-xs focus:outline-hidden focus:border-sky-500"
            >
              <option value="DAY">Day Shift (06:00 - 14:00)</option>
              <option value="SWING">Swing Shift (14:00 - 22:00)</option>
              <option value="NIGHT">Night Shift (22:00 - 06:00)</option>
              <option value="CUSTOM">Custom Shift</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Shift Label / Header</label>
            <input
              type="text"
              value={shiftLabel}
              onChange={(e) => setShiftLabel(e.target.value)}
              placeholder="e.g. Day Shift - Nov 9, 2026"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/80 text-white text-xs focus:outline-hidden focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Live Operational Intelligence Summary Card */}
      <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              2. Automated Operational Intelligence
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono">
              Live Pipeline
            </span>
          </div>
          <button
            type="button"
            onClick={fetchOperationalSummary}
            disabled={loadingSummary}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sky-400 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/60 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
            <span>Refresh Live Data</span>
            {lastRefreshed && <span className="text-[10px] text-slate-400">({lastRefreshed})</span>}
          </button>
        </div>

        {loadingSummary && !operationalSummary ? (
          <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Collecting operational safety intelligence across active work fronts...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Pending Alerts</span>
              <p className="text-lg font-bold text-white mt-1">
                {operationalSummary?.pendingAlertsCount ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <span className="text-[10px] text-rose-400 uppercase tracking-wider block">Critical</span>
              <p className="text-lg font-bold text-rose-400 mt-1">
                {operationalSummary?.criticalCount ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <span className="text-[10px] text-amber-400 uppercase tracking-wider block">High Priority</span>
              <p className="text-lg font-bold text-amber-400 mt-1">
                {operationalSummary?.highPriorityCount ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <span className="text-[10px] text-purple-400 uppercase tracking-wider block">Escalated</span>
              <p className="text-lg font-bold text-purple-400 mt-1">
                {operationalSummary?.escalationsCount ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <span className="text-[10px] text-amber-300 uppercase tracking-wider block">Offline Cameras</span>
              <p className="text-lg font-bold text-amber-300 mt-1">
                {operationalSummary?.offlineCamerasCount ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">Active Fronts</span>
              <p className="text-lg font-bold text-emerald-400 mt-1">
                {operationalSummary?.activeWorkFrontsCount ?? 0}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Incident Selection Table */}
      <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>3. Selected Unresolved Incidents ({selectedAlertIds.length} flagged)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select key incidents to highlight in this handover package for incoming operator attention.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectCriticalHighOnly}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-amber-300 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 transition-colors cursor-pointer"
            >
              Select Critical & High
            </button>
            <button
              type="button"
              onClick={selectAllAlerts}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            >
              {selectedAlertIds.length === candidateIncidents.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        {candidateIncidents.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800 text-center text-xs text-slate-400">
            No unresolved alerts found in the platform. All operational work fronts are clear.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0b1726] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3 w-10 text-center">Include</th>
                  <th className="p-3">Alert Code</th>
                  <th className="p-3">Title / Category</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Work Front</th>
                  <th className="p-3">Camera</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Detected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {candidateIncidents.map((incident) => {
                  const isSelected = selectedAlertIds.includes(String(incident.alertId));
                  return (
                    <tr
                      key={incident.alertId}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-sky-950/20' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectAlert(incident.alertId)}
                          className="rounded-sm border-slate-700 text-sky-500 focus:ring-sky-500 h-3.5 w-3.5 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono font-semibold text-white">
                        {incident.alertCode}
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-200">{incident.title}</div>
                        <div className="text-[10px] text-slate-400">{incident.category}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getSeverityBadge(
                            incident.severity
                          )}`}
                        >
                          {incident.severity}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">
                        {incident.workFrontName || incident.workFrontCode || 'N/A'}
                      </td>
                      <td className="p-3 font-mono text-slate-400">
                        {incident.cameraCode || 'N/A'}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {incident.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {new Date(incident.detectedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two Column Grid: Camera Health & Active Work Fronts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Health Section */}
        <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Camera className="w-4 h-4 text-amber-400" />
            <span>4. Camera & Hardware Status ({cameraIssues.length} issues)</span>
          </h2>
          {cameraIssues.length === 0 ? (
            <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>All surveillance cameras are operational and online.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {cameraIssues.map((cam, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-900/60 border border-amber-900/30 flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-semibold text-white font-mono">{cam.cameraCode}</span>
                    <span className="text-xs text-slate-400 ml-2">{cam.name}</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">Location: {cam.location || 'N/A'}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    {cam.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Work Front Observations */}
        <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <HardHat className="w-4 h-4 text-emerald-400" />
            <span>5. Active Work Fronts ({workFrontObservations.length} active)</span>
          </h2>
          {workFrontObservations.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800 text-center text-xs text-slate-400">
              No active work fronts recorded.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {workFrontObservations.map((wf, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{wf.name}</div>
                    <div className="text-[10px] text-slate-400">
                      Contractor: <span className="text-slate-300">{wf.contractor}</span> | Sup:{' '}
                      <span className="text-slate-300">{wf.supervisorName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-400 border border-sky-800/40">
                      {wf.riskLevel} Risk
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {wf.activeAlertsCount} active alerts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual Operator Notes Section */}
      <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span>6. Operator Field Observations & Structured Notes</span>
        </h2>

        {/* Existing Notes List */}
        {manualNotes.length > 0 && (
          <div className="space-y-2">
            {manualNotes.map((note, index) => (
              <div
                key={index}
                className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 font-mono">
                      {note.category}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${getSeverityBadge(
                        note.priority
                      )}`}
                    >
                      {note.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 mt-1">{note.note}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveManualNote(index)}
                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Remove note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Note Form */}
        <form onSubmit={handleAddManualNote} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          <div className="md:col-span-3">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Category</label>
            <select
              value={noteCategory}
              onChange={(e) => setNoteCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/80 text-white text-xs focus:outline-hidden"
            >
              <option value="SAFETY_OBSERVATION">Safety Observation</option>
              <option value="SUPERVISOR_REQUEST">Supervisor Request</option>
              <option value="SITE_RESTRICTION">Site Restriction</option>
              <option value="EQUIPMENT_HOLD">Equipment Hold</option>
              <option value="GENERAL">General</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Priority</label>
            <select
              value={notePriority}
              onChange={(e) => setNotePriority(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/80 text-white text-xs focus:outline-hidden"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div className="md:col-span-6">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Observation Details</label>
            <input
              type="text"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Enter specific handover instructions or observations..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/80 text-white text-xs focus:outline-hidden"
            />
          </div>

          <div className="md:col-span-1 flex items-end">
            <button
              type="submit"
              disabled={!noteContent.trim()}
              className="w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </form>
      </div>

      {/* Outgoing Remarks */}
      <div className="p-5 rounded-xl bg-[#10243D] border border-slate-800 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Info className="w-4 h-4 text-sky-400" />
          <span>7. Outgoing Shift Remarks & Briefing</span>
        </h2>
        <textarea
          rows={3}
          value={outgoingRemarks}
          onChange={(e) => setOutgoingRemarks(e.target.value)}
          placeholder="Summarize the shift highlights, pending items requiring immediate vigilance, contractor issues, and weather or site constraints..."
          className="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700/80 text-white text-xs focus:outline-hidden focus:border-sky-500 leading-relaxed"
        />
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#10243D] border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-sky-500/20 text-sky-400">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Handover Submission</h3>
                <p className="text-xs text-slate-400">Finalize shift transfer</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p>
                Submitting this handover package will{' '}
                <strong className="text-amber-300">permanently freeze</strong> the operational summary
                snapshot.
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-1 text-[11px]">
                <li>{selectedAlertIds.length} safety incidents flagged for incoming operator</li>
                <li>{manualNotes.length} structured field observations attached</li>
                <li>The handover will move to the Incoming Operator Inbox</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Freezing & Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


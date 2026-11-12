import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Plus,
  Edit2,
  CheckCircle,
  Archive,
  Eye,
  Search,
  Filter,
  ArrowLeft,
  X,
  Clock,
  Layers,
  Award,
  AlertTriangle,
  Save,
} from 'lucide-react';
import trainingService from '../../services/trainingService';
import Card, { CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/common/Table';
import TrainingModeBanner from '../../components/training/TrainingModeBanner';
import { useAuth } from '../../hooks/useAuth';

export function AdminScenarioManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [scenarios, setScenarios] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Scenario Modal (Create/Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formObjective, setFormObjective] = useState('');
  const [formViolationType, setFormViolationType] = useState('NO_HELMET');
  const [formSeverity, setFormSeverity] = useState('HIGH');
  const [formDifficulty, setFormDifficulty] = useState('BEGINNER');
  const [formMinutes, setFormMinutes] = useState(10);
  const [formInstructions, setFormInstructions] = useState('');
  const [formExpectedViolation, setFormExpectedViolation] = useState('NO_HELMET');
  const [formExpectedSeverity, setFormExpectedSeverity] = useState('HIGH');
  const [formExpectedResponse, setFormExpectedResponse] = useState('ISSUE_VERBAL_WARNING');
  const [formExpectedCorrective, setFormExpectedCorrective] = useState('PPE_COMPLIANCE_ISSUANCE');
  const [formMinRemarksLength, setFormMinRemarksLength] = useState(15);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchScenarios = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await trainingService.getScenarios({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter,
        search: debouncedSearch,
      });

      if (res && res.data) {
        setScenarios(res.data);
        if (res.meta) {
          setPagination(res.meta);
        }
      }
    } catch (err) {
      console.error('Failed to load admin scenarios:', err);
      setError('Failed to load scenario catalog.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  const handleOpenCreate = () => {
    setEditingScenario(null);
    setFormCode(`SCN-${Date.now().toString().slice(-4)}`);
    setFormTitle('');
    setFormDescription('');
    setFormObjective('');
    setFormViolationType('NO_HELMET');
    setFormSeverity('HIGH');
    setFormDifficulty('BEGINNER');
    setFormMinutes(10);
    setFormInstructions('1. Review CCTV detection snapshot.\n2. Acknowledge alert.\n3. Assess violation and severity.\n4. Complete resolution notes.');
    setFormExpectedViolation('NO_HELMET');
    setFormExpectedSeverity('HIGH');
    setFormExpectedResponse('ISSUE_VERBAL_WARNING');
    setFormExpectedCorrective('PPE_COMPLIANCE_ISSUANCE');
    setFormMinRemarksLength(15);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (scenario) => {
    setEditingScenario(scenario);
    setFormCode(scenario.scenarioCode);
    setFormTitle(scenario.title);
    setFormDescription(scenario.description);
    setFormObjective(scenario.objective);
    setFormViolationType(scenario.violationType);
    setFormSeverity(scenario.severity);
    setFormDifficulty(scenario.difficulty);
    setFormMinutes(scenario.estimatedMinutes);
    setFormInstructions(Array.isArray(scenario.instructions) ? scenario.instructions.join('\n') : (scenario.instructions || ''));
    setFormExpectedViolation(scenario.expectedEvaluation?.expectedViolationType || scenario.violationType);
    setFormExpectedSeverity(scenario.expectedEvaluation?.expectedSeverity || scenario.severity);
    setFormExpectedResponse(scenario.expectedEvaluation?.expectedImmediateResponse || 'ISSUE_VERBAL_WARNING');
    setFormExpectedCorrective(scenario.expectedEvaluation?.expectedCorrectiveActionCategory || 'PPE_COMPLIANCE_ISSUANCE');
    setFormMinRemarksLength(scenario.expectedEvaluation?.minimumRemarksLength || 15);
    setIsModalOpen(true);
  };

  const handleSaveScenario = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim() || !formObjective.trim()) {
      alert('Please fill out all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        scenarioCode: formCode.trim().toUpperCase(),
        title: formTitle.trim(),
        description: formDescription.trim(),
        objective: formObjective.trim(),
        violationType: formViolationType,
        severity: formSeverity,
        difficulty: formDifficulty,
        estimatedMinutes: Number(formMinutes),
        instructions: formInstructions.split('\n').filter((l) => l.trim().length > 0),
        expectedEvaluation: {
          expectedViolationType: formExpectedViolation,
          expectedSeverity: formExpectedSeverity,
          expectedImmediateResponse: formExpectedResponse,
          expectedCorrectiveActionCategory: formExpectedCorrective,
          minimumRemarksLength: Number(formMinRemarksLength),
        },
      };

      if (editingScenario) {
        await trainingService.updateScenario(editingScenario._id, payload);
      } else {
        await trainingService.createScenario(payload);
      }

      setIsModalOpen(false);
      fetchScenarios();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save scenario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async (id) => {
    try {
      await trainingService.publishScenario(id);
      fetchScenarios();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to publish scenario');
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Are you sure you want to archive this scenario? Existing completed sessions will be retained.')) {
      return;
    }
    try {
      await trainingService.archiveScenario(id);
      fetchScenarios();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to archive scenario');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <TrainingModeBanner />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/training')}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                ADMIN CONSOLE
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Scenario Catalog Management
            </h1>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 self-start sm:self-auto bg-[var(--color-primary)] text-white hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          <span>New Training Scenario</span>
        </Button>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search scenarios by title, code or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Publication Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenarios Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner size="lg" message="Loading admin scenario catalog..." />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-rose-600 text-sm">{error}</div>
          ) : scenarios.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="No Scenarios Found"
                description="Click 'New Training Scenario' to create your first simulated exercise."
                action={
                  <Button variant="primary" size="sm" onClick={handleOpenCreate}>
                    Create Scenario
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Violation</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Avg Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scenarios.map((sc) => (
                    <TableRow key={sc._id} className="hover:bg-slate-50/70">
                      <TableCell className="font-mono text-xs font-bold text-slate-900">
                        {sc.scenarioCode}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-800 text-xs">{sc.title}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{sc.objective}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {sc.violationType}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" size="sm">{sc.difficulty}</Badge>
                      </TableCell>
                      <TableCell>
                        {sc.status === 'PUBLISHED' ? (
                          <Badge variant="success" size="sm">Published</Badge>
                        ) : sc.status === 'ARCHIVED' ? (
                          <Badge variant="danger" size="sm">Archived</Badge>
                        ) : (
                          <Badge variant="warning" size="sm">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {sc.completionCount || 0} / {sc.attemptCount || 0}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-800">
                        {sc.averageScore ? `${sc.averageScore}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(sc)}
                            className="p-1.5 text-slate-600 hover:text-slate-900"
                            title="Edit Scenario"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          {sc.status !== 'PUBLISHED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePublish(sc._id)}
                              className="text-xs text-emerald-600 hover:text-emerald-700"
                            >
                              Publish
                            </Button>
                          )}

                          {sc.status !== 'ARCHIVED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(sc._id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700"
                              title="Archive Scenario"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingScenario ? 'Edit Training Scenario' : 'Create New Training Scenario'}
          size="xl"
        >
          <form onSubmit={handleSaveScenario} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scenario Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated Minutes <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  required
                  value={formMinutes}
                  onChange={(e) => setFormMinutes(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scenario Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Missing Hard Hat in Heavy Fabrication Bay"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Training Objective <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Practice identifying PPE non-compliance and executing stop work protocols"
                  value={formObjective}
                  onChange={(e) => setFormObjective(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Violation Category
                </label>
                <select
                  value={formViolationType}
                  onChange={(e) => setFormViolationType(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="NO_HELMET">NO_HELMET</option>
                  <option value="NO_VEST">NO_VEST</option>
                  <option value="UNAUTHORIZED_ZONE">UNAUTHORIZED_ZONE</option>
                  <option value="NO_SAFETY_BOOTS">NO_SAFETY_BOOTS</option>
                  <option value="RESTRICTED_ACCESS">RESTRICTED_ACCESS</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Severity
                </label>
                <select
                  value={formSeverity}
                  onChange={(e) => setFormSeverity(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Difficulty
                </label>
                <select
                  value={formDifficulty}
                  onChange={(e) => setFormDifficulty(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="BEGINNER">BEGINNER</option>
                  <option value="INTERMEDIATE">INTERMEDIATE</option>
                  <option value="ADVANCED">ADVANCED</option>
                </select>
              </div>
            </div>

            {/* Expected Evaluation Section */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Expected Evaluation Benchmarks (Hidden from Operators)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    Expected Violation Type
                  </label>
                  <select
                    value={formExpectedViolation}
                    onChange={(e) => setFormExpectedViolation(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                  >
                    <option value="NO_HELMET">NO_HELMET</option>
                    <option value="NO_VEST">NO_VEST</option>
                    <option value="UNAUTHORIZED_ZONE">UNAUTHORIZED_ZONE</option>
                    <option value="NO_SAFETY_BOOTS">NO_SAFETY_BOOTS</option>
                    <option value="RESTRICTED_ACCESS">RESTRICTED_ACCESS</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    Expected Severity
                  </label>
                  <select
                    value={formExpectedSeverity}
                    onChange={(e) => setFormExpectedSeverity(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    Expected Immediate Response
                  </label>
                  <input
                    type="text"
                    required
                    value={formExpectedResponse}
                    onChange={(e) => setFormExpectedResponse(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    Expected Corrective Category
                  </label>
                  <input
                    type="text"
                    required
                    value={formExpectedCorrective}
                    onChange={(e) => setFormExpectedCorrective(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isSubmitting}
                className="bg-[var(--color-primary)] text-white hover:opacity-90"
              >
                {editingScenario ? 'Update Scenario' : 'Create Scenario'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default AdminScenarioManagementPage;


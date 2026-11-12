import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Search,
  Filter,
  Clock,
  Award,
  Play,
  Eye,
  ShieldAlert,
  ChevronRight,
  SlidersHorizontal,
  X,
  Settings,
  AlertTriangle,
  Camera,
  MapPin,
  Building2,
} from 'lucide-react';
import trainingService from '../../services/trainingService';
import Card, { CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import TrainingModeBanner from '../../components/training/TrainingModeBanner';
import { useAuth } from '../../hooks/useAuth';

export function ScenarioLibraryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [scenarios, setScenarios] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('ALL');
  const [violationFilter, setViolationFilter] = useState('ALL');

  // Preview Modal
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [isStartingSession, setIsStartingSession] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchScenarios = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await trainingService.getScenarios({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        difficulty: difficultyFilter,
        violationType: violationFilter,
      });

      if (res && res.data) {
        setScenarios(res.data);
        if (res.meta) {
          setPagination(res.meta);
        }
      }
    } catch (err) {
      console.error('Failed to load scenarios:', err);
      setError('Failed to load training scenarios.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, difficultyFilter, violationFilter]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  const handleStartSession = async (scenarioId) => {
    setIsStartingSession(true);
    try {
      const res = await trainingService.startSession(scenarioId);
      if (res && res.data && res.data._id) {
        navigate(`/training/session/${res.data._id}`);
      }
    } catch (err) {
      console.error('Failed to start training session:', err);
      alert(err.response?.data?.message || err.message || 'Failed to start session');
    } finally {
      setIsStartingSession(false);
    }
  };

  const getDifficultyBadge = (difficulty) => {
    switch (difficulty) {
      case 'BEGINNER':
        return <Badge variant="success" size="sm">Beginner</Badge>;
      case 'INTERMEDIATE':
        return <Badge variant="warning" size="sm">Intermediate</Badge>;
      case 'ADVANCED':
        return <Badge variant="danger" size="sm">Advanced</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{difficulty}</Badge>;
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return <Badge variant="danger" size="sm">Critical</Badge>;
      case 'HIGH':
        return <Badge variant="danger" size="sm">High</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning" size="sm">Medium</Badge>;
      case 'LOW':
        return <Badge variant="neutral" size="sm">Low</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{sev}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <TrainingModeBanner />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Training Scenario Library
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Select a simulated safety scenario to practice detection analysis, acknowledgment, and corrective action workflows.
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/training/admin/scenarios')}
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Settings className="w-4 h-4 text-slate-600" />
            <span>Admin Scenario Management</span>
          </Button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search scenarios by title, code or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Difficulties</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>

              <select
                value={violationFilter}
                onChange={(e) => setViolationFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Violation Types</option>
                <option value="NO_HELMET">Missing Helmet (PPE)</option>
                <option value="NO_VEST">Missing Vest (PPE)</option>
                <option value="UNAUTHORIZED_ZONE">Unauthorized Zone</option>
                <option value="NO_SAFETY_BOOTS">Footwear Compliance</option>
                <option value="RESTRICTED_ACCESS">Restricted Access</option>
                <option value="OTHER">Other / Multi-Risk</option>
              </select>

              {(difficultyFilter !== 'ALL' || violationFilter !== 'ALL' || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDifficultyFilter('ALL');
                    setViolationFilter('ALL');
                    setSearch('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Grid */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" message="Loading scenario catalog..." />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchScenarios}>
            Retry
          </Button>
        </div>
      ) : scenarios.length === 0 ? (
        <EmptyState
          title="No Scenarios Match Your Criteria"
          description="Try resetting your filters or search keywords to view available training exercises."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDifficultyFilter('ALL');
                setViolationFilter('ALL');
                setSearch('');
              }}
            >
              Reset Filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {scenarios.map((scenario) => (
            <Card
              key={scenario._id}
              className="flex flex-col hover:border-slate-300 transition-all hover:shadow-xs group"
            >
              <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {scenario.scenarioCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {getDifficultyBadge(scenario.difficulty)}
                      {getSeverityBadge(scenario.severity)}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {scenario.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {scenario.description}
                  </p>
                </div>

                {/* Metadata & Actions */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      ~{scenario.estimatedMinutes} min
                    </span>
                    <span className="font-medium text-slate-700">
                      {scenario.violationType.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedScenario(scenario)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isStartingSession}
                      onClick={() => handleStartSession(scenario._id)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs bg-[var(--color-primary)] text-white hover:opacity-90"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Sandbox</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Scenario Detail Preview Modal */}
      {selectedScenario && (
        <Modal
          isOpen={Boolean(selectedScenario)}
          onClose={() => setSelectedScenario(null)}
          title={selectedScenario.title}
          size="lg"
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-200">
              <span className="font-mono text-xs font-bold text-slate-600">
                {selectedScenario.scenarioCode}
              </span>
              {getDifficultyBadge(selectedScenario.difficulty)}
              {getSeverityBadge(selectedScenario.severity)}
              <span className="text-xs text-slate-500 flex items-center gap-1 ml-auto">
                <Clock className="w-3.5 h-3.5" />
                Est. {selectedScenario.estimatedMinutes} minutes
              </span>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Scenario Objective
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                {selectedScenario.objective}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Description
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {selectedScenario.description}
              </p>
            </div>

            {selectedScenario.learningObjectives && selectedScenario.learningObjectives.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Learning Objectives
                </h4>
                <ul className="space-y-1 text-xs text-slate-600">
                  {selectedScenario.learningObjectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedScenario.simulatedAlertContext && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Simulated Workplace Context
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400">Location:</span>{' '}
                    <strong>{selectedScenario.simulatedAlertContext.location || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Camera:</span>{' '}
                    <strong>{selectedScenario.simulatedAlertContext.cameraCode || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Contractor:</span>{' '}
                    <strong>{selectedScenario.simulatedAlertContext.contractor || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Work Front:</span>{' '}
                    <strong>{selectedScenario.simulatedAlertContext.workFrontName || 'N/A'}</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedScenario(null)}
              >
                Close
              </Button>

              <Button
                variant="primary"
                size="sm"
                disabled={isStartingSession}
                onClick={() => {
                  const id = selectedScenario._id;
                  setSelectedScenario(null);
                  handleStartSession(id);
                }}
                className="flex items-center gap-1.5 bg-[var(--color-primary)] text-white hover:opacity-90"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Begin Simulated Session</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ScenarioLibraryPage;


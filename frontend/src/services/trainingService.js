import api from './api';

export const trainingService = {
  /**
   * Fetch aggregate training statistics and KPIs
   * @returns {Promise<Object>} API envelope with kpis, performanceByViolation, performanceBands, recentSessions
   */
  getStats: async () => {
    return api.get('/training/stats');
  },

  /**
   * Fetch training scenarios with filtering and pagination
   * @param {Object} params - Query filters (page, limit, difficulty, violationType, status, search)
   * @returns {Promise<Object>} API envelope with scenarios and pagination
   */
  getScenarios: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.difficulty && params.difficulty !== 'ALL') query.append('difficulty', params.difficulty);
    if (params.violationType && params.violationType !== 'ALL') query.append('violationType', params.violationType);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.search && params.search.trim()) query.append('search', params.search.trim());

    const queryString = query.toString();
    const endpoint = queryString ? `/training/scenarios?${queryString}` : '/training/scenarios';
    return api.get(endpoint);
  },

  /**
   * Retrieve single scenario by ID
   * @param {string} id - Scenario ObjectId
   * @returns {Promise<Object>} API envelope with scenario details
   */
  getScenarioById: async (id) => {
    return api.get(`/training/scenarios/${id}`);
  },

  /**
   * Create a new training scenario (ADMIN only)
   * @param {Object} data - Scenario definition payload
   * @returns {Promise<Object>}
   */
  createScenario: async (data) => {
    return api.post('/training/scenarios', data);
  },

  /**
   * Update scenario (ADMIN only)
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  updateScenario: async (id, data) => {
    return api.patch(`/training/scenarios/${id}`, data);
  },

  /**
   * Publish scenario (ADMIN only)
   * @param {string} id
   * @returns {Promise<Object>}
   */
  publishScenario: async (id) => {
    return api.patch(`/training/scenarios/${id}/publish`, {});
  },

  /**
   * Archive scenario (ADMIN only)
   * @param {string} id
   * @returns {Promise<Object>}
   */
  archiveScenario: async (id) => {
    return api.patch(`/training/scenarios/${id}/archive`, {});
  },

  /**
   * Start a new isolated training session
   * @param {string} scenarioId
   * @returns {Promise<Object>} API envelope with created session
   */
  startSession: async (scenarioId) => {
    return api.post('/training/sessions', { scenarioId });
  },

  /**
   * Retrieve training session by ID
   * @param {string} id - Session ObjectId
   * @returns {Promise<Object>} API envelope with session and scenarioSnapshot
   */
  getSessionById: async (id) => {
    return api.get(`/training/sessions/${id}`);
  },

  /**
   * Acknowledge simulated incident
   * @param {string} id - Session ObjectId
   * @param {string} remarks - Acknowledgment note
   * @returns {Promise<Object>}
   */
  acknowledgeSession: async (id, remarks = '') => {
    return api.post(`/training/sessions/${id}/acknowledge`, { remarks });
  },

  /**
   * Submit operator assessment
   * @param {string} id - Session ObjectId
   * @param {Object} assessmentData
   * @returns {Promise<Object>}
   */
  assessSession: async (id, assessmentData) => {
    return api.post(`/training/sessions/${id}/assess`, assessmentData);
  },

  /**
   * Record corrective action
   * @param {string} id - Session ObjectId
   * @param {Object} correctiveData
   * @returns {Promise<Object>}
   */
  recordCorrectiveAction: async (id, correctiveData) => {
    return api.post(`/training/sessions/${id}/corrective-action`, correctiveData);
  },

  /**
   * Complete training session and evaluate
   * @param {string} id - Session ObjectId
   * @param {string} resolutionRemarks
   * @returns {Promise<Object>}
   */
  completeSession: async (id, resolutionRemarks) => {
    return api.post(`/training/sessions/${id}/complete`, { resolutionRemarks });
  },

  /**
   * Abandon training session
   * @param {string} id - Session ObjectId
   * @returns {Promise<Object>}
   */
  abandonSession: async (id) => {
    return api.post(`/training/sessions/${id}/abandon`, {});
  },

  /**
   * Fetch training session history
   * @param {Object} params - Query filters (page, limit, status, sortBy, sortOrder, search)
   * @returns {Promise<Object>}
   */
  getHistory: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);
    if (params.search && params.search.trim()) query.append('search', params.search.trim());

    const queryString = query.toString();
    const endpoint = queryString ? `/training/history?${queryString}` : '/training/history';
    return api.get(endpoint);
  },
};

export default trainingService;


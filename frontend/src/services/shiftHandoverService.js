import api from './api';

export const shiftHandoverService = {
  /**
   * Retrieve live operational intelligence for handover drafting
   * @returns {Promise<Object>} API envelope with operationalSummary, candidateIncidents, etc.
   */
  getOperationalSummary: async () => {
    return api.get('/handovers/operational-summary');
  },

  /**
   * Fetch Shift Handover Dashboard KPIs and recent items
   * @returns {Promise<Object>} API envelope with kpis, recentHandovers, recentActivities
   */
  getDashboard: async () => {
    return api.get('/handovers/dashboard');
  },

  /**
   * Fetch incoming handovers awaiting acknowledgement
   * @returns {Promise<Object>} API envelope with inbox list
   */
  getInbox: async () => {
    return api.get('/handovers/inbox');
  },

  /**
   * List paginated and filtered handovers
   * @param {Object} params - Query filters (page, limit, status, shiftType, search, startDate, endDate, sortBy, sortOrder)
   * @returns {Promise<Object>}
   */
  getHandovers: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.shiftType && params.shiftType !== 'ALL') query.append('shiftType', params.shiftType);
    if (params.search && params.search.trim()) query.append('search', params.search.trim());
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);

    const queryString = query.toString();
    const endpoint = queryString ? `/handovers?${queryString}` : '/handovers';
    return api.get(endpoint);
  },

  /**
   * Retrieve single handover document by ID
   * @param {string} id - Handover ObjectId
   * @returns {Promise<Object>}
   */
  getHandoverById: async (id) => {
    return api.get(`/handovers/${id}`);
  },

  /**
   * Create a new draft handover
   * @param {Object} data - Draft payload (shiftLabel, shiftType, outgoingRemarks, selectedAlertIds, manualNotes)
   * @returns {Promise<Object>}
   */
  createHandover: async (data) => {
    return api.post('/handovers', data);
  },

  /**
   * Update draft handover
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  updateDraftHandover: async (id, data) => {
    return api.patch(`/handovers/${id}`, data);
  },

  /**
   * Refresh operational data on a draft handover
   * @param {string} id
   * @returns {Promise<Object>}
   */
  refreshHandoverSummary: async (id) => {
    return api.post(`/handovers/${id}/refresh-summary`, {});
  },

  /**
   * Submit draft handover and freeze snapshot permanently
   * @param {string} id
   * @param {Object} data - Optional final outgoingRemarks
   * @returns {Promise<Object>}
   */
  submitHandover: async (id, data = {}) => {
    return api.post(`/handovers/${id}/submit`, data);
  },

  /**
   * Incoming operator claims unassigned handover
   * @param {string} id
   * @returns {Promise<Object>}
   */
  claimHandover: async (id) => {
    return api.post(`/handovers/${id}/claim`, {});
  },

  /**
   * Incoming operator acknowledges handover
   * @param {string} id
   * @param {Object} data - { remarks }
   * @returns {Promise<Object>}
   */
  acknowledgeHandover: async (id, data = {}) => {
    return api.post(`/handovers/${id}/acknowledge`, data);
  },

  /**
   * Create follow-up action item attached to a handover
   * @param {string} id
   * @param {Object} data - { description, priority, relatedAlertCode, remarks }
   * @returns {Promise<Object>}
   */
  createFollowUp: async (id, data) => {
    return api.post(`/handovers/${id}/follow-ups`, data);
  },

  /**
   * Update follow-up action item status/remarks
   * @param {string} id
   * @param {string} followUpId
   * @param {Object} data - { status, remarks }
   * @returns {Promise<Object>}
   */
  updateFollowUp: async (id, followUpId, data) => {
    return api.patch(`/handovers/${id}/follow-ups/${followUpId}`, data);
  },

  /**
   * Mark acknowledged handover as COMPLETED
   * @param {string} id
   * @returns {Promise<Object>}
   */
  completeHandover: async (id) => {
    return api.post(`/handovers/${id}/complete`, {});
  },

  /**
   * Cancel draft handover
   * @param {string} id
   * @param {string} cancellationReason
   * @returns {Promise<Object>}
   */
  cancelHandover: async (id, cancellationReason) => {
    return api.post(`/handovers/${id}/cancel`, { cancellationReason });
  },
};

export default shiftHandoverService;


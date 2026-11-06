import api from './api';

export const workFrontService = {
  /**
   * List work-fronts with search, multi-filter, pagination, and KPI summary
   */
  getWorkFronts: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.search && params.search.trim()) query.append('search', params.search.trim());
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.riskLevel && params.riskLevel !== 'ALL') query.append('riskLevel', params.riskLevel);
    if (params.activityType && params.activityType !== 'ALL') query.append('activityType', params.activityType);
    if (params.site && params.site.trim()) query.append('site', params.site.trim());
    if (params.contractor && params.contractor.trim()) query.append('contractor', params.contractor.trim());

    const queryString = query.toString();
    const endpoint = queryString ? `/work-fronts?${queryString}` : '/work-fronts';
    return api.get(endpoint);
  },

  /**
   * Get detailed work-front by ID with cameras and audit history
   */
  getWorkFrontById: async (id) => {
    return api.get(`/work-fronts/${id}`);
  },

  /**
   * Register a new work-front (Admin only)
   */
  createWorkFront: async (payload) => {
    return api.post('/work-fronts', payload);
  },

  /**
   * Update work-front metadata (Admin only)
   */
  updateWorkFront: async (id, payload) => {
    return api.patch(`/work-fronts/${id}`, payload);
  },

  /**
   * Update work-front status (Admin only)
   */
  updateWorkFrontStatus: async (id, status, remarks = '') => {
    return api.patch(`/work-fronts/${id}/status`, { status, remarks });
  },

  /**
   * Assign an unassigned camera to a work-front (Admin only)
   */
  assignCamera: async (workFrontId, cameraId) => {
    return api.post(`/work-fronts/${workFrontId}/cameras/assign`, { cameraId });
  },

  /**
   * Remove an assigned camera from a work-front (Admin only)
   */
  removeCamera: async (workFrontId, cameraId) => {
    return api.delete(`/work-fronts/${workFrontId}/cameras/${cameraId}`);
  },

  /**
   * Relocate an assigned camera from source work-front to destination work-front (Admin only)
   */
  relocateCamera: async (sourceWorkFrontId, cameraId, destinationWorkFrontId, reason = '') => {
    return api.post(`/work-fronts/${sourceWorkFrontId}/cameras/relocate`, {
      cameraId,
      destinationWorkFrontId,
      reason,
    });
  },
};

export default workFrontService;


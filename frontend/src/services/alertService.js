import api from './api';

export const alertService = {
  getAlerts: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.search && params.search.trim()) query.append('search', params.search.trim());
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.severity && params.severity !== 'ALL') query.append('severity', params.severity);
    if (params.cameraCode) query.append('cameraCode', params.cameraCode);

    const queryString = query.toString();
    const endpoint = queryString ? `/alerts?${queryString}` : '/alerts';
    return api.get(endpoint);
  },

  getAlertById: async (id) => {
    return api.get(`/alerts/${id}`);
  },

  acknowledgeAlert: async (id) => {
    return api.patch(`/alerts/${id}/acknowledge`, {});
  },

  closeAlert: async (id, remarks) => {
    return api.patch(`/alerts/${id}/close`, { remarks });
  },

  simulateDemoEvent: async (payload = {}) => {
    return api.post('/demo/ingest-event', payload);
  },
};

export default alertService;


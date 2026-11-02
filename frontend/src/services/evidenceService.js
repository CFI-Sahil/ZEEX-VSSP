import api from './api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export const evidenceService = {
  getEvidence: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.cameraCode) query.append('cameraCode', params.cameraCode);
    if (params.alertCode) query.append('alertCode', params.alertCode);

    const queryString = query.toString();
    const endpoint = queryString ? `/evidence?${queryString}` : '/evidence';
    return api.get(endpoint);
  },

  getEvidenceById: async (id) => {
    return api.get(`/evidence/${id}`);
  },

  getEvidenceFileUrl: (id) => {
    return `${BASE_URL.replace(/\/+$/, '')}/evidence/${id}/file`;
  },
};

export default evidenceService;


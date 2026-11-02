import api from './api';

export const cameraService = {
  getCameras: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.search && params.search.trim()) query.append('search', params.search.trim());
    if (params.status && params.status !== 'ALL') query.append('status', params.status);

    const queryString = query.toString();
    const endpoint = queryString ? `/cameras?${queryString}` : '/cameras';
    return api.get(endpoint);
  },

  getCameraById: async (id) => {
    return api.get(`/cameras/${id}`);
  },

  createCamera: async (data) => {
    return api.post('/cameras', data);
  },

  updateCamera: async (id, data) => {
    return api.patch(`/cameras/${id}`, data);
  },
};

export default cameraService;


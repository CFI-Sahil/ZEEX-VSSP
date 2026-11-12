import api from './api';

export const eventService = {
  /**
   * Retrieves paginated detection event intake records with optional filters
   */
  getIntakeEvents: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.search && params.search.trim()) query.append('search', params.search.trim());
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.source && params.source !== 'ALL') query.append('source', params.source);
    if (params.cameraCode) query.append('cameraCode', params.cameraCode);

    const queryString = query.toString();
    const endpoint = queryString ? `/events/intake?${queryString}` : '/events/intake';
    return api.get(endpoint);
  },

  /**
   * Retrieves intake KPIs and performance metrics
   */
  getIntakeStats: async () => {
    return api.get('/events/intake/stats');
  },

  /**
   * Retrieves details for a single intake event record
   */
  getIntakeEventById: async (id) => {
    return api.get(`/events/intake/${id}`);
  },

  /**
   * Submits a detection event to the intake endpoint
   */
  submitIntakeEvent: async (payload = {}) => {
    return api.post('/events/intake', payload);
  },

  /**
   * Evaluates and processes a single accepted detection event by ID
   */
  processEventById: async (id) => {
    return api.post(`/events/${id}/process`);
  },

  /**
   * Triggers batch processing of pending accepted events
   */
  processBatchQueue: async (limit = 10) => {
    return api.post('/events/process-queue', { limit });
  },

  /**
   * Retrieves real-time metrics for the event processing pipeline
   */
  getProcessingQueueStats: async () => {
    return api.get('/events/processing-queue/status');
  },
};

export default eventService;


import api from './api';

export const notificationService = {
  /**
   * Fetches paginated in-app notifications
   */
  getNotifications: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.channel && params.channel !== 'ALL') query.append('channel', params.channel);
    if (params.isRead !== undefined && params.isRead !== 'ALL') query.append('isRead', params.isRead);
    if (params.escalationLevel && params.escalationLevel !== 'ALL') query.append('escalationLevel', params.escalationLevel);

    const queryString = query.toString();
    const endpoint = queryString ? `/notifications?${queryString}` : '/notifications';
    return api.get(endpoint);
  },

  /**
   * Fetches count of unread in-app notifications
   */
  getUnreadCount: async () => {
    return api.get('/notifications/unread-count');
  },

  /**
   * Marks a single in-app notification as read
   */
  markAsRead: async (id) => {
    return api.patch(`/notifications/${id}/read`, {});
  },

  /**
   * Marks all in-app notifications as read
   */
  markAllAsRead: async () => {
    return api.patch('/notifications/mark-all-read', {});
  },

  /**
   * Fetches delivery notification logs for a specific alert
   */
  getAlertNotifications: async (alertId) => {
    return api.get(`/notifications/alert/${alertId}`);
  },

  /**
   * Triggers manual/diagnostic SLA escalation evaluation
   */
  triggerSLAEvaluation: async () => {
    return api.post('/escalations/evaluate', {});
  },
};

export default notificationService;


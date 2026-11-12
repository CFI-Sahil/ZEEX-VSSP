import api from './api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export const evidenceService = {
  /**
   * Fetch paginated and filtered evidence records from Evidence Vault
   * @param {Object} params - Query filters (page, limit, search, cameraCode, alertCode, severity, violationType, storageDriver, startDate, endDate, sortBy, sortOrder)
   * @returns {Promise<Object>} API response envelope
   */
  getEvidence: async (params = {}) => {
    const query = new URLSearchParams();

    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.search && params.search.trim()) query.append('search', params.search.trim());
    if (params.cameraCode && params.cameraCode.trim()) query.append('cameraCode', params.cameraCode.trim());
    if (params.alertCode && params.alertCode.trim()) query.append('alertCode', params.alertCode.trim());
    if (params.severity && params.severity !== 'ALL') query.append('severity', params.severity);
    if (params.violationType && params.violationType !== 'ALL') query.append('violationType', params.violationType);
    if (params.storageDriver && params.storageDriver !== 'ALL') query.append('storageDriver', params.storageDriver);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);

    const queryString = query.toString();
    const endpoint = queryString ? `/evidence?${queryString}` : '/evidence';
    return api.get(endpoint);
  },

  /**
   * Fetch aggregate repository metrics for the Evidence Vault KPI ribbon
   * @returns {Promise<Object>} API response envelope with vault stats
   */
  getEvidenceStats: async () => {
    return api.get('/evidence/stats');
  },

  /**
   * Retrieve single evidence document by ObjectId with populated context
   * @param {string} id - Evidence ObjectId
   * @param {boolean} [verify=false] - Whether to actively verify current bytes against baseline
   * @returns {Promise<Object>} API response envelope
   */
  getEvidenceById: async (id, verify = false) => {
    return api.get(`/evidence/${id}${verify ? '?verify=true' : ''}`);
  },

  /**
   * Actively verify cryptographic SHA-256 integrity by comparing current bytes with baseline hash
   * @param {string} id - Evidence ObjectId
   * @returns {Promise<Object>} Verification result envelope with integrityStatus
   */
  verifyEvidence: async (id) => {
    return api.post(`/evidence/${id}/verify`, {});
  },

  /**
   * Formats the proxy URL for streaming or downloading an image file
   * @param {string} id - Evidence ObjectId
   * @param {boolean} [download=false] - Whether to trigger attachment download
   * @returns {string} Fully qualified proxy endpoint URL
   */
  getEvidenceFileUrl: (id, download = false) => {
    const base = `${BASE_URL.replace(/\/+$/, '')}/evidence/${id}/file`;
    return download ? `${base}?download=true` : base;
  },

  /**
   * Authenticated direct file download trigger
   * Streams file bytes via session credentials, triggers EVIDENCE_DOWNLOADED audit log,
   * and saves attachment safely to user's local disk
   * @param {string} id - Evidence ObjectId
   * @param {string} [fileName='evidence-snapshot.jpg'] - Target file name
   */
  downloadEvidence: async (id, fileName = 'evidence-snapshot.jpg') => {
    const url = evidenceService.getEvidenceFileUrl(id, true);
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to download evidence file (HTTP ${response.status})`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },
};

export default evidenceService;

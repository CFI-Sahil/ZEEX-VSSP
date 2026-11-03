/**
 * Centralized API Client
 * - Configured with credentialed CORS (sends and receives HttpOnly cookies)
 * - Automatically attaches session-bound Double-Submit CSRF tokens
 * - Standardizes error and response handling
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const CSRF_STORAGE_KEY = 'vssp_csrf_token';
let inMemoryCsrf = null;

// Restore from sessionStorage on module load if available (survives tab page reloads)
if (typeof window !== 'undefined' && window.sessionStorage) {
  try {
    inMemoryCsrf = window.sessionStorage.getItem(CSRF_STORAGE_KEY) || null;
  } catch (e) {
    // Storage unavailable (e.g. sandboxed iframe or private mode)
  }
}

/**
 * Persists CSRF token into memory and sessionStorage
 */
export function saveCsrfToken(token) {
  if (!token || typeof token !== 'string') return;
  inMemoryCsrf = token;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(CSRF_STORAGE_KEY, token);
    } catch (e) {}
  }
}

/**
 * Clears CSRF token on logout or session expiration
 */
export function clearCsrfToken() {
  inMemoryCsrf = null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(CSRF_STORAGE_KEY);
    } catch (e) {}
  }
}

/**
 * Retrieves active CSRF token via multi-tier fallback:
 * 1. document.cookie (same-domain dev)
 * 2. in-memory variable (fast access)
 * 3. sessionStorage (cross-origin production across reloads)
 */
export function getActiveCsrfToken() {
  const cookieVal = getCookie('vssp_csrf');
  if (cookieVal) return cookieVal;

  if (inMemoryCsrf) return inMemoryCsrf;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem(CSRF_STORAGE_KEY);
      if (stored) {
        inMemoryCsrf = stored;
        return stored;
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Extracts a cookie value by name from document.cookie
 */
function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + escapedName + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
  constructor(message, status = 500, errors = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

async function request(endpoint, options = {}) {
  // Normalize URL with or without leading/trailing slashes
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BASE_URL.replace(/\/+$/, '')}${formattedEndpoint}`;

  const headers = { ...options.headers };

  // Set Content-Type only if not FormData and not already specified
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // For state-changing requests, attach CSRF token from active token sources
  const isMutating = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(
    (options.method || 'GET').toUpperCase()
  );

  if (isMutating && !headers['X-CSRF-Token']) {
    const csrfToken = getActiveCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const config = {
    ...options,
    headers,
    credentials: 'include', // Sends HttpOnly session cookies
  };

  try {
    const response = await fetch(url, config);

    // Track CSRF token from response headers if returned (CORS exposed)
    const headerCsrf = response.headers.get('x-csrf-token');
    if (headerCsrf) {
      saveCsrfToken(headerCsrf);
    }

    // Handle logout cleanup
    if (formattedEndpoint === '/auth/logout') {
      clearCsrfToken();
    }

    // 204 No Content
    if (response.status === 204) {
      return { success: true };
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    const data = isJson ? await response.json() : await response.text();

    // Track CSRF token from JSON response body
    if (data?.data?.csrfToken) {
      saveCsrfToken(data.data.csrfToken);
    } else if (data?.csrfToken) {
      saveCsrfToken(data.csrfToken);
    }

    if (!response.ok) {
      const errorMessage = data?.message || `Request failed with status ${response.status}`;
      const errors = data?.errors || null;
      throw new ApiError(errorMessage, response.status, errors);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Network connection failed', 0);
  }
}

export const api = {
  get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) =>
    request(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: (endpoint, body, options) =>
    request(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' }),
};

export default api;


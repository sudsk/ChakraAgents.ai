// frontend/src/services/api.js

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Generic API client for making requests to the backend
 */
class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Create request headers with authentication if available
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add authentication token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Handle API responses and errors
   */
  async handleResponse(response) {
    if (!response.ok) {
      // For 401 Unauthorized, redirect to login
      if (response.status === 401) {
        // Clear auth data and redirect to login would go here
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        return;
      }

      // Try to get error message from response
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || 'An error occurred';
      } catch (e) {
        errorMessage = `Error: ${response.status} ${response.statusText}`;
      }

      throw new Error(errorMessage);
    }

    // For empty responses (like 204 No Content)
    if (response.status === 204) {
      return {};
    }

    return await response.json();
  }

  /**
   * Make a GET request to the API
   */
  async get(endpoint, queryParams = {}) {
    // Build query string
    const queryString = Object.keys(queryParams).length
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const response = await fetch(`${this.baseUrl}${endpoint}${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Make a POST request to the API
   */
  async post(endpoint, data = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  /**
   * Make a PUT request to the API
   */
  async put(endpoint, data = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  /**
   * Make a DELETE request to the API
   */
  async delete(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }
}

// Create and export API service instances
const apiClient = new ApiClient();

// Templates API
export const templatesApi = {
  getAll: () => apiClient.get('/api/templates'),
  getById: (id) => apiClient.get(`/api/templates/${id}`),
  create: (data) => apiClient.post('/api/templates', data),
  update: (id, data) => apiClient.put(`/api/templates/${id}`, data),
  delete: (id) => apiClient.delete(`/api/templates/${id}`),
};

// Workflows API
export const workflowsApi = {
  getAll: () => apiClient.get('/api/workflows'),
  getById: (id) => apiClient.get(`/api/workflows/${id}`),
  create: (data) => apiClient.post('/api/workflows', data),
  update: (id, data) => apiClient.put(`/api/workflows/${id}`, data),
  delete: (id) => apiClient.delete(`/api/workflows/${id}`),
};

// Executions API
export const executionsApi = {
  getAll: (limit = 10) => apiClient.get('/api/workflow-executions/recent', { limit }),
  getById: (id) => apiClient.get(`/api/workflow-executions/${id}`),
  create: (data) => apiClient.post('/api/workflow-executions', data),
};

// Settings API
export const settingsApi = {
  getAll: () => apiClient.get('/settings'),
  update: (data) => apiClient.put('/settings', data),
};

export default apiClient;

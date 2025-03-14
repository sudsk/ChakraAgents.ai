// frontend/src/services/api.js

/**
 * Base API service for handling requests to the backend
 */
class ApiClient {
  constructor(baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate headers for API requests, including auth token if available
   * @returns {Object} Headers object
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
   * @param {Response} response - Fetch response object
   * @returns {Promise<any>} Parsed response data
   */
  async handleResponse(response) {
    if (!response.ok) {
      // For 401 Unauthorized, redirect to login
      if (response.status === 401) {
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
   * @param {string} endpoint - API endpoint
   * @param {Object} queryParams - Query parameters
   * @returns {Promise<any>} Response data
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
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<any>} Response data
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
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<any>} Response data
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
   * Make a PATCH request to the API
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<any>} Response data
   */
  async patch(endpoint, data = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  /**
   * Make a DELETE request to the API
   * @param {string} endpoint - API endpoint
   * @returns {Promise<any>} Response data
   */
  async delete(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Upload a file to the API
   * @param {string} endpoint - API endpoint
   * @param {FormData} formData - Form data with files
   * @returns {Promise<any>} Response data
   */
  async uploadFile(endpoint, formData) {
    const headers = this.getHeaders();
    // Remove Content-Type header to let the browser set it with the boundary
    delete headers['Content-Type'];

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });

    return this.handleResponse(response);
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Agentic Workflows API - only focused on agentic workflows
export const workflowsApi = {
  // Get all agentic workflows
  getAll: (params) => apiClient.get('/api/agentic/workflows', params),
  
  // Get a specific workflow
  getById: (id) => apiClient.get(`/api/agentic/workflows/${id}`),
  
  // Create a new agentic workflow
  create: (data) => apiClient.post('/api/agentic/workflows', data),
  
  // Update an existing workflow
  update: (id, data) => apiClient.put(`/api/agentic/workflows/${id}`, data),
  
  // Delete a workflow
  delete: (id) => apiClient.delete(`/api/agentic/workflows/${id}`),
  
  // Run a workflow
  run: (id, data) => apiClient.post(`/api/agentic/workflows/${id}/run`, data),
  
  // Validate a workflow
  validate: (config) => apiClient.post('/api/agentic/validate', { config }),
};

// Executions API
export const executionsApi = {
  // Get all workflow executions
  getAll: (params) => apiClient.get('/api/agentic/executions', params),
  
  // Get a specific execution
  getById: (id) => apiClient.get(`/api/agentic/executions/${id}`),
  
  // Cancel an execution
  cancel: (id) => apiClient.post(`/api/agentic/executions/${id}/cancel`),
  
  // Get execution details like decisions, agent interactions
  getDecisions: (id) => apiClient.get(`/api/agentic/executions/${id}/decisions`),
  getGraph: (id) => apiClient.get(`/api/agentic/executions/${id}/graph`),
  getInteractions: (id) => apiClient.get(`/api/agentic/executions/${id}/interactions`),
};

// Tools API
export const toolsApi = {
  // Get all tools
  getAll: () => apiClient.get('/api/agentic/tools'),
  
  // Get a specific tool
  getById: (id) => apiClient.get(`/api/agentic/tools/${id}`),
  
  // Create a new tool
  create: (data) => apiClient.post('/api/agentic/tools', data),
  
  // Update a tool
  update: (id, data) => apiClient.put(`/api/agentic/tools/${id}`, data),
  
  // Delete a tool
  delete: (id) => apiClient.delete(`/api/agentic/tools/${id}`),
  
  // Test a tool
  test: (name, params) => apiClient.post('/api/agentic/tools/test', { tool_name: name, parameters: params }),
};

// Knowledge Base API
export const knowledgeApi = {
  // Get all documents
  getDocuments: (params) => apiClient.get('/api/knowledge/documents', params),
  
  // Upload a document
  uploadDocument: (formData) => apiClient.uploadFile('/api/knowledge/documents/upload', formData),
  
  // Delete a document
  deleteDocument: (id) => apiClient.delete(`/api/knowledge/documents/${id}`),
  
  // Reindex a document
  reindexDocument: (id) => apiClient.post(`/api/knowledge/documents/${id}/reindex`),
  
  // Test knowledge retrieval
  testRetrieval: (query, params) => apiClient.post('/api/knowledge/test', { query, ...params }),
};

// Templates API
export const templatesApi = {
  // Get all templates
  getAll: (params) => apiClient.get('/api/templates', params),
  
  // Get a specific template
  getById: (id) => apiClient.get(`/api/templates/${id}`),
  
  // Create a new template
  create: (data) => apiClient.post('/api/templates', data),
  
  // Update a template
  update: (id, data) => apiClient.put(`/api/templates/${id}`, data),
  
  // Delete a template
  delete: (id) => apiClient.delete(`/api/templates/${id}`),
};

// Settings API
export const settingsApi = {
  get: () => apiClient.get('/api/settings'),
  update: (data) => apiClient.put('/api/settings', data),
};

export default apiClient;

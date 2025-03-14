// frontend/src/services/agenticApi.js
import apiClient from './api';

/**
 * Agentic API service for interacting with the agentic workflow backend
 */
class AgenticApiService {
  /**
   * Create a new agentic workflow execution
   * @param {string} workflowId - ID of the workflow to execute
   * @param {Object} inputData - Input data for the workflow
   * @param {Object} options - Additional execution options
   * @returns {Promise<Object>} - Execution response
   */
  async createExecution(workflowId, inputData = {}, options = {}) {
    return apiClient.post('/api/v1/agentic/executions', {
      workflow_id: workflowId,
      input_data: inputData,
      options: options
    });
  }

  /**
   * Get details of a specific agentic execution
   * @param {string} executionId - ID of the execution to retrieve
   * @returns {Promise<Object>} - Execution details
   */
  async getExecution(executionId) {
    return apiClient.get(`/api/v1/agentic/executions/${executionId}`);
  }

  /**
   * Get a list of recent agentic executions
   * @param {number} limit - Maximum number of executions to retrieve
   * @param {number} offset - Offset for pagination
   * @param {string} workflowId - Optional workflow ID filter
   * @returns {Promise<Array>} - List of executions
   */
  async listExecutions(limit = 10, offset = 0, workflowId = null) {
    const params = { limit, offset };
    if (workflowId) {
      params.workflow_id = workflowId;
    }
    
    return apiClient.get('/api/v1/agentic/executions', params);
  }

  /**
   * Cancel a running agentic execution
   * @param {string} executionId - ID of the execution to cancel
   * @returns {Promise<void>}
   */
  async cancelExecution(executionId) {
    return apiClient.post(`/api/v1/agentic/executions/${executionId}/cancel`);
  }

  /**
   * Validate an agentic workflow configuration
   * @param {Object} workflowConfig - The workflow configuration to validate
   * @returns {Promise<Object>} - Validation results
   */
  async validateWorkflow(workflowConfig) {
    return apiClient.post('/api/v1/agentic/validation', {
      workflow_config: workflowConfig
    });
  }

  /**
   * Test a specific tool with given parameters
   * @param {string} toolName - Name of the tool to test
   * @param {Object} parameters - Tool parameters
   * @returns {Promise<Object>} - Tool test results
   */
  async testTool(toolName, parameters = {}) {
    return apiClient.post('/api/v1/agentic/tools/test', {
      tool_name: toolName,
      parameters: parameters
    });
  }

  /**
   * Get a list of available tools
   * @returns {Promise<Array>} - List of available tools
   */
  async getTools() {
    return apiClient.get('/api/v1/agentic/tools');
  }

  /**
   * Create a new tool
   * @param {Object} toolDefinition - The tool definition
   * @returns {Promise<Object>} - Created tool
   */
  async createTool(toolDefinition) {
    return apiClient.post('/api/v1/agentic/tools', toolDefinition);
  }

  /**
   * Update an existing tool
   * @param {string} toolName - Name of the tool to update
   * @param {Object} toolDefinition - Updated tool definition
   * @returns {Promise<Object>} - Updated tool
   */
  async updateTool(toolName, toolDefinition) {
    return apiClient.put(`/api/v1/agentic/tools/${toolName}`, toolDefinition);
  }

  /**
   * Delete a tool
   * @param {string} toolName - Name of the tool to delete
   * @returns {Promise<void>}
   */
  async deleteTool(toolName) {
    return apiClient.delete(`/api/v1/agentic/tools/${toolName}`);
  }

  /**
   * Get the execution graph for a specific execution
   * @param {string} executionId - ID of the execution
   * @returns {Promise<Object>} - Execution graph data
   */
  async getExecutionGraph(executionId) {
    return apiClient.get(`/api/v1/agentic/executions/${executionId}/graph`);
  }

  /**
   * Get the agent decisions for a specific execution
   * @param {string} executionId - ID of the execution
   * @returns {Promise<Array>} - List of agent decisions
   */
  async getAgentDecisions(executionId) {
    return apiClient.get(`/api/v1/agentic/executions/${executionId}/decisions`);
  }

  /**
   * Get real-time status updates for an execution using polling
   * @param {string} executionId - ID of the execution 
   * @param {function} onUpdate - Callback for status updates
   * @param {number} interval - Polling interval in milliseconds
   * @returns {Object} - Controller with stop function
   */
  getExecutionUpdates(executionId, onUpdate, interval = 2000) {
    let isStopped = false;
    
    const pollExecution = async () => {
      if (isStopped) return;
      
      try {
        const executionData = await this.getExecution(executionId);
        onUpdate(executionData);
        
        // Continue polling if execution is still running
        if (executionData.status === 'running' || executionData.status === 'pending') {
          setTimeout(pollExecution, interval);
        }
      } catch (error) {
        console.error('Error polling execution:', error);
        // Try again after a delay, even on error
        if (!isStopped) {
          setTimeout(pollExecution, interval * 2);
        }
      }
    };
    
    // Start polling
    pollExecution();
    
    // Return controller to stop polling
    return {
      stop: () => { isStopped = true; }
    };
  }
}

// Create a singleton instance
const agenticApiService = new AgenticApiService();
export default agenticApiService;

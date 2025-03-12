// frontend/src/utils/ragUtils.js

/**
 * Utility functions for working with RAG functionalities
 */

/**
 * Get the RAG tool definition for use in templates
 * @returns {Object} RAG tool definition
 */
export const getRagToolDefinition = () => {
  return {
    name: "retrieve_information",
    description: "Retrieve relevant information from the knowledge base for the given query",
    function_name: "retrieve_information",
    parameters: {
      query: {
        type: "string",
        description: "The search query"
      },
      num_results: {
        type: "integer",
        description: "Number of results to retrieve (default: 5)"
      }
    }
  };
};

/**
 * Create default RAG configuration
 * @returns {Object} Default RAG configuration
 */
export const createDefaultRagConfig = () => {
  return {
    enabled: true,
    retrievalSettings: {
      numResults: 5,
      similarityThreshold: 0.7,
      includeMetadata: true,
      maxTokensPerDocument: 1000
    },
    vectorStoreSettings: {
      storeName: 'default',
      embeddingModel: 'vertex_ai',
      dimensions: 768
    },
    promptSettings: {
      systemMessage: "You are a helpful assistant with access to a knowledge base. Answer questions based on the retrieved information when available. If the retrieved information doesn't contain the answer, state that clearly before providing your best response.",
      retrievalPrompt: "Retrieve information related to this query: {query}"
    }
  };
};

/**
 * Check if a template has RAG capabilities
 * @param {Object} template The template to check 
 * @returns {boolean} Whether the template has RAG capabilities
 */
export const templateHasRagCapabilities = (template) => {
  if (!template) return false;
  
  // Direct RAG template
  if (template.workflow_type === 'rag') return true;
  
  // RAG enabled in config
  if (template.config?.rag_enabled === true) return true;
  
  // Check for RAG tools in agents
  if (template.workflow_type === 'supervisor') {
    const workers = template.config?.workers || [];
    return workers.some(worker => 
      worker.tools && worker.tools.includes('retrieve_information')
    );
  }
  
  if (template.workflow_type === 'swarm') {
    const agents = template.config?.agents || [];
    return agents.some(agent => 
      agent.tools && agent.tools.includes('retrieve_information')
    );
  }
  
  return false;
};

/**
 * Generate placeholders that should be included in agent prompts for RAG
 * @returns {Object} Placeholder examples for RAG
 */
export const getRagPromptPlaceholders = () => {
  return {
    retrieved_information: "Information will be retrieved from the knowledge base before being inserted here",
    query: "The user's original query"
  };
};

/**
 * Get example system prompt for RAG
 * @returns {string} Example system prompt for RAG
 */
export const getExampleRagSystemPrompt = () => {
  return `You are an assistant with access to a knowledge base. When answering questions:

1. Use the retrieved information to provide accurate, factual answers
2. Cite your sources when using specific information
3. If the retrieved information doesn't answer the question, clearly state that before providing your own knowledge
4. Don't fabricate information or create fake citations
`;
};

export default {
  getRagToolDefinition,
  createDefaultRagConfig,
  templateHasRagCapabilities,
  getRagPromptPlaceholders,
  getExampleRagSystemPrompt
};

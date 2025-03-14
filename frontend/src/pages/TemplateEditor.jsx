/* eslint-disable no-unused-vars */
import apiClient from '../services/api';
import RAGConfigurationPanel from '../components/RAGConfigurationPanel';  
import RAGTestConsole from '../components/RAGTestConsole';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  FormHelperText,
  Heading,
  Input,
  Select,
  Textarea,
  VStack,
  HStack,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  SimpleGrid,
  Divider,
  IconButton,
  Flex,
  useToast,
  Badge,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Code,
  Switch,
  Spinner,
  Icon
} from '@chakra-ui/react';
import { FiSave, FiPlus, FiTrash2, FiArrowLeft, FiPlay, FiCpu, FiList, FiTool, FiSettings, FiUsers, FiDatabase  } from 'react-icons/fi';

// Define component for agent configuration form
const AgentConfigForm = ({ agent, onChange, onDelete, isNew, providers, modelOptions }) => {
  const handleChange = (field, value) => {
    onChange({ ...agent, [field]: value });
  };

  return (
    <Card mb={4} borderWidth="1px" borderColor="gray.200">
      <CardBody>
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="md">
            {agent.role === 'supervisor' ? 'Supervisor Agent' : `Agent: ${agent.name}`}
          </Heading>
          {!isNew && onDelete && agent.role !== 'supervisor' && (
            <IconButton
              icon={<FiTrash2 />}
              variant="ghost"
              colorScheme="red"
              aria-label="Delete agent"
              onClick={onDelete}
            />
          )}
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
          <FormControl isRequired>
            <FormLabel>Agent Name</FormLabel>
            <Input
              value={agent.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. researcher_agent"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Role</FormLabel>
            <Select
              value={agent.role || ''}
              onChange={(e) => handleChange('role', e.target.value)}
              placeholder="Select role"
              isDisabled={agent.role === 'supervisor'}
            >
              <option value="worker">Worker</option>
              <option value="critic">Critic</option>
              <option value="executor">Executor</option>
              <option value="planner">Planner</option>
              <option value="researcher">Researcher</option>
              <option value="custom">Custom</option>
            </Select>
          </FormControl>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
          <FormControl isRequired>
            <FormLabel>Model Provider</FormLabel>
            <Select
              value={agent.model_provider || ''}
              onChange={(e) => handleChange('model_provider', e.target.value)}
              placeholder="Select provider"
            >
              {providers.map(provider => (
                <option key={provider.value} value={provider.value}>{provider.label}</option>
              ))}
            </Select>
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Model Name</FormLabel>
            <Select
              value={agent.model_name || ''}
              onChange={(e) => handleChange('model_name', e.target.value)}
              placeholder="Select model"
              isDisabled={!agent.model_provider}
            >
              {modelOptions
                .filter(model => model.provider === agent.model_provider)
                .map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))
              }
            </Select>
          </FormControl>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
          <FormControl>
            <FormLabel>Temperature</FormLabel>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={agent.temperature || 0.7}
              onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            />
            <FormHelperText>0 = deterministic, 1 = creative</FormHelperText>
          </FormControl>

          <FormControl>
            <FormLabel>Max Tokens</FormLabel>
            <Input
              type="number"
              value={agent.max_tokens || ''}
              onChange={(e) => handleChange('max_tokens', parseInt(e.target.value))}
              placeholder="Leave empty for default"
            />
          </FormControl>
        </SimpleGrid>

        <FormControl mb={4}>
          <FormLabel>System Message (Optional)</FormLabel>
          <Textarea
            value={agent.system_message || ''}
            onChange={(e) => handleChange('system_message', e.target.value)}
            placeholder="System message to guide the agent's behavior"
            rows={3}
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Prompt Template</FormLabel>
          <Textarea
            value={agent.prompt_template || ''}
            onChange={(e) => handleChange('prompt_template', e.target.value)}
            placeholder="Enter the prompt template with placeholders like {input}"
            rows={6}
          />
          <FormHelperText>
            Use variables like {'{input}'}, {'{previous_outputs}'}, etc. as needed
          </FormHelperText>
        </FormControl>
      </CardBody>
    </Card>
  );
};

// Tool configuration form
const ToolConfigForm = ({ tool, onChange, onDelete, isNew }) => {
  const handleChange = (field, value) => {
    onChange({ ...tool, [field]: value });
  };

  return (
    <Card mb={4} borderWidth="1px" borderColor="gray.200">
      <CardBody>
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="md">
            {tool.name ? `Tool: ${tool.name}` : 'New Tool'}
          </Heading>
          {!isNew && onDelete && (
            <IconButton
              icon={<FiTrash2 />}
              variant="ghost"
              colorScheme="red"
              aria-label="Delete tool"
              onClick={onDelete}
            />
          )}
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
          <FormControl isRequired>
            <FormLabel>Tool Name</FormLabel>
            <Input
              value={tool.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. web_search"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Function Name</FormLabel>
            <Input
              value={tool.function_name || ''}
              onChange={(e) => handleChange('function_name', e.target.value)}
              placeholder="e.g. search_web"
            />
            <FormHelperText>The backend function that implements this tool</FormHelperText>
          </FormControl>
        </SimpleGrid>

        <FormControl mb={4} isRequired>
          <FormLabel>Description</FormLabel>
          <Textarea
            value={tool.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Describe what this tool does and when to use it"
            rows={3}
          />
        </FormControl>

        <FormControl>
          <FormLabel>Parameters</FormLabel>
          <Code p={3} borderRadius="md" w="100%" display="block" whiteSpace="pre" mb={2}>
            {JSON.stringify(tool.parameters || {}, null, 2)}
          </Code>
          <FormHelperText>
            Edit directly in JSON format. Example: {"{"}"query": {"{"}"type": "string", "description": "The search query"{"}"}{"}"}
          </FormHelperText>
        </FormControl>
      </CardBody>
    </Card>
  );
};

// Main TemplateEditor component
const TemplateEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNewTemplate = !id;

  // State
  const [template, setTemplate] = useState({
    name: '',
    description: '',
    workflow_type: 'supervisor',
    config: {
      tools: [],
      workers: [],
      agents: [],
      workflow_config: {
        max_iterations: 3,
        checkpoint_dir: './checkpoints'
      }
    }
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Add to the useState calls:
  const [ragConfig, setRagConfig] = useState({
    enabled: false,
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
      systemMessage: "You are a helpful assistant with access to a knowledge base. Answer questions based on the retrieved information when available.",
      retrievalPrompt: "Retrieve information related to this query: {query}"
    }
  });
  
  // Add this function to handle RAG configuration changes:
  const handleRagConfigChange = (newConfig) => {
    setRagConfig(newConfig);
    
    // Update the template with RAG configuration
    setTemplate(prev => ({
      ...prev,
      config: {
        ...prev.config,
        rag_enabled: newConfig.enabled,
        rag_config: {
          retrievalSettings: newConfig.retrievalSettings,
          vectorStoreSettings: newConfig.vectorStoreSettings,
          promptSettings: newConfig.promptSettings
        }
      }
    }));
    
    // If RAG is enabled, add the retrieve_information tool to all agents
    if (newConfig.enabled) {
      if (template.workflow_type === 'rag') {
        // For dedicated RAG workflows, just update the config
        return;
      }
      
      if (template.workflow_type === 'supervisor') {
        // Add RAG tool to workers
        const updatedWorkers = template.config.workers.map(worker => {
          const workerTools = worker.tools || [];
          if (!workerTools.includes('retrieve_information')) {
            return {
              ...worker,
              tools: [...workerTools, 'retrieve_information']
            };
          }
          return worker;
        });
        
        setTemplate(prev => ({
          ...prev,
          config: {
            ...prev.config,
            workers: updatedWorkers
          }
        }));
      } else if (template.workflow_type === 'swarm') {
        // Add RAG tool to agents
        const updatedAgents = template.config.agents.map(agent => {
          const agentTools = agent.tools || [];
          if (!agentTools.includes('retrieve_information')) {
            return {
              ...agent,
              tools: [...agentTools, 'retrieve_information']
            };
          }
          return agent;
        });
        
        setTemplate(prev => ({
          ...prev,
          config: {
            ...prev.config,
            agents: updatedAgents
          }
        }));
      }
    }
  };

    
    // Available model providers and models
    const providers = [
      { value: 'vertex_ai', label: 'Vertex AI' },
      { value: 'openai', label: 'OpenAI' },
      { value: 'anthropic', label: 'Anthropic' },
      { value: 'custom', label: 'Custom Provider' }
    ];

  const modelOptions = [
    { provider: 'vertex_ai', value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { provider: 'vertex_ai', value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { provider: 'openai', value: 'gpt-4o', label: 'GPT-4o' },
    { provider: 'openai', value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { provider: 'openai', value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { provider: 'anthropic', value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { provider: 'anthropic', value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { provider: 'anthropic', value: 'claude-3-haiku', label: 'Claude 3 Haiku' }
  ];
  
  // Fetch template data if editing existing template
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setLoading(true);
        // Get template data using apiClient
        const data = await apiClient.get(`/api/templates/${id}`);  

        // Transform API response to component state format
        setTemplate({
          id: data.id,
          name: data.name,
          description: data.description || '',
          workflow_type: data.workflow_type,
          config: data.config
        });
      } catch (error) {
        console.error('Error fetching template:', error);
        toast({
          title: 'Error loading template',
          description: error.message || 'Failed to load template',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });

        // Navigate back to templates list on error
        navigate('/agentic/templates');
      } finally {
        setLoading(false);
      }
    };
        
    if (id) {
      // Fetch existing template data
      fetchTemplate();
    } else {
      // Initialize with default supervisor agent for new templates
      const defaultAgent = {
        name: 'supervisor',
        role: 'supervisor',
        model_provider: 'vertex_ai',
        model_name: 'gemini-1.5-pro',
        prompt_template: 'You are a supervisor agent coordinating a team of specialized agents.\nYour task is to break down the user query and delegate to appropriate workers.\n\nUser query: {input}',
        temperature: 0.3,
        max_tokens: 1024
      };
      
      setTemplate(prev => ({
        ...prev,
        config: {
          ...prev.config,
          supervisor: defaultAgent,
          workers: []
        }
      }));
    }
  }, [id, navigate, toast]);
  
  // Handle form field changes
  const handleFormChange = (field, value) => {
    setTemplate({
      ...template,
      [field]: value
    });
  };
  
  // Handle workflow type change
  const handleWorkflowTypeChange = (type) => {
    // Reset the config structure based on the workflow type
    let newConfig = {};
    
    if (type === 'supervisor') {
      // Get existing supervisor or create default
      const supervisor = template.config.supervisor || {
        name: 'supervisor',
        role: 'supervisor',
        model_provider: 'vertex_ai',
        model_name: 'gemini-1.5-pro',
        prompt_template: 'You are a supervisor agent coordinating a team of specialized agents.\nYour task is to break down the user query and delegate to appropriate workers.\n\nUser query: {input}',
        temperature: 0.3,
        max_tokens: 1024
      };
      
      newConfig = {
        supervisor,
        workers: template.config.workers || [],
        tools: template.config.tools || [],
        workflow_config: template.config.workflow_config || { max_iterations: 3 }
      };
    } else if (type === "swarm") {
      newConfig = {
        agents: template.config.agents || [],
        tools: template.config.tools || [],
        workflow_config: template.config.workflow_config || { 
          interaction_type: 'sequential',
          max_iterations: 3 
        }
      };
    } else if (type === "rag") {
      // Setup a RAG-specific configuration
      newConfig = {
        model_provider: 'vertex_ai',
        model_name: 'gemini-1.5-pro',
        system_message: 'You are a helpful assistant with access to a knowledge base. Answer questions based on the retrieved information when available. If the retrieved information doesn\'t contain the answer, state that clearly before providing your best response.',
        temperature: 0.3,
        num_results: 5,
        tools: [{
          name: 'retrieve_information',
          description: 'Retrieve relevant information from the knowledge base for the given query',
          function_name: 'retrieve_information',
          parameters: {
            query: {
              type: 'string',
              description: 'The search query'
            },
            num_results: {
              type: 'integer',
              description: 'Number of results to retrieve (default: 5)'
            }
          }
        }],
        workflow_config: {
          max_iterations: 1,
          checkpoint_dir: './checkpoints/rag_assistant'
        },
        rag_enabled: true,
        rag_config: {
          retrievalSettings: ragConfig.retrievalSettings,
          vectorStoreSettings: ragConfig.vectorStoreSettings,
          promptSettings: ragConfig.promptSettings
        }
      };
    
      // Update the RAG configuration state
      setRagConfig(prev => ({
        ...prev,
        enabled: true
      }));
    } 
    
    setTemplate({
      ...template,
      workflow_type: type,
      config: newConfig
    });
  };
  
  // Handle agent updates
  const handleAgentChange = (index, updatedAgent) => {
    if (template.workflow_type === 'supervisor') {
      if (updatedAgent.role === 'supervisor') {
        // Update supervisor
        setTemplate({
          ...template,
          config: {
            ...template.config,
            supervisor: updatedAgent
          }
        });
      } else {
        // Update worker
        const updatedWorkers = [...template.config.workers];
        updatedWorkers[index] = updatedAgent;
        setTemplate({
          ...template,
          config: {
            ...template.config,
            workers: updatedWorkers
          }
        });
      }
    } else {
      // Update swarm agent
      const updatedAgents = [...template.config.agents];
      updatedAgents[index] = updatedAgent;
      setTemplate({
        ...template,
        config: {
          ...template.config,
          agents: updatedAgents
        }
      });
    }
  };
  
  // Add new agent
  const addNewAgent = () => {
    const newAgent = {
      name: `agent_${Date.now().toString(36)}`,
      role: 'worker',
      model_provider: 'vertex_ai',
      model_name: 'gemini-1.5-flash',
      prompt_template: 'You are a specialized agent.\n\nTask: {input}',
      temperature: 0.7,
      max_tokens: 1024
    };
    
    if (template.workflow_type === 'supervisor') {
      setTemplate({
        ...template,
        config: {
          ...template.config,
          workers: [...(template.config.workers || []), newAgent]
        }
      });
    } else {
      setTemplate({
        ...template,
        config: {
          ...template.config,
          agents: [...(template.config.agents || []), newAgent]
        }
      });
    }
  };
  
  // Delete agent
  const deleteAgent = (index) => {
    if (template.workflow_type === 'supervisor') {
      const updatedWorkers = [...template.config.workers];
      updatedWorkers.splice(index, 1);
      setTemplate({
        ...template,
        config: {
          ...template.config,
          workers: updatedWorkers
        }
      });
    } else {
      const updatedAgents = [...template.config.agents];
      updatedAgents.splice(index, 1);
      setTemplate({
        ...template,
        config: {
          ...template.config,
          agents: updatedAgents
        }
      });
    }
  };
  
  // Handle tool updates
  const handleToolChange = (index, updatedTool) => {
    const updatedTools = [...(template.config.tools || [])];
    updatedTools[index] = updatedTool;
    setTemplate({
      ...template,
      config: {
        ...template.config,
        tools: updatedTools
      }
    });
  };
  
  // Add new tool
  const addNewTool = () => {
    const newTool = {
      name: `tool_${Date.now().toString(36)}`,
      description: 'Description of what this tool does',
      function_name: 'function_name',
      parameters: {
        "param1": {
          "type": "string",
          "description": "Parameter description"
        }
      }
    };
    
    setTemplate({
      ...template,
      config: {
        ...template.config,
        tools: [...(template.config.tools || []), newTool]
      }
    });
  };
  
  // Delete tool
  const deleteTool = (index) => {
    const updatedTools = [...template.config.tools];
    updatedTools.splice(index, 1);
    setTemplate({
      ...template,
      config: {
        ...template.config,
        tools: updatedTools
      }
    });
  };
  
  // Update workflow config
  const handleWorkflowConfigChange = (field, value) => {
    setTemplate({
      ...template,
      config: {
        ...template.config,
        workflow_config: {
          ...(template.config.workflow_config || {}),
          [field]: value
        }
      }
    });
  };
  
  // Save template
  const saveTemplate = async () => {
    // Validate fields
    if (!template.name) {
      toast({
        title: 'Validation Error',
        description: 'Template name is required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    if (template.workflow_type === 'supervisor' && !template.config.workers?.length) {
      toast({
        title: 'Validation Error',
        description: 'At least one worker agent is required for supervisor templates',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    if (template.workflow_type === 'swarm' && !template.config.agents?.length) {
      toast({
        title: 'Validation Error',
        description: 'At least one agent is required for swarm templates',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setSaving(true);
    
    try {
      let savedTemplate;
      if (id) {
        // Update existing template
        savedTemplate = await apiClient.put(`/api/templates/${id}`, template);
      } else {
        // Create new template
        savedTemplate = await apiClient.post('/api/templates', template);
      }

      toast({
        title: 'Success',
        description: `Template ${id ? 'updated' : 'created'} successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Redirect to templates list or the saved template
      navigate('/agentic/templates');
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save template',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <Flex justify="center" align="center" height="500px" width="100%">
        <Spinner size="xl" color="brand.500" />
      </Flex>
    );
  }
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <HStack>
          <IconButton
            icon={<FiArrowLeft />}
            onClick={() => navigate('/agentic/templates')}
            aria-label="Back to templates"
          />
          <Heading>
            {isNewTemplate ? 'Create New Template' : 'Edit Template'}
          </Heading>
        </HStack>
        
        <HStack>
          <Button
            leftIcon={<FiPlay />}
            colorScheme="green"
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Hide Preview' : 'Preview Template'}
          </Button>
          <Button
            leftIcon={<FiSave />}
            colorScheme="brand"
            onClick={saveTemplate}
            isLoading={saving}
          >
            Save Template
          </Button>
        </HStack>
      </Flex>
      
      <SimpleGrid columns={{ base: 1, lg: showPreview ? 2 : 1 }} spacing={8}>
        <Box>
          {/* Basic template details */}
          <Card mb={6}>
            <CardBody>
              <FormControl mb={4} isRequired>
                <FormLabel>Template Name</FormLabel>
                <Input
                  value={template.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g. Research Assistant"
                />
              </FormControl>
              
              <FormControl mb={4}>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={template.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Describe what this template does"
                  rows={3}
                />
              </FormControl>
              
              <FormControl mb={4} isRequired>
                <FormLabel>Workflow Type</FormLabel>
                <Select
                  value={template.workflow_type}
                  onChange={(e) => handleWorkflowTypeChange(e.target.value)}
                >
                  <option value="supervisor">Supervisor-Worker</option>
                  <option value="swarm">Agent Swarm</option>
                  <option value="rag">RAG (Retrieval-Augmented Generation)</option>
                </Select>
                <FormHelperText>
                  {template.workflow_type === 'supervisor' 
                    ? 'Supervisor agent coordinates worker agents'
                    : template.workflow_type === 'swarm'
                      ? 'Multiple agents collaborate as peers'
                      : template.workflow_type === 'rag'
                        ? 'Knowledge-base enhanced generation'
                        : 'Advanced multi-team architecture with flexible coordination'}
                </FormHelperText>
              </FormControl>
            </CardBody>
          </Card>
          
          {/* Template details tabs */}
          <Tabs colorScheme="brand" isLazy>
            <TabList>
              <Tab><Icon as={FiCpu} mr={2} /> Agents</Tab>
              <Tab><Icon as={FiTool} mr={2} /> Tools</Tab>
              <Tab><Icon as={FiSettings} mr={2} /> Settings</Tab>
              <Tab><Icon as={FiDatabase} mr={2} /> RAG</Tab>
            </TabList>            
            
            <TabPanels>
              {/* Agents Tab */}
              <TabPanel p={0} pt={4}>
                {template.workflow_type === 'supervisor' && template.config.supervisor && (
                  <AgentConfigForm
                    agent={template.config.supervisor}
                    onChange={(updatedAgent) => handleAgentChange(-1, updatedAgent)}
                    isNew={false}
                    providers={providers}
                    modelOptions={modelOptions}
                  />
                )}
                
                {template.workflow_type === 'supervisor' && (
                  <Box>
                    <Flex justify="space-between" align="center" mb={4}>
                      <Heading size="md">Worker Agents</Heading>
                      <Button
                        leftIcon={<FiPlus />}
                        colorScheme="brand"
                        variant="outline"
                        onClick={addNewAgent}
                      >
                        Add Worker Agent
                      </Button>
                    </Flex>
                    
                    {template.config.workers?.map((worker, index) => (
                      <AgentConfigForm
                        key={index}
                        agent={worker}
                        onChange={(updatedAgent) => handleAgentChange(index, updatedAgent)}
                        onDelete={() => deleteAgent(index)}
                        isNew={false}
                        providers={providers}
                        modelOptions={modelOptions}
                      />
                    ))}
                    
                    {!template.config.workers?.length && (
                      <Text color="gray.500" textAlign="center" py={4}>
                        No worker agents defined yet. Add some to get started.
                      </Text>
                    )}
                  </Box>
                )}
                
                {template.workflow_type === 'swarm' && (
                  <Box>
                    <Flex justify="space-between" align="center" mb={4}>
                      <Heading size="md">Swarm Agents</Heading>
                      <Button
                        leftIcon={<FiPlus />}
                        colorScheme="brand"
                        variant="outline"
                        onClick={addNewAgent}
                      >
                        Add Agent
                      </Button>
                    </Flex>
                    
                    {template.config.agents?.map((agent, index) => (
                      <AgentConfigForm
                        key={index}
                        agent={agent}
                        onChange={(updatedAgent) => handleAgentChange(index, updatedAgent)}
                        onDelete={() => deleteAgent(index)}
                        isNew={false}
                        providers={providers}
                        modelOptions={modelOptions}
                      />
                    ))}
                    
                    {!template.config.agents?.length && (
                      <Text color="gray.500" textAlign="center" py={4}>
                        No agents defined yet. Add some to get started.
                      </Text>
                    )}
                  </Box>
                )}
              </TabPanel>
              
              {/* Tools Tab */}
              <TabPanel p={0} pt={4}>
                <Flex justify="space-between" align="center" mb={4}>
                  <Heading size="md">Tools</Heading>
                  <Button
                    leftIcon={<FiPlus />}
                    colorScheme="brand"
                    variant="outline"
                    onClick={addNewTool}
                  >
                    Add Tool
                  </Button>
                </Flex>
                
                {template.config.tools?.map((tool, index) => (
                  <ToolConfigForm
                    key={index}
                    tool={tool}
                    onChange={(updatedTool) => handleToolChange(index, updatedTool)}
                    onDelete={() => deleteTool(index)}
                    isNew={false}
                  />
                ))}
                
                {!template.config.tools?.length && (
                  <Text color="gray.500" textAlign="center" py={4}>
                    No tools defined yet. Add some to enable agent capabilities.
                  </Text>
                )}
              </TabPanel>
              
              {/* Settings Tab */}
              <TabPanel p={0} pt={4}>
                <Card>
                  <CardBody>
                    <Heading size="md" mb={4}>Workflow Configuration</Heading>
                    
                    {template.workflow_type === 'swarm' && (
                      <FormControl mb={4}>
                        <FormLabel>Interaction Type</FormLabel>
                        <Select
                          value={template.config.workflow_config?.interaction_type || 'sequential'}
                          onChange={(e) => handleWorkflowConfigChange('interaction_type', e.target.value)}
                        >
                          <option value="sequential">Sequential</option>
                          <option value="hub_and_spoke">Hub and Spoke</option>
                        </Select>
                        <FormHelperText>
                          Sequential: Agents process in order. Hub and Spoke: One agent coordinates others.
                        </FormHelperText>
                      </FormControl>
                    )}
                    
                    {template.workflow_type === 'swarm' && 
                     template.config.workflow_config?.interaction_type === 'hub_and_spoke' && (
                      <FormControl mb={4}>
                        <FormLabel>Hub Agent</FormLabel>
                        <Select
                          value={template.config.workflow_config?.hub_agent || ''}
                          onChange={(e) => handleWorkflowConfigChange('hub_agent', e.target.value)}
                          placeholder="Select hub agent"
                        >
                          {template.config.agents?.map((agent, index) => (
                            <option key={index} value={agent.name}>{agent.name}</option>
                          ))}
                        </Select>
                        <FormHelperText>
                          The central agent that coordinates all other agents
                        </FormHelperText>
                      </FormControl>
                    )}
                    
                    <FormControl mb={4}>
                      <FormLabel>Max Iterations</FormLabel>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={template.config.workflow_config?.max_iterations || 3}
                        onChange={(e) => handleWorkflowConfigChange('max_iterations', parseInt(e.target.value))}
                      />
                      <FormHelperText>
                        Maximum number of iterations for agent interactions
                      </FormHelperText>
                    </FormControl>
                    
                    <FormControl mb={4}>
                      <FormLabel>Checkpoint Directory</FormLabel>
                      <Input
                        value={template.config.workflow_config?.checkpoint_dir || './checkpoints'}
                        onChange={(e) => handleWorkflowConfigChange('checkpoint_dir', e.target.value)}
                      />
                      <FormHelperText>
                        Directory to store workflow state checkpoints
                      </FormHelperText>
                    </FormControl>
                    
                    <FormControl mb={4}>
                      <FormLabel>Enable Logging</FormLabel>
                      <Switch
                        isChecked={template.config.workflow_config?.enable_logging || false}
                        onChange={(e) => handleWorkflowConfigChange('enable_logging', e.target.checked)}
                      />
                      <FormHelperText>
                        Enable detailed logging for debugging
                      </FormHelperText>
                    </FormControl>
                  </CardBody>
                </Card>
              </TabPanel>
              {/* RAG Configuration Tab */}
              <TabPanel p={0} pt={4}>
                <RAGConfigurationPanel 
                  config={{
                    enabled: template.config.rag_enabled || false,
                    retrievalSettings: template.config.rag_config?.retrievalSettings || ragConfig.retrievalSettings,
                    vectorStoreSettings: template.config.rag_config?.vectorStoreSettings || ragConfig.vectorStoreSettings,
                    promptSettings: template.config.rag_config?.promptSettings || ragConfig.promptSettings
                  }}
                  onChange={handleRagConfigChange}
                  isEditing={true}
                />
                
                {template.workflow_type === 'rag' && (
                  <Box mt={6}>
                    <Card>
                      <CardBody>
                        <Heading size="sm" mb={4}>RAG-Specific Model Settings</Heading>
                        
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
                          <FormControl isRequired>
                            <FormLabel>Model Provider</FormLabel>
                            <Select
                              value={template.config.model_provider || 'vertex_ai'}
                              onChange={(e) => handleFormChange('config', {
                                ...template.config,
                                model_provider: e.target.value
                              })}
                            >
                              {providers.map(provider => (
                                <option key={provider.value} value={provider.value}>{provider.label}</option>
                              ))}
                            </Select>
                          </FormControl>
          
                          <FormControl isRequired>
                            <FormLabel>Model Name</FormLabel>
                            <Select
                              value={template.config.model_name || 'gemini-1.5-pro'}
                              onChange={(e) => handleFormChange('config', {
                                ...template.config,
                                model_name: e.target.value
                              })}
                            >
                              {modelOptions
                                .filter(model => model.provider === template.config.model_provider)
                                .map(model => (
                                  <option key={model.value} value={model.value}>{model.label}</option>
                                ))
                              }
                            </Select>
                          </FormControl>
                        </SimpleGrid>
                        
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
                          <FormControl>
                            <FormLabel>Temperature</FormLabel>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              value={template.config.temperature || 0.3}
                              onChange={(e) => handleFormChange('config', {
                                ...template.config,
                                temperature: parseFloat(e.target.value)
                              })}
                            />
                            <FormHelperText>0 = deterministic, 1 = creative</FormHelperText>
                          </FormControl>
          
                          <FormControl>
                            <FormLabel>Number of Results</FormLabel>
                            <Input
                              type="number"
                              min="1"
                              max="20"
                              value={template.config.num_results || 5}
                              onChange={(e) => handleFormChange('config', {
                                ...template.config,
                                num_results: parseInt(e.target.value)
                              })}
                            />
                            <FormHelperText>Documents to retrieve per query</FormHelperText>
                          </FormControl>
                        </SimpleGrid>
                        
                        <FormControl mb={4}>
                          <FormLabel>System Message</FormLabel>
                          <Textarea
                            value={template.config.system_message || ''}
                            onChange={(e) => handleFormChange('config', {
                              ...template.config,
                              system_message: e.target.value
                            })}
                            placeholder="System message for RAG responses"
                            rows={3}
                          />
                        </FormControl>
                      </CardBody>
                    </Card>
                  </Box>
                )}
                
                {(template.config.rag_enabled || template.workflow_type === 'rag') && (
                  <Box mt={6}>
                    <RAGTestConsole 
                      config={{
                        ragEnabled: template.config.rag_enabled || template.workflow_type === 'rag',
                        workflowType: template.workflow_type,
                        retrievalSettings: template.config.rag_config?.retrievalSettings || ragConfig.retrievalSettings,
                        vectorStoreSettings: template.config.rag_config?.vectorStoreSettings || ragConfig.vectorStoreSettings,
                        modelProvider: template.config.model_provider || 'vertex_ai',
                        modelName: template.config.model_name || 'gemini-1.5-pro',
                        systemMessage: template.config.system_message || template.config.rag_config?.promptSettings?.systemMessage || '',
                        temperature: template.config.temperature || 0.3,
                        numResults: template.config.num_results || 5
                      }}
                    />
                  </Box>
                )}
              </TabPanel>              
            </TabPanels>
          </Tabs>
        </Box>
        
        {/* Template Preview */}
        {showPreview && (
          <Box>
            <Card>
              <CardBody>
                <Heading size="md" mb={4}>Template Preview</Heading>
                <Tabs variant="enclosed" size="sm">
                  <TabList>
                    <Tab>Visual</Tab>
                    <Tab>JSON</Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel>
                      <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.50">
                        <Heading size="sm" mb={3}>{template.name}</Heading>
                        <Text fontSize="sm" mb={4}>{template.description}</Text>
                        
                        <Box mb={4}>
                          <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>WORKFLOW TYPE</Text>
                          <Badge colorScheme={template.workflow_type === 'supervisor' ? 'blue' : 'purple'}>
                            {template.workflow_type}
                          </Badge>
                        </Box>
                        
                        {template.workflow_type === 'supervisor' && (
                          <Box mb={4}>
                            <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>SUPERVISOR</Text>
                            <HStack>
                              <Badge colorScheme="blue">{template.config.supervisor?.model_provider}</Badge>
                              <Text fontSize="sm">{template.config.supervisor?.name}</Text>
                            </HStack>
                            
                            <Divider my={3} />
                            
                            <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>WORKERS</Text>
                            {template.config.workers?.map((worker, idx) => (
                              <Box key={idx} mb={2}>
                                <HStack>
                                  <Badge colorScheme="green">{worker.role}</Badge>
                                  <Text fontSize="sm">{worker.name}</Text>
                                  <Badge colorScheme="gray">{worker.model_provider}</Badge>
                                </HStack>
                              </Box>
                            ))}
                          </Box>
                        )}
                        
                        {template.workflow_type === 'swarm' && (
                          <Box mb={4}>
                            <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>AGENTS</Text>
                            {template.config.agents?.map((agent, idx) => (
                              <Box key={idx} mb={2}>
                                <HStack>
                                  <Badge colorScheme="purple">{agent.role}</Badge>
                                  <Text fontSize="sm">{agent.name}</Text>
                                  <Badge colorScheme="gray">{agent.model_provider}</Badge>
                                </HStack>
                              </Box>
                            ))}
                            
                            <Divider my={3} />
                            
                            <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>INTERACTION TYPE</Text>
                            <Badge>
                              {template.config.workflow_config?.interaction_type || 'sequential'}
                            </Badge>
                            
                            {template.config.workflow_config?.interaction_type === 'hub_and_spoke' && (
                              <Box mt={2}>
                                <Text fontSize="xs">Hub Agent: {template.config.workflow_config?.hub_agent}</Text>
                              </Box>
                            )}
                          </Box>
                        )}
                        
                        <Box mb={4}>
                          <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>TOOLS</Text>
                          {template.config.tools?.map((tool, idx) => (
                            <Badge key={idx} mr={2} mb={2} colorScheme="orange">
                              {tool.name}
                            </Badge>
                          ))}
                          {!template.config.tools?.length && (
                            <Text fontSize="sm" color="gray.500">No tools configured</Text>
                          )}
                        </Box>
                      </Box>
                    </TabPanel>
                    <TabPanel>
                      <Box
                        p={4}
                        borderWidth="1px"
                        borderRadius="md"
                        fontFamily="mono"
                        fontSize="sm"
                        bg="gray.50"
                        overflow="auto"
                        maxH="600px"
                      >
                        <pre>{JSON.stringify(template, null, 2)}</pre>
                      </Box>
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </CardBody>
            </Card>
          </Box>
        )}
      </SimpleGrid>
    </Box>
  );
};

export default TemplateEditor;

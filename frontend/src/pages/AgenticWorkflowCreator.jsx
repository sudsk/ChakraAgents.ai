// frontend/src/pages/AgenticWorkflowCreator.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Textarea,
  Select,
  Switch,
  VStack,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  SimpleGrid,
  IconButton,
  Flex,
  Divider,
  Badge,
  Alert,
  AlertIcon,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  PopoverHeader,
  PopoverBody,
  Code,
  Spinner,
  useToast
} from '@chakra-ui/react';
import { 
  FiSave, 
  FiPlus, 
  FiTrash2, 
  FiArrowLeft, 
  FiPlay, 
  FiCpu, 
  FiList, 
  FiTool, 
  FiSettings, 
  FiDatabase, 
  FiMessageCircle, 
  FiInfo, 
  FiShare2,
  FiEdit
} from 'react-icons/fi';
import apiClient from '../services/api';
import { workflowsApi } from '../services/api';

// Agent configuration form with agentic capabilities
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
              <option value="hub">Hub</option>
              <option value="spoke">Spoke</option>
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
          <FormLabel>System Message</FormLabel>
          <HStack mb={2}>
            <Text fontSize="sm">Include agentic capabilities</Text>
            <Switch 
              isChecked={agent.agentic_system_message !== false}
              onChange={(e) => handleChange('agentic_system_message', e.target.checked)}
              colorScheme="purple"
            />
            <Popover>
              <PopoverTrigger>
                <IconButton
                  icon={<FiInfo />}
                  aria-label="Agentic system message info"
                  size="xs"
                  variant="ghost"
                />
              </PopoverTrigger>
              <PopoverContent>
                <PopoverArrow />
                <PopoverCloseButton />
                <PopoverHeader>Agentic System Message</PopoverHeader>
                <PopoverBody>
                  <Text fontSize="sm">
                    When enabled, the system message will include instructions on how to make agentic decisions, 
                    delegate tasks, use tools, and determine when to provide a final response.
                  </Text>
                </PopoverBody>
              </PopoverContent>
            </Popover>
          </HStack>
          <Textarea
            value={agent.system_message || ''}
            onChange={(e) => handleChange('system_message', e.target.value)}
            placeholder="System message to guide the agent's behavior"
            rows={3}
          />
          <FormHelperText>
            {agent.agentic_system_message !== false ? 
              "Agentic decision-making instructions will be added to this system message." :
              "Agentic capabilities are disabled for this agent."}
          </FormHelperText>
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Prompt Template</FormLabel>
          <HStack mb={2}>
            <Text fontSize="sm">Show agentic placeholders</Text>
            <Switch 
              id="show-agentic-placeholders" 
              colorScheme="purple"
              isChecked={agent.show_agentic_placeholders}
              onChange={(e) => handleChange('show_agentic_placeholders', e.target.checked)}
            />
          </HStack>
          <Textarea
            value={agent.prompt_template || ''}
            onChange={(e) => handleChange('prompt_template', e.target.value)}
            placeholder="Enter the prompt template with placeholders like {input}"
            rows={6}
          />
          <FormHelperText>
            Use placeholders: {'{input}'} (user query), {'{previous_outputs}'} (outputs from other agents),  
            {'{worker_outputs}'} (for supervisors), {'{hub_output}'} (for spoke agents)
          </FormHelperText>
        </FormControl>

        {agent.show_agentic_placeholders && (
          <Card mt={3} variant="outline" bg="purple.50">
            <CardBody>
              <Heading size="xs" mb={2}>Agentic Placeholders</Heading>
              <Text fontSize="sm" mb={2}>
                Add these placeholders to your prompt to enable proper agentic capabilities:
              </Text>
              <Code p={2} mb={2} display="block">
                {'{make_decision}'}
                <Text fontSize="xs" color="gray.600">Instructions for making decisions about delegation, tool use, etc.</Text>
              </Code>
              <Code p={2} mb={2} display="block">
                {'{available_agents}'}
                <Text fontSize="xs" color="gray.600">List of available agents that can be delegated to</Text>
              </Code>
              <Code p={2} mb={2} display="block">
                {'{available_tools}'}
                <Text fontSize="xs" color="gray.600">List of available tools that can be used</Text>
              </Code>
              <Code p={2} display="block">
                {'{previous_decisions}'}
                <Text fontSize="xs" color="gray.600">History of decisions made in this workflow execution</Text>
              </Code>
            </CardBody>
          </Card>
        )}
        
        <FormControl mt={4}>
          <FormLabel>Available Tools</FormLabel>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4}>
            <Box>
              <Switch 
                id="tool-retrieve" 
                isChecked={agent.tools && agent.tools.includes('retrieve_information')}
                onChange={(e) => {
                  const tools = agent.tools || [];
                  if (e.target.checked) {
                    if (!tools.includes('retrieve_information')) {
                      handleChange('tools', [...tools, 'retrieve_information']);
                    }
                  } else {
                    handleChange('tools', tools.filter(t => t !== 'retrieve_information'));
                  }
                }}
                colorScheme="teal"
              />
              <FormLabel htmlFor="tool-retrieve" fontSize="sm" ml={2}>
                Knowledge Retrieval
              </FormLabel>
            </Box>
            
            <Box>
              <Switch 
                id="tool-web" 
                isChecked={agent.tools && agent.tools.includes('web_search')}
                onChange={(e) => {
                  const tools = agent.tools || [];
                  if (e.target.checked) {
                    if (!tools.includes('web_search')) {
                      handleChange('tools', [...tools, 'web_search']);
                    }
                  } else {
                    handleChange('tools', tools.filter(t => t !== 'web_search'));
                  }
                }}
                colorScheme="blue"
              />
              <FormLabel htmlFor="tool-web" fontSize="sm" ml={2}>
                Web Search
              </FormLabel>
            </Box>
            
            <Box>
              <Switch 
                id="tool-code" 
                isChecked={agent.tools && agent.tools.includes('execute_code')}
                onChange={(e) => {
                  const tools = agent.tools || [];
                  if (e.target.checked) {
                    if (!tools.includes('execute_code')) {
                      handleChange('tools', [...tools, 'execute_code']);
                    }
                  } else {
                    handleChange('tools', tools.filter(t => t !== 'execute_code'));
                  }
                }}
                colorScheme="yellow"
              />
              <FormLabel htmlFor="tool-code" fontSize="sm" ml={2}>
                Code Execution
              </FormLabel>
            </Box>
            
            <Box>
              <Switch 
                id="tool-data" 
                isChecked={agent.tools && agent.tools.includes('analyze_data')}
                onChange={(e) => {
                  const tools = agent.tools || [];
                  if (e.target.checked) {
                    if (!tools.includes('analyze_data')) {
                      handleChange('tools', [...tools, 'analyze_data']);
                    }
                  } else {
                    handleChange('tools', tools.filter(t => t !== 'analyze_data'));
                  }
                }}
                colorScheme="green"
              />
              <FormLabel htmlFor="tool-data" fontSize="sm" ml={2}>
                Data Analysis
              </FormLabel>
            </Box>
          </SimpleGrid>
        </FormControl>

        <FormControl mt={4}>
          <FormLabel>Agentic Behavior</FormLabel>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Box>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="can-delegate" mb="0" fontSize="sm">
                  Can Delegate Tasks
                </FormLabel>
                <Switch 
                  id="can-delegate" 
                  isChecked={agent.can_delegate !== false}
                  onChange={(e) => handleChange('can_delegate', e.target.checked)}
                  colorScheme="purple"
                />
              </FormControl>
            </Box>
            
            <Box>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="can-use-tools" mb="0" fontSize="sm">
                  Can Use Tools
                </FormLabel>
                <Switch 
                  id="can-use-tools" 
                  isChecked={agent.can_use_tools !== false}
                  onChange={(e) => handleChange('can_use_tools', e.target.checked)}
                  colorScheme="purple"
                />
              </FormControl>
            </Box>
            
            <Box>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="can-finalize" mb="0" fontSize="sm">
                  Can Finalize Workflow
                </FormLabel>
                <Switch 
                  id="can-finalize" 
                  isChecked={agent.can_finalize !== false}
                  onChange={(e) => handleChange('can_finalize', e.target.checked)}
                  colorScheme="purple"
                />
              </FormControl>
            </Box>
            
            <Box>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="autonomous-decisions" mb="0" fontSize="sm">
                  Autonomous Decision Making
                </FormLabel>
                <Switch 
                  id="autonomous-decisions" 
                  isChecked={agent.autonomous_decisions !== false}
                  onChange={(e) => handleChange('autonomous_decisions', e.target.checked)}
                  colorScheme="purple"
                />
              </FormControl>
            </Box>
          </SimpleGrid>
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

  const handleParametersChange = (value) => {
    try {
      // Attempt to parse JSON
      const parsedParams = JSON.parse(value);
      handleChange('parameters', parsedParams);
    } catch (error) {
      // If JSON is invalid, store as string for now
      handleChange('parameters_string', value);
    }
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
          <Textarea
            value={
              typeof tool.parameters === 'object' 
                ? JSON.stringify(tool.parameters, null, 2) 
                : tool.parameters_string || '{}'
            }
            onChange={(e) => handleParametersChange(e.target.value)}
            placeholder={'{\n  "param1": {\n    "type": "string",\n    "description": "Description"\n  }\n}'}
            fontFamily="mono"
            rows={8}
          />
          <FormHelperText>
            Define the parameters this tool accepts in JSON format
          </FormHelperText>
        </FormControl>

        <FormControl mt={4}>
          <FormLabel>Agentic Settings</FormLabel>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Box>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="requires-confirmation" mb="0" fontSize="sm">
                  Requires User Confirmation
                </FormLabel>
                <Switch 
                  id="requires-confirmation" 
                  isChecked={tool.requires_confirmation}
                  onChange={(e) => handleChange('requires_confirmation', e.target.checked)}
                  colorScheme="orange"
                />
              </FormControl>
            </Box>
            
            <Box>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="always-available" mb="0" fontSize="sm">
                  Always Available
                </FormLabel>
                <Switch 
                  id="always-available" 
                  isChecked={tool.always_available !== false}
                  onChange={(e) => handleChange('always_available', e.target.checked)}
                  colorScheme="blue"
                />
              </FormControl>
            </Box>
          </SimpleGrid>
        </FormControl>
      </CardBody>
    </Card>
  );
};

// Workflow execution graph editor
const ExecutionGraphEditor = ({ graph, onChange, availableAgents = [] }) => {
  const [editing, setEditing] = useState(false);
  const [connectionFrom, setConnectionFrom] = useState(null);
  const [connectionTo, setConnectionTo] = useState(null);
  
  const handleAddConnection = () => {
    if (!connectionFrom || !connectionTo) return;
    
    const newGraph = { ...graph };
    if (!newGraph[connectionFrom]) {
      newGraph[connectionFrom] = [];
    }
    
    if (!newGraph[connectionFrom].includes(connectionTo)) {
      newGraph[connectionFrom] = [...newGraph[connectionFrom], connectionTo];
      onChange(newGraph);
    }
    
    // Reset the selection
    setConnectionTo(null);
  };
  
  const handleRemoveConnection = (from, to) => {
    const newGraph = { ...graph };
    if (newGraph[from]) {
      newGraph[from] = newGraph[from].filter(agent => agent !== to);
      // Clean up empty arrays
      if (newGraph[from].length === 0) {
        delete newGraph[from];
      }
    }
    onChange(newGraph);
  };
  
  // Check if the graph has cycles
  const hasCycle = (graph) => {
    const visited = new Set();
    const recStack = new Set();
    
    const dfs = (node) => {
      visited.add(node);
      recStack.add(node);
      
      // Visit neighbors
      if (graph[node]) {
        for (const neighbor of graph[node]) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) {
              return true;
            }
          } else if (recStack.has(neighbor)) {
            return true;
          }
        }
      }
      
      // Remove from recursion stack
      recStack.delete(node);
      return false;
    };
    
    // Check each node
    for (const node in graph) {
      if (!visited.has(node)) {
        if (dfs(node)) {
          return true;
        }
      }
    }
    
    return false;
  };
  
  return (
    <Card mb={4}>
      <CardHeader>
        <Flex justify="space-between" align="center">
          <Heading size="md">Execution Graph (Optional)</Heading>
          <Button
            size="sm"
            leftIcon={editing ? <FiSave /> : <FiEdit />}
            onClick={() => setEditing(!editing)}
            colorScheme={editing ? "green" : "gray"}
          >
            {editing ? "Done" : "Edit Connections"}
          </Button>
        </Flex>
      </CardHeader>
      <CardBody>
        <Text mb={4} fontSize="sm">
          Define which agents can delegate to which other agents. If left empty, all agents can potentially delegate to any other agent based on their decisions.
        </Text>
        
        {hasCycle(graph) && (
          <Alert status="warning" mb={4}>
            <AlertIcon />
            <Box>
              <Text fontWeight="bold">Circular reference detected</Text>
              <Text fontSize="sm">
                Your execution graph contains cycles, which could lead to infinite loops. 
                Consider removing circular references.
              </Text>
            </Box>
          </Alert>
        )}
        
        {Object.keys(graph).length > 0 ? (
          <Box>
            {Object.entries(graph).map(([agent, targets]) => (
              <Box key={agent} mb={3} p={3} borderWidth="1px" borderRadius="md">
                <Flex align="center" mb={2}>
                  <Text fontWeight="bold">{agent}</Text>
                  <Text mx={2}>→ can delegate to →</Text>
                </Flex>
                <Flex wrap="wrap" gap={2}>
                  {targets.map(target => (
                    <Badge 
                      key={target}
                      colorScheme="purple"
                      p={2}
                      borderRadius="md"
                    >
                      {target}
                      {editing && (
                        <IconButton
                          icon={<FiTrash2 />}
                          size="xs"
                          ml={1}
                          variant="ghost"
                          colorScheme="red"
                          aria-label="Remove connection"
                          onClick={() => handleRemoveConnection(agent, target)}
                        />
                      )}
                    </Badge>
                  ))}
                </Flex>
              </Box>
            ))}
          </Box>
        ) : (
          <Flex 
            direction="column" 
            align="center" 
            justify="center" 
            py={6} 
            borderWidth="1px" 
            borderStyle="dashed" 
            borderRadius="md"
          >
            <Box as={FiShare2} fontSize="3xl" color="gray.400" mb={3} />
            <Text color="gray.500" mb={2}>No execution graph defined</Text>
            <Text fontSize="sm" color="gray.500">
              Agents will make autonomous routing decisions at runtime
            </Text>
          </Flex>
        )}
        
        {editing && (
          <Box mt={4}>
            <Heading size="sm" mb={3}>Add New Connection</Heading>
            <SimpleGrid columns={2} spacing={4}>
              <Select 
                placeholder="Agent can delegate from..." 
                value={connectionFrom}
                onChange={(e) => setConnectionFrom(e.target.value)}
              >
                {availableAgents.map(agent => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </Select>
              
              <Flex>
                <Select 
                  placeholder="To agent..." 
                  mr={2}
                  isDisabled={!connectionFrom}
                  value={connectionTo}
                  onChange={(e) => setConnectionTo(e.target.value)}
                >
                  {availableAgents
                    .filter(agent => agent !== connectionFrom)
                    .map(agent => (
                      <option key={agent} value={agent}>{agent}</option>
                    ))}
                </Select>
                <Button 
                  colorScheme="purple" 
                  isDisabled={!connectionFrom || !connectionTo}
                  onClick={handleAddConnection}
                >
                  Add
                </Button>
              </Flex>
            </SimpleGrid>
          </Box>
        )}
      </CardBody>
    </Card>
  );
};

// Main AgenticWorkflowCreator component
const AgenticWorkflowCreator = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNewWorkflow = !id;

  // State
  const [workflow, setWorkflow] = useState({
    name: '',
    description: '',
    template_id: '',
    workflow_type: 'agentic',
    config: {
      supervisor: null,
      workers: [],
      tools: [],
      execution_graph: {},
      workflow_config: {
        max_iterations: 5,
        checkpoint_dir: './checkpoints',
        enable_logging: true,
        decision_format: 'hybrid'
      }
    }
  });
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

  // Fetch workflow data if editing existing workflow
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch templates for selection
        const templatesData = await apiClient.get('/api/templates');
        setTemplates(templatesData || []);
        
        if (id) {
          // Fetch existing workflow
          const workflowData = await apiClient.get(`/api/workflows/${id}`);
          
          setWorkflow({
            id: workflowData.id,
            name: workflowData.name,
            description: workflowData.description || '',
            template_id: workflowData.template_id,
            workflow_type: 'agentic', // Force agentic type
            config: workflowData.config || {}
          });
        } else {
          // Initialize with default supervisor agent for new workflows
          const defaultSupervisor = {
            name: 'supervisor',
            role: 'supervisor',
            model_provider: 'vertex_ai',
            model_name: 'gemini-1.5-pro',
            prompt_template: 'You are a supervisor agent coordinating a team of specialized agents.\nYour task is to analyze the user query and decide which agent should handle it.\n\nUser query: {input}\n\n{make_decision}',
            system_message: 'You are a supervisor that coordinates a team of specialized AI agents. Your role is to understand user requests and delegate to appropriate team members.',
            temperature: 0.3,
            can_delegate: true,
            can_use_tools: true,
            can_finalize: true,
            autonomous_decisions: true,
            agentic_system_message: true
          };
          
          setWorkflow(prev => ({
            ...prev,
            config: {
              ...prev.config,
              supervisor: defaultSupervisor
            }
          }));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load workflow data',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        
        // Navigate back on error
        navigate('/workflows');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, navigate, toast]);

  // Handle form field changes
  const handleFormChange = (field, value) => {
    setWorkflow({
      ...workflow,
      [field]: value
    });
  };
  
  // Handle agent changes
  const handleAgentChange = (index, updatedAgent) => {
    if (updatedAgent.role === 'supervisor') {
      // Update supervisor
      setWorkflow({
        ...workflow,
        config: {
          ...workflow.config,
          supervisor: updatedAgent
        }
      });
    } else {
      // Update worker
      const updatedWorkers = [...(workflow.config.workers || [])];
      updatedWorkers[index] = updatedAgent;
      setWorkflow({
        ...workflow,
        config: {
          ...workflow.config,
          workers: updatedWorkers
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
      prompt_template: 'You are a specialized agent.\n\nTask: {input}\n\n{make_decision}',
      system_message: 'You are a specialized agent that works as part of a team. You can use tools and communicate with other agents to solve complex tasks.',
      temperature: 0.7,
      can_delegate: true,
      can_use_tools: true,
      can_finalize: false,
      autonomous_decisions: true,
      agentic_system_message: true
    };
    
    setWorkflow({
      ...workflow,
      config: {
        ...workflow.config,
        workers: [...(workflow.config.workers || []), newAgent]
      }
    });
  };
  
  // Delete agent
  const deleteAgent = (index) => {
    const updatedWorkers = [...(workflow.config.workers || [])];
    updatedWorkers.splice(index, 1);
    setWorkflow({
      ...workflow,
      config: {
        ...workflow.config,
        workers: updatedWorkers
      }
    });
  };
  
  // Handle tool changes
  const handleToolChange = (index, updatedTool) => {
    const updatedTools = [...(workflow.config.tools || [])];
    updatedTools[index] = updatedTool;
    setWorkflow({
      ...workflow,
      config: {
        ...workflow.config,
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
      },
      requires_confirmation: false,
      always_available: true
    };
    
    setWorkflow({
      ...workflow,
      config: {
        ...workflow.config,
        tools: [...(workflow.config.tools || []), newTool]
      }
    });
  };
  
  // Delete tool
  const deleteTool = (index) => {
    const updatedTools = [...(workflow.config.tools || [])];
    updatedTools.splice(index, 1);
    setWorkflow({
      ...workflow,
      config: {
        ...workflow.config,
        tools: updatedTools
      }
    });
  };
  
  // Update workflow config
  const handleWorkflowConfigChange = (field, value) => {
    setWorkflow({
      ...workflow,
      config: {
        ...workflow.config,
        workflow_config: {
          ...(workflow.config.workflow_config || {}),
          [field]: value
        }
      }
    });
  };
  
  // Update execution graph
  const handleExecutionGraphChange = (newGraph) => {
    setWorkflow({
      ...workflow,
      config: {
        ...workflow.config,
        execution_graph: newGraph
      }
    });
  };
  
  // Import from template
  const handleImportFromTemplate = async (templateId) => {
    if (!templateId) return;
    
    try {
      // Fetch template details
      const template = await apiClient.get(`/api/templates/${templateId}`);
      
      // Extract agents and tools from template
      const config = {
        ...workflow.config,
        workflow_config: {
          ...(workflow.config.workflow_config || {}),
          ...template.config.workflow_config
        }
      };
      
      // Copy supervisor if exists
      if (template.config.supervisor) {
        config.supervisor = {
          ...template.config.supervisor,
          agentic_system_message: true,
          can_delegate: true,
          can_use_tools: true,
          can_finalize: true,
          autonomous_decisions: true
        };
      }
      
      // Copy workers if exist
      if (template.config.workers && template.config.workers.length > 0) {
        config.workers = template.config.workers.map(worker => ({
          ...worker,
          agentic_system_message: true,
          can_delegate: true,
          can_use_tools: true,
          can_finalize: false,
          autonomous_decisions: true
        }));
      }
      
      // Copy agents if swarm type
      if (template.config.agents && template.config.agents.length > 0) {
        // Convert swarm agents to supervisor/worker setup
        const firstAgent = template.config.agents[0];
        config.supervisor = {
          ...firstAgent,
          name: 'supervisor',
          role: 'supervisor',
          agentic_system_message: true,
          can_delegate: true,
          can_use_tools: true,
          can_finalize: true,
          autonomous_decisions: true
        };
        
        config.workers = template.config.agents.slice(1).map(agent => ({
          ...agent,
          agentic_system_message: true,
          can_delegate: true,
          can_use_tools: true,
          can_finalize: false,
          autonomous_decisions: true
        }));
      }
      
      // Copy tools
      if (template.config.tools && template.config.tools.length > 0) {
        config.tools = template.config.tools.map(tool => ({
          ...tool,
          requires_confirmation: false,
          always_available: true
        }));
      }
      
      // Update workflow
      setWorkflow({
        ...workflow,
        template_id: templateId,
        config
      });
      
      toast({
        title: 'Template Imported',
        description: 'Template configuration has been applied',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error importing template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to import template',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Test workflow with validation
  const testWorkflow = async () => {
    try {
      // Validate configuration using the agentic API
      const validationResult = await workflowsApi.validate(workflow.config);
      
      if (validationResult.valid) {
        toast({
          title: 'Workflow Validation Successful',
          description: validationResult.message || 'The workflow configuration is valid',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Set enhanced config if provided
        if (validationResult.enhanced_config) {
          setWorkflow(prev => ({
            ...prev,
            config: validationResult.enhanced_config
          }));
        }
      } else {
        toast({
          title: 'Workflow Validation Failed',
          description: validationResult.message || 'The workflow configuration is invalid',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error validating workflow:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to validate workflow',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Save workflow
  const saveWorkflow = async () => {
    // Validate fields
    if (!workflow.name) {
      toast({
        title: 'Validation Error',
        description: 'Workflow name is required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    if (!workflow.config.supervisor) {
      toast({
        title: 'Validation Error',
        description: 'Supervisor agent is required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setSaving(true);
    
    try {
      let savedWorkflow;
      
      if (id) {
        // Update existing workflow
        savedWorkflow = await apiClient.put(`/api/workflows/${id}`, {
          ...workflow,
          workflow_type: 'agentic', // Ensure workflow type is agentic
        });
      } else {
        // Create new workflow
        savedWorkflow = await apiClient.post('/api/workflows', {
          ...workflow,
          workflow_type: 'agentic', // Ensure workflow type is agentic
        });
      }
      
      toast({
        title: 'Success',
        description: `Workflow ${id ? 'updated' : 'created'} successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Navigate to workflow list
      navigate('/workflows');
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save workflow',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Get list of all agent names (for execution graph)
  const getAgentNames = () => {
    const names = [];
    
    if (workflow.config.supervisor) {
      names.push(workflow.config.supervisor.name);
    }
    
    if (workflow.config.workers) {
      workflow.config.workers.forEach(worker => {
        if (worker.name) {
          names.push(worker.name);
        }
      });
    }
    
    return names;
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
            onClick={() => navigate('/workflows')}
            aria-label="Back to workflows"
          />
          <Heading>
            {isNewWorkflow ? 'Create Agentic Workflow' : 'Edit Agentic Workflow'}
          </Heading>
          <Badge colorScheme="purple" ml={2}>Agentic</Badge>
        </HStack>
        
        <HStack>
          <Button
            leftIcon={<FiPlay />}
            colorScheme="green"
            variant="outline"
            onClick={testWorkflow}
          >
            Test Workflow
          </Button>
          <Button
            leftIcon={<FiSave />}
            colorScheme="brand"
            onClick={saveWorkflow}
            isLoading={saving}
          >
            Save Workflow
          </Button>
        </HStack>
      </Flex>
      
      <SimpleGrid columns={{ base: 1, lg: showPreview ? 2 : 1 }} spacing={8}>
        <Box>
          {/* Basic workflow details */}
          <Card mb={6}>
            <CardBody>
              <FormControl mb={4} isRequired>
                <FormLabel>Workflow Name</FormLabel>
                <Input
                  value={workflow.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g. Research Assistant"
                />
              </FormControl>
              
              <FormControl mb={4}>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={workflow.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Describe what this workflow does"
                  rows={3}
                />
              </FormControl>
              
              <FormControl mb={4}>
                <FormLabel>Import from Template (Optional)</FormLabel>
                <Select
                  value={workflow.template_id || ''}
                  onChange={(e) => handleImportFromTemplate(e.target.value)}
                  placeholder="Select template to import configuration"
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.workflow_type})
                    </option>
                  ))}
                </Select>
                <FormHelperText>
                  Import agents and tools from an existing template to accelerate setup
                </FormHelperText>
              </FormControl>
            </CardBody>
          </Card>
          
          {/* Workflow details tabs */}
          <Tabs colorScheme="brand" isLazy>
            <TabList>
              <Tab><Box as={FiCpu} mr={2} /> Agents</Tab>
              <Tab><Box as={FiTool} mr={2} /> Tools</Tab>
              <Tab><Box as={FiShare2} mr={2} /> Flow</Tab>
              <Tab><Box as={FiSettings} mr={2} /> Settings</Tab>
            </TabList>
            
            <TabPanels>
              {/* Agents Tab */}
              <TabPanel p={0} pt={4}>
                {workflow.config.supervisor && (
                  <AgentConfigForm
                    agent={workflow.config.supervisor}
                    onChange={(updatedAgent) => handleAgentChange(-1, updatedAgent)}
                    isNew={false}
                    providers={providers}
                    modelOptions={modelOptions}
                  />
                )}
                
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
                  
                  {workflow.config.workers?.map((worker, index) => (
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
                  
                  {!workflow.config.workers?.length && (
                    <Text color="gray.500" textAlign="center" py={4}>
                      No worker agents defined yet. Add some to get started.
                    </Text>
                  )}
                </Box>
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
                
                {workflow.config.tools?.map((tool, index) => (
                  <ToolConfigForm
                    key={index}
                    tool={tool}
                    onChange={(updatedTool) => handleToolChange(index, updatedTool)}
                    onDelete={() => deleteTool(index)}
                    isNew={false}
                  />
                ))}
                
                {!workflow.config.tools?.length && (
                  <Text color="gray.500" textAlign="center" py={4}>
                    No tools defined yet. Add some to enable agent capabilities.
                  </Text>
                )}
              </TabPanel>
              
              {/* Flow Tab */}
              <TabPanel p={0} pt={4}>
                <ExecutionGraphEditor 
                  graph={workflow.config.execution_graph || {}}
                  onChange={handleExecutionGraphChange}
                  availableAgents={getAgentNames()}
                />
                
                <Card>
                  <CardHeader>
                    <Heading size="md">Decision Flow</Heading>
                  </CardHeader>
                  <CardBody>
                    <FormControl mb={4}>
                      <FormLabel>Override Default Decisions</FormLabel>
                      <Switch
                        isChecked={workflow.config.override_agent_decisions}
                        onChange={(e) => handleFormChange('config', {
                          ...workflow.config,
                          override_agent_decisions: e.target.checked
                        })}
                        colorScheme="purple"
                      />
                      <FormHelperText>
                        When enabled, the execution graph will override agent decisions about delegation
                      </FormHelperText>
                    </FormControl>
                    
                    <Alert status="info" borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <Text fontWeight="medium">Agentic Decision Making</Text>
                        <Text fontSize="sm">
                          By default, agents will make their own decisions about which agent to delegate to next.
                          Use the execution graph above to restrict which agents can delegate to which other agents.
                        </Text>
                      </Box>
                    </Alert>
                  </CardBody>
                </Card>
              </TabPanel>
              
              {/* Settings Tab */}
              <TabPanel p={0} pt={4}>
                <Card>
                  <CardBody>
                    <Heading size="md" mb={4}>Workflow Configuration</Heading>
                    
                    <FormControl mb={4}>
                      <FormLabel>Max Iterations</FormLabel>
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={workflow.config.workflow_config?.max_iterations || 5}
                        onChange={(e) => handleWorkflowConfigChange('max_iterations', parseInt(e.target.value))}
                      />
                      <FormHelperText>
                        Maximum number of decision steps before forcing completion (1-20)
                      </FormHelperText>
                    </FormControl>
                    
                    <FormControl mb={4}>
                      <FormLabel>Checkpoint Directory</FormLabel>
                      <Input
                        value={workflow.config.workflow_config?.checkpoint_dir || './checkpoints'}
                        onChange={(e) => handleWorkflowConfigChange('checkpoint_dir', e.target.value)}
                      />
                      <FormHelperText>
                        Directory to store workflow state checkpoints
                      </FormHelperText>
                    </FormControl>
                    
                    <FormControl mb={4}>
                      <FormLabel>Enable Detailed Logging</FormLabel>
                      <Switch
                        isChecked={workflow.config.workflow_config?.enable_logging || false}
                        onChange={(e) => handleWorkflowConfigChange('enable_logging', e.target.checked)}
                      />
                      <FormHelperText>
                        Enable verbose logging of agent decisions and tool usage
                      </FormHelperText>
                    </FormControl>
                    
                    <Divider my={4} />
                    
                    <Heading size="sm" mb={3}>Advanced Settings</Heading>
                    
                    <FormControl mb={4}>
                      <FormLabel>Agent Decision Format</FormLabel>
                      <Select
                        value={workflow.config.workflow_config?.decision_format || 'hybrid'}
                        onChange={(e) => handleWorkflowConfigChange('decision_format', e.target.value)}
                      >
                        <option value="hybrid">Hybrid (Natural Language + Structured)</option>
                        <option value="structured">Structured Only (JSON)</option>
                        <option value="natural">Natural Language Only</option>
                      </Select>
                      <FormHelperText>
                        How agents should format their decisions
                      </FormHelperText>
                    </FormControl>
                    
                    <FormControl mb={4}>
                      <FormLabel>Max Decision Time (Seconds)</FormLabel>
                      <Input
                        type="number"
                        min="5"
                        max="300"
                        value={workflow.config.workflow_config?.max_decision_time_seconds || 60}
                        onChange={(e) => handleWorkflowConfigChange('max_decision_time_seconds', parseInt(e.target.value))}
                      />
                      <FormHelperText>
                        Maximum time allowed for agent decisions before timing out
                      </FormHelperText>
                    </FormControl>
                  </CardBody>
                </Card>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
        
        {/* Workflow Preview */}
        {showPreview && (
          <Box>
            <Card>
              <CardBody>
                <Heading size="md" mb={4}>Workflow Preview</Heading>
                <Tabs variant="enclosed" size="sm">
                  <TabList>
                    <Tab>Visual</Tab>
                    <Tab>JSON</Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel>
                      <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.50">
                        <Heading size="sm" mb={3}>{workflow.name}</Heading>
                        <Text fontSize="sm" mb={4}>{workflow.description}</Text>
                        
                        <Box mb={4}>
                          <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>WORKFLOW TYPE</Text>
                          <Badge colorScheme="purple">Agentic</Badge>
                        </Box>
                        
                        <Box mb={4}>
                          <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>SUPERVISOR</Text>
                          <HStack>
                            <Badge colorScheme="blue">{workflow.config.supervisor?.model_provider}</Badge>
                            <Text fontSize="sm">{workflow.config.supervisor?.name}</Text>
                          </HStack>
                          
                          <Divider my={3} />
                          
                          <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>WORKERS</Text>
                          {workflow.config.workers?.map((worker, idx) => (
                            <Box key={idx} mb={2}>
                              <HStack>
                                <Badge colorScheme="green">{worker.role}</Badge>
                                <Text fontSize="sm">{worker.name}</Text>
                                <Badge colorScheme="gray">{worker.model_provider}</Badge>
                              </HStack>
                            </Box>
                          ))}
                        </Box>
                        
                        <Box mb={4}>
                          <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>TOOLS</Text>
                          {workflow.config.tools?.map((tool, idx) => (
                            <Badge key={idx} mr={2} mb={2} colorScheme="orange">
                              {tool.name}
                            </Badge>
                          ))}
                          {!workflow.config.tools?.length && (
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
                        <pre>{JSON.stringify(workflow, null, 2)}</pre>
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

export default AgenticWorkflowCreator;
